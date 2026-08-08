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
 * - Per-book merit decides inclusion, not a fixed slot count per author
 *   (Stefano's explicit direction, 2026-07-19 — see the dated note below;
 *   supersedes the original "one entry per author, named exceptions only"
 *   framing this bullet used to state). Multi-entry authors so far:
 *   Tolstoy, Dostoevsky, Kafka, Woolf, Nabokov (Pale Fire admitted
 *   2026-07-14 over the Librarian's one-slot objection; Monte Cristo
 *   challenged the same day and held out), and Shakespeare (King Lear
 *   added 2026-07-19 alongside Hamlet).
 *
 * 2026-07-19 (first amendment since creation): three titles promoted in
 * from classic.ts, each independently vetted against the "unmissable" bar
 * rather than added by default — they'd been flagged, not auto-promoted,
 * across three separate daily curation passes (Oedipus Rex on 07-15, The
 * Muqaddimah on 07-17, A Doll's House on 07-18), specifically so Stefano
 * could make the S-tier call himself rather than have the recurring task
 * make it for him. He reviewed all three together and promoted all of
 * them. Oedipus Rex (Sophocles) — the founding template for tragedy, and
 * the direct source of Freud's "Oedipus complex"; an odd gap to leave open
 * given Poetics, already on this list, uses this exact play as its worked
 * example of ideal tragic structure. The Muqaddimah (Ibn Khaldun) —
 * resolves an inconsistency flagged on 07-17: it's at least as foundational
 * within its own discipline as Democracy in America is within political
 * science, arguably more so (Ibn Khaldun originates the field six centuries
 * before anyone attempts it again; Tocqueville extends one that already
 * exists). A Doll's House (Ibsen) — the founding text of modern drama, and
 * more Lindy-proven by pure age than two works already here (The Second
 * Sex, The Selfish Gene); this list had exactly one play (Hamlet) before
 * this addition.
 *
 * Same session: Stefano explicitly rejected a fixed per-author slot count.
 * His direction — decide per book, on that book's own merit, regardless of
 * whether its author already has a slot. Applied immediately: added King
 * Lear (Shakespeare) alongside Hamlet, not because Shakespeare "deserves
 * two" as a rule, but because Lear clears the bar on its own (many critics
 * rank it above Hamlet; distinct territory — power, age, family, nature —
 * rather than a repeat of Hamlet's interiority). The named-exception list
 * above is now a historical record of past calls, not a gate on future
 * ones: every future addition to either list should be judged the same
 * way, on whether that specific book clears the bar, independent of who
 * else from the same pen is already present.
 *
 * Must Read: 67 → 71 (55 fiction + 16 non-fiction). This is above the
 * ~65-title target stated above — worth knowing the number moved, not just
 * the mechanism. Scarcity is still the goal; this was a one-time backlog
 * clearance across three flagged titles plus one explicitly-requested
 * addition, not a new steady-state pace for this list.
 *
 * 2026-07-26 (Stefano's direct instruction, live turn, non-negotiable):
 * demoted two titles to classic.ts — The Remains of the Day (Ishiguro) and
 * The Selfish Gene (Dawkins). No reasoning requested or recorded beyond
 * the instruction itself, though the Selfish Gene demotion holds up under
 * the Librarian's own rubric: it popularizes one contested side of a live
 * evolutionary-biology fight (gene-centric vs. multi-level/group selection
 * — Gould, David Sloan Wilson, and others have argued this for decades),
 * closer kin to "dilutes a live debate into a settled-sounding paradigm"
 * than to a simple age problem. Must Read: 71 → 69 (54 fiction + 15
 * non-fiction).
 *
 * 2026-07-26 (same day, second live turn — Stefano flagged Must Read's
 * philosophy coverage as thin, specifically zero German-tradition
 * representation despite Kant/Hegel/Nietzsche/Marx/Heidegger/Wittgenstein
 * all sitting in classic.ts). Promoted three, per Stefano's explicit sign-
 * off, each independently argued first: Critique of Pure Reason (Kant) —
 * the hinge point of modern philosophy, everything after is a response to
 * it, effectively undebatable as "unmissable." The Communist Manifesto
 * (Marx) — judged on a different axis than the rest of this list (world-
 * historical impact rather than argumentative rigor: it shaped roughly half
 * of twentieth-century politics), a legitimate but distinct kind of
 * unmissable, flagged as such rather than pretending it's a clean fit.
 * On the Genealogy of Morals (Nietzsche) — kept over the more culturally
 * iconic Thus Spoke Zarathustra since Genealogy is the tighter, more
 * defensible argument; Zarathustra remains a candidate if Stefano later
 * wants the more literary entry point instead. Hegel's Phenomenology of
 * Spirit and Heidegger's Being and Time were explicitly NOT promoted this
 * round and Stefano did not ask for them — held at Classic on the same
 * "still debated" standard just applied to Selfish Gene: Hegel's clarity/
 * rigor has been seriously disputed within philosophy itself (Schopenhauer
 * called him a charlatan; analytic philosophy dismissed him for the better
 * part of a century), and Heidegger carries live, unresolved controversy
 * over his NSDAP membership and the Black Notebooks, not just intellectual
 * debate. Wittgenstein's Philosophical Investigations was also recommended
 * but Stefano's list of confirmations didn't include it — left at Classic
 * pending his explicit call, not silently assumed.
 *
 * Also added, per Stefano's explicit request: Gödel, Escher, Bach
 * (Hofstadter) — promoted from classic.ts; The Black Swan (Taleb) — new
 * addition, not previously on either list, added directly to Must Read
 * rather than routed through Classic first since Stefano named it
 * specifically as a Must Read call, not a "consider for Classic" one;
 * Antifragile (Taleb) was discussed and NOT added — held back on the
 * Librarian's recommendation (14 years old, thinner Lindy case, real
 * methodological critique from economists/statisticians about rigor vs.
 * aphorism) in favor of the stronger-attested Black Swan, and Stefano's
 * confirmation named Black Swan specifically, not Antifragile.
 *
 * Must Read: 69 → 74 (54 fiction + 20 non-fiction).
 *
 * 2026-07-26 (same day, third live turn — Stefano confirmed the full
 * audit in one pass: "ok the classics; ok the new candidates for must
 * read and even ok the debatable"). Cleared the entire six-title fiction
 * backlog that daily curation runs had flagged-but-never-resolved since
 * 2026-07-20 (see [[novelviz-daily-canon-curation]] for each one's original
 * reasoning): The Bridge on the Drina (Andrić), Night (Wiesel), Leaves of
 * Grass (Whitman), Alice's Adventures in Wonderland (Carroll), The Diary
 * of a Young Girl (Anne Frank), Noli Me Tángere (Rizal). Added three new
 * "strong" candidates from this session's own audit: The Iliad (Homer) —
 * its own companion-epic The Odyssey has been Must Read since the list's
 * creation; the old justification for holding Iliad back was a 2026-07-15
 * calibration anchor ("even the Iliad sits in Classic") that's been stale
 * since Oedipus Rex/A Doll's House/the Muqaddimah/King Lear were all
 * promoted past it. Discourse on Method (Descartes) — under a hundred
 * pages, the actual starting gun of modern philosophy, natural companion
 * to the Kant promoted earlier today. The Wealth of Nations (Adam Smith) —
 * founding text of economics as a discipline, the same tier Origin of
 * Species already holds for biology. Also added two "debatable" picks
 * Stefano explicitly signed off on despite the Librarian's own hedging
 * (leaning "importance outweighs sit-down-and-read-it," the same caution
 * applied to Elements/Principia/Summa Theologica/Sima Qian at Classic):
 * Paradise Lost (Milton) and The Histories (Herodotus). Freud's The
 * Interpretation of Dreams was explicitly discussed and NOT promoted —
 * Stefano agreed with the flag-against: hugely culturally influential, but
 * the underlying science is broadly regarded as unfalsifiable/discredited
 * today, the same "popularizes one contested paradigm as settled" problem
 * as the Selfish Gene demotion earlier the same day. Stays at Classic.
 *
 * Must Read: 74 → 85 (60 fiction + 25 non-fiction; Night and The Diary of
 * a Young Girl are non-fiction testimony, placed beside If This Is a Man,
 * not fiction — corrected after an initial miscount). Far above the
 * ~65-title
 * scarcity target this file's own header states — worth being honest about
 * that rather than letting the number drift unremarked. This was an
 * unusually large single-day batch clearance (11 titles, three separate
 * live-turn confirmations) at Stefano's explicit, repeated direction, not
 * a new steady-state pace; the daily scheduled task should return to its
 * normal single-digit-Classic-only cadence and NOT treat today's volume
 * as license to promote into Must Read on its own initiative going
 * forward — S-tier calls remain Stefano's, per the standing default.
 *
 * 2026-07-29 (live turn — Stefano: "ok promote", four open flags cleared):
 * two carried over from 2026-07-27 — Waiting for Godot (Beckett), the
 * outright #1 in the 1998 Royal National Theatre poll of the century's
 * most significant English-language plays, ranked above its own two
 * Classic-tier batch-mates (Death of a Salesman, A Streetcar Named
 * Desire); Fear and Trembling (Kierkegaard), existentialism's actual
 * founding text, the same "closes a total gap in an already-represented
 * movement" logic that promoted Kant/Marx/Nietzsche on 2026-07-26. Two
 * from the same day's own curation pass — A Theory of Justice (Rawls),
 * argued as belonging beside Kant's Critique of Pure Reason and Democracy
 * in America rather than one tier below; The Logic of Scientific
 * Discovery (Popper), promoted specifically as Kuhn's Structure of
 * Scientific Revolutions' direct dueling counterpart — placed immediately
 * beside it, the same "one half of an argument already here, other half
 * arrives" placement as Freud/Jung and Hegel/Kierkegaard elsewhere on
 * these two lists. Stefano delegated which flags to promote without
 * naming titles ("ok promote"); all four taken together rather than
 * cherry-picked, since each had already been independently argued in its
 * own flag — same read as his 2026-07-19 "you decide" on the first
 * three-flag backlog. No open Must Read promotion flags remain after
 * this. Must Read: 85 → 89 (61 fiction + 28 non-fiction).
 *
 * 2026-07-30 (daily curation pass, scheduled-task fire): this file itself
 * untouched — see classic.ts's own 2026-07-30 note for that day's 3-title
 * Classic addition (The Lord of the Rings, Omeros, The Mythical
 * Man-Month). One new open flag from that round: The Lord of the Rings,
 * as a possible Must Read promotion — its cultural/commercial weight
 * arguably exceeds Foundation's (also Classic), and it's the specific
 * book Foundation's own entry measures itself against. Left for Stefano's
 * own review, same standing default as every prior flag.
 *
 * 2026-08-07 (Stefano's direct instruction, live turn): The Lord of the
 * Rings flag above reviewed and declined — stays at Classic, not promoted.
 * No open Must Read promotion flags remain.
 *
 * 2026-08-08 (daily curation pass, round 41): this file itself untouched
 * — see classic.ts's own 2026-08-08 note for that day's 5-title Classic
 * addition (The Quran, Antigone, Les Fleurs du Mal, Duino Elegies,
 * Dialogue Concerning the Two Chief World Systems). One new open flag
 * from that round: The Quran, as a possible Must Read promotion — its
 * world-historical weight (read today by well over a billion people,
 * standardized into a single canonical text under Caliph Uthman around
 * 650 CE) arguably rivals or exceeds several works already here, though
 * note this isn't a clean call either way since its closest analogues on
 * these two lists (the Bhagavad Gita, the Upanishads) are themselves only
 * Classic, not Must Read. Left for Stefano's own review, same standing
 * default as every prior flag.
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
  { title: "The Iliad", author: "Homer", why: "War's oldest ledger — rage, glory, and mortality rendered in bronze-age hexameter; the Odyssey's twin, and no less foundational.", aka: ["Iliad"] },
  { title: "The Odyssey", author: "Homer", why: "The template for every journey narrative since; three millennia of proof.", aka: ["Odyssey"] },
  { title: "Oedipus Rex", author: "Sophocles", why: "The riddle-solver undone by his own answer — tragedy's founding template, and Freud's, too.", aka: ["Oedipus the King", "Oedipus Tyrannus"] },
  { title: "The Tale of Genji", author: "Murasaki Shikibu", why: "The first great novel, a thousand years old and still psychologically modern." },
  { title: "The Divine Comedy", author: "Dante Alighieri", why: "The complete medieval cosmos in verse; Western literature's load-bearing wall.", aka: ["Divine Comedy"] },
  { title: "Hamlet", author: "William Shakespeare", why: "The invention of modern interiority; every ambivalent hero descends from it." },
  { title: "King Lear", author: "William Shakespeare", why: "A king trades his kingdom for flattery and is left howling in a storm; the bleakest tragedy, and arguably the greatest." },
  { title: "Don Quixote", author: "Miguel de Cervantes", why: "The novel's founding document — and still its funniest critique." },
  { title: "Gulliver's Travels", author: "Jonathan Swift", why: "Satire's high-water mark; misanthropy sharpened to a scientific instrument." },
  { title: "Candide", author: "Voltaire", why: "The Enlightenment laughing at itself; optimism demolished in under 100 pages." },
  { title: "Paradise Lost", author: "John Milton", why: "Satan gets the best lines; the fall of man as the first great antihero epic, and the reason English verse still argues with itself in blank verse." },
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
  { title: "A Doll's House", author: "Henrik Ibsen", why: "A door slams and the modern stage begins; a wife's exit still the loudest sound in theater.", aka: ["A Doll House"] },
  { title: "Waiting for Godot", author: "Samuel Beckett", why: "Two tramps wait by a bare tree for someone who never arrives; absurdist theater's founding text, and the play eight hundred British theater professionals voted the single most significant English-language play of the 20th century — ahead of its own two Must Read batch-mates, Salesman and Streetcar, which stayed at Classic.", aka: ["En attendant Godot"] },
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
  { title: "Pale Fire", author: "Vladimir Nabokov", why: "A poem, a commentary, a madman — the novel rebuilt as a hall of mirrors." },
  { title: "Pedro Páramo", author: "Juan Rulfo", why: "A town of ghosts in 120 pages; the seed of magical realism." },
  { title: "Ficciones", author: "Jorge Luis Borges", why: "Infinite libraries and forking paths; philosophy compressed into short stories.", aka: ["Fictions"] },
  { title: "Things Fall Apart", author: "Chinua Achebe", why: "Colonialism witnessed from the inside; the African novel's cornerstone." },
  { title: "Slaughterhouse-Five", author: "Kurt Vonnegut", why: "Dresden survived by irony; the anti-war novel that refuses heroics." },
  { title: "One Hundred Years of Solitude", author: "Gabriel García Márquez", why: "A century of Latin America as family myth; realism made magical." },
  { title: "Snow Country", author: "Yasunari Kawabata", why: "The haiku aesthetic sustained across a novel; beauty as distance." },
  { title: "Midnight's Children", author: "Salman Rushdie", why: "A nation's birth as autobiography; the postcolonial novel's high point." },
  { title: "Blood Meridian", author: "Cormac McCarthy", why: "Violence given Old Testament grandeur; the dark twin of the Western." },
  { title: "Beloved", author: "Toni Morrison", why: "Slavery's afterlife as a ghost story; American literature's conscience." },
  { title: "Disgrace", author: "J.M. Coetzee", why: "Post-apartheid reckoning in prose like cut glass; unsparing and exact." },
  { title: "Leaves of Grass", author: "Walt Whitman", why: "Twelve poems, self-typeset and self-published, and English verse was never as free again; 'I contain multitudes' as an entire literary program." },
  { title: "Alice's Adventures in Wonderland", author: "Lewis Carroll", why: "A mathematician's dream logic, played completely straight; nonsense-as-method that runs straight through to Joyce and Borges.", aka: ["Alice in Wonderland"] },
  { title: "The Bridge on the Drina", author: "Ivo Andrić", why: "Four centuries pass across one Bosnian bridge — empires change, neighbors coexist, then slaughter each other; the book most credited with explaining the Balkans to themselves.", aka: ["Na Drini Ćuprija"] },
  { title: "Noli Me Tángere", author: "José Rizal", why: "A doctor's satire of corrupt friars and colonial abuse, printed in Berlin in 1887 and cited nine years later as trial evidence against the author himself; the novel Filipino history credits with sparking its revolution.", aka: ["Noli Me Tangere", "Touch Me Not"] },

  // ── Non-fiction ────────────────────────────────────────────────────────
  { title: "Tao Te Ching", author: "Laozi", why: "Two and a half millennia of quiet counter-argument to force and hustle.", aka: ["Dao De Jing"] },
  { title: "The Republic", author: "Plato", why: "Justice, education, the cave; the source code of Western philosophy." },
  { title: "The Histories", author: "Herodotus", why: "The invention of history as inquiry — the 'father of history' asking why, not just what." },
  { title: "Poetics", author: "Aristotle", why: "The first theory of story — still the skeleton under every screenplay." },
  { title: "Meditations", author: "Marcus Aurelius", why: "An emperor's private notes to himself; Stoicism with no audience in mind." },
  { title: "The Muqaddimah", author: "Ibn Khaldun", why: "Dynasties rise on solidarity and fall on comfort — the clearest theory ever written for why civilizations end.", aka: ["Muqaddimah", "Prolegomena"] },
  { title: "Essays", author: "Michel de Montaigne", why: "The invention of the honest first person; doubt as a method.", aka: ["The Complete Essays", "The Essays"] },
  { title: "The Prince", author: "Niccolò Machiavelli", why: "Power described without flattery for the first time." },
  { title: "Discourse on Method", author: "René Descartes", why: "'I think, therefore I am' — modern philosophy's starting gun, in under a hundred pages." },
  { title: "Critique of Pure Reason", author: "Immanuel Kant", why: "The limits of what the mind can know, mapped with exhausting, load-bearing precision; the hinge modern philosophy still turns on." },
  { title: "The Communist Manifesto", author: "Karl Marx", why: "'A spectre is haunting Europe' — the pamphlet, with Engels, that shaped more of the twentieth century than any other single document." },
  { title: "On the Genealogy of Morals", author: "Friedrich Nietzsche", why: "Morality itself put under a genealogist's microscope — where 'good' and 'evil' actually came from, and why that origin should unsettle you." },
  { title: "Fear and Trembling", author: "Søren Kierkegaard", why: "Abraham raises the knife over Isaac at God's command, and Kierkegaard refuses every comfortable reading of the story; the book that gave existentialism its first real subject — a faith no rational system can absorb.", aka: ["Frygt og Bæven"] },
  { title: "A Theory of Justice", author: "John Rawls", why: "The veil of ignorance: design a society's rules before you know which seat in it you'll get. Over two thousand papers written in response and counting — the single work most credited with reviving political philosophy as a live discipline after a mid-century lull, extending Locke and Rousseau's contract tradition into 1971.", aka: ["Theory of Justice"] },
  { title: "The Wealth of Nations", author: "Adam Smith", why: "The invisible hand, self-interest, and the division of labor — economics as a discipline begins here." },
  { title: "On the Origin of Species", author: "Charles Darwin", why: "The most consequential argument ever printed; patient, humble, irreversible.", aka: ["The Origin of Species"] },
  { title: "Democracy in America", author: "Alexis de Tocqueville", why: "Still the sharpest outside eye on the American experiment." },
  { title: "A Room of One's Own", author: "Virginia Woolf", why: "The material conditions of art, stated once and for all; the essay as scalpel." },
  { title: "If This Is a Man", author: "Primo Levi", why: "The clearest testimony from the abyss; a chemist's precision at humanity's floor.", aka: ["Survival in Auschwitz"] },
  { title: "Night", author: "Elie Wiesel", why: "A teenager's own account of Auschwitz, written spare enough to let the facts do all the damage without him saying so; testimony precise enough to help win its author the Nobel Peace Prize.", aka: ["La Nuit"] },
  { title: "The Diary of a Young Girl", author: "Anne Frank", why: "A thirteen-year-old's actual diary from two years in hiding, unfinished by her death at Bergen-Belsen and published unrevised by the father who survived; not a retrospective account but the record as it was being lived.", aka: ["Anne Frank: The Diary of a Young Girl", "The Diary of Anne Frank", "Het Achterhuis"] },
  { title: "Man's Search for Meaning", author: "Viktor E. Frankl", why: "Meaning as survival; every word earned." },
  { title: "The Second Sex", author: "Simone de Beauvoir", why: "\"One is not born a woman\" — the analysis that started the modern argument." },
  { title: "The Structure of Scientific Revolutions", author: "Thomas S. Kuhn", why: "Where 'paradigm shift' came from; how science actually moves." },
  { title: "The Logic of Scientific Discovery", author: "Karl Popper", why: "A theory earns the name 'scientific' not by how much it explains but by what it forbids — falsifiability, not verifiability, as the line between science and everything else. Kuhn's own dueling counterpart, sitting right above it: the two are still argued against each other in every philosophy-of-science syllabus.", aka: ["Logik der Forschung"] },
  { title: "The Fire Next Time", author: "James Baldwin", why: "Prophecy in essay form; the clearest voice in the American race conversation." },
  { title: "Gödel, Escher, Bach", author: "Douglas Hofstadter", why: "Logic, art, and music braided into one long argument about how minds might arise from rules; Pulitzer-crowned, and still the way in for anyone thinking seriously about minds and machines.", aka: ["Godel, Escher, Bach", "Gödel Escher Bach"] },
  { title: "The Black Swan", author: "Nassim Nicholas Taleb", why: "Rare, high-impact, retrospectively-'obvious' events run history far more than the bell curve admits; the book that gave risk and forecasting a name for what they kept getting wrong.", aka: ["The Black Swan: The Impact of the Highly Improbable"] },
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
