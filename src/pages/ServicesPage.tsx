import { ArrowRight, BadgeCheck, Check, ChevronRight, Monitor, QrCode, ShieldCheck, Sparkles, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { serviceItems, type PreviewKind } from '../data/services';
import { events } from '../data/mock';

function ServicePreview({ kind }: { kind: PreviewKind }) {
  if (kind === 'registration') return <div className="preview-registration"><strong>Register for Event</strong><span>Full name</span><span>Email address</span><em>Register</em></div>;
  if (kind === 'qr') return <div className="preview-qr"><QrCode size={66} strokeWidth={1.6} /><span><Check size={12} /> Scan successful</span></div>;
  if (kind === 'providers') return <ul className="preview-provider-list">{['Catering', 'Photography', 'Sound systems', 'Decorations'].map((item) => <li key={item}><span>{item}</span><ChevronRight size={12} /></li>)}</ul>;
  if (kind === 'analytics') return <div className="preview-analytics"><small>Total registrations</small><strong>342</strong><span className="preview-growth">↗ 12%</span><div className="preview-bars" aria-hidden="true">{[35, 52, 41, 68, 58, 84, 70].map((height, i) => <i key={i} style={{ height: `${height}%` }} />)}</div><small>Attendance rate <b>87%</b></small></div>;
  if (kind === 'equipment') return <ul className="preview-equipment-list">{['Projectors', 'Sound systems', 'Laptops', 'Chairs & tables'].map((item) => <li key={item}><Monitor size={13} /><span>{item}</span></li>)}</ul>;
  if (kind === 'waitlist') return <div className="preview-waitlist"><div className="preview-repeat-head"><span>Recurring booking</span><i aria-hidden="true" /></div><div className="preview-days">{['M', 'T', 'W', 'T', 'F'].map((day, i) => <span className={i < 3 ? 'is-selected' : ''} key={`${day}-${i}`}>{day}</span>)}</div><div className="preview-waitlist-note"><Sparkles size={13} /><span><b>Waitlist</b><small>We’ll let you know when a slot opens.</small></span></div></div>;
  return <div className="preview-certificate"><span>UNISPOT · CAMPUS EVENTS</span><strong>Certificate of<br />Participation</strong><i /><small>This is to recognize</small><b>Student Participant</b><BadgeCheck size={32} /></div>;
}

export function ServicesPage() {
  const heroImage = events.find((event) => event.id === 'innovation-tech-day')?.image ?? '';
  return (
    <div className="services-experience">
      <section className="services-hero" aria-labelledby="services-hero-title">
        <img className="services-hero-photo" src={heroImage} alt="Students collaborating around a laptop at a campus event" />
        <div className="services-hero-inner">
          <div className="services-hero-copy">
            <span className="services-kicker"><Sparkles size={14} /> Campus Services</span>
            <h1 id="services-hero-title">More than just bookings —<br />we power your <span>campus experience.</span></h1>
            <p>Explore additional services designed to make your events easier, more organized and more successful. From registration to certificates, UniSpot has you covered.</p>
            <div className="services-trust"><span><ShieldCheck size={15} /> Convenient</span><span><ShieldCheck size={15} /> Secure</span><span><UsersRound size={15} /> Student Focused</span></div>
          </div>
          <p className="services-hero-slogan" aria-hidden="true">Better events.<br />Stronger community.</p>
        </div>
      </section>

      <div className="services-main">
        <section id="service-catalog" aria-labelledby="service-catalog-title">
          <div className="services-section-intro"><span className="eyebrow">WHAT WE OFFER</span><h2 id="service-catalog-title">Campus Services</h2><p>Everything you need to plan, manage and enjoy your campus events — all in one place.</p></div>
          <div className="services-catalog-grid">
            {serviceItems.map((service) => {
              const Icon = service.icon;
              return (
                <article className={`service-tile service-tile--${service.tone}${service.preview === 'certificate' ? ' service-tile--wide' : ''}`} key={service.id}>
                  <div className="service-tile-heading"><span className="service-tile-icon" aria-hidden="true"><Icon size={21} /></span><h3>{service.title}</h3></div>
                  <p className="service-tile-description">{service.description}</p>
                  <div className="service-tile-content">
                    <div className="service-tile-actions"><ul>{service.benefits.map((benefit) => <li key={benefit}><Check size={13} />{benefit}</li>)}</ul><Link className="service-explore" to={`/services/${service.id}`}>Explore Service <ArrowRight size={14} /></Link></div>
                    <div className="service-preview" aria-hidden="true"><ServicePreview kind={service.preview} /></div>
                  </div>
                </article>
              );
            })}
            <article className="services-ready-card"><span className="services-ready-icon" aria-hidden="true"><UsersRound size={22} /></span><div><h3>Ready to get started?</h3><p>Explore UniSpot services and make your campus experience better.</p><Link to="#service-catalog" className="button button--white">Go to Services <ArrowRight size={15} /></Link></div></article>
          </div>
          <p className="services-prototype-note" role="note">Service previews are design prototypes. Each service below opens its own dashboard preview.</p>
        </section>
      </div>

      <footer className="services-footer"><Brand /><span><ShieldCheck size={16} /> Safe <i /> Simple <i /> For Our Campus</span></footer>
    </div>
  );
}
