import type { ComponentType } from 'react';
import { Building2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ServiceWorkspace } from '../components/ServiceWorkspace';
import { serviceItems } from '../data/services';
import { AnalyticsReportsPage } from './services/AnalyticsReportsPage';
import { DigitalCertificatesPage } from './services/DigitalCertificatesPage';
import { EquipmentReservationsPage } from './services/EquipmentReservationsPage';
import { EventRegistrationPage } from './services/EventRegistrationPage';
import { QrTicketsAttendancePage } from './services/QrTicketsAttendancePage';
import { ServiceProviderDirectoryPage } from './services/ServiceProviderDirectoryPage';
import { WaitlistsRecurringPage } from './services/WaitlistsRecurringPage';

const pageByServiceId: Record<string, ComponentType | undefined> = {
  'event-registration-rsvp': EventRegistrationPage,
  'qr-tickets-attendance': QrTicketsAttendancePage,
  'service-provider-directory': ServiceProviderDirectoryPage,
  'analytics-reports': AnalyticsReportsPage,
  'equipment-reservations': EquipmentReservationsPage,
  'waitlists-recurring-bookings': WaitlistsRecurringPage,
  'digital-certificates': DigitalCertificatesPage,
};

export function ServiceDetailRoute() {
  const { serviceId = '' } = useParams();
  const Page = pageByServiceId[serviceId];
  const service = serviceItems.find((item) => item.id === serviceId);

  return (
    <ServiceWorkspace>
      {Page && service ? <Page /> : (
        <section className="sd-not-found" aria-labelledby="service-not-found-title">
          <span className="sd-not-found-icon"><Building2 size={24} aria-hidden="true" /></span>
          <h1 id="service-not-found-title">Service page not found</h1>
          <p>Choose one of the services listed in the UniSpot catalog.</p>
          <Link className="button button--primary" to="/services">View Campus Services</Link>
        </section>
      )}
    </ServiceWorkspace>
  );
}
