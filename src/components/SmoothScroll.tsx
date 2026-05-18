import { useEffect, type ReactNode } from "react";
import Lenis from "lenis";

/**
 * Lenis smooth-scroll provider.
 * Honors prefers-reduced-motion (no-op when user requests reduced motion).
 * Tuned for editorial restraint: long inertia, gentle easing.
 */
export const SmoothScroll = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      lerp: 0.1,
    });

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
};
