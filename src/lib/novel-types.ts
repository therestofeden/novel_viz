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

export interface NovelAnalysis {
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
