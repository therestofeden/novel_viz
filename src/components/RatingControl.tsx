import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Props {
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  /** Extra classes for the trigger (e.g. group-hover inversions on shelf rows). */
  className?: string;
}

/**
 * Editorial 0–10 rating control. NULL = unrated; 0 is a legitimate verdict.
 * Collapsed: "Rate" chip or the current score as an oversized numeral.
 * Open: a hard-ruled strip of 0–10, plus Clear when a score exists.
 */
export const RatingControl = ({ value, onChange, disabled, className }: Props) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={disabled}
          aria-label={value === null ? "Rate this book (0–10)" : `Rated ${value} out of 10 — change`}
          className={cn(
            "meta inline-flex items-baseline gap-1 border px-1.5 py-0.5 transition-colors disabled:opacity-50",
            value === null
              ? "border-foreground/40 text-foreground/60 hover:border-foreground hover:bg-foreground hover:text-background"
              : "border-foreground bg-card text-foreground hover:bg-foreground hover:text-background",
            className,
          )}
        >
          {value === null ? (
            <>☆ Rate</>
          ) : (
            <>
              <span className="display-num text-sm leading-none">{value}</span>
              <span className="opacity-60">/10</span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-auto rounded-none border-foreground bg-card p-0 shadow-none"
      >
        <div className="flex items-stretch">
          {Array.from({ length: 11 }, (_, n) => (
            <button
              key={n}
              onClick={() => {
                onChange(n);
                setOpen(false);
              }}
              aria-label={`Rate ${n} out of 10`}
              className={cn(
                "display-num min-w-[2rem] border-r border-foreground/30 px-1.5 py-2 text-sm transition-colors last:border-r-0 hover:bg-foreground hover:text-background",
                value === n && "bg-primary text-primary-foreground",
              )}
            >
              {n}
            </button>
          ))}
          {value !== null && (
            <button
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              aria-label="Clear rating"
              className="meta border-l border-foreground px-2 hover:bg-destructive hover:text-destructive-foreground"
            >
              ×
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
