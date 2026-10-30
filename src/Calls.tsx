import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import { useApp } from "./store";
import { backend, message, rpc } from "./lib/supabase";

interface Call {
  id: string;
  match_id: string;
  caller_id: string;
  receiver_id: string;
  video: boolean;
  status: "ringing" | "accepted" | "ended";
  created_at: string;
  expires_at: string;
}
const CallContext = createContext({
  start: (_match: string, _video: boolean) => {},
});
export const useCalls = () => useContext(CallContext);
const enabled = import.meta.env.VITE_CALLS_ENABLED === "true";

export function CallProvider({ children }: { children: ReactNode }) {
  const a = useApp();
  const [call, setCall] = useState<Call | null>(null);
  const [incoming, setIncoming] = useState<Call | null>(null);
  const [status, setStatus] = useState("");
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false),
    [cameraOff, setCameraOff] = useState(false);
  const active = useRef<Call | null>(null),
    peer = useRef<RTCPeerConnection | null>(null);
  const media = useRef<MediaStream | null>(null),
    preparing = useRef(false),
    cursor = useRef(0);
  const candidates = useRef<RTCIceCandidateInit[]>([]),
    processing = useRef(false);
  const actionBusy = useRef(false),
    offerSent = useRef(false),
    connected = useRef(false);

  function release() {
    const pc = peer.current;
    peer.current = null;
    if (pc) {
      pc.onconnectionstatechange = null;
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.close();
    }
    media.current?.getTracks().forEach((t) => t.stop());
    media.current = null;
    preparing.current = false;
    cursor.current = 0;
    candidates.current = [];
    offerSent.current = false;
    connected.current = false;
    setLocal(null);
    setRemote(null);
    setMuted(false);
    setCameraOff(false);
  }
  function finish(notice = "") {
    const previous = active.current;
    active.current = null;
    setCall(null);
    release();
    if (previous)
      void rpc("end_call", { call_ref: previous.id }).catch(() => {});
    if (notice) a.notify(notice);
  }
  async function signal(c: Call, kind: string, payload: unknown) {
    if (active.current?.id !== c.id) return;
    await rpc("send_call_signal", {
      call_ref: c.id,
      signal_kind: kind,
      signal_payload: payload,
    });
  }
  async function prepare(c: Call) {
    if (peer.current || preparing.current) return;
    preparing.current = true;
    try {
      const relay = await backend().functions.invoke("call-relay", {
        body: { call_id: c.id },
      });
      if (relay.error || !relay.data?.iceServers?.length)
        throw new Error(
          relay.data?.error ??
            "The call relay is unavailable. Please try again later.",
        );
      if (active.current?.id !== c.id) return;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: c.video
          ? {
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { ideal: 15, max: 20 },
            }
          : false,
      });
      if (active.current?.id !== c.id) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      media.current = stream;
      setLocal(stream);
      const pc = new RTCPeerConnection({
        iceServers: relay.data.iceServers,
        iceTransportPolicy: "relay",
      });
      peer.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      pc.onicecandidate = (e) => {
        if (e.candidate?.type === "relay")
          void signal(c, "candidate", e.candidate.toJSON()).catch(() =>
            finish("Could not connect the call. Please try again."),
          );
      };
      pc.ontrack = (e) => {
        if (active.current?.id === c.id)
          setRemote(e.streams[0] ?? new MediaStream([e.track]));
      };
      pc.onconnectionstatechange = () => {
        if (active.current?.id !== c.id) return;
        if (pc.connectionState === "connected") {
          connected.current = true;
          setStatus("Connected");
        } else if (pc.connectionState === "failed")
          finish("The call connection failed. Please try again.");
        else if (pc.connectionState === "disconnected")
          setStatus("Reconnecting…");
      };
      setStatus("Connecting securely…");
    } finally {
      preparing.current = false;
    }
  }
  async function bandwidth(pc: RTCPeerConnection) {
    for (const sender of pc.getSenders()) {
      if (!sender.track) continue;
      const params = sender.getParameters();
      if (params.encodings?.length) {
        params.encodings.forEach((e) => {
          e.maxBitrate = sender.track?.kind === "video" ? 400_000 : 32_000;
        });
        await sender.setParameters(params).catch(() => {});
      }
    }
  }
  async function pump() {
    const c = active.current;
    if (!c || processing.current) return;
    processing.current = true;
    try {
      const { data: updated, error } = await backend()
        .from("calls")
        .select("*")
        .eq("id", c.id)
        .maybeSingle();
      if (active.current?.id !== c.id) return;
      if (error) throw error;
      if (
        !updated ||
        updated.status === "ended" ||
        Date.parse(updated.expires_at) <= Date.now()
      ) {
        finish("Call ended.");
        return;
      }
      if (updated.status === "ringing") {
        if (Date.parse(c.created_at) + 45_000 <= Date.now())
          finish("No answer this time.");
        return;
      }
      if (
        !connected.current &&
        Date.parse(updated.accepted_at) + 45_000 <= Date.now()
      ) {
        finish("The call could not connect. Please try again.");
        return;
      }
      if (updated.status !== active.current.status) {
        active.current = updated;
        setCall(updated);
      }
      await prepare(updated);
      const pc = peer.current;
      if (!pc || active.current?.id !== c.id) return;
      if (c.caller_id === a.user?.id && !offerSent.current) {
        offerSent.current = true;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await signal(c, "offer", { type: "offer", sdp: offer.sdp });
        await bandwidth(pc);
      }
      const signals = await backend()
        .from("call_signals")
        .select("id,kind,payload")
        .eq("call_id", c.id)
        .neq("sender_id", a.user!.id)
        .gt("id", cursor.current)
        .order("id")
        .limit(100);
      if (signals.error) throw signals.error;
      for (const row of signals.data ?? []) {
        if (active.current?.id !== c.id) return;
        if (
          row.kind === "offer" &&
          c.receiver_id === a.user?.id &&
          !pc.remoteDescription
        ) {
          await pc.setRemoteDescription({
            type: "offer",
            sdp: row.payload.sdp,
          });
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await signal(c, "answer", { type: "answer", sdp: answer.sdp });
          await bandwidth(pc);
        } else if (
          row.kind === "answer" &&
          c.caller_id === a.user?.id &&
          !pc.remoteDescription
        ) {
          await pc.setRemoteDescription({
            type: "answer",
            sdp: row.payload.sdp,
          });
        } else if (row.kind === "candidate")
          candidates.current.push(row.payload);
        if (pc.remoteDescription)
          while (candidates.current.length)
            await pc.addIceCandidate(candidates.current.shift()!);
        cursor.current = Number(row.id);
      }
    } catch (e) {
      if (active.current?.id === c.id) finish(message(e));
    } finally {
      processing.current = false;
    }
  }
  async function start(matchId: string, video: boolean) {
    if (a.mode === "demo") {
      a.notify(
        "The fictional demo does not access your microphone or camera, or place real calls.",
      );
      return;
    }
    if (!enabled) {
      a.notify("Calling is not enabled in this test environment yet.");
      return;
    }
    if (active.current || actionBusy.current) {
      a.notify("Finish your current call first.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
      a.notify("Calling requires a supported browser on HTTPS.");
      return;
    }
    actionBusy.current = true;
    try {
      const c = await rpc<Call>("start_call", {
        conversation_id: matchId,
        wants_video: video,
      });
      active.current = c;
      setCall(c);
      setStatus("Waiting for an answer…");
    } catch (e) {
      a.notify(message(e));
    } finally {
      actionBusy.current = false;
    }
  }
  async function accept() {
    const c = incoming;
    if (!c || actionBusy.current) return;
    actionBusy.current = true;
    setIncoming(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection)
        throw new Error("Calling requires a supported browser on HTTPS.");
      await rpc("answer_call", { call_ref: c.id });
      const accepted = { ...c, status: "accepted" as const };
      active.current = accepted;
      setCall(accepted);
      setStatus("Connecting securely…");
      await prepare(accepted);
      void pump();
    } catch (e) {
      if (active.current) finish(message(e));
      else {
        void rpc("end_call", { call_ref: c.id }).catch(() => {});
        a.notify(message(e));
      }
    } finally {
      actionBusy.current = false;
    }
  }
  useEffect(() => {
    if (!enabled || a.mode !== "backend" || !a.user) return;
    let alive = true;
    async function check() {
      const { data, error } = await backend()
        .from("calls")
        .select("*")
        .eq("receiver_id", a.user!.id)
        .eq("status", "ringing")
        .gt("created_at", new Date(Date.now() - 45_000).toISOString())
        .order("created_at", { ascending: false })
        .limit(1);
      if (alive && !error && !active.current) setIncoming(data?.[0] ?? null);
    }
    const channel = backend()
      .channel(`call-inbox-${a.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "calls",
          filter: `receiver_id=eq.${a.user.id}`,
        },
        () => void check(),
      )
      .subscribe();
    void check();
    const timer = setInterval(() => void check(), 15_000);
    return () => {
      alive = false;
      clearInterval(timer);
      void backend().removeChannel(channel);
    };
  }, [a.mode, a.user?.id]);
  useEffect(() => {
    if (!call) return;
    const channel = backend()
      .channel(`call-${call.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "calls",
          filter: `id=eq.${call.id}`,
        },
        () => void pump(),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_signals",
          filter: `call_id=eq.${call.id}`,
        },
        () => void pump(),
      )
      .subscribe();
    const timer = setInterval(() => void pump(), 2500);
    void pump();
    return () => {
      clearInterval(timer);
      void backend().removeChannel(channel);
    };
  }, [call?.id]);
  useEffect(() => {
    if (a.mode !== "backend") {
      if (active.current) finish();
      setIncoming(null);
    }
  }, [a.mode]);
  useEffect(
    () => () => {
      const c = active.current;
      active.current = null;
      peer.current?.close();
      media.current?.getTracks().forEach((t) => t.stop());
      if (c) void rpc("end_call", { call_ref: c.id }).catch(() => {});
    },
    [],
  );
  const name =
    a.matches.find((m) => m.id === (call ?? incoming)?.match_id)?.profile
      .name ?? "Your match";
  return (
    <CallContext.Provider
      value={{ start: (id, video) => void start(id, video) }}
    >
      {children}
      {(call || incoming) && (
        <div className="modal-backdrop call-backdrop">
          <section
            className="modal call-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="call-title"
          >
            <span className="eyebrow">
              {(call ?? incoming)?.video ? "VIDEO CALL" : "AUDIO CALL"}
            </span>
            <h2 id="call-title">{name}</h2>
            <p role="status">{call ? status : "Would like to call you."}</p>
            <p className="fine-print">
              Calls are not recorded. Your microphone
              {(call ?? incoming)?.video ? " and camera" : ""} activates after
              you both agree to connect. Test calls end after 10 minutes.
            </p>
            {call ? (
              <>
                {remote && (
                  <StreamView
                    stream={remote}
                    muted={false}
                    visible={call.video}
                    label="Your match"
                  />
                )}
                {local && call.video && (
                  <StreamView
                    stream={local}
                    muted
                    visible
                    label="Your camera preview"
                  />
                )}
                <div className="call-actions">
                  <button
                    className="icon-button"
                    aria-label={muted ? "Unmute microphone" : "Mute microphone"}
                    onClick={() => {
                      media.current?.getAudioTracks().forEach((t) => {
                        t.enabled = muted;
                      });
                      setMuted(!muted);
                    }}
                  >
                    {muted ? <MicOff /> : <Mic />}
                  </button>
                  {call.video && (
                    <button
                      className="icon-button"
                      aria-label={
                        cameraOff ? "Enable camera" : "Disable camera"
                      }
                      onClick={() => {
                        media.current?.getVideoTracks().forEach((t) => {
                          t.enabled = cameraOff;
                        });
                        setCameraOff(!cameraOff);
                      }}
                    >
                      {cameraOff ? <VideoOff /> : <Video />}
                    </button>
                  )}
                  <button className="button primary" onClick={() => finish()}>
                    <PhoneOff size={18} /> End call
                  </button>
                </div>
              </>
            ) : (
              <div className="call-actions">
                <button
                  className="button outline"
                  onClick={() => {
                    const c = incoming;
                    setIncoming(null);
                    if (c)
                      void rpc("end_call", { call_ref: c.id }).catch((e) =>
                        a.notify(message(e)),
                      );
                  }}
                >
                  Decline
                </button>
                <button
                  className="button primary"
                  onClick={() => void accept()}
                >
                  <Phone size={18} /> Accept call
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </CallContext.Provider>
  );
}
function StreamView({
  stream,
  muted,
  visible,
  label,
}: {
  stream: MediaStream;
  muted: boolean;
  visible: boolean;
  label: string;
}) {
  const ref = useRef<HTMLVideoElement>(null),
    [blocked, setBlocked] = useState(false);
  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
      void ref.current.play().catch(() => setBlocked(true));
    }
  }, [stream]);
  return (
    <div className={muted ? "call-local" : "call-remote"}>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        aria-label={label}
        className={visible ? "" : "call-audio"}
      />
      {blocked && (
        <button
          className="button outline"
          onClick={() =>
            void ref.current
              ?.play()
              .then(() => setBlocked(false))
              .catch(() => {})
          }
        >
          Play incoming audio
        </button>
      )}
    </div>
  );
}
