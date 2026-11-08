import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Armchair, ArrowRight, Check, Clock3, Laptop, LoaderCircle, Mic, Monitor, Package, Presentation, Speaker } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createEquipmentReservation, listEquipmentAvailability, listMyEquipmentReservations } from '../../api/equipment';
import { ApiError } from '../../api/client';
import type { ApiEquipmentAvailability, ApiEquipmentReservation } from '../../api/types';
import { StatusMessage, ServicePageHeading, WorkspacePanel } from './shared';

const icons: Record<string, LucideIcon> = {
  projector: Presentation,
  'sound-system': Speaker,
  laptop: Laptop,
  'chairs-tables': Armchair,
  microphone: Mic,
  whiteboard: Monitor,
};

const slots = [
  { label: '8:00 AM – 12:00 PM', start: '08:00:00', end: '12:00:00' },
  { label: '1:00 PM – 5:00 PM', start: '13:00:00', end: '17:00:00' },
  { label: '6:00 PM – 9:00 PM', start: '18:00:00', end: '21:00:00' },
];

function toIso(date: string, time: string) {
  return `${date}T${time}+03:00`;
}

function fmtDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function apiMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  return 'The request could not be completed. Please try again.';
}

export function EquipmentReservationsPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [slot, setSlot] = useState(slots[0].label);
  const [quantity, setQuantity] = useState('1');
  const [selectedId, setSelectedId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [items, setItems] = useState<ApiEquipmentAvailability[]>([]);
  const [mine, setMine] = useState<ApiEquipmentReservation[]>([]);
  const [notice, setNotice] = useState<{ tone: 'info' | 'success' | 'warning'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const activeSlot = slots.find((item) => item.label === slot) ?? slots[0];
  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? items[0] ?? null, [items, selectedId]);

  async function load() {
    setLoading(true);
    try {
      const [availability, reservations] = await Promise.all([
        listEquipmentAvailability(toIso(date, activeSlot.start), toIso(date, activeSlot.end)),
        listMyEquipmentReservations(),
      ]);
      setItems(availability);
      setMine(reservations);
      if (!selectedId && availability[0]) setSelectedId(availability[0].id);
    } catch (error) {
      setNotice({ tone: 'warning', text: apiMessage(error) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [date, slot]);

  async function reserve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const requested = Number(quantity);
    if (!Number.isInteger(requested) || requested < 1) {
      setNotice({ tone: 'warning', text: 'Enter a quantity of at least one item.' });
      return;
    }
    if (requested > selected.available_quantity) {
      setNotice({ tone: 'warning', text: `Only ${selected.available_quantity} ${selected.name.toLowerCase()} item(s) are available for ${date} (${slot}).` });
      return;
    }
    setSubmitting(true);
    try {
      const reservation = await createEquipmentReservation({
        equipment_id: selected.id,
        quantity: requested,
        starts_at: toIso(date, activeSlot.start),
        ends_at: toIso(date, activeSlot.end),
              });
      setNotice({
        tone: 'success',
        text: `Reservation confirmed for ${reservation.quantity} ${reservation.equipment_name} item(s). Confirmation code: ${reservation.confirmation_code}.`,
      });
      setPurpose('');
      await load();
    } catch (error) {
      setNotice({ tone: 'warning', text: apiMessage(error) });
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="sd-page sd-equipment-page">
      <ServicePageHeading title="Equipment Reservations" description="Reserve projectors, sound systems, laptops, and other essentials for your event." />
      <p className="sd-data-note"><span /> Live equipment availability for the selected time slot</p>
      <div className="sd-equipment-grid">
        {(items.length ? items : []).map((item) => {
          const Icon = icons[item.slug] ?? Package;
          return (
            <article className={`sd-equipment-card${selected?.id === item.id ? ' sd-equipment-card--selected' : ''}`} key={item.id}>
              <span className="sd-equipment-icon"><Icon size={25} aria-hidden="true" /></span>
              <h2>{item.name}</h2>
              <p>{item.available_quantity} of {item.total_quantity} available</p>
              <button className="sd-link-button" type="button" onClick={() => setSelectedId(item.id)}>Select <ArrowRight size={13} /></button>
            </article>
          );
        })}
      </div>
      <div className="sd-equipment-reserve-grid">
        {selected && <WorkspacePanel title={selected.name} titleId="equipment-details-title" className="sd-equipment-detail-panel"><span className="sd-equipment-icon">{(() => { const Icon = icons[selected.slug] ?? Package; return <Icon size={25} aria-hidden="true" />; })()}</span><p>{selected.description}</p><span className="sd-availability-label"><Check size={14} />{selected.available_quantity} available for {date} · {slot}</span></WorkspacePanel>}
        <WorkspacePanel title="Reserve Equipment" titleId="equipment-reserve-title" className={`sd-equipment-form-panel${selected ? '' : ' sd-equipment-form-panel--wide'}`}>
          <form className="sd-equipment-form" onSubmit={reserve}>
            <label className="sd-field"><span>Equipment</span><select value={selected?.id ?? ''} onChange={(event) => setSelectedId(event.target.value)} aria-label="Choose equipment">{items.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.available_quantity} available</option>)}</select></label>
            <label className="sd-field"><span>Select Date</span><input type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></label>
            <label className="sd-field"><span>Select Time</span><select required value={slot} onChange={(event) => setSlot(event.target.value)}>{slots.map((item) => <option key={item.label}>{item.label}</option>)}</select></label>
            <label className="sd-field"><span>Quantity</span><input type="number" min="1" max={selected?.available_quantity || 1} required value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
            <label className="sd-field"><span>Purpose (optional)</span><input value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="e.g. Club orientation session" maxLength={255} /></label>
            <button className="button button--primary sd-equipment-submit" type="submit" disabled={submitting || loading || !selected || (selected?.available_quantity ?? 0) < 1}>
              {submitting ? <LoaderCircle size={15} className="spin" aria-hidden="true" /> : <Clock3 size={15} aria-hidden="true" />}
              Reserve & Confirm <ArrowRight size={15} aria-hidden="true" />
            </button>
          </form>
          <StatusMessage tone={notice?.tone ?? 'info'}>{notice?.text}</StatusMessage>
        </WorkspacePanel>
      </div>
      <WorkspacePanel title="My Reservations" titleId="equipment-my-title" className="sd-equipment-form-panel">
        {loading ? <p>Loading reservations…</p> : mine.length ? (
          <div className="sd-bookings-list">
            {mine.map((item) => (
              <article key={item.id} className="sd-booking-row">
                <div>
                  <strong>{item.equipment_name}</strong>
                  <p>{item.quantity} item(s) · {fmtDate(item.starts_at)} – {fmtDate(item.ends_at)}</p>
                  <p>Confirmation: {item.confirmation_code} · {item.status}</p>
                </div>
              </article>
            ))}
          </div>
        ) : <p>No equipment reservations yet.</p>}
      </WorkspacePanel>
    </section>
  );
}
