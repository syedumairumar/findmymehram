import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Heart,
  X,
  MapPin,
  BriefcaseBusiness,
  SlidersHorizontal,
  ShieldCheck,
  Sparkles,
  Flag,
  Ban,
  ArrowRight,
  RefreshCw,
  Check,
  MessageCircle,
} from "lucide-react";
import { useApp } from "../store";
import type { Profile } from "../types";
import { message } from "../lib/supabase";
export default function Discover() {
  const a = useApp();
  const [profiles, setProfiles] = useState<Profile[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [matched, setMatched] = useState<Profile | null>(null),
    [filters, setFilters] = useState(false),
    [city, setCity] = useState(""),
    [age, setAge] = useState(60),
    [drag, setDrag] = useState(0),
    [reporting, setReporting] = useState(false),
    [reason, setReason] = useState("Harassment or inappropriate behaviour");
  const start = useRef<number | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProfiles(await a.discover());
      setError("");
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }, [a.demo, a.user]);
  useEffect(() => {
    void load();
  }, [load]);
  const visible = profiles.filter(
      (p) =>
        p.age <= age &&
        (!city || p.city.toLowerCase().includes(city.toLowerCase())),
    ),
    p = visible[0];
  const choose = useCallback(
    async (liked: boolean) => {
      if (!p || busy) return;
      setBusy(true);
      try {
        const result = await a.swipe(p.id, liked);
        setProfiles((prev) => prev.filter((x) => x.id !== p.id));
        if (result.matched) setMatched(p);
        else
          a.notify(
            liked
              ? "A little spark sent. We’ll let you know if it’s mutual."
              : "Profile passed. Your next connection is waiting.",
          );
      } catch (e) {
        a.notify(message(e));
      } finally {
        setDrag(0);
        setBusy(false);
      }
    },
    [p, busy, a],
  );
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        (e.target as HTMLElement).matches("input,select,textarea,button") ||
        matched ||
        reporting ||
        filters
      )
        return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        void choose(true);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        void choose(false);
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [choose, matched, reporting, filters]);
  return (
    <section className="discovery page-content">
      <div className="page-heading">
        <div>
          <span className="eyebrow">GOOD THINGS START WITH A HELLO</span>
          <h1>
            Find your <em>little spark.</em>
          </h1>
          <p>Shared roots. Different stories. A world of possibility.</p>
        </div>
        <button
          className="button outline small"
          onClick={() => setFilters(true)}
        >
          <SlidersHorizontal size={16} /> Preferences
        </button>
      </div>
      {error && (
        <div className="error-box">
          {error}
          <button className="text-button" onClick={() => void load()}>
            Try again
          </button>
        </div>
      )}
      <div className="discovery-layout">
        <div className="deck-area">
          {loading ? (
            <div className="profile-skeleton">
              <span className="spinner" /> Finding your next connection…
            </div>
          ) : p ? (
            <>
              <div className="deck-shadow shadow-two" />
              <div className="deck-shadow shadow-one" />
              <article
                className="discovery-card"
                style={{
                  transform: `translateX(${drag / 3}px) rotate(${drag / 35}deg)`,
                }}
                onPointerDown={(e) => {
                  if ((e.target as HTMLElement).closest("button,a")) return;
                  start.current = e.clientX;
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (start.current !== null)
                    setDrag(e.clientX - start.current);
                }}
                onPointerUp={(e) => {
                  const distance =
                    start.current === null ? 0 : e.clientX - start.current;
                  start.current = null;
                  if (Math.abs(distance) > 85) void choose(distance > 0);
                  else setDrag(0);
                }}
                onPointerCancel={() => {
                  start.current = null;
                  setDrag(0);
                }}
              >
                <div className="discovery-photo">
                  {p.photo ? (
                    <img
                      src={p.photo}
                      draggable={false}
                      alt={`${p.name}, ${p.age}`}
                    />
                  ) : (
                    <div className="photo-placeholder">{p.name[0]}</div>
                  )}
                  <span className="photo-label">
                    <span className="green-dot" />
                    {a.mode === "demo" ? "FICTIONAL PROFILE" : "MEMBER PROFILE"}
                  </span>
                  <div className="photo-bottom">
                    <span>{p.intention}</span>
                    <h2>
                      {p.name}, {p.age}
                    </h2>
                    <p>
                      <MapPin size={15} />
                      {p.city}
                    </p>
                  </div>
                  {Math.abs(drag) > 35 && (
                    <div className={`swipe-label ${drag > 0 ? "yes" : "no"}`}>
                      {drag > 0 ? "LIKE" : "PASS"}
                    </div>
                  )}
                </div>
                <div className="discovery-details">
                  <div className="card-topline">
                    <span className="eyebrow">
                      A LITTLE ABOUT {p.name.toUpperCase()}
                    </span>
                    <Sparkles size={19} />
                  </div>
                  <h3>
                    More than
                    <br />a first impression.
                  </h3>
                  <p className="profile-bio">“{p.bio}”</p>
                  <div className="profile-fact">
                    <BriefcaseBusiness size={17} />
                    <span>{p.profession}</span>
                  </div>
                  <div className="profile-fact">
                    <MessageCircle size={17} />
                    <span>{p.languages.join(" · ")}</span>
                  </div>
                  <div className="interests">
                    {p.interests.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                  <div className="profile-card-footer">
                    <span>
                      <ShieldCheck size={14} /> Connect at your own pace
                    </span>
                    <button
                      className="icon-button"
                      aria-label="Report profile"
                      onClick={() => setReporting(true)}
                    >
                      <Flag size={15} />
                    </button>
                  </div>
                </div>
              </article>
              <div className="swipe-actions">
                <button
                  className="pass-button"
                  onClick={() => void choose(false)}
                  disabled={busy}
                  aria-label={`Pass on ${p.name}`}
                >
                  <X size={28} />
                </button>
                <div>
                  <span>See a little possibility?</span>
                  <small>
                    ← pass <i /> like →
                  </small>
                </div>
                <button
                  className="like-button"
                  onClick={() => void choose(true)}
                  disabled={busy}
                  aria-label={`Like ${p.name}`}
                >
                  <Heart size={28} />
                </button>
              </div>
            </>
          ) : (
            <div className="empty-state deck-empty">
              <span className="empty-icon">
                <Heart size={35} strokeWidth={1.2} />
              </span>
              <h2>
                A little pause.
                <br />
                More possibilities ahead.
              </h2>
              <p>
                {city || age < 60
                  ? "Try widening your preferences to meet more people."
                  : "You’ve met everyone in this selection. Check back as the community grows."}
              </p>
              <button
                className="button outline"
                onClick={() => {
                  setCity("");
                  setAge(60);
                  void load();
                }}
              >
                <RefreshCw size={16} /> Refresh discovery
              </button>
              {a.mode === "demo" && (
                <small>
                  To restart fictional profiles, use “Reset demo” in My profile.
                </small>
              )}
            </div>
          )}
        </div>
        <aside className="discovery-aside">
          <div className="thought-card">
            <span className="thought-flower">✳</span>
            <span className="eyebrow">A THOUGHT TO TAKE WITH YOU</span>
            <h3>
              The best connections
              <br />
              start with being
              <br />
              <em>yourself.</em>
            </h3>
            <div className="thought-rule" />
            <p>
              You don’t need the perfect opening line. A little curiosity goes a
              long way.
            </p>
          </div>
          <div className="connection-list">
            <div className="aside-title">
              <h3>Your connections</h3>
              <Link to="/messages" aria-label="View conversations">
                <ArrowRight size={17} />
              </Link>
            </div>
            {a.matches.length ? (
              a.matches.slice(0, 3).map((m) => (
                <Link
                  key={m.id}
                  className="connection-row"
                  to={`/messages?match=${m.id}`}
                >
                  <span className="avatar">
                    <img src={m.profile.photo} alt="" />
                  </span>
                  <div>
                    <b>{m.profile.name}</b>
                    <small>
                      {m.last_message ?? "You matched. Say a little hello."}
                    </small>
                  </div>
                  <span className="connection-dot" />
                </Link>
              ))
            ) : (
              <p className="muted">
                Your mutual connections will appear here. Every story starts
                somewhere.
              </p>
            )}
          </div>
          <p className="safety-note">
            <ShieldCheck size={16} />
            <span>
              Your comfort comes first. You can block or report a profile at any
              time.
            </span>
          </p>
        </aside>
      </div>
      {matched && (
        <div className="modal-backdrop">
          <section
            className="modal match-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="match-title"
          >
            <button
              className="modal-close icon-button"
              onClick={() => setMatched(null)}
              aria-label="Close match"
            >
              <X />
            </button>
            <span className="eyebrow">A LITTLE SPARK. A NEW POSSIBILITY.</span>
            <div className="match-portraits">
              <img src={a.me?.photo} alt="You" />
              <span>
                <Heart size={25} />
              </span>
              <img src={matched.photo} alt={matched.name} />
            </div>
            <h2 id="match-title">
              The feeling’s <em>mutual.</em>
            </h2>
            <p>
              You and {matched.name} liked each other.
              <br />
              Your story could start with a hello.
            </p>
            <Link
              to="/messages"
              className="button primary full"
              onClick={() => setMatched(null)}
            >
              Say hello <MessageCircle size={17} />
            </Link>
            <button className="text-button" onClick={() => setMatched(null)}>
              Keep discovering
            </button>
          </section>
        </div>
      )}
      {filters && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="preferences-title"
          >
            <button
              className="modal-close icon-button"
              onClick={() => setFilters(false)}
              aria-label="Close preferences"
            >
              <X />
            </button>
            <h2 id="preferences-title">
              A little more <em>you.</em>
            </h2>
            <p>
              Refine the current selection. More people means more
              possibilities.
            </p>
            <label>
              City or region
              <input
                placeholder="e.g. London"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </label>
            <label>
              Maximum age: {age}
              <input
                type="range"
                min={18}
                max={80}
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
              />
            </label>
            <button
              className="button primary full"
              onClick={() => setFilters(false)}
            >
              Apply preferences <Check size={17} />
            </button>
          </section>
        </div>
      )}
      {reporting && p && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-title"
          >
            <button
              className="modal-close icon-button"
              onClick={() => setReporting(false)}
              aria-label="Close report"
            >
              <X />
            </button>
            <h2 id="report-title">Your comfort matters.</h2>
            <label>
              Report reason
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <option>Harassment or inappropriate behaviour</option>
                <option>Suspected fake profile or scam</option>
                <option>Possible underage member</option>
                <option>Inappropriate photo or content</option>
                <option>Other safety concern</option>
              </select>
            </label>
            <button
              className="button primary full"
              onClick={async () => {
                try {
                  await a.report(p.id, reason);
                  setReporting(false);
                } catch (e) {
                  a.notify(message(e));
                }
              }}
            >
              <Flag size={16} /> Submit report
            </button>
            <button
              className="button outline full"
              onClick={async () => {
                try {
                  await a.block(p.id);
                  setProfiles((prev) => prev.filter((x) => x.id !== p.id));
                  setReporting(false);
                } catch (e) {
                  a.notify(message(e));
                }
              }}
            >
              <Ban size={16} /> Block this member
            </button>
          </section>
        </div>
      )}
    </section>
  );
}
