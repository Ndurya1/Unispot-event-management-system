# UniSpot Project Status

## Core Features (Backend + Frontend)
- [x] Full-stack architecture: FastAPI + PostgreSQL backend, React + TypeScript frontend
- [x] Authentication with JWT tokens and Argon2 password hashing
- [x] Role-based access control (Organizer, Venue Admin, System Admin)
- [x] Venue catalogue with search, filtering, and availability checking
- [x] Policy-driven automatic venue booking (no admin approval queue)
- [x] Conflict detection and prevention via PostgreSQL constraints and transactions
- [x] Booking policy enforcement (24hr lead time, 180-day window, 12hr max duration, capacity checks, org membership, operating hours)
- [x] My Bookings management with cancellation
- [x] In-app notifications system
- [x] Rule-based in-app assistant with allowlisted tools and confirmation flow
- [x] Admin dashboard with user management, venue management, allocations view, analytics
- [x] Venue blocks/closures for maintenance
- [x] Audit logging for critical actions

## Frontend-Only Demonstrations (No Backend Implementation)
- [ ] Event Registration & RSVP (frontend demo only)
- [ ] QR Tickets & Attendance (frontend demo only)
- [ ] Service Provider Directory (frontend demo only)
- [ ] Equipment Reservations (frontend demo only)
- [ ] Digital Certificates (frontend demo only)
- [ ] Waitlists & Recurring Bookings (student waitlist UI exists but full backend implementation may be partial)

## Documentation & Submission Readiness
- [x] Update README to reflect full-stack nature
- [ ] Create booking policy documentation (current fixed criteria)
- [ ] Document role provisioning process for local development
- [ ] Update project report using Implementation Update Addendum
- [ ] Capture test evidence (backend tests, linting, type checks)
- [ ] Capture browser test evidence for core flows
- [ ] Document scope decisions for demo features

## Future Enhancements
- [ ] Versioned/effective-dated booking policy management
- [ ] LLM-powered assistant (Gemini adapter exists but disabled)
- [ ] Email/SMS notifications
- [ ] Production deployment configuration
- [ ] Comprehensive browser/end-to-end testing

## Campus Services overview design

- [x] Add Services to the shared taskbar after Organizations and before My Bookings; show an active state on `/services` and nested `/services/:serviceId`; retain a keyboard-operable responsive mobile menu without duplicate Services links.
- [x] Build `/services` to match the supplied Services design: deep-navy taskbar; pale-lavender split hero headed “More than just bookings — we power your campus experience.”; supporting campus-services copy and Convenient/Secure/Student Focused indicators; a “Campus Services” introduction; five user-facing cards for Event Registration & RSVP, QR Tickets & Attendance, Service Provider Directory, Equipment Reservations, and Digital Certificates; each card has a description, benefit bullets, an Explore Service action, and a compact illustrative preview; include the final “Ready to get started?” services call-to-action and footer.

## Service detail designs

- [x] Build the Event Registration & RSVP screen from the reference: provide Back to Services; event-photo banner; benefits for online registration, capacity tracking, confirmation emails, and attendance management; Innovation & Tech Day details (12 Apr, 10:00 AM–4:00 PM, Main Campus, Tech Club, 200 seats/100 registered); and a labeled form for Full Name, Email Address, Phone Number, and optional Student ID. Validate locally; confirmation clearly says this is a demo and no real registration or email was sent.
- [x] Build QR Tickets & Attendance with accessible My Tickets and Organizer View tabs; list upcoming Innovation & Tech Day, Culture Fest, and Leadership Workshop; allow View Ticket to select a local demo ticket with a clearly non-valid QR illustration and ticket details; provide demo-only Download/Share feedback; show organizer counts (200 registered, 150 checked in, 50 not checked in, 75% attendance) and a Scan QR Code action that explains camera check-in is not connected.
- [x] Build the Campus Service Providers directory with search plus Category, Price Range, and Availability filters; show mock cards for Royal Catering Services, Pocus Media Kenya, Sound Masters KE, and Event Decor Solutions with category, rating/review count, campus location, and starting price; provide View Provider and Request Service actions. The request form is client-side only and says no provider was contacted.
- [x] Move platform-wide Analytics & Reports from the public Campus Services detail route to Admin. The public service catalog and detail routes no longer expose campus-wide analytics; Admin provides platform KPIs/trends, Top Venues, reporting activity, and Export Report/Download PDF actions that clearly state no real report file or analytics export is connected.
- [x] Build Equipment Reservations with Projector, Sound System, Laptop, Chairs & Tables, Microphone, and Whiteboard cards, availability counts and View Details actions; add a Reserve Equipment form for date, time and quantity plus Check Availability; show local mock feedback only and do not create an equipment reservation.
- [x] Move Waitlists & Recurring Bookings to Admin while retaining `/my-waitlists` for student-owned Great Hall/Seminar Room B queue entries and their queue status/position. Link My Waitlists from the student dashboard; students can leave their own waitlist entry, while campus-wide queues and recurring requests remain in Admin. Changes are temporary demo state and do not reserve venues or notify anyone.
- [x] Build Digital Certificates with a certificate-preview hero, the benefits Automatic Generation/Custom Templates/Download & Share/Track Issued Certificates, accessible My Certificates/Templates/History tabs, and the sample available records Innovation & Tech Day (16 Apr 2026), Leadership Workshop (10 Apr 2026), Culture Fest (28 Mar 2026), and Tech Talk Series (15 Mar 2026). Download/template actions clearly state no real certificate has been issued or downloaded.
- [x] Build a shared responsive service-dashboard shell for `/services/:serviceId`: dark left navigation to Home, Events, Venues, Organizations, Services (active), and My Bookings; a light header with working event search, Notifications badge and profile; skip link, visible focus, labeled controls, accessible tabs/status, and a mobile menu. Use per-page modules, keep the dynamic route and route manifest synchronized, and keep every action frontend-only with demo feedback rather than real submissions, provider contact, scanning, equipment reservation, or certificate integration. Do not expose campus-wide analytics, exports, waitlist administration, or recurring-booking controls on this public shell.

## UniSpot Admin interface (current request)

- [x] Create the separate responsive Admin shell and dashboard at `/admin` with a navy sidebar and the reference navigation: Dashboard, Users, Events, Venues, Bookings, Organizations, Service Providers, Equipment, Registrations, Notifications, Analytics & Reports, Maintenance, Policies & Rules, Waitlists & Recurring Bookings, Audit Logs, and System Settings. The dashboard shows Total Users 8,432 (+12%), Total Events 248 (+18%), Total Bookings 1,204 (+14%), Total Attendance 24,890 (+20%), Event Registrations Trend, Popular Venues, Recent Activity, a System Announcement, and Quick Actions Add Venue/Add Event/Add User/View Reports. Identify all records and actions as frontend-demo content, not protected or saved admin data.
- [x] Preserve the user/administrator division from the supplied design: keep student/organizer event discovery and registration, event details/QR tickets, personal venue bookings, My Bookings, approved-provider browsing, user notifications (receive only), certificates, chatbot, and profile/settings on the user site. Do not add Admin to public sign-up roles or insert manual booking approval. Move platform-wide Analytics & Reports and recurring/waitlist management into Admin. Keep student self-service joining/leaving a personal waitlist and queue visibility at `/my-waitlists`, linked from the student dashboard; do not expose global queue management or recurring schedules to ordinary users.
- [x] Build Admin management screens for Venues, Users, Events, Organizations, Service Providers, Equipment, and Registrations. Use sample tables/cards matching the reference; make search, status, create/edit, provider verification, and inventory controls interactive in local state with clear preview-only feedback.
- [x] Build Booking Rules & Policies as editable local settings for duration limits, notice periods, restrictions, cancellation policy, and advanced event types. Venue booking requests must be automatically confirmed when rules/availability pass; there is no Admin approve/reject intermediary. Show booking outcomes as rule-based/read-only monitoring. A user's event cancellation frees the venue slot and the waitlist may be notified/advanced automatically; do not create a manual approval gate.
- [x] Build platform-wide Analytics & Reports with dashboard metrics and trends; build Maintenance Management for venue/equipment service status and schedules. Use sample records and do not claim export or real operational updates have reached a backend.
- [x] Build Admin Notifications Management with recipient targeting and a message-preview/send-demo action; retain read-only/receive-only Notifications for users. Build Admin Waitlist & Recurring Booking Management to monitor queues and recurring requests while keeping student join/leave and queue status on the user site; demonstrate all changes locally only.
- [x] Build read-only Audit Logs and configurable System Settings screens, plus admin search across users/events/venues. Do not fabricate a real audit trail, role security, or persisted settings; make the missing backend boundary visible.
- [x] Keep existing and new page routes synchronized in `public/manus-routes.json`; test desktop/mobile navigation, search, local admin forms/actions, the student My Waitlists route, and the no-booking-approval invariant. Preserve labels, visible focus, semantic tables/forms, keyboard access, and reduced-motion support.

## Frontend-backend API integration

These related tasks cover moving supported screens from the completed frontend prototype to live APIs. IDs below are local planning references, not published issue numbers. Use `Docs/frontend/API_CALL_INSTRUCTIONS.md` and the backend routes/schemas as the contract.

First milestone: a user with an active organizer membership can log in, find a venue, create a booking, see it after reload, and cancel it under the backend's rules.

- [ ] INT-01: Define integration scope and resolve API/UI contract gaps

  Map screens to existing endpoints and document field mismatches, including venue images/facilities, availability intervals, and signup account choices. Record missing APIs for events/RSVPs, QR tickets, providers, equipment, certificates, waitlists/recurrence, password reset, public organizations, and unsupported admin functions as follow-up backend work.
  Done when each screen is classified as ready to integrate, requiring a backend addition, or remaining an explicit demo/unavailable feature. Depends on: none.

- [ ] INT-02: Expose current-user context and eligible organizations

  Add authenticated read endpoints for the current user's profile, assigned roles, and active organizer memberships with organization details. Preserve administrative control of roles and memberships; registration must not grant them.
  Done when the frontend can determine navigation permissions and populate a booking organization selector, including the no-membership state; add authorization coverage and update the API guide. Depends on: INT-01.

- [ ] INT-03: Build the shared typed API client

  Add configurable API origin, typed feature modules, bearer headers, common error parsing, request IDs, rate-limit handling, and bounded pagination. Verify development CORS and document local configuration using native fetch and existing dependencies.
  Done when feature modules share one request/error contract and correctly handle JSON, empty responses, and network failures. Depends on: INT-01.

- [ ] INT-04: Connect authentication and protected navigation

  Wire registration, login, session restoration, logout, and current-user loading. Define token persistence and Remember me behavior; coordinate one refresh-and-retry attempt and clear expired sessions. Align signup fields with the backend and protect private/admin routes using server-provided roles.
  Done when sessions behave correctly across reloads, failed refresh returns the user to login, and forbidden access does not trigger refresh. Depends on: INT-02, INT-03.

- [ ] INT-05: Connect venue discovery and availability

  Replace venue mocks with list/detail requests, real UUID links, supported filters, and pagination. Replace fixed mock slots with an interval-based availability flow and handle missing presentation fields without inventing operational data.
  Done when venue selection and availability reflect API responses and show loading, empty, error, and not-found states. Depends on: INT-03, INT-04.

- [ ] INT-06: Connect booking creation, My Bookings, and cancellation

  Add eligible-organization selection, timezone-aware payloads, explicit confirmation, and stable idempotency keys reused for retries. Connect personal booking lists/details and cancellation; refresh affected data after successful writes. Render backend policy/conflict errors and preserve automatic booking allocation without an approval queue.
  Done when a booking persists after reload, duplicate submissions do not create duplicates, and permitted cancellation updates the booking and releases availability. Depends on: INT-02, INT-04, INT-05.

- [ ] INT-07: Connect personal notifications and booking dashboard data

  Replace personal notification mocks with list/read requests and refresh unread counts. Populate booking-related dashboard sections from real bookings; keep unsupported event statistics and preferences clearly identified.
  Done when notification read state persists and booking summaries match the current user's records. Depends on: INT-04, INT-06.

- [ ] INT-08: Connect supported administration screens

  Integrate available venue/facility/operating-hours/block operations, organization management, allocation monitoring, and audit logs with appropriate role restrictions. Track missing user-list and other admin contracts before wiring dependent controls; do not use operational metrics as business analytics.
  Done when supported actions persist, forbidden actions are handled, and unsupported controls cannot claim successful writes. Depends on: INT-01, INT-04, INT-05.

- [ ] INT-09: Connect the in-app assistant

  Replace scripted chat replies with the assistant API, retain conversation state, and render server proposals before booking/cancellation confirmation. Confirm using the saved conversation and server-issued confirmation ID without resending tool arguments; account for the current rule-based provider's limits.
  Done when confirmed actions update booking data, failures are visible, and repeated confirmation cannot duplicate a booking. Depends on: INT-04, INT-06.

- [ ] INT-10: Verify integrated journeys and update project documentation

  Run frontend typecheck/build, relevant backend tests, and browser journeys against a development database. Cover session expiry, permissions, no eligible organization, conflicts, duplicate submission, cancellation, reload persistence, and service failures. Update setup instructions and prototype claims to match the integrated features.
  Done when the first milestone and supported notifications/admin/assistant flows are verified, with remaining backend gaps and environment requirements documented. Depends on: INT-06, INT-07, INT-08, INT-09.
