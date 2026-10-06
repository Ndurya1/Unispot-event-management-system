import { useState, type FormEvent } from 'react';
import { ArrowRight, CalendarDays, Check, Clock3, Mail, MapPin, Phone, ShieldCheck, UsersRound } from 'lucide-react';
import { events } from '../../data/mock';
import { BackToServices, DemoMessage, ServicePageHeading, WorkspacePanel } from './shared';

const registrationEvent = events[0];
const benefits = [
  { label: 'Online registration', icon: Check },
  { label: 'Capacity tracking', icon: Check },
  { label: 'Confirmation emails', icon: Mail },
  { label: 'Attendance management', icon: UsersRound },
];

export function EventRegistrationPage() {
  const [submittedName, setSubmittedName] = useState('');
  const [message, setMessage] = useState('');

  const submitRegistration = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmittedName(String(form.get('fullName') || 'Student'));
    setMessage('');
  };

  return (
    <section className="sd-page sd-registration-page">
      <BackToServices />
      <ServicePageHeading
        title="Event Registration & RSVP"
        description="Register for campus events, manage your attendance, and never miss what’s happening on campus."
      />
      <div className="sd-benefit-strip" aria-label="Registration features">
        {benefits.map(({ label, icon: Icon }) => <span key={label}><Icon size={15} aria-hidden="true" />{label}</span>)}
      </div>

      <div className="sd-registration-banner">
        <img src={registrationEvent.image} alt="Students collaborating at Innovation & Tech Day" />
        <div className="sd-registration-banner-shade" />
        <div className="sd-registration-banner-copy">
          <span className="sd-live-badge"><span /> FEATURED EVENT</span>
          <h2>{registrationEvent.title}</h2>
          <p>{registrationEvent.description}</p>
        </div>
      </div>

      <div className="sd-registration-grid">
        <WorkspacePanel title="Event details" titleId="registration-event-title" className="sd-event-summary-panel">
          <div className="sd-event-summary-top">
            <span className="sd-date-tile"><strong>12</strong><small>APR</small></span>
            <div><span className="sd-eyebrow">WORKSHOP</span><h3>{registrationEvent.title}</h3><p>Hosted by {registrationEvent.organizer}</p></div>
          </div>
          <div className="sd-event-facts">
            <span><Clock3 size={15} aria-hidden="true" />{registrationEvent.time}</span>
            <span><MapPin size={15} aria-hidden="true" />{registrationEvent.location}</span>
            <span><UsersRound size={15} aria-hidden="true" />200 seats · 100 registered</span>
            <span><CalendarDays size={15} aria-hidden="true" />{registrationEvent.date}</span>
          </div>
          <p className="sd-event-description">Join students, industry experts, and innovators for a day of technology, networking, and hands-on learning.</p>
          <div className="sd-capacity-meter" aria-label="100 of 200 seats registered"><div><span>Registration capacity</span><strong>100 / 200</strong></div><span className="sd-capacity-track"><i /></span></div>
          <div className="sd-inline-reassurance"><ShieldCheck size={16} aria-hidden="true" /><span>This preview uses sample campus event information.</span></div>
        </WorkspacePanel>

        <WorkspacePanel title="Register for this event" titleId="registration-form-title" className="sd-registration-form-panel">
          {submittedName ? (
            <div className="sd-registration-success">
              <span className="sd-success-mark"><Check size={24} aria-hidden="true" /></span>
              <h3>You’re on the list, {submittedName.split(' ')[0]}.</h3>
              <p>Your demo RSVP for {registrationEvent.title} is ready.</p>
              <DemoMessage tone="success">Prototype only—no real registration was saved and no email was sent.</DemoMessage>
              <button className="button button--outline" type="button" onClick={() => setSubmittedName('')}>Register another attendee</button>
            </div>
          ) : (
            <form className="sd-form" onSubmit={submitRegistration}>
              <label className="sd-field"><span>Full Name <b aria-hidden="true">*</b></span><input name="fullName" autoComplete="name" placeholder="Enter your full name" required /></label>
              <label className="sd-field"><span>Email Address <b aria-hidden="true">*</b></span><input name="email" type="email" autoComplete="email" placeholder="Enter your email address" required /></label>
              <label className="sd-field"><span>Phone Number <b aria-hidden="true">*</b></span><span className="sd-input-with-icon"><Phone size={15} aria-hidden="true" /><input name="phone" type="tel" autoComplete="tel" placeholder="Enter your phone number" required /></span></label>
              <label className="sd-field"><span>Student ID <small>(Optional)</small></span><input name="studentId" autoComplete="off" placeholder="Enter your student ID" /></label>
              {message && <DemoMessage>{message}</DemoMessage>}
              <button className="button button--primary sd-form-submit" type="submit">Complete Registration <ArrowRight size={16} aria-hidden="true" /></button>
              <p className="sd-form-footnote">By registering, you agree to receive event updates. This prototype does not contact you.</p>
            </form>
          )}
        </WorkspacePanel>
      </div>
    </section>
  );
}
