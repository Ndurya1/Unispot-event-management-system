# UniSpot frontend API call instructions

This guide is for frontend coding agents implementing pages, dashboards, hooks,
or API clients in the root React application. Follow the backend contract exactly.
Do not invent endpoints, approval states, requester fields, or response shapes.

The backend is the source of truth for authorization, booking policy, conflicts,
and persistence. The React app collects user input and renders responses; it must
not reimplement booking decisions in the browser.

## Service configuration

Use a single configurable API origin. Do not hard-code a production URL.

```js
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000")
  .replace(/\/$/, "");
```

Every request should use a relative backend path:

```js
fetch(`${API_BASE_URL}/venues`);
```

Do not call PostgreSQL, model providers, or internal service functions from React.

## Common request helper

Create one shared helper rather than duplicating headers and error parsing in each
component. The helper must preserve the server request ID and the rate-limit retry
hint.

```js
export class ApiError extends Error {
  constructor(status, payload, requestId, retryAfter) {
    super(payload?.error?.message || "The request could not be completed.");
    this.name = "ApiError";
    this.status = status;
    this.code = payload?.error?.code || "request_failed";
    this.details = payload?.error?.details || [];
    this.requestId = requestId || payload?.error?.request_id || null;
    this.retryAfter = retryAfter ? Number(retryAfter) : null;
  }
}

export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");

  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
    options = { ...options, body: JSON.stringify(options.body) };
  }

  const accessToken = getAccessToken(); // Read from the app auth store.
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const requestId = response.headers.get("X-Request-ID");
  const retryAfter = response.headers.get("Retry-After");
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    throw new ApiError(response.status, payload, requestId, retryAfter);
  }

  return { data: payload, requestId, response };
}
```

If the application uses a different state library, keep the same behavior. Never
log access tokens, refresh tokens, request bodies containing passwords, or full
assistant messages.

## Authentication

The backend exposes registration, login, an OAuth-style token alias, and refresh.
Registration creates an active account but does not grant organization
memberships or roles.

### Registration

`POST /auth/register` expects a full name, email, and password (at least 8
characters). It returns the same access/refresh token pair as login:

```js
const { data } = await apiFetch("/auth/register", {
  method: "POST",
  body: {
    full_name,
    email,
    password,
  },
});

saveTokens({
  accessToken: data.access_token,
  refreshToken: data.refresh_token,
});
```

Registration does not create an organization or organizer membership. A user
must be assigned to an organization before booking.

### Login

`POST /auth/login` expects an email and password and returns both tokens. Clients
that use a conventional bearer-token path may call `POST /auth/token` with the
same JSON body; it is an alias, not a separate token format.

```js
const { data } = await apiFetch("/auth/login", {
  method: "POST",
  body: {
    email,
    password,
  },
});

saveTokens({
  accessToken: data.access_token,
  refreshToken: data.refresh_token,
});
```

Treat `401` as a generic authentication failure. Do not display database errors,
stack traces, or token contents.

### Refresh

When an authenticated request returns `401`, attempt one refresh request, then
retry the original request once. Never retry indefinitely.

```js
const { data } = await apiFetch("/auth/refresh", {
  method: "POST",
  body: { refresh_token: getRefreshToken() },
});

saveAccessToken(data.access_token);
```

If refresh fails, clear the auth state and navigate to login. Do not refresh on a
`403`; that means the token is valid but the user lacks the required role.

## Standard response and error contract

Successful responses use the endpoint-specific JSON schema. Errors use this
envelope:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed",
    "request_id": "uuid",
    "details": []
  }
}
```

Render `error.message` as the user-facing summary and map `error.details` to
field-level messages where possible. Keep `error.request_id` available in support
or diagnostic UI. Common statuses are:

- `400`: malformed request or missing idempotency key.
- `401`: missing, expired, invalid, or inactive-user credentials.
- `403`: authenticated user lacks the required role.
- `404`: resource not found or not owned by the current user.
- `409`: conflict, duplicate idempotency key, occupied interval, or assistant
  confirmation mismatch.
- `413`: request body too large.
- `422`: schema or booking-policy validation failure.
- `429`: rate limit; respect the `Retry-After` response header.
- `503`: database or dependent-service unavailability.

Never expect the old FastAPI `{"detail": ...}` format from new code.

## Dates, pagination, and input bounds

- Send ISO-8601 timestamps with an explicit offset, for example
  `2026-11-12T14:00:00+03:00`. Do not send browser-local timestamps without an
  offset.
- Booking creation requires `venue_id`, `organization_id`, `event_name`,
  `expected_attendance`, `starts_at`, and `ends_at`.
- Booking descriptions are optional and limited to 4,000 characters.
- Use `limit` and `offset` on list endpoints. Respect the documented maximums;
  do not fetch unbounded lists.
- Availability searches cannot span more than 31 days.
- Booking list date filters cannot span more than 366 days.
- Display policy errors returned in `error.details`; do not assume a slot is
  bookable just because availability search returned it.

## Venue discovery and availability

Organizer-facing read calls do not require a role-specific admin header; they do
require the bearer token where the route is protected.

```js
const query = new URLSearchParams({
  capacity: String(80),
  location: "Main Campus",
  limit: "20",
  offset: "0",
});

const { data: venues } = await apiFetch(`/venues?${query}`);

const availability = new URLSearchParams({
  starts_at: "2026-11-12T14:00:00+03:00",
  ends_at: "2026-11-12T17:00:00+03:00",
  capacity: "80",
  limit: "20",
  offset: "0",
});

const { data: freeVenues } = await apiFetch(`/availability?${availability}`);
```

Venue administrators use the protected venue/facility/block management routes.
The frontend must hide those controls unless the authenticated user has the
appropriate role, but the backend remains the final authorization check.

## Booking creation and cancellation

Booking writes require a unique `Idempotency-Key`. Generate it once per user
intent and reuse it when retrying the same request. Do not generate a new key on
every network retry.

```js
const createKey = crypto.randomUUID();
const { data: booking } = await apiFetch("/bookings", {
  method: "POST",
  headers: { "Idempotency-Key": createKey },
  body: {
    venue_id: venueId,
    organization_id: organizationId,
    event_name: "Student orientation",
    event_description: "Optional event details",
    expected_attendance: 80,
    starts_at: "2026-11-12T14:00:00+03:00",
    ends_at: "2026-11-12T17:00:00+03:00",
  },
});
```

On `409`, show the conflict message and any alternative venues in
`error.details`. Do not silently change the requested venue or time.

```js
const cancelKey = crypto.randomUUID();
await apiFetch(`/bookings/${bookingId}/cancel`, {
  method: "POST",
  headers: { "Idempotency-Key": cancelKey },
  body: { reason: "Event postponed" },
});
```

Cancellation is ownership-checked and subject to the 24-hour cancellation rule.
The backend releases the occupied interval atomically after a successful cancel.

## Organizer booking views

Use these routes for the current user's private data:

```text
GET /bookings/me?status=CONFIRMED&limit=50&offset=0
GET /bookings/{booking_id}
POST /bookings/{booking_id}/cancel
```

Never send a `requester_id` query parameter or body field to identify the current
user. The backend derives identity from the bearer token.

## Assistant calls

The assistant endpoint is an in-app chat API, not a direct model API. The client
sends a message and optionally typed tool calls; the backend owns the provider,
tool validation, authorization, and booking transaction.

```js
const { data: proposal } = await apiFetch("/assistant/messages", {
  method: "POST",
  body: {
    message: "Book this venue for my event",
    tool_calls: [
      {
        name: "create_booking",
        arguments: {
          venue_id: venueId,
          organization_id: organizationId,
          event_name: "Student orientation",
          expected_attendance: 80,
          starts_at: "2026-11-12T14:00:00+03:00",
          ends_at: "2026-11-12T17:00:00+03:00",
        },
      },
    ],
    confirmed: false,
  },
});
```

For `create_booking` and `cancel_my_booking`, render the returned proposal and
ask the user to confirm it. A confirmation sends only the saved conversation and
server-issued confirmation ID; do not resend tool arguments:

```js
const { data: result } = await apiFetch("/assistant/messages", {
  method: "POST",
  body: {
    conversation_id: proposal.conversation_id,
    message: "Confirm",
    confirmed: true,
    confirmation_id: proposal.state.pending_confirmation.confirmation_id,
  },
});
```

Do not put `tool_calls` in a confirmation request. A changed non-confirmation
message invalidates the previous proposal. A repeated exact confirmation is safe
to retry and will not create a duplicate booking.

Allowed tool names are:

```text
search_venues
check_availability
get_booking_policy
create_booking
list_my_bookings
cancel_my_booking
```

The assistant must never receive or send raw SQL, database credentials,
`requester_id`, role escalation fields, or another user's private booking data.
Treat tool results as authoritative; model-style prose is not proof that a booking
was created.

## Administrative calls

Use role-protected routes only for the relevant dashboards:

```text
GET    /admin/allocations             # venue/system administrators; read-only
GET    /admin/audit                   # system administrators
GET    /admin/metrics                 # system administrators
PATCH  /admin/users/{id}/status       # system administrators
POST   /admin/users/{id}/roles        # system administrators
DELETE /admin/users/{id}/roles/{role} # system administrators
```

There are no approve, reject, prioritize, or reassign booking calls. Do not add
those controls to the UI or client API layer.

## Frontend implementation checklist

- Keep API calls in a shared client module or hooks, not directly throughout JSX.
- Attach the bearer token centrally and implement one refresh-and-retry attempt.
- Generate and reuse idempotency keys for booking mutations.
- Use timezone-aware ISO timestamps and bounded pagination.
- Render the standard error envelope and preserve request IDs for support.
- Show confirmation UI before assistant booking/cancellation writes.
- Keep loading, empty, conflict, unauthorized, forbidden, rate-limited, and
  unavailable states distinct.
- Never log secrets, authorization headers, passwords, full assistant messages,
  or private booking payloads.
- Update this guide when a backend endpoint or schema intentionally changes.
