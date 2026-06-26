export type CharacterRole =
  | "protagonist"
  | "deuteragonist"
  | "antagonist"
  | "supporting"
  | "minor"
  | "narrator";

export type RelationshipType =
  | "family"
  | "romantic"
  | "friend"
  | "rival"
  | "mentor"
  | "professional"
  | "antagonistic"
  | "acquaintance";

export type Confidence = "high" | "medium" | "low";

export interface Lane {
  id: string;
  name: string;
  description: string;
}

export interface Character {
  id: string;
  name: string;
  role: CharacterRole;
  laneId: string;
  description: string;
  /** First narrative position (0-100) where this character appears. Used for spoiler masking. */
  introducedAt?: number;
  confidence?: Confidence;
}

export interface Relationship {
  fromId: string;
  toId: string;
  type: RelationshipType;
  description: string;
  /** Strength 1-5, used for edge weighting in the force layout. */
  strength?: number;
}

export interface PlotEvent {
  id: string;
  laneId: string;
  position: number; // 0-100
  title: string;
  description: string;
  characterIds: string[];
  /** Display string like "Ch. 12" or "Part II, §3". Optional. */
  chapterRef?: string;
  confidence?: Confidence;
}

export const DNA_AXIS_IDS = [
  "interiority",
  "plot_density",
  "time_linearity",
  "scale",
  "realism",
  "tonal_register",
  "prose_density",
  "moral_ambiguity",
  "character_vs_plot",
  "political_charge",
  "formal_experimentation",
  "ending_openness",
] as const;

export type DnaAxisId = (typeof DNA_AXIS_IDS)[number];

export interface DnaAxis {
  id: DnaAxisId;
  score: number; // 0-100
  evidence: string;
}

export interface Dna {
  axes: DnaAxis[];
  signature: string;
}

export interface Recommendation {
  title: string;
  author: string;
  similarity: number; // 0-100
  why: string;
  shared_axes: DnaAxisId[];
  divergent_axes: DnaAxisId[];
}

// ─── Fiction ─────────────────────────────────────────────────────────────────

export interface FictionAnalysis {
  bookType: "fiction";
  title: string;
  author: string;
  confidence: "high" | "medium" | "low" | "unknown_work";
  summary: string;
  lanes: Lane[];
  characters: Character[];
  relationships: Relationship[];
  events: PlotEvent[];
  explanation: string;
  dna?: Dna;
  recommendation?: Recommendation;
}

// ─── Non-fiction ──────────────────────────────────────────────────────────────

export type NfConceptType =
  | "thesis"
  | "framework"
  | "evidence"
  | "example"
  | "conclusion"
  | "principle";

export interface NfConcept {
  id: string;
  name: string;
  description: string;
  /** 0-100: how central this concept is to the book's argument */
  importance: number;
  type: NfConceptType;
}

export type NfRelationshipType =
  | "supports"
  | "contradicts"
  | "expands"
  | "illustrates"
  | "leads_to"
  | "challenges";

export interface NfConceptRelationship {
  fromId: string;
  toId: string;
  type: NfRelationshipType;
  description: string;
}

export type NfChapterType =
  | "introduction"
  | "setup"
  | "evidence"
  | "case_study"
  | "counterargument"
  | "synthesis"
  | "conclusion";

export interface NfChapter {
  id: string;
  number: number;
  title: string;
  /** Normalised position 0–100 in the book */
  position: number;
  summary: string;
  keyConceptIds: string[];
  argumentType: NfChapterType;
}

// ─── Argument architecture (Phase 1 Ideas tab) ───────────────────────────────

export type IdeaCardTag =
  | "core_thesis"
  | "supporting_argument"
  | "evidence"
  | "implication"
  | "counterpoint";

export interface IdeaCard {
  id: string;
  /** Full sentence claim — not a topic name */
  claim: string;
  /** 1-2 sentences of evidence or illustrative example */
  evidence: string;
  tag: IdeaCardTag;
  /** Which pillar this card belongs to (optional) */
  pillarId?: string;
}

export interface ArgumentPillar {
  id: string;
  /** The pillar argument stated as a full claim */
  claim: string;
  /** Key evidence or experiment supporting this pillar */
  evidence: string;
  /** Practical implication — so what? */
  implication: string;
  /** IDs of idea cards that belong to this pillar */
  ideaIds: string[];
}

export interface NonFictionAnalysis {
  bookType: "nonfiction";
  title: string;
  author: string;
  confidence: "high" | "medium" | "low" | "unknown_work";
  summary: string;
  /** The central claim or argument of the book in one sentence */
  thesis: string;
  /** Structured argument architecture — 3-5 pillars supporting the thesis */
  argumentPillars?: ArgumentPillar[];
  /** Up to 10 key ideas stated as full claims, not topic names */
  ideaCards?: IdeaCard[];
  concepts: NfConcept[];
  conceptRelationships: NfConceptRelationship[];
  chapters: NfChapter[];
  explanation: string;
  dna?: Dna;
  recommendation?: Recommendation;
}

// ─── Non-fiction DNA ──────────────────────────────────────────────────────────

export const NF_DNA_AXIS_IDS = [
  "accessibility",
  "idea_density",
  "structure",
  "scope",
  "evidence_rigor",
  "tone",
  "prose_density",
  "certainty",
  "theory_vs_case",
  "political_charge",
  "structural_innovation",
  "actionability",
] as const;

export type NfDnaAxisId = (typeof NF_DNA_AXIS_IDS)[number];

export const NF_DNA_AXIS_META: Record<
  NfDnaAxisId,
  { name: string; low: string; high: string; description: string }
> = {
  accessibility: {
    name: "Accessibility",
    low: "Dense / academic",
    high: "Breezy / popular",
    description: "How much prior knowledge the reader needs. Kahneman demands patience; Gladwell assumes none.",
  },
  idea_density: {
    name: "Idea density",
    low: "Slow and discursive",
    high: "Dense argument per page",
    description: "How many new ideas or arguments appear per chapter. Some books breathe; others hammer.",
  },
  structure: {
    name: "Structure",
    low: "Essayistic / fragmented",
    high: "Linear argument",
    description: "Whether the book builds a single cumulative argument or meanders through related essays.",
  },
  scope: {
    name: "Scope",
    low: "Narrow case study",
    high: "Grand unified theory",
    description: "How ambitiously the book generalises — from a single company to all of human civilisation.",
  },
  evidence_rigor: {
    name: "Evidence rigor",
    low: "Anecdotal",
    high: "Rigorous empirical",
    description: "Whether the book leans on stories and intuition or controlled experiments and data.",
  },
  tone: {
    name: "Tone",
    low: "Detached / clinical",
    high: "Personal / passionate",
    description: "How much the author's voice and conviction show through the prose.",
  },
  prose_density: {
    name: "Prose density",
    low: "Spare / plain",
    high: "Rich / baroque",
    description: "Sentence-level richness — Strunk & White at one end, Montaigne at the other.",
  },
  certainty: {
    name: "Certainty",
    low: "Heavily hedged",
    high: "Assertive / prescriptive",
    description: "How confidently the author states conclusions. Taleb hedges everything; Covey tells you what to do.",
  },
  theory_vs_case: {
    name: "Theory vs. case",
    low: "Pure theory",
    high: "Case-study driven",
    description: "Whether the argument rests on abstract frameworks or concrete real-world examples.",
  },
  political_charge: {
    name: "Political charge",
    low: "Apolitical",
    high: "Explicitly political",
    description: "How directly the book engages with power, ideology, or social critique.",
  },
  structural_innovation: {
    name: "Structural innovation",
    low: "Conventional non-fiction",
    high: "Experimental form",
    description: "Whether the book respects or reinvents the conventions of the non-fiction essay.",
  },
  actionability: {
    name: "Actionability",
    low: "Open questions",
    high: "Clear prescriptions",
    description: "Whether the book leaves you with frameworks to act on, or a richer sense of the problem.",
  },
};

// ─── Union ────────────────────────────────────────────────────────────────────

/** Discriminated union covering both book types. */
export type NovelAnalysis = FictionAnalysis | NonFictionAnalysis;

/** Type guards */
export function isFiction(a: NovelAnalysis): a is FictionAnalysis {
  return a.bookType === "fiction";
}
export function isNonFiction(a: NovelAnalysis): a is NonFictionAnalysis {
  return a.bookType === "nonfiction";
}

/**
 * Normalise a raw analysis payload from the API or cache.
 * Legacy cached rows have no bookType — default them to fiction.
 */
export function normalizeAnalysis(raw: Record<string, unknown>): NovelAnalysis {
  if (raw.bookType === "nonfiction") return raw as unknown as NonFictionAnalysis;
  return { bookType: "fiction", ...raw } as unknown as FictionAnalysis;
}

// ─── Takeaways ────────────────────────────────────────────────────────────────

export interface TakeawayQuestion {
  id: string;
  question: string;
}

export interface TakeawayAnswer {
  questionId: string;
  answer: string;
}

export interface TakeawaySession {
  questions: TakeawayQuestion[];
  answers: TakeawayAnswer[];
  freeNotes: string;
  takeaways: string;
  status: "draft" | "complete";
}

/**
 * Editorial labels for each DNA axis. Each axis is a continuum from low (0) to high (100).
 * `low` and `high` are the visible pole labels; `name` is the axis title.
 */
export const DNA_AXIS_META: Record<
  DnaAxisId,
  { name: string; low: string; high: string; description: string }
> = {
  interiority: {
    name: "Interiority",
    low: "External action",
    high: "Stream of consciousness",
    description: "How much of the novel happens inside characters' heads vs. in the visible world.",
  },
  plot_density: {
    name: "Plot density",
    low: "Quiet, little happens",
    high: "Constant incident",
    description: "How packed the surface narrative is with events per page.",
  },
  time_linearity: {
    name: "Time linearity",
    low: "Fragmented",
    high: "Strictly chronological",
    description: "Whether time moves straight forward or splinters across the book.",
  },
  scale: {
    name: "Scale",
    low: "Single room / single day",
    high: "Generations / continents",
    description: "The geographic and temporal sweep of the world depicted.",
  },
  realism: {
    name: "Realism",
    low: "Surreal / fantastic",
    high: "Strict realism",
    description: "How tightly the book obeys the rules of the actual world.",
  },
  tonal_register: {
    name: "Tonal register",
    low: "Bleak / tragic",
    high: "Comic / joyful",
    description: "The emotional weather of the prose.",
  },
  prose_density: {
    name: "Prose density",
    low: "Sparse / plain",
    high: "Baroque / maximalist",
    description: "Sentence-level richness — Hemingway at one end, Nabokov at the other.",
  },
  moral_ambiguity: {
    name: "Moral ambiguity",
    low: "Clear good vs. evil",
    high: "No moral compass",
    description: "How comfortable the book is letting the reader judge.",
  },
  character_vs_plot: {
    name: "Character vs. plot",
    low: "Plot machine",
    high: "Pure character study",
    description: "Whether the engine is what people do, or who they are.",
  },
  political_charge: {
    name: "Political charge",
    low: "Apolitical",
    high: "Explicitly political",
    description: "How loudly the book argues with the world it was written into.",
  },
  formal_experimentation: {
    name: "Formal experimentation",
    low: "Conventional form",
    high: "Radical innovation",
    description: "Whether the novel respects or rewrites the shape of a novel.",
  },
  ending_openness: {
    name: "Ending openness",
    low: "Fully resolved",
    high: "Radically open",
    description: "How much the book hands you when it ends.",
  },
};

export const LANE_COLOR_VARS = [
  "--lane-1",
  "--lane-2",
  "--lane-3",
  "--lane-4",
  "--lane-5",
  "--lane-6",
  "--lane-7",
  "--lane-8",
  "--lane-9",
  "--lane-10",
  "--lane-11",
  "--lane-12",
] as const;

export function laneColor(index: number): string {
  return `hsl(var(${LANE_COLOR_VARS[index % LANE_COLOR_VARS.length]}))`;
}

/** Default relationship strength when AI doesn't supply one. */
export const REL_DEFAULT_STRENGTH: Record<RelationshipType, number> = {
  family: 5,
  romantic: 5,
  rival: 4,
  antagonistic: 4,
  friend: 3,
  mentor: 3,
  professional: 2,
  acquaintance: 1,
};

export const ROLE_WEIGHT: Record<CharacterRole, number> = {
  protagonist: 5,
  narrator: 4,
  deuteragonist: 4,
  antagonist: 4,
  supporting: 2,
  minor: 1,
};
