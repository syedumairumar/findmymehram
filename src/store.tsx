import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import type { Profile, Membership, Match, ChatMessage } from "./types";
import { backend, supabase, rpc, resolvePhoto, message } from "./lib/supabase";
import { initialDemo, incomingDemo, demoProfiles } from "./lib/demo";
import type { DemoState } from "./lib/demo";
import { likeLimits } from "./lib/domain";

interface Store {
  mode: "demo" | "backend" | "guest";
  user: User | null;
  me: Profile | null;
  membership: Membership;
  matches: Match[];
  admin: boolean;
  ready: boolean;
  notice: string;
  notify: (value: string) => void;
  startDemo: () => void;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  discover: () => Promise<Profile[]>;
  swipe: (id: string, liked: boolean) => Promise<{ matched: boolean }>;
  likes: () => Promise<{ count: number; profiles: Profile[] }>;
  chat: (id: string) => Promise<ChatMessage[]>;
  send: (id: string, content: string) => Promise<void>;
  block: (id: string) => Promise<void>;
  report: (id: string, reason: string) => Promise<void>;
  saveProfile: (
    profile: Omit<Profile, "id">,
    birthDate?: string,
  ) => Promise<void>;
  demo: DemoState | null;
  setDemo: (value: DemoState) => void;
}
const Context = createContext<Store | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const [demo, setDemoState] = useState<DemoState | null>(() => {
    try {
      const x = localStorage.getItem("mehram-demo-v1");
      return x ? JSON.parse(x) : null;
    } catch {
      return null;
    }
  });
  const [user, setUser] = useState<User | null>(null),
    [me, setMe] = useState<Profile | null>(demo?.profile ?? null),
    [membership, setMembership] = useState<Membership>({
      tier: "free",
      source: "free",
      expires_at: null,
    }),
    [matches, setMatches] = useState<Match[]>(demo?.matches ?? []),
    [admin, setAdmin] = useState(false),
    [ready, setReady] = useState(!supabase),
    [notice, notify] = useState("");
  const mode = demo ? "demo" : user ? "backend" : "guest";
  const setDemo = useCallback((value: DemoState) => {
    setDemoState(value);
    localStorage.setItem("mehram-demo-v1", JSON.stringify(value));
  }, []);
  const hydrate = useCallback(
    async (p: Profile) => ({
      ...p,
      photoPath: p.photo,
      photo: await resolvePhoto(p.photo),
    }),
    [],
  );
  const refresh = useCallback(async () => {
    if (demo) {
      setMe(demo.profile);
      setMatches(demo.matches);
      setMembership({ tier: demo.tier, source: "demo", expires_at: null });
      setAdmin(true);
      return;
    }
    if (!user) {
      setMe(null);
      setMatches([]);
      setAdmin(false);
      return;
    }
    const [p, m, ms, a] = await Promise.all([
      rpc<Profile | null>("my_profile"),
      rpc<Membership>("my_membership"),
      rpc<Match[]>("my_matches"),
      rpc<boolean>("can_admin"),
    ]);
    setMe(p ? await hydrate(p) : null);
    setMembership(m);
    setMatches(
      await Promise.all(
        ms.map(async (x) => ({ ...x, profile: await hydrate(x.profile) })),
      ),
    );
    setAdmin(a);
  }, [demo, user, hydrate]);
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (alive) {
        if (error) notify(message(error));
        setUser(data.session?.user ?? null);
        setReady(true);
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, s) => {
      if (alive) {
        setUser(s?.user ?? null);
        setReady(true);
      }
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    void refresh().catch((e) => notify(message(e)));
  }, [refresh]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => notify(""), 6000);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    if (mode !== "backend" || !user || !supabase) return;
    const c = supabase
      .channel(`member-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => void refresh().catch(() => {}),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        () => void refresh().catch(() => {}),
      )
      .subscribe();
    return () => {
      void supabase?.removeChannel(c);
    };
  }, [mode, user, refresh]);
  const startDemo = () => {
    const value = initialDemo();
    setDemo(value);
    notify("Demo opened. All profiles and conversations here are fictional.");
  };
  async function signOut() {
    if (demo) {
      setDemoState(null);
      localStorage.removeItem("mehram-demo-v1");
    }
    if (user) await backend().auth.signOut();
    setUser(null);
    setMe(null);
    setMatches([]);
    setAdmin(false);
  }
  async function discover() {
    if (demo)
      return demoProfiles.filter(
        (p) =>
          !(p.id in demo.swipes) &&
          !demo.blocked.includes(p.id) &&
          !demo.matches.some((m) => m.profile.id === p.id),
      );
    return Promise.all(
      (await rpc<Profile[]>("discover_profiles")).map(hydrate),
    );
  }
  async function swipe(id: string, liked: boolean) {
    if (demo) {
      if (
        Object.values(demo.swipes).filter(Boolean).length >=
          likeLimits[demo.tier] &&
        liked
      )
        throw new Error("You’ve reached the demo’s daily like limit.");
      const matched = liked && incomingDemo.includes(id);
      const p = demoProfiles.find((x) => x.id === id)!;
      setDemo({
        ...demo,
        swipes: { ...demo.swipes, [id]: liked },
        matches:
          matched && !demo.matches.some((x) => x.profile.id === id)
            ? [...demo.matches, { id: `match-${id}`, profile: p, unread: 0 }]
            : demo.matches,
      });
      return { matched };
    }
    const data = await rpc<{ matched: boolean }>("record_swipe", {
      target_id: id,
      liked,
    });
    await refresh();
    return data;
  }
  async function likes() {
    if (demo) {
      const rows = demoProfiles.filter(
        (p) =>
          incomingDemo.includes(p.id) &&
          !demo.blocked.includes(p.id) &&
          !demo.matches.some((m) => m.profile.id === p.id),
      );
      return { count: rows.length, profiles: demo.tier === "free" ? [] : rows };
    }
    const data = await rpc<{ count: number; profiles: Profile[] }>(
      "incoming_likes",
    );
    return { ...data, profiles: await Promise.all(data.profiles.map(hydrate)) };
  }
  async function chat(id: string) {
    if (demo) return demo.messages.filter((m) => m.match_id === id);
    const { data, error } = await backend()
      .from("messages")
      .select("*")
      .eq("match_id", id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data as ChatMessage[]).reverse();
  }
  async function send(id: string, content: string) {
    const body = content.trim();
    if (!body || body.length > 2000)
      throw new Error("Messages must be between 1 and 2,000 characters.");
    if (demo) {
      setDemo({
        ...demo,
        messages: [
          ...demo.messages,
          {
            id: crypto.randomUUID(),
            match_id: id,
            sender_id: demo.profile.id,
            content: body,
            created_at: new Date().toISOString(),
          },
        ],
        matches: demo.matches.map((m) =>
          m.id === id ? { ...m, last_message: body } : m,
        ),
      });
      return;
    }
    await rpc("send_message", {
      conversation_id: id,
      body,
      request_id: crypto.randomUUID(),
    });
    await refresh();
  }
  async function block(id: string) {
    if (demo) {
      setDemo({
        ...demo,
        blocked: [...demo.blocked, id],
        matches: demo.matches.filter((m) => m.profile.id !== id),
      });
    } else {
      await rpc("block_member", { target_id: id });
      await refresh();
    }
    notify("Member blocked. You won’t see or hear from each other.");
  }
  async function report(id: string, reason: string) {
    if (demo)
      setDemo({ ...demo, reports: [...demo.reports, { target: id, reason }] });
    else await rpc("report_member", { target_id: id, reason });
    notify(
      demo
        ? "Demo report saved locally. No real person has been reported."
        : "Report received. Our moderation team can review it.",
    );
  }
  async function saveProfile(p: Omit<Profile, "id">, birthDate?: string) {
    if (demo) setDemo({ ...demo, profile: { ...p, id: demo.profile.id } });
    else {
      await rpc("save_profile", {
        details: {
          ...p,
          photo: p.photo === me?.photo ? (me.photoPath ?? p.photo) : p.photo,
          birth_date: birthDate,
        },
      });
      await refresh();
    }
    notify("Your profile has been saved.");
  }
  return (
    <Context.Provider
      value={{
        mode,
        user,
        me,
        membership,
        matches,
        admin,
        ready,
        notice,
        notify,
        startDemo,
        signOut,
        refresh,
        discover,
        swipe,
        likes,
        chat,
        send,
        block,
        report,
        saveProfile,
        demo,
        setDemo,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error("App provider missing");
  return value;
}
