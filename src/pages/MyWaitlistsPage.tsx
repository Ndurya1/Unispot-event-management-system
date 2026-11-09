import { useEffect, useState } from 'react';
import { Bell, CalendarDays, Clock3, LoaderCircle, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api/client';
import { cancelWaitlist, listMyWaitlists } from '../api/scheduling';
import type { ApiWaitlist } from '../api/types';

function fmt(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function MyWaitlistsPage() {
  const [waitlists, setWaitlists] = useState<ApiWaitlist[]>([]);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setWaitlists(await listMyWaitlists());
    } catch (error) {
      setNotice(error instanceof ApiError ? error.message : 'Could not load your waitlists.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const leave = async (item: ApiWaitlist) => {
    setBusyId(item.id);
    try {
      await cancelWaitlist(item.id);
      setNotice(`You left the waitlist for ${item.venue_name}.`);
      await load();
    } catch (error) {
      setNotice(error instanceof ApiError ? error.message : 'Could not update waitlist.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="page-wrap page-wrap--wide my-waitlists-page">
      <header className="my-waitlists-heading"><div><span className="eyebrow">MY SPACE</span><h1>My Waitlists</h1><p>Track your place in line for venues and manage your waitlist entries.</p></div><Link className="button button--outline" to="/services/waitlists-recurring">Join a waitlist</Link></header>
      <div className="my-waitlists-info"><span><Bell size={16} aria-hidden="true" /></span><p><strong>Your queue.</strong> These are your active and past waitlist entries. Joining/leaving is saved immediately.</p></div>
      {loading && <p className="form-status" role="status"><LoaderCircle size={14} className="spin" aria-hidden="true" /> Loading waitlists…</p>}
      {!loading && <section className="my-waitlists-grid" aria-label="Your venue waitlists">
        {waitlists.map((item) => <article className="my-waitlist-card" key={item.id}>
          <div className="my-waitlist-card-head"><span className="my-waitlist-icon"><CalendarDays size={18} aria-hidden="true" /></span><span className={`my-waitlist-status${item.status === 'ACTIVE' ? '' : ' my-waitlist-status--muted'}`}>{item.status}</span></div>
          <h2>{item.venue_name}</h2><p className="my-waitlist-event">{item.event_name}</p>
          <div className="my-waitlist-meta"><span><CalendarDays size={14} />{item.requested_date}</span><span><Clock3 size={14} />{item.requested_start}–{item.requested_end}</span><span><MapPin size={14} />Venue waitlist</span></div>
          <div className="my-waitlist-card-foot"><span className="my-waitlist-status-text">Code: {item.confirmation_code} · {fmt(item.created_at)}</span><div><Link className="text-link" to={`/venues/${item.venue_id}`}>View venue</Link>{item.status === 'ACTIVE' && <button className="button button--small button--outline" type="button" disabled={busyId === item.id} onClick={() => void leave(item)}>{busyId === item.id ? 'Leaving…' : 'Leave waitlist'}</button>}</div></div>
        </article>)}
        {waitlists.length === 0 && <p className="muted">No waitlist entries yet. <Link className="text-link" to="/services/waitlists-recurring">Join a waitlist</Link>.</p>}
      </section>}
      {notice && <p className="inline-success my-waitlist-notice" role="status">{notice}</p>}
    </div>
  );
}
