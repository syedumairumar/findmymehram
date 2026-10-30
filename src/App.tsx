import { lazy, Suspense, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  ArrowRight,
  Heart,
  Sparkles,
  ShieldCheck,
  Menu,
  X,
  Compass,
  MessageCircle,
  Crown,
  UserRound,
  LayoutDashboard,
  LogOut,
  MapPin,
  ChevronRight,
  LockKeyhole,
  CircleHelp,
} from "lucide-react";
import { useApp } from "./store";
import { backend, message, supabase } from "./lib/supabase";
import { portraits } from "./lib/demo";
import Discover from "./pages/Discover";
import {
  Likes,
  MembershipPage,
  ProfilePage,
  SecurityPage,
  PolicyPage,
} from "./pages/Account";
import Messages from "./pages/Messages";
const Admin = lazy(() => import("./pages/Admin"));

export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="Find My Mehram home">
      <span className="brand-mark">
        <Heart size={21} strokeWidth={1.6} />
        <i />
      </span>
      <span>
        find my <b>mehram</b>
        <small>ROOTED IN CONNECTION</small>
      </span>
    </Link>
  );
}
function Header() {
  const a = useApp(),
    [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  return (
    <header className="site-header">
      <div className="header-inner">
        <Brand />
        <nav className="desktop-nav">
          <Link to="/#how-it-works">How it works</Link>
          <Link to="/membership">Memberships</Link>
          <Link to="/policies/safety">Your safety</Link>
        </nav>
        <div className="header-actions">
          {a.mode === "guest" ? (
            <>
              <Link className="login-link" to="/auth">
                Log in
              </Link>
              <Link className="button primary small" to="/auth?mode=signup">
                Find your person <ArrowRight size={15} />
              </Link>
            </>
          ) : (
            <>
              <span className="mode-pill">
                {a.mode === "demo" ? "Demo experience" : "Private test"}
              </span>
              <Link
                className="avatar tiny"
                to="/profile"
                aria-label="Your profile"
              >
                {a.me?.photo ? (
                  <img src={a.me.photo} alt="" />
                ) : (
                  <UserRound size={18} />
                )}
              </Link>
            </>
          )}
          <button
            className="icon-button mobile-menu"
            onClick={() => setOpen(!open)}
            aria-label="Open navigation"
            aria-expanded={open}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="mobile-nav">
          <Link to="/discover">Discover</Link>
          <Link to="/membership">Memberships</Link>
          <Link to="/policies/safety">Safety</Link>
          <Link to="/profile">My profile</Link>
          <Link to="/security">Security</Link>
          {a.admin && <Link to="/admin">Admin portal</Link>}
        </nav>
      )}
    </header>
  );
}
const navItems = [
  ["/discover", "Discover", Compass],
  ["/likes", "Likes you", Heart],
  ["/messages", "Conversations", MessageCircle],
  ["/membership", "Membership", Crown],
  ["/profile", "My profile", UserRound],
  ["/security", "Security", ShieldCheck],
] as const;
function Shell({ children }: { children: ReactNode }) {
  const a = useApp();
  if (!a.ready) return <div className="loading">Getting things ready…</div>;
  if (a.mode === "guest") return <Navigate to="/auth" replace />;
  if (
    a.mode === "backend" &&
    !a.me &&
    !["/profile", "/security"].includes(location.pathname)
  )
    return <Navigate to="/profile" replace />;
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-intro">
          <span className="eyebrow">YOUR NEXT CHAPTER</span>
          <p>
            A little closer
            <br />
            to your person.
          </p>
        </div>
        <nav>
          {navItems.map(([url, title, Icon]) => (
            <NavLink key={url} to={url}>
              <Icon size={20} />
              <span>{title}</span>
              {url === "/messages" && a.matches.length > 0 && (
                <b className="nav-count">{a.matches.length}</b>
              )}
            </NavLink>
          ))}
          {a.admin && (
            <NavLink to="/admin">
              <LayoutDashboard size={20} />
              <span>Admin portal</span>
            </NavLink>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="mini-membership">
            <Crown size={20} />
            <div>
              <b>{a.membership.tier} member</b>
              <Link to="/membership">
                Explore your benefits <ChevronRight size={12} />
              </Link>
            </div>
          </div>
          <button
            className="text-button muted"
            onClick={() => void a.signOut()}
          >
            <LogOut size={17} /> Log out
          </button>
        </div>
      </aside>
      <main className="app-main">
        {a.mode === "demo" && (
          <div className="demo-strip">
            <Sparkles size={14} />
            <span>
              Demo mode · Fictional profiles and browser-local data. No real
              payments or messages.
            </span>
            <Link to="/auth?mode=signup">
              Create a real account <ArrowRight size={13} />
            </Link>
          </div>
        )}
        {children}
      </main>
      <nav className="bottom-nav">
        {navItems.slice(0, 5).map(([url, title, Icon]) => (
          <NavLink key={url} to={url} aria-label={title}>
            <Icon size={21} />
            <span>
              {title === "Conversations"
                ? "Chats"
                : title === "Membership"
                  ? "Plans"
                  : title}
            </span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
function Landing() {
  const a = useApp(),
    navigate = useNavigate();
  return (
    <>
      <main className="landing">
        <section className="hero">
          <div className="hero-copy">
            <div className="hero-kicker">
              <span /> SHARED CULTURE. REAL CONNECTION.
            </div>
            <h1>
              Shared roots.
              <br />
              New <em>beginnings.</em>
            </h1>
            <p className="hero-description">
              Someone who gets your world.
              <br />
              And wants to build a new one with you.
            </p>
            <p className="hero-support">
              Thoughtful connections for the Pakistani and Indian community. A
              little less small talk. A little more meaning.
            </p>
            <div className="hero-actions">
              <Link
                className="button primary"
                to={a.mode === "guest" ? "/auth?mode=signup" : "/discover"}
              >
                Find your person <ArrowRight size={18} />
              </Link>
              <button
                className="text-button"
                onClick={() => {
                  a.startDemo();
                  navigate("/discover");
                }}
              >
                Explore the demo <span>↗</span>
              </button>
            </div>
            <div className="hero-trust">
              <ShieldCheck size={17} />
              <span>18+ community</span>
              <i />
              <span>Privacy comes first</span>
            </div>
          </div>
          <div className="hero-art">
            <div className="art-ring ring-one" />
            <div className="art-ring ring-two" />
            <span className="art-flower">✳</span>
            <span className="art-spark">✧</span>
            <div className="floating-note">
              <span className="note-heart">
                <Heart size={17} />
              </span>
              <div>
                It starts with a little hello.
                <small>And a shared love of chai.</small>
              </div>
            </div>
            <div className="hero-profile back">
              <img
                src={portraits.omar}
                alt="Illustrative stock portrait for a fictional profile"
              />
              <div className="hero-profile-caption">
                <b>Omar, 29</b>
                <span>London · Entrepreneur</span>
              </div>
            </div>
            <div className="hero-profile front">
              <img
                src={portraits.zara}
                alt="Illustrative stock portrait for fictional profile Zara"
              />
              <div className="hero-card-top">
                <span>
                  <span className="green-dot" /> FICTIONAL PROFILE
                </span>
                <Heart size={20} />
              </div>
              <div className="hero-profile-caption">
                <span className="profile-intent">
                  LOOKING FOR SOMETHING REAL
                </span>
                <b>
                  Zara, 27 <Sparkles size={19} />
                </b>
                <span>
                  <MapPin size={13} /> London, UK
                </span>
                <div className="hero-tags">
                  <span>Architecture</span>
                  <span>Chai enthusiast</span>
                </div>
              </div>
            </div>
            <div className="connection-note">
              <span>♥</span>
              <div>
                A connection that feels
                <br />
                <em>like home.</em>
              </div>
            </div>
          </div>
        </section>
        <div className="roots-strip">
          <span>FOR THE LITTLE THINGS THAT CONNECT US</span>
          <div>
            <b>Shared values</b>
            <i>✦</i>
            <b>Family stories</b>
            <i>✦</i>
            <b>Big ambitions</b>
            <i>✦</i>
            <b>That familiar feeling</b>
          </div>
        </div>
        <section className="how-section" id="how-it-works">
          <div className="section-heading">
            <span className="eyebrow">LESS GUESSWORK. MORE POSSIBILITY.</span>
            <h2>Your story starts simply.</h2>
            <p>Bring your whole self. We’ll make the introductions.</p>
          </div>
          <div className="steps-grid">
            {[
              {
                icon: UserRound,
                title: "Be wonderfully you",
                body: "A profile that goes beyond a photo. Share your story, your values, and the things that make you smile.",
              },
              {
                icon: Heart,
                title: "Find a little spark",
                body: "Meet people with shared roots and their own stories. Like a profile. See where a mutual connection leads.",
              },
              {
                icon: MessageCircle,
                title: "Make it meaningful",
                body: "From the first hello to a video call. Take the time to get to know each other, at your own pace.",
              },
            ].map((s, i) => (
              <article className="step-card" key={s.title}>
                <span className="step-icon">
                  <s.icon size={23} />
                </span>
                <small>0{i + 1}</small>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="safety-banner">
          <div className="safety-art">
            <ShieldCheck size={64} strokeWidth={1} />
            <span>✧</span>
          </div>
          <div>
            <span className="eyebrow">A LITTLE PEACE OF MIND</span>
            <h2>Your story. Your boundaries.</h2>
            <p>
              Private conversations after you match. Easy blocking and
              reporting.
              <br />
              You choose what to share, and when.
            </p>
          </div>
          <Link className="button outline" to="/policies/safety">
            Our approach to safety <ArrowRight size={17} />
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
function Footer() {
  return (
    <footer className="site-footer">
      <Brand />
      <div>
        <Link to="/policies/terms">Terms</Link>
        <Link to="/policies/privacy">Privacy</Link>
        <Link to="/policies/cookies">Cookies</Link>
        <Link to="/policies/safety">Safety</Link>
      </div>
      <small>
        Made for meaningful beginnings. © {new Date().getFullYear()} Find My
        Mehram.
      </small>
      <p className="fine-print">
        Private test release · Adults 18+ · All example profiles are fictional;
        portraits are illustrative stock images.
      </p>
    </footer>
  );
}
function Auth() {
  const a = useApp(),
    nav = useNavigate(),
    loc = useLocation();
  const mode = new URLSearchParams(loc.search).get("mode") ?? "login",
    signup = mode === "signup",
    reset = mode === "reset",
    update = mode === "update";
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [adult, setAdult] = useState(false),
    [terms, setTerms] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  useEffect(() => {
    setError("");
    setSuccess("");
  }, [mode]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const client = backend();
      if (signup) {
        if (a.demo) await a.signOut();
        if (!adult || !terms)
          throw new Error(
            "Confirm you are 18 or older and accept the test terms.",
          );
        const { error } = await client.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${location.origin}/profile`,
            data: { adult_attestation: true, terms_version: "test-2026-10-30" },
          },
        });
        if (error) throw error;
        setSuccess(
          "Check your email to verify your account, then complete your profile.",
        );
      } else if (reset) {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}/auth?mode=update`,
        });
        if (error) throw error;
        setSuccess(
          "If an account exists for that address, a reset link will be sent.",
        );
      } else if (update) {
        if (!a.user)
          throw new Error("Open the reset link from your email first.");
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        setSuccess("Password updated.");
      } else {
        if (a.demo) await a.signOut();
        const { error } = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        const { data } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
        nav(
          data?.nextLevel === "aal2" && data.currentLevel !== "aal2"
            ? "/security?verify=true"
            : "/discover",
        );
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function social(provider: "google" | "facebook") {
    setError("");
    try {
      if (
        import.meta.env[`VITE_${provider.toUpperCase()}_AUTH_ENABLED`] !==
        "true"
      )
        throw new Error(
          `${provider === "google" ? "Google" : "Facebook"} sign-in needs provider configuration. Email sign-in and the demo are available.`,
        );
      if (a.demo) await a.signOut();
      const { error } = await backend().auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${location.origin}/profile` },
      });
      if (error) throw error;
    } catch (e) {
      setError(message(e));
    }
  }
  return (
    <main className="auth-page">
      <div className="auth-story">
        <span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>
        <h1>
          A familiar feeling.
          <br />A whole new <em>story.</em>
        </h1>
        <p>
          Someone who understands where you come from.
          <br />
          And is excited about where you’re going.
        </p>
        <div className="auth-visual">
          <img src={portraits.zara} alt="Illustrative fictional profile" />
          <div>
            <Heart size={30} />
            <span>Rooted in connection.</span>
          </div>
        </div>
      </div>
      <section className="auth-card">
        <span className="auth-symbol">
          <Heart size={25} />
        </span>
        <h2>
          {signup
            ? "A little hello. A new beginning."
            : reset
              ? "Let’s get you back in."
              : update
                ? "A fresh start."
                : "Welcome back."}
        </h2>
        <p>
          {signup
            ? "Create your account and tell your story."
            : reset
              ? "We’ll send a secure password-reset link."
              : update
                ? "Choose a strong, unique password."
                : "Your next chapter is waiting for you."}
        </p>
        {!supabase && (
          <div className="info-box">
            <CircleHelp size={18} />
            <span>
              Account services are not configured in this preview. Explore the
              demo below, or follow the local setup guide.
            </span>
          </div>
        )}
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        {success && (
          <div className="success-box" role="status">
            {success}
          </div>
        )}
        <form onSubmit={submit}>
          {!update && (
            <label>
              Email address
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                maxLength={254}
              />
            </label>
          )}
          {!reset && (
            <label>
              Password
              <input
                type="password"
                autoComplete={
                  signup || update ? "new-password" : "current-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={signup || update ? 12 : 1}
                maxLength={128}
                placeholder={
                  signup ? "At least 12 characters" : "Your password"
                }
              />
            </label>
          )}
          {signup && (
            <>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={adult}
                  onChange={(e) => setAdult(e.target.checked)}
                  required
                />
                <span>I am at least 18 years old.</span>
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={terms}
                  onChange={(e) => setTerms(e.target.checked)}
                  required
                />
                <span>
                  I accept the <Link to="/policies/terms">test Terms</Link> and
                  have read the{" "}
                  <Link to="/policies/privacy">Privacy Notice</Link>.
                </span>
              </label>
            </>
          )}
          <button className="button primary full" disabled={busy}>
            {busy
              ? "One moment…"
              : signup
                ? "Create account"
                : reset
                  ? "Send reset link"
                  : update
                    ? "Update password"
                    : "Log in"}
            <ArrowRight size={17} />
          </button>
        </form>
        {!reset && !update && (
          <>
            <div className="or-divider">
              <span>or continue with</span>
            </div>
            <div className="social-buttons">
              <button
                className="button outline"
                onClick={() => void social("google")}
              >
                <b className="google-g">G</b> Google
              </button>
              <button
                className="button outline"
                onClick={() => void social("facebook")}
              >
                <b className="facebook-f">f</b> Facebook
              </button>
            </div>
            <p className="auth-switch">
              {signup
                ? "Already part of the community?"
                : "New beginnings start here."}{" "}
              <Link to={signup ? "/auth" : "/auth?mode=signup"}>
                {signup ? "Log in" : "Join us"}
              </Link>
            </p>
            {!signup && (
              <Link className="forgot-link" to="/auth?mode=reset">
                Forgot your password?
              </Link>
            )}
          </>
        )}
        <button
          className="demo-entry text-button"
          onClick={() => {
            a.startDemo();
            nav("/discover");
          }}
        >
          Just looking? Explore the demo <ArrowRight size={15} />
        </button>
        <small className="auth-security">
          <LockKeyhole size={12} /> Your information deserves care.
        </small>
      </section>
    </main>
  );
}
export default function App() {
  const a = useApp(),
    loc = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Header />
      <div id="main-content">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/discover"
            element={
              <Shell>
                <Discover />
              </Shell>
            }
          />
          <Route
            path="/likes"
            element={
              <Shell>
                <Likes />
              </Shell>
            }
          />
          <Route
            path="/messages"
            element={
              <Shell>
                <Messages />
              </Shell>
            }
          />
          <Route
            path="/membership"
            element={
              a.mode === "guest" ? (
                <>
                  <MembershipPage />
                  <Footer />
                </>
              ) : (
                <Shell>
                  <MembershipPage />
                </Shell>
              )
            }
          />
          <Route
            path="/profile"
            element={
              <Shell>
                <ProfilePage />
              </Shell>
            }
          />
          <Route
            path="/security"
            element={
              <Shell>
                <SecurityPage />
              </Shell>
            }
          />
          <Route
            path="/admin"
            element={
              <Shell>
                <Suspense
                  fallback={<div className="loading">Loading dashboard…</div>}
                >
                  <Admin />
                </Suspense>
              </Shell>
            }
          />
          <Route
            path="/policies/:kind"
            element={
              <>
                <PolicyPage />
                <Footer />
              </>
            }
          />
          <Route
            path="*"
            element={
              <main className="empty-state">
                <h1>A little off the path.</h1>
                <p>We couldn’t find that page.</p>
                <Link to="/" className="button primary">
                  Go home
                </Link>
              </main>
            }
          />
        </Routes>
      </div>
      {a.notice && (
        <div className="toast" role="status">
          <ShieldCheck size={18} />
          {a.notice}
          <button
            onClick={() => a.notify("")}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}
