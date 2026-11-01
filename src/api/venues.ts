import { apiFetch } from './client';
import type { ApiVenue, AvailabilityParams, Facility, VenueListParams } from './types';

function toQueryString(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const result = query.toString();
  return result ? `?${result}` : '';
}

export async function listVenues(params: VenueListParams = {}) {
  const { data } = await apiFetch<ApiVenue[]>(`/venues${toQueryString({
    capacity: params.capacity,
    location: params.location,
    facility_id: params.facilityId,
    status: params.status,
    limit: params.limit,
    offset: params.offset,
  })}`);
  return data;
}

export async function getVenue(venueId: string) {
  const { data } = await apiFetch<ApiVenue>(`/venues/${venueId}`);
  return data;
}

export async function listFacilities() {
  const { data } = await apiFetch<Facility[]>('/facilities?limit=100&offset=0');
  return data;
}

export async function searchAvailability(params: AvailabilityParams) {
  const { data } = await apiFetch<ApiVenue[]>(`/availability${toQueryString({
    starts_at: params.startsAt,
    ends_at: params.endsAt,
    capacity: params.capacity,
    location: params.location,
    facility_id: params.facilityId,
    limit: params.limit,
    offset: params.offset,
  })}`);
  return data;
}
