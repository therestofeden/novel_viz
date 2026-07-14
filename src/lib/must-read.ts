import { normalizeForSearch } from "@/lib/utils";

/**
 * THE MUST-READ LIST — NovelViz's editorial canon.
 *
 * Curated 2026-07-14 by "The Librarian" (Lindy-filtered, S-tier only):
 * books a serious reader should not go through life without having read.
 * Scarcity is the feature — this list should stay small (~65 titles,
 * roughly 3% of the seeded catalog). Additions must displace nothing:
 * if a title can't clear "unmissable", it doesn't go in.
 *
 * Selection rules applied:
 * - Fiction: hard Lindy filter. Nothing that hasn't demonstrably survived;
 *   the most recent entries (Beloved, Remains of the Day, Disgrace,
 *   Midnight's Children, Blood Meridian) are already canonical.
 * - Non-fiction: Lindy-proven works only. Deliberately screened out:
 *   hype-cycle business books, diluted pop science (no Sapiens), and
 *   works dented by the replication crisis (no Thinking, Fast and Slow).
 * - Ratio: fiction-heavy by design — NovelViz is a novel-first product;
 *   the Librarian's usual 2:1 non-fiction ratio is intentionally inverted.
 * - One entry per author except where two works are independently
 *   unmissable (Tolstoy, Dostoevsky, Kafka, Woolf).
 */

export type MustReadEntry = {
  title: string;
  author: string;
  /** One-line S-tier justification, shown as the stamp's tooltip/subline. */
  why: string;
  /** Alternate titles/translations this entry should also match. */
  aka?: string[];
};

export const MUST_READ: MustReadEntry[] = [
  // ── Fiction ────────────────────────────────────────────────────────────
  { title: "The Odyssey", author: "Homer", why: "The template for every journey narrative since; three millennia of proof.", aka: ["Odyssey"] },
  { title: "The Tale of Genji", author: "Murasaki Shikibu", why: "The first great novel, a thousand years old and still psychologically modern." },
  { title: "The Divine Comedy", author: "Dante Alighieri", why: "The complete medieval cosmos in verse; Western literature's load-bearing wall.", aka: ["Divine Comedy"] },
  { title: "Hamlet", author: "William Shakespeare", why: "The invention of modern interiority; every ambivalent hero descends from it." },
  { title: "Don Quixote", author: "Miguel de Cervantes", why: "The novel's founding document — and still its funniest critique." },
  { title: "Gulliver's Travels", author: "Jonathan Swift", why: "Satire's high-water mark; misanthropy sharpened to a scientific instrument." },
  { title: "Candide", author: "Voltaire", why: "The Enlightenment laughing at itself; optimism demolished in under 100 pages." },
  { title: "Frankenstein", author: "Mary Shelley", why: "The founding myth of technological modernity, written by a teenager." },
  { title: "Pride and Prejudice", author: "Jane Austen", why: "Free indirect style perfected at its birth; the wittiest moral machinery in English." },
  { title: "Jane Eyre", author: "Charlotte Brontë", why: "The first-person voice that made an 'ordinary' woman's inner life epic." },
  { title: "Wuthering Heights", author: "Emily Brontë", why: "Passion as a force of nature; the Gothic novel's untamed peak." },
  { title: "Moby-Dick", author: "Herman Melville", why: "The great American cathedral: obsession, capital, God, and whaling logistics.", aka: ["Moby Dick"] },
  { title: "Madame Bovary", author: "Gustave Flaubert", why: "The novel becomes an art form; every sentence load-tested." },
  { title: "Great Expectations", author: "Charles Dickens", why: "Dickens's tightest plot and deepest study of shame and class." },
  { title: "Crime and Punishment", author: "Fyodor Dostoevsky", why: "The psychology of guilt, rendered as a thriller." },
  { title: "War and Peace", author: "Leo Tolstoy", why: "The widest lens ever pointed at human life; history from the inside." },
  { title: "Middlemarch", author: "George Eliot", why: "The wisest novel in English; a whole society and its self-deceptions." },
  { title: "Anna Karenina", author: "Leo Tolstoy", why: "The realist novel at maximum power; family, desire, and consequence." },
  { title: "The Brothers Karamazov", author: "Fyodor Dostoevsky", why: "The final word on faith, doubt, and inheritance — in every sense." },
  { title: "Adventures of Huckleberry Finn", author: "Mark Twain", why: "American vernacular becomes literature; the river is the moral test.", aka: ["The Adventures of Huckleberry Finn", "Huckleberry Finn"] },
  { title: "Heart of Darkness", author: "Joseph Conrad", why: "Imperialism's black-box recording; a century of argument and counting." },
  { title: "Swann's Way", author: "Marcel Proust", why: "Memory as architecture; the deepest study of consciousness in fiction.", aka: ["In Search of Lost Time"] },
  { title: "Ulysses", author: "James Joyce", why: "One day, one city, the whole of language; the modern novel's outer limit." },
  { title: "The Metamorphosis", author: "Franz Kafka", why: "Alienation made literal; the twentieth century in fifty pages." },
  { title: "The Trial", author: "Franz Kafka", why: "Bureaucratic dread as theology; more relevant every year." },
  { title: "To the Lighthouse", author: "Virginia Woolf", why: "Time, loss, and perception; stream of consciousness at its most humane." },
  { title: "The Great Gatsby", author: "F. Scott Fitzgerald", why: "The American dream autopsied in 180 perfect pages." },
  { title: "The Magic Mountain", author: "Thomas Mann", why: "Europe arguing itself toward the abyss, one sanatorium conversation at a time." },
  { title: "The Sound and the Fury", author: "William Faulkner", why: "Time shattered and reassembled; the South's tragic memory." },
  { title: "The Radetzky March", author: "Joseph Roth", why: "An empire's slow death told through three generations; elegy perfected." },
  { title: "The Book of Disquiet", author: "Fernando Pessoa", why: "The interior monologue of modernity; a book to live inside." },
  { title: "Their Eyes Were Watching God", author: "Zora Neale Hurston", why: "Love and self-possession in prose that sings; a voice reclaimed." },
  { title: "The Grapes of Wrath", author: "John Steinbeck", why: "Economic catastrophe given a human face; anger organized into art." },
  { title: "The Master and Margarita", author: "Mikhail Bulgakov", why: "The devil audits Soviet Moscow; censorship outlived by laughter." },
  { title: "The Stranger", author: "Albert Camus", why: "The absurd stated plainly; a moral Rorschach test in flat prose.", aka: ["The Outsider"] },
  { title: "1984", author: "George Orwell", why: "The grammar of totalitarianism; it named the machinery we still watch for.", aka: ["Nineteen Eighty-Four"] },
  { title: "The Old Man and the Sea", author: "Ernest Hemingway", why: "Prose stripped to the bone; endurance as the whole of ethics." },
  { title: "Invisible Man", author: "Ralph Ellison", why: "The Black American experience as jazz-structured epic; nothing touches it." },
  { title: "The Leopard", author: "Giuseppe Tomasi di Lampedusa", why: "\"Everything must change so that everything stays the same\" — history's saddest sentence." },
  { title: "Lolita", author: "Vladimir Nabokov", why: "The most beautiful prose in service of the least reliable narrator; style as moral trap." },
  { title: "Pedro Páramo", author: "Juan Rulfo", why: "A town of ghosts in 120 pages; the seed of magical realism." },
  { title: "Ficciones", author: "Jorge Luis Borges", why: "Infinite libraries and forking paths; philosophy compressed into short stories.", aka: ["Fictions"] },
  { title: "Things Fall Apart", author: "Chinua Achebe", why: "Colonialism witnessed from the inside; the African novel's cornerstone." },
  { title: "Slaughterhouse-Five", author: "Kurt Vonnegut", why: "Dresden survived by irony; the anti-war novel that refuses heroics." },
  { title: "One Hundred Years of Solitude", author: "Gabriel García Márquez", why: "A century of Latin America as family myth; realism made magical." },
  { title: "Snow Country", author: "Yasunari Kawabata", why: "The haiku aesthetic sustained across a novel; beauty as distance." },
  { title: "Midnight's Children", author: "Salman Rushdie", why: "A nation's birth as autobiography; the postcolonial novel's high point." },
  { title: "Blood Meridian", author: "Cormac McCarthy", why: "Violence given Old Testament grandeur; the dark twin of the Western." },
  { title: "Beloved", author: "Toni Morrison", why: "Slavery's afterlife as a ghost story; American literature's conscience." },
  { title: "The Remains of the Day", author: "Kazuo Ishiguro", why: "A wasted life revealed through its own evasions; restraint as tragedy." },
  { title: "Disgrace", author: "J.M. Coetzee", why: "Post-apartheid reckoning in prose like cut glass; unsparing and exact." },

  // ── Non-fiction ────────────────────────────────────────────────────────
  { title: "Tao Te Ching", author: "Laozi", why: "Two and a half millennia of quiet counter-argument to force and hustle.", aka: ["Dao De Jing"] },
  { title: "The Republic", author: "Plato", why: "Justice, education, the cave; the source code of Western philosophy." },
  { title: "Poetics", author: "Aristotle", why: "The first theory of story — still the skeleton under every screenplay." },
  { title: "Meditations", author: "Marcus Aurelius", why: "An emperor's private notes to himself; Stoicism with no audience in mind." },
  { title: "Essays", author: "Michel de Montaigne", why: "The invention of the honest first person; doubt as a method.", aka: ["The Complete Essays", "The Essays"] },
  { title: "The Prince", author: "Niccolò Machiavelli", why: "Power described without flattery for the first time." },
  { title: "On the Origin of Species", author: "Charles Darwin", why: "The most consequential argument ever printed; patient, humble, irreversible.", aka: ["The Origin of Species"] },
  { title: "Democracy in America", author: "Alexis de Tocqueville", why: "Still the sharpest outside eye on the American experiment." },
  { title: "A Room of One's Own", author: "Virginia Woolf", why: "The material conditions of art, stated once and for all; the essay as scalpel." },
  { title: "If This Is a Man", author: "Primo Levi", why: "The clearest testimony from the abyss; a chemist's precision at humanity's floor.", aka: ["Survival in Auschwitz"] },
  { title: "Man's Search for Meaning", author: "Viktor E. Frankl", why: "Meaning as survival; every word earned." },
  { title: "The Second Sex", author: "Simone de Beauvoir", why: "\"One is not born a woman\" — the analysis that started the modern argument." },
  { title: "The Structure of Scientific Revolutions", author: "Thomas S. Kuhn", why: "Where 'paradigm shift' came from; how science actually moves." },
  { title: "The Fire Next Time", author: "James Baldwin", why: "Prophecy in essay form; the clearest voice in the American race conversation." },
  { title: "The Selfish Gene", author: "Richard Dawkins", why: "The gene's-eye view that reorganized biology; fifty years young." },
];

// ── Lookup ─────────────────────────────────────────────────────────────────
// Matching is by normalized title (accent-stripped, lowercased, whitespace-
// collapsed), with alternates. When both sides know an author, the entry's
// author surname must appear in the candidate author (guards against a
// different book that happens to share a title). Title-only lookups (e.g.
// homepage suggestion chips) match on title alone — the list uses canonical
// titles, so collisions are unlikely.

const byTitle = new Map<string, MustReadEntry>();
for (const entry of MUST_READ) {
  byTitle.set(normalizeForSearch(entry.title), entry);
  for (const alt of entry.aka ?? []) byTitle.set(normalizeForSearch(alt), entry);
}

const surname = (author: string): string => {
  const parts = normalizeForSearch(author).split(" ");
  return parts[parts.length - 1] ?? "";
};

/** Returns the must-read entry for a book, or null. Author optional but checked when present. */
export function getMustRead(title: string, author?: string | null): MustReadEntry | null {
  const entry = byTitle.get(normalizeForSearch(title));
  if (!entry) return null;
  if (author && author.trim() && author !== "Unknown") {
    if (!normalizeForSearch(author).includes(surname(entry.author))) return null;
  }
  return entry;
}

export function isMustRead(title: string, author?: string | null): boolean {
  return getMustRead(title, author) !== null;
}
