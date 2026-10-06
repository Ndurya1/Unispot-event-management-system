import { BadgeCheck, BarChart3, CalendarDays, Monitor, QrCode, Repeat2, UsersRound } from 'lucide-react';

export type PreviewKind = 'registration' | 'qr' | 'providers' | 'analytics' | 'equipment' | 'waitlist' | 'certificate';
export type ServiceItem = {
  id: string;
  title: string;
  description: string;
  benefits: string[];
  tone: string;
  preview: PreviewKind;
  icon: typeof CalendarDays;
};

export const serviceItems: ServiceItem[] = [
  {
    id: 'event-registration-rsvp',
    title: 'Event Registration & RSVP',
    description: 'Allow students to register for upcoming events and get instant confirmation.',
    benefits: ['Easy online registration', 'Real-time capacity tracking', 'Email/SMS confirmations'],
    tone: 'violet',
    preview: 'registration',
    icon: CalendarDays,
  },
  {
    id: 'qr-tickets-attendance',
    title: 'QR Tickets & Attendance',
    description: 'Generate QR codes for event check-in and track attendance in real time.',
    benefits: ['Unique QR tickets', 'Fast and secure check-in', 'Attendance reports'],
    tone: 'blue',
    preview: 'qr',
    icon: QrCode,
  },
  {
    id: 'service-provider-directory',
    title: 'Service Provider Directory',
    description: 'Find and connect with approved event-related service providers.',
    benefits: ['Catering and refreshments', 'Photography and video', 'Sound, décor, and more'],
    tone: 'mint',
    preview: 'providers',
    icon: UsersRound,
  },
  {
    id: 'analytics-reports',
    title: 'Analytics & Reports',
    description: 'Track registrations, attendance, bookings, and event activity.',
    benefits: ['Event performance insights', 'Attendance statistics', 'Exportable reports'],
    tone: 'rose',
    preview: 'analytics',
    icon: BarChart3,
  },
  {
    id: 'equipment-reservations',
    title: 'Equipment Reservations',
    description: 'Reserve projectors, sound systems, and other essentials for your events.',
    benefits: ['Browse available equipment', 'Plan reservations', 'Track equipment status'],
    tone: 'amber',
    preview: 'equipment',
    icon: Monitor,
  },
  {
    id: 'waitlists-recurring-bookings',
    title: 'Waitlists & Recurring Bookings',
    description: 'Join waitlists for popular venues and set up recurring bookings.',
    benefits: ['Get notified when slots open', 'Manage recurring schedules', 'Flexible cancellation'],
    tone: 'purple',
    preview: 'waitlist',
    icon: Repeat2,
  },
  {
    id: 'digital-certificates',
    title: 'Digital Certificates',
    description: 'Recognize participants who meet their event’s attendance criteria.',
    benefits: ['Automated certificate generation', 'Customizable templates', 'Download and share'],
    tone: 'cyan',
    preview: 'certificate',
    icon: BadgeCheck,
  },
];
