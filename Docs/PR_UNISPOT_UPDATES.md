# Docs/PR_UNISPOT_UPDATES.md
@'
## Summary
Consolidated UniSpot updates on `feature/unispot-updates` for review before merge to `main`: event/venue workflows, service-provider fulfillment, admin operations, auth/email scaffolding, and frontend performance improvements.

## Key changes
- **Events**: create/manage/admin flows, ownership (`created_by_user_id`), strict manager access (legacy null-owner events admin-only), registration/attendance/check-in, registrant notifications on update/cancel, event↔venue `VenueReservation` linkage with conflict/policy checks and release on cancel.
- **Bookings/admin**: admin booking list/cancel override with slot release, requester notification, booking event + `ADMIN_BOOKING_CANCELLED` audit; booking policy/idempotency tightening.
- **Service providers**: provider profiles (admin CRUD/approval, self-service constraints), requester requests with idempotency/cancel, admin assign/status override, provider assigned queue (allowed transitions + quotes), notifications/audit; provider dashboard and admin UI wired.
- **Ops foundations**: durable `system_settings`, `policy_rules`, `maintenance_records`, `certificates`; admin endpoints/UI for settings/policies/maintenance/certificates (+ existing admin sections).
- **Auth/UX**: safer session-check behavior, access/role routing updates, login clears email/password after successful login, email verification/reset scaffolding + Resend service (dev fallback logs links when not configured).
- **Performance**: home hero crossfade uses multiple images with deferred slide loading (`prefers-reduced-motion` respected), hero preload, lazy/async image hints, optimized/compressed `public/assets` images.

## Database
- **Migrations**: includes `20261105_0012`–`20261108_0023` (equipment, event registrations, providers, waitlists/recurring, provider assignment, email action tokens, event notification types, `created_by_user_id`, ops foundations, event venue link, service notification types, provider workflow).
- Run: `cd unispot-server && alembic upgrade head` (only where DB is not already migrated).

## Config (do not commit secrets)
- Backend `.env` (from `.env.example`): `DATABASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `FRONTEND_URL`, `EMAIL_VERIFY_TTL_MINUTES`, `PASSWORD_RESET_TTL_MINUTES`.
- **Real email blocked until** valid Resend key + verified sender + correct `FRONTEND_URL` + backend restart.

## Verification run
- Backend import smoke OK; `pytest tests/test_models.py -q` → `4 passed, 1 warning`.
- Provider routes present in OpenAPI; targeted TS checks clean for provider/admin/provider-dashboard files.
- **Known debt**: full `pnpm exec tsc --noEmit` still has unrelated/legacy typing errors outside this scope.

## Manual QA pending
- Session/auth stability and refresh behavior.
- Organizer: venue booking, service request (idempotent) / cancel / quote/status visibility.
- Admin: event edit/cancel notifications, booking cancel side effects, provider approve/assign/status, policies/maintenance/settings/certificates.
- Provider: assigned queue, status transitions, quotes (requires `owner_user_id` linked to provider account).
- Email delivery after Resend config.

## Notes
- Excluded from repo: `.env`, runtime logs, `public/assets/_originals/`, local one-off admin scripts (`.gitignore` updated).
