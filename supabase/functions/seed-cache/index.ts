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
//   batch     — books to process per run (default 10, max 30)
//   delay_ms  — ms between Gemini calls (default 3000, min 1000)
//   dry_run   — true → only report what would be seeded, no Gemini calls

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-seed-secret",
};

// ~200 popular books across fiction + nonfiction.
// Sorted roughly by expected search frequency — top entries are seeded first.
const POPULAR_BOOKS = [
  // ── Nonfiction essentials ──
  "Sapiens by Yuval Noah Harari",
  "Thinking, Fast and Slow by Daniel Kahneman",
  "Atomic Habits by James Clear",
  "The Power of Now by Eckhart Tolle",
  "Man's Search for Meaning by Viktor Frankl",
  "Educated by Tara Westover",
  "Becoming by Michelle Obama",
  "The Alchemist by Paulo Coelho",
  "Homo Deus by Yuval Noah Harari",
  "21 Lessons for the 21st Century by Yuval Noah Harari",
  "The Subtle Art of Not Giving a F*ck by Mark Manson",
  "Outliers by Malcolm Gladwell",
  "The Tipping Point by Malcolm Gladwell",
  "Blink by Malcolm Gladwell",
  "David and Goliath by Malcolm Gladwell",
  "Talking to Strangers by Malcolm Gladwell",
  "Deep Work by Cal Newport",
  "Digital Minimalism by Cal Newport",
  "A World Without Email by Cal Newport",
  "Quiet by Susan Cain",
  "Daring Greatly by Brené Brown",
  "The Gifts of Imperfection by Brené Brown",
  "Start With Why by Simon Sinek",
  "Leaders Eat Last by Simon Sinek",
  "The Infinite Game by Simon Sinek",
  "Zero to One by Peter Thiel",
  "The Hard Thing About Hard Things by Ben Horowitz",
  "Good to Great by Jim Collins",
  "Built to Last by Jim Collins",
  "The Lean Startup by Eric Ries",
  "Rework by Jason Fried and David Heinemeier Hansson",
  "The E-Myth Revisited by Michael E. Gerber",
  "Thinking in Bets by Annie Duke",
  "Principles by Ray Dalio",
  "The 4-Hour Workweek by Tim Ferriss",
  "Tools of Titans by Tim Ferriss",
  "The Psychology of Money by Morgan Housel",
  "Rich Dad Poor Dad by Robert Kiyosaki",
  "The Millionaire Next Door by Thomas J. Stanley",
  "A Random Walk Down Wall Street by Burton Malkiel",
  "The Body Keeps the Score by Bessel van der Kolk",
  "Why We Sleep by Matthew Walker",
  "Lifespan by David Sinclair",
  "The Anxious Generation by Jonathan Haidt",
  "How to Win Friends and Influence People by Dale Carnegie",
  "Never Split the Difference by Chris Voss",
  "Getting to Yes by Roger Fisher",
  "Crucial Conversations by Kerry Patterson",
  "The 7 Habits of Highly Effective People by Stephen Covey",
  "The 48 Laws of Power by Robert Greene",
  "Mastery by Robert Greene",
  "The Art of War by Sun Tzu",
  "Meditations by Marcus Aurelius",
  "Letters from a Stoic by Seneca",
  "Nicomachean Ethics by Aristotle",
  "The Republic by Plato",
  "Thus Spoke Zarathustra by Friedrich Nietzsche",
  "The Communist Manifesto by Karl Marx",
  "The Wealth of Nations by Adam Smith",
  "On the Origin of Species by Charles Darwin",
  "A Brief History of Time by Stephen Hawking",
  "The Grand Design by Stephen Hawking",
  "The Selfish Gene by Richard Dawkins",
  "Guns, Germs, and Steel by Jared Diamond",
  "The Rise and Fall of the Third Reich by William L. Shirer",
  "Team of Rivals by Doris Kearns Goodwin",
  "The Warmth of Other Suns by Isabel Wilkerson",
  "Between the World and Me by Ta-Nehisi Coates",
  "Just Mercy by Bryan Stevenson",
  "The New Jim Crow by Michelle Alexander",
  "I Know Why the Caged Bird Sings by Maya Angelou",
  "Long Walk to Freedom by Nelson Mandela",
  "The Diary of a Young Girl by Anne Frank",
  "Night by Elie Wiesel",
  "When Breath Becomes Air by Paul Kalanithi",
  "The Year of Magical Thinking by Joan Didion",
  "Lab Girl by Hope Jahren",
  "The Innovators by Walter Isaacson",
  "Steve Jobs by Walter Isaacson",
  "Elon Musk by Walter Isaacson",
  "Leonardo da Vinci by Walter Isaacson",
  "Einstein by Walter Isaacson",

  // ── Classic fiction ──
  "To Kill a Mockingbird by Harper Lee",
  "1984 by George Orwell",
  "Animal Farm by George Orwell",
  "Brave New World by Aldous Huxley",
  "The Great Gatsby by F. Scott Fitzgerald",
  "Of Mice and Men by John Steinbeck",
  "The Grapes of Wrath by John Steinbeck",
  "East of Eden by John Steinbeck",
  "The Catcher in the Rye by J.D. Salinger",
  "Lord of the Flies by William Golding",
  "The Old Man and the Sea by Ernest Hemingway",
  "A Farewell to Arms by Ernest Hemingway",
  "For Whom the Bell Tolls by Ernest Hemingway",
  "Crime and Punishment by Fyodor Dostoevsky",
  "The Brothers Karamazov by Fyodor Dostoevsky",
  "The Idiot by Fyodor Dostoevsky",
  "War and Peace by Leo Tolstoy",
  "Anna Karenina by Leo Tolstoy",
  "The Death of Ivan Ilyich by Leo Tolstoy",
  "One Hundred Years of Solitude by Gabriel García Márquez",
  "Love in the Time of Cholera by Gabriel García Márquez",
  "The Master and Margarita by Mikhail Bulgakov",
  "Don Quixote by Miguel de Cervantes",
  "In Search of Lost Time by Marcel Proust",
  "Ulysses by James Joyce",
  "Mrs Dalloway by Virginia Woolf",
  "To the Lighthouse by Virginia Woolf",
  "The Waves by Virginia Woolf",
  "Middlemarch by George Eliot",
  "Jane Eyre by Charlotte Brontë",
  "Wuthering Heights by Emily Brontë",
  "Sense and Sensibility by Jane Austen",
  "Pride and Prejudice by Jane Austen",
  "Emma by Jane Austen",
  "Persuasion by Jane Austen",
  "Great Expectations by Charles Dickens",
  "A Tale of Two Cities by Charles Dickens",
  "Bleak House by Charles Dickens",
  "David Copperfield by Charles Dickens",
  "Moby Dick by Herman Melville",
  "The Scarlet Letter by Nathaniel Hawthorne",
  "Adventures of Huckleberry Finn by Mark Twain",
  "The Adventures of Tom Sawyer by Mark Twain",
  "Les Misérables by Victor Hugo",
  "The Count of Monte Cristo by Alexandre Dumas",
  "The Three Musketeers by Alexandre Dumas",
  "Madame Bovary by Gustave Flaubert",

  // ── Contemporary fiction ──
  "The Road by Cormac McCarthy",
  "Blood Meridian by Cormac McCarthy",
  "No Country for Old Men by Cormac McCarthy",
  "Normal People by Sally Rooney",
  "Conversations with Friends by Sally Rooney",
  "Beautiful World, Where Are You by Sally Rooney",
  "A Little Life by Hanya Yanagihara",
  "The Sympathizer by Viet Thanh Nguyen",
  "Lincoln in the Bardo by George Saunders",
  "Fleishman Is in Trouble by Taffy Brodesser-Akner",
  "Pachinko by Min Jin Lee",
  "The Kite Runner by Khaled Hosseini",
  "A Thousand Splendid Suns by Khaled Hosseini",
  "The Shadow of the Wind by Carlos Ruiz Zafón",
  "The Name of the Rose by Umberto Eco",
  "The Remains of the Day by Kazuo Ishiguro",
  "Never Let Me Go by Kazuo Ishiguro",
  "Klara and the Sun by Kazuo Ishiguro",
  "The Buried Giant by Kazuo Ishiguro",
  "Atonement by Ian McEwan",
  "On Chesil Beach by Ian McEwan",
  "Saturday by Ian McEwan",
  "White Noise by Don DeLillo",
  "Infinite Jest by David Foster Wallace",
  "The Corrections by Jonathan Franzen",
  "Freedom by Jonathan Franzen",
  "Gilead by Marilynne Robinson",
  "Housekeeping by Marilynne Robinson",
  "Beloved by Toni Morrison",
  "Song of Solomon by Toni Morrison",
  "Sula by Toni Morrison",
  "Their Eyes Were Watching God by Zora Neale Hurston",
  "Invisible Man by Ralph Ellison",
  "The Color Purple by Alice Walker",
  "Kindred by Octavia Butler",
  "Parable of the Sower by Octavia Butler",
  "The Left Hand of Darkness by Ursula K. Le Guin",
  "The Dispossessed by Ursula K. Le Guin",
  "A Wizard of Earthsea by Ursula K. Le Guin",

  // ── Genre fiction (widely searched) ──
  "Harry Potter and the Philosopher's Stone by J.K. Rowling",
  "Harry Potter and the Chamber of Secrets by J.K. Rowling",
  "Harry Potter and the Prisoner of Azkaban by J.K. Rowling",
  "Harry Potter and the Goblet of Fire by J.K. Rowling",
  "Harry Potter and the Order of the Phoenix by J.K. Rowling",
  "Harry Potter and the Half-Blood Prince by J.K. Rowling",
  "Harry Potter and the Deathly Hallows by J.K. Rowling",
  "The Lord of the Rings by J.R.R. Tolkien",
  "The Hobbit by J.R.R. Tolkien",
  "The Silmarillion by J.R.R. Tolkien",
  "A Game of Thrones by George R.R. Martin",
  "A Clash of Kings by George R.R. Martin",
  "A Storm of Swords by George R.R. Martin",
  "The Name of the Wind by Patrick Rothfuss",
  "The Way of Kings by Brandon Sanderson",
  "Mistborn by Brandon Sanderson",
  "Ender's Game by Orson Scott Card",
  "Dune by Frank Herbert",
  "Foundation by Isaac Asimov",
  "I, Robot by Isaac Asimov",
  "The Hitchhiker's Guide to the Galaxy by Douglas Adams",
  "Neuromancer by William Gibson",
  "Snow Crash by Neal Stephenson",
  "Ready Player One by Ernest Cline",
  "The Handmaid's Tale by Margaret Atwood",
  "Alias Grace by Margaret Atwood",
  "Oryx and Crake by Margaret Atwood",
  "Station Eleven by Emily St. John Mandel",
  "The Sea of Tranquility by Emily St. John Mandel",
  "Project Hail Mary by Andy Weir",
  "The Martian by Andy Weir",
  "Gone Girl by Gillian Flynn",
  "Sharp Objects by Gillian Flynn",
  "Dark Places by Gillian Flynn",
  "The Girl with the Dragon Tattoo by Stieg Larsson",
  "The Da Vinci Code by Dan Brown",
  "Inferno by Dan Brown",
  "Angels and Demons by Dan Brown",
  "And Then There Were None by Agatha Christie",
  "Murder on the Orient Express by Agatha Christie",
  "Rebecca by Daphne du Maurier",
  "The Secret History by Donna Tartt",
  "The Goldfinch by Donna Tartt",
  "A Little Life by Hanya Yanagihara",
  "Fourth Wing by Rebecca Yarros",
  "Iron Flame by Rebecca Yarros",
  "The Poppy War by R.F. Kuang",
  "Babel by R.F. Kuang",
  "Tomorrow, and Tomorrow, and Tomorrow by Gabrielle Zevin",
  "Lessons in Chemistry by Bonnie Garmus",
  "The Midnight Library by Matt Haig",
  "Remarkably Bright Creatures by Shelby Van Pelt",
  "Anxious People by Fredrik Backman",
  "A Man Called Ove by Fredrik Backman",
];

function buildCacheKey(title: string, author: string): string {
  const t = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, "_");
  const a = author.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, "_");
  return a ? `${t}__${a}` : t;
}

function parseBook(entry: string): { title: string; author: string; cacheKey: string } {
  const byIdx = entry.lastIndexOf(" by ");
  if (byIdx === -1) return { title: entry, author: "", cacheKey: buildCacheKey(entry, "") };
  const title = entry.slice(0, byIdx).trim();
  const author = entry.slice(byIdx + 4).trim();
  return { title, author, cacheKey: buildCacheKey(title, author) };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Require the seed secret to prevent abuse.
  const secret = req.headers.get("x-seed-secret") ?? "";
  const expectedSecret = Deno.env.get("SEED_SECRET") ?? "";
  if (!expectedSecret || secret !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const batchSize = Math.min(Number(body?.batch ?? 10), 30);
  const delayMs = Math.max(Number(body?.delay_ms ?? 3000), 1000);
  const dryRun = !!body?.dry_run;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  if (!GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch all already-cached keys in one query.
  const { data: cached } = await supabase
    .from("novel_analyses")
    .select("cache_key")
    .eq("is_validated", true);

  const cachedKeys = new Set((cached ?? []).map((r: any) => r.cache_key));

  const allBooks = POPULAR_BOOKS.map(parseBook);
  const pending = allBooks.filter((b) => !cachedKeys.has(b.cacheKey));
  const batch = pending.slice(0, batchSize);

  if (dryRun) {
    return new Response(JSON.stringify({
      total: allBooks.length,
      already_cached: allBooks.length - pending.length,
      pending: pending.length,
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
          Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY") ?? ""}`,
        },
        body: JSON.stringify({ title: `${book.title} by ${book.author}`, prefetch: true }),
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
