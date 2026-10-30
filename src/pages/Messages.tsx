import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Send,
  MessageCircle,
  Phone,
  Video,
  ShieldCheck,
  Ban,
  Flag,
} from "lucide-react";
import { useApp } from "../store";
import { useCalls } from "../Calls";
import { backend, message } from "../lib/supabase";
import type { ChatMessage } from "../types";
export default function Messages() {
  const calls = useCalls();
  const a = useApp(),
    [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<ChatMessage[]>([]),
    [body, setBody] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const match =
    a.matches.find((m) => m.id === params.get("match")) ?? a.matches[0];
  useEffect(() => {
    let alive = true;
    async function load() {
      if (!match) {
        setRows([]);
        return;
      }
      try {
        const messages = await a.chat(match.id);
        if (alive) {
          setRows(messages);
          setError("");
        }
      } catch (e) {
        if (alive) setError(message(e));
      }
    }
    void load();
    if (a.mode !== "backend" || !match)
      return () => {
        alive = false;
      };
    const channel = backend()
      .channel(`chat-${match.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${match.id}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      alive = false;
      void backend().removeChannel(channel);
    };
  }, [match?.id, a.demo, a.user]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [rows.length]);
  async function send() {
    if (!match || !body.trim() || busy) return;
    setBusy(true);
    try {
      await a.send(match.id, body);
      setBody("");
      if (a.mode === "backend") setRows(await a.chat(match.id));
    } catch (e) {
      a.notify(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="page-content messages-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">GOOD CONVERSATIONS GO A LITTLE DEEPER</span>
          <h1>
            From a little <em>hello.</em>
          </h1>
          <p>A space to get to know your connections.</p>
        </div>
      </div>
      <div className="chat-layout">
        <aside className="chat-list">
          <h3>
            Your conversations <span>{a.matches.length}</span>
          </h3>
          {a.matches.map((m) => (
            <button
              key={m.id}
              className={`chat-list-row ${match?.id === m.id ? "selected" : ""}`}
              onClick={() => setParams({ match: m.id })}
            >
              <span className="avatar">
                <img src={m.profile.photo} alt="" />
              </span>
              <span>
                <b>{m.profile.name}</b>
                <small>{m.last_message ?? "You matched. Say hello."}</small>
              </span>
              <span className="connection-dot" />
            </button>
          ))}
          {!a.matches.length && <p>Mutual matches will appear here.</p>}
        </aside>
        {match ? (
          <section className="chat-conversation">
            <header>
              <div className="chat-person">
                <span className="avatar">
                  <img src={match.profile.photo} alt="" />
                </span>
                <div>
                  <h3>{match.profile.name}</h3>
                  <small>Mutual connection · {match.profile.city}</small>
                </div>
              </div>
              <div className="chat-tools">
                <button
                  className="icon-button"
                  aria-label="Audio call"
                  onClick={() => calls.start(match.id, false)}
                >
                  <Phone size={19} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Video call"
                  onClick={() => calls.start(match.id, true)}
                >
                  <Video size={21} />
                </button>
              </div>
            </header>
            <div className="chat-safety">
              <ShieldCheck size={13} /> Share thoughtfully. Never send money or
              private account details.
            </div>
            <div className="chat-history" aria-live="polite">
              {error && <div className="error-box">{error}</div>}
              <p className="conversation-beginning">
                <HeartMark /> You connected. A new story starts here.
              </p>
              {rows.map((m) => (
                <div
                  key={m.id}
                  className={`chat-bubble ${m.sender_id === a.me?.id ? "mine" : ""}`}
                >
                  <p>{m.content}</p>
                  <time dateTime={m.created_at}>
                    {new Date(m.created_at).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
              ))}
              <div ref={end} />
            </div>
            <form
              className="chat-compose"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <label className="sr-only" htmlFor="chat-message">
                Your message
              </label>
              <input
                id="chat-message"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={2000}
                placeholder="A little hello goes a long way…"
              />
              <button
                className="button primary"
                aria-label="Send message"
                disabled={busy || !body.trim()}
              >
                <Send size={19} />
              </button>
            </form>
            <div className="chat-footer">
              <button
                className="text-button"
                onClick={async () => {
                  try {
                    await a.report(
                      match.profile.id,
                      "Concern reported from a matched conversation",
                    );
                  } catch (e) {
                    a.notify(message(e));
                  }
                }}
              >
                <Flag size={12} /> Report
              </button>
              <button
                className="text-button"
                onClick={async () => {
                  if (
                    !window.confirm(
                      `Block ${match.profile.name} and end this connection?`,
                    )
                  )
                    return;
                  try {
                    await a.block(match.profile.id);
                  } catch (e) {
                    a.notify(message(e));
                  }
                }}
              >
                <Ban size={12} /> Block & unmatch
              </button>
              <small>
                {a.mode === "demo"
                  ? "Fictional conversation · No automatic replies"
                  : "Private to your match · Not end-to-end encrypted"}
              </small>
            </div>
          </section>
        ) : (
          <div className="empty-state">
            <MessageCircle size={34} />
            <h2>A conversation worth waiting for.</h2>
            <p>Match with someone to start chatting.</p>
          </div>
        )}
      </div>
    </section>
  );
}
function HeartMark() {
  return <span>♡</span>;
}
