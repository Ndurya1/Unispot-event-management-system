import { useEffect, useState } from 'react';
import { BadgeCheck, Check, Download, FileBadge, History, Palette, Share2, ShieldCheck, Sparkles } from 'lucide-react';
import { listMyEventRegistrations } from '../../api/events';
import { issueCertificate, listMyCertificates, verifyCertificate } from '../../api/certificates';
import { ApiError } from '../../api/client';
import type { ApiCertificate, ApiCertificateVerification, ApiEventRegistration } from '../../api/types';
import { StatusMessage, ServicePageHeading, ServiceTabs, WorkspacePanel } from './shared';

const certificateTabs = [
  { id: 'my-certificates', label: 'My Certificates' },
  { id: 'verify', label: 'Verify' },
  { id: 'templates', label: 'Templates' },
  { id: 'history', label: 'History' },
];
const templates = [
  { name: 'Campus Classic', detail: 'Formal · Navy and violet' },
  { name: 'Modern Minimal', detail: 'Clean · Contemporary' },
  { name: 'Event Spotlight', detail: 'Colorful · Customizable' },
];
function apiMessage(error: unknown) { return error instanceof ApiError ? error.message : 'The request could not be completed. Please try again.'; }
function fmt(value: string) { return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' }); }

export function DigitalCertificatesPage() {
  const [activeTab, setActiveTab] = useState('my-certificates');
  const [registrations, setRegistrations] = useState<ApiEventRegistration[]>([]);
  const [certificates, setCertificates] = useState<ApiCertificate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('Campus Classic');
  const [verifyCode, setVerifyCode] = useState('');
  const [verification, setVerification] = useState<ApiCertificateVerification | null>(null);
  const [busyKey, setBusyKey] = useState('');
  const [notice, setNotice] = useState<{ tone: 'info' | 'success' | 'warning'; text: string } | null>(null);
  const selectTab = (tab: string) => { setActiveTab(tab); setNotice(null); setVerification(null); };

  const load = async () => {
    try {
      const [regs, certs] = await Promise.all([
        listMyEventRegistrations().then((items) => items.filter((item: any) => item.status === 'CONFIRMED')),
        listMyCertificates(),
      ]);
      setRegistrations(regs);
      setCertificates(certs);
    } catch (error) {
      setNotice({ tone: 'warning', text: apiMessage(error) });
    }
  };
  useEffect(() => { void load(); }, []);

  const certByRegistration = new Map(certificates.map((c) => [c.registration_id, c]));
  const latest = certificates[0] || (registrations[0] ? { recipient_name: registrations[0].full_name, event_title: registrations[0].event_title, verification_code: 'PENDING-ISSUE', template_name: selectedTemplate, issued_at: registrations[0].created_at } : null);

  async function issue(registrationId: string) {
    setBusyKey(registrationId); setNotice(null);
    try {
      const cert = await issueCertificate(registrationId, selectedTemplate);
      setNotice({ tone: 'success', text: `Certificate issued. Verification code: ${cert.verification_code}` });
      await load();
    } catch (error) { setNotice({ tone: 'warning', text: apiMessage(error) }); }
    finally { setBusyKey(''); }
  }

  function downloadCertificate(cert: ApiCertificate | { recipient_name: string; event_title: string; verification_code: string; template_name: string; issued_at: string }) {
    const text = [
      'UNISPOT CAMPUS EVENTS',
      'Certificate of Participation',
      '',
      `Presented to: ${cert.recipient_name}`,
      `Event: ${cert.event_title}`,
      `Template: ${cert.template_name}`,
      `Verification code: ${cert.verification_code}`,
      `Issued: ${fmt(cert.issued_at)}`,
      'Verify this certificate in UniSpot using the verification code.',
    ].join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cert.event_title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-certificate.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function runVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!verifyCode.trim()) return;
    setBusyKey('verify'); setVerification(null);
    try { setVerification(await verifyCertificate(verifyCode.trim())); }
    catch (error) { setNotice({ tone: 'warning', text: apiMessage(error) }); }
    finally { setBusyKey(''); }
  }

  return (
    <section className="sd-page sd-certificates-page">
      <ServicePageHeading title="Digital Certificates" description="Backend-issued certificates with verification codes. Issue from confirmed registrations, download, and verify." />
      <section className="sd-certificate-hero" aria-label="Certificate features">
        <div className="sd-certificate-hero-copy"><span className="sd-certificate-kicker"><Sparkles size={14} />RECOGNIZE YOUR CAMPUS JOURNEY</span><h2>Every great experience<br />deserves to be <em>remembered.</em></h2><p>Certificates are issued by the backend for eligible confirmed registrations and can be verified.</p><div className="sd-certificate-benefits"><span><BadgeCheck size={15} />Backend-issued records</span><span><ShieldCheck size={15} />Verification codes</span><span><Palette size={15} />Templates</span><span><Download size={15} />Download</span></div></div>
        <div className="sd-certificate-preview" aria-label="Certificate preview"><span>UNISPOT · CAMPUS EVENTS</span><small>CERTIFICATE OF</small><strong>Participation</strong><i /><p>This certificate is presented to</p><b>{latest?.recipient_name ?? 'Your Name'}</b><span className="sd-certificate-preview-event">{latest?.event_title ?? 'Registered Event'}</span><span className="sd-certificate-preview-code">{latest?.verification_code ?? 'CERT-XXXXXX'}</span><BadgeCheck size={33} aria-hidden="true" /></div>
      </section>

      <WorkspacePanel title="Certificate records" titleId="certificate-list-heading" className="sd-certificates-panel">
        <ServiceTabs tabs={certificateTabs} active={activeTab} onChange={selectTab} idPrefix="certificate-tabs" label="Certificate pages" />
        <section className="sd-certificate-tab-panel" id="certificate-tabs-panel-my-certificates" role="tabpanel" aria-labelledby="certificate-tabs-tab-my-certificates" tabIndex={0} hidden={activeTab !== 'my-certificates'}>
          <div className="sd-table-wrap"><table className="sd-certificate-table"><thead><tr><th scope="col">Event</th><th scope="col">Issued</th><th scope="col">Verification</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead><tbody>{registrations.map((item) => { const cert = certByRegistration.get(item.id); return <tr key={item.id}><th scope="row">{item.event_title}</th><td>{cert ? fmt(cert.issued_at) : 'Not issued'}</td><td><span className="admin-mono">{cert?.verification_code || '—'}</span></td><td><span className={`sd-status ${cert?.is_valid !== false ? 'sd-status--available' : 'sd-status--unavailable'}`}>{cert ? (cert.is_valid ? <><Check size={12} />Valid</> : 'Revoked') : 'Eligible'}</span></td><td>{cert ? <button className="button button--outline button--small" type="button" onClick={() => downloadCertificate(cert)}><Download size={13} />Download</button> : <button className="button button--primary button--small" type="button" disabled={busyKey === item.id} onClick={() => { void issue(item.id); }}>{busyKey === item.id ? 'Issuing…' : 'Issue certificate'}</button>}</td></tr>; })}</tbody></table></div>
          {registrations.length === 0 && <p>No confirmed registrations yet. Register for an event to become eligible.</p>}
        </section>
        <section className="sd-certificate-tab-panel" id="certificate-tabs-panel-verify" role="tabpanel" aria-labelledby="certificate-tabs-tab-verify" tabIndex={0} hidden={activeTab !== 'verify'}>
          <form className="admin-notification-form" onSubmit={runVerify}><label className="admin-field"><span>Verification code</span><input value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} placeholder="CERT-XXXXXXXXXXXX" required /></label><button className="button button--primary button--small" type="submit" disabled={busyKey === 'verify'}>{busyKey === 'verify' ? 'Verifying…' : 'Verify certificate'}</button></form>
          {verification && <StatusMessage tone={verification.valid ? 'success' : 'warning'}>{verification.message} {(verification.certificate?.recipient_name || (verification.certificate?.event_title || "") || "") ? `Recipient: ${(verification.certificate?.recipient_name || (verification.certificate?.event_title || "") || "")}. Event: ${(verification.certificate?.event_title || "")}.` : ''}</StatusMessage>}
        </section>
        <section className="sd-certificate-tab-panel" id="certificate-tabs-panel-templates" role="tabpanel" aria-labelledby="certificate-tabs-tab-templates" tabIndex={0} hidden={activeTab !== 'templates'}>
          <div className="sd-template-grid">{templates.map((template) => <article className="sd-template-card" key={template.name}><span><FileBadge size={22} /></span><h3>{template.name}</h3><p>{template.detail}</p><button className="button button--outline button--small" type="button" onClick={() => { setSelectedTemplate(template.name); setNotice({ tone: 'info', text: `${template.name} selected for new certificate issuance.` }); }}>{selectedTemplate === template.name ? 'Selected' : 'Use Template'}</button></article>)}</div>
        </section>
        <section className="sd-certificate-tab-panel" id="certificate-tabs-panel-history" role="tabpanel" aria-labelledby="certificate-tabs-tab-history" tabIndex={0} hidden={activeTab !== 'history'}>
          <ul className="sd-certificate-history">{certificates.map((item) => <li key={item.id}><span className="sd-history-icon"><History size={15} /></span><div><strong>{item.event_title}</strong><small>{item.verification_code} · {fmt(item.issued_at)} · {item.template_name}</small></div><span className="sd-history-status">{item.is_valid ? 'Valid' : 'Revoked'}</span></li>)}</ul>
          {certificates.length === 0 && <p>No issued certificates yet.</p>}
        </section>
        <StatusMessage tone={notice?.tone ?? 'info'}>{notice?.text}</StatusMessage>
        <p className="sd-footnote"><Share2 size={13} aria-hidden="true" /> Issuance and verification are backend-backed. Download currently produces a text certificate containing the verification code.</p>
      </WorkspacePanel>
    </section>
  );
}
