import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AdminLayout } from './components/admin/AdminLayout';
import { SiteLayout } from './components/SiteLayout';
import { LoginPage, SignupPage, ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage } from './pages/AuthPages';
import { AccessDeniedPage } from './pages/AccessDeniedPage';
import { RequireAuth, RequireOrganizer, RequireRole } from './components/ProtectedRoute';

const HomePage = lazy(() => import('./pages/DiscoveryPages').then((m) => ({ default: m.HomePage })));
const EventsPage = lazy(() => import('./pages/DiscoveryPages').then((m) => ({ default: m.EventsPage })));
const EventDetailsPage = lazy(() => import('./pages/DiscoveryPages').then((m) => ({ default: m.EventDetailsPage })));
const OrganizationsPage = lazy(() => import('./pages/DiscoveryPages').then((m) => ({ default: m.OrganizationsPage })));
const ServicesPage = lazy(() => import('./pages/ServicesPage').then((m) => ({ default: m.ServicesPage })));
const ServiceDetailRoute = lazy(() => import('./pages/ServiceDetailRoute').then((m) => ({ default: m.ServiceDetailRoute })));
const BookingPage = lazy(() => import('./pages/VenuePages').then((m) => ({ default: m.BookingPage })));
const VenueListPage = lazy(() => import('./pages/VenueDiscoveryPages').then((m) => ({ default: m.VenueListPage })));
const VenueDetailsPage = lazy(() => import('./pages/VenueDiscoveryPages').then((m) => ({ default: m.VenueDetailsPage })));
const StudentDashboardPage = lazy(() => import('./pages/DashboardPages').then((m) => ({ default: m.StudentDashboardPage })));
const OrganizerDashboardPage = lazy(() => import('./pages/DashboardPages').then((m) => ({ default: m.OrganizerDashboardPage })));
const NotificationsPage = lazy(() => import('./pages/DashboardPages').then((m) => ({ default: m.NotificationsPage })));
const MyWaitlistsPage = lazy(() => import('./pages/MyWaitlistsPage').then((m) => ({ default: m.MyWaitlistsPage })));
const ProviderDashboardPage = lazy(() => import('./pages/provider/ProviderDashboardPage').then((m) => ({ default: m.ProviderDashboardPage })));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })));
const AdminSectionPage = lazy(() => import('./pages/admin/AdminSectionPage').then((m) => ({ default: m.AdminSectionPage })));

function PageLoader() {
  return <main className="page-wrap"><p className="form-status" role="status">Loading...</p></main>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route index element={<HomePage />} />
            <Route path="events" element={<EventsPage />} />
            <Route path="events/:id" element={<EventDetailsPage />} />
            <Route path="venues" element={<VenueListPage />} />
            <Route path="venues/:id" element={<VenueDetailsPage />} />
            <Route path="organizations" element={<OrganizationsPage />} />
            <Route element={<RequireOrganizer />}>
              <Route path="services" element={<ServicesPage />} />
            </Route>
            <Route element={<RequireAuth redirectTo="/signup" />}>
              <Route path="booking/new" element={<RequireRole roles={['ORGANIZER', 'VENUE_ADMIN']}><BookingPage /></RequireRole>} />
              <Route path="student/dashboard" element={<RequireRole roles={['STUDENT', 'UNIVERSITY_STAFF']}><StudentDashboardPage /></RequireRole>} />
              <Route path="my-waitlists" element={<MyWaitlistsPage />} />
              <Route path="organizer/dashboard" element={<RequireRole roles={['ORGANIZER', 'VENUE_ADMIN']}><OrganizerDashboardPage /></RequireRole>} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>
          </Route>

          <Route element={<RequireAuth redirectTo="/signup" />}>
            <Route path="provider/dashboard" element={<RequireRole roles={['SERVICE_PROVIDER']}><ProviderDashboardPage /></RequireRole>} />
            <Route path="provider/requests" element={<RequireRole roles={['SERVICE_PROVIDER']}><ProviderDashboardPage /></RequireRole>} />
            <Route element={<RequireOrganizer />}>
              <Route path="services/:serviceId" element={<ServiceDetailRoute />} />
            </Route>
          </Route>
          <Route element={<RequireRole roles={['SYSTEM_ADMIN']} />}>
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path=":section" element={<AdminSectionPage />} />
            </Route>
          </Route>
          <Route path="access-denied" element={<AccessDeniedPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<SignupPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
          <Route path="verify-email" element={<VerifyEmailPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
