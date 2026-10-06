import { useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, CalendarCheck, MapPin, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Brand } from '../components/Brand';

function AuthFrame({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <main className="auth-screen">
      <aside className="auth-story">
        <div className="auth-story-bg" />
        <div className="auth-story-inner"><Brand /><div className="auth-story-copy"><span className="eyebrow eyebrow--light">A CAMPUS THAT COMES TOGETHER</span><h1>Your campus.<br />Your events.</h1><p>Find events, book venues, and connect with your university community — all in one place.</p><div className="auth-features"><span><CalendarCheck size={17} />Discover campus events</span><span><MapPin size={17} />Book halls and venues</span><span><Users size={17} />Join clubs & organizations</span><span><ArrowRight size={17} />Get real-time updates</span></div></div><div className="auth-story-bottom"><strong>More than events.<br />It’s community.</strong><span>Discover. Book. Connect.</span></div></div>
      </aside>
      <section className="auth-content"><div className="auth-mobile-brand"><Brand /></div><div className="auth-form-wrap"><span className="eyebrow">{title === 'Welcome back' ? 'YOUR CAMPUS IS WAITING' : 'YOUR NEXT CHAPTER STARTS HERE'}</span><h2>{title}</h2><p className="auth-subtitle">{subtitle}</p>{children}<p className="prototype-note">Frontend preview only — this form does not create an account or send data.</p><div className="auth-footer">{footer}</div></div><div className="auth-legal">© 2026 UniSpot <span>·</span> Terms <span>·</span> Privacy</div></section>
    </main>
  );
}

export function LoginPage() {
  const [message, setMessage] = useState('');
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('This is a frontend demo. Login is not connected to an account service.');
  };
  return <AuthFrame title="Welcome back" subtitle="Log in to your UniSpot account" footer={<>Don’t have an account? <Link to="/signup">Sign up</Link></>}>
    <form className="auth-form" onSubmit={submit}>
      <div className="form-field"><label htmlFor="login-email">Email address</label><input id="login-email" type="email" autoComplete="email" required placeholder="Enter your email address" /></div>
      <div className="form-field"><div className="form-label-row"><label htmlFor="login-password">Password</label><Link to="/forgot-password">Forgot password?</Link></div><input id="login-password" type="password" autoComplete="current-password" required placeholder="Enter your password" /></div>
      <label className="remember-row"><input type="checkbox" />Remember me</label>
      <button className="button button--primary button--full auth-submit" type="submit">Log in <ArrowRight size={17} /></button>
      {message && <p className="form-status" role="status">{message}</p>}
    </form>
  </AuthFrame>;
}

const accountTypes = [
  { value: 'Student', description: 'Discover events and book venues.' },
  { value: 'Organizer', description: 'Manage events and registrations.' },
  { value: 'University Staff', description: 'Support your campus community.' },
  { value: 'Service Provider', description: 'Offer approved event services.' },
];

export function SignupPage() {
  const [accountType, setAccountType] = useState('Student');
  const [message, setMessage] = useState('');
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (data.get('password') !== data.get('confirmPassword')) {
      setMessage('Your passwords don’t match. Please check them and try again.');
      return;
    }
    setMessage(`${accountType} selected. Account creation is not connected in this frontend demo.`);
  };
  return <AuthFrame title="Create your account" subtitle="Join UniSpot and be part of the campus community" footer={<>Already have an account? <Link to="/login">Log in</Link></>}>
    <form className="auth-form auth-form--signup" onSubmit={submit}>
      <div className="form-field"><label htmlFor="signup-name">Full name</label><input id="signup-name" name="fullName" autoComplete="name" required placeholder="Enter your full name" /></div>
      <div className="form-field"><label htmlFor="signup-email">Email address</label><input id="signup-email" name="email" type="email" autoComplete="email" required placeholder="Enter your email address" /></div>
      <div className="form-field"><label htmlFor="signup-phone">Phone number <span className="muted">(optional)</span></label><input id="signup-phone" name="phone" type="tel" autoComplete="tel" placeholder="e.g. 07XX XXX XXX" /></div>
      <div className="form-grid form-grid--auth"><div className="form-field"><label htmlFor="signup-password">Password</label><input id="signup-password" name="password" type="password" autoComplete="new-password" required minLength={8} placeholder="Create a password" /></div><div className="form-field"><label htmlFor="signup-confirm">Confirm password</label><input id="signup-confirm" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} placeholder="Confirm password" /></div></div>
      <fieldset className="account-type-field"><legend>I am signing up as:</legend><div className="account-type-grid">{accountTypes.map((type) => <label className={`account-type-card${accountType === type.value ? ' account-type-card--selected' : ''}`} key={type.value}><input type="radio" name="accountType" value={type.value} checked={accountType === type.value} onChange={() => setAccountType(type.value)} /><span className="account-radio" aria-hidden="true" /> <span><strong>{type.value}</strong><small>{type.description}</small></span></label>)}</div></fieldset>
      <p className="terms-copy">By creating an account, you agree to our <a href="#terms" onClick={(event) => event.preventDefault()}>Terms of Service</a> and <a href="#privacy" onClick={(event) => event.preventDefault()}>Privacy Policy</a>.</p>
      <button className="button button--primary button--full auth-submit" type="submit">Create account <ArrowRight size={17} /></button>
      {message && <p className="form-status" role="status">{message}</p>}
    </form>
  </AuthFrame>;
}

export function ForgotPasswordPage() {
  const [message, setMessage] = useState('');
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('Password reset is not connected in this frontend demo. No email was sent.');
  };
  return <AuthFrame title="Forgot your password?" subtitle="Enter your email address and we’ll help you reset your password." footer={<>Remember your password? <Link to="/login">Log in</Link></>}>
    <form className="auth-form" onSubmit={submit}><div className="form-field"><label htmlFor="reset-email">Email address</label><input id="reset-email" type="email" autoComplete="email" required placeholder="Enter your registered email address" /></div><button className="button button--primary button--full auth-submit" type="submit">Send reset link <ArrowRight size={17} /></button>{message && <p className="form-status" role="status">{message}</p>}</form>
  </AuthFrame>;
}
