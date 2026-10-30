import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Users,
  UserPlus,
  Crown,
  Flag,
  Download,
  Search,
  TrendingUp,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { useApp } from "../store";
import { message, rpc } from "../lib/supabase";
import { demoProfiles, demoMe } from "../lib/demo";
import { download, toCsv } from "../lib/domain";
import type { AdminData } from "../types";
export default function Admin() {
  const a = useApp();
  const [data, setData] = useState<AdminData | null>(null),
    [error, setError] = useState(""),
    [tab, setTab] = useState("Overview"),
    [search, setSearch] = useState(""),
    [days, setDays] = useState("14");
  async function load() {
    try {
      if (a.mode === "demo") {
        const users = [demoMe, ...demoProfiles].map((p, i) => ({
          ...p,
          status: a.demo?.blocked.includes(p.id) ? "suspended" : "active",
          tier: i === 0 ? a.membership.tier : ("free" as const),
          joined: new Date(Date.now() - i * 86400000).toISOString(),
        }));
        setData({
          total: users.length,
          active: users.filter((x) => x.status === "active").length,
          premium: users.filter((x) => x.tier !== "free").length,
          reports: a.demo?.reports.length ?? 0,
          users,
          daily: Array.from({ length: 14 }, (_, i) => ({
            day: new Date(Date.now() - (13 - i) * 86400000).toLocaleDateString(
              "en-GB",
              { day: "numeric", month: "short" },
            ),
            signups: [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 2][i],
            active: [1, 1, 2, 2, 1, 3, 2, 3, 3, 4, 3, 4, 5, 6][i],
          })),
          payments: [],
          report_rows: (a.demo?.reports ?? []).map((r, i) => ({
            id: `demo-report-${i}`,
            reason: r.reason,
            status: "open",
            created_at: new Date().toISOString(),
            target_id: r.target,
          })),
        });
      } else if (a.admin) setData(await rpc<AdminData>("admin_overview"));
      else {
        setData(null);
      }
      setError("");
    } catch (e) {
      setError(message(e));
    }
  }
  useEffect(() => {
    void load();
  }, [a.admin, a.demo, a.membership.tier]);
  if (!a.admin)
    return (
      <section className="page-content">
        <div className="panel empty-state">
          <ShieldCheck size={35} />
          <h2>Verified administrator access required.</h2>
          <p>
            A server-assigned administrator role and verified authenticator 2FA
            are required. Ordinary members cannot access administration data.
          </p>
          <Link className="button primary" to="/security">
            Verify your security <ShieldCheck size={17} />
          </Link>
        </div>
      </section>
    );
  const users = (data?.users ?? []).filter((p) =>
    `${p.name} ${p.city} ${p.tier}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <section className="page-content admin-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            A THOUGHTFUL COMMUNITY STARTS WITH CARE
          </span>
          <h1>
            Community <em>overview.</em>
          </h1>
          <p>
            {a.mode === "demo"
              ? "Fictional sample dashboard · No real revenue or visitors"
              : "Operational dashboard · Role-restricted · UTC reporting"}
          </p>
        </div>
        <button className="button outline small" onClick={() => void load()}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>
      {error && <div className="error-box">{error}</div>}
      <div className="admin-tabs">
        {["Overview", "Users", "Memberships", "Payments", "Moderation"].map(
          (t) => (
            <button
              className={tab === t ? "active" : ""}
              key={t}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ),
        )}
      </div>
      {data && (
        <>
          {tab === "Overview" ? (
            <>
              <div className="stats-grid">
                {[
                  {
                    title: "Total members",
                    value: data.total,
                    icon: Users,
                    note: "Completed profiles",
                  },
                  {
                    title: "Active profiles",
                    value: data.active,
                    icon: UserPlus,
                    note: "Available in discovery",
                  },
                  {
                    title: "Premium memberships",
                    value: data.premium,
                    icon: Crown,
                    note:
                      a.mode === "demo"
                        ? "Includes demo tier preview"
                        : "Access subject to expiry",
                  },
                  {
                    title: "Open reports",
                    value: data.reports,
                    icon: Flag,
                    note: "Awaiting moderation",
                  },
                ].map((s) => (
                  <article className="stat-card" key={s.title}>
                    <span>
                      {s.title}
                      <s.icon size={18} />
                    </span>
                    <b>{s.value}</b>
                    <small>{s.note}</small>
                  </article>
                ))}
              </div>
              <div className="admin-charts">
                <section className="panel chart-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>New registrations</h3>
                      <p>
                        {a.mode === "demo"
                          ? "Illustrative sample registrations"
                          : "Completed profiles by day"}{" "}
                        · UTC
                      </p>
                    </div>
                    <label className="compact-label">
                      <span className="sr-only">Chart period</span>
                      <select
                        value={days}
                        onChange={(e) => setDays(e.target.value)}
                      >
                        <option value="14">Last 14 days</option>
                        <option value="7">Last 7 days</option>
                      </select>
                    </label>
                  </div>
                  <div className="chart-wrap">
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={data.daily.slice(-Number(days))}>
                        <defs>
                          <linearGradient
                            id="signupGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#d85c49"
                              stopOpacity={0.25}
                            />
                            <stop
                              offset="100%"
                              stopColor="#d85c49"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 5"
                          vertical={false}
                          stroke="#ebe7df"
                        />
                        <XAxis
                          dataKey="day"
                          tick={{ fontSize: 10, fill: "#8b8b80" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: "#8b8b80" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="signups"
                          stroke="#d85c49"
                          strokeWidth={2.5}
                          fill="url(#signupGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </section>
                <section className="panel tier-panel">
                  <h3>A community in every chapter.</h3>
                  <p>Membership distribution</p>
                  {(["free", "gold", "diamond"] as const).map((t) => {
                    const count = data.users.filter((u) => u.tier === t).length;
                    return (
                      <div className="tier-bar" key={t}>
                        <div>
                          <span>{t}</span>
                          <b>{count}</b>
                        </div>
                        <i>
                          <span
                            style={{
                              width: `${(count / Math.max(data.users.length, 1)) * 100}%`,
                            }}
                          />
                        </i>
                      </div>
                    );
                  })}
                  <div className="traffic-unavailable">
                    <TrendingUp size={20} />
                    <b>Traffic analytics not connected</b>
                    <small>
                      Visitor counts will appear only after an approved
                      analytics source is configured.
                    </small>
                  </div>
                </section>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <h3>Newest members</h3>
                  <button
                    className="text-button"
                    onClick={() => setTab("Users")}
                  >
                    View all →
                  </button>
                </div>
                <UserTable users={data.users.slice(0, 5)} />
              </section>
            </>
          ) : tab === "Users" || tab === "Memberships" ? (
            <section className="panel">
              <div className="panel-heading">
                <div className="search-input">
                  <Search size={17} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name, city or tier"
                    aria-label="Search members"
                  />
                </div>
                <button
                  className="button outline small"
                  onClick={() =>
                    download(
                      "members.csv",
                      toCsv(
                        users.map(({ name, city, tier, status, joined }) => ({
                          name,
                          city,
                          tier,
                          status,
                          joined,
                        })),
                      ),
                      "text/csv",
                    )
                  }
                >
                  <Download size={15} /> Export CSV
                </button>
              </div>
              <UserTable
                users={users}
                onAction={async (id, status) => {
                  if (a.mode === "demo") {
                    a.notify(
                      "This sample dashboard does not moderate real accounts.",
                    );
                    return;
                  }
                  if (
                    !window.confirm(
                      `${status === "suspended" ? "Restore" : "Suspend"} this member?`,
                    )
                  )
                    return;
                  try {
                    await rpc("admin_action", {
                      target_id: id,
                      action: status === "suspended" ? "restore" : "suspend",
                    });
                    await load();
                  } catch (e) {
                    a.notify(message(e));
                  }
                }}
              />
            </section>
          ) : tab === "Payments" ? (
            <section className="panel">
              <div className="panel-heading">
                <h3>Payment history</h3>
                <span className="mode-pill">SANDBOX ONLY</span>
              </div>
              {data.payments.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Provider</th>
                        <th>Tier</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Environment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.payments.map((p) => (
                        <tr key={p.id}>
                          <td>{p.provider}</td>
                          <td>{p.tier}</td>
                          <td>£{p.amount.toFixed(2)}</td>
                          <td>{p.status}</td>
                          <td>{p.environment}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <Crown size={30} />
                  <h3>No payment transactions.</h3>
                  <p>
                    Verified provider payments will appear here. Demo tier
                    changes do not generate revenue.
                  </p>
                </div>
              )}
            </section>
          ) : (
            <section className="panel">
              <h3>Reports requiring care</h3>
              {data.report_rows.length ? (
                data.report_rows.map((r) => (
                  <article className="report-row" key={r.id}>
                    <div>
                      <b>{r.reason}</b>
                      <small>
                        {r.status} ·{" "}
                        {new Date(r.created_at).toLocaleDateString()}
                      </small>
                    </div>
                    {r.status === "open" && (
                      <button
                        className="button outline small"
                        onClick={async () => {
                          if (a.mode === "demo") {
                            a.notify(
                              "Sample report only. No real moderation action taken.",
                            );
                            return;
                          }
                          try {
                            await rpc("admin_action", {
                              target_id: r.id,
                              action: "resolve_report",
                            });
                            await load();
                          } catch (e) {
                            a.notify(message(e));
                          }
                        }}
                      >
                        Mark resolved
                      </button>
                    )}
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  <ShieldCheck size={32} />
                  <h3>No reports in the queue.</h3>
                  <p>Reports will appear here for authorized moderators.</p>
                </div>
              )}
            </section>
          )}
        </>
      )}
      <p className="fine-print">
        Sensitive admin reads and changes are audited by the backend. Charted
        registrations and traffic are distinct metrics. Lists show at most 100
        recent records in this initial milestone.
      </p>
    </section>
  );
}
function UserTable({
  users,
  onAction,
}: {
  users: AdminData["users"];
  onAction?: (id: string, status: string) => Promise<void>;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Member</th>
            <th>Location</th>
            <th>Membership</th>
            <th>Status</th>
            <th>Joined</th>
            {onAction && <th>Action</th>}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                <span className="table-member">
                  <span className="avatar tiny">
                    {u.photo ? <img src={u.photo} alt="" /> : u.name[0]}
                  </span>
                  <b>{u.name}</b>
                </span>
              </td>
              <td>{u.city}</td>
              <td>
                <span className={`tier-badge ${u.tier}`}>{u.tier}</span>
              </td>
              <td>
                <span className={`status ${u.status}`}>{u.status}</span>
              </td>
              <td>
                {new Date(u.joined).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
              </td>
              {onAction && (
                <td>
                  <button
                    className="text-button"
                    onClick={() => void onAction(u.id, u.status)}
                  >
                    {u.status === "suspended" ? "Restore" : "Suspend"}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
