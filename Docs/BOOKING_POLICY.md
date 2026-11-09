# UniSpot Booking Policy (Current Implementation)

**Last Updated:** November 2, 2026  
**Source:** `unispot-server/app/services/booking_policy.py`  
**Status:** Code-defined fixed policy (not versioned or stored in database)

## Policy Owner
The booking policy is currently hardcoded in the backend service. Any changes require code modifications and redeployment. A formal policy governance process should be established.

## Current Booking Criteria

All bookings must satisfy the following criteria to be automatically confirmed:

### User & Organization Requirements
- **Active User**: Requester must have active user status
- **Organization Membership**: Requester must have an active ORGANIZER membership in the specified organization
- **Active Organization**: The organization must be active

### Venue Requirements
- **Active Venue**: Venue must have active status
- **Venue Operating Hours**: Booking must be within the venue's operating hours for that day of week
- **Same-Day Booking**: Start and end times must be on the same local operating day (for the venue's timezone)
- **Valid Timezone**: All booking times must include timezone information

### Time & Duration Constraints
- **Minimum Lead Time**: Bookings must be made at least **24 hours** before the start time
- **Maximum Advance Window**: Bookings cannot be made more than **180 days** in advance
- **Maximum Duration**: Bookings cannot exceed **12 hours**
- **Valid Time Order**: End time must be after start time

### Capacity
- **Positive Attendance**: Expected attendance must be greater than 0
- **Capacity Limit**: Expected attendance cannot exceed the venue's capacity

### Conflict Prevention
- **No Overlaps**: Bookings cannot overlap with existing confirmed bookings for the same venue
- **Venue Blocks**: Active venue closure/maintenance blocks take precedence and prevent new bookings
- **Atomic Allocation**: Conflicts are prevented via PostgreSQL transactions and constraints; the first transaction to commit wins

## Booking Lifecycle
- **CONFIRMED**: Automatically allocated when all policy checks pass and no conflicts exist
- **CANCELLED**: Cancelled by the booking owner (or authorized emergency process)
- **COMPLETED**: Event interval has ended

## Notes
- There is **no admin approval queue** for ordinary bookings - eligible requests are automatically confirmed
- Administrators cannot approve, reject, prioritize, or reassign individual bookings
- Venue blocks can be created by Venue Admins and System Admins
- Policy is currently **code-defined and not versioned** - this is a known limitation noted in the Implementation Update Addendum
- Future enhancement: Store policy as effective-dated, versioned rulesets in the database
