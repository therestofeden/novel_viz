import { useEffect, useMemo, useRef, useState, lazy, Suspense, FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2, Search, RefreshCw, Eye, EyeOff, Key } from "lucide-react";
import { NovelVizLogo } from "@/components/NovelVizLogo";
import { MagneticButton } from "@/lib/motion";

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
// Same fix as react-markdown above, applied to a much bigger offender: these
// 7 tab-view components are the actual "visualize any book" feature, but
// only ONE is ever visible at a time (gated by `view === ...` below), and
// Index.tsx is the search bar / landing page itself — the very first bundle
// every visitor downloads, before they've typed a single character. Static
// imports here put ~4,700 lines of combined tab code (the same components
// also just lazy-split on BookPage.tsx) on the critical path of every single
// visit, search or no search. lazy() + Suspense per tab (mirrored below at
// each view === "..." render site) means only the one tab a reader actually
// lands on is fetched, and none of it blocks the initial page paint.
const TimelineView = lazy(() => import("@/components/TimelineView").then((m) => ({ default: m.TimelineView })));
const CharacterNetwork = lazy(() => import("@/components/CharacterNetwork").then((m) => ({ default: m.CharacterNetwork })));
const BookDNA = lazy(() => import("@/components/BookDNA").then((m) => ({ default: m.BookDNA })));
const ConceptMap = lazy(() => import("@/components/ConceptMap").then((m) => ({ default: m.ConceptMap })));
const IdeasTab = lazy(() => import("@/components/IdeasTab").then((m) => ({ default: m.IdeasTab })));
const ChapterBreakdown = lazy(() => import("@/components/ChapterBreakdown").then((m) => ({ default: m.ChapterBreakdown })));
const TakeawaysTab = lazy(() => import("@/components/TakeawaysTab").then((m) => ({ default: m.TakeawaysTab })));

// 2026-11-06: warm every tab chunk once the page is idle. A phone tab that
// was opened before a deploy keeps running the old build; the first time it
// renders an analysis it asks for tab chunks whose hashed filenames no longer
// exist, the chunk-reload handler reloads the page, and the reader's click is
// lost (they land back on the empty home page and have to search again).
// Fetching the chunks while this build is still the live one means they are
// already in the module map by the time an analysis renders. import() is
// memoised by the module loader, so lazy() above reuses these same promises.
const warmTabChunks = () => {
  const loaders = [
    () => import("@/components/TimelineView"),
    () => import("@/components/CharacterNetwork"),
    () => import("@/components/BookDNA"),
    () => import("@/components/ConceptMap"),
    () => import("@/components/IdeasTab"),
    () => import("@/components/ChapterBreakdown"),
    () => import("@/components/TakeawaysTab"),
  ];
  for (const load of loaders) load().catch(() => { /* best-effort; the real render path handles failures */ });
};
const TabFallback = () => (
  <div className="flex min-h-[240px] items-center justify-center">
    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
  </div>
);
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RefinementPrompts } from "@/components/RefinementPrompts";
import { ReaderNotes } from "@/components/ReaderNotes";
import { useMembership } from "@/hooks/useMembership";
import { BookHero } from "@/components/BookHero";
import { DnaTraits } from "@/components/DnaTraits";
import { GlyphWall } from "@/components/GlyphWall";
import { HomeLibrary, type ContinueBookView, type LibraryBook } from "@/components/HomeLibrary";
import { glyphSource } from "@/lib/dna-glyph";
import { CoverPlate } from "@/components/CoverPlate";
import { fetchCoverUrl } from "@/lib/covers";
import { GeminiKeyDialog } from "@/components/GeminiKeyDialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { track } from "@/lib/track";
import { cn, normalizeForSearch } from "@/lib/utils";

// Bounded timeouts for this page's background/autocomplete fetches — none of
// these had a client-side ceiling before 2026-09-15 (unlike covers.ts and
// TakeawaysTab.tsx, which both learned this lesson earlier). A network-level
// stall (not a clean error/rejection — the class AbortSignal.timeout catches
// that a plain `await fetch()` cannot) previously meant these just hung:
//  - PREFETCH_TIMEOUT_MS: prefetchAnalysis() below hits analyze-novel with
//    prefetch:true. On a cache hit this resolves in well under a second, but
//    a cache MISS falls through to a real Gemini generation, so this needs
//    the same headroom as TakeawaysTab's QUESTIONS_FETCH_TIMEOUT_MS — server
//    hard-caps at MAX_TOTAL_MS=90_000 (supabase/functions/_shared/gemini.ts),
//    so 100_000 gives the same margin. Without this, a stalled prefetch left
//    its title permanently marked "prefetched" in prefetchedRef (the .catch
//    that clears it on failure never fires on a hang, only on a real
//    rejection) — silently disabling prefetch for that title for the rest of
//    the session, plus tying up a keepalive connection indefinitely.
//  - LOCAL_INDEX_TIMEOUT_MS / SEARCH_SUGGEST_TIMEOUT_MS: popular-books and
//    search-books are both plain DB-backed reads with no Gemini dependency —
//    search-books' own worst-case server budget is OL_TOTAL_BUDGET_MS=3500ms
//    (plus smaller parallel GB/canon stages), so 8s gives ~2x headroom over
//    that plus a cold-start margin, same ratio as this file's other timeouts.
//    The search-books case is the more user-visible of the two: unlike the
//    popular-books mount fetch (silent background load, no UI tied to it), a
//    hang there left setSuggestLoading(true) permanently stuck — the
//    autocomplete dropdown's own `finally` that clears it never runs because
//    a hung fetch never resolves OR rejects, so the spinner just never stops.
const PREFETCH_TIMEOUT_MS = 100_000;
const LOCAL_INDEX_TIMEOUT_MS = 8_000;
const SEARCH_SUGGEST_TIMEOUT_MS = 8_000;
// ANALYSIS_IDLE_TIMEOUT_MS: the main fetchAnalysis() SSE call below — the
// actual search-bar-to-visualization request every one of these other
// timeouts exists to protect the *surrounding* UI for — had no ceiling at
// all until 2026-09-16, despite being the highest-stakes fetch in the file.
// It's an SSE stream, so a blanket AbortSignal.timeout() on the whole
// request would be wrong (a legitimate generation can legitimately run
// close to the server's own MAX_TOTAL_MS=90_000 cap while still emitting
// "status"/"preamble" progress events the whole way). Instead this is an
// *idle* timeout, re-armed on the initial fetch() call and again on every
// `reader.read()` — so a request that's actively streaming progress is
// never killed, but a connection that goes silent (dead TCP connection,
// Supabase edge function cold-start that never completes, a proxy that
// swallowed the stream) for ANALYSIS_IDLE_TIMEOUT_MS is aborted rather than
// hanging forever. 100_000 matches PREFETCH_TIMEOUT_MS's margin above the
// server's 90s hard cap for the same reason. Without this, a stalled
// connection left `loading`/`refining` stuck true permanently — no spinner
// timeout, no error, no retry — since neither the fetch() promise nor the
// reader.read() promise would ever settle on their own.
const ANALYSIS_IDLE_TIMEOUT_MS = 100_000;

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

const Index = () => {
  const [title, setTitle] = useState("");
  const [analysis, setAnalysis] = useState<NovelAnalysis | null>(null);
  const [analysisPreview, setAnalysisPreview] = useState<{ title: string; author: string; summary: string; thesis?: string; bookType?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [refining, setRefining] = useState(false);
  const [view, setView] = useState<"timeline" | "network" | "dna" | "concepts" | "ideas" | "chapters" | "takeaways">("network");
  const [activeRefinement, setActiveRefinement] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  // The title of the last fresh (non-refine) analysis this page started. The
  // ?book= deep-link effect compares against it so that our own URL write in
  // fetchAnalysis doesn't bounce back and trigger a second analysis.
  const lastRequestedBookRef = useRef<string | null>(null);

  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(warmTabChunks, { timeout: 4000 });
      return () => w.cancelIdleCallback?.(id);
    }
    // Safari has no requestIdleCallback.
    const id = window.setTimeout(warmTabChunks, 2000);
    return () => window.clearTimeout(id);
  }, []);

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
      signal: AbortSignal.timeout(PREFETCH_TIMEOUT_MS),
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
  // 2026-09-18 daily perf pass: IndexedBook used to also carry a `haystack`
  // field (`${title} ${author}`.toLowerCase()), built for every row in this
  // mapping step. searchLocalIndex below (the only reader of this index)
  // only ever matches against normTitle/normAuthor/normHaystack — grepped
  // the whole src/ tree and confirmed `.haystack` has zero read sites, on
  // this type or anywhere else. It was dead weight on the one place in the
  // app that's genuinely hot: this map() runs once per page load over the
  // full popular-books payload (novel_analyses + search_cache + canon_books
  // + seed_book_list, deduped — hundreds to low thousands of rows and
  // growing with every daily canon round), directly gating when the Tier-1
  // instant index becomes usable. Removed the unused field and its
  // string-concat + toLowerCase() computation; normHaystack (the field
  // actually used for scoring) is unaffected.
  type IndexedBook = { title: string; author: string; popularity: number; normTitle: string; normAuthor: string; normHaystack: string };
  const popularIndexRef = useRef<IndexedBook[]>([]);

  useEffect(() => {
    // 2026-10-26 (daily backend audit): read the CDN snapshot first. The
    // popular-books function is cold on nearly every page load (~1.6-2.2 s);
    // it now also writes its payload to a public Storage object
    // (public-snapshots/popular-books/v1.json) that the Storage CDN serves in
    // ~100 ms. Falls back to the function if the snapshot is missing,
    // malformed, older than 48 h, or slower than 2.5 s -- so behaviour is
    // never worse than before, and the function call also refreshes it.
    const base = import.meta.env.VITE_SUPABASE_URL;
    const fnUrl = `${base}/functions/v1/popular-books`;
    const snapshotUrl = `${base}/storage/v1/object/public/public-snapshots/popular-books/v1.json`;
    const SNAPSHOT_MAX_AGE_MS = 48 * 60 * 60 * 1000;
    const fromFunction = () =>
      fetch(fnUrl, {
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        signal: AbortSignal.timeout(LOCAL_INDEX_TIMEOUT_MS),
      }).then((r) => r.json());
    fetch(snapshotUrl, { signal: AbortSignal.timeout(2_500) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`snapshot ${r.status}`))))
      .then((j) => {
        const built = Date.parse(j?.builtAt ?? "");
        if (!Array.isArray(j?.results) || j.results.length === 0 || !(Date.now() - built < SNAPSHOT_MAX_AGE_MS)) {
          throw new Error("snapshot stale or empty");
        }
        return j;
      })
      .catch(() => fromFunction())
      .then((j) => {
        const rows = (j?.results ?? []) as Array<{ title: string; author: string; popularity: number; normTitle?: string; normAuthor?: string }>;
        popularIndexRef.current = rows.map((b) => {
          const normTitle = b.normTitle ?? normalizeForSearch(b.title);
          const normAuthor = b.normAuthor ?? normalizeForSearch(b.author ?? "");
          return {
            title: b.title,
            author: b.author ?? "",
            popularity: b.popularity ?? 0,
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

    // (Previously short-circuited longer queries whenever a shorter prefix had
    // already come back empty — e.g. "...marco pol" → 0 results would block
    // "...marco polo" from ever being fetched. Removed 2026-07-24: found live
    // that upstream (OpenLibrary/Google Books) result counts are NOT monotonic
    // in query length — a query ending mid-word, one character before
    // completing a real word ("marco pol"), can legitimately return zero while
    // the completed word ("marco polo") returns a confident top hit, because
    // neither upstream search engine does prefix-completion on the last token
    // of a multi-word phrase query. The debounce below plus the exact-string
    // cache above already avoid redundant fetches for a query the user isn't
    // actively changing; that's sufficient without assuming "empty now" means
    // "empty forever, and for everything built on top of it too.")

    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const seq = ++searchSeqRef.current;
      // Upper bound on top of the supersede-on-new-keystroke abort above:
      // that only fires when a *newer* query comes in, so a genuine network
      // stall on the last keystroke the user types was previously unbounded
      // — see SEARCH_SUGGEST_TIMEOUT_MS comment near the top of this file.
      // Plain setTimeout+abort (not AbortSignal.any) to match this file's
      // existing minimum-browser-support bar and search-books' own
      // server-side timeout style.
      const timeoutId = setTimeout(() => ctrl.abort(), SEARCH_SUGGEST_TIMEOUT_MS);
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
        clearTimeout(timeoutId);
        if (seq === searchSeqRef.current) setSuggestLoading(false);
      }
    }, 150);
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

  // Keep the search input + dropdown in view when the on-screen keyboard opens.
  // The dropdown is `absolute top-full` relative to wrapRef — on mobile, the
  // keyboard shrinks the visual viewport from the bottom without triggering any
  // native reflow, so the suggestions can render behind/under the keyboard even
  // though the input itself stays visible. scrollIntoView({ block: "nearest" })
  // nudges the browser's native "keep focused element in view" behavior to also
  // account for the newly-appeared dropdown content below the input. This is a
  // no-op in practice on desktop (nothing to scroll — the dropdown already fits).
  const [dropdownMaxHeight, setDropdownMaxHeight] = useState<number | null>(null);
  useEffect(() => {
    const hasContent = suggestOpen && (suggestions.length > 0 || title.trim().length >= 2);
    if (!hasContent) return;

    // Cap dropdown height to whatever's visible above the on-screen keyboard
    // (VisualViewport API — widely supported in mobile Safari/Chrome; falls
    // back to no cap where unsupported, since scrollIntoView still applies).
    const vv = window.visualViewport;
    if (vv && wrapRef.current) {
      const wrapBottom = wrapRef.current.getBoundingClientRect().bottom;
      const visibleBottom = vv.height + vv.offsetTop;
      const available = visibleBottom - wrapBottom - 16; // 16px breathing room
      if (available > 0 && available < 360) {
        setDropdownMaxHeight(Math.max(120, available));
      } else {
        setDropdownMaxHeight(null);
      }
    }

    const id = window.requestAnimationFrame(() => {
      wrapRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      console.log(JSON.stringify({ ui: "search_autocomplete", event: "opened_keyboard_aware" }));
    });
    return () => window.cancelAnimationFrame(id);
  }, [suggestOpen, suggestions.length, title]);

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
  // 2026-11-18: "Refine the visualization" is a members' feature. Locked for
  // guests and non-members once membership has loaded and the paywall switch
  // is on; analyze-novel enforces the same rule server-side.
  const membership = useMembership();
  const refineLocked = !membership.loading && membership.paywall && (!user || !membership.isMember);
  const [geminiDialogOpen, setGeminiDialogOpen] = useState(false);

  // ============================================================
  // Signed-in home dashboard (design review 09-10: "tool, not habitat" —
  // personalize the signed-in landing instead of repeating the signed-out
  // marketing hero). Every field here comes from a plain read of the
  // reader's own rows (RLS-scoped) — nothing here ever calls Gemini live,
  // so this costs nothing beyond what the reader already generated by using
  // the app. If a section has nothing to show, it renders an honest empty
  // state rather than a fabricated placeholder.
  // ============================================================
  type NoteWaiting = { title: string; author: string };
  type HomeRecommendation = { title: string; author: string; why: string };
  const [continueBook, setContinueBook] = useState<ContinueBookView | null>(null);
  const [shelfCounts, setShelfCounts] = useState<{ total: number; reading: number; finished: number } | null>(null);
  const [notesWaiting, setNotesWaiting] = useState<NoteWaiting[]>([]);
  const [homeRecommendation, setHomeRecommendation] = useState<HomeRecommendation | null>(null);

  // "Your library": finished books drawn as glyph plates plus the reader's
  // average reading shape. Still cost-zero: reads shelf_books plus
  // already-cached novel_analyses rows, never a fresh Gemini call.
  type LibraryProfile = {
    finishedThisYear: number;
    books: LibraryBook[];
  };
  const [libraryProfile, setLibraryProfile] = useState<LibraryProfile | null>(null);

  useEffect(() => {
    if (!user) {
      setContinueBook(null);
      setShelfCounts(null);
      setNotesWaiting([]);
      setHomeRecommendation(null);
      setLibraryProfile(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: shelfRows }, { data: takeawayRows }, { data: overrideRows }] = await Promise.all([
        supabase.from("shelf_books").select("title, author, status, started_at, finished_at, cache_key, rating"),
        supabase
          .from("book_takeaways")
          .select("title, author, updated_at")
          .neq("status", "complete")
          .order("updated_at", { ascending: false })
          .limit(3),
        supabase
          .from("book_overrides")
          .select("cache_key")
          .order("updated_at", { ascending: false })
          .limit(1),
      ]);
      if (cancelled) return;

      const rows = shelfRows ?? [];
      setShelfCounts({
        total: rows.length,
        reading: rows.filter((r) => r.status === "reading").length,
        finished: rows.filter((r) => r.status === "finished").length,
      });
      const reading = [...rows]
        .filter((r) => r.status === "reading")
        .sort((a, b) => (b.started_at ?? "").localeCompare(a.started_at ?? ""))[0];
      setContinueBook(
        reading
          ? { title: reading.title, author: reading.author, startedAt: reading.started_at, slug: null, glyph: null }
          : null,
      );

      const finishedRows = rows
        .filter((r) => r.status === "finished")
        .sort((a, b) => (b.finished_at ?? "").localeCompare(a.finished_at ?? ""));
      const thisYear = new Date().getFullYear();
      const finishedThisYear = finishedRows.filter(
        (r) => r.finished_at && new Date(r.finished_at).getFullYear() === thisYear,
      ).length;

      // One read of the (already cached) analyses behind the book in hand and
      // the finished shelf: enough to draw each glyph and link to its page.
      const wantKeys = [...new Set([...finishedRows.map((r) => r.cache_key), reading?.cache_key].filter(Boolean))] as string[];
      const byKey = new Map<string, { slug: string | null; glyph: NovelAnalysis; fiction: boolean }>();
      if (wantKeys.length > 0) {
        const { data: analysisRows } = await supabase
          .from("novel_analyses")
          .select("cache_key, slug, analysis")
          .in("cache_key", wantKeys);
        if (cancelled) return;
        for (const row of analysisRows ?? []) {
          const parsed = normalizeAnalysis(row.analysis as Record<string, unknown>);
          const fiction = isFiction(parsed);
          byKey.set(row.cache_key, {
            slug: row.slug ?? null,
            fiction,
            glyph: glyphSource(
              parsed.title ?? "",
              fiction ? "fiction" : "nonfiction",
              parsed.dna?.axes?.map((a) => ({ id: a.id, score: a.score })),
            ),
          });
        }
      }
      if (cancelled) return;
      if (reading) {
        const hit = reading.cache_key ? byKey.get(reading.cache_key) : undefined;
        setContinueBook({
          title: reading.title,
          author: reading.author,
          startedAt: reading.started_at,
          slug: hit?.slug ?? null,
          glyph: hit ? glyphSource(reading.title, hit.fiction ? "fiction" : "nonfiction", hit.glyph.dna?.axes) : null,
        });
      }
      const seen = new Set<string>();
      const books: LibraryBook[] = [];
      for (const r of finishedRows) {
        const k = `${r.cache_key}|${r.title}`;
        if (seen.has(k)) continue;
        seen.add(k);
        const hit = r.cache_key ? byKey.get(r.cache_key) : undefined;
        books.push({
          cacheKey: r.cache_key,
          slug: hit?.slug ?? null,
          title: r.title,
          author: r.author,
          rating: typeof r.rating === "number" ? r.rating : null,
          fiction: hit?.fiction ?? false,
          glyph: hit ? glyphSource(r.title, hit.fiction ? "fiction" : "nonfiction", hit.glyph.dna?.axes) : null,
        });
        if (books.length >= 24) break;
      }
      setLibraryProfile({ finishedThisYear, books });

      setNotesWaiting((takeawayRows ?? []).map((r) => ({ title: r.title, author: r.author })));

      // "Recommended for You": only ever reads an already-cached consensus
      // recommendation for the last book the reader personally tuned the
      // DNA of — never triggers a fresh Gemini call from the home page.
      // If nothing's cached yet, the card just doesn't render.
      const topOverride = (overrideRows ?? [])[0];
      if (topOverride?.cache_key) {
        const { data: consensus } = await supabase
          .from("book_dna_consensus")
          .select("recommendation")
          .eq("cache_key", topOverride.cache_key)
          .maybeSingle();
        if (cancelled) return;
        const rec = consensus?.recommendation as { title?: string; author?: string; why?: string; hidden?: boolean } | null;
        if (rec?.title && !rec.hidden) {
          setHomeRecommendation({ title: rec.title, author: rec.author ?? "", why: rec.why ?? "" });
        }
      }
    })().catch(() => {
      // Non-fatal — the dashboard just falls back to empty states.
    });
    return () => { cancelled = true; };
  }, [user]);

  const openBookInline = (b: { title: string; author?: string; slug?: string | null }) => {
    // A book with its own page opens there (stable URL, shareable); anything
    // else goes through the analyser as before.
    if (b.slug) {
      navigate(`/book/${b.slug}`);
      return;
    }
    const hint = b.author && b.author !== "Unknown" ? `${b.title} by ${b.author}` : b.title;
    setTitle(b.title);
    setActiveRefinement(null);
    fetchAnalysis(hint);
  };

  // Persistent (non-toast) record of the most recent failure. Toasts alone
  // are easy to miss — they auto-dismiss in a few seconds and there's no
  // scroll-into-view guarantee they were ever on screen. This stays put
  // until the user retries, types something new, or dismisses it, and
  // carries a one-click retry so a transient upstream failure (e.g. Gemini
  // overload) doesn't force the user to retype the title from scratch.
  const [lastError, setLastError] = useState<string | null>(null);
  // Anchors the "Reading the Book" loading panel so we can scroll it into
  // view the moment a search starts — otherwise it renders below the
  // reading-list grid and a user who doesn't scroll only ever sees the
  // small spinner glyph inside the Visualize button.
  const loadingPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!loading) return;
    const id = window.requestAnimationFrame(() => {
      // A book opened from a link elsewhere on the page ("Map this book" in
      // "If you loved this shape", deep links) starts loading while the
      // reader is scrolled far down; "nearest" left the panel peeking at the
      // bottom edge on phones, so it looked like nothing happened. Centre it.
      loadingPanelRef.current?.scrollIntoView({ behavior: "smooth", block: deepLinkPending.current ? "center" : "nearest" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [loading]);

  const fetchAnalysis = async (bookTitle: string, refinement?: string, opts?: { reanalyze?: boolean }) => {
    const isReanalyze = !!opts?.reanalyze;
    const isRefine = !!refinement && !isReanalyze;
    if (isRefine || isReanalyze) setRefining(true);
    else setLoading(true);
    setLastError(null);
    setStatusText("");
    setPreambleText("");
    setAnalysisPreview(null);
    setCachedHit(false);
    if (!isRefine) { setCacheKey(null); setSlug(null); }

    // Mirror the requested book into the URL (?book=…). If anything forces a
    // reload mid-analysis — above all the stale-chunk recovery after a deploy,
    // which used to swallow the reader's first click — the deep-link effect
    // below picks the same book straight back up instead of dropping them on
    // an empty home page. Also makes refresh and Back behave.
    if (!isRefine && !isReanalyze) {
      lastRequestedBookRef.current = bookTitle;
      if (new URLSearchParams(window.location.search).get("book") !== bookTitle) {
        navigate({ pathname: "/", search: `?book=${encodeURIComponent(bookTitle)}` }, { replace: true });
      }
    }

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-novel`;
    // Refinement is checked against the reader's membership server-side, so it
    // has to carry their own access token rather than the publishable key.
    const refineToken = isRefine ? (await supabase.auth.getSession()).data.session?.access_token : undefined;

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
    // Thrown when ANALYSIS_IDLE_TIMEOUT_MS fires — see its definition above.
    // Deliberately its own class rather than reusing TransientStreamError:
    // it's detected by AbortError identity below (both the initial fetch()
    // and reader.read() reject with one when ctrl.abort() fires), not by a
    // response status, so it needs its own catch branch.
    class IdleTimeoutError extends Error {}

    async function attemptOnce(): Promise<NovelAnalysis> {
      const ctrl = new AbortController();
      let idleTimer: ReturnType<typeof setTimeout> | undefined;
      const armIdleTimer = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => ctrl.abort(), ANALYSIS_IDLE_TIMEOUT_MS);
      };

      let resp: Response;
      armIdleTimer();
      try {
        resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${refineToken ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            title: bookTitle,
            refinement: isRefine ? refinement : undefined,
            previousAnalysis: isRefine ? analysis : undefined,
            reanalyze: isReanalyze || undefined,
            ...(geminiKey ? { gemini_key: geminiKey } : {}),
          }),
          signal: ctrl.signal,
        });
      } catch (e) {
        clearTimeout(idleTimer);
        if (e instanceof DOMException && e.name === "AbortError") {
          throw new IdleTimeoutError("The connection stalled before the server responded.");
        }
        throw e;
      }

      if (!resp.ok || !resp.body) {
        clearTimeout(idleTimer);
        let msg = "Something went wrong";
        let code: string | undefined;
        try {
          const j = await resp.json();
          msg = j?.error ?? msg;
          code = j?.code;
        } catch { /* ignore */ }
        if (code === "membership_required") {
          membership.openMembership("refine");
          throw new Error(msg);
        }
        if (resp.status === 429) msg = "Rate limit reached. Please try again in a moment.";
        if (resp.status === 402) msg = user
          ? "This book isn't cached yet and no server API key is configured. Add your Gemini key via the key button above."
          : "This book isn't in our library yet. Sign in and add a Gemini API key to analyze it, or try one of the suggested titles.";
        if (isTransientStatus(resp.status)) {
          throw new TransientStreamError("The backend is warming up. Please retry in a few seconds.");
        }
        throw new Error(msg);
      }

      // Headers arrived — reset the idle window for the streaming phase below.
      armIdleTimer();

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
          if (!isRefine && !isReanalyze) track("analysis_viewed", { cached: !!data?.cached });
          if (data?.cacheKey) setCacheKey(data.cacheKey);
          if (data?.slug) setSlug(data.slug);
          setAnalysisPreview(null); // full analysis supersedes preview
        } else if (event === "error") {
          errorMsg = data?.error ?? "Something went wrong";
          errorStatus = typeof data?.status === "number" ? data.status : undefined;
        }
      };

      // Parse SSE: events delimited by blank line, fields are "event: x" / "data: y"
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          armIdleTimer(); // got a chunk — connection is alive, reset the idle window
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
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          throw new IdleTimeoutError("The connection stalled while the server was responding.");
        }
        throw e;
      } finally {
        clearTimeout(idleTimer);
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
          // IdleTimeoutError (ANALYSIS_IDLE_TIMEOUT_MS fired — see its definition
          // near the top of this file) is retried same as a transient 5xx: a fresh
          // request is a fresh shot at a healthy connection. Note TypeError here
          // only ever catches offline/DNS-style fetch()-level failures, NOT an
          // abort — AbortError is a DOMException, not a TypeError, which is why
          // IdleTimeoutError has to be listed explicitly rather than folding into
          // this branch.
          const isTransient = err instanceof TransientStreamError ||
            err instanceof IdleTimeoutError ||
            (err instanceof TypeError); // fetch()-level network failure (offline, DNS)
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
        setView(result.bookType === "nonfiction" ? "ideas" : "network");
      }
      setActiveRefinement(refinement || null);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Something went wrong";
      toast.error(msg);
      // Toast is transient and easy to miss (esp. if the user scrolled away
      // to watch the loading panel below). Keep a persistent, on-page copy
      // with a retry action until the user acts on it.
      if (!isRefine && !isReanalyze) setLastError(msg);
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
    track("search_submitted", { length: title.trim().length });
    setActiveRefinement(null);
    fetchAnalysis(title.trim());
  };

  const handleRetryLastSearch = () => {
    if (!title.trim() || loading) return;
    setActiveRefinement(null);
    fetchAnalysis(title.trim());
  };

  // Deep-link: /?book=Title triggers an analysis on mount and survives refresh.
  // Also handles /og?book=Title redirects coming back from social share links —
  // the /og edge function redirects to /?book=Title so we only need to check
  // the standard ?book= param here.
  //
  // 2026-11-06: this used to run once on mount only. That broke every in-app
  // link to /?book=… rendered while Index was already mounted — notably the
  // DNA panel's "Map this book" CTA under an analysis opened from search:
  // React Router updated the URL, Index stayed mounted, nothing happened.
  // It now reacts to every ?book= change and skips the ones fetchAnalysis
  // wrote itself (lastRequestedBookRef).
  const deepLinkPending = useRef<string | null>(null);
  useEffect(() => {
    const book = new URLSearchParams(location.search).get("book");
    if (!book || book === lastRequestedBookRef.current) return;
    deepLinkPending.current = book;
    // Don't let the title change pop the autocomplete open over the analysis.
    if (book !== title) suppressNextFetchRef.current = true;
    setTitle(book);
    setSuggestOpen(false);
    fetchAnalysis(book);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

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
    if (refineLocked) {
      membership.openMembership("refine");
      return;
    }
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

  const searchForm = (
    <>
              
              <form onSubmit={handleSubmit} className="w-full" autoComplete="off">
                <div className="meta mb-2 flex items-center justify-between text-muted-foreground">
                  <span>{user ? "Look up another title" : "A title"}</span>
                  <span className="hidden md:inline">Press <kbd className="border border-foreground bg-card px-1.5 py-0.5 text-foreground">↵</kbd> to map</span>
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
                      onChange={(e) => {
                        setTitle(e.target.value);
                        // Clear a stale error banner as soon as the user starts
                        // editing — it referred to the previous title, not this one.
                        if (lastError) setLastError(null);
                      }}
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
                      className="meta flex items-center gap-2 whitespace-nowrap border-l border-foreground bg-primary px-6 text-primary-foreground transition-colors hover:bg-foreground hover:text-background disabled:opacity-80"
                    >
                      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>Map it</>}
                    </MagneticButton>
                  </div>

                  {/* Loading state — local index empty, waiting for network */}
                  {suggestOpen && suggestions.length === 0 && suggestLoading && title.trim().length >= 2 && (
                    <ul
                      className="ink-border absolute left-0 right-0 top-full z-20 mt-[-1px] overflow-y-auto bg-card"
                      style={dropdownMaxHeight ? { maxHeight: dropdownMaxHeight } : undefined}
                    >
                      <li className="meta flex items-center gap-2 px-4 py-3 text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Searching Open Library…
                      </li>
                    </ul>
                  )}

                  {/* No-results state — press Enter to analyze directly */}
                  {suggestOpen && suggestions.length === 0 && !suggestLoading && title.trim().length >= 2 && (
                    <ul
                      className="ink-border absolute left-0 right-0 top-full z-20 mt-[-1px] overflow-y-auto bg-card"
                      style={dropdownMaxHeight ? { maxHeight: dropdownMaxHeight } : undefined}
                    >
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
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-foreground/10"
                        >
                          <span className="font-serif italic flex-1 truncate">{title.trim()}</span>
                          <span className="meta text-muted-foreground shrink-0">→ Analyze directly</span>
                        </button>
                      </li>
                    </ul>
                  )}

                  {suggestOpen && suggestions.length > 0 && (
                    <ul
                      role="listbox"
                      className="ink-border absolute left-0 right-0 top-full z-20 mt-[-1px] max-h-[360px] overflow-y-auto bg-card"
                      style={dropdownMaxHeight ? { maxHeight: dropdownMaxHeight } : undefined}
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
                            onTouchStart={() => {
                              // Mobile has no hover — onMouseEnter never fires before a tap,
                              // so touch users got zero benefit from the prefetch-on-hover
                              // mechanism above. touchstart fires ~100-300ms before the click
                              // that follows a tap, which is enough head start for the backend
                              // cache lookup (or in-flight dedup) to resolve before the user's
                              // finger lifts. Mirrors the onMouseEnter hint logic exactly.
                              setActiveIndex(i);
                              const hint = s.author && s.author !== "Unknown" ? `${s.title} by ${s.author}` : s.title;
                              prefetchAnalysis(hint);
                            }}
                            onClick={() => pickSuggestion(s)}
                            className={cn(
                              "flex w-full items-baseline gap-3 border-b border-foreground/20 px-4 py-3 text-left transition-colors",
                              i === activeIndex
                                ? "bg-foreground text-background"
                                : "hover:bg-foreground/10",
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
                  </>
  );

  return (
    <div className="min-h-screen">

      {/* Slim masthead, the same one the book page uses (Paper & ink). */}
      <header className="border-b border-foreground bg-background">
        <div className="mx-auto flex max-w-[1280px] items-center gap-2 px-4 py-1.5 md:px-8">
          <button
            type="button"
            onClick={() => {
              lastRequestedBookRef.current = null;
              if (location.search) navigate({ pathname: "/", search: "" }, { replace: true });
              setAnalysis(null);
              setAnalysisPreview(null);
              setTitle("");
              setLoading(false);
              setStatusText("");
              setPreambleText("");
              setCachedHit(false);
            }}
            className="flex min-h-[44px] items-center gap-2.5 text-foreground"
          >
            <NovelVizLogo size={28} className="text-foreground" />
            <span className="font-serif text-xl font-medium tracking-[-0.01em]">NovelViz</span>
          </button>
          <nav className="ml-auto flex items-center gap-1">
            {user && (
              <button
                onClick={() => setGeminiDialogOpen(true)}
                className={`flex min-h-[44px] items-center gap-2 px-3 text-sm font-medium hover:underline ${geminiKey ? "text-green-700" : "text-muted-foreground"}`}
                title={geminiKey ? "Gemini key configured" : "Add your Gemini API key"}
              >
                <Key className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{geminiKey ? "Key ✓" : "API key"}</span>
              </button>
            )}
            {user ? (
              <Link to="/shelf" className="flex min-h-[44px] items-center px-3 text-sm font-medium hover:underline">
                Library
              </Link>
            ) : (
              <Link
                to="/auth"
                className="flex min-h-[44px] items-center bg-foreground px-4 text-sm font-medium text-background hover:bg-foreground/90"
              >
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main>
        {!analysis && (
          <section className="mx-auto max-w-[1280px] px-4 py-8 md:px-8 md:py-14">
            {user ? (
              <HomeLibrary
                name={
                  ((user.user_metadata?.full_name ?? user.user_metadata?.name ?? "") as string).trim().split(/\s+/)[0] || null
                }
                search={searchForm}
                continueBook={continueBook}
                shelf={shelfCounts}
                finishedThisYear={libraryProfile ? libraryProfile.finishedThisYear : null}
                notesCount={notesWaiting.length}
                recommendation={homeRecommendation}
                books={libraryProfile?.books ?? []}
                onOpen={openBookInline}
              />
            ) : (
              <div className="flex flex-col gap-16 md:gap-20">
                <div className="flex flex-wrap items-center gap-10 md:gap-14 lg:flex-nowrap">
                  <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-6">
                    <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      A reading companion
                    </span>
                    <h1 className="text-balance font-serif text-[3.5rem] font-normal leading-[0.95] tracking-[-0.03em] md:text-[5.75rem]">
                      See the <em className="italic text-[#19629A]">shape</em> of any book.
                    </h1>
                    <p className="max-w-[34rem] font-serif text-lg leading-[1.5] text-foreground/90 md:text-[1.3125rem]">
                      Type a title. Get its characters, its timeline and its DNA: twelve qualities drawn as one shape you
                      can compare, share and choose your next book by.
                    </p>
                    <div className="max-w-[35rem]">{searchForm}</div>
                    <p className="text-[15px] text-muted-foreground">
                      Try{" "}
                      {seedSuggestions.slice(0, 3).map((s, i) => (
                        <span key={s}>
                          {i > 0 && (i === 2 ? " or " : ", ")}
                          <button
                            type="button"
                            onMouseEnter={() => prefetchAnalysis(s)}
                            onFocus={() => prefetchAnalysis(s)}
                            onTouchStart={() => prefetchAnalysis(s)}
                            onClick={() => {
                              setTitle(s);
                              fetchAnalysis(s);
                            }}
                            disabled={loading}
                            className="text-[#19629A] underline underline-offset-2 hover:text-foreground"
                          >
                            {s}
                          </button>
                        </span>
                      ))}
                    </p>
                  </div>
                  <div className="min-w-0 flex-[1_1_480px]">
                    <GlyphWall />
                  </div>
                </div>

                <div className="grid gap-10 border-t border-foreground pt-10 sm:grid-cols-3">
                  {[
                    ["1", "Map it", "Characters and how they connect, the timeline with spoilers held back, the ideas of a non-fiction book chapter by chapter."],
                    ["2", "See its shape", "Every book gets a DNA glyph. Books that read alike look alike, so the next one is easy to spot."],
                    ["3", "Keep it", "Save, rate and take notes. Your library grows a shape of its own: a portrait of how you read."],
                  ].map(([n, h, body]) => (
                    <div key={n} className="flex flex-col gap-2.5">
                      <span className="font-serif text-[2.75rem] leading-none text-[#9A6410]" aria-hidden="true">{n}</span>
                      <h2 className="font-serif text-[1.75rem] font-normal leading-tight">{h}</h2>
                      <p className="text-base leading-[1.55] text-foreground/85">{body}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

              {loading && (
                <div ref={loadingPanelRef} className="mt-10 ink-border bg-card">
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

              {/* Persistent error state — the toast alone auto-dismisses in a
                  few seconds and there's no guarantee the user was looking at
                  it (e.g. if they scrolled down to watch the loading panel).
                  This stays until they retry, edit the title, or dismiss it,
                  and it's rendered right under the search form so it's visible
                  without scrolling. */}
              {!loading && lastError && (
                <div className="mt-10 ink-border border-destructive/50 bg-destructive/5">
                  <div className="flex items-start justify-between gap-4 px-4 py-3">
                    <div>
                      <div className="meta text-destructive">Analysis failed</div>
                      <p className="mt-1 max-w-xl font-serif text-base leading-snug text-foreground">
                        {lastError}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={handleRetryLastSearch}
                        className="meta flex items-center gap-2 border border-foreground px-3 py-1.5 transition-colors hover:bg-foreground/10"
                      >
                        <RefreshCw className="h-3 w-3" /> Try again
                      </button>
                      <button
                        type="button"
                        onClick={() => setLastError(null)}
                        aria-label="Dismiss"
                        className="meta px-2 py-1.5 text-muted-foreground hover:text-foreground"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              )}
          </section>
        )}

        {/* Preview masthead — shown ~1s after search while full analysis loads */}
        {!analysis && loading && analysisPreview && (
          <div>
            <section className="grid grid-cols-12 gap-0 ink-border-b">
              <div className="col-span-12 border-foreground px-4 py-6 md:col-span-2 md:border-r md:py-8">
                <div className="flex items-start gap-4 md:flex-col md:gap-0">
                  <CoverPlate
                    coverUrl={coverUrl}
                    title={analysisPreview.title}
                    author={analysisPreview.author}
                    className="w-14 md:mb-4 md:w-full md:max-w-[108px]"
                  />
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
            <BookHero
              analysis={analysis}
              cacheKey={cacheKey}
              coverUrl={coverUrl}
              slug={slug ?? undefined}
              extraActions={
                activeRefinement ? (
                  <div className="meta inline-flex items-center gap-2 border border-foreground bg-foreground px-3 py-1.5 text-background">
                    <RefreshCw className="h-3 w-3" /> Refined · "{activeRefinement}"
                  </div>
                ) : null
              }
            />
            <DnaTraits analysis={analysis} />

            {/* ===================== DNA — no longer a tab =====================
                See the matching note in BookPage.tsx (2026-09-07): DNA is the
                book's identity, not one view among four, so it runs full width
                under the header instead of competing for a tab slot. */}
            {analysis.dna?.axes?.length ? (
              <section id="dna-anchor" className="scroll-mt-4 border-b border-foreground">
                <Suspense fallback={<TabFallback />}>
                  <BookDNA analysis={analysis} cacheKey={cacheKey} />
                </Suspense>
              </section>
            ) : null}

            {/* ===================== SPOILER STRIP — fiction only ===================== */}
            {isFiction(analysis) && <section className="ink-border-b grid grid-cols-12 items-stretch">
              <div className="col-span-12 flex items-center gap-3 border-foreground px-4 py-3 md:col-span-3 md:border-r">
                <button
                  onClick={() => setShowSpoilers((s) => !s)}
                  className={cn(
                    "meta inline-flex items-center gap-2 border border-foreground px-3 py-2 transition-colors",
                    showSpoilers
                      ? "bg-card hover:bg-foreground/10"
                      : "bg-primary text-primary-foreground",
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
                        ? "bg-primary text-primary-foreground"
                        : "bg-card hover:bg-foreground/10",
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
                  (["network", "timeline", "takeaways"] as const).map((v, i) => (
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
                      {v === "network"
                        ? "01 · Network"
                        : v === "timeline"
                          ? "02 · Timeline"
                          : "03 · Takeaways"}
                    </button>
                  ))
                ) : (
                  (["ideas", "chapters", "takeaways"] as const).map((v, i) => (
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
                          : "03 · Takeaways"}
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
              {/* Previously an uncaught render error in ANY tab below silently
                  blanked the entire analysis view (React's default behavior
                  with no error boundary anywhere in the app) — found this via
                  an intermittent crash clicking into Takeaways. Keying on
                  `view` means switching tabs remounts the boundary, so picking
                  a different tab also naturally clears a stuck error state. */}
              <ErrorBoundary key={view}>
                {/* ── Fiction views ── */}
                {view === "timeline" && isFiction(analysis) && (
                  <Suspense fallback={<TabFallback />}>
                    <TimelineView
                      analysis={analysis as FictionAnalysis}
                      progress={effectiveProgress}
                      selectedEventId={selectedEventId}
                      onSelectEvent={handleSelectEvent}
                      selectedCharacterId={selectedCharacterId}
                      onSelectCharacter={setSelectedCharacterId}
                    />
                  </Suspense>
                )}
                {view === "network" && isFiction(analysis) && (
                  <Suspense fallback={<TabFallback />}>
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
                  </Suspense>
                )}
                {/* ── Non-fiction views ── */}
                {view === "ideas" && isNonFiction(analysis) && (
                  <Suspense fallback={<TabFallback />}>
                    <IdeasTab
                      analysis={analysis as NonFictionAnalysis}
                      cacheKey={cacheKey}
                      onReanalyze={() => fetchAnalysis(analysis.title, undefined, { reanalyze: true })}
                    />
                  </Suspense>
                )}
                {view === "concepts" && isNonFiction(analysis) && (
                  <Suspense fallback={<TabFallback />}>
                    <ConceptMap analysis={analysis as NonFictionAnalysis} />
                  </Suspense>
                )}
                {view === "chapters" && isNonFiction(analysis) && (
                  <Suspense fallback={<TabFallback />}>
                    <ChapterBreakdown analysis={analysis as NonFictionAnalysis} />
                  </Suspense>
                )}
                {/* ── Shared views ── */}
                {view === "takeaways" && (
                  <Suspense fallback={<TabFallback />}>
                    <TakeawaysTab analysis={analysis} cacheKey={cacheKey} />
                  </Suspense>
                )}
              </ErrorBoundary>
            </section>

            {isFiction(analysis) && view !== "takeaways" && (
              <section className="ink-border-b px-4 py-6 md:px-8">
                <RefinementPrompts onPick={handleRefine} disabled={refining} locked={refineLocked} />
              </section>
            )}

            {/* ===================== READING NOTES ===================== */}
            <ReaderNotes cacheKey={cacheKey} bookTitle={analysis.title} bookAuthor={analysis.author} />

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
