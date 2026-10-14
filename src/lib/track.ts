// First-party event tracking (B1). No cookies, no third parties: events go to
// the `track-event` edge function, which allowlists names and caps size.
// Never throws, never blocks UI. Session id lives in sessionStorage only.
export type TrackEvent =
  | "signup" | "search_submitted" | "analysis_viewed" | "shelf_add" | "rating_set"
  | "note_saved" | "recommendation_clicked" | "feedback_sent" | "session_start";

type Props = Record<string, string | number | boolean | null>;

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-event`;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

let queue: { event: TrackEvent; props?: Props }[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

export function sessionId(): string {
  try {
    let id = sessionStorage.getItem("nv_sid");
    if (!id) {
      id = crypto.randomUUID().replace(/-/g, "");
      sessionStorage.setItem("nv_sid", id);
    }
    return id;
  } catch {
    return "nostorage" + Math.random().toString(36).slice(2, 12);
  }
}

async function flush(accessToken?: string) {
  timer = undefined;
  if (!queue.length || !KEY) { queue = []; return; }
  const events = queue.splice(0, 20);
  try {
    await fetch(ENDPOINT, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        apikey: KEY,
        Authorization: `Bearer ${accessToken ?? KEY}`,
      },
      body: JSON.stringify({ session_id: sessionId(), events }),
    });
  } catch { /* tracking must never surface errors */ }
}

/** Queue an event; batches within 1.5s. Pass accessToken to attribute to a user. */
export function track(event: TrackEvent, props?: Props, accessToken?: string) {
  queue.push({ event, props });
  if (queue.length >= 20) { void flush(accessToken); return; }
  if (!timer) timer = setTimeout(() => void flush(accessToken), 1500);
}
