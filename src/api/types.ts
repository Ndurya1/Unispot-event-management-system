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
