export type CampusEvent = {
  id: string;
  title: string;
  dateShort: string;
  date: string;
  time: string;
  category: string;
  location: string;
  attendees: number;
  organizer: string;
  image: string;
  price: string;
  description: string;
  highlights: string[];
};

export const events: CampusEvent[] = [
  {
    id: 'innovation-tech-day',
    title: 'Innovation & Tech Day',
    dateShort: '12 APR',
    date: '12 April 2026',
    time: '10:00 AM – 4:00 PM',
    category: 'Workshop',
    location: 'Main Campus',
    attendees: 200,
    organizer: 'KSU Tech Club',
    image: '/assets/event-innovation.jpg',
    price: 'Free',
    description: 'Join students, industry experts, and innovators for a day of technology, networking, and hands-on learning.',
    highlights: ['Keynote speakers', 'Networking sessions', 'Hands-on workshops', 'Refreshments provided'],
  },
  {
    id: 'culture-fest',
    title: 'Culture Fest',
    dateShort: '18 APR',
    date: '18 April 2026',
    time: '12:00 PM – 7:00 PM',
    category: 'Cultural',
    location: 'Campus Grounds',
    attendees: 500,
    organizer: 'Culture Collective',
    image: '/assets/event-culture.jpg',
    price: 'Free',
    description: 'A joyful afternoon of music, food, performances, and traditions from across the campus community.',
    highlights: ['Live performances', 'Student food stalls', 'Art and culture spaces', 'Community showcase'],
  },
  {
    id: 'leadership-workshop',
    title: 'Leadership Workshop',
    dateShort: '25 APR',
    date: '25 April 2026',
    time: '2:00 PM – 5:00 PM',
    category: 'Seminar',
    location: 'Lecture Hall A',
    attendees: 150,
    organizer: 'Student Leadership Network',
    image: '/assets/event-leadership.webp',
    price: 'Free',
    description: 'Build practical leadership skills and connect with mentors from across your university community.',
    highlights: ['Leadership exercises', 'Peer networking', 'Mentor Q&A', 'Take-home resources'],
  },
];

export type CampusVenue = {
  id: string;
  name: string;
  location: string;
  capacity: number;
  image: string;
  facilities: string[];
  available: string[];
  availabilityTags: string[];
  description: string;
  kind: string;
};

export const venues: CampusVenue[] = [
  {
    id: 'great-hall',
    name: 'Great Hall',
    location: 'Main Campus',
    capacity: 500,
    image: '/assets/venue-great-hall.jpeg',
    facilities: ['Projector', 'Sound system', 'Wi-Fi', 'Air conditioning', 'Seating', 'Power supply'],
    available: ['8:00 AM – 12:00 PM', '1:00 PM – 5:00 PM', '6:00 PM – 10:00 PM'],
    availabilityTags: ['Today', 'This week'],
    description: 'A spacious, flexible venue for conferences, seminars, graduations, and large campus events.',
    kind: 'Auditorium',
  },
  {
    id: 'seminar-room-b',
    name: 'Seminar Room B',
    location: 'Learning Commons',
    capacity: 80,
    image: '/assets/event-innovation.jpg',
    facilities: ['Projector', 'Whiteboard', 'Wi-Fi', 'Flexible seating'],
    available: ['9:00 AM – 12:00 PM', '2:00 PM – 5:00 PM'],
    availabilityTags: ['This week'],
    description: 'A bright, flexible room for workshops, study groups, and small organization meetings.',
    kind: 'Seminar room',
  },
  {
    id: 'campus-courtyard',
    name: 'Campus Courtyard',
    location: 'Central Campus',
    capacity: 300,
    image: '/assets/campus-courtyard.jpg',
    facilities: ['Outdoor seating', 'Power access', 'Accessible paths', 'Open-air stage'],
    available: ['9:00 AM – 1:00 PM', '3:00 PM – 7:00 PM'],
    availabilityTags: ['This week'],
    description: 'An open-air gathering space for student showcases, pop-ups, and community celebrations.',
    kind: 'Outdoor space',
  },
];

export const sampleBookings = [
  { venue: 'Great Hall', date: '12 Apr 2026', time: '10:00 AM – 4:00 PM', status: 'Confirmed' },
  { venue: 'Seminar Room B', date: '16 Apr 2026', time: '2:00 PM – 5:00 PM', status: 'Pending' },
];
