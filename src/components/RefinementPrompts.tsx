import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const PROMPTS = [
  "Explain the narrative timelines",
  "Who is the protagonist and why?",
  "Show how the storylines intersect",
  "Focus on the major characters only",
  "Explain the ending",
  "What are the key themes & symbols?",
  "Compare the different POVs",
  "Highlight the central conflict",
];

interface Props {
  onPick: (prompt: string) => void;
  disabled?: boolean;
}

export const RefinementPrompts = ({ onPick, disabled }: Props) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <Sparkles className="h-3 w-3" />
        Refine the visualization
      </div>
      <div className="flex flex-wrap gap-2">
        {PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => onPick(p)}
            disabled={disabled}
            className={cn(
              "rounded-full border border-border bg-card px-3 py-1.5 text-xs transition-all",
              "hover:border-primary hover:bg-primary/5 hover:text-primary",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
};
