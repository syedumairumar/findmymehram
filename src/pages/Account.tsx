import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Heart,
  ArrowRight,
  Crown,
  Check,
  LockKeyhole,
  ShieldCheck,
  KeyRound,
  Download,
  RefreshCw,
  Upload,
  CreditCard,
  X,
} from "lucide-react";
import { useApp } from "../store";
import { backend, message, rpc } from "../lib/supabase";
import { canSeeLikes, download } from "../lib/domain";
import { assertCheckoutUrl } from "../lib/billing";
import type { Profile, Tier } from "../types";

export function Likes() {
  const a = useApp();
  const [data, setData] = useState<{ count: number; profiles: Profile[] }>({
      count: 0,
      profiles: [],
    }),
    [error, setError] = useState("");
  useEffect(() => {
    a.likes()
      .then(setData)
      .catch((e) => setError(message(e)));
  }, [a.demo, a.user, a.membership.tier]);
  return (
    <section className="page-content">
      <div className="page-heading">
        <div>
          <span className="eyebrow">A LITTLE CURIOSITY GOES BOTH WAYS</span>
          <h1>
            Someone sees <em>a spark.</em>
          </h1>
          <p>
            {data.count} {data.count === 1 ? "person has" : "people have"} liked
            your profile.
          </p>
        </div>
      </div>
      {error && <div className="error-box">{error}</div>}
      {!canSeeLikes(a.membership.tier) ? (
        <div className="likes-locked">
          <div className="abstract-likes">
            {[1, 2, 3].map((n) => (
              <div key={n}>
                <UserSilhouette />
              </div>
            ))}
            <span>
              <LockKeyhole size={26} />
            </span>
          </div>
          <h2>
            A few people would love
            <br />
            to get to know you.
          </h2>
          <p>
            See who’s already interested with Gold or Diamond.
            <br />
            You can always discover and match for free.
          </p>
          <Link to="/membership" className="button primary">
            Meet your admirers <Crown size={17} />
          </Link>
          <small>
            Their identities stay private until your membership allows access.
          </small>
        </div>
      ) : (
        <div className="likes-grid">
          {data.profiles.length ? (
            data.profiles.map((p) => (
              <article className="like-card" key={p.id}>
                <img src={p.photo} alt={p.name} />
                <div>
                  <h3>
                    {p.name}, {p.age}
                  </h3>
                  <p>{p.city}</p>
                  <button
                    className="button primary small"
                    onClick={async () => {
                      try {
                        await a.swipe(p.id, true);
                        setData({
                          count: data.count - 1,
                          profiles: data.profiles.filter((x) => x.id !== p.id),
                        });
                        a.notify(
                          "It’s a match! Find your connection in Conversations.",
                        );
                      } catch (e) {
                        a.notify(message(e));
                      }
                    }}
                  >
                    Like back <Heart size={15} />
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-state">
              <Heart size={32} />
              <h2>Good things take a little time.</h2>
              <p>Your incoming likes will appear here.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
function UserSilhouette() {
  return (
    <svg viewBox="0 0 100 140" aria-hidden="true">
      <circle cx="50" cy="46" r="24" />
      <path d="M5 140v-20c0-52 90-52 90 0v20" />
    </svg>
  );
}
const plans: {
  tier: Tier;
  name: string;
  price: string;
  tag: string;
  features: string[];
}[] = [
  {
    tier: "free",
    name: "Free",
    price: "£0",
    tag: "Every story starts somewhere.",
    features: [
      "25 likes each day",
      "Discover and create matches",
      "Chat after matching",
      "Audio & video after matching",
      "Blocking and reporting",
    ],
  },
  {
    tier: "gold",
    name: "Gold",
    price: "£9.99",
    tag: "A little more possibility.",
    features: [
      "100 likes each day",
      "See who likes you",
      "Everything in Free",
      "Priority support requests",
    ],
  },
  {
    tier: "diamond",
    name: "Diamond",
    price: "£19.99",
    tag: "Make room for something special.",
    features: [
      "250 likes each day",
      "See who likes you",
      "Everything in Gold",
      "More ways to discover",
    ],
  },
];
export function MembershipPage() {
  const a = useApp(),
    nav = useNavigate(),
    location = useLocation();
  const [selected, setSelected] = useState<Tier | null>(null),
    [busy, setBusy] = useState(false);
  const paymentsEnabled = import.meta.env.VITE_PAYMENTS_ENABLED === "true";
  const [billing, setBilling] = useState<{
    provider: string; tier: string; status: string; paid_until: string | null;
    cancel_at_period_end: boolean; environment: string;
  } | null>(null);
  const [billingError, setBillingError] = useState("");
  async function loadBilling(sync = false, returning = false) {
    if (a.mode !== "backend" || !paymentsEnabled || !a.me) return false;
    setBusy(true);
    try {
      const {data,error} = await backend().functions.invoke("billing", {body:{action:sync ? "sync" : "status"}});
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setBilling(data?.subscription ?? null);
      setBillingError("");
      if (sync) await a.refresh();
      const settled = Boolean(data?.subscription?.paid_until && Date.parse(data.subscription.paid_until) > Date.now());
      if (returning && settled) nav("/membership", {replace: true});
      return settled;
    } catch(e) {
      setBillingError(returning ? "We’re confirming your test payment. If this takes longer, use Refresh billing status." : message(e));
      return false;
    }
    finally {setBusy(false);}
  }
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const returning = new URLSearchParams(location.search).get("checkout") === "pending";
    async function update(attempt = 0) {
      const settled = await loadBilling(returning, returning);
      if (!disposed && returning && !settled && attempt < 5) {
        timer = setTimeout(() => void update(attempt + 1), 5000);
      }
    }
    void update();
    return () => {disposed = true; if (timer) clearTimeout(timer);};
  }, [a.mode, a.me?.id, location.search]);
  async function checkout(provider: "stripe" | "paypal") {
    if (!selected || selected === "free") return;
    if (a.mode === "demo") {
      a.notify(
        "This is a browser-only demo. Use the labelled preview control to explore a tier; no payment is processed.",
      );
      return;
    }
    if (import.meta.env.VITE_PAYMENTS_ENABLED !== "true") {
      a.notify(
        "Sandbox checkout needs the payment server and provider sandbox credentials. No charge has been made.",
      );
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await backend().functions.invoke("billing", {
        body: { action: "checkout", provider, tier: selected },
      });
      if (error) throw error;
      if (!data?.url)
        throw new Error(data?.error ?? "Checkout could not start.");
      window.location.assign(assertCheckoutUrl(data.url));
    } catch (e) {
      a.notify(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="page-content membership-page">
      <div className="section-heading">
        <span className="eyebrow">YOUR PACE. YOUR POSSIBILITIES.</span>
        <h1>
          A little more <em>connection.</em>
        </h1>
        <p>
          A meaningful beginning is always free. Choose a little extra when
          you’re ready.
        </p>
      </div>
      <div className="sandbox-note">
        <ShieldCheck size={16} />
        <span>
          Test release · Illustrative monthly sandbox prices · No live payments
        </span>
      </div>
      <div className="plans">
        {plans.map((p) => (
          <article
            key={p.tier}
            className={`plan-card ${p.tier === "gold" ? "featured" : ""}`}
          >
            {p.tier === "gold" && (
              <span className="popular">A LITTLE EXTRA POSSIBILITY</span>
            )}
            <span className={`plan-icon ${p.tier}`}>
              <Crown size={25} />
            </span>
            <h2>{p.name}</h2>
            <p>{p.tag}</p>
            <div className="plan-price">
              {p.price}
              <span>{p.tier === "free" ? "forever" : "/ month"}</span>
            </div>
            <small>
              {p.tier === "free"
                ? "No card required"
                : "Sandbox price · not a live offer"}
            </small>
            <ul>
              {p.features.map((f) => (
                <li key={f}>
                  <Check size={16} />
                  {f}
                </li>
              ))}
            </ul>
            <button
              className={`button full ${p.tier === "gold" ? "primary" : "outline"}`}
              onClick={() => {
                if (a.mode === "guest") {
                  nav("/auth?mode=signup");
                  return;
                }
                if (p.tier === "free") {
                  a.notify(
                    "Free discovery and matching are included. Use Billing to cancel an existing subscription.",
                  );
                  return;
                }
                setSelected(p.tier);
              }}
            >
              {a.membership.tier === p.tier && a.mode !== "guest"
                ? "Your current plan"
                : p.tier === "free"
                  ? "Start your story"
                  : `Explore ${p.name}`}
              <ArrowRight size={16} />
            </button>
            {a.mode === "demo" && (
              <button
                className="demo-plan text-button"
                onClick={() => {
                  if (a.demo) {
                    a.setDemo({ ...a.demo, tier: p.tier });
                    a.notify(
                      `${p.name} demo preview enabled. This is a local simulation, not a payment.`,
                    );
                  }
                }}
              >
                Preview {p.name} in demo
              </button>
            )}
          </article>
        ))}
      </div>
      <p className="plan-footnote">
        Safety features are available to everyone. Real subscriptions will
        require clear renewal terms and an easy cancellation route before
        launch.
      </p>
      {a.mode === "backend" && <section className="panel" aria-label="Your billing status">
        <h2>Your sandbox billing</h2>
        {!paymentsEnabled ? <p>Sandbox payments are awaiting provider setup and verified checkout tests.</p> : <>
          {billingError && <div className="error-box" role="alert">{billingError}</div>}
          {billing ? <dl className="billing-details">
            <dt>Plan</dt><dd>{billing.tier} · {billing.environment}</dd>
            <dt>Provider</dt><dd>{billing.provider}</dd>
            <dt>Subscription</dt><dd>{billing.status}{billing.cancel_at_period_end ? " · renewal stopped" : ""}</dd>
            <dt>Verified paid access</dt><dd>{billing.paid_until ? new Date(billing.paid_until).toLocaleString() : "No confirmed paid period"}</dd>
          </dl> : <p>No sandbox subscription yet. Approval and return pages do not grant premium access; the server verifies settlement.</p>}
          <button className="button outline" disabled={busy} onClick={() => void loadBilling(true)}><RefreshCw size={16}/> Refresh billing status</button>
        </>}
      </section>}
      {a.mode === "backend" && paymentsEnabled && billing && !["cancelled", "expired"].includes(billing.status) && (
        <button
          className="button outline"
          disabled={busy}
          onClick={async () => {
            if (!window.confirm("Stop this sandbox subscription renewing? Verified paid access continues until its paid-through date.")) return;
            setBusy(true);
            try {
              if (import.meta.env.VITE_PAYMENTS_ENABLED !== "true") {
                throw new Error(
                  "Sandbox cancellation needs the payment server and provider credentials.",
                );
              }
              const { data, error } = await backend().functions.invoke(
                "billing",
                { body: { action: "cancel" } },
              );
              if (error) throw error;
              if (data.error) throw new Error(data.error);
              a.notify(
                "Cancellation requested. Access continues to the verified paid-through date.",
              );
              await a.refresh();
              await loadBilling();
            } catch (e) {
              a.notify(message(e));
            } finally {setBusy(false);}
          }}
        >
          Cancel sandbox subscription
        </button>
      )}
      {selected && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-title"
          >
            <button
              className="icon-button modal-close"
              aria-label="Close checkout"
              onClick={() => setSelected(null)}
            >
              <X />
            </button>
            <span className="eyebrow">SANDBOX CHECKOUT</span>
            <h2 id="checkout-title">
              A little more <em>{selected}.</em>
            </h2>
            <p>
              Choose your test payment method. Use only provider-issued test
              cards or PayPal sandbox accounts.
            </p>
            {a.mode === "demo" && (
              <div className="info-box">
                This demo does not connect to payment providers. Use a real test
                account for genuine sandbox checkout.
              </div>
            )}
            <button
              className="button primary full"
              disabled={busy || a.mode === "demo"}
              onClick={() => void checkout("stripe")}
            >
              <CreditCard size={18} /> Test credit / debit card
            </button>
            <button
              className="button outline full"
              disabled={busy || a.mode === "demo"}
              onClick={() => void checkout("paypal")}
            >
              <b className="paypal-word">PayPal</b> Test PayPal subscription
            </button>
            <small>
              Payment confirmation comes from verified server callbacks, never
              the return URL.
            </small>
          </section>
        </div>
      )}
    </section>
  );
}

export function ProfilePage() {
  const a = useApp();
  const [form, setForm] = useState(
      a.me ?? {
        name: "",
        age: 18,
        city: "",
        profession: "",
        bio: "",
        interests: [],
        languages: [],
        intention: "A serious relationship",
        photo: "",
        gender: "not specified",
      },
    ),
    [birthDate, setBirthDate] = useState(""),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState(false),
    [confirmation, setConfirmation] = useState("");
  useEffect(() => {
    if (a.me) setForm(a.me);
  }, [a.me]);
  function field(name: string, value: unknown) {
    setForm((f) => ({ ...f, [name]: value }));
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await a.saveProfile(form, birthDate || undefined);
    } catch (e) {
      a.notify(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function photo(file: File | undefined) {
    if (!file) return;
    if (a.mode === "demo") {
      a.notify(
        "Demo profiles use illustrative stock photos. Personal photo uploads require a real test account.",
      );
      return;
    }
    if (
      file.size > 2 * 1024 * 1024 ||
      !["image/jpeg", "image/png"].includes(file.type)
    ) {
      a.notify("Choose a JPEG or PNG image smaller than 2 MB.");
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.set("photo", file);
      const { data, error } = await backend().functions.invoke("photo-upload", {
        body,
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      field("photo", data.path);
      a.notify("Photo sanitized and uploaded. Save your profile to use it.");
    } catch (e) {
      a.notify(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="page-content">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MORE THAN A FIRST IMPRESSION</span>
          <h1>
            Tell your <em>story.</em>
          </h1>
          <p>The little things make you, you.</p>
        </div>
        <Link to="/security" className="button outline small">
          <ShieldCheck size={16} /> Account security
        </Link>
      </div>
      <div className="settings-grid">
        <section className="panel">
          <form onSubmit={save}>
            <div className="profile-edit-photo">
              <span className="avatar large">
                {a.me?.photo ? (
                  <img src={a.me.photo} alt="Your profile" />
                ) : (
                  <Heart size={30} />
                )}
              </span>
              <div>
                <h3>Your profile photo</h3>
                <p>JPEG or PNG, up to 2 MB. Location metadata is removed.</p>
                <label className="upload-label">
                  <Upload size={15} /> Choose a photo
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={(e) => void photo(e.target.files?.[0])}
                  />
                </label>
              </div>
            </div>
            <div className="form-grid">
              <label>
                First name
                <input
                  value={form.name}
                  onChange={(e) => field("name", e.target.value)}
                  maxLength={60}
                  required
                />
              </label>
              <label>
                City / region
                <input
                  value={form.city}
                  onChange={(e) => field("city", e.target.value)}
                  maxLength={100}
                  required
                />
              </label>
              <label>
                Profession
                <input
                  value={form.profession}
                  onChange={(e) => field("profession", e.target.value)}
                  maxLength={100}
                />
              </label>
              <label>
                Date of birth {a.me && <small>(only if changing)</small>}
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  required={!a.me}
                  max={new Date(
                    new Date().setFullYear(new Date().getFullYear() - 18),
                  )
                    .toISOString()
                    .slice(0, 10)}
                />
                <small>Kept private. Only your age is shown.</small>
              </label>
              <label>
                I identify as
                <select
                  value={form.gender}
                  onChange={(e) => field("gender", e.target.value)}
                >
                  <option value="not specified">Prefer not to say</option>
                  <option value="man">Man</option>
                  <option value="woman">Woman</option>
                </select>
              </label>
              <label>
                Looking for
                <select
                  value={form.intention}
                  onChange={(e) => field("intention", e.target.value)}
                >
                  <option>A serious relationship</option>
                  <option>Marriage-minded</option>
                </select>
              </label>
            </div>
            <label>
              A little about you
              <textarea
                rows={4}
                value={form.bio}
                onChange={(e) => field("bio", e.target.value)}
                maxLength={1000}
                placeholder="Your favourite things, your hopes, your kind of Sunday…"
              />
            </label>
            <label>
              Interests (up to 8, separated by commas)
              <input
                value={form.interests.join(", ")}
                onChange={(e) =>
                  field(
                    "interests",
                    e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .slice(0, 8),
                  )
                }
                maxLength={400}
              />
            </label>
            <label>
              Languages (separated by commas)
              <input
                value={form.languages.join(", ")}
                onChange={(e) =>
                  field(
                    "languages",
                    e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .slice(0, 6),
                  )
                }
                maxLength={250}
              />
            </label>
            <button className="button primary" disabled={busy}>
              {busy ? "Saving…" : "Save your story"}
              <Check size={17} />
            </button>
          </form>
        </section>
        <aside>
          <section className="panel">
            <ShieldCheck size={26} />
            <h3>Your profile, your choice.</h3>
            <p>
              Your email and date of birth stay private. Share a city rather
              than an address. Keep sensitive personal details out of your bio.
            </p>
            <Link className="text-button" to="/policies/privacy">
              Read the privacy notice <ArrowRight size={14} />
            </Link>
          </section>
          <section className="panel account-actions">
            <h3>Your data</h3>
            <button
              className="text-button"
              onClick={async () => {
                try {
                  download(
                    "my-mehram-data.json",
                    JSON.stringify(
                      a.demo ?? (await rpc("export_my_data")),
                      null,
                      2,
                    ),
                  );
                } catch (e) {
                  a.notify(message(e));
                }
              }}
            >
              <Download size={16} /> Export my data
            </button>
            {a.mode === "demo" ? (
              <button className="text-button" onClick={() => a.startDemo()}>
                <RefreshCw size={16} /> Reset demo
              </button>
            ) : (
              <button
                className="text-button"
                onClick={async () => {
                  try {
                    await rpc("set_visibility", { paused: true });
                    a.notify(
                      "Discovery visibility paused. You can resume from here.",
                    );
                  } catch (e) {
                    a.notify(message(e));
                  }
                }}
              >
                Pause discovery
              </button>
            )}
            {a.mode === "backend" && (
              <button
                className="text-button"
                onClick={async () => {
                  try {
                    await rpc("set_visibility", { paused: false });
                    a.notify("Discovery visibility resumed.");
                  } catch (e) {
                    a.notify(message(e));
                  }
                }}
              >
                Resume discovery
              </button>
            )}
            <button
              className="text-button danger"
              onClick={() => setDeleting(true)}
            >
              Delete my account
            </button>
          </section>
        </aside>
      </div>
      {deleting && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <h2 id="delete-title">Delete your account?</h2>
            <p>
              Your profile, matches and account access will be removed. Active
              subscriptions must be cancelled first. Type DELETE to confirm.
            </p>
            <label>
              Confirmation
              <input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
              />
            </label>
            <button
              className="button primary full"
              disabled={confirmation !== "DELETE" || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  if (a.mode === "backend") {
                    const { data, error } = await backend().functions.invoke(
                      "account-delete",
                      { body: { confirmation } },
                    );
                    if (error) throw error;
                    if (data.error) throw new Error(data.error);
                  }
                  await a.signOut();
                } catch (e) {
                  a.notify(message(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Delete account
            </button>
            <button
              className="button outline full"
              onClick={() => setDeleting(false)}
            >
              Keep my account
            </button>
          </section>
        </div>
      )}
    </section>
  );
}

export function SecurityPage() {
  const a = useApp(),
    nav = useNavigate();
  const [factors, setFactors] = useState<
      { id: string; friendly_name?: string; status: string }[]
    >([]),
    [enrollment, setEnrollment] = useState<{
      id: string;
      qr: string;
      secret: string;
    } | null>(null),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [verified, setVerified] = useState(false),
    [isAdmin, setIsAdmin] = useState(false);
  async function load() {
    if (a.mode !== "backend") return;
    const { data, error } = await backend().auth.mfa.listFactors();
    if (error) throw error;
    setFactors(data.totp);
    const r = await backend().auth.mfa.getAuthenticatorAssuranceLevel();
    setVerified(r.data?.currentLevel === "aal2");
    setIsAdmin(await rpc<boolean>("has_admin_role"));
  }
  useEffect(() => {
    void load().catch((e) => a.notify(message(e)));
  }, [a.mode]);
  async function enroll() {
    setBusy(true);
    try {
      const client = backend();
      for (const f of factors.filter((f) => f.status === "unverified"))
        await client.auth.mfa.unenroll({ factorId: f.id });
      const { data, error } = await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator",
      });
      if (error) throw error;
      setEnrollment({
        id: data.id,
        qr: data.totp.qr_code,
        secret: data.totp.secret,
      });
    } catch (e) {
      a.notify(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const id =
        enrollment?.id ?? factors.find((f) => f.status === "verified")?.id;
      if (!id) throw new Error("Set up an authenticator first.");
      const { error } = await backend().auth.mfa.challengeAndVerify({
        factorId: id,
        code,
      });
      if (error) throw error;
      setCode("");
      setEnrollment(null);
      await load();
      await a.refresh();
      a.notify("Two-factor verification complete.");
      nav(isAdmin ? "/admin" : "/discover");
    } catch (e) {
      a.notify(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="page-content">
      <div className="page-heading">
        <div>
          <span className="eyebrow">A LITTLE EXTRA PEACE OF MIND</span>
          <h1>
            Protect your <em>account.</em>
          </h1>
          <p>Use an authenticator app for an extra layer of security.</p>
        </div>
      </div>
      <section className="panel security-panel">
        <span className="empty-icon">
          <ShieldCheck size={30} />
        </span>
        <h2>Two-factor authentication</h2>
        <p>
          Administrators must use 2FA. Members can enable it too. Once enabled,
          sensitive backend actions require a verified second factor.
        </p>
        {a.mode === "demo" ? (
          <div className="info-box">
            The fictional demo has no authentication credentials. Open a real
            test account to configure genuine 2FA.
          </div>
        ) : (
          <>
            <div className="security-status">
              <span className={verified ? "status active" : "status"}>
                {verified
                  ? "Verified 2FA session"
                  : factors.some((f) => f.status === "verified")
                    ? "Verification needed"
                    : "Not enabled"}
              </span>
              {isAdmin && <b>Required for your administrator role</b>}
            </div>
            {enrollment && (
              <div className="totp-enrollment">
                <img
                  src={enrollment.qr}
                  alt="Scan this authenticator setup QR code"
                />
                <label>
                  Or enter this secret in your authenticator
                  <code>{enrollment.secret}</code>
                </label>
                <small>
                  Keep this secret private. It is only displayed during setup.
                </small>
              </div>
            )}
            {(enrollment || factors.some((f) => f.status === "verified")) &&
              !verified && (
                <form onSubmit={verify}>
                  <label>
                    6-digit authenticator code
                    <input
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      autoComplete="one-time-code"
                      minLength={6}
                      maxLength={6}
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, ""))
                      }
                      required
                    />
                  </label>
                  <button className="button primary" disabled={busy}>
                    Verify code <KeyRound size={17} />
                  </button>
                </form>
              )}
            {!enrollment && !factors.some((f) => f.status === "verified") && (
              <button
                className="button primary"
                onClick={() => void enroll()}
                disabled={busy}
              >
                Set up authenticator <KeyRound size={17} />
              </button>
            )}
            {verified && (
              <p className="success-box">
                Your session has completed two-factor verification.
              </p>
            )}
          </>
        )}
        <p className="fine-print">
          Keep access to your authenticator. Factor recovery and removal require
          a separate verified support process; email password reset does not
          bypass 2FA.
        </p>
      </section>
    </section>
  );
}

const policies: Record<
  string,
  { title: string; intro: string; sections: [string, string][] }
> = {
  terms: {
    title: "Terms of Service",
    intro:
      "Test-release terms · Draft dated 30 October 2026. Operator legal name, contact details, legal review and live subscription terms must be completed before public launch.",
    sections: [
      [
        "Private testing and eligibility",
        "This test service is for invited adults aged 18 or older. Use only your own account. Example profiles and conversations in demo mode are fictional. Date-of-birth confirmation is not verified identity or proof of age.",
      ],
      [
        "Community standards",
        "No harassment, hate, scams, impersonation, sexual exploitation, pornography or non-consensual intimate material. Respect a person’s decision not to communicate. Do not share another person’s contact details or images without permission.",
      ],
      [
        "Memberships and payments",
        "Free, Gold and Diamond are test tiers. Listed premium prices are illustrative sandbox prices. Test payments use provider sandboxes and do not constitute a live subscription offer. Access depends on server-verified subscription state.",
      ],
      [
        "Moderation and complaints",
        "Report concerning profiles or conversations using the in-app report action. Reports can be reviewed by authorized moderators. Accounts may be suspended in response to safety concerns. A named operator, support contact and appeals process must be established before real-user launch.",
      ],
      [
        "Responsibility and rights",
        "No connection, identity or personal safety outcome is guaranteed. Do not use the service for emergencies. Nothing in these draft terms excludes non-excludable consumer or data protection rights. Commercial terms, cancellation, refunds and dispute handling require UK legal review.",
      ],
    ],
  },
  privacy: {
    title: "Privacy Notice",
    intro:
      "Test-release privacy notice · Draft. Do not use sensitive real profile data until the operator, lawful bases, processor agreements, retention periods and contact details are finalized.",
    sections: [
      [
        "Who controls your information",
        "The controller’s legal identity and privacy contact are not yet configured. This release is intended for fictional data and invited testing. These omissions must be resolved before public registration.",
      ],
      [
        "Information and purposes",
        "A configured account service processes authentication details, a private date of birth, profile content, likes, matches, messages, reports and membership state to operate the service. Do not add religious, ethnic, health or sexual-orientation details in this test; any such processing needs a documented Article 6 basis and Article 9 condition.",
      ],
      [
        "Demo mode",
        "The fictional demo stores its profile, swipes, messages, reports and tier preview in this browser’s local storage. It does not send messages to another person or process payment. Reset the demo or log out to clear its active state. Never enter real sensitive information in the demo.",
      ],
      [
        "Recipients and transfers",
        "Planned providers include Supabase for account/database/storage services, Cloudflare for web delivery and calls, OAuth providers if enabled, an email provider and sandbox payment providers. Illustrative stock photos are requested from images.unsplash.com, which receives ordinary request metadata such as IP address. A UK database region does not guarantee all provider processing stays in the UK.",
      ],
      [
        "Privacy and rights",
        "Use My profile to request an export or account deletion. Deletion may require cancelling active subscriptions; lawful retention exceptions for safety or financial evidence must be defined before live operation. Private photo links expire but previously downloaded copies cannot be recalled. Chat is access-controlled and encrypted in transit, not claimed to be end-to-end encrypted.",
      ],
      [
        "Retention and contacts",
        "The operator must publish specific retention periods, request handling contacts, a complaints route and relevant ICO information before collecting real-user data. No advertising or sale of personal data is implemented. Calls are not recorded by this app.",
      ],
    ],
  },
  cookies: {
    title: "Cookies & local storage",
    intro:
      "This release uses essential account/session storage and an optional, explicitly selected fictional demo. No advertising or third-party analytics tracker is installed.",
    sections: [
      [
        "Account sessions",
        "Supabase stores tokens in browser storage so a configured account can stay signed in. Protect your device, use a unique password and log out on shared computers. Future server rendering may move sessions into secure HttpOnly cookies.",
      ],
      [
        "Demo preferences",
        "Selecting Explore the demo stores fictional demo data under mehram-demo-v1 in local storage. Logging out removes that demo state. The reset action replaces it with initial fictional content.",
      ],
      [
        "External requests",
        "Stock images are served through Unsplash’s image CDN. Google and Facebook are contacted only when the corresponding sign-in flow is enabled and selected. Payment providers are opened only for configured checkout.",
      ],
      [
        "Future optional technologies",
        "Optional analytics, marketing pixels or other storage technologies require a separate assessment of current PECR rules, clear notice and consent where applicable before introduction.",
      ],
    ],
  },
  safety: {
    title: "Your safety matters",
    intro:
      "Meaningful connections need clear boundaries. This private test is adults-only and is not yet approved for public real-user operation.",
    sections: [
      [
        "You are in control",
        "Communicate only after a mutual match. Block or report unwanted contact. Keep home addresses, financial information and private contact details out of your profile. You do not owe anyone a reply or a call.",
      ],
      [
        "Recognize scams",
        "Do not send money, gift cards, cryptocurrency or account credentials to a person you meet here. Be cautious of urgent requests, investment offers and pressure to leave the platform. Social login is not identity verification.",
      ],
      [
        "Meet thoughtfully",
        "If you choose to meet someone, use a public place, tell a trusted person your plans and arrange your own travel. End any interaction that feels uncomfortable. The app cannot guarantee another person’s identity or intentions.",
      ],
      [
        "Reporting and moderation",
        "Reports and blocks are available to every tier. Authorized moderators need a real operating process for reviewing reports, documenting actions and handling appeals. This release’s demo reports remain fictional browser-local records.",
      ],
      [
        "Children and harmful content",
        "Under-18s are not permitted. Pornographic content is prohibited. A children’s-access assessment, illegal-content risk assessment and appropriate age assurance are launch requirements; an 18+ checkbox alone does not discharge these duties.",
      ],
      [
        "Calls and privacy",
        "Camera and microphone access require your browser permission. Calls require mutual matching and recipient acceptance. The application does not record calls. Another participant may independently capture content, so share thoughtfully.",
      ],
    ],
  },
};
export function PolicyPage() {
  const { kind = "terms" } = useParams();
  const p = policies[kind] ?? policies.terms;
  return (
    <main className="policy-page">
      <span className="eyebrow">TRUST IS PART OF THE CONNECTION</span>
      <h1>{p.title}</h1>
      <div className="info-box">{p.intro}</div>
      {p.sections.map(([title, body]) => (
        <section key={title}>
          <h2>{title}</h2>
          <p>{body}</p>
        </section>
      ))}
      <Link className="text-button" to="/">
        Back to the beginning <ArrowRight size={16} />
      </Link>
    </main>
  );
}
