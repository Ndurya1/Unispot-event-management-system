# UniSpot Campus Platform — Frontend

A responsive, frontend-only campus events and venue-booking prototype built with React, TypeScript, Vite, and React Router. It uses local mock data; authentication, event registration, provider requests, analytics export, QR scanning, equipment checks, waitlists, certificates, and venue bookings are demonstrations and do not submit real data or create records.

## Run locally

Requirements: Node.js 22+ and pnpm 11.25.0 (or Corepack to activate the package manager pinned in `package.json`). From this project folder:

```bash
corepack enable
corepack pnpm install
corepack pnpm dev
```

Vite prints the local development URL. To check types and create a production build:

```bash
corepack pnpm typecheck
corepack pnpm build
```

The production output is written to `dist/`.

## Campus Services

The shared navigation includes **Services**. The `/services` overview links to seven detail screens under `/services/:serviceId`: Event Registration & RSVP, QR Tickets & Attendance, Service Provider Directory, Analytics & Reports, Equipment Reservations, Waitlists & Recurring Bookings, and Digital Certificates. Each screen follows the supplied design reference and uses local-only demo interactions. No real registration, ticket, provider request, scan, analytics export, equipment reservation, waitlist update, certificate, or booking is created.

## Project notes

- All app data is mock data in `src/data/mock.ts` and the service-page modules; there is no backend or database.
- This portable export includes the illustrative images it uses under `public/assets/`; source paths resolve locally so the package works outside the hosted preview.
- The downloaded images are illustrative search-result assets, not verified UniSpot or user-campus photos. Review `ASSET_SOURCES.md` and replace them with appropriately licensed or campus-authorized images before public use.
- `public/manus-routes.json` declares the frontend page routes for the Manus preview environment.
