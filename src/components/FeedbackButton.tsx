import { useState } from "react";
import { MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { track, sessionId } from "@/lib/track";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-feedback`;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const KINDS = [
  { id: "bug", label: "Something's broken" },
  { id: "idea", label: "An idea" },
  { id: "general", label: "Other" },
] as const;

interface Props {
  /** Short page id, e.g. "book" or "shelf". */
  page: string;
  slug?: string | null;
  className?: string;
}

/** Small "Send feedback" entry point (B3). Posts to the submit-feedback edge function. */
export function FeedbackButton({ page, slug, className }: Props) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]["id"]>("general");
  const [sending, setSending] = useState(false);

  const send = async () => {
    const text = message.trim();
    if (text.length < 3 || sending || !KEY) return;
    setSending(true);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: KEY,
          Authorization: `Bearer ${data.session?.access_token ?? KEY}`,
        },
        body: JSON.stringify({ message: text, page, slug: slug ?? undefined, kind, session_id: sessionId() }),
      });
      if (res.status === 429) { toast.error("Lots of feedback already — try again in a bit."); return; }
      if (!res.ok) throw new Error(String(res.status));
      track("feedback_sent", { page, kind, length: text.length }, data.session?.access_token);
      toast.success("Thanks — your feedback reached us.");
      setMessage("");
      setOpen(false);
    } catch {
      toast.error("Couldn't send that. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn("meta inline-flex items-center gap-2 px-3 py-2 text-muted-foreground transition-colors hover:text-foreground", className)}
        >
          <MessageSquare className="h-3.5 w-3.5" /> Send feedback
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send feedback</DialogTitle>
          <DialogDescription>Tell us what worked, what didn't, or what you wish it did.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Feedback type">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              role="radio"
              aria-checked={kind === k.id}
              onClick={() => setKind(k.id)}
              className={cn("meta border border-foreground px-3 py-1.5", kind === k.id ? "bg-foreground text-background" : "hover:bg-foreground/10")}
            >
              {k.label}
            </button>
          ))}
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
          rows={5}
          maxLength={2000}
          aria-label="Your feedback"
          className="w-full border border-foreground bg-background p-3 font-serif text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="What happened?"
        />
        <button
          type="button"
          onClick={send}
          disabled={sending || message.trim().length < 3}
          className="meta inline-flex items-center justify-center gap-2 bg-foreground px-4 py-2.5 text-background disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Send
        </button>
      </DialogContent>
    </Dialog>
  );
}
