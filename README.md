# UniSpot Campus Platform

A full-stack campus events and venue-booking platform built with React, TypeScript, Vite, and React Router on the frontend, and FastAPI with PostgreSQL on the backend. Venue bookings are automatically allocated based on policy (no manual admin approval queue), with conflict prevention enforced by database constraints. The platform includes role-based access control, in-app notifications, an in-app assistant, and administrative tooling. 

> **Note:** Some campus service features (Event Registration, QR Tickets/Attendance, Equipment Reservations, Certificates, Waitlists, Service Provider Directory) are currently frontend demonstrations with mock data. The core venue discovery and booking flows are fully backed by the FastAPI/PostgreSQL backend.

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

## Backend API connection

The authenticated frontend uses `http://localhost:8000` by default. Set
`VITE_API_BASE_URL` before starting Vite when the backend runs elsewhere, for
example `VITE_API_BASE_URL=http://localhost:8000 corepack pnpm dev`. Login and
registration use the backend token service; registration does not assign roles
or organization memberships.

## Campus Services

The shared navigation includes **Services**. The `/services` overview links to seven detail screens under `/services/:serviceId`: Event Registration & RSVP, QR Tickets & Attendance, Service Provider Directory, Analytics & Reports, Equipment Reservations, Waitlists & Recurring Bookings, and Digital Certificates. Each screen follows the supplied design reference and uses local-only demo interactions. No real registration, ticket, provider request, scan, analytics export, equipment reservation, waitlist update, certificate, or booking is created.

## Project notes

- All app data is mock data in `src/data/mock.ts` and the service-page modules; there is no backend or database.
- This portable export includes the illustrative images it uses under `public/assets/`; source paths resolve locally so the package works outside the hosted preview.
- The downloaded images are illustrative search-result assets, not verified UniSpot or user-campus photos. Review `ASSET_SOURCES.md` and replace them with appropriately licensed or campus-authorized images before public use.
- `public/manus-routes.json` declares the frontend page routes for the Manus preview environment.
