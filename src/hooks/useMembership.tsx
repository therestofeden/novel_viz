import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { track } from "@/lib/track";
import { MembershipDialog, type MembershipReason } from "@/components/MembershipDialog";

/**
 * NovelViz Membership (2026-11-18): EUR 2.20 a month, unlocks My Notes and
 * "Refine the visualization". The server is the gate (a shelf_books trigger
 * for notes, analyze-novel for refinement); this context only mirrors it so
 * the UI can show a lock and the way in. Admins (public.app_admins) are
 * reported as members by my_membership(), so the owner's account never sees
 * a paywall.
 */

export type MembershipState = {
  loading: boolean;
  /** Is the paywall switched on (public.app_settings.paywall_enabled)? */
  paywall: boolean;
  isMember: boolean;
  isAdmin: boolean;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasBilling: boolean;
};

type Ctx = MembershipState & {
  refresh: () => Promise<MembershipState>;
  /** Opens the membership sheet; `reason` tailors the first line. */
  openMembership: (reason?: MembershipReason) => void;
  startCheckout: () => Promise<void>;
  openBillingPortal: () => Promise<void>;
};

const EMPTY: MembershipState = {
  loading: false,
  paywall: false,
  isMember: false,
  isAdmin: false,
  status: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  hasBilling: false,
};

const MembershipCtx = createContext<Ctx>({
  ...EMPTY,
  refresh: async () => EMPTY,
  openMembership: () => {},
  startCheckout: async () => {},
  openBillingPortal: async () => {},
});

/** True inside the Capacitor iOS/Android shell, where web payments can't be offered. */
export function isNativeApp(): boolean {
  try {
    return (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

async function readFunctionError(error: unknown): Promise<{ status?: number; message?: string; code?: string }> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const j = await ctx.json();
      return { status: ctx.status, message: j?.error, code: j?.code };
    } catch {
      return { status: ctx.status };
    }
  }
  return {};
}

export const MembershipProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [state, setState] = useState<MembershipState>({ ...EMPTY, loading: true });
  const [dialog, setDialog] = useState<{ open: boolean; reason?: MembershipReason }>({ open: false });
  const [busy, setBusy] = useState(false);
  const userId = user?.id ?? null;
  const userRef = useRef(userId);
  userRef.current = userId;

  const refresh = useCallback(async (): Promise<MembershipState> => {
    // Signed-out readers ask too: the answer carries the paywall switch.
    const { data, error } = await supabase.rpc("my_membership");
    if (error || !data) {
      const next = { ...EMPTY };
      setState(next);
      return next;
    }
    const d = data as Record<string, unknown>;
    const next: MembershipState = {
      loading: false,
      paywall: d.paywall === true,
      isMember: d.is_member === true,
      isAdmin: d.is_admin === true,
      status: (d.status as string) ?? null,
      currentPeriodEnd: (d.current_period_end as string) ?? null,
      cancelAtPeriodEnd: d.cancel_at_period_end === true,
      hasBilling: d.has_billing === true,
    };
    setState(next);
    return next;
  }, []);

  useEffect(() => {
    setState((s) => ({ ...s, loading: true }));
    refresh();
  }, [userId, refresh]);

  // Coming back from Stripe: ?membership=welcome|cancelled|updated. The
  // webhook usually lands within a second or two of the redirect, so poll
  // briefly before giving up.
  useEffect(() => {
    if (!userId) return;
    const params = new URLSearchParams(window.location.search);
    const flag = params.get("membership");
    if (!flag) return;
    params.delete("membership");
    const qs = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);

    if (flag === "cancelled") {
      toast("No charge made. Membership is there whenever you want it.");
      return;
    }
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 8 && !cancelled; i++) {
        const s = await refresh();
        if (flag !== "welcome" || s.isMember) {
          if (flag === "welcome") toast.success("Welcome, member. My Notes and Refine are unlocked.");
          return;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      if (!cancelled && flag === "welcome") {
        toast("Payment received. Your membership will show up in a moment; reload if it doesn't.");
      }
    })();
    return () => { cancelled = true; };
  }, [userId, refresh]);

  const openMembership = useCallback((reason?: MembershipReason) => {
    track("membership_viewed", { reason: reason ?? "direct" });
    setDialog({ open: true, reason });
  }, []);

  const goTo = useCallback(async (action: "checkout" | "portal") => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("membership", {
        body: { action, return_path: window.location.pathname + window.location.search },
        signal: AbortSignal.timeout(15_000),
      });
      if (error) {
        const e = await readFunctionError(error);
        if (e.code === "not_configured") toast("Membership opens soon. Thanks for wanting in.");
        else toast.error(e.message ?? "Couldn't open the payment page. Please try again.");
        return;
      }
      if (data?.already_member) {
        await refresh();
        toast.success("You're already a member.");
        setDialog({ open: false });
        return;
      }
      if (data?.url) {
        if (action === "checkout") track("membership_checkout", {});
        window.location.assign(data.url as string);
      }
    } catch {
      toast.error("Couldn't open the payment page. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const startCheckout = useCallback(() => goTo("checkout"), [goTo]);
  const openBillingPortal = useCallback(() => goTo("portal"), [goTo]);

  return (
    <MembershipCtx.Provider value={{ ...state, refresh, openMembership, startCheckout, openBillingPortal }}>
      {children}
      <MembershipDialog
        open={dialog.open}
        reason={dialog.reason}
        onClose={() => setDialog({ open: false })}
        signedIn={!!userId}
        state={state}
        busy={busy}
        native={isNativeApp()}
        onCheckout={startCheckout}
        onPortal={openBillingPortal}
      />
    </MembershipCtx.Provider>
  );
};

export const useMembership = () => useContext(MembershipCtx);
