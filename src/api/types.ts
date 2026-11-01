export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type AuthCredentials = {
  email: string;
  password: string;
};

export type RegistrationDetails = {
  full_name: string;
  email: string;
  password: string;
};

export type OrganizationMembership = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  membership_role: 'MEMBER' | 'ORGANIZER';
};

export type CurrentUser = {
  id: string;
  full_name: string;
  email: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
  roles: string[];
  organizations: OrganizationMembership[];
};

export type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    request_id?: string;
    details?: Array<Record<string, unknown>>;
  };
};

export type ApiResult<T> = {
  data: T;
  requestId: string | null;
  response: Response;
};

export type VenueStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';

export type FacilitySummary = {
  id: string;
  name: string;
};

export type ApiVenue = {
  id: string;
  name: string;
  code: string;
  location: string;
  capacity: number;
  description: string | null;
  status: VenueStatus;
  timezone: string;
  booking_buffer_minutes: number;
  venue_type: string;
  image_url: string | null;
  facilities: FacilitySummary[];
};

export type Facility = FacilitySummary;

export type VenueListParams = {
  capacity?: number;
  location?: string;
  facilityId?: string;
  status?: VenueStatus;
  limit?: number;
  offset?: number;
};

export type AvailabilityParams = {
  startsAt: string;
  endsAt: string;
  capacity?: number;
  location?: string;
  facilityId?: string;
  limit?: number;
  offset?: number;
};

export type BookingStatus = 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

export type BookingSource = 'WEB' | 'ASSISTANT' | 'SYSTEM';

export type ApiBooking = {
  id: string;
  venue_id: string;
  venue_name: string;
  venue_location: string;
  requester_id: string;
  organization_id: string;
  event_name: string;
  event_description: string | null;
  expected_attendance: number;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  source: BookingSource;
  confirmation_code: string;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
};

export type CreateBookingInput = {
  venue_id: string;
  organization_id: string;
  event_name: string;
  event_description?: string;
  expected_attendance: number;
  starts_at: string;
  ends_at: string;
};

export type AssistantToolName =
  | 'search_venues'
  | 'check_availability'
  | 'get_booking_policy'
  | 'create_booking'
  | 'list_my_bookings'
  | 'cancel_my_booking';

export type AssistantToolCall = {
  name: AssistantToolName;
  arguments?: Record<string, unknown>;
};

export type AssistantToolResult = {
  name: AssistantToolName;
  status: string;
  data: unknown;
  error: string | null;
  booking_id: string | null;
};

export type AssistantMessageInput = {
  conversation_id?: string;
  message: string;
  tool_calls?: AssistantToolCall[];
  confirmed?: boolean;
  confirmation_id?: string;
};

export type AssistantMessageResponse = {
  conversation_id: string;
  message_id: string;
  response: string;
  tool_results: AssistantToolResult[];
  pending_confirmation: boolean;
  state: Record<string, unknown>;
};
