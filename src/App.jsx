import { useEffect, useState } from "react";
import "./App.css";

const slides = [
  {
    src: "/images/auditorium.webp",
    alt: "Students attending an event in a university auditorium",
    title: "Find the right space for your next event.",
    text: "Discover campus venues and keep your event plans in one place.",
  },
  {
    src: "/images/seminar-room.webp",
    alt: "A seminar room prepared for a student event",
    title: "Make room for great ideas.",
    text: "Find a space that suits your meeting, seminar, or activity.",
  },
  {
    src: "/images/club-meeting.webp",
    alt: "Students meeting together on campus",
    title: "Bring your campus community together.",
    text: "UniSpot helps student organizers plan their next gathering.",
  },
];

function App() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [isLogin, setIsLogin] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Do not auto-rotate images when the user prefers reduced motion.
    if (prefersReducedMotion) return undefined;

    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % slides.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, []);

  function handleSubmit(event) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const password = formData.get("password");
    const confirmPassword = formData.get("confirmPassword");

    if (!isLogin && password !== confirmPassword) {
      setMessage("Your passwords do not match. Please check them and try again.");
      return;
    }

    setMessage(
      isLogin
        ? "The login form is ready, but authentication is not connected to the backend yet."
        : "The signup form is ready, but account creation is not connected to the backend yet."
    );
  }

  function switchForm() {
    setIsLogin((current) => !current);
    setMessage("");
  }

  return (
    <main className="signup-layout">
      <section className="photo-panel" aria-label="UniSpot campus venues">
        {slides.map((slide, index) => (
          <img
            key={slide.src}
            className={`photo-slide ${index === activeSlide ? "active" : ""}`}
            style={{ zIndex: index === activeSlide ? 1 : 0 }}
            src={slide.src}
            alt={index === activeSlide ? slide.alt : ""}
            aria-hidden={index !== activeSlide}
          />
        ))}

        <div className="photo-shade" />

        <div className="photo-copy">
          <div className="brand-mark">UniSpot</div>
          <p className="eyebrow">KISII UNIVERSITY</p>
          <h1>{slides[activeSlide].title}</h1>
          <p className="photo-description">{slides[activeSlide].text}</p>

          <div className="slide-controls" role="group" aria-label="Choose a photo">
            {slides.map((slide, index) => (
              <button
                key={slide.src}
                className={`slide-dot ${index === activeSlide ? "selected" : ""}`}
                type="button"
                aria-label={`Show photo ${index + 1}`}
                aria-pressed={index === activeSlide}
                onClick={() => setActiveSlide(index)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="form-panel">
        <div className="signup-card">
          <p className="eyebrow form-eyebrow">
            {isLogin ? "WELCOME BACK" : "CREATE YOUR ACCOUNT"}
          </p>

          <h2>{isLogin ? "Welcome back" : "Join UniSpot"}</h2>

          <p className="form-intro">
            {isLogin
              ? "Log in to manage your venue booking requests."
              : "Create an account to find venues and manage your booking requests."}
          </p>

          <form onSubmit={handleSubmit}>
            {!isLogin && (
              <>
                <label htmlFor="fullName">Full name</label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  autoComplete="name"
                  required
                />
              </>
            )}

            <label htmlFor="email">University email</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@university.ac.ke"
              autoComplete={isLogin ? "username" : "email"}
              required
            />

            {!isLogin && (
              <>
                <label htmlFor="organization">Club or organization</label>
                <input
                  id="organization"
                  name="organization"
                  type="text"
                  placeholder="Enter your club or organization"
                  required
                />
              </>
            )}

            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder={isLogin ? "Enter your password" : "At least 8 characters"}
              autoComplete={isLogin ? "current-password" : "new-password"}
              minLength={8}
              required
            />

            {!isLogin && (
              <>
                <label htmlFor="confirmPassword">Confirm password</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Enter your password again"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </>
            )}

            <button className="signup-button" type="submit">
              {isLogin ? "Log in" : "Create account"}
            </button>

            <p className="login-prompt">
              {isLogin ? "New to UniSpot?" : "Already have an account?"}{" "}
              <button className="text-link" type="button" onClick={switchForm}>
                {isLogin ? "Create account" : "Log in"}
              </button>
            </p>

            {message && (
              <p className="form-message" role="status">
                {message}
              </p>
            )}
          </form>

          {!isLogin && (
            <p className="account-note">
              Your account permissions will be set by the system—not by this form.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

export default App;
