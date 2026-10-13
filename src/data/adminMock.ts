import {
  BarChart3,
  Bell,
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  ListChecks,
  MapPin,
  Package,
  Settings,
  ShieldCheck,
  Users,
  UsersRound,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export type AdminSectionId =
  | 'users'
  | 'events'
  | 'venues'
  | 'bookings'
  | 'organizations'
  | 'service-providers'
  | 'equipment'
  | 'registrations'
  | 'notifications'
  | 'analytics-reports'
  | 'maintenance'
  | 'policies-rules'
  | 'waitlists'
  | 'audit-logs'
  | 'system-settings';

export type AdminField = {
  key: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'date' | 'select';
  required?: boolean;
  options?: string[];
};

export type AdminColumn = { key: string; label: string };
export type AdminRow = { id: string } & Record<string, string>;

export type AdminSectionDefinition = {
  id: AdminSectionId;
  title: string;
  description: string;
  columns: AdminColumn[];
  fields: AdminField[];
  rows: AdminRow[];
  canCreate?: boolean;
  canEdit?: boolean;
};

export const adminNavItems: { id: 'dashboard' | AdminSectionId; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'events', label: 'Events', icon: CalendarDays },
  { id: 'venues', label: 'Venues', icon: MapPin },
  { id: 'bookings', label: 'Bookings', icon: CalendarCheck },
  { id: 'organizations', label: 'Organizations', icon: Building2 },
  { id: 'service-providers', label: 'Service Providers', icon: UsersRound },
  { id: 'equipment', label: 'Equipment', icon: Package },
  { id: 'registrations', label: 'Registrations', icon: ClipboardList },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'analytics-reports', label: 'Analytics & Reports', icon: BarChart3 },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench },
  { id: 'policies-rules', label: 'Policies & Rules', icon: ShieldCheck },
  { id: 'waitlists', label: 'Waitlists & Recurring', icon: ListChecks },
  { id: 'audit-logs', label: 'Audit Logs', icon: ClipboardList },
  { id: 'system-settings', label: 'System Settings', icon: Settings },
];

const field = (key: string, label: string, type: AdminField['type'] = 'text', required = true, options?: string[]): AdminField => ({ key, label, type, required, options });

export const adminSectionData: Record<AdminSectionId, AdminSectionDefinition> = {
  users: {
    id: 'users', title: 'User Management', description: 'Manage campus accounts, account types, verification, and access status.',
    columns: [{ key: 'name', label: 'User' }, { key: 'email', label: 'Email' }, { key: 'role', label: 'Role' }, { key: 'joined', label: 'Joined' }, { key: 'status', label: 'Status' }],
    fields: [field('name', 'Full name'), field('email', 'Email address', 'email'), field('role', 'Account role', 'select', true, ['Student', 'Organizer', 'University Staff', 'Service Provider']), field('joined', 'Joined', 'date'), field('status', 'Account status', 'select', true, ['Active', 'Pending', 'Suspended'])],
    rows: [
      { id: 'user-1', name: 'Mary Wanjiru', email: 'mary.wanjiru@campus.edu', role: 'Student', joined: '2026-08-16', status: 'Active' },
      { id: 'user-2', name: 'Tech Club', email: 'techclub@campus.edu', role: 'Organizer', joined: '2026-07-03', status: 'Active' },
      { id: 'user-3', name: 'David Kamau', email: 'david.kamau@campus.edu', role: 'University Staff', joined: '2026-05-19', status: 'Pending' },
      { id: 'user-4', name: 'Royal Catering Services', email: 'hello@royalcatering.example', role: 'Service Provider', joined: '2026-09-02', status: 'Pending' },
    ],
  },
  events: {
    id: 'events', title: 'Event Management', description: 'Review and maintain the campus-wide event directory and publication status.',
    columns: [{ key: 'name', label: 'Event' }, { key: 'organizer', label: 'Organizer' }, { key: 'date', label: 'Date' }, { key: 'venue', label: 'Venue' }, { key: 'status', label: 'Status' }],
    fields: [field('name', 'Event name'), field('organizer', 'Organizer'), field('date', 'Event date', 'date'), field('venue', 'Venue'), field('status', 'Status', 'select', true, ['Published', 'Draft', 'Archived'])],
    rows: [
      { id: 'event-1', name: 'Innovation & Tech Day', organizer: 'Tech Club', date: '2026-10-20', venue: 'Great Hall', status: 'Published' },
      { id: 'event-2', name: 'Culture Fest', organizer: 'Cultural Society', date: '2026-10-23', venue: 'Campus Grounds', status: 'Published' },
      { id: 'event-3', name: 'Leadership Workshop', organizer: 'Student Council', date: '2026-10-28', venue: 'Seminar Room B', status: 'Draft' },
    ],
  },
  venues: {
    id: 'venues', title: 'Venue Management', description: 'Maintain venue capacity, facilities, availability, and service status.',
    columns: [{ key: 'name', label: 'Venue' }, { key: 'capacity', label: 'Capacity' }, { key: 'location', label: 'Location' }, { key: 'facilities', label: 'Facilities' }, { key: 'status', label: 'Status' }],
    fields: [field('name', 'Venue name'), field('capacity', 'Capacity', 'number'), field('location', 'Location'), field('facilities', 'Facilities'), field('status', 'Status', 'select', true, ['Active', 'Maintenance', 'Unavailable'])],
    rows: [
      { id: 'venue-1', name: 'Great Hall', capacity: '500', location: 'Main Campus', facilities: 'Projector, Sound System, Wi-Fi', status: 'Active' },
      { id: 'venue-2', name: 'Seminar Room A', capacity: '80', location: 'North Wing', facilities: 'Display, Wi-Fi', status: 'Active' },
      { id: 'venue-3', name: 'Seminar Room B', capacity: '100', location: 'Main Campus', facilities: 'Projector, Whiteboard', status: 'Active' },
      { id: 'venue-4', name: 'Auditorium', capacity: '300', location: 'Arts Block', facilities: 'Stage, Sound System', status: 'Maintenance' },
      { id: 'venue-5', name: 'Conference Room', capacity: '60', location: 'Admin Block', facilities: 'Video Conferencing', status: 'Active' },
    ],
  },
  bookings: {
    id: 'bookings', title: 'Booking Monitoring', description: 'Monitor outcomes generated automatically by the venue and booking rules.',
    columns: [{ key: 'id', label: 'Booking ID' }, { key: 'requester', label: 'Requester' }, { key: 'venue', label: 'Venue' }, { key: 'date', label: 'Date' }, { key: 'status', label: 'Automatic outcome' }, { key: 'rule', label: 'Rule result' }],
    fields: [], canCreate: false, canEdit: false,
    rows: [
      { id: 'BK-1048', requester: 'Tech Club', venue: 'Great Hall', date: '2026-10-20', status: 'Confirmed automatically', rule: 'Available slot · rules passed' },
      { id: 'BK-1047', requester: 'Culture Society', venue: 'Campus Grounds', date: '2026-10-23', status: 'Confirmed automatically', rule: 'Available slot · rules passed' },
      { id: 'BK-1046', requester: 'Debate Club', venue: 'Auditorium', date: '2026-10-24', status: 'Unavailable', rule: 'Venue under maintenance' },
      { id: 'BK-1041', requester: 'Student Council', venue: 'Seminar Room B', date: '2026-10-18', status: 'Cancelled by requester', rule: 'Slot released to availability' },
    ],
  },
  organizations: {
    id: 'organizations', title: 'Organization Management', description: 'Verify campus organizations, manage their admins, and maintain membership status.',
    columns: [{ key: 'name', label: 'Organization' }, { key: 'type', label: 'Type' }, { key: 'admin', label: 'Primary admin' }, { key: 'members', label: 'Members' }, { key: 'status', label: 'Status' }],
    fields: [field('name', 'Organization name'), field('type', 'Type'), field('admin', 'Primary admin'), field('members', 'Members', 'number'), field('status', 'Status', 'select', true, ['Approved', 'Pending', 'Inactive'])],
    rows: [
      { id: 'org-1', name: 'Tech Club', type: 'Academic', admin: 'Moses Thomas', members: '86', status: 'Approved' },
      { id: 'org-2', name: 'Cultural Society', type: 'Cultural', admin: 'Amina Noor', members: '124', status: 'Approved' },
      { id: 'org-3', name: 'Debate Club', type: 'Academic', admin: 'Brian Otieno', members: '42', status: 'Pending' },
      { id: 'org-4', name: 'Environmental Club', type: 'Community', admin: 'Mary Wanjiru', members: '58', status: 'Approved' },
    ],
  },
  'service-providers': {
    id: 'service-providers', title: 'Service Provider Management', description: 'Review provider profiles, service categories, verification, and platform status.',
    columns: [{ key: 'name', label: 'Provider' }, { key: 'category', label: 'Category' }, { key: 'contact', label: 'Contact' }, { key: 'reviews', label: 'Reviews' }, { key: 'status', label: 'Status' }],
    fields: [field('name', 'Provider name'), field('category', 'Service category'), field('contact', 'Contact email', 'email'), field('reviews', 'Review count', 'number'), field('status', 'Verification status', 'select', true, ['Approved', 'Pending review', 'Rejected'])],
    rows: [
      { id: 'provider-1', name: 'Royal Catering Services', category: 'Catering & refreshments', contact: 'hello@royalcatering.example', reviews: '76', status: 'Approved' },
      { id: 'provider-2', name: 'Pocus Media Kenya', category: 'Photography & videography', contact: 'studio@pocus.example', reviews: '54', status: 'Approved' },
      { id: 'provider-3', name: 'Sound Masters KE', category: 'Sound systems', contact: 'bookings@soundmasters.example', reviews: '38', status: 'Pending review' },
      { id: 'provider-4', name: 'Event Decor Solutions', category: 'Decorations', contact: 'hello@eventdecor.example', reviews: '22', status: 'Pending review' },
    ],
  },
  equipment: {
    id: 'equipment', title: 'Equipment Management', description: 'Maintain equipment quantities, current availability, and service status.',
    columns: [{ key: 'item', label: 'Equipment' }, { key: 'category', label: 'Category' }, { key: 'quantity', label: 'Total quantity' }, { key: 'available', label: 'Available' }, { key: 'status', label: 'Status' }],
    fields: [field('item', 'Equipment name'), field('category', 'Category'), field('quantity', 'Total quantity', 'number'), field('available', 'Available quantity', 'number'), field('status', 'Status', 'select', true, ['Available', 'Maintenance', 'Unavailable'])],
    rows: [
      { id: 'equipment-1', item: 'Projector', category: 'Presentation', quantity: '8', available: '4', status: 'Available' },
      { id: 'equipment-2', item: 'Sound System', category: 'Audio', quantity: '5', available: '2', status: 'Available' },
      { id: 'equipment-3', item: 'Laptop', category: 'Computing', quantity: '16', available: '12', status: 'Available' },
      { id: 'equipment-4', item: 'Chairs & Tables', category: 'Furniture', quantity: '200', available: '86', status: 'Available' },
      { id: 'equipment-5', item: 'Wireless Microphone', category: 'Audio', quantity: '10', available: '6', status: 'Maintenance' },
    ],
  },
  registrations: {
    id: 'registrations', title: 'Registration Management', description: 'Review campus-wide registrations and event check-in status.',
    columns: [{ key: 'participant', label: 'Participant' }, { key: 'event', label: 'Event' }, { key: 'ticket', label: 'Ticket ID' }, { key: 'registered', label: 'Registered' }, { key: 'status', label: 'Attendance' }],
    fields: [], canCreate: false, canEdit: false,
    rows: [
      { id: 'reg-1', participant: 'Mary Wanjiru', event: 'Innovation & Tech Day', ticket: 'US-004381', registered: '2026-10-02', status: 'Checked in' },
      { id: 'reg-2', participant: 'Moses Thomas', event: 'Culture Fest', ticket: 'US-004382', registered: '2026-10-01', status: 'Registered' },
      { id: 'reg-3', participant: 'Amina Noor', event: 'Leadership Workshop', ticket: 'US-004383', registered: '2026-09-29', status: 'Registered' },
    ],
  },
  notifications: {
    id: 'notifications', title: 'Notification Management', description: 'Prepare platform announcements for student, organizer, or provider audiences.',
    columns: [], fields: [], rows: [], canCreate: false, canEdit: false,
  },
  'analytics-reports': {
    id: 'analytics-reports', title: 'Analytics & Reports', description: 'Monitor platform-wide event, booking, attendance, and user activity.',
    columns: [], fields: [], rows: [], canCreate: false, canEdit: false,
  },
  maintenance: {
    id: 'maintenance', title: 'Maintenance Management', description: 'Schedule and track service work for campus venues and equipment.',
    columns: [{ key: 'asset', label: 'Asset' }, { key: 'type', label: 'Maintenance type' }, { key: 'scheduled', label: 'Scheduled date' }, { key: 'owner', label: 'Assigned team' }, { key: 'status', label: 'Status' }],
    fields: [field('asset', 'Venue or equipment'), field('type', 'Maintenance type'), field('scheduled', 'Scheduled date', 'date'), field('owner', 'Assigned team'), field('status', 'Status', 'select', true, ['Scheduled', 'In progress', 'Complete'])],
    rows: [
      { id: 'maint-1', asset: 'Auditorium sound system', type: 'Equipment inspection', scheduled: '2026-10-18', owner: 'Facilities team', status: 'Scheduled' },
      { id: 'maint-2', asset: 'Great Hall projector', type: 'Preventive service', scheduled: '2026-10-21', owner: 'AV services', status: 'In progress' },
      { id: 'maint-3', asset: 'Seminar Room A', type: 'Room inspection', scheduled: '2026-10-25', owner: 'Facilities team', status: 'Scheduled' },
    ],
  },
  'policies-rules': {
    id: 'policies-rules', title: 'Booking Rules & Policies', description: 'Configure transparent duration, notice, restriction, and cancellation rules.',
    columns: [], fields: [], rows: [], canCreate: false, canEdit: false,
  },
  waitlists: {
    id: 'waitlists', title: 'Waitlist & Recurring Booking Management', description: 'Monitor campus-wide queue position and recurring venue requests.',
    columns: [{ key: 'venue', label: 'Venue' }, { key: 'event', label: 'Event' }, { key: 'date', label: 'Requested date' }, { key: 'position', label: 'Queue position' }, { key: 'status', label: 'Status' }],
    fields: [], canCreate: false, canEdit: false,
    rows: [
      { id: 'wait-1', venue: 'Great Hall', event: 'Innovation & Tech Day', date: '2026-10-20', position: '1', status: 'Slot unavailable' },
      { id: 'wait-2', venue: 'Seminar Room B', event: 'Leadership Workshop', date: '2026-10-28', position: '2', status: 'Waiting' },
      { id: 'wait-3', venue: 'Great Hall', event: 'Tech Club Weekly Meeting', date: 'Recurring · Wednesday', position: '—', status: 'Recurring request' },
    ],
  },
  'audit-logs': {
    id: 'audit-logs', title: 'Audit Logs', description: 'Illustrative activity history. A durable audit trail requires the future backend.',
    columns: [{ key: 'time', label: 'Date & time' }, { key: 'actor', label: 'Actor' }, { key: 'action', label: 'Action' }, { key: 'target', label: 'Target' }],
    fields: [], canCreate: false, canEdit: false,
    rows: [
      { id: 'audit-1', time: '2026-10-13 09:42', actor: 'Admin User', action: 'Updated venue availability', target: 'Great Hall' },
      { id: 'audit-2', time: '2026-10-13 09:18', actor: 'System demo', action: 'Automatic booking confirmed', target: 'BK-1048' },
      { id: 'audit-3', time: '2026-10-13 08:54', actor: 'Admin User', action: 'Reviewed provider profile', target: 'Sound Masters KE' },
      { id: 'audit-4', time: '2026-10-12 17:20', actor: 'Student demo', action: 'Cancelled booking; slot released', target: 'BK-1041' },
    ],
  },
  'system-settings': {
    id: 'system-settings', title: 'System Settings', description: 'Configure global platform preferences in this non-persistent preview.',
    columns: [], fields: [], rows: [], canCreate: false, canEdit: false,
  },
};

export const adminKpis = [
  { label: 'Total Users', value: '8,432', trend: '+12%', tone: 'violet' },
  { label: 'Total Events', value: '248', trend: '+18%', tone: 'blue' },
  { label: 'Total Bookings', value: '1,204', trend: '+14%', tone: 'mint' },
  { label: 'Total Attendance', value: '24,890', trend: '+20%', tone: 'amber' },
];
