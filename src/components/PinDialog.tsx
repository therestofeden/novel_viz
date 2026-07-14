import { useEffect, useState } from "react";
import { Pin as PinIcon, X, Trash2 } from "lucide-react";

interface Props {
  open: boolean;
  characterName: string;
  initialNote: string;
  isPinned: boolean;
  onClose: () => void;
  onSave: (note: string) => void | Promise<void>;
  onRemove?: () => void | Promise<void>;
}

export const PinDialog = ({
  open,
  characterName,
  initialNote,
  isPinned,
  onClose,
  onSave,
  onRemove,
}: Props) => {
  const [note, setNote] = useState(initialNote);

  useEffect(() => {
    if (open) setNote(initialNote);
  }, [open, initialNote]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-foreground/40 px-4 py-6 md:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md ink-border bg-card animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-foreground px-4 py-3">
          <div className="meta flex items-center gap-2 text-primary">
            <PinIcon className="h-3.5 w-3.5" />
            {isPinned ? "Edit pin" : "Pin character"}
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 py-4">
          <div className="font-serif text-2xl italic leading-tight">{characterName}</div>
          <div className="meta mt-1 text-muted-foreground">Your private note</div>
          <textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What do you want to remember about this character?"
            rows={4}
            className="mt-3 w-full border border-foreground bg-background px-3 py-2 font-serif text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            {isPinned && onRemove ? (
              <button
                onClick={async () => {
                  await onRemove();
                  onClose();
                }}
                className="meta inline-flex items-center gap-1.5 border border-foreground px-3 py-2 text-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                <Trash2 className="h-3 w-3" /> Remove
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="meta border border-foreground px-3 py-2 hover:bg-foreground hover:text-background"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await onSave(note.trim());
                  onClose();
                }}
                className="meta border border-foreground bg-primary px-4 py-2 text-primary-foreground hover:bg-ink-blue"
              >
                {isPinned ? "Save" : "Pin it"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
