import { useLocation, useSearchParams } from 'react-router-dom';
import { useEffect, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { ArrowRight, CalendarCheck, Eye, EyeOff, MapPin, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { forgotPassword, resetPassword, verifyEmail } from '../api/auth';
import { Brand } from '../components/Brand';
import { homeForRoles } from '../components/ProtectedRoute';
import { useAuth } from '../auth/AuthProvider';

function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-input-wrap">
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        title={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
      </button>
    </div>
  );
}

function AuthFrame({ title, subtitle, children, footer, notice }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode; notice?: ReactNode }) {
  const bgImage = title === 'Welcome back' ? '/assets/auth-login.jpg' : '/assets/auth-signup.jpg';
  return (
    <main className="auth-screen">
      <aside className="auth-story">
        <div className="auth-story-bg" style={{ backgroundImage: `url(${bgImage})` }} />
        <div className="auth-story-inner">
          <Brand />
          <div className="auth-story-copy">
            <span className="eyebrow eyebrow--light">A CAMPUS THAT COMES TOGETHER</span>
            <h1>Your campus.<br />Your events.</h1>
            <p>Find events, book venues, and connect with your university community - all in one place.</p>
            <div className="auth-features"><span><CalendarCheck size={17} />Discover campus events</span><span><MapPin size={17} />Book halls and venues</span><span><Users size={17} />Join clubs & organizations</span><span><ArrowRight size={17} />Get real-time updates</span></div>
          </div>
          <div className="auth-story-bottom"><strong>More than events.<br />It&apos;s community.</strong><span>Discover. Book. Connect.</span></div>
        </div>
      </aside>
      <section className="auth-content"><div className="auth-mobile-brand"><Brand /></div><div className="auth-form-wrap"><span className="eyebrow">{title === 'Welcome back' ? 'YOUR CAMPUS IS WAITING' : 'YOUR NEXT CHAPTER STARTS HERE'}</span><h2>{title}</h2><p className="auth-subtitle">{subtitle}</p>{children}{notice && <p className="prototype-note">{notice}</p>}<div className="auth-footer">{footer}</div></div><div className="auth-legal">&copy; 2026 UniSpot <span>&middot;</span> Terms <span>&middot;</span> Privacy</div></section>
    </main>
  );
}

export function LoginPage() {
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as { from?: string; registeredEmail?: string; signupMessage?: string; verifiedMessage?: string } | null) || {};
  const from = state.from || '/';
  useEffect(() => {
    if (state.registeredEmail) setEmail(state.registeredEmail);
  }, [state.registeredEmail]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    setIsSubmitting(true);
    try {
      const currentUser = await login({ email, password }, new FormData(event.currentTarget).get('rememberMe') === 'on');
      setEmail('');
      setPassword('');
      navigate(from && from !== '/' ? from : homeForRoles(currentUser.roles), { replace: true });
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'We could not log you in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  return <AuthFrame title="Welcome back" subtitle="Log in to your UniSpot account" footer={<>Don&apos;t have an account? <Link to="/signup">Sign up</Link></>}>
    <form className="auth-form" onSubmit={submit}>
      {state.signupMessage && <p className="form-status" role="status">{state.signupMessage}</p>}
      {state.verifiedMessage && <p className="form-status" role="status">{state.verifiedMessage}</p>}
      <div className="form-field"><label htmlFor="login-email">Email address</label><input id="login-email" name="email" type="email" autoComplete="email" required placeholder="Enter your email address" value={email} onChange={(e) => setEmail(e.currentTarget.value)} /></div>
      <div className="form-field"><label htmlFor="login-password">Password</label><PasswordInput id="login-password" name="password" autoComplete="current-password" required placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.currentTarget.value)} /></div>
      <label className="remember-row"><input type="checkbox" name="rememberMe" />Remember me</label>
      <button className="button button--primary button--full auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Logging in...' : 'Log in'} <ArrowRight size={17} /></button>
      <p style={{ marginTop: '0.75rem', fontSize: '0.9rem', textAlign: 'center' }}><Link to="/forgot-password">Forgot password?</Link></p>
      {message && <p className="form-status" role="alert">{message}</p>}
    </form>
  </AuthFrame>;
}

export function SignupPage() {
  const [requestedAccess, setRequestedAccess] = useState('Student');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || '/';
  const authRequired = (location.state as { authRequired?: boolean } | null)?.authRequired;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (data.get('password') !== data.get('confirmPassword')) {
      setMessage('Your passwords do not match. Please check them and try again.');
      return;
    }
    setMessage('');
    setIsSubmitting(true);
    const email = String(data.get('email'));
    try {
      const res = await register({
        full_name: String(data.get('fullName')),
        email,
        password: String(data.get('password')),
      });
      let signupMessage = res.message || 'Account created. Please check your email to verify, then log in.';
      if (requestedAccess !== 'Student') {
        signupMessage += ` ${requestedAccess} access must be approved by an administrator.`;
      }
      navigate('/login', {
        replace: true,
        state: { registeredEmail: email, signupMessage, from: from && from !== '/' ? from : undefined },
      });
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'We could not create your account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  return <AuthFrame title="Create your account" subtitle="Join UniSpot and be part of the campus community" notice={authRequired ? 'Create an account to continue to the page you requested.' : undefined} footer={<>Already have an account? <Link to="/login">Log in</Link></>}>
    <form className="auth-form auth-form--signup" onSubmit={submit}>
      <div className="form-field"><label htmlFor="signup-name">Full name</label><input id="signup-name" name="fullName" autoComplete="name" required placeholder="Enter your full name" /></div>
      <div className="form-field"><label htmlFor="signup-email">Email address</label><input id="signup-email" name="email" type="email" autoComplete="email" required placeholder="Enter your email address" /></div>
      <div className="form-grid form-grid--auth"><div className="form-field"><label htmlFor="signup-password">Password</label><PasswordInput id="signup-password" name="password" autoComplete="new-password" required minLength={8} placeholder="Create a password" /></div><div className="form-field"><label htmlFor="signup-confirm">Confirm password</label><PasswordInput id="signup-confirm" name="confirmPassword" autoComplete="new-password" required minLength={8} placeholder="Confirm password" /></div></div>
      <fieldset className="account-type-field"><legend>Access you need:</legend>
        <div className="account-type-grid">{['Student', 'Organizer', 'University Staff', 'Service Provider'].map((type) => <label className={`account-type-card${requestedAccess === type ? ' account-type-card--selected' : ''}`} key={type}><input type="radio" name="accessType" value={type} checked={requestedAccess === type} onChange={() => setRequestedAccess(type)} /><span className="account-radio" aria-hidden="true" /> <span><strong>{type}</strong><small>{type === 'Student' ? 'Basic access for events and your own requests.' : 'Requires administrator approval after signup.'}</small></span></label>)}</div>
        <p className="muted" style={{ marginTop: '0.75rem' }}>Public signup creates Student access only. Organizer, University Staff, and Service Provider access must be approved and assigned by an administrator. Admin access is never granted from signup.</p>
      </fieldset>
      <p className="terms-copy">By creating an account, you agree to our <a href="#terms" onClick={(event) => event.preventDefault()}>Terms of Service</a> and <a href="#privacy" onClick={(event) => event.preventDefault()}>Privacy Policy</a>.</p>
      <button className="button button--primary button--full auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating account...' : 'Create account'} <ArrowRight size={17} /></button>
      {message && <p className="form-status" role="alert">{message}</p>}
    </form>
  </AuthFrame>;
}

export function ForgotPasswordPage() {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    const data = new FormData(event.currentTarget);
    try {
      const res = await forgotPassword(String(data.get('email')));
      setMessage(res.message);
    } catch {
      setMessage('If an account exists for that email, we sent password reset instructions.');
    } finally {
      setIsSubmitting(false);
    }
  };
  return <AuthFrame title="Forgot your password?" subtitle="Enter your email address and we&apos;ll help you reset your password." footer={<>Remember your password? <Link to="/login">Log in</Link></>}>
    <form className="auth-form" onSubmit={submit}><div className="form-field"><label htmlFor="reset-email">Email address</label><input id="reset-email" name="email" type="email" autoComplete="email" required placeholder="Enter your registered email address" /></div><button className="button button--primary button--full auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Sending...' : 'Send reset link'} <ArrowRight size={17} /></button>{message && <p className="form-status" role="status">{message}</p>}</form>
  </AuthFrame>;
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (data.get('new_password') !== data.get('confirm_password')) {
      setMessage('Passwords do not match.');
      return;
    }
    if (!token) { setMessage('Missing reset token. Use the link from your email.'); return; }
    setIsSubmitting(true);
    setMessage('');
    try {
      const res = await resetPassword(token, String(data.get('new_password')));
      navigate('/login', { replace: true, state: { signupMessage: res.message } });
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Could not reset password. The link may be expired.');
    } finally {
      setIsSubmitting(false);
    }
  };
  return <AuthFrame title="Reset your password" subtitle="Choose a new password for your account." footer={<>Back to <Link to="/login">Log in</Link></>}>
    <form className="auth-form" onSubmit={submit}>
      <div className="form-field"><label htmlFor="new-password">New password</label><PasswordInput id="new-password" name="new_password" autoComplete="new-password" required minLength={8} placeholder="Enter a new password" /></div>
      <div className="form-field"><label htmlFor="confirm-password">Confirm new password</label><PasswordInput id="confirm-password" name="confirm_password" autoComplete="new-password" required minLength={8} placeholder="Confirm new password" /></div>
      <button className="button button--primary button--full auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Updating...' : 'Update password'} <ArrowRight size={17} /></button>
      {message && <p className="form-status" role="alert">{message}</p>}
    </form>
  </AuthFrame>;
}

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState<'pending' | 'ok' | 'error'>('pending');
  const [message, setMessage] = useState('Verifying your email...');
  const navigate = useNavigate();
  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('Missing verification token. Use the link from your email.'); return; }
    verifyEmail(token)
      .then((res) => { setStatus('ok'); setMessage(res.message); setTimeout(() => navigate('/login', { replace: true, state: { verifiedMessage: res.message } }), 2000); })
      .catch((err) => { setStatus('error'); setMessage(err instanceof ApiError ? err.message : 'Verification failed. The link may be expired.'); });
  }, [token, navigate]);
  return <AuthFrame title="Verify your email" subtitle="Confirming your email address." footer={<>Go to <Link to="/login">Log in</Link></>}>
    <p className="form-status" role={status === 'error' ? 'alert' : 'status'}>{message}</p>
  </AuthFrame>;
}
