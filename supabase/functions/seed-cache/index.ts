// Cache seeder — pre-populates novel_analyses for popular books so users
// get instant results on their first search.
//
// Trigger manually:
//   curl -X POST https://ecsublyvcvzdkvggxwlh.supabase.co/functions/v1/seed-cache \
//     -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
//     -H "x-seed-secret: <SEED_SECRET>" \
//     -H "Content-Type: application/json" \
//     -d '{"batch": 10, "delay_ms": 3000}'
//
// Required Supabase secret: SEED_SECRET (any random string you choose)
// Optional body params:
//   batch     — books to process per run (default 10, max 50)
//   delay_ms  — ms between Gemini calls (default 3000, min 1000)
//   dry_run   — true → only report what would be seeded, no Gemini calls

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-seed-secret",
};

// The warmup book list (~2100 popular books across all major genres) lives in
// the seed_book_list table, not hardcoded in this file. It previously lived
// as a single POPULAR_BOOKS array (then split into _books/part{1..4}.ts) —
// both approaches kept hitting deploy_edge_function's chat-transport size
// limits every time the list grew via canon curation (per-file ~50-60KB limit,
// AND a separate aggregate all-files-in-one-call output-token limit discovered
// 2026-08-25 that the 4-file split didn't solve). Moving the list into the DB
// means future growth is just an INSERT — this file never needs to change or
// be redeployed for list growth again. See
// novelviz-seedcache-db-backed-list-2026-08-25 memory for the migration.
function parseBook(entry: string): { title: string; author: string; cacheKey: string } {
  const byIdx = entry.lastIndexOf(" by ");
  if (byIdx === -1) return { title: entry, author: "", cacheKey: buildCacheKey(entry, "") };
  const title = entry.slice(0, byIdx).trim();
  const author = entry.slice(byIdx + 4).trim();
  return { title, author, cacheKey: buildCacheKey(title, author) };
}

// Must match analyze-novel's CACHE_VERSION + buildCacheKey exactly.
const CACHE_VERSION = "v3";
function buildCacheKey(title: string, author: string): string {
  const t = title.trim().toLowerCase().replace(/\s+/g, " ");
  const a = (author ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return `${CACHE_VERSION}|${t}||${a}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Require the seed secret to prevent abuse.
  // Set SEED_SECRET in Supabase Dashboard → Project Settings → Edge Functions → Secrets.
  const secret = req.headers.get("x-seed-secret") ?? "";
  const expectedSecret = Deno.env.get("SEED_SECRET") ?? "";
  const authorized = expectedSecret.length > 0 && secret === expectedSecret;
  if (!authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const batchSize = Math.min(Number(body?.batch ?? 10), 50);
  const delayMs = Math.max(Number(body?.delay_ms ?? 3000), 1000);
  const dryRun = !!body?.dry_run;
  // offset: skip the first N uncached books — used to fan out parallel seeding runs.
  const offset = Math.max(0, Number(body?.offset ?? 0));

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  if (!GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch the warmup list from the DB (paginate past PostgREST's default 1000-row cap).
  const POPULAR_BOOKS: string[] = [];
  {
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data: page, error: listErr } = await supabase
        .from("seed_book_list")
        .select("entry")
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (listErr) {
        return new Response(JSON.stringify({ error: `seed_book_list read failed: ${listErr.message}` }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!page || page.length === 0) break;
      for (const row of page) POPULAR_BOOKS.push(row.entry as string);
      if (page.length < PAGE) break;
    }
  }

  // Fetch all already-cached keys in one query.
  const { data: cached } = await supabase
    .from("novel_analyses")
    .select("cache_key")
    .eq("is_validated", true);

  const cachedKeys = new Set((cached ?? []).map((r: any) => r.cache_key));

  const allBooks = POPULAR_BOOKS.map(parseBook);
  const pending = allBooks.filter((b) => !cachedKeys.has(b.cacheKey));
  const batch = pending.slice(offset, offset + batchSize);

  if (dryRun) {
    return new Response(JSON.stringify({
      total: allBooks.length,
      already_cached: allBooks.length - pending.length,
      pending: pending.length,
      offset,
      would_process: batch.map((b) => b.title),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Process the batch by calling the analyze-novel function for each book.
  const ANALYZE_URL = `${SUPABASE_URL}/functions/v1/analyze-novel`;
  const results: Array<{ title: string; status: string }> = [];

  for (const book of batch) {
    try {
      const r = await fetch(ANALYZE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Use the service role key so analyze-novel can identify this as an
          // internal seeder call and bypass the per-IP prefetch rate limit.
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ title: `${book.title} by ${book.author}`, prefetch: true }),
        // analyze-novel's own Gemini fallback chain is bounded at 3 models x 30s
        // (GEMINI_TIMEOUT_MS in _shared/gemini.ts) = 90s worst case. Without this,
        // a stuck downstream call hangs this loop (and the whole batch) forever —
        // same unbounded-fetch bug class fixed repeatedly in search-books/
        // recommend-by-dna/dna-consensus. 100s gives headroom over the 90s ceiling.
        signal: AbortSignal.timeout(100_000),
      });

      // Drain the SSE stream (analyze-novel streams; we only care it completed).
      const text = await r.text();
      const success = text.includes('"analysis"') || text.includes('"cached":true');
      results.push({ title: book.title, status: success ? "seeded" : "skipped" });
    } catch (e) {
      results.push({ title: book.title, status: "error" });
      console.error("seed error", book.title, e);
    }

    // Delay between calls to avoid hammering Gemini.
    if (batch.indexOf(book) < batch.length - 1) {
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }

  return new Response(JSON.stringify({
    total: allBooks.length,
    already_cached: allBooks.length - pending.length,
    pending_after_run: pending.length - batch.length,
    processed: results,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
