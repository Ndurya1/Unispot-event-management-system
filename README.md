# UniSpot

UniSpot is a single React platform for discovering campus venues, managing
events, and providing dashboards for the platform's users. Its backend is a
separate FastAPI service in `unispot-server`.

## Repository structure

```text
.
├── src/                 # React application
├── public/              # Frontend static assets
├── package.json         # Frontend scripts and dependencies
├── unispot-server/      # FastAPI backend and backend tests
├── Docs/                # Product and implementation documentation
└── .github/             # Repository workflows
```

The frontend intentionally lives at the repository root because UniSpot is a
single frontend application. It can grow into multiple pages and dashboards
without needing a separate `frontend/` directory. The backend keeps its own
Python environment and should be run from `unispot-server`.

## Frontend setup

Prerequisites: Node.js and npm.

```powershell
npm install
npm run dev
```

Other frontend checks:

```powershell
npm run lint
npm run build
```

## Backend setup

See [`unispot-server/README.md`](unispot-server/README.md) for Python,
PostgreSQL, migration, and API instructions.
