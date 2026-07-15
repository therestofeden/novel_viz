import { useState } from "react";
import { Loader2, Key, ExternalLink, Eye, EyeOff, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  open: boolean;
  onClose: () => void;
}

export const GeminiKeyDialog = ({ open, onClose }: Props) => {
  const { geminiKey, setGeminiKey } = useAuth();
  const [value, setValue] = useState(geminiKey ?? "");
  const [saving, setSaving] = useState(false);
  const [show, setShow] = useState(false);

  if (!open) return null;

  const handleSave = async () => {
    const trimmed = value.trim();
    if (!trimmed) {
      toast.error("Please enter your Gemini API key.");
      return;
    }
    setSaving(true);
    try {
      await setGeminiKey(trimmed);
      toast.success("Gemini key saved — all AI features will now use your quota.");
      onClose();
    } catch {
      toast.error("Failed to save key. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    try {
      await setGeminiKey(null);
      setValue("");
      toast.success("Gemini key removed.");
      onClose();
    } catch {
      toast.error("Failed to remove key.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="ink-border mx-4 w-full max-w-lg bg-background">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-foreground px-6 py-4">
          <Key className="h-4 w-4" />
          <div>
            <div className="font-sans text-base font-bold leading-none">Your Gemini API Key</div>
            <div className="meta mt-1 text-muted-foreground">AI features use your personal Google AI quota</div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-4">
          <p className="font-serif text-sm leading-relaxed text-muted-foreground">
            NovelViz uses Google Gemini to analyse books. Paste your API key below and all AI
            calls go against your own free quota — no shared limits.
          </p>

          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="meta inline-flex items-center gap-1.5 text-primary hover:underline text-xs"
          >
            Get a free key at Google AI Studio <ExternalLink className="h-3 w-3" />
          </a>

          {/* Key input */}
          <div className="ink-border flex items-center">
            <input
              type={show ? "text" : "password"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="AIza…"
              className="flex-1 bg-transparent px-4 py-3 font-mono text-sm placeholder:text-muted-foreground/60 focus:outline-none"
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="px-3 text-muted-foreground hover:text-foreground"
              aria-label={show ? "Hide key" : "Show key"}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {geminiKey && (
            <div className="meta flex items-center gap-1.5 text-xs text-muted-foreground">
              <Check className="h-3 w-3 text-green-600" />
              A key is currently saved. Replace it above or remove it.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-0 border-t border-foreground">
          {geminiKey && (
            <button
              onClick={handleRemove}
              disabled={saving}
              className="meta flex-1 border-r border-foreground px-4 py-3 text-sm hover:bg-foreground/10 disabled:opacity-50"
            >
              Remove key
            </button>
          )}
          <button
            onClick={onClose}
            disabled={saving}
            className="meta flex-1 border-r border-foreground px-4 py-3 text-sm hover:bg-foreground/10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !value.trim()}
            className="meta flex flex-1 items-center justify-center gap-2 bg-foreground px-4 py-3 text-sm text-background hover:bg-ink-blue disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save key"}
          </button>
        </div>
      </div>
    </div>
  );
};
