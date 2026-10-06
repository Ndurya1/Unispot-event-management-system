import { useState } from 'react';
import { BadgeCheck, Check, Download, FileBadge, History, Palette, Share2, Sparkles } from 'lucide-react';
import { DemoMessage, ServicePageHeading, ServiceTabs, WorkspacePanel } from './shared';

const certificateTabs = [
  { id: 'my-certificates', label: 'My Certificates' },
  { id: 'templates', label: 'Templates' },
  { id: 'history', label: 'History' },
];
const certificates = [
  { event: 'Innovation & Tech Day', date: '16 Apr 2026', status: 'Available' },
  { event: 'Leadership Workshop', date: '10 Apr 2026', status: 'Available' },
  { event: 'Culture Fest', date: '28 Mar 2026', status: 'Available' },
  { event: 'Tech Talk Series', date: '15 Mar 2026', status: 'Available' },
];
const templates = [
  { name: 'Campus Classic', detail: 'Formal · Navy and violet' },
  { name: 'Modern Minimal', detail: 'Clean · Contemporary' },
  { name: 'Event Spotlight', detail: 'Colorful · Customizable' },
];

export function DigitalCertificatesPage() {
  const [activeTab, setActiveTab] = useState('my-certificates');
  const [notice, setNotice] = useState('');
  const selectTab = (tab: string) => { setActiveTab(tab); setNotice(''); };

  return (
    <section className="sd-page sd-certificates-page">
      <ServicePageHeading title="Digital Certificates" description="Get recognized for your participation. Download and share your event certificates easily." />
      <section className="sd-certificate-hero" aria-label="Certificate features">
        <div className="sd-certificate-hero-copy"><span className="sd-certificate-kicker"><Sparkles size={14} />RECOGNIZE YOUR CAMPUS JOURNEY</span><h2>Every great experience<br />deserves to be <em>remembered.</em></h2><p>Certificates for eligible event participants, presented in a polished, shareable format.</p><div className="sd-certificate-benefits"><span><BadgeCheck size={15} />Automatic generation</span><span><Palette size={15} />Custom templates</span><span><Download size={15} />Download &amp; share</span><span><History size={15} />Track issued certificates</span></div></div>
        <div className="sd-certificate-preview" aria-label="Illustrative certificate preview"><span>UNISPOT · CAMPUS EVENTS</span><small>CERTIFICATE OF</small><strong>Participation</strong><i /><p>This certificate is presented to</p><b>Moses Thomas</b><span className="sd-certificate-preview-event">Innovation &amp; Tech Day</span><BadgeCheck size={33} aria-hidden="true" /></div>
      </section>

      <WorkspacePanel title="Certificate records" titleId="certificate-list-heading" className="sd-certificates-panel">
        <ServiceTabs tabs={certificateTabs} active={activeTab} onChange={selectTab} idPrefix="certificate-tabs" label="Certificate pages" />
        <section className="sd-certificate-tab-panel" id="certificate-tabs-panel-my-certificates" role="tabpanel" aria-labelledby="certificate-tabs-tab-my-certificates" tabIndex={0} hidden={activeTab !== 'my-certificates'}>
          <div className="sd-table-wrap"><table className="sd-certificate-table"><thead><tr><th scope="col">Event Name</th><th scope="col">Date Issued</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead><tbody>{certificates.map((certificate) => <tr key={certificate.event}><th scope="row">{certificate.event}</th><td>{certificate.date}</td><td><span className="sd-status sd-status--available"><Check size={12} />{certificate.status}</span></td><td><button className="button button--primary button--small" type="button" onClick={() => setNotice(`Preview only—no certificate file has been issued for ${certificate.event}.`)}><Download size={13} />Download</button></td></tr>)}</tbody></table></div>
        </section>
        <section className="sd-certificate-tab-panel" id="certificate-tabs-panel-templates" role="tabpanel" aria-labelledby="certificate-tabs-tab-templates" tabIndex={0} hidden={activeTab !== 'templates'}>
          <div className="sd-template-grid">{templates.map((template) => <article className="sd-template-card" key={template.name}><span><FileBadge size={22} /></span><h3>{template.name}</h3><p>{template.detail}</p><button className="button button--outline button--small" type="button" onClick={() => setNotice(`${template.name} is a sample template preview. No certificate has been issued.`)}>Preview Template</button></article>)}</div>
        </section>
        <section className="sd-certificate-tab-panel" id="certificate-tabs-panel-history" role="tabpanel" aria-labelledby="certificate-tabs-tab-history" tabIndex={0} hidden={activeTab !== 'history'}>
          <ul className="sd-certificate-history">{certificates.map((certificate, index) => <li key={certificate.event}><span className="sd-history-icon"><History size={15} /></span><div><strong>{certificate.event}</strong><small>{index === 0 ? 'Certificate prepared for preview' : 'Sample certificate activity'} · {certificate.date}</small></div><span className="sd-history-status">Demo record</span></li>)}</ul>
        </section>
        <DemoMessage>{notice}</DemoMessage>
        <p className="sd-footnote"><Share2 size={13} aria-hidden="true" /> Certificate records and download controls are illustrative; no real certificate is issued or downloaded.</p>
      </WorkspacePanel>
    </section>
  );
}
