import { useMemo, useState, type FormEvent } from 'react';
import { ArrowRight, Check, MapPin, Search, Star, UsersRound, X } from 'lucide-react';
import { events } from '../../data/mock';
import { DemoMessage, ServicePageHeading, WorkspacePanel } from './shared';

type Provider = { id: string; name: string; category: string; rating: string; reviews: number; price: number; priceLabel: string; image: string; availability: string; description: string };
const providers: Provider[] = [
  { id: 'royal-catering', name: 'Royal Catering Services', category: 'Catering', rating: '4.8', reviews: 76, price: 5000, priceLabel: 'From KSh 5,000', image: events[1].image, availability: 'today', description: 'Campus-friendly refreshments, snack tables, and catered meals for student events.' },
  { id: 'pocus-media', name: 'Pocus Media Kenya', category: 'Photography & Videography', rating: '4.9', reviews: 42, price: 12000, priceLabel: 'From KSh 12,000', image: events[0].image, availability: 'week', description: 'Event photography and short-form video coverage for campus organizations.' },
  { id: 'sound-masters', name: 'Sound Masters KE', category: 'Sound Systems', rating: '4.7', reviews: 64, price: 18000, priceLabel: 'From KSh 18,000', image: events[2].image, availability: 'today', description: 'Sound, microphones, and basic technical support for indoor and outdoor events.' },
  { id: 'event-decor', name: 'Event Decor Solutions', category: 'Decorations', rating: '4.6', reviews: 28, price: 8000, priceLabel: 'From KSh 8,000', image: events[1].image, availability: 'week', description: 'Simple stage, table, and campus-space decorations tailored to your event.' },
];
const categories = ['All Categories', 'Catering', 'Photography & Videography', 'Sound Systems', 'Decorations'];

type PriceRange = 'Any Price' | 'Under KSh 10,000' | 'KSh 10,000–25,000' | 'Over KSh 25,000';

export function ServiceProviderDirectoryPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All Categories');
  const [priceRange, setPriceRange] = useState<PriceRange>('Any Price');
  const [availability, setAvailability] = useState('Any Date');
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [requestProvider, setRequestProvider] = useState<Provider | null>(null);
  const [notice, setNotice] = useState('');
  const visibleProviders = useMemo(() => providers.filter((provider) => {
    const textMatches = `${provider.name} ${provider.category} ${provider.description}`.toLowerCase().includes(search.toLowerCase());
    const categoryMatches = category === 'All Categories' || provider.category === category;
    const priceMatches = priceRange === 'Any Price'
      || (priceRange === 'Under KSh 10,000' && provider.price < 10000)
      || (priceRange === 'KSh 10,000–25,000' && provider.price >= 10000 && provider.price <= 25000)
      || (priceRange === 'Over KSh 25,000' && provider.price > 25000);
    const availabilityMatches = availability === 'Any Date'
      || (availability === 'Available Today' && provider.availability === 'today')
      || (availability === 'Available This Week' && provider.availability === 'week');
    return textMatches && categoryMatches && priceMatches && availabilityMatches;
  }), [search, category, priceRange, availability]);

  const submitRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(`Demo request drafted for ${requestProvider?.name}. No provider was contacted.`);
    setRequestProvider(null);
  };

  return (
    <section className="sd-page sd-provider-page">
      <ServicePageHeading title="Campus Service Providers" description="Find trusted and approved providers for your events." />
      <WorkspacePanel title="Find the right provider" titleId="provider-filter-title" className="sd-provider-filter-panel">
        <div className="sd-provider-filters">
          <label className="sd-field sd-provider-search"><span>Search providers</span><span className="sd-input-with-icon"><Search size={15} aria-hidden="true" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search catering, photography, sound..." /></span></label>
          <label className="sd-field"><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="sd-field"><span>Price Range</span><select value={priceRange} onChange={(event) => setPriceRange(event.target.value as PriceRange)}><option>Any Price</option><option>Under KSh 10,000</option><option>KSh 10,000–25,000</option><option>Over KSh 25,000</option></select></label>
          <label className="sd-field"><span>Availability</span><select value={availability} onChange={(event) => setAvailability(event.target.value)}><option>Any Date</option><option>Available Today</option><option>Available This Week</option></select></label>
        </div>
        <div className="sd-provider-result-count" aria-live="polite">{visibleProviders.length} providers match your filters</div>
      </WorkspacePanel>

      {selectedProvider && (
        <section className="sd-provider-expanded" aria-labelledby="provider-detail-title">
          <button className="sd-close-inline" type="button" onClick={() => setSelectedProvider(null)} aria-label="Close provider details"><X size={17} /></button>
          <span className="sd-eyebrow">PROVIDER PROFILE</span><h2 id="provider-detail-title">{selectedProvider.name}</h2>
          <p>{selectedProvider.description}</p><span className="sd-provider-info"><MapPin size={14} aria-hidden="true" />Main Campus · {selectedProvider.category} · {selectedProvider.priceLabel}</span>
          <button className="button button--primary button--small" type="button" onClick={() => { setRequestProvider(selectedProvider); setNotice(''); }}>Request this service <ArrowRight size={14} /></button>
        </section>
      )}

      <div className="sd-provider-grid">
        {visibleProviders.map((provider) => (
          <article className="sd-provider-card" key={provider.id}>
            <div className="sd-provider-photo"><img src={provider.image} alt="Illustrative campus event photo; not a verified provider portfolio image" /><span>{provider.category}</span></div>
            <div className="sd-provider-card-body"><div className="sd-provider-title-row"><h2>{provider.name}</h2><span className="sd-provider-approved" aria-label="Sample listing"><Check size={13} /></span></div>
              <p className="sd-provider-category">{provider.category}</p><div className="sd-provider-rating"><Star size={14} fill="currentColor" aria-hidden="true" /><strong>{provider.rating}</strong><span>({provider.reviews} reviews)</span></div>
              <div className="sd-provider-meta"><span><MapPin size={14} aria-hidden="true" />Main Campus</span><strong>{provider.priceLabel}</strong></div>
              <div className="sd-provider-actions"><button className="button button--outline button--small" type="button" onClick={() => { setSelectedProvider(provider); setRequestProvider(null); setNotice(''); }}>View Provider</button><button className="button button--primary button--small" type="button" onClick={() => { setRequestProvider(provider); setSelectedProvider(null); setNotice(''); }}>Request Service</button></div>
            </div>
          </article>
        ))}
      </div>
      {visibleProviders.length === 0 && <div className="sd-empty-state"><Search size={23} /><h2>No providers found</h2><p>Try a different search or select a broader filter.</p></div>}

      {requestProvider && (
        <WorkspacePanel title={`Request ${requestProvider.category}`} titleId="provider-request-title" className="sd-request-panel">
          <button className="sd-close-inline" type="button" onClick={() => setRequestProvider(null)} aria-label="Close request form"><X size={17} /></button>
          <p>Prepare a sample request for <strong>{requestProvider.name}</strong>.</p>
          <form className="sd-form sd-request-form" onSubmit={submitRequest}>
            <label className="sd-field"><span>Event</span><select defaultValue={events[0].id}>{events.map((event) => <option value={event.id} key={event.id}>{event.title}</option>)}</select></label>
            <label className="sd-field"><span>Requested Date</span><input type="date" required /></label>
            <label className="sd-field sd-request-notes"><span>Notes</span><textarea rows={3} placeholder="Share the service details you have in mind" /></label>
            <button className="button button--primary" type="submit">Prepare Demo Request <ArrowRight size={14} /></button>
          </form>
        </WorkspacePanel>
      )}
      <DemoMessage>{notice}</DemoMessage>
      <p className="sd-footnote"><UsersRound size={13} aria-hidden="true" /> Sample directory entries and images are illustrative; service requests do not contact a provider.</p>
    </section>
  );
}
