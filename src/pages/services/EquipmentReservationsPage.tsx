import { useState, type FormEvent } from 'react';
import { Armchair, ArrowRight, Check, Clock3, Laptop, Mic, Monitor, Package, Presentation, Speaker } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DemoMessage, ServicePageHeading, WorkspacePanel } from './shared';

type Equipment = { id: string; name: string; available: number; icon: LucideIcon; description: string };
const equipment: Equipment[] = [
  { id: 'projector', name: 'Projector', available: 4, icon: Presentation, description: 'HD projector with HDMI connection and basic presentation remote.' },
  { id: 'sound-system', name: 'Sound System', available: 2, icon: Speaker, description: 'Portable speakers with mixer and event microphone inputs.' },
  { id: 'laptop', name: 'Laptop', available: 12, icon: Laptop, description: 'Campus laptop for event presentations and registration desks.' },
  { id: 'chairs-tables', name: 'Chairs & Tables', available: 8, icon: Armchair, description: 'Flexible seating and tables for campus workshops and gatherings.' },
  { id: 'microphone', name: 'Microphone', available: 6, icon: Mic, description: 'Wireless microphone kit for speakers and audience Q&A.' },
  { id: 'whiteboard', name: 'Whiteboard', available: 3, icon: Monitor, description: 'Mobile whiteboard with markers for collaborative sessions.' },
];

export function EquipmentReservationsPage() {
  const [selectedId, setSelectedId] = useState(equipment[0].id);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notice, setNotice] = useState('');
  const [selectedDetails, setSelectedDetails] = useState<Equipment | null>(null);
  const selected = equipment.find((item) => item.id === selectedId) ?? equipment[0];

  const checkAvailability = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const requested = Number(quantity);
    if (!Number.isInteger(requested) || requested < 1) {
      setNotice('Enter a quantity of at least one item.');
    } else if (requested > selected.available) {
      setNotice(`Only ${selected.available} ${selected.name.toLowerCase()} item${selected.available === 1 ? '' : 's'} are listed as available in this demo.`);
    } else {
      setNotice(`${requested} ${selected.name.toLowerCase()} item${requested === 1 ? '' : 's'} appear available for ${date} at ${time}. This is a preview only—nothing has been reserved.`);
    }
  };

  return (
    <section className="sd-page sd-equipment-page">
      <ServicePageHeading title="Equipment Reservations" description="Reserve projectors, sound systems, laptops, and other essentials for your event." />
      <p className="sd-data-note"><span /> SAMPLE EQUIPMENT INVENTORY · NOT LIVE</p>
      <div className="sd-equipment-grid">
        {equipment.map(({ id, name, available, icon: Icon, description }) => (
          <article className={`sd-equipment-card${selectedId === id ? ' sd-equipment-card--selected' : ''}`} key={id}>
            <span className="sd-equipment-icon"><Icon size={25} aria-hidden="true" /></span>
            <h2>{name}</h2><p>{available} available</p>
            <button className="sd-link-button" type="button" onClick={() => { setSelectedId(id); setSelectedDetails({ id, name, available, icon: Icon, description }); setNotice(''); }}>View Details <ArrowRight size={13} /></button>
          </article>
        ))}
      </div>
      <div className="sd-equipment-reserve-grid">
        {selectedDetails && <WorkspacePanel title={selectedDetails.name} titleId="equipment-details-title" className="sd-equipment-detail-panel"><button type="button" className="sd-close-inline" onClick={() => setSelectedDetails(null)} aria-label="Close equipment details">×</button><span className="sd-equipment-icon"><selectedDetails.icon size={25} aria-hidden="true" /></span><p>{selectedDetails.description}</p><span className="sd-availability-label"><Check size={14} />{selectedDetails.available} available in sample inventory</span></WorkspacePanel>}
        <WorkspacePanel title="Reserve Equipment" titleId="equipment-reserve-title" className={`sd-equipment-form-panel${selectedDetails ? '' : ' sd-equipment-form-panel--wide'}`}>
          <form className="sd-equipment-form" onSubmit={checkAvailability}>
            <label className="sd-field"><span>Equipment</span><select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setNotice(''); }} aria-label="Choose equipment">{equipment.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.available} available</option>)}</select></label>
            <label className="sd-field"><span>Select Date</span><input type="date" required value={date} onChange={(event) => { setDate(event.target.value); setNotice(''); }} /></label>
            <label className="sd-field"><span>Select Time</span><select required value={time} onChange={(event) => { setTime(event.target.value); setNotice(''); }}><option value="">Select time</option><option>8:00 AM – 12:00 PM</option><option>1:00 PM – 5:00 PM</option><option>6:00 PM – 9:00 PM</option></select></label>
            <label className="sd-field"><span>Quantity</span><input type="number" min="1" max={selected.available} required value={quantity} onChange={(event) => { setQuantity(event.target.value); setNotice(''); }} /></label>
            <button className="button button--primary sd-equipment-submit" type="submit"><Clock3 size={15} aria-hidden="true" />Check Availability <ArrowRight size={15} aria-hidden="true" /></button>
          </form>
          <DemoMessage tone={notice.includes('Only') || notice.startsWith('Enter') ? 'warning' : 'info'}>{notice}</DemoMessage>
        </WorkspacePanel>
      </div>
      <p className="sd-footnote"><Package size={14} aria-hidden="true" /> Availability is example data. This page does not reserve or assign equipment.</p>
    </section>
  );
}
