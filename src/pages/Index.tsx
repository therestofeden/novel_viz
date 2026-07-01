import { useEffect, useMemo, useRef, useState, lazy, Suspense, FormEvent } from "react";
import { Link } from "react-router-dom";
import { Loader2, Search, RefreshCw, Eye, EyeOff, LogIn, Library, Key } from "lucide-react";
import { NovelVizLogo } from "@/components/NovelVizLogo";
import {
  Reveal,
  StaggerGroup,
  StaggerItem,
  MagneticButton,
  motion,
  ease,
} from "@/lib/motion";

// Lazy: react-markdown (~70KB) only loads after the user submits a search.
const ReactMarkdown = lazy(() => import("react-markdown"));
const MarkdownFallback = () => <span className="meta text-muted-foreground">…</span>;

import {
  FictionAnalysis,
  NovelAnalysis,
  NonFictionAnalysis,
  PlotEvent,
  isFiction,
  isNonFiction,
  normalizeAnalysis,
} from "@/lib/novel-types";
import { TimelineView } from "@/components/TimelineView";
import { CharacterNetwork } from "@/components/CharacterNetwork";
import { BookDNA } from "@/components/BookDNA";
import { ConceptMap } from "@/components/ConceptMap";
import { IdeasTab } from "@/components/IdeasTab";
import { ChapterBreakdown } from "@/components/ChapterBreakdown";
import { TakeawaysTab } from "@/components/TakeawaysTab";
import { RefinementPrompts } from "@/components/RefinementPrompts";
import { ReaderNotes } from "@/components/ReaderNotes";
import { ShelfChip } from "@/components/ShelfChip";
import { BuyButton } from "@/components/BuyButton";
import { ShareButton } from "@/components/ShareButton";
import { GeminiKeyDialog } from "@/components/GeminiKeyDialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn, normalizeForSearch } from "@/lib/utils";

// Curated pool of literary titles. We sample 6 per page-load for variety.
// Mix of canon, contemporary, world lit, and structurally interesting works.
const SUGGESTION_POOL = [
  // Anglo-American 20th c. canon
  "Cloud Atlas", "The Sound and the Fury", "A Visit from the Goon Squad", "Beloved",
  "Mrs Dalloway", "To the Lighthouse", "The Waves", "Orlando", "A Room of One's Own",
  "Ulysses", "A Portrait of the Artist as a Young Man", "Dubliners", "Finnegans Wake",
  "The Great Gatsby", "Tender Is the Night", "This Side of Paradise",
  "The Sun Also Rises", "A Farewell to Arms", "For Whom the Bell Tolls", "The Old Man and the Sea",
  "As I Lay Dying", "Absalom, Absalom!", "Light in August", "Go Down, Moses",
  "Their Eyes Were Watching God", "Invisible Man", "Native Son", "Go Tell It on the Mountain",
  "The Adventures of Augie March", "Herzog", "Seize the Day", "Henderson the Rain King",
  "Lolita", "Pale Fire", "Pnin", "Speak, Memory", "Ada or Ardor",
  "Catch-22", "Slaughterhouse-Five", "Cat's Cradle", "Mother Night", "Breakfast of Champions",
  "Gravity's Rainbow", "The Crying of Lot 49", "V.", "Mason & Dixon", "Inherent Vice",
  "Infinite Jest", "The Pale King", "Brief Interviews with Hideous Men",
  "White Noise", "Underworld", "Libra", "Mao II", "Cosmopolis",
  "Blood Meridian", "Suttree", "The Road", "No Country for Old Men", "The Border Trilogy",
  "Housekeeping", "Gilead", "Home", "Lila", "Jack",
  "A Confederacy of Dunces", "Wise Blood", "The Violent Bear It Away",
  "Revolutionary Road", "The Easter Parade", "Eleven Kinds of Loneliness",
  // Late 20th and 21st c. American
  "The Goldfinch", "The Secret History", "The Little Friend",
  "A Little Life", "The People in the Trees", "To Paradise",
  "Trust", "Demon Copperhead", "The Overstory", "The Echo Maker", "Bewilderment",
  "Station Eleven", "The Glass Hotel", "Sea of Tranquility",
  "There There", "Wandering Stars", "House Made of Dawn", "Ceremony",
  "Lincoln in the Bardo", "Pastoralia", "Tenth of December",
  "The Sympathizer", "The Committed", "The Refugees",
  "The Brief Wondrous Life of Oscar Wao", "Drown", "This Is How You Lose Her",
  "Americanah", "Half of a Yellow Sun", "Purple Hibiscus", "Notes on Grief",
  "Homegoing", "Transcendent Kingdom", "Yaa Gyasi",
  "The Underground Railroad", "The Nickel Boys", "Zone One",
  "An American Marriage", "Silver Sparrow", "Leaving Atlanta",
  "Salvage the Bones", "Sing, Unburied, Sing", "Let Us Descend",
  "The Vegetarian", "Human Acts", "The White Book", "Greek Lessons", "We Do Not Part",
  // British and Irish
  "Pride and Prejudice", "Emma", "Sense and Sensibility", "Persuasion", "Mansfield Park",
  "Jane Eyre", "Wuthering Heights", "Villette", "Shirley",
  "Middlemarch", "Daniel Deronda", "Silas Marner", "The Mill on the Floss",
  "Bleak House", "Great Expectations", "David Copperfield", "Our Mutual Friend", "Little Dorrit",
  "Vanity Fair", "Tess of the d'Urbervilles", "Jude the Obscure", "Far from the Madding Crowd",
  "Heart of Darkness", "Lord Jim", "Nostromo", "The Secret Agent",
  "Howards End", "A Passage to India", "A Room with a View", "Where Angels Fear to Tread",
  "Brideshead Revisited", "A Handful of Dust", "Decline and Fall", "Sword of Honour",
  "1984", "Animal Farm", "Down and Out in Paris and London", "Burmese Days",
  "Brave New World", "Point Counter Point", "Eyeless in Gaza",
  "The Heart of the Matter", "The End of the Affair", "The Power and the Glory", "The Quiet American",
  "The Remains of the Day", "Never Let Me Go", "Klara and the Sun", "An Artist of the Floating World", "The Buried Giant",
  "Atonement", "Saturday", "On Chesil Beach", "The Children Act", "Lessons",
  "White Teeth", "On Beauty", "NW", "Swing Time", "The Fraud",
  "Wolf Hall", "Bring Up the Bodies", "The Mirror and the Light", "A Place of Greater Safety",
  "Possession", "The Children's Book", "Still Life",
  "The Sea, The Sea", "The Black Prince", "Under the Net", "A Severed Head",
  "Disgrace", "Waiting for the Barbarians", "Life & Times of Michael K", "Foe", "The Schooldays of Jesus",
  "Ulysses", "At Swim-Two-Birds", "The Third Policeman",
  "Strumpet City", "Amongst Women", "By the Lake",
  "Normal People", "Conversations with Friends", "Beautiful World, Where Are You", "Intermezzo",
  "Milkman", "No Bones",
  "Small Things Like These", "Foster", "So Late in the Day",
  // Russian and Eastern European
  "Anna Karenina", "War and Peace", "Resurrection", "The Death of Ivan Ilyich", "Hadji Murat",
  "The Brothers Karamazov", "Crime and Punishment", "Demons", "The Idiot", "Notes from Underground",
  "Dead Souls", "The Overcoat", "Diary of a Madman",
  "Fathers and Sons", "A Sportsman's Sketches", "First Love",
  "Oblomov",
  "Doctor Zhivago", "The Master and Margarita", "Heart of a Dog", "The White Guard",
  "We", "The Foundation Pit", "Chevengur",
  "One Day in the Life of Ivan Denisovich", "The Gulag Archipelago", "Cancer Ward", "The First Circle",
  "Life and Fate", "Stalingrad", "Everything Flows",
  "The Kreutzer Sonata", "A Hero of Our Time",
  "The Trial", "The Castle", "Amerika", "The Metamorphosis", "In the Penal Colony",
  "The Tin Drum", "Cat and Mouse", "Dog Years", "The Flounder",
  "The Magic Mountain", "Buddenbrooks", "Doctor Faustus", "Death in Venice", "Joseph and His Brothers",
  "Steppenwolf", "Siddhartha", "The Glass Bead Game", "Narcissus and Goldmund",
  "The Man Without Qualities", "Young Törless",
  "The Sleepwalkers", "The Death of Virgil",
  "The Radetzky March", "Job", "The Emperor's Tomb",
  "Austerlitz", "The Rings of Saturn", "The Emigrants", "Vertigo",
  "All Quiet on the Western Front", "The Road Back",
  "Berlin Alexanderplatz",
  "The Notebook (Kristóf)", "Embers", "Portraits of a Marriage",
  "Solaris", "The Cyberiad", "His Master's Voice",
  // French and Francophone
  "In Search of Lost Time", "Swann's Way", "The Guermantes Way",
  "Madame Bovary", "Sentimental Education", "Bouvard and Pécuchet",
  "Les Misérables", "Notre-Dame de Paris", "The Hunchback of Notre-Dame",
  "The Count of Monte Cristo", "The Three Musketeers",
  "Père Goriot", "Lost Illusions", "Cousin Bette", "Eugénie Grandet",
  "The Red and the Black", "The Charterhouse of Parma",
  "Germinal", "Nana", "Thérèse Raquin",
  "Bel-Ami", "Pierre and Jean", "A Life",
  "The Stranger", "The Plague", "The Fall", "The Myth of Sisyphus", "The First Man",
  "Nausea", "The Roads to Freedom", "The Wall",
  "Journey to the End of the Night", "Death on the Installment Plan",
  "If on a winter's night a traveler", "Invisible Cities", "The Baron in the Trees", "Cosmicomics",
  "The Lover", "The Sea Wall", "Moderato Cantabile",
  "Suite Française", "All Our Worldly Goods",
  "The Years", "A Man's Place", "Simple Passion", "Happening", "I Remain in Darkness",
  "The Elementary Particles", "Submission", "Serotonin", "Map and the Territory",
  "HHhH", "The Seventh Function of Language",
  "Compass", "Memory of Departure",
  "The Friend", "The Brief and Frightening Reign of Phil",
  // Spanish, Portuguese, Latin American
  "Don Quixote", "Exemplary Novels",
  "One Hundred Years of Solitude", "Love in the Time of Cholera", "Chronicle of a Death Foretold", "The Autumn of the Patriarch", "Of Love and Other Demons",
  "The Aleph", "Ficciones", "Labyrinths", "The Book of Sand",
  "Hopscotch", "Blow-Up", "62: A Model Kit", "Cronopios and Famas",
  "Pedro Páramo", "The Burning Plain",
  "The Death of Artemio Cruz", "Aura", "Terra Nostra",
  "The Feast of the Goat", "Conversation in the Cathedral", "The War of the End of the World", "Aunt Julia and the Scriptwriter",
  "2666", "The Savage Detectives", "By Night in Chile", "Distant Star", "Last Evenings on Earth",
  "Like Water for Chocolate",
  "Kiss of the Spider Woman", "Heartbreak Tango",
  "The House of the Spirits", "Of Love and Shadows",
  "The Obscene Bird of Night",
  "Zama", "The Wind That Lays Waste",
  "A General Theory of Oblivion", "Transparent City",
  "Blindness", "Seeing", "The Year of the Death of Ricardo Reis", "Baltasar and Blimunda", "The Gospel According to Jesus Christ",
  "The Book of Disquiet", "Message",
  // Italian
  "The Leopard", "The Garden of the Finzi-Continis", "The Conformist",
  "If This Is a Man", "The Periodic Table", "The Drowned and the Saved", "The Truce",
  "The Name of the Rose", "Foucault's Pendulum", "The Island of the Day Before",
  "My Brilliant Friend", "The Story of a New Name", "Those Who Leave and Those Who Stay", "The Story of the Lost Child", "The Days of Abandonment", "The Lying Life of Adults",
  "A Woman", "The Path to the Spiders' Nests", "The Nonexistent Knight",
  "Christ Stopped at Eboli",
  "The Tartar Steppe",
  "Family Lexicon", "Voices in the Evening",
  // Nordic
  "Hunger", "Pan", "Mysteries", "Growth of the Soil",
  "Independent People", "Iceland's Bell", "World Light",
  "Out Stealing Horses", "I Refuse",
  "My Struggle: Book One", "My Struggle: Book Two", "Spring", "Autumn",
  "The Half Brother",
  "Doppler", "Naive. Super",
  "The Unit",
  "The Dwarf",
  "Beyond Sleep",
  "The Discomfort of Evening", "We Had to Remove This Post",
  // Asian
  "Pachinko", "Free Food for Millionaires",
  "Norwegian Wood", "Kafka on the Shore", "The Wind-Up Bird Chronicle", "1Q84", "Hard-Boiled Wonderland and the End of the World", "A Wild Sheep Chase", "Killing Commendatore", "Men Without Women", "After Dark", "Sputnik Sweetheart",
  "Snow Country", "The Sound of the Mountain", "Thousand Cranes", "Beauty and Sadness",
  "Confessions of a Mask", "The Sailor Who Fell from Grace with the Sea", "The Sound of Waves", "The Sea of Fertility",
  "The Makioka Sisters", "Some Prefer Nettles", "Naomi",
  "Kokoro", "I Am a Cat", "Botchan",
  "Convenience Store Woman", "Earthlings", "Life Ceremony",
  "Breasts and Eggs", "All the Lovers in the Night", "Heaven",
  "Strange Weather in Tokyo", "The Briefcase",
  "Out", "Grotesque",
  "The Memory Police", "The Housekeeper and the Professor", "Hotel Iris",
  "A Tale for the Time Being",
  "Please Look After Mom",
  "I Have the Right to Destroy Myself",
  "Almond", "Lemon",
  "Cursed Bunny",
  "To the Bright Edge of the World",
  "Red Sorghum", "Big Breasts and Wide Hips", "Life and Death Are Wearing Me Out", "Frog",
  "Soul Mountain", "One Man's Bible",
  "The Three-Body Problem", "The Dark Forest", "Death's End", "Ball Lightning",
  "Waiting", "A Free Life", "War Trash",
  "Beijing Coma",
  "Notes of a Crocodile", "Last Words from Montmartre",
  // South Asian
  "Midnight's Children", "Shame", "The Moor's Last Sigh", "The Satanic Verses", "Quichotte",
  "The God of Small Things", "The Ministry of Utmost Happiness",
  "A Suitable Boy", "An Equal Music",
  "The White Tiger", "Last Man in Tower", "Selection Day",
  "The Inheritance of Loss",
  "A Fine Balance", "Such a Long Journey",
  "Family Matters",
  "The Lowland", "The Namesake", "Interpreter of Maladies", "Whereabouts",
  "The Hungry Tide", "Sea of Poppies", "River of Smoke", "Flood of Fire",
  "Funny Boy", "Cinnamon Gardens",
  "The Reluctant Fundamentalist", "Exit West", "The Last White Man",
  "Home Fire",
  // African
  "Things Fall Apart", "No Longer at Ease", "Arrow of God", "A Man of the People", "Anthills of the Savannah",
  "The Famished Road",
  "Petals of Blood", "A Grain of Wheat", "Wizard of the Crow",
  "Season of Migration to the North",
  "Disgrace", "Age of Iron", "The Master of Petersburg",
  "July's People", "The Conservationist", "Burger's Daughter",
  "Cry, the Beloved Country",
  "The Beautyful Ones Are Not Yet Born",
  "Nervous Conditions",
  "So Long a Letter",
  "The Memory of Love",
  "We Need New Names", "Glory",
  "Tram 83",
  "Gravel Heart", "By the Sea", "Paradise", "Afterlives",
  // Middle Eastern
  "Palace Walk", "Palace of Desire", "Sugar Street", "Children of Gebelawi", "Midaq Alley",
  "Men in the Sun", "Returning to Haifa",
  "Gate of the Sun",
  "The Yacoubian Building",
  "My Name Is Red", "Snow", "The Museum of Innocence", "The Black Book", "A Strangeness in My Mind",
  "The Time Regulation Institute",
  "The Blind Owl",
  // Caribbean
  "Wide Sargasso Sea", "Good Morning, Midnight",
  "A House for Mr Biswas", "A Bend in the River", "In a Free State", "Half a Life",
  "Omeros",
  "Texaco",
  "The Brief Wondrous Life of Oscar Wao",
  "Brother, I'm Dying", "The Farming of Bones",
  // Australian and NZ
  "The Tree of Man", "Voss", "Riders in the Chariot", "The Vivisector",
  "The True History of the Kelly Gang", "Oscar and Lucinda", "Jack Maggs",
  "The Slap",
  "Cloudstreet", "Dirt Music", "Eyrie",
  "The Bone People", "Potiki",
  "The Luminaries", "Birnam Wood",
  // Speculative and SF that read as literary
  "Solaris", "Roadside Picnic",
  "The Left Hand of Darkness", "The Dispossessed", "The Lathe of Heaven", "A Wizard of Earthsea",
  "Dune", "Stranger in a Strange Land",
  "The Handmaid's Tale", "The Testaments", "Oryx and Crake", "The Year of the Flood", "MaddAddam", "Alias Grace", "The Blind Assassin",
  "Never Let Me Go",
  "Children of Time", "Children of Ruin",
  "Annihilation", "Authority", "Acceptance",
  "Piranesi", "Jonathan Strange & Mr Norrell",
  "The Buried Giant",
  "The Power",
  "Exhalation", "Stories of Your Life and Others",
  "House of Leaves", "Only Revolutions",
  // Memoir-novel and autofiction
  "Speedboat", "Pitch Dark",
  "10:04", "Leaving the Atocha Station", "The Topeka School",
  "How Should a Person Be?", "Motherhood", "Pure Colour",
  "The Argonauts", "Bluets",
  "The Cost of Living", "Real Estate", "Things I Don't Want to Know",
  "The Outline Trilogy", "Outline", "Transit", "Kudos", "Second Place", "Parade",
  "Department of Speculation", "Weather",
  "A Brief History of Seven Killings",
  "Ducks, Newburyport",
  // Misc essentials
  "If on a winter's night a traveler",
  "The Recognitions", "JR", "A Frolic of His Own",
  "Stoner", "Butcher's Crossing", "Augustus",
  "A Month in the Country",
  "All the Light We Cannot See", "Cloud Cuckoo Land",
  "The Shipping News", "Postcards", "Accordion Crimes",
  "The Hours", "Specimen Days", "The Snow Queen",
  "Underworld",
  "Cold Mountain",
  "Empire of the Sun",
  "Cloud Atlas", "number9dream", "The Bone Clocks", "Black Swan Green",
  "The Slap",
  "Half of a Yellow Sun",
  "The Yiddish Policemen's Union", "The Amazing Adventures of Kavalier & Clay", "Telegraph Avenue", "Moonglow",
  "Everything Is Illuminated", "Extremely Loud and Incredibly Close", "Here I Am",
  "The Corrections", "Freedom", "Purity", "Crossroads",
  "American Pastoral", "I Married a Communist", "The Human Stain", "The Plot Against America", "Sabbath's Theater", "Nemesis",
  "Rabbit, Run", "Rabbit Redux", "Rabbit Is Rich", "Rabbit at Rest",
  "Couples", "The Witches of Eastwick",
  "The Things They Carried", "Going After Cacciato",
  "Tinkers", "Enon",
  // Non-fiction — history, science, philosophy, memoir, ideas
  "Sapiens", "Thinking, Fast and Slow", "The Emperor of All Maladies",
  "A Short History of Nearly Everything", "The Sixth Extinction", "The Gene",
  "Guns, Germs, and Steel", "The Silk Roads", "SPQR",
  "The Immortal Life of Henrietta Lacks", "Into Thin Air", "Educated",
  "When Breath Becomes Air", "Being Mortal", "The Body Keeps the Score",
  "Meditations", "The Denial of Death", "Gödel, Escher, Bach",
  "The Selfish Gene", "A Brief History of Time", "The Structure of Scientific Revolutions",
  "The Power Broker", "The Right Stuff", "In Cold Blood",
  "The Warmth of Other Suns", "Between the World and Me", "Evicted",
  "Atomic Habits", "Deep Work", "Man's Search for Meaning",
];

function sampleSuggestions(n: number): string[] {
  const pool = [...SUGGESTION_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

type BookSuggestion = {
  key: string;
  title: string;
  author: string;
  year?: number;
  cached?: boolean;
  shelfBoost?: boolean;
};

// ── Cover image fetching ─────────────────────────────────────────────────────
const coverCache = new Map<string, string | null>();

async function fetchCoverUrl(title: string, author: string): Promise<string | null> {
  const cacheKey = `${title.toLowerCase()}|${(author ?? "").toLowerCase()}`;
  if (coverCache.has(cacheKey)) return coverCache.get(cacheKey)!;
  try {
    const q = author && author !== "Unknown"
      ? `intitle:${encodeURIComponent(title)}+inauthor:${encodeURIComponent(author)}`
      : `intitle:${encodeURIComponent(title)}`;
    const r = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1&printType=books`,
    );
    if (!r.ok) { coverCache.set(cacheKey, null); return null; }
    const json = await r.json();
    const raw = json?.items?.[0]?.volumeInfo?.imageLinks?.thumbnail as string | undefined;
    const url = raw
      ? raw.replace("http://", "https://").replace("&edge=curl", "") + "&fife=w300"
      : null;
    coverCache.set(cacheKey, url);
    return url;
  } catch {
    coverCache.set(cacheKey, null);
    return null;
  }
}
// ─────────────────────────────────────────────────────────────────────────────

const Index = () => {
  const [title, setTitle] = useState("");
  const [analysis, setAnalysis] = useState<NovelAnalysis | null>(null);
  const [analysisPreview, setAnalysisPreview] = useState<{ title: string; author: string; summary: string; thesis?: string; bookType?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [refining, setRefining] = useState(false);
  const [view, setView] = useState<"timeline" | "network" | "dna" | "concepts" | "ideas" | "chapters" | "takeaways">("timeline");
  const [activeRefinement, setActiveRefinement] = useState<string | null>(null);

  // Random sample of seed titles, fixed for the lifetime of this mount.
  const seedSuggestions = useMemo(() => sampleSuggestions(6), []);
  // Track which titles we've already prefetched on hover to avoid duplicate work.
  const prefetchedRef = useRef<Set<string>>(new Set());

  const prefetchAnalysis = (bookTitle: string) => {
    const key = bookTitle.trim().toLowerCase();
    if (!key || prefetchedRef.current.has(key)) return;
    prefetchedRef.current.add(key);
    // Fire-and-forget. The edge function will warm the cache; if there's a hit,
    // the actual click resolves in <300ms.
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-novel`;
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ title: bookTitle, prefetch: true, ...(geminiKey ? { gemini_key: geminiKey } : {}) }),
      keepalive: true,
    }).catch(() => {
      // Silent — prefetch is best-effort.
      prefetchedRef.current.delete(key);
    });
  };

  // Autocomplete
  const [suggestions, setSuggestions] = useState<BookSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const suppressNextFetchRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Per-prefix in-memory cache (lifetime: page session). Avoids re-fetching identical queries.
  const searchCacheRef = useRef<Map<string, BookSuggestion[]>>(new Map());
  // Cache of "queries known to return zero results" — lets us short-circuit longer prefixes
  // built on top of an empty stem (e.g. if "xyz" → 0 results, "xyzq" is also 0 — don't fetch).
  const emptyPrefixesRef = useRef<Set<string>>(new Set());
  // Monotonic sequence to discard stale (out-of-order) responses.
  const searchSeqRef = useRef(0);
  // Cache the auth token so we don't hit getSession() on every keystroke.
  const tokenRef = useRef<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) tokenRef.current = data.session?.access_token ?? null;
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      tokenRef.current = session?.access_token ?? null;
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  // ============================================================
  // TIER 1 — Local popular-books index (instant, zero network).
  // Loaded once on mount, filtered in-memory on every keystroke.
  // Covers ~80% of searches without any backend call.
  // ============================================================
  type IndexedBook = { title: string; author: string; popularity: number; haystack: string; normTitle: string; normAuthor: string; normHaystack: string };
  const popularIndexRef = useRef<IndexedBook[]>([]);

  useEffect(() => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/popular-books`;
    fetch(url, {
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
    })
      .then((r) => r.json())
      .then((j) => {
        const rows = (j?.results ?? []) as Array<{ title: string; author: string; popularity: number; normTitle?: string; normAuthor?: string }>;
        popularIndexRef.current = rows.map((b) => {
          const normTitle = b.normTitle ?? normalizeForSearch(b.title);
          const normAuthor = b.normAuthor ?? normalizeForSearch(b.author ?? "");
          return {
            title: b.title,
            author: b.author ?? "",
            popularity: b.popularity ?? 0,
            haystack: `${b.title} ${b.author ?? ""}`.toLowerCase(),
            normTitle,
            normAuthor,
            normHaystack: `${normTitle} ${normAuthor}`,
          };
        });
        // Warm the top-N most popular analyses in the background. These are
        // already-cached on the server (popular-books surfaces analyzed titles),
        // so the prefetch round-trip just confirms the hit and primes our local
        // de-dup set — making the first click on any popular title feel instant.
        // Staggered to avoid a thundering herd against the edge function.
        const topN = rows.slice(0, 8);
        topN.forEach((b, i) => {
          setTimeout(() => prefetchAnalysis(b.title), 250 + i * 120);
        });
      })
      .catch(() => { /* non-fatal — falls back to network search */ });
  }, []);

  function searchLocalIndex(q: string, limit = 8): BookSuggestion[] {
    const norm = normalizeForSearch(q);
    if (!norm) return [];
    const idx = popularIndexRef.current;
    if (idx.length === 0) return [];
    const scored: Array<{ b: IndexedBook; score: number }> = [];
    // Pre-tokenize the query for the fuzzy pass (≥2-char tokens only)
    const qTokens = norm.split(" ").filter((t) => t.length >= 2);
    for (const b of idx) {
      const t = b.normTitle;
      const a = b.normAuthor;
      const h = b.normHaystack;
      let score = 0;
      // Tier 1: exact / prefix / substring (accent-insensitive via normHaystack)
      if (t === norm || a === norm) score = 1000;
      else if (t.startsWith(norm)) score = 700;
      else if (a.startsWith(norm)) score = 600;
      else if (t.split(" ").some((w) => w.startsWith(norm))) score = 450;
      else if (a.split(" ").some((w) => w.startsWith(norm))) score = 400;
      else if (h.includes(norm)) score = 200;
      else if (qTokens.length >= 2) {
        // Tier 2: token-overlap fuzzy — handles "love at the time" ≈ "love in the time"
        const hWords = h.split(" ");
        const hSet = new Set(hWords);
        let matched = 0;
        for (const qt of qTokens) {
          if (hSet.has(qt)) matched++;
          else if (hWords.some((hw) => hw.startsWith(qt) || qt.startsWith(hw))) matched += 0.6;
        }
        const overlap = matched / qTokens.length;
        if (overlap >= 0.6) score = Math.round(overlap * 180); // max ~180, below all Tier-1 scores
      }
      if (score === 0) continue;
      scored.push({ b, score: score + b.popularity * 0.3 });
    }
    scored.sort((x, y) => y.score - x.score);
    return scored.slice(0, limit).map((s) => ({
      key: `local|${s.b.title}|${s.b.author}`,
      title: s.b.title,
      author: s.b.author || "Unknown",
      cached: true,
    }));
  }

  // ============================================================
  // TIER 2 — Network search (only when local results are thin).
  // ============================================================
  useEffect(() => {
    const q = title.trim();
    if (suppressNextFetchRef.current) {
      suppressNextFetchRef.current = false;
      return;
    }
    if (q.length < 2) {
      setSuggestions([]);
      setSuggestLoading(false);
      setSuggestOpen(false);
      return;
    }
    const cacheKey = q.toLowerCase();

    // 1. Exact prior network result → instant.
    const cached = searchCacheRef.current.get(cacheKey);
    if (cached) {
      setSuggestions(cached);
      setSuggestOpen(true);
      setActiveIndex(-1);
      setSuggestLoading(false);
      return;
    }

    // 2. INSTANT local index lookup — render immediately.
    const local = searchLocalIndex(cacheKey, 8);
    if (local.length > 0) {
      setSuggestions(local);
      setSuggestOpen(true);
      setActiveIndex(-1);
      setSuggestLoading(false);
    } else {
      setSuggestLoading(true);
      setSuggestOpen(true);
    }

    // 3. Decide whether to also hit the network. Only fall back if local is thin.
    const needsNetwork = local.length < 5;
    if (!needsNetwork) return;

    // 4. Empty-prefix short-circuit.
    for (let len = cacheKey.length - 1; len >= 2; len--) {
      if (emptyPrefixesRef.current.has(cacheKey.slice(0, len))) {
        return; // local results (if any) already shown; nothing else to fetch
      }
    }

    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const seq = ++searchSeqRef.current;
      try {
        const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-books?q=${encodeURIComponent(q)}&limit=8`;
        const token = tokenRef.current ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const headers: Record<string, string> = {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${token}`,
        };
        const res = await fetch(endpoint, { signal: ctrl.signal, headers });
        const json = await res.json();
        if (seq !== searchSeqRef.current) return; // stale
        const networkResults = (json?.results ?? []) as BookSuggestion[];

        // Merge: local first (already shown), then any new network titles.
        const seen = new Set(local.map((r) => `${r.title.toLowerCase()}|${r.author.toLowerCase()}`));
        const merged = [...local];
        for (const r of networkResults) {
          const k = `${r.title.toLowerCase()}|${r.author.toLowerCase()}`;
          if (!seen.has(k)) {
            merged.push(r);
            seen.add(k);
          }
        }
        const finalResults = merged.slice(0, 8);
        searchCacheRef.current.set(cacheKey, finalResults);
        if (networkResults.length === 0 && local.length === 0) {
          emptyPrefixesRef.current.add(cacheKey);
        }
        if (searchCacheRef.current.size > 120) {
          const firstKey = searchCacheRef.current.keys().next().value;
          if (firstKey) searchCacheRef.current.delete(firstKey);
        }
        setSuggestions(finalResults);
        setSuggestOpen(true);
        setActiveIndex(-1);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("autocomplete error:", err);
        }
      } finally {
        if (seq === searchSeqRef.current) setSuggestLoading(false);
      }
    }, 320);
    return () => clearTimeout(handle);
  }, [title]);


  // Close on outside click
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setSuggestOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const pickSuggestion = (s: BookSuggestion) => {
    suppressNextFetchRef.current = true;
    setTitle(s.title);
    setSuggestOpen(false);
    setSuggestions([]);
    setActiveRefinement(null);
    // Pass author hint along with title — analyze-novel only uses title field today
    fetchAnalysis(s.author && s.author !== "Unknown" ? `${s.title} by ${s.author}` : s.title);
  };

  // Shared cross-view state
  const [progress, setProgress] = useState(100);
  const [showSpoilers, setShowSpoilers] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);

  // Reset shared state when a new analysis arrives
  useEffect(() => {
    setSelectedEventId(null);
    setSelectedCharacterId(null);
  }, [analysis?.title]);

  // Fetch cover art as soon as we have a title (preview or full analysis).
  useEffect(() => {
    const t = analysis?.title || analysisPreview?.title;
    const a = analysis?.author || analysisPreview?.author || "";
    if (!t) { setCoverUrl(null); return; }
    fetchCoverUrl(t, a).then(setCoverUrl);
  }, [analysis?.title, analysisPreview?.title]);

  const [statusText, setStatusText] = useState<string>("");
  const [preambleText, setPreambleText] = useState<string>("");
  const [cachedHit, setCachedHit] = useState(false);
  const [cacheKey, setCacheKey] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const { user, geminiKey } = useAuth();
  const [geminiDialogOpen, setGeminiDialogOpen] = useState(false);

  const fetchAnalysis = async (bookTitle: string, refinement?: string, opts?: { reanalyze?: boolean }) => {
    const isReanalyze = !!opts?.reanalyze;
    const isRefine = !!refinement && !isReanalyze;
    if (isRefine || isReanalyze) setRefining(true);
    else setLoading(true);
    setStatusText("");
    setPreambleText("");
    setAnalysisPreview(null);
    setCachedHit(false);
    if (!isRefine) { setCacheKey(null); setSlug(null); }

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-novel`;

    // Retry transient backend failures (cold starts, 5xx, network blips).
    // Bounded retries with exponential backoff; never retried for client errors
    // like 4xx (except 408 timeout) so user-actionable issues surface immediately.
    // NOTE: 500 is included deliberately — analyze-novel's own error paths
    // (Gemini exhausted, DB hiccup before the SSE stream opens, etc.) return
    // plain 500s and are just as transient as a 502/503 in practice. Excluding
    // it meant almost every real backend blip surfaced to the user on the
    // first try instead of quietly retrying.
    const MAX_ATTEMPTS = 3;
    const isTransientStatus = (s: number) =>
      s === 408 || s === 425 || s === 500 || s === 502 || s === 503 || s === 504;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // A transient failure can surface two ways:
    //  1. The initial fetch() never gets a 2xx (or throws outright) — handled
    //     the same as before.
    //  2. The fetch DOES get a 200 (the SSE stream opens fine) but Gemini
    //     fails partway through, e.g. all fallback models return 429/503.
    //     analyze-novel reports that as an in-stream "error" event with a
    //     status field, NOT an HTTP-level error — headers are already sent
    //     by the time it knows the AI call failed. Previously this always
    //     surfaced to the user on the first try even though it's exactly as
    //     transient as a pre-stream 503. TransientStreamError marks that case
    //     so the outer loop retries it too instead of giving up immediately.
    class TransientStreamError extends Error {}

    async function attemptOnce(): Promise<NovelAnalysis> {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          title: bookTitle,
          refinement: isRefine ? refinement : undefined,
          previousAnalysis: isRefine ? analysis : undefined,
          reanalyze: isReanalyze || undefined,
          ...(geminiKey ? { gemini_key: geminiKey } : {}),
        }),
      });

      if (!resp.ok || !resp.body) {
        let msg = "Something went wrong";
        try {
          const j = await resp.json();
          msg = j?.error ?? msg;
        } catch { /* ignore */ }
        if (resp.status === 429) msg = "Rate limit reached. Please try again in a moment.";
        if (resp.status === 402) msg = user
          ? "This book isn't cached yet and no server API key is configured. Add your Gemini key via the key button above."
          : "This book isn't in our library yet. Sign in and add a Gemini API key to analyze it, or try one of the suggested titles.";
        if (isTransientStatus(resp.status)) {
          throw new TransientStreamError("The backend is warming up. Please retry in a few seconds.");
        }
        throw new Error(msg);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let result: NovelAnalysis | null = null;
      let errorMsg: string | null = null;
      let errorStatus: number | undefined;
      let preambleAccum = "";

      const handleEvent = (event: string, data: any) => {
        if (event === "status") {
          setStatusText(data?.text ?? "");
        } else if (event === "preamble") {
          preambleAccum += data?.text ?? "";
          setPreambleText(preambleAccum);
        } else if (event === "analysis_preview") {
          // Quick preview (~1s) — show masthead before full analysis arrives.
          const p = data?.preview;
          if (p?.title) setAnalysisPreview({ title: p.title, author: p.author ?? "", summary: p.summary ?? "", thesis: p.thesis, bookType: p.bookType });
        } else if (event === "analysis") {
          // Normalise: legacy cached rows have no bookType → default to fiction
          const raw = data?.analysis;
          result = raw ? normalizeAnalysis(raw as Record<string, unknown>) : null;
          setCachedHit(!!data?.cached);
          if (data?.cacheKey) setCacheKey(data.cacheKey);
          if (data?.slug) setSlug(data.slug);
          setAnalysisPreview(null); // full analysis supersedes preview
        } else if (event === "error") {
          errorMsg = data?.error ?? "Something went wrong";
          errorStatus = typeof data?.status === "number" ? data.status : undefined;
        }
      };

      // Parse SSE: events delimited by blank line, fields are "event: x" / "data: y"
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let sepIdx: number;
        while ((sepIdx = buf.indexOf("\n\n")) !== -1) {
          const block = buf.slice(0, sepIdx);
          buf = buf.slice(sepIdx + 2);
          let event = "message";
          let dataStr = "";
          for (const rawLine of block.split("\n")) {
            const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
            if (line.startsWith("event: ")) event = line.slice(7).trim();
            else if (line.startsWith("data: ")) dataStr += line.slice(6);
          }
          if (!dataStr) continue;
          try {
            handleEvent(event, JSON.parse(dataStr));
          } catch (e) {
            console.error("SSE parse error:", e, dataStr);
          }
        }
      }

      if (errorMsg) {
        // No partial result landed before the error, and the failure looks
        // like AI-service overload rather than a hard rejection — worth a
        // fresh attempt (new request = fresh shot at the fallback chain).
        if (!result && errorStatus !== undefined && isTransientStatus(errorStatus)) {
          throw new TransientStreamError(errorMsg);
        }
        throw new Error(errorMsg);
      }
      if (!result) throw new Error("No analysis returned");
      return result;
    }

    try {
      let attempt = 0;
      let result: NovelAnalysis | null = null;
      let lastErr: unknown = null;

      while (attempt < MAX_ATTEMPTS) {
        attempt++;
        try {
          result = await attemptOnce();
          break;
        } catch (err) {
          lastErr = err;
          const isTransient = err instanceof TransientStreamError ||
            (err instanceof TypeError); // fetch()-level network failure (offline, DNS, aborted)
          if (!isTransient || attempt >= MAX_ATTEMPTS) throw err;
        }
        const backoff = 400 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);
        setStatusText(`Reconnecting… (attempt ${attempt + 1}/${MAX_ATTEMPTS})`);
        await sleep(backoff);
      }

      if (!result) {
        throw lastErr instanceof Error
          ? lastErr
          : new Error("Unable to reach the server. Check your connection.");
      }

      if (result.confidence === "unknown_work") {
        toast.error(
          "This book may be too recent for our AI, or the title wasn't recognized. " +
          "Try adding the author's name (e.g. \"Book Title by Author Name\") or add your Gemini API key to unlock extended analysis.",
          { duration: 7000 }
        );
        if (!isRefine) setAnalysis(null);
        return;
      }

      setAnalysis(result);
      // Reset to the first meaningful view for this book type
      if (!isRefine) {
        setView(result.bookType === "nonfiction" ? "ideas" : "timeline");
      }
      setActiveRefinement(refinement || null);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
      setRefining(false);
      setStatusText("");
      setPreambleText("");
      setAnalysisPreview(null);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setActiveRefinement(null);
    fetchAnalysis(title.trim());
  };

  // Deep-link: /?book=Title triggers an analysis on mount and survives refresh.
  // Also handles /og?book=Title redirects coming back from social share links —
  // the /og edge function redirects to /?book=Title so we only need to check
  // the standard ?book= param here.
  const deepLinkHandled = useRef(false);
  const deepLinkPending = useRef<string | null>(null);
  useEffect(() => {
    if (deepLinkHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    const book = params.get("book");
    if (!book) return;
    deepLinkHandled.current = true;
    deepLinkPending.current = book;
    setTitle(book);
    fetchAnalysis(book);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After the deep-linked analysis arrives, scroll the masthead into view.
  // Waiting for `analysis` ensures the anchor element actually exists.
  useEffect(() => {
    if (!analysis || !deepLinkPending.current) return;
    deepLinkPending.current = null;
    const id = window.requestAnimationFrame(() => {
      document
        .getElementById("analysis-anchor")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [analysis]);

  const handleRefine = (prompt: string) => {
    if (!analysis) return;
    fetchAnalysis(analysis.title, prompt);
  };

  const handleSelectEvent = (e: PlotEvent | null) => {
    setSelectedEventId(e?.id ?? null);
    // Auto-snap progress so the selected event isn't behind the spoiler shield
    if (e && showSpoilers === false && e.position > progress) {
      setProgress(Math.min(100, e.position));
    }
  };

  const effectiveProgress = showSpoilers ? 100 : progress;

  const highlightedCharacterIds = useMemo(() => {
    if (!analysis || !selectedEventId || !isFiction(analysis)) return [];
    return (analysis as FictionAnalysis).events.find((e) => e.id === selectedEventId)?.characterIds ?? [];
  }, [analysis, selectedEventId]);

  return (
    <div className="min-h-screen">

      {/* ===================== DATELINE STRIP ===================== */}
      <div className="dateline-strip">
        <span>NovelViz</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>Visualize any book</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>Est. 2024</span>
      </div>

      {/* ===================== HEADER — editorial masthead ===================== */}
      <Reveal as="header" duration={0.7} y={12} className="rule-double-b bg-background">
        <div className="container mx-auto flex items-stretch justify-between">
          <div className="flex items-stretch">
            <button
              type="button"
              onClick={() => {
                setAnalysis(null);
                setAnalysisPreview(null);
                setTitle("");
                setLoading(false);
                setStatusText("");
                setPreambleText("");
                setCachedHit(false);
              }}
              className="group flex items-center gap-3 border-r border-foreground px-4 py-5 transition-colors hover:bg-foreground hover:text-background"
            >
              <NovelVizLogo size={56} className="text-foreground transition-colors group-hover:text-[#5ba3d9]" />
              <div className="leading-none">
                <div className="font-sans text-2xl font-bold tracking-[-0.03em]">NovelViz</div>
                <div className="meta mt-1.5 text-muted-foreground">Visualize any book</div>
              </div>
            </button>
          </div>
          <div className="flex items-stretch">
            {user ? (
              <Link
                to="/shelf"
                className="meta hover-invert flex items-center gap-2 border-l border-foreground px-5 py-5"
              >
                <Library className="h-3.5 w-3.5" /> My shelf
              </Link>
            ) : (
              <Link
                to="/auth"
                className="meta hover-invert flex items-center gap-2 border-l border-foreground px-5 py-5"
              >
                <LogIn className="h-3.5 w-3.5" /> Sign in
              </Link>
            )}
            {user && (
              <button
                onClick={() => setGeminiDialogOpen(true)}
                className={`meta flex items-center gap-2 border-l border-foreground px-5 py-5 hover:bg-foreground hover:text-background ${geminiKey ? "text-green-600" : "text-muted-foreground"}`}
                title={geminiKey ? "Gemini key configured" : "Add your Gemini API key"}
              >
                <Key className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{geminiKey ? "Key ✓" : "API Key"}</span>
              </button>
            )}
          </div>
        </div>
      </Reveal>

      <main className="container mx-auto px-0">
        {!analysis && (
          <section className="grid grid-cols-12 gap-0">
            {/* Left rail */}
            <aside className="relative col-span-12 ink-border-b border-foreground px-4 py-6 md:col-span-2 md:border-b-0 md:border-r md:py-12">
              <div className="meta text-muted-foreground" style={{ letterSpacing: "0.28em" }}>Vol. I</div>
              <div className="display-num mt-1 text-5xl md:text-7xl" style={{ opacity: 0.12, letterSpacing: "-0.05em" }}>001</div>
              <div className="mt-4 h-px w-10 bg-foreground" />
              <div className="meta mt-4 text-muted-foreground">Book Analysis</div>
              <div className="hidden md:block absolute bottom-12 left-0 w-full flex items-end justify-center" style={{ paddingLeft: "1.5rem" }}>
                <span className="side-label text-muted-foreground/50">Visualize any book</span>
              </div>
            </aside>

            {/* Hero */}
            <div className="relative col-span-12 px-4 py-10 md:col-span-10 md:px-12 md:py-16">
              <Reveal duration={0.7} y={10} className="meta mb-8 flex flex-wrap items-center gap-3 text-muted-foreground">
                <motion.span
                  className="inline-block h-2.5 w-2.5 bg-primary"
                  animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: ease.inOut }}
                />
                A Reading Tool
                <span className="hidden md:inline-block h-px w-8 bg-foreground/30" />
                <span className="hidden md:inline">Visualize any book</span>
              </Reveal>

              <h1 className="text-balance font-sans text-6xl font-bold leading-[0.88] tracking-[-0.04em] md:text-8xl lg:text-[10.5rem]">
                {[
                  <>See the</>,
                  <><span className="italic font-serif font-normal" style={{ fontSize: "1.05em" }}>shape</span> of any</>,
                  <span className="text-primary">book.</span>,
                ].map((node, i) => (
                  <span key={i} className="block overflow-hidden">
                    <motion.span
                      className="inline-block"
                      initial={{ y: "110%" }}
                      animate={{ y: "0%" }}
                      transition={{ duration: 0.95, ease: ease.out, delay: 0.15 + i * 0.1 }}
                    >
                      {node}
                    </motion.span>
                  </span>
                ))}
              </h1>

              <Reveal delay={0.5} duration={0.7} y={8}>
                <hr className="mt-10 border-foreground/30" />
              </Reveal>

              <Reveal delay={0.55} duration={0.9} y={14}>
                <p className="mt-8 max-w-2xl font-serif text-lg leading-[1.55] text-foreground md:text-xl">
                  Type the title of any book. Fiction unfolds into characters,
                  relationships, and timelines; non-fiction into concepts, arguments, and chapters.
                  <span className="italic text-muted-foreground"> One title in, one cartography out.</span>
                </p>
              </Reveal>

              <Reveal delay={0.7} duration={0.8} y={16}>
              <form onSubmit={handleSubmit} className="mt-12 max-w-2xl" autoComplete="off">
                <div className="meta mb-2 flex items-center justify-between text-muted-foreground">
                  <span>Title</span>
                  <span className="hidden md:inline">Press <kbd className="border border-foreground bg-card px-1.5 py-0.5 text-foreground">↵</kbd> to visualize</span>
                </div>
                <div ref={wrapRef} className="crop-frame relative">
                  <span className="crop-bl" /><span className="crop-br" />
                  <div className="ink-border flex items-stretch bg-card">
                    <div className="flex items-center border-r border-foreground px-4">
                      {suggestLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-foreground" />
                      ) : (
                        <Search className="h-4 w-4 text-foreground" />
                      )}
                    </div>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      onFocus={() => suggestions.length > 0 && setSuggestOpen(true)}
                      onKeyDown={(e) => {
                        if (!suggestOpen || suggestions.length === 0) return;
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setActiveIndex((i) => (i + 1) % suggestions.length);
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
                        } else if (e.key === "Enter" && activeIndex >= 0) {
                          e.preventDefault();
                          pickSuggestion(suggestions[activeIndex]);
                        } else if (e.key === "Escape") {
                          setSuggestOpen(false);
                        }
                      }}
                      placeholder="Enter a title — fiction or nonfiction"
                      className="w-full bg-transparent py-4 font-sans text-lg placeholder:text-muted-foreground/60 focus:outline-none"
                      disabled={loading}
                      autoFocus
                      role="combobox"
                      aria-expanded={suggestOpen}
                      aria-autocomplete="list"
                    />
                    <MagneticButton
                      type="submit"
                      strength={10}
                      disabled={loading || !title.trim()}
                      className="meta flex items-center gap-2 border-l border-foreground bg-primary px-6 text-primary-foreground transition-colors hover:bg-foreground hover:text-background disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>Visualize</>}
                    </MagneticButton>
                  </div>

                  {/* Loading state — local index empty, waiting for network */}
                  {suggestOpen && suggestions.length === 0 && suggestLoading && title.trim().length >= 2 && (
                    <ul className="ink-border absolute left-0 right-0 top-full z-20 mt-[-1px] bg-card">
                      <li className="meta flex items-center gap-2 px-4 py-3 text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Searching Open Library…
                      </li>
                    </ul>
                  )}

                  {/* No-results state — press Enter to analyze directly */}
                  {suggestOpen && suggestions.length === 0 && !suggestLoading && title.trim().length >= 2 && (
                    <ul className="ink-border absolute left-0 right-0 top-full z-20 mt-[-1px] bg-card">
                      <li className="meta border-b border-foreground/30 bg-background px-4 py-2 text-muted-foreground">
                        Not in search index — analyze directly
                      </li>
                      <li role="option">
                        <button
                          type="button"
                          onClick={() => {
                            setSuggestOpen(false);
                            fetchAnalysis(title.trim());
                          }}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-foreground hover:text-background"
                        >
                          <span className="font-serif italic flex-1 truncate">{title.trim()}</span>
                          <span className="meta text-muted-foreground shrink-0 group-hover:text-background">→ Analyze directly</span>
                        </button>
                      </li>
                    </ul>
                  )}

                  {suggestOpen && suggestions.length > 0 && (
                    <ul
                      role="listbox"
                      className="ink-border absolute left-0 right-0 top-full z-20 mt-[-1px] max-h-[360px] overflow-y-auto bg-card"
                    >
                      <li className="meta flex items-center justify-between border-b border-foreground/30 bg-background px-4 py-2 text-muted-foreground">
                        <span>Matches · Open Library</span>
                        <span>↑↓ Enter</span>
                      </li>
                      {suggestions.map((s, i) => (
                        <li key={s.key + i} role="option" aria-selected={i === activeIndex}>
                          <button
                            type="button"
                            onMouseEnter={() => {
                              setActiveIndex(i);
                              const hint = s.author && s.author !== "Unknown" ? `${s.title} by ${s.author}` : s.title;
                              prefetchAnalysis(hint);
                            }}
                            onClick={() => pickSuggestion(s)}
                            className={cn(
                              "flex w-full items-baseline gap-3 border-b border-foreground/20 px-4 py-3 text-left transition-colors",
                              i === activeIndex
                                ? "bg-foreground text-background"
                                : "hover:bg-foreground hover:text-background",
                            )}
                          >
                            <span
                              className={cn(
                                "meta w-6 shrink-0",
                                i === activeIndex ? "text-background/60" : "text-muted-foreground",
                              )}
                            >
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5 md:flex-row md:items-baseline md:gap-3">
                              <span className="flex min-w-0 items-baseline gap-2">
                                <span className="truncate font-serif text-base italic">
                                  {s.title}
                                </span>
                                {s.shelfBoost && (
                                  <span
                                    className={cn(
                                      "meta shrink-0 border px-1 py-px",
                                      i === activeIndex
                                        ? "border-background/60 text-background"
                                        : "border-accent text-accent",
                                    )}
                                    title="Author already on your shelf"
                                  >
                                    ★ Shelf
                                  </span>
                                )}
                              </span>
                              <span
                                className={cn(
                                  "truncate font-sans text-xs md:text-sm md:ml-auto",
                                  i === activeIndex ? "text-background/80" : "text-foreground/70",
                                )}
                              >
                                {s.author && s.author !== "Unknown" ? s.author : "—"}
                              </span>
                            </span>
                            {s.year && (
                              <span
                                className={cn(
                                  "meta shrink-0",
                                  i === activeIndex ? "text-background/60" : "text-muted-foreground",
                                )}
                              >
                                {s.year}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </form>
              </Reveal>

              <Reveal delay={0.85} duration={0.8} y={16} className="mt-12">
                <div className="meta mb-4 flex items-center gap-3 text-muted-foreground">
                  <span className="inline-block h-2 w-2 bg-accent" />
                  {`Reading List · No. ${new Date().getFullYear()}`}
                  <span className="inline-block h-px w-12 bg-foreground/40" />
                </div>
                <StaggerGroup className="ink-border grid grid-cols-2 bg-card md:grid-cols-3">
                  {seedSuggestions.map((s, i) => (
                    <StaggerItem key={s}>
                      <motion.button
                        onMouseEnter={() => prefetchAnalysis(s)}
                        onFocus={() => prefetchAnalysis(s)}
                        onClick={() => {
                          setTitle(s);
                          fetchAnalysis(s);
                        }}
                        disabled={loading}
                        whileHover="hover"
                        initial="rest"
                        animate="rest"
                        className={cn(
                          "group relative flex h-full min-h-[120px] w-full flex-col justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-foreground hover:text-background",
                          (i % 2 !== 1) && "border-r border-foreground md:border-r-0",
                          ((i + 1) % 3 !== 0) && "md:border-r md:border-foreground",
                          i < seedSuggestions.length - 2 && "border-b border-foreground md:border-b-0",
                          i < seedSuggestions.length - 3 && "md:border-b md:border-foreground",
                        )}
                      >
                        <motion.span
                          variants={{ rest: { y: 0 }, hover: { y: -2 } }}
                          transition={{ duration: 0.4, ease: ease.out }}
                          className="font-serif italic text-3xl text-foreground/25 group-hover:text-background/50"
                          style={{ letterSpacing: "-0.04em" }}
                        >
                          {String(i + 1).padStart(2, "0")}
                        </motion.span>
                        <span className="font-serif text-base italic leading-tight">{s}</span>
                        <motion.span
                          variants={{ rest: { x: -4, opacity: 0 }, hover: { x: 0, opacity: 1 } }}
                          transition={{ duration: 0.35, ease: ease.out }}
                          className="meta absolute right-3 top-3 text-background/70"
                        >
                          → Open
                        </motion.span>
                      </motion.button>
                    </StaggerItem>
                  ))}
                </StaggerGroup>
                <div className="meta mt-3 text-muted-foreground">
                  Six titles, freshly shuffled · refresh for more
                </div>
              </Reveal>

              {loading && (
                <div className="mt-12 ink-border bg-card">
                  <div className="flex items-center gap-3 border-b border-foreground/30 px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="meta">{cachedHit ? "Library Hit" : "Reading the Book"}</span>
                    {statusText && (
                      <span className="meta text-muted-foreground">· {statusText}</span>
                    )}
                  </div>
                  {preambleText && (
                    <div className="px-4 py-4 font-serif text-base italic leading-relaxed">
                      <Suspense fallback={<MarkdownFallback />}>
                        <ReactMarkdown>{preambleText}</ReactMarkdown>
                      </Suspense>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Preview masthead — shown ~1s after search while full analysis loads */}
        {!analysis && loading && analysisPreview && (
          <div>
            <section className="grid grid-cols-12 gap-0 ink-border-b">
              <div className="col-span-12 border-foreground px-4 py-6 md:col-span-2 md:border-r md:py-8">
                <div className="flex items-start gap-4 md:flex-col md:gap-0">
                  {coverUrl && (
                    <img
                      src={coverUrl}
                      alt=""
                      className="w-14 flex-shrink-0 rounded shadow-lg ring-1 ring-foreground/10 md:mb-4 md:w-full md:max-w-[108px]"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                  <div>
                    <div className="meta text-muted-foreground">Subject</div>
                    <div className="display-num mt-2 text-4xl text-muted-foreground/40 md:text-6xl">—</div>
                    <div className="meta mt-2 text-muted-foreground">Mapping…</div>
                  </div>
                </div>
              </div>
              <div className="col-span-12 px-4 py-6 md:col-span-7 md:px-8 md:py-8">
                <div className={analysisPreview.author ? "font-serif italic text-lg text-muted-foreground" : "meta text-muted-foreground"}>
                  {analysisPreview.author ? `By ${analysisPreview.author}` : "Visualization"}
                </div>
                <h1 className="mt-2 font-sans text-3xl font-extrabold leading-[1] tracking-tight md:text-6xl">
                  {analysisPreview.title}
                </h1>
                {analysisPreview.thesis && (
                  <p className="mt-2 font-sans text-sm font-medium text-primary/80 italic">
                    "{analysisPreview.thesis}"
                  </p>
                )}
                <p className="mt-3 max-w-3xl font-serif text-sm leading-relaxed text-muted-foreground md:text-base">
                  {analysisPreview.summary}
                </p>
              </div>
              <div className="col-span-12 px-4 py-6 md:col-span-3 md:border-l md:py-8">
                <div className="meta text-muted-foreground">Building visualization…</div>
                <div className="mt-3 space-y-2">
                  {[60, 80, 45].map((w, i) => (
                    <div key={i} className="h-2 animate-pulse rounded bg-muted-foreground/20" style={{ width: `${w}%` }} />
                  ))}
                </div>
              </div>
            </section>
            <div className="ink-border-b px-4 py-6 text-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              Building the full visualization…
            </div>
          </div>
        )}

        {analysis && (
          <div>
            {/* ===================== ANALYSIS MASTHEAD ===================== */}
            <section id="analysis-anchor" className="grid grid-cols-12 gap-0 ink-border-b scroll-mt-20">
              <div className="col-span-12 border-foreground px-4 py-6 md:col-span-2 md:border-r md:py-8">
                <div className="flex items-start gap-4 md:flex-col md:gap-0">
                  {coverUrl && (
                    <img
                      src={coverUrl}
                      alt={`${analysis.title} cover`}
                      className="w-14 flex-shrink-0 rounded shadow-lg ring-1 ring-foreground/10 md:mb-4 md:w-full md:max-w-[108px]"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                  <div>
                    <div className="meta text-muted-foreground">Subject</div>
                    <div className="display-num mt-2 text-4xl md:text-6xl">
                      {isFiction(analysis)
                        ? String(analysis.events?.length ?? 0).padStart(2, "0")
                        : String((analysis as NonFictionAnalysis).concepts?.length ?? 0).padStart(2, "0")}
                    </div>
                    <div className="meta mt-2 text-muted-foreground">
                      {isFiction(analysis) ? "Events Mapped" : "Concepts"}
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-span-12 px-4 py-6 md:col-span-7 md:px-8 md:py-8">
                <div className={analysis.author && analysis.author !== "Unknown" ? "font-serif italic text-lg text-muted-foreground" : "meta text-muted-foreground"}>
                  {analysis.author && analysis.author !== "Unknown"
                    ? `By ${analysis.author}`
                    : "Visualization"}
                </div>
                <h1 className="mt-2 font-sans text-3xl font-extrabold leading-[1] tracking-tight md:text-6xl">
                  {analysis.title}
                </h1>
                {isNonFiction(analysis) && (analysis as NonFictionAnalysis).thesis && (
                  <p className="mt-2 font-sans text-sm font-medium text-primary/80 italic">
                    "{(analysis as NonFictionAnalysis).thesis}"
                  </p>
                )}
                <p className="mt-3 max-w-3xl font-serif text-sm leading-relaxed text-muted-foreground md:text-base">
                  {analysis.summary}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <ShelfChip analysis={analysis} cacheKey={cacheKey} />
                  <BuyButton title={analysis.title} author={analysis.author || ""} variant="primary" size="md" />
                  <ShareButton
                    title={analysis.title}
                    author={analysis.author || ""}
                    signature={analysis.dna?.signature}
                    slug={slug ?? undefined}
                  />
                  {activeRefinement && (
                    <div className="meta inline-flex items-center gap-2 border border-foreground bg-foreground px-3 py-1.5 text-background">
                      <RefreshCw className="h-3 w-3" /> Refined · "{activeRefinement}"
                    </div>
                  )}
                </div>
              </div>
              <div className="col-span-12 grid grid-cols-2 border-foreground md:col-span-3 md:border-l">
                <div className="border-foreground p-4 md:border-b">
                  <div className="meta text-muted-foreground">
                    {isFiction(analysis) ? "Characters" : "Chapters"}
                  </div>
                  <div className="display-num mt-1 text-3xl md:text-4xl">
                    {isFiction(analysis)
                      ? String(analysis.characters?.length ?? 0).padStart(2, "0")
                      : String((analysis as NonFictionAnalysis).chapters?.length ?? 0).padStart(2, "0")}
                  </div>
                </div>
                <div className="border-l border-foreground p-4 md:border-b">
                  <div className="meta text-muted-foreground">
                    {isFiction(analysis) ? "Lanes" : "Type"}
                  </div>
                  <div className="display-num mt-1 text-3xl md:text-4xl">
                    {isFiction(analysis)
                      ? String(analysis.lanes?.length ?? 0).padStart(2, "0")
                      : <span className="font-sans text-sm font-semibold uppercase">Nonfiction</span>}
                  </div>
                </div>
                <div className="border-t border-foreground p-4">
                  <div className="meta text-muted-foreground">Mode</div>
                  <div className="mt-1 font-sans text-sm font-semibold capitalize">{view}</div>
                </div>
                <div className="border-l border-t border-foreground p-4">
                  <div className="meta text-muted-foreground">
                    {isFiction(analysis) ? "Progress" : "DNA"}
                  </div>
                  <div className="mt-1 font-sans text-sm font-semibold">
                    {isFiction(analysis)
                      ? `${Math.round(effectiveProgress)}%`
                      : analysis.dna?.signature ?? "—"}
                  </div>
                </div>
              </div>
            </section>

            {/* ===================== SPOILER STRIP — fiction only ===================== */}
            {isFiction(analysis) && <section className="ink-border-b grid grid-cols-12 items-stretch">
              <div className="col-span-12 flex items-center gap-3 border-foreground px-4 py-3 md:col-span-3 md:border-r">
                <button
                  onClick={() => setShowSpoilers((s) => !s)}
                  className={cn(
                    "meta inline-flex items-center gap-2 border border-foreground px-3 py-2 transition-colors",
                    showSpoilers
                      ? "bg-card hover:bg-foreground hover:text-background"
                      : "bg-foreground text-background",
                  )}
                >
                  {showSpoilers ? (
                    <><Eye className="h-3 w-3" /> Spoilers · ON</>
                  ) : (
                    <><EyeOff className="h-3 w-3" /> Spoiler-Safe</>
                  )}
                </button>
              </div>
              <div className="col-span-12 px-4 py-3 md:col-span-6">
                {showSpoilers ? (
                  <div className="meta flex h-full items-center text-muted-foreground">
                    Showing the entire book
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <span className="meta text-muted-foreground">Reading at</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={progress}
                      onChange={(e) => setProgress(Number(e.target.value))}
                      className="h-1 flex-1 accent-[hsl(var(--primary))]"
                      aria-label="Reading progress"
                    />
                    <span className="display-num w-14 text-right text-lg">
                      {Math.round(progress)}%
                    </span>
                  </div>
                )}
              </div>
              <div className="col-span-12 flex items-center gap-1 border-foreground px-4 py-3 md:col-span-3 md:border-l">
                {[10, 25, 50, 75, 100].map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setShowSpoilers(false);
                      setProgress(p);
                    }}
                    className={cn(
                      "meta flex-1 border border-foreground px-2 py-1.5 transition-colors",
                      !showSpoilers && Math.round(progress) === p
                        ? "bg-foreground text-background"
                        : "bg-card hover:bg-foreground hover:text-background",
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </section>}

            {/* ===================== VIEW TOGGLE ===================== */}
            <section className="ink-border-b flex items-center justify-between px-4 py-3">
              <div className="min-w-0 flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex w-max items-stretch border border-foreground">
                {isFiction(analysis) ? (
                  (["timeline", "network", "dna", "takeaways"] as const).map((v, i) => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      className={cn(
                        "meta whitespace-nowrap px-4 py-2.5 transition-colors",
                        i > 0 && "border-l border-foreground",
                        view === v
                          ? "bg-primary text-primary-foreground"
                          : "bg-card hover:bg-primary/10",
                      )}
                    >
                      {v === "timeline"
                        ? "01 · Timeline"
                        : v === "network"
                          ? "02 · Network"
                          : v === "dna"
                            ? "03 · DNA"
                            : "04 · Takeaways"}
                    </button>
                  ))
                ) : (
                  (["ideas", "chapters", "dna", "takeaways"] as const).map((v, i) => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      className={cn(
                        "meta whitespace-nowrap px-4 py-2.5 transition-colors",
                        i > 0 && "border-l border-foreground",
                        view === v
                          ? "bg-primary text-primary-foreground"
                          : "bg-card hover:bg-primary/10",
                      )}
                    >
                      {v === "ideas"
                        ? "01 · Ideas"
                        : v === "chapters"
                          ? "02 · Chapters"
                          : v === "dna"
                            ? "03 · DNA"
                            : "04 · Takeaways"}
                    </button>
                  ))
                )}
              </div>
              </div>
              {refining && (
                <div className="meta flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Refining…
                </div>
              )}
            </section>

            {/* ===================== VIZ ===================== */}
            <section
              className={cn(
                "ink-border-b bg-card transition-opacity",
                view !== "takeaways" && "px-4 py-6 md:px-8 md:py-10",
                refining && "opacity-50",
              )}
            >
              {/* ── Fiction views ── */}
              {view === "timeline" && isFiction(analysis) && (
                <TimelineView
                  analysis={analysis as FictionAnalysis}
                  progress={effectiveProgress}
                  selectedEventId={selectedEventId}
                  onSelectEvent={handleSelectEvent}
                  selectedCharacterId={selectedCharacterId}
                  onSelectCharacter={setSelectedCharacterId}
                />
              )}
              {view === "network" && isFiction(analysis) && (
                <CharacterNetwork
                  analysis={analysis as FictionAnalysis}
                  progress={effectiveProgress}
                  onProgressChange={(next) => {
                    setShowSpoilers(false);
                    setProgress(next);
                  }}
                  cacheKey={cacheKey}
                  selectedCharacterId={selectedCharacterId}
                  onSelectCharacter={(id) => {
                    setSelectedCharacterId(id);
                    if (id) setView("network");
                  }}
                  highlightedCharacterIds={highlightedCharacterIds}
                  onSelectEventId={(eventId) => {
                    setSelectedEventId(eventId);
                    setView("timeline");
                  }}
                />
              )}
              {/* ── Non-fiction views ── */}
              {view === "ideas" && isNonFiction(analysis) && (
                <IdeasTab
                  analysis={analysis as NonFictionAnalysis}
                  cacheKey={cacheKey}
                  onReanalyze={() => fetchAnalysis(analysis.title, undefined, { reanalyze: true })}
                />
              )}
              {view === "concepts" && isNonFiction(analysis) && (
                <ConceptMap analysis={analysis as NonFictionAnalysis} />
              )}
              {view === "chapters" && isNonFiction(analysis) && (
                <ChapterBreakdown analysis={analysis as NonFictionAnalysis} />
              )}
              {/* ── Shared views ── */}
              {view === "dna" && (
                <BookDNA analysis={analysis} cacheKey={cacheKey} />
              )}
              {view === "takeaways" && (
                <TakeawaysTab analysis={analysis} cacheKey={cacheKey} />
              )}
            </section>

            {isFiction(analysis) && view !== "takeaways" && (
              <section className="ink-border-b px-4 py-6 md:px-8">
                <RefinementPrompts onPick={handleRefine} disabled={refining} />
              </section>
            )}

            {/* ===================== READING NOTES ===================== */}
            <ReaderNotes cacheKey={cacheKey} bookTitle={analysis.title} />

            {/* ===================== READER'S NOTES ===================== */}
            <section className="grid grid-cols-12 gap-0">
              <div className="col-span-12 border-foreground px-4 py-6 md:col-span-2 md:border-r md:py-10">
                <div className="meta text-muted-foreground">Essay</div>
                <div className="display-num mt-2 text-4xl md:text-6xl">02</div>
                <div className="meta mt-2 text-muted-foreground">
                  {isFiction(analysis) ? "Reader's Notes" : "Critical Essay"}
                </div>
                <div className="mt-1 font-serif text-xs italic text-muted-foreground">An essay</div>
              </div>
              <div className="col-span-12 px-4 py-6 md:col-span-10 md:px-10 md:py-10">
                <div className="prose prose-sm max-w-3xl font-serif text-foreground prose-headings:font-sans prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-foreground prose-strong:text-foreground prose-a:text-primary prose-a:no-underline hover:prose-a:underline md:prose-base">
                  <Suspense fallback={<MarkdownFallback />}>
                    <ReactMarkdown>{analysis.explanation}</ReactMarkdown>
                  </Suspense>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      <GeminiKeyDialog open={geminiDialogOpen} onClose={() => setGeminiDialogOpen(false)} />
    </div>
  );
};

export default Index;
