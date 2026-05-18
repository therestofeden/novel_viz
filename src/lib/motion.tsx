import {
  motion,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  type MotionProps,
  type Variants,
} from "framer-motion";
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/* -----------------------------------------------------------
 * Editorial easings — slow, paper-like.
 * ----------------------------------------------------------*/
export const ease = {
  out: [0.16, 1, 0.3, 1] as const,
  inOut: [0.65, 0, 0.35, 1] as const,
  soft: [0.22, 1, 0.36, 1] as const,
};

/* -----------------------------------------------------------
 * Reveal — fade + lift, triggered once when in view.
 * ----------------------------------------------------------*/
type RevealProps = HTMLAttributes<HTMLDivElement> & {
  delay?: number;
  y?: number;
  duration?: number;
  as?: "div" | "section" | "header" | "li" | "ul" | "p" | "h1" | "h2" | "span";
  children: ReactNode;
};

export const Reveal = ({
  children,
  className,
  delay = 0,
  y = 18,
  duration = 0.85,
  ...rest
}: RevealProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px -10% 0px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration, delay, ease: ease.out }}
      className={className}
      {...(rest as MotionProps & HTMLAttributes<HTMLDivElement>)}
    >
      {children}
    </motion.div>
  );
};

/* -----------------------------------------------------------
 * StaggerGroup / StaggerItem — coordinated child reveals.
 * ----------------------------------------------------------*/
const groupVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: ease.out } },
};

export const StaggerGroup = ({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  return (
    <motion.div
      ref={ref}
      variants={groupVariants}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      transition={{ delayChildren: delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export const StaggerItem = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <motion.div variants={itemVariants} className={className}>
    {children}
  </motion.div>
);

/* -----------------------------------------------------------
 * MagneticButton — subtle cursor pull on hover.
 * Pure presentation: forwards all native button props.
 * ----------------------------------------------------------*/
type MagneticProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onAnimationStart" | "onAnimationEnd" | "onAnimationIteration" | "onDrag" | "onDragStart" | "onDragEnd"
> & {
  strength?: number;
  children: ReactNode;
};

export const MagneticButton = forwardRef<HTMLButtonElement, MagneticProps>(
  ({ children, className, strength = 12, onMouseMove, onMouseLeave, ...rest }, externalRef) => {
    const internalRef = useRef<HTMLButtonElement>(null);
    const ref = (externalRef as React.RefObject<HTMLButtonElement>) ?? internalRef;
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const sx = useSpring(x, { stiffness: 220, damping: 18, mass: 0.4 });
    const sy = useSpring(y, { stiffness: 220, damping: 18, mass: 0.4 });

    return (
      <motion.button
        ref={ref}
        style={{ x: sx, y: sy }}
        onMouseMove={(e) => {
          const el = ref.current;
          if (!el) return;
          const r = el.getBoundingClientRect();
          const dx = ((e.clientX - (r.left + r.width / 2)) / r.width) * strength;
          const dy = ((e.clientY - (r.top + r.height / 2)) / r.height) * strength;
          x.set(dx);
          y.set(dy);
          onMouseMove?.(e);
        }}
        onMouseLeave={(e) => {
          x.set(0);
          y.set(0);
          onMouseLeave?.(e);
        }}
        className={className}
        {...(rest as unknown as Record<string, unknown>)}
      >
        {children}
      </motion.button>
    );
  },
);
MagneticButton.displayName = "MagneticButton";

/* -----------------------------------------------------------
 * MarqueeBand — infinite horizontal ticker. Pauses on hover.
 * ----------------------------------------------------------*/
export const MarqueeBand = ({
  items,
  className,
  speed = 40,
}: {
  items: string[];
  className?: string;
  speed?: number;
}) => {
  const loop = [...items, ...items, ...items];
  return (
    <div className={cn("overflow-hidden", className)}>
      <motion.div
        className="flex gap-10 whitespace-nowrap"
        animate={{ x: ["0%", "-33.333%"] }}
        transition={{ duration: speed, ease: "linear", repeat: Infinity }}
      >
        {loop.map((t, i) => (
          <span key={i} className="meta inline-flex items-center gap-10">
            {t}
            <span className="inline-block h-1 w-1 bg-current" />
          </span>
        ))}
      </motion.div>
    </div>
  );
};

/* -----------------------------------------------------------
 * PageScrollRule — thin cobalt rule that fills with scroll.
 * Place at the top of the page (sticky).
 * ----------------------------------------------------------*/
export const PageScrollRule = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.3 });
  return (
    <motion.div
      style={{ scaleX, transformOrigin: "0% 50%" }}
      className="fixed left-0 right-0 top-0 z-[60] h-[2px] bg-primary"
      aria-hidden
    />
  );
};

/* -----------------------------------------------------------
 * KineticHeadline — character-by-character reveal of a phrase.
 * Splits on spaces (preserves words). Each word fades + lifts.
 * ----------------------------------------------------------*/
export const KineticHeadline = ({
  children,
  className,
  delay = 0,
}: {
  children: string;
  className?: string;
  delay?: number;
}) => {
  const words = children.split(" ");
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  return (
    <motion.span
      ref={ref}
      className={cn("inline-block", className)}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.045, delayChildren: delay } } }}
    >
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom">
          <motion.span
            className="inline-block"
            variants={{
              hidden: { y: "110%", opacity: 0 },
              show: { y: "0%", opacity: 1, transition: { duration: 0.85, ease: ease.out } },
            }}
          >
            {w}
            {i < words.length - 1 ? "\u00A0" : ""}
          </motion.span>
        </span>
      ))}
    </motion.span>
  );
};

/* -----------------------------------------------------------
 * useReducedMotion — respect OS preference.
 * ----------------------------------------------------------*/
export const useReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
};

/* -----------------------------------------------------------
 * ParallaxY — translates child as the page scrolls past.
 * Restrained: ±strength px range over the element's lifetime.
 * ----------------------------------------------------------*/
export const ParallaxY = ({
  children,
  className,
  strength = 40,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [strength, -strength]);
  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  );
};

export { motion };
