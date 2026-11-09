import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowRight, Check, LoaderCircle, MapPin, Search, Star, X } from 'lucide-react';
import { cancelMyServiceRequest, createServiceRequest, listMyServiceRequests, listServiceProviders } from '../../api/providers';
import { ApiError } from '../../api/client';
import type { ApiServiceProvider, ApiServiceRequest } from '../../api/types';
import { StatusMessage, ServicePageHeading, WorkspacePanel } from './shared';

type PriceRange = 'Any Price' | 'Under KSh 10,000' | 'KSh 10,000â€“25,000' | 'Over KSh 25,000';
const categories = ['All Categories', 'Catering', 'Photography & Videography', 'Sound Systems', 'Decorations'];
function apiMessage(error: unknown) { return error instanceof ApiError ? error.message : 'The request could not be completed. Please try again.'; }
function fmtDate(value: string) { return new Date(value).toLocaleString(undefined, { dateStyle: 'medium' }); }

export function ServiceProviderDirectoryPage() {
  const [providers, setProviders] = useState<ApiServiceProvider[]>([]);
  const [mine, setMine] = useState<ApiServiceRequest[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All Categories');
  const [priceRange, setPriceRange] = useState<PriceRange>('Any Price');
  const [availability, setAvailability] = useState('Any Date');
  const [selectedProvider, setSelectedProvider] = useState<ApiServiceProvider | null>(null);
  const [requestProvider, setRequestProvider] = useState<ApiServiceProvider | null>(null);
  const [notice, setNotice] = useState<{ tone: 'info' | 'success' | 'warning'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      const [list, requests] = await Promise.all([listServiceProviders(), listMyServiceRequests()]);
      setProviders(list);
      setMine(requests);
    } catch (error) {
      setNotice({ tone: 'warning', text: apiMessage(error) });
    }
  }
  useEffect(() => { void load(); }, []);

  const visibleProviders = useMemo(() => providers.filter((provider) => {
    const textMatches = `${provider.name} ${provider.category} ${provider.description || ''}`.toLowerCase().includes(search.toLowerCase());
    const categoryMatches = category === 'All Categories' || provider.category === category;
    const price = provider.price_from_kes;
    const priceMatches = priceRange === 'Any Price' || (priceRange === 'Under KSh 10,000' && price < 10000) || (priceRange === 'KSh 10,000â€“25,000' && price >= 10000 && price <= 25000) || (priceRange === 'Over KSh 25,000' && price > 25000);
    const availabilityMatches = availability === 'Any Date' || (availability === 'Available Today' && provider.availability === 'today') || (availability === 'Available This Week' && provider.availability === 'week');
    return textMatches && categoryMatches && priceMatches && availabilityMatches;
  }), [providers, search, category, priceRange, availability]);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requestProvider) return;
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      const request = await createServiceRequest({
        provider_id: requestProvider.id,
        event_name: String(form.get('eventName') || ''),
        requested_date: `${String(form.get('requestedDate') || '')}T09:00:00+03:00`,
        notes: String(form.get('notes') || '') || undefined,
      }, crypto.randomUUID());
      setNotice({ tone: 'success', text: `Request submitted for ${request.provider_name}. Status: ${request.status}. Confirmation code: ${request.confirmation_code}.` });
      setRequestProvider(null);
      await load();
    } catch (error) {
      setNotice({ tone: 'warning', text: apiMessage(error) });
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelRequest(id: string) {
    setBusyId(id);
    try {
      await cancelMyServiceRequest(id);
      setNotice({ tone: 'success', text: 'Service request cancelled.' });
      await load();
    } catch (error) {
      setNotice({ tone: 'warning', text: apiMessage(error) });
    } finally { setBusyId(null); }
  }

  return (
    <section className="sd-page sd-provider-page">
      <ServicePageHeading title="Campus Service Providers" description="Find trusted and approved providers for your events." />
      <WorkspacePanel title="Find the right provider" titleId="provider-filter-title" className="sd-provider-filter-panel">
        <div className="sd-provider-filters">
          <label className="sd-field sd-provider-search"><span>Search providers</span><span className="sd-input-with-icon"><Search size={15} aria-hidden="true" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search catering, photography, sound..." /></span></label>
          <label className="sd-field"><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="sd-field"><span>Price Range</span><select value={priceRange} onChange={(event) => setPriceRange(event.target.value as PriceRange)}><option>Any Price</option><option>Under KSh 10,000</option><option>KSh 10,000â€“25,000</option><option>Over KSh 25,000</option></select></label>
          <label className="sd-field"><span>Availability</span><select value={availability} onChange={(event) => setAvailability(event.target.value)}><option>Any Date</option><option>Available Today</option><option>Available This Week</option></select></label>
        </div>
        <div className="sd-provider-result-count" aria-live="polite">{visibleProviders.length} providers match your filters</div>
      </WorkspacePanel>
      {selectedProvider && <section className="sd-provider-expanded" aria-labelledby="provider-detail-title"><button className="sd-close-inline" type="button" onClick={() => setSelectedProvider(null)} aria-label="Close provider details"><X size={17} /></button><span className="sd-eyebrow">PROVIDER PROFILE</span><h2 id="provider-detail-title">{selectedProvider.name}</h2><p>{selectedProvider.description}</p><span className="sd-provider-info"><MapPin size={14} aria-hidden="true" />{selectedProvider.location} · {selectedProvider.category} · From KSh {selectedProvider.price_from_kes.toLocaleString()}</span><button className="button button--primary button--small" type="button" onClick={() => { setRequestProvider(selectedProvider); setNotice(null); }}>Request this service <ArrowRight size={14} /></button></section>}
      <div className="sd-provider-grid">
        {visibleProviders.map((provider) => (
          <article className="sd-provider-card" key={provider.id}>
            <div className="sd-provider-photo"><img src={provider.image_url || '/assets/event-culture.jpg'} alt={`${provider.name} listing`} /><span>{provider.category}</span></div>
            <div className="sd-provider-card-body"><div className="sd-provider-title-row"><h2>{provider.name}</h2><span className="sd-provider-approved" aria-label="Active listing"><Check size={13} /></span></div>
              <p className="sd-provider-category">{provider.category}</p><div className="sd-provider-rating"><Star size={14} fill="currentColor" aria-hidden="true" /><strong>{provider.rating}</strong><span>({provider.reviews} reviews)</span></div>
              <div className="sd-provider-meta"><span><MapPin size={14} aria-hidden="true" />{provider.location}</span><strong>From KSh {provider.price_from_kes.toLocaleString()}</strong></div>
              <div className="sd-provider-actions"><button className="button button--outline button--small" type="button" onClick={() => { setSelectedProvider(provider); setRequestProvider(null); setNotice(null); }}>View Provider</button><button className="button button--primary button--small" type="button" onClick={() => { setRequestProvider(provider); setSelectedProvider(null); setNotice(null); }}>Request Service</button></div>
            </div>
          </article>
        ))}
      </div>
      {visibleProviders.length === 0 && <div className="sd-empty-state"><Search size={23} /><h2>No providers found</h2><p>Try a different search or select a broader filter.</p></div>}
      {requestProvider && <WorkspacePanel title={`Request ${requestProvider.category}`} titleId="provider-request-title" className="sd-request-panel"><button className="sd-close-inline" type="button" onClick={() => setRequestProvider(null)} aria-label="Close request form"><X size={17} /></button><p>Submit a service request for <strong>{requestProvider.name}</strong>.</p><form className="sd-form sd-request-form" onSubmit={submitRequest}><label className="sd-field"><span>Event name</span><input name="eventName" required placeholder="e.g. Innovation & Tech Day" /></label><label className="sd-field"><span>Requested Date</span><input name="requestedDate" type="date" required /></label><label className="sd-field sd-request-notes"><span>Notes</span><textarea name="notes" rows={3} placeholder="Share the service details you have in mind" /></label><button className="button button--primary" type="submit" disabled={submitting}>{submitting ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />} Confirm Request <ArrowRight size={14} /></button></form></WorkspacePanel>}
      <StatusMessage tone={notice?.tone ?? 'info'}>{notice?.text}</StatusMessage>
      <WorkspacePanel title="My Service Requests" titleId="my-requests-title" className="sd-equipment-form-panel">
        {mine.length ? <div className="sd-bookings-list">{mine.map((item) => <article key={item.id} className="sd-booking-row"><div><strong>{item.provider_name}</strong><p>{item.event_name} · {fmtDate(item.requested_date)}</p><p>Confirmation: {item.confirmation_code} · {item.status}{item.quote_amount_kes != null ? ` · Quote KES ${item.quote_amount_kes}` : ''}</p></div><div>{!['CANCELLED','COMPLETED'].includes(item.status) && <button className="button button--outline button--small" type="button" disabled={busyId === item.id} onClick={() => void cancelRequest(item.id)}>Cancel request</button>}</div></article>)}</div> : <p>No service requests yet.</p>}
      </WorkspacePanel>
    </section>
  );
}
