export type RoleName = 'STUDENT' | 'ORGANIZER' | 'VENUE_ADMIN' | 'SYSTEM_ADMIN' | 'SERVICE_PROVIDER' | 'UNIVERSITY_STAFF';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
export type OrganizationStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
export type BookingSource = 'WEB' | 'MOBILE' | 'ASSISTANT';
export type PaymentStatus = 'NOT_REQUIRED' | 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export type ApiVenue = { id: string; name: string; kind?: string; venue_type?: string; description: string | null; building: string | null; location: string; image_url: string | null; capacity: number; hourly_rate_kes: string; minimum_booking_minutes: number; advance_notice_hours: number; requires_approval: boolean; status: 'ACTIVE' | 'INACTIVE'; facilities?: string[]; };
export type ApiOrganization = { id: string; name: string; slug: string; organization_type: 'CLUB' | 'DEPARTMENT' | 'EXTERNAL'; status: OrganizationStatus; };
export type ApiOrganizationMembership = { organization_id: string; organization_name: string; organization_status: OrganizationStatus; role: string; membership_status: string; };

export type ApiUser = { id: string; email: string; full_name: string; phone_number: string | null; status: UserStatus; email_verified_at?: string | null; created_at: string; updated_at: string; roles: RoleName[]; organizations: ApiOrganizationMembership[]; };
export type AuthResponse = { access_token: string; refresh_token: string; token_type: 'bearer'; user: ApiUser; };
export type RegisterRequest = { email: string; password: string; full_name: string; phone_number?: string; };
export type LoginRequest = { email: string; password: string; };

export type AvailabilityConflict = { booking_id: string; starts_at: string; ends_at: string; status: BookingStatus; };
export type ApiVenueAvailability = { venue_id: string; venue_name: string; starts_at: string; ends_at: string; available: boolean; conflicts: AvailabilityConflict[]; };
export type BookingValidationMessage = { code: string; message: string; severity: 'info' | 'warning' | 'error'; };
export type BookingPolicyResult = { valid: boolean; venue_id: string; starts_at: string; ends_at: string; expected_attendance: number; estimated_cost_kes: string; available: boolean; messages: BookingValidationMessage[]; };
export type CreateBookingInput = { venue_id: string; organization_id: string; event_name: string; title?: string; purpose?: string; starts_at: string; ends_at: string; expected_attendance: number; source?: BookingSource; };
export type ApiBooking = { id: string; user_id?: string | null; organization_id?: string | null; venue_id: string; venue_name: string; reservation_id?: string | null; title?: string; event_name?: string; purpose: string | null; starts_at: string; ends_at: string; expected_attendance: number; status: BookingStatus; source: BookingSource; payment_status?: PaymentStatus; total_amount_kes?: string; confirmation_code: string; cancelled_at: string | null; created_at: string; updated_at?: string; };
export type ApiPaymentReceipt = { id: string; booking_id: string; mpesa_receipt: string | null; phone_number: string | null; amount_kes: string; status: string; result_desc: string | null; paid_at: string | null; created_at: string; };

export type AssistantToolName = 'search_venues' | 'check_availability' | 'get_booking_policy' | 'create_booking' | 'list_my_bookings' | 'cancel_my_booking';
export type AssistantToolCall = { name: AssistantToolName; arguments?: Record<string, unknown>; };
export type AssistantToolResult = { name: AssistantToolName; status: 'succeeded' | 'failed' | 'confirmation_required'; data: unknown; error: string | null; booking_id: string | null; };
export type AssistantPendingConfirmation = { tool: 'create_booking' | 'cancel_my_booking'; arguments: Record<string, unknown>; confirmation_id: string; idempotency_key?: string; completed?: boolean; };
export type AssistantConversationState = { intent?: string; slots?: Record<string, unknown>; pending_confirmation?: AssistantPendingConfirmation; };
export type AssistantMessageInput = { conversation_id?: string; message: string; tool_calls?: AssistantToolCall[]; confirmed?: boolean; confirmation_id?: string; };
export type AssistantMessageResponse = { conversation_id: string; message_id: string; response: string; tool_results: AssistantToolResult[]; pending_confirmation: boolean; state: AssistantConversationState; };

export type NotificationType = string;
export type NotificationDeliveryStatus = 'PENDING' | 'SENT' | 'FAILED' | 'READ';
export type ApiNotification = { id: string; booking_id: string | null; type: NotificationType; channel: 'IN_APP' | 'EMAIL' | 'SMS'; title: string; body: string; delivery_status: NotificationDeliveryStatus; created_at: string; sent_at: string | null; read_at: string | null; };

export type AdminUserStatus = 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
export type ApiAdminUser = { id: string; email: string; full_name: string; status: AdminUserStatus; created_at: string; roles: string[]; };
export type AdminRecipientGroup = 'ALL_ACTIVE' | 'ORGANIZERS' | 'VENUE_ADMINS' | 'SYSTEM_ADMINS';
export type AdminAnnouncementInput = { recipient_group: AdminRecipientGroup; title: string; body: string; };
export type AdminAnnouncementResult = { notification_type: string; channel: string; recipient_group: AdminRecipientGroup; recipient_count: number; created_count: number; title: string; };
export type ApiVenueBookingUsage = { venue_id: string; venue_name: string; booking_count: number; expected_attendance: number; };
export type ApiBookingAnalytics = { total_bookings: number; confirmed_bookings: number; cancelled_bookings: number; completed_bookings: number; total_expected_attendance: number; venue_usage: ApiVenueBookingUsage[]; };

export type EquipmentStatus = 'ACTIVE' | 'INACTIVE';
export type EquipmentReservationStatus = 'CONFIRMED' | 'CANCELLED';
export type ApiEquipmentItem = { id: string; slug: string; name: string; description: string | null; total_quantity: number; status: EquipmentStatus; };
export type ApiEquipmentAvailability = ApiEquipmentItem & { available_quantity: number; reserved_quantity: number; };
export type CreateEquipmentReservationInput = { equipment_id: string; quantity: number; starts_at: string; ends_at: string; notes?: string; source?: 'WEB' | 'MOBILE' | 'ASSISTANT'; };
export type ApiEquipmentReservation = { id: string; equipment_id: string; equipment_name: string; user_id: string; booking_id: string | null; quantity: number; starts_at: string; ends_at: string; status: EquipmentReservationStatus; confirmation_code: string; created_at: string; cancelled_at: string | null; };

export type EventStatus = 'PUBLISHED' | 'CANCELLED';
export type EventRegistrationStatus = 'CONFIRMED' | 'CANCELLED';
export type ApiCampusEvent = { id: string; title: string; slug: string; description: string | null; category: string | null; organizer: string | null; starts_at: string; ends_at: string; venue_id?: string | null; venue_name?: string | null; location: string | null; capacity: number; expected_attendance?: number | null; requires_registration: boolean; reservation_id?: string | null; status: EventStatus; created_by_user_id?: string | null; confirmed_registrations: number; available_capacity: number; created_at: string; };
export type CreateCampusEventInput = { title: string; description?: string; category?: string; organizer?: string; organization_id?: string; starts_at: string; ends_at: string; venue_id?: string; location?: string; capacity?: number; expected_attendance?: number; requires_registration?: boolean; status?: EventStatus; };
export type CreateEventRegistrationInput = { event_id: string; full_name: string; email: string; role_label?: string; accessibility_needs?: string; };
export type ApiEventRegistration = { id: string; event_id: string; event_title: string; user_id: string | null; full_name: string; email: string; role_label: string | null; accessibility_needs: string | null; status: EventRegistrationStatus; confirmation_code: string; checked_in_at: string | null; created_at: string; cancelled_at: string | null; };
export type ApiEventAttendance = { event_id: string; event_title: string; confirmed_registrations: number; checked_in_registrations: number; };

export type ApiAuditEvent = { id: number; actor_user_id: string | null; actor_type: string; action: string; target_type: string; target_id: string | null; request_id: string; outcome: string; metadata: Record<string, unknown>; created_at: string; };
export type ApiAllocation = { id: string; venue_id: string; venue_name: string; starts_at: string; ends_at: string; expected_attendance: number; status: BookingStatus; confirmation_code: string; };

export type ProviderStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING';
export type ServiceRequestStatus = 'PENDING' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type ApiServiceProvider = { id: string; slug: string; name: string; category: string; description: string | null; location: string; price_from_kes: number; rating: string; reviews: number; availability: string; image_url: string | null; status: ProviderStatus; owner_user_id: string | null; contact_email?: string | null; contact_phone?: string | null; created_at?: string | null; updated_at?: string | null; };
export type CreateServiceRequestInput = { provider_id: string; event_name: string; requested_date: string; notes?: string; };
export type ApiServiceRequest = { id: string; provider_id: string; provider_name: string; requester_id: string; assigned_provider_id: string | null; assigned_at: string | null; event_name: string; requested_date: string; notes: string | null; quote_amount_kes?: number | null; quote_notes?: string | null; quoted_at?: string | null; status: ServiceRequestStatus; confirmation_code: string; created_at: string; cancelled_at?: string | null; };

export type WaitlistStatus = 'ACTIVE' | 'WAITING' | 'NOTIFIED' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED';
export type ApiWaitlist = { id: string; venue_id: string; venue_name: string; event_name: string; requested_date: string; requested_start: string; requested_end: string; status: WaitlistStatus; confirmation_code: string; created_at: string; notified_at?: string | null; fulfilled_at?: string | null; };
export type CreateWaitlistInput = { venue_id: string; event_name: string; requested_date: string; requested_start: string; requested_end: string; };

export type RecurringStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'COMPLETED';
export type ApiRecurringSchedule = { id: string; venue_id: string; venue_name: string; event_name: string; day_of_week: number; start_time: string; end_time: string; starts_on: string; ends_on: string; status: RecurringStatus; confirmation_code: string; generated_count?: number; last_generated_on?: string | null; created_at: string; };
export type CreateRecurringInput = { venue_id: string; event_name: string; day_of_week: number; start_time: string; end_time: string; starts_on: string; ends_on: string; };

export type ApiSystemSetting = { key: string; value_json: Record<string, unknown>; description: string | null; updated_by_user_id?: string | null; updated_at: string; };
export type ApiPolicyRule = { id: string; name: string; scope: string; enabled: boolean; config_json: Record<string, unknown>; description: string | null; updated_by_user_id?: string | null; created_at: string; updated_at: string; };
export type ApiMaintenanceRecord = { id: string; asset_type: string; asset_id?: string | null; asset_label: string; title: string; details: string | null; status: string; scheduled_for: string | null; completed_at: string | null; created_by_user_id?: string | null; created_at: string; updated_at: string; };

export type ApiCertificate = { id: string; registration_id: string; event_id: string; event_title: string; recipient_name: string; recipient_email: string; template_name: string; verification_code: string; issued_at: string; revoked_at: string | null; revoke_reason: string | null; is_valid: boolean; };
export type ApiCertificateVerification = { valid: boolean; verification_code: string; certificate?: ApiCertificate | null; message: string; recipient_name?: string; event_title?: string; };

// Compatibility aliases used across the app
export type TokenResponse = AuthResponse;
export type AuthCredentials = LoginRequest;
export type CurrentUser = ApiUser;
export type RegisterResponse = { user: ApiUser; message?: string } | ApiUser;
export type RegistrationDetails = RegisterRequest;
export type MessageResponse = { message: string; detail?: string };
export type ApiErrorPayload = { error?: { message?: string; code?: string; details?: Array<Record<string, unknown>>; request_id?: string }; detail?: string; message?: string };
export type ApiResult<T> = { data: T; requestId: string | null; response: Response };
export type Facility = { id: string; name: string };
export type VenueListParams = { capacity?: number; location?: string; venue_type?: string; facilityId?: string; status?: string; limit?: number; offset?: number };
export type AvailabilityParams = { startsAt: string; endsAt: string; capacity?: number; location?: string; venue_type?: string; facilityId?: string; limit?: number; offset?: number };
