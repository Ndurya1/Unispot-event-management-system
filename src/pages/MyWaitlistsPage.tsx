import { useState } from 'react';
import { Bell, CalendarDays, Clock3, MapPin, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';

type PersonalWaitlist = { id: string; venue: string; venueId: string; event: string; date: string; time: string; queue: string; status: string; joined: boolean };
const initialWaitlists: PersonalWaitlist[] = [
  { id: 'great-hall', venue: 'Great Hall', venueId: 'great-hall', event: 'Innovation & Tech Day', date: '20 Oct 2026', time: '10:00 AM – 4:00 PM', queue: 'You are next in line', status: 'Currently unavailable', joined: true },
  { id: 'seminar-room-b', venue: 'Seminar Room B', venueId: 'seminar-room-b', event: 'Leadership Workshop', date: '28 Oct 2026', time: '2:00 PM – 5:00 PM', queue: 'Position #2', status: '2nd in queue', joined: true },
];

export function MyWaitlistsPage() {
  const [waitlists, setWaitlists] = useState(initialWaitlists);
  const [notice, setNotice] = useState('');
  const toggleMembership = (id: string) => {
    const entry = waitlists.find((item) => item.id === id);
    if (!entry) return;
    setWaitlists((current) => current.map((item) => item.id === id ? { ...item, joined: !item.joined } : item));
    setNotice(entry.joined ? `You left the ${entry.venue} demo waitlist. No notification was sent.` : `You joined the ${entry.venue} demo waitlist. Queue updates are not connected.`);
  };

  return (
    <div className="page-wrap page-wrap--wide my-waitlists-page">
      <header className="my-waitlists-heading"><div><span className="eyebrow">STUDENT SPACE</span><h1>My Waitlists</h1><p>Track your own place in line for a venue that is not available yet.</p></div><Link className="button button--outline" to="/venues">Browse venues</Link></header>
      <div className="my-waitlists-info"><span><Bell size={16} aria-hidden="true" /></span><p><strong>Your personal queue only.</strong> Admin manages campus-wide waitlist rules; this page shows and updates only your demo entries. No slot alerts are sent in this preview.</p></div>
      <section className="my-waitlists-grid" aria-label="Your venue waitlists">
        {waitlists.map((item) => <article className="my-waitlist-card" key={item.id}>
          <div className="my-waitlist-card-head"><span className="my-waitlist-icon"><CalendarDays size={18} aria-hidden="true" /></span><span className={`my-waitlist-status${item.joined ? '' : ' my-waitlist-status--muted'}`}>{item.joined ? item.queue : 'Not on waitlist'}</span></div>
          <h2>{item.venue}</h2><p className="my-waitlist-event">{item.event}</p>
          <div className="my-waitlist-meta"><span><CalendarDays size={14} />{item.date}</span><span><Clock3 size={14} />{item.time}</span><span><MapPin size={14} />Main Campus</span></div>
          <div className="my-waitlist-card-foot"><span className="my-waitlist-status-text">{item.joined ? item.status : 'You have left this queue'}</span><div><Link className="text-link" to={`/venues/${item.venueId}`}>View venue</Link><button className={`button button--small ${item.joined ? 'button--outline' : 'button--primary'}`} type="button" aria-pressed={item.joined} onClick={() => toggleMembership(item.id)}>{item.joined ? 'Leave waitlist' : 'Join waitlist'}</button></div></div>
        </article>)}
      </section>
      {notice && <p className="inline-success my-waitlist-notice" role="status">{notice}</p>}
      <p className="my-waitlists-footnote"><UsersRound size={14} aria-hidden="true" /> Waitlist membership changes are temporary UI state; automatic slot allocation and alerts need the backend.</p>
    </div>
  );
}
