# UniSpot Frontend — Project Structure

```text
.
├── .gitignore
├── ASSET_SOURCES.md
├── PROJECT_STRUCTURE.md
├── README.md
├── TODO.md
├── app.config.ts
├── index.html
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── public/
│   ├── assets/
│   │   ├── campus-courtyard.jpg
│   │   ├── event-culture.jpg
│   │   ├── event-innovation.jpg
│   │   ├── event-leadership.webp
│   │   └── venue-great-hall.jpeg
│   ├── favicon.svg
│   └── manus-routes.json
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── styles.css
│   ├── components/
│   │   ├── Brand.tsx
│   │   ├── ChatWidget.tsx
│   │   ├── ServiceWorkspace.tsx
│   │   └── SiteLayout.tsx
│   ├── data/
│   │   ├── mock.ts
│   │   └── services.ts
│   └── pages/
│       ├── AuthPages.tsx
│       ├── DashboardPages.tsx
│       ├── DiscoveryPages.tsx
│       ├── ServiceDetailRoute.tsx
│       ├── ServicesPage.tsx
│       ├── VenuePages.tsx
│       └── services/
│           ├── AnalyticsReportsPage.tsx
│           ├── DigitalCertificatesPage.tsx
│           ├── EquipmentReservationsPage.tsx
│           ├── EventRegistrationPage.tsx
│           ├── QrTicketsAttendancePage.tsx
│           ├── ServiceProviderDirectoryPage.tsx
│           ├── WaitlistsRecurringPage.tsx
│           └── shared.tsx
├── tsconfig.json
└── vite.config.ts
```

## Main responsibilities

- **`src/App.tsx`** — client-side routes for discovery, events, venues, bookings, dashboards, authentication, `/services`, and `/services/:serviceId`.
- **`src/components/`** — shared UniSpot brand, public-site shell, dashboard-style service workspace, and assistant widget.
- **`src/data/mock.ts`** — typed example events, venues, and bookings; image paths in this portable bundle resolve under `public/assets/`.
- **`src/data/services.ts`** — the seven service IDs, icons, descriptions, benefit bullets, and overview-card accents.
- **`src/pages/DiscoveryPages.tsx`** — home, event listing/detail, organizations, and not-found screens.
- **`src/pages/ServicesPage.tsx`** — reference-matched Campus Services overview and links to each detail screen.
- **`src/pages/ServiceDetailRoute.tsx`** — maps the dynamic service ID to the corresponding detail-page module.
- **`src/pages/services/`** — the seven focused service screens and shared accessible headings, tabs, panels, and demo feedback.
- **`src/pages/VenuePages.tsx`** — venue directory/details and the multi-step booking prototype.
- **`src/pages/DashboardPages.tsx`** — student and organizer dashboards and notifications.
- **`src/pages/AuthPages.tsx`** — login, sign-up, and password-reset prototype screens.
- **`src/styles.css`** — shared visual system, responsive page layouts, visible keyboard focus, and reduced-motion behavior.
- **`public/assets/`** — local copies of the illustrative images used by the portable export.
- **`public/manus-routes.json`** — route declarations for the hosted preview, including the dynamic service-detail pattern.
- **`package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `vite.config.ts`** — dependency and toolchain configuration.
