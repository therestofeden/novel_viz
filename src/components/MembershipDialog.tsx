import { Link } from "react-router-dom";
import { Check, Loader2, PenLine, Sparkles, X } from "lucide-react";

import type { MembershipState } from "@/hooks/useMembership";

export type MembershipReason = "notes" | "refine";

/** Shown in the sheet and on the Shelf page. One place to change the price. */
export const MEMBERSHIP_PRICE = "€2.20";

const LEADS: Record<MembershipReason, string> = {
  notes: "My Notes is part of NovelViz Membership.",
  refine: "Refining a map is part of NovelViz Membership.",
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return null;
  }
}

/**
 * The membership sheet. Same paper-and-ink frame as the Gemini key dialog.
 * Four states: signed out, member, not a member, and inside the native app
 * (where store rules don't allow a web checkout, so there is no buy button).
 */
export function MembershipDialog({
  open,
  reason,
  onClose,
  signedIn,
  state,
  busy,
  native,
  onCheckout,
  onPortal,
}: {
  open: boolean;
  reason?: MembershipReason;
  onClose: () => void;
  signedIn: boolean;
  state: MembershipState;
  busy: boolean;
  native: boolean;
  onCheckout: () => void;
  onPortal: () => void;
}) {
  if (!open) return null;
  const until = formatDate(state.currentPeriodEnd);
  const next = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="membership-title"
    >
      <div className="ink-border w-full max-w-md bg-background sm:mx-4">
        <div className="flex items-start justify-between gap-4 border-b border-foreground px-6 py-4">
          <div>
            <div id="membership-title" className="font-serif text-2xl leading-tight">NovelViz Membership</div>
            <div className="meta mt-1 text-muted-foreground">{MEMBERSHIP_PRICE} a month</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 items-center justify-center hover:bg-foreground/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-6">
          {state.isMember ? (
            <>
              <p className="font-serif text-base leading-relaxed">
                {state.isAdmin
                  ? "You have full access as the owner of NovelViz."
                  : state.cancelAtPeriodEnd && until
                    ? `You're a member until ${until}. Your membership won't renew.`
                    : until
                      ? `You're a member. It renews on ${until}.`
                      : "You're a member."}
              </p>
              <Perks />
              {!state.isAdmin && state.hasBilling && !native && (
                <button
                  type="button"
                  onClick={onPortal}
                  disabled={busy}
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 border border-foreground px-4 py-2.5 text-sm font-medium hover:bg-foreground/10 disabled:opacity-60"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Cancel or manage membership
                </button>
              )}
            </>
          ) : (
            <>
              <p className="font-serif text-base leading-relaxed">
                {reason ? `${LEADS[reason]} ` : ""}
                It keeps the AI behind every map running, and unlocks two things:
              </p>
              <Perks />

              {!signedIn ? (
                <Link
                  to={`/auth?next=${encodeURIComponent(next)}`}
                  onClick={onClose}
                  className="flex min-h-[44px] w-full items-center justify-center border-2 border-foreground bg-foreground px-4 py-2.5 text-sm font-bold text-background hover:brightness-90"
                >
                  Sign in to become a member
                </Link>
              ) : native ? (
                <p className="text-sm text-muted-foreground">Membership isn't available in the app yet.</p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onCheckout}
                    disabled={busy}
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 border-2 border-foreground bg-foreground px-4 py-2.5 text-sm font-bold text-background hover:brightness-90 disabled:opacity-60"
                  >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    Become a member · {MEMBERSHIP_PRICE}/month
                  </button>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Paid monthly through Stripe, taxes included. Cancel anytime from your shelf; you keep access until the
                    end of the month you paid for, and you can always read and delete your notes.
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Perks() {
  return (
    <ul className="space-y-3">
      <li className="flex gap-3">
        <PenLine className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="text-sm leading-relaxed">
          <span className="font-medium">My Notes</span> on every book: your thoughts, quotes and questions, saved as you type.
        </span>
      </li>
      <li className="flex gap-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="text-sm leading-relaxed">
          <span className="font-medium">Refine the visualization</span>: ask for the timelines, the ending, the major characters, and get the map redrawn.
        </span>
      </li>
      <li className="flex gap-3 text-muted-foreground">
        <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="text-sm leading-relaxed">Everything else stays free.</span>
      </li>
    </ul>
  );
}
