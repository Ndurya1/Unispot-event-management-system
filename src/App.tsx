import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AdminLayout } from './components/admin/AdminLayout';
import { SiteLayout } from './components/SiteLayout';
import { HomePage, EventsPage, EventDetailsPage, OrganizationsPage, NotFoundPage } from './pages/DiscoveryPages';
import { ServicesPage } from './pages/ServicesPage';
import { ServiceDetailRoute } from './pages/ServiceDetailRoute';
import { VenueListPage, VenueDetailsPage, BookingPage } from './pages/VenuePages';
import { StudentDashboardPage, OrganizerDashboardPage, NotificationsPage } from './pages/DashboardPages';
import { LoginPage, SignupPage, ForgotPasswordPage } from './pages/AuthPages';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminSectionPage } from './pages/admin/AdminSectionPage';
import { MyWaitlistsPage } from './pages/MyWaitlistsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route index element={<HomePage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="events/:id" element={<EventDetailsPage />} />
          <Route path="venues" element={<VenueListPage />} />
          <Route path="venues/:id" element={<VenueDetailsPage />} />
          <Route path="booking/new" element={<BookingPage />} />
          <Route path="organizations" element={<OrganizationsPage />} />
          <Route path="services" element={<ServicesPage />} />
          <Route path="student/dashboard" element={<StudentDashboardPage />} />
          <Route path="my-waitlists" element={<MyWaitlistsPage />} />
          <Route path="organizer/dashboard" element={<OrganizerDashboardPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path=":section" element={<AdminSectionPage />} />
        </Route>
        <Route path="services/:serviceId" element={<ServiceDetailRoute />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="signup" element={<SignupPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
