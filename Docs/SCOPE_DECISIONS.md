# Scope Decisions for UniSpot Submission

**Date:** November 2, 2026  
**Purpose:** Clarify which features are fully implemented vs. frontend demonstrations

## Fully Implemented (Backend + Frontend)
These features have complete backend support with models, routes, services, and are integrated with the frontend:

| Feature | Status | Notes |
|---|---|---|
| User Authentication (JWT) | ✅ Implemented | Login, signup, token refresh, Argon2 password hashing |
| Venue Discovery & Search | ✅ Implemented | Search by location, capacity, facilities, availability |
| Venue Booking (Automatic) | ✅ Implemented | Policy-driven auto-allocation, no approval queue, conflict prevention |
| My Bookings | ✅ Implemented | View and cancel own bookings |
| Role-Based Access Control | ✅ Implemented | Organizer, Venue Admin, System Admin roles |
| Admin - Venue Management | ✅ Implemented | CRUD operations, venue blocks/closures |
| Admin - User Management | ✅ Implemented | View users, manage roles/status |
| Admin - Allocations Monitoring | ✅ Implemented | View all bookings/allocations (read-only, no approval actions) |
| In-App Notifications | ✅ Implemented | Database-backed notifications with worker |
| Rule-Based Assistant | ✅ Implemented | API-connected, allowlisted tools, confirmation flow for writes |
| Audit Logging | ✅ Implemented | Logs critical actions |

## Frontend Demonstrations Only (No Backend)
These features have UI implementations but no corresponding backend models/routes/services:

| Feature | Status | Notes |
|---|---|---|
| Event Registration & RSVP | ⚠️ Demo Only | Frontend UI exists with mock data, no backend API |
| QR Tickets & Attendance | ⚠️ Demo Only | UI and mock QR display, no backend for ticket generation/scanning |
| Service Provider Directory | ⚠️ Demo Only | Browse providers and "request service" form, no backend integration |
| Equipment Reservations | ⚠️ Demo Only | UI exists with mock availability, no backend models/routes |
| Digital Certificates | ⚠️ Demo Only | Certificate preview UI, no backend for generation/issuance |
| Waitlists & Recurring Bookings | ⚠️ Demo Only | Student waitlist UI exists but full backend implementation incomplete |

## Partially Implemented
| Feature | Status | Notes |
|---|---|---|
| Admin Analytics & Reports | ⚠️ Partial | Some API endpoints exist, UI may be partially connected |
| Admin Announcements/Notifications | ⚠️ Partial | API exists, full notification delivery not implemented |

## Recommendation for Submission
For the project report and submission:
- **Focus on core venue booking functionality** as the primary achievement - this is fully implemented and meets the key requirements (automatic allocation, no approval queue, conflict prevention)
- **Clearly label extra campus services as demos/prototypes** in the report
- **Document the assistant as rule-based** (not LLM-powered) per the current implementation
- **Emphasize automatic allocation** as the key differentiator from traditional approval-based systems
