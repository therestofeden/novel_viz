import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, Copy, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  NonFictionAnalysis,
  NovelAnalysis,
  TakeawayAnswer,
  TakeawayQuestion,
  isNonFiction,
} from "@/lib/novel-types";

const ReactMarkdown = lazy(() => import("react-markdown"));

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase =
  | "idle"
  | "loading_questions"
  | "answering"
  | "synthesizing"
  | "done";

interface Props {
  analysis: NovelAnalysis;
  cacheKey: string | null;
}

// ─── Progress dots ────────────────────────────────────────────────────────────

function QuestionProgress({
  total,
  current,
}: {
  total: number;
  current: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "block h-1.5 w-1.5 rounded-full transition-colors",
            i < current
              ? "bg-primary"
              : i === current
                ? "bg-foreground"
                : "bg-foreground/20",
          )}
        />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TakeawaysTab({ analysis, cacheKey }: Props) {
  const { geminiKey } = useAuth();
  const [phase, setPhase] = useState<Phase>("idle");
  const [questions, setQuestions] = useState<TakeawayQuestion[]>([]);
  const [answers, setAnswers] = useState<TakeawayAnswer[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [freeNotes, setFreeNotes] = useState("");
  const [takewaysText, setTakewaysText] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamRef = useRef<boolean>(false);

  const nonfiction = isNonFiction(analysis);
  const thesis = nonfiction ? (analysis as NonFictionAnalysis).thesis : undefined;

  // ── Load existing session on mount ────────────────────────────────────────
  useEffect(() => {
    if (!cacheKey) return;
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;
      const { data } = await supabase
        .from("book_takeaways")
        .select("questions, answers, free_notes, takeaways, status")
        .eq("cache_key", cacheKey)
        .maybeSingle();
      if (!data) return;
      if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
        setQuestions(data.questions as TakeawayQuestion[]);
        if (data.answers && Array.isArray(data.answers)) {
          setAnswers(data.answers as TakeawayAnswer[]);
        }
        if (data.free_notes) setFreeNotes(data.free_notes);
        if (data.takeaways && data.status === "complete") {
          setTakewaysText(data.takeaways);
          setPhase("done");
        } else if (data.questions.length > 0) {
          // Resume answering
          const answered = new Set(
            (data.answers as TakeawayAnswer[] ?? []).map((a) => a.questionId),
          );
          const nextUnanswered = (data.questions as TakeawayQuestion[]).findIndex(
            (q) => !answered.has(q.id),
          );
          setCurrentQ(nextUnanswered === -1 ? data.questions.length : nextUnanswered);
          setPhase("answering");
        }
      }
    })();
  }, [cacheKey]);

  // Focus textarea when entering answering phase or moving to next question
  useEffect(() => {
    if (phase === "answering") {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [phase, currentQ]);

  // ── Start: fetch questions ─────────────────────────────────────────────────
  const startSession = useCallback(async () => {
    setPhase("loading_questions");

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      toast.error("Sign in to use Takeaways");
      setPhase("idle");
      return;
    }

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/takeaways`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          phase: "questions",
          title: analysis.title,
          author: analysis.author,
          bookType: analysis.bookType,
          summary: analysis.summary,
          thesis,
          cacheKey,
          ...(geminiKey ? { gemini_key: geminiKey } : {}),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const json = await res.json();
      const qs: TakeawayQuestion[] = json.questions ?? [];
      if (qs.length === 0) throw new Error("No questions returned");

      setQuestions(qs);
      // Restore existing answers if the server returned them
      if (json.existingAnswers?.length > 0) setAnswers(json.existingAnswers);
      if (json.freeNotes) setFreeNotes(json.freeNotes);
      if (json.takeaways && json.status === "complete") {
        setTakewaysText(json.takeaways);
        setPhase("done");
        return;
      }

      setCurrentQ(0);
      setCurrentAnswer("");
      setPhase("answering");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to start session");
      setPhase("idle");
    }
  }, [analysis, cacheKey, thesis]);

  // ── Submit answer for current question ────────────────────────────────────
  const submitAnswer = useCallback(() => {
    const q = questions[currentQ];
    if (!q) return;
    const trimmed = currentAnswer.trim();
    // Allow skipping with empty answer
    setAnswers((prev) => {
      const next = prev.filter((a) => a.questionId !== q.id);
      if (trimmed) next.push({ questionId: q.id, answer: trimmed });
      return next;
    });
    setCurrentAnswer("");
    setCurrentQ((n) => n + 1);
  }, [questions, currentQ, currentAnswer]);

  // ── Synthesize ────────────────────────────────────────────────────────────
  const synthesize = useCallback(async () => {
    setPhase("synthesizing");
    setStreamingText("");
    streamRef.current = true;

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      toast.error("Sign in to generate takeaways");
      setPhase("answering");
      return;
    }

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/takeaways`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          phase: "synthesize",
          title: analysis.title,
          author: analysis.author,
          bookType: analysis.bookType,
          summary: analysis.summary,
          thesis,
          questions,
          answers,
          freeNotes,
          cacheKey,
          ...(geminiKey ? { gemini_key: geminiKey } : {}),
        }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let fullText = "";

      while (streamRef.current) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          try {
            const parsed = JSON.parse(json);
            if (parsed.text) {
              fullText += parsed.text;
              setStreamingText(fullText);
            }
            if (parsed.takeaways) {
              fullText = parsed.takeaways;
              setStreamingText(fullText);
            }
          } catch { /* partial */ }
        }
      }

      setTakewaysText(fullText);
      setPhase("done");
    } catch (e: any) {
      toast.error(e.message ?? "Synthesis failed");
      setPhase("answering");
    }
  }, [analysis, questions, answers, freeNotes, cacheKey, thesis]);

  // Cleanup stream on unmount
  useEffect(() => () => { streamRef.current = false; }, []);

  // ── Restart ───────────────────────────────────────────────────────────────
  const restart = useCallback(async () => {
    if (cacheKey) {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        await supabase
          .from("book_takeaways")
          .delete()
          .eq("cache_key", cacheKey);
      }
    }
    setPhase("idle");
    setQuestions([]);
    setAnswers([]);
    setCurrentQ(0);
    setCurrentAnswer("");
    setFreeNotes("");
    setTakewaysText("");
    setStreamingText("");
  }, [cacheKey]);

  // ── Copy to clipboard ─────────────────────────────────────────────────────
  const copyTakeaways = useCallback(() => {
    navigator.clipboard.writeText(takewaysText).then(() => {
      toast.success("Copied to clipboard");
    });
  }, [takewaysText]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  // ── Idle ──────────────────────────────────────────────────────────────────
  if (phase === "idle") {
    return (
      <div className="flex flex-col items-start gap-6 px-4 py-8 md:px-8 md:py-12">
        <div className="max-w-xl">
          <p className="font-serif text-sm italic text-muted-foreground">
            Your Takeaways
          </p>
          <h2 className="mt-2 font-sans text-2xl font-bold tracking-tight">
            What did this book mean to you?
          </h2>
          <p className="mt-3 font-serif text-sm leading-relaxed text-foreground/80">
            This isn't a quiz. Gemini will ask you a few questions specific to{" "}
            <em>{analysis.title}</em>, you'll share your thoughts, and together
            you'll craft a personal takeaways document — something you can come
            back to years from now.
          </p>
          <ul className="mt-4 space-y-1 font-sans text-xs text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="h-px w-4 bg-foreground/30" />4–5 questions tailored to this book
            </li>
            <li className="flex items-center gap-2">
              <span className="h-px w-4 bg-foreground/30" />Your answers, in your own words
            </li>
            <li className="flex items-center gap-2">
              <span className="h-px w-4 bg-foreground/30" />AI synthesises it into a personal document
            </li>
          </ul>
        </div>
        <button
          onClick={startSession}
          className="meta flex items-center gap-2 border border-foreground bg-card px-5 py-3 transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Start reflection
        </button>
      </div>
    );
  }

  // ── Loading questions ──────────────────────────────────────────────────────
  if (phase === "loading_questions") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-4 py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="meta text-muted-foreground">
          Preparing your questions…
        </p>
      </div>
    );
  }

  // ── Answering ─────────────────────────────────────────────────────────────
  if (phase === "answering") {
    const isFreeNotesStep = currentQ >= questions.length;
    const answeredCount = answers.length;

    return (
      <div className="flex flex-col gap-0">
        {/* Header strip */}
        <div className="ink-border-b flex items-center justify-between px-4 py-3">
          <div className="meta text-muted-foreground">
            {isFreeNotesStep
              ? "Almost done"
              : `Question ${currentQ + 1} of ${questions.length}`}
          </div>
          <QuestionProgress
            total={questions.length + 1}
            current={isFreeNotesStep ? questions.length : currentQ}
          />
        </div>

        {/* Answered questions (collapsed) */}
        {answers.length > 0 && !isFreeNotesStep && (
          <div className="ink-border-b bg-card/50 px-4 py-3">
            <div className="meta mb-2 text-muted-foreground">Answered</div>
            <div className="space-y-2">
              {questions.slice(0, currentQ).map((q, i) => {
                const ans = answers.find((a) => a.questionId === q.id);
                return (
                  <div key={q.id} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                    <div>
                      <p className="font-sans text-xs font-medium text-foreground/60">
                        {q.question}
                      </p>
                      {ans && (
                        <p className="mt-0.5 font-serif text-xs italic text-muted-foreground line-clamp-1">
                          {ans.answer}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Active question */}
        <div className="px-4 py-6 md:px-8 md:py-10">
          {isFreeNotesStep ? (
            <>
              <p className="font-serif text-sm italic text-muted-foreground">
                Anything else?
              </p>
              <p className="mt-3 font-sans text-lg font-semibold leading-snug text-foreground">
                Any raw notes, quotes you highlighted, or thoughts you want included — paste them here.
              </p>
              <p className="mt-1 font-sans text-xs text-muted-foreground">
                Optional. The more you share, the more personal your takeaways will be.
              </p>
              <textarea
                ref={textareaRef}
                value={freeNotes}
                onChange={(e) => setFreeNotes(e.target.value)}
                placeholder="Paste your highlights, margin notes, or anything on your mind…"
                rows={6}
                className="mt-4 w-full resize-none border border-foreground/30 bg-card px-3 py-2 font-serif text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-foreground focus:outline-none"
              />
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={synthesize}
                  className="meta flex items-center gap-2 border border-foreground bg-card px-5 py-2.5 transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Generate my takeaways
                </button>
                <button
                  onClick={synthesize}
                  className="meta text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Skip
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="font-serif text-sm italic text-muted-foreground">
                Question {currentQ + 1}
              </p>
              <p className="mt-3 font-sans text-lg font-semibold leading-snug text-foreground">
                {questions[currentQ]?.question}
              </p>
              <textarea
                ref={textareaRef}
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitAnswer();
                }}
                placeholder="Your thoughts…"
                rows={4}
                className="mt-4 w-full resize-none border border-foreground/30 bg-card px-3 py-2 font-serif text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-foreground focus:outline-none"
              />
              <div className="mt-1 flex items-center justify-between">
                <p className="meta text-xs text-muted-foreground">
                  ⌘↵ to continue
                </p>
                <p className="meta text-xs text-muted-foreground">
                  {currentAnswer.length} chars
                </p>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={submitAnswer}
                  className="meta flex items-center gap-2 border border-foreground bg-card px-5 py-2.5 transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  Continue
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                {currentAnswer.trim() === "" && (
                  <button
                    onClick={submitAnswer}
                    className="meta text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    Skip question
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Synthesizing ──────────────────────────────────────────────────────────
  if (phase === "synthesizing") {
    return (
      <div className="flex flex-col gap-0">
        <div className="ink-border-b flex items-center gap-2 px-4 py-3">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          <span className="meta text-muted-foreground">
            Distilling your takeaways…
          </span>
        </div>
        {streamingText && (
          <div className="px-4 py-6 md:px-8 md:py-10">
            <div className="prose prose-sm max-w-2xl font-serif text-foreground prose-headings:font-sans prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-foreground prose-strong:text-foreground prose-a:text-primary">
              <Suspense fallback={<span className="text-muted-foreground">…</span>}>
                <ReactMarkdown>{streamingText}</ReactMarkdown>
              </Suspense>
            </div>
          </div>
        )}
        {!streamingText && (
          <div className="flex items-center justify-center px-4 py-16">
            <div className="space-y-1 text-center">
              <BookOpen className="mx-auto h-6 w-6 text-muted-foreground/40" />
              <p className="meta text-xs text-muted-foreground">Reading your answers…</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-0">
      {/* Toolbar */}
      <div className="ink-border-b flex items-center justify-between px-4 py-3">
        <div className="meta flex items-center gap-2 text-primary">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Your Takeaways
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={copyTakeaways}
            className="meta flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Copy className="h-3 w-3" />
            Copy
          </button>
          <button
            onClick={restart}
            className="meta flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <RefreshCw className="h-3 w-3" />
            Start over
          </button>
        </div>
      </div>

      {/* Document */}
      <div className="px-4 py-6 md:px-8 md:py-10">
        <div className="prose prose-sm max-w-2xl font-serif text-foreground prose-headings:font-sans prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-foreground prose-strong:text-foreground prose-a:text-primary prose-li:marker:text-foreground/40 md:prose-base">
          <Suspense fallback={<span className="text-muted-foreground">…</span>}>
            <ReactMarkdown>{takewaysText}</ReactMarkdown>
          </Suspense>
        </div>
      </div>

      {/* Source Q&A accordion */}
      <details className="ink-border-t group">
        <summary className="meta flex cursor-pointer items-center gap-2 px-4 py-3 text-muted-foreground hover:text-foreground">
          <span className="transition-transform group-open:rotate-90">›</span>
          View your answers
        </summary>
        <div className="border-t border-foreground/10 px-4 pb-6 pt-4 md:px-8">
          <div className="space-y-5">
            {questions.map((q) => {
              const ans = answers.find((a) => a.questionId === q.id);
              return (
                <div key={q.id}>
                  <p className="font-sans text-xs font-semibold text-foreground/60">
                    {q.question}
                  </p>
                  <p className="mt-1 font-serif text-sm italic text-foreground/80">
                    {ans?.answer ?? <span className="text-muted-foreground">—</span>}
                  </p>
                </div>
              );
            })}
            {freeNotes && (
              <div>
                <p className="font-sans text-xs font-semibold text-foreground/60">
                  Free notes
                </p>
                <p className="mt-1 font-serif text-sm italic text-foreground/80">
                  {freeNotes}
                </p>
              </div>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}
