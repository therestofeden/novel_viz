import { normalizeForSearch } from "@/lib/utils";
import { isMustRead } from "@/lib/must-read";

/**
 * THE CLASSIC LIST — NovelViz's second-tier editorial canon.
 *
 * Curated 2026-07-14 by "The Librarian" (Lindy-filtered, A-tier): excellent,
 * high-density, unmistakably canonical books — the tier directly below
 * Must Read. Must Read is "unmissable"; Classic is "clearly earns its place
 * in the canon, but not foundational-canon in the way S-tier is." Same
 * Lindy discipline as Must Read (fiction: hard survival test; non-fiction:
 * proven relevance, hype-cycle and replication-crisis casualties screened
 * out the same way — no repeats of the "no Sapiens" logic here either).
 *
 * Mutually exclusive with Must Read by construction: nothing below
 * duplicates a MUST_READ title, and getClassic() double-checks against
 * isMustRead() at lookup time so the two stamps never both fire on one book.
 *
 * Ratio: fiction-heavy, same inversion as Must Read (NovelViz is novel-first).
 * A handful of authors already in Must Read appear once more here where a
 * second work is independently canonical (Austen, Woolf's contemporaries,
 * Steinbeck, Hemingway, Camus, Morrison, McCarthy, Dostoevsky, García
 * Márquez, Ishiguro, Baldwin) — mirrors the precedent Must Read itself set
 * for Tolstoy/Dostoevsky/Kafka/Woolf/Nabokov. Breadth was favored over
 * depth everywhere else: one entry per author by default.
 *
 * 2026-07-15 (daily curation pass): added six titles closing a real gap —
 * the ancient-epic tradition was Greco-Roman-only (Iliad/Metamorphoses/
 * Aeneid) with no Mesopotamian, Old English, Persian, or Indian epic
 * represented. Added Epic of Gilgamesh, Oedipus Rex, Beowulf, The
 * Shahnameh, The Ramayana (fiction) and The Federalist Papers
 * (non-fiction, closing a gap in the political-philosophy cluster
 * alongside Two Treatises/Social Contract/On Liberty/Democracy in
 * America). All six clear the same Lindy bar as the rest of this list;
 * none were close calls. Oedipus Rex is arguably Must-Read-caliber given
 * its influence, but the established precedent (even the Iliad sits in
 * Classic, not Must Read) argues for calibration consistency here —
 * flagged for Stefano if he wants to consider a Must Read promotion.
 *
 * 2026-07-16 (daily curation pass): added six more titles closing three
 * separate gaps. Fiction: The Mahabharata (companion to the Ramayana added
 * yesterday — kept distinct from the Bhagavad Gita in Must Read, which is
 * technically one chapter of it, because the reading experience and genre
 * are entirely different: epic narrative vs. philosophical dialogue),
 * Romance of the Three Kingdoms (completes two of China's "Four Great
 * Classical Novels" already present — Journey to the West, Dream of the
 * Red Chamber), Njal's Saga (the Old Norse saga tradition had zero
 * representation), and Dom Casmurro (Lusophone/Brazilian literature had
 * zero representation — Machado de Assis is Lindy-proven and a direct
 * influence on the Latin American writers already on this list). Non-
 * fiction: On the Nature of Things (Lucretius — ancient philosophy/proto-
 * science, no Epicurean atomism anywhere on either list) and On War
 * (Clausewitz — military/strategic theory was a total gap; still the
 * reference point every strategist argues with, not around). All six
 * clear the Lindy bar with room to spare; none were close calls.
 *
 * 2026-07-17 (daily curation pass): seven titles, resolving both gaps
 * explicitly flagged on 2026-07-16 plus three newly identified ones.
 * Fiction: Water Margin (Shi Nai'an) — the fourth and last of China's Four
 * Great Classical Novels, completing the set alongside Journey to the
 * West, Dream of the Red Chamber, and Romance of the Three Kingdoms;
 * The Lusiads (Camões) — Portugal's national epic, closing the Iberian
 * gap in the epic-poetry cluster (Aeneid/Shahnameh/Orlando Furioso);
 * A House for Mr Biswas (Naipaul) — anglophone Caribbean literature had
 * only Wide Sargasso Sea's British-canon-adjacent angle; this is the more
 * distinctly Trinidadian epic, and the book that won Naipaul his Nobel.
 * Voss (Patrick White) — zero Australian representation on either list;
 * White's only Nobel for Australia rests substantially on this book.
 * Non-fiction: The Annals (Tacitus) — completes the trio of essential
 * ancient historians alongside Herodotus and Thucydides, already present;
 * The Art of War (Sun Tzu) — the companion to Clausewitz's On War flagged
 * yesterday, deliberately held back then to respect that run's own
 * single-digit scarcity rule; The Muqaddimah (Ibn Khaldun) — closes a
 * total gap in Islamic-world non-fiction (the only prior entry from that
 * world was One Thousand and One Nights, fiction) with the work Arnold
 * Toynbee called the greatest of its kind ever produced — sociology and
 * economic history reasoned out six centuries early. The Muqaddimah's
 * influence arguably clears the same bar as Democracy in America and The
 * Wealth of Nations (the Classic/Must Read split on those two comparably
 * foundational works is already inconsistent) — flagged here, not
 * promoted, for Stefano to weigh alongside the still-open Oedipus Rex
 * question from 2026-07-15. All seven clear the Lindy bar with room to
 * spare; none were close calls.
 *
 * 2026-07-18 (daily curation pass): seven titles closing one clean gap —
 * theater was almost entirely missing from both lists (only Hamlet in Must
 * Read and Oedipus Rex here represented the entire dramatic form, one play
 * each from two eras, nothing before, between, or after). Closed it with a
 * deliberately global sweep rather than a Western-only fix, following the
 * same instinct that added the Ramayana/Shahnameh/Mahabharata/Muqaddimah
 * rather than stopping at the Greco-Roman canon: Aeschylus's The Oresteia
 * (the only complete trilogy to survive Greek tragedy, and the tradition's
 * other major voice alongside Sophocles), Euripides's Medea (the third of
 * the "big three," and the most psychologically modern), Aristophanes's
 * Lysistrata (comedy is a different enough genre from tragedy that the
 * tragedians don't cover it — Old Comedy's best-preserved survivor),
 * Kalidasa's Shakuntala (classical Sanskrit drama's masterpiece, ~1,600
 * years proven, and the play Goethe openly modeled Faust's stage-prologue
 * on — already sitting a few lines down on this same list), Molière's
 * Tartuffe (French neoclassical theater, zero prior representation, banned
 * for five years by the Church), Ibsen's A Doll's House (the birth of
 * modern realist drama — a century of "problem plays" all argue with this
 * one first), and Chekhov's The Cherry Orchard (the naturalistic
 * culmination of the form, tonally distinct from Ibsen's directness). All
 * seven clear the Lindy bar with room to spare; none were close calls.
 *
 * A Doll's House is arguably Must-Read caliber by the same logic that
 * flagged Oedipus Rex on 2026-07-15 — modern drama's founding text, and
 * Must Read currently has exactly one play (Hamlet) representing the
 * entire form. Flagged here, not promoted, alongside the still-open
 * Oedipus Rex (2026-07-15) and Muqaddimah (2026-07-17) questions, for
 * Stefano to weigh together whenever he next reviews this list.
 *
 * Deferred, not forgotten: Euclid's Elements (pure mathematics has zero
 * representation in non-fiction despite biology/physics/psychology all
 * being covered) was identified this round but held back to keep this
 * pass single-themed around theater; a natural pick for the next run.
 *
 * 2026-07-19 (post-review correction, same day as the theater-gap pass):
 * Stefano reviewed the three pending Must Read promotion flags accumulated
 * across 2026-07-15/07-17/07-18 (Oedipus Rex, The Muqaddimah, A Doll's
 * House) and promoted all three himself. Removed from this list
 * accordingly — they now live in must-read.ts, whose own header carries
 * the full reasoning. He also set a governing principle for any future
 * multi-entry-per-author question on either list: decide per book, on
 * that book's own merit, not by a fixed author quota. Classic count:
 * 201 → 198 (142 fiction + 56 non-fiction).
 *
 * 2026-07-19 (daily curation pass, second of the day): five titles closing
 * two clean gaps, vetted against moser-the-librarian's Lindy rubric.
 * Non-fiction: Elements (Euclid) and The Principia (Newton) resolve the
 * pure-mathematics/classical-physics gap identified and deliberately
 * deferred on 2026-07-18 — this list had biology (Darwin, Watson),
 * cosmology (Hawking), and math-adjacent cognitive science (Hofstadter,
 * Gleick) but nothing from mathematics or physics itself. Placed as a
 * matched pair on purpose: Newton modeled the Principia's proofs on
 * Euclid's own geometric method, so the adjacency isn't coincidental.
 * Fiction: Lazarillo de Tormes (anonymous, 1554) — the picaresque novel's
 * founding text, and the direct ancestor of the tradition Tom Jones and
 * Tristram Shandy already represent here; The Tale of Kiều (Nguyễn Du)
 * and The Nine Cloud Dream (Kim Man-jung) close a real, plain gap —
 * Vietnam and Korea had zero representation on either list despite Japan
 * (Genji, Kokoro, Rashomon, Silence, The Makioka Sisters, The Wind-Up
 * Bird Chronicle) and China (all Four Great Classical Novels) both being
 * well represented. Kiều is Vietnam's national epic in verse, still
 * recited from memory by people who otherwise can't read it; The Nine
 * Cloud Dream is Korea's best-loved classical novel and the first Korean
 * literary work ever translated into English (1922). All five clear the
 * Lindy bar with room to spare, and none rise to Must Read's "unmissable"
 * bar the way Oedipus Rex or A Doll's House did: Elements and the
 * Principia are towering in historical weight but not books a general
 * reader sits down and reads cover to cover, and Kiều/The Nine Cloud
 * Dream/Lazarillo are civilization-defining within their own traditions
 * the same way Shahnameh and the Ramayana are — exactly the tier those
 * two already occupy on this list, not a step above it. Classic count:
 * 198 → 203 (145 fiction + 58 non-fiction).
 *
 * 2026-07-20 (daily curation pass): six titles, vetted against
 * moser-the-librarian's rubric, closing a single clear gap — five
 * Nobel-laureate-anchored national traditions sat at zero representation
 * on either list, despite deep existing coverage of Chinese, Japanese,
 * Indian, Arabic, Greco-Roman, and Scandinavian literature. Fiction: Wole
 * Soyinka's Death and the King's Horseman (Nigeria, 1986 Nobel) — a
 * colonial district officer intervenes in a Yoruba ritual suicide he
 * doesn't understand, extending the theater cluster added 2026-07-18 to
 * Africa for the first time; Orhan Pamuk's My Name Is Red (Turkey, 2006
 * Nobel) and S.Y. Agnon's Only Yesterday (Israel, 1966 Nobel) — Turkish
 * and Hebrew literature both had zero prior representation despite the
 * Arabic (One Thousand and One Nights, Palace Walk) and Persian
 * (Shahnameh) traditions being well covered; Ivo Andrić's The Bridge on
 * the Drina (Yugoslavia, 1961 Nobel) — the Balkans had zero
 * representation, and this is the single book most credited with
 * explaining the region to itself; Imre Kertész's Fatelessness (Hungary,
 * 2002 Nobel) — Hungary had zero representation, and this is the
 * fictional, teenager's-eye counterpart to If This Is a Man's direct
 * testimony (Must Read). Non-fiction: Carl Jung's Memories, Dreams,
 * Reflections — psychology on this list was Freud-only; Jung's
 * archetypes-and-collective-unconscious tradition is a real fork, not a
 * footnote, and this autobiography (deliberately distinct in kind from
 * Freud's own theoretical Interpretation of Dreams) is the accepted way
 * in. All six facts independently verified via WebSearch (dates, Nobel
 * years, plot details) rather than trusting recall alone, given this is a
 * real shipped canon; all six clear the Lindy/A-tier bar with room to
 * spare — none were close calls.
 *
 * The Bridge on the Drina is flagged, not promoted, as a fourth possible
 * Must Read candidate — same logic as Oedipus Rex/The Muqaddimah/A Doll's
 * House before Stefano resolved those on 2026-07-19: its claim is
 * arguably stronger than a typical Classic entry (near-singular status as
 * the entry point to an entire region's literature, plus real predictive
 * weight about the 1990s Yugoslav wars), but promoting into the more
 * sensitive S-tier list stays Stefano's call, not this task's default.
 * Classic count: 203 → 209 (150 fiction + 59 non-fiction).
 *
 * 2026-07-21 (daily curation pass): five titles, vetted against
 * moser-the-librarian's rubric, closing three gaps across two small
 * clusters rather than one large theme. Fiction: All Quiet on the
 * Western Front (Erich Maria Remarque, 1929) — World War I fiction had
 * zero representation despite The Good Soldier Švejk covering the same
 * war as satire; this is the ground-level counterweight, the anti-war
 * novel every later one still argues with, and the first book the
 * Nazis publicly burned (1933). Mrs Dalloway (Virginia Woolf, 1925) —
 * a second, independently-justified Woolf work alongside Must Read's To
 * the Lighthouse (per the 2026-07-19 merit-not-quota rule): a different
 * formal achievement (one day, real time, two convergent
 * consciousnesses) than Lighthouse's multi-year elegiac structure, not a
 * repeat of it. Non-fiction: Course in General Linguistics (Ferdinand de
 * Saussure, 1916) and Tristes Tropiques (Claude Lévi-Strauss, 1955),
 * placed as a deliberate adjacent pair — linguistics and anthropology
 * both sat at zero representation, and Lévi-Strauss's structuralist
 * anthropology is a direct, acknowledged application of Saussure's
 * method to a new domain, the same "method, then application" logic
 * behind the Euclid/Newton placement on 2026-07-19. Night (Elie Wiesel,
 * 1960) completes a Holocaust-testimony triangle this list had already
 * set up without finishing: Must Read's If This Is a Man (adult,
 * retrospective, scientific precision) and this list's own Fatelessness
 * (fictionalized teenager) were both already present; Night is the
 * missing third angle — a real teenager's own direct testimony. All
 * five independently clear the Lindy/A-tier bar; none were close calls.
 *
 * Night is flagged, not promoted, as a fifth possible Must Read
 * candidate, alongside the still-open Bridge on the Drina flag from
 * 2026-07-20 — its direct thematic peer, If This Is a Man, already sits
 * in Must Read, and Wiesel's Nobel Peace Prize (1986) was awarded
 * substantially on this book's strength as witness-testimony. Left for
 * Stefano to weigh alongside Drina, per the standing default that only
 * he promotes into the S-tier list.
 *
 * Process note: WebSearch was unavailable this session (sustained API
 * outage, repeated attempts over several minutes all failed) — the
 * per-candidate fact-verification pass standard since 2026-07-19 could
 * not be run live. All five entries' load-bearing facts (publication
 * years, Wiesel's 1986 Nobel Peace Prize, the 1933 Nazi book-burning,
 * Saussure's posthumous 1916 compilation) are high-confidence,
 * well-established facts, not fast-moving or contested ones — but this
 * is flagged as a deliberate, explicit deviation from the norm, not a
 * silent skip, so a future session can re-verify if there's ever reason
 * to doubt one. Classic count: 209 → 214 (152 fiction + 62 non-fiction).
 *
 * 2026-07-22 (daily curation pass): six titles, vetted against
 * moser-the-librarian's rubric, closing two clean gaps plus two
 * independent non-fiction picks. Fiction: Sappho (Sappho: Poems and
 * Fragments, c. 630-570 BCE) and Walt Whitman's Leaves of Grass (1855)
 * close the lyric-poetry gap the same way the 2026-07-18 theater sweep
 * closed drama's — this list had epic verse (Iliad, Shahnameh, Ramayana)
 * and verse-narrative (Eugene Onegin, Divine Comedy) but nothing in the
 * personal, non-narrative lyric mode. Sappho sits chronologically right
 * after Homer, where she belongs — the other branch of ancient Greek
 * poetry alongside epic; only ~650 lines of her nine scrolls survive, one
 * poem complete, and the word "lyric" still means what her songs for the
 * lyre made it mean. Whitman's first, self-typeset 1855 edition (twelve
 * poems, no name on the cover, just his picture) is the founding text of
 * American free verse — nothing in English sounded quite like it before.
 * Non-fiction: The Zhuangzi (c. 4th century BCE) and Rumi's The Masnavi
 * (1262-1273) each close a real gap in world religious/philosophical
 * teaching. Zhuangzi is Confucius's great rival within Chinese thought —
 * parable and paradox instead of maxims — placed beside The Analects for
 * the same reason Euclid sits beside Newton; the butterfly-dream parable
 * alone (a man dreams he's a butterfly, wakes, and can no longer be sure
 * which one is dreaming which) is one of philosophy's most durable
 * thought experiments. The Masnavi is Sufi Islam's central devotional
 * text, 64,000 lines dictated over twelve years to a scribe — and, in
 * Coleman Barks's translation, has been repeatedly reported as the
 * best-selling poet in America, a strange-but-true data point for a
 * thirteenth-century Persian mystic. Thomas Malthus's An Essay on the
 * Principle of Population (1798) closes a different gap — classical
 * economics had Smith, Keynes, Hayek, and Marx, but not the essay that
 * gave Darwin the mechanism for natural selection the moment he read it
 * (population outrunning food supply, exponential against arithmetic);
 * placed near The Wealth of Nations for era, its real intellectual
 * neighbor is Origin of Species in Must Read. Art Spiegelman's Maus
 * (serialized 1980-1991) closes the graphic novel's total absence from
 * both lists in one stroke, and does it by completing a cluster this
 * list already built without finishing: Must Read's If This Is a Man
 * (adult testimony), this list's own Fatelessness (fictionalized
 * teenager), and Night (real teenager) were already present — Maus adds
 * a fourth angle, a second generation's inherited trauma, mediated
 * through cats and mice because direct language couldn't hold it.
 * Classified as non-fiction, not fiction, despite the allegorical art
 * style: the events and the father's testimony are real, which is
 * exactly why the 1992 Pulitzer board couldn't fit it into any existing
 * category and invented a Special Award instead. All six facts (Sappho's
 * surviving line count, Whitman's 1855 print run and contents, Zhuangzi's
 * Warring States dating, the Masnavi's composition years and Barks
 * bestseller claim, Malthus's 1798 publication and Darwin/Wallace
 * influence, Spiegelman's Pulitzer detail) independently verified via
 * WebSearch rather than trusted from recall, per the standing practice
 * since 2026-07-19 (and closing the 2026-07-21 process note above — this
 * confirms WebSearch is back and reliable). All six clear the Lindy/
 * A-tier bar with room to spare; none were close calls.
 *
 * Leaves of Grass is flagged, not promoted, as a sixth possible Must Read
 * candidate — alongside the still-open Bridge on the Drina (2026-07-20)
 * and Night (2026-07-21) flags, now three awaiting Stefano's own review
 * together, the same backlog-then-batch-review pattern he used on
 * 2026-07-19. Reasoning: it does for American poetry what Must Read's
 * Divine Comedy does for Italian narrative or The Tale of Genji does for
 * Japanese prose — the founding text an entire national tradition keeps
 * arguing with, not just an excellent entry within it. Sappho, the
 * Masnavi, Zhuangzi, Malthus, and Maus were all explicitly considered
 * against the same bar and confidently placed at Classic/A-tier instead,
 * the same "checked and rejected" discipline as 2026-07-19's second pass:
 * Sappho's case is more historical-importance than sit-down-and-read-it
 * (only one complete poem survives); the Masnavi and Zhuangzi are
 * civilization-defining within their own traditions the way Shahnameh
 * and the Ramayana already are here, not a step above; Malthus is a
 * landmark of influence rather than a book a general reader reaches for
 * on its own merits the way Meditations or The Second Sex still are; and
 * Maus, despite being the graphic novel's single strongest claim to the
 * S-tier, represents a form still young enough relative to the
 * novel/epic/drama traditions that dominate Must Read that one landmark
 * work doesn't yet argue for lowering that bar — worth revisiting if the
 * medium produces a second or third work of comparable stature.
 *
 * Classic count: 214 → 220 (154 fiction + 66 non-fiction).
 *
 * 2026-07-23 (daily curation pass): six titles, vetted against
 * moser-the-librarian's rubric, closing two founding-genre gaps together
 * plus two independent picks. Grepped a fresh candidate pool (plain forms,
 * checked for coincidental substring collisions the way "Poe" false-
 * positived against "poem"/"poetry" text already in this file's own prose)
 * — all six confirmed genuine zero-hits on both lists. Fiction: Edgar Allan
 * Poe's The Murders in the Rue Morgue (1841) and Arthur Conan Doyle's The
 * Adventures of Sherlock Holmes (1892) close detective fiction's total
 * absence — a globally massive, Lindy-proven genre with zero representation
 * despite this list covering nearly everything else; Poe's Dupin invented
 * the armchair-deduction template in a single Graham's Magazine story, and
 * Doyle's twelve Strand stories are what actually built a readership for
 * it. Jules Verne's Twenty Thousand Leagues Under the Sea (1870) and H.G.
 * Wells's The Time Machine (1895) close a second, adjacent gap: scientific
 * romance, the genre that directly produced several books already sitting
 * on this list (Dune, Neuromancer, Solaris, Do Androids Dream of Electric
 * Sheep?, The Left Hand of Darkness) — their common ancestors were
 * themselves absent until now. Two independent picks close children's/
 * fable literature's total absence from both lists: Lewis Carroll's
 * Alice's Adventures in Wonderland (1865), a mathematician's dream-logic
 * played completely straight, whose nonsense-as-method line runs directly
 * through Joyce and Borges; and Antoine de Saint-Exupéry's The Little
 * Prince (1943), written by a Free French pilot who disappeared on a
 * reconnaissance flight the following year, now the most translated book
 * in the world after the Bible. All six facts (Poe's 1841 Graham's
 * Magazine publication, Doyle's 14 October 1892 collection date, Verne's
 * 1870 book publication, Wells's May 1895 publication, Carroll's 4 July
 * 1865 publication, the Little Prince's Bible-adjacent translation count)
 * independently verified via WebSearch rather than trusted from recall.
 * All six clear the Lindy/A-tier bar with room to spare; none were close
 * calls.
 *
 * Alice's Adventures in Wonderland is flagged, not promoted, as a fourth
 * possible Must Read candidate — alongside the still-open Bridge on the
 * Drina (2026-07-20), Night (2026-07-21), and Leaves of Grass (2026-07-22)
 * flags, now four awaiting Stefano's own review together. Reasoning: its
 * influence runs well past "excellent children's book" — it's a founding
 * text of literary nonsense whose logic-games directly shaped Joyce's
 * wordplay and Borges's labyrinths, the kind of formal-influence claim that
 * argues for a tier above merely earning its place. Poe, Doyle, Verne, and
 * Wells were explicitly considered against the same bar and confidently
 * placed at Classic/A-tier instead: each is a genre's foundation rather
 * than a book most readers finish and call their favorite novel, the same
 * "importance outweighs sit-down-and-read-it" logic applied to Sappho and
 * Malthus on 2026-07-22. The Little Prince came closest of the four
 * rejections — genuinely beloved, not just historically important — but
 * its brevity and register (a children's fable first, philosophy second)
 * keep it a notch below Must Read's novel/epic/drama-dominated roster,
 * closer to a companion for Alice than a second flag alongside it.
 *
 * Classic count: 220 → 226 (160 fiction + 66 non-fiction).
 */

export type ClassicEntry = {
  title: string;
  author: string;
  /** One-line A-tier justification, shown as the stamp's tooltip/subline. */
  why: string;
  /** Alternate titles/translations this entry should also match. */
  aka?: string[];
};

export const CLASSIC: ClassicEntry[] = [
  // ── Fiction ────────────────────────────────────────────────────────────
  { title: "Epic of Gilgamesh", author: "Anonymous", why: "The oldest story still being read; a king learns mortality four thousand years before anyone else wrote it down.", aka: ["The Epic of Gilgamesh", "Gilgamesh"] },
  { title: "The Iliad", author: "Homer", why: "War's oldest ledger — rage, glory, and mortality rendered in bronze-age hexameter.", aka: ["Iliad"] },
  { title: "Sappho: Poems and Fragments", author: "Sappho", why: "Nine scrolls of songs written for the lyre, reduced by two thousand years to scraps and one complete poem — still the reason 'lyric' means what it means.", aka: ["The Poems of Sappho", "Sappho"] },
  { title: "The Oresteia", author: "Aeschylus", why: "The only complete trilogy to survive from Greek tragedy — blood vengeance argued all the way to the first courtroom.", aka: ["Oresteia"] },
  { title: "Medea", author: "Euripides", why: "A wronged wife's revenge pushed past every limit; Greek tragedy's most unsettlingly modern psychology." },
  { title: "Lysistrata", author: "Aristophanes", why: "The women of Athens end a war by withholding sex; Old Comedy's rowdiest survivor, and still startlingly current." },
  { title: "Metamorphoses", author: "Ovid", why: "Every myth Western art keeps repainting, collected and fused into one restless poem." },
  { title: "The Aeneid", author: "Virgil", why: "Empire's founding propaganda, written with enough doubt to survive its own purpose.", aka: ["Aeneid"] },
  { title: "The Ramayana", author: "Valmiki", why: "Duty, exile, and devotion across an epic that still shapes how a fifth of the world thinks about virtue.", aka: ["Ramayana"] },
  { title: "The Mahabharata", author: "Vyasa", why: "The world's longest epic — a dynastic war swallowing philosophy, myth, and law whole; the Gita is just one chapter of it, kept separate here as its own text.", aka: ["Mahabharata"] },
  { title: "Shakuntala", author: "Kalidasa", why: "A king forgets the woman he married under a curse, and a ring must remind him; classical Sanskrit drama's masterpiece, and Goethe's confessed obsession.", aka: ["The Recognition of Shakuntala", "Abhijnanashakuntalam"] },
  { title: "The Shahnameh", author: "Ferdowsi", why: "Persia's thousand-year epic of kings and heroes, written to outlast an empire's language — and it did.", aka: ["Shahnameh", "The Book of Kings", "Shahnama"] },
  { title: "One Thousand and One Nights", author: "Anonymous", why: "The story that swallows stories; frame narrative invented as a survival tactic.", aka: ["Arabian Nights", "The Arabian Nights", "1001 Nights"] },
  { title: "The Tale of the Heike", author: "Anonymous", why: "Samurai Japan's fall from grace, chanted for centuries before it was written down." },
  { title: "The Tale of Kiều", author: "Nguyễn Du", why: "A woman sold to save her family, told in 3,254 lines of verse that Vietnamese schoolchildren still recite from memory; the nearest thing the country has to a national scripture.", aka: ["The Tale of Kieu", "Truyện Kiều", "Truyen Kieu"] },
  { title: "Romance of the Three Kingdoms", author: "Luo Guanzhong", why: "The historical epic every Chinese reader grows up on; strategy and loyalty across a fractured empire.", aka: ["Three Kingdoms"] },
  { title: "Journey to the West", author: "Wu Cheng'en", why: "A monk, a monkey, and sixteenth-century China's wildest religious road trip." },
  { title: "Dream of the Red Chamber", author: "Cao Xueqin", why: "Eighteenth-century China's Middlemarch — a family's rise and ruin in four hundred characters.", aka: ["The Story of the Stone"] },
  { title: "Water Margin", author: "Shi Nai'an", why: "A hundred and eight outlaws gather at a marsh to become bandit-heroes; the last of China's Four Great Classical Novels, and the rowdiest.", aka: ["Outlaws of the Marsh", "All Men Are Brothers"] },
  { title: "The Nine Cloud Dream", author: "Kim Man-jung", why: "A monk dreams an entire human lifetime of power, love, and regret before waking to Buddhist clarity; Korea's best-loved classical novel, and the first ever translated into English.", aka: ["The Cloud Dream of the Nine", "Kuunmong", "Nine Cloud Dream"] },
  { title: "Beowulf", author: "Anonymous", why: "Monsters, mead-halls, and the first great poem in English; heroism weighed against its own mortality." },
  { title: "Njal's Saga", author: "Anonymous", why: "Iceland's prose masterpiece — blood feud and law codes rendered with a flatness that makes the violence worse.", aka: ["Njals Saga", "The Story of Burnt Njal"] },
  { title: "The Canterbury Tales", author: "Geoffrey Chaucer", why: "English literature's big bang; every voice in a pilgrimage party gets to talk." },
  { title: "The Decameron", author: "Giovanni Boccaccio", why: "A plague quarantine's storytelling marathon; the short story invented out of necessity." },
  { title: "Orlando Furioso", author: "Ludovico Ariosto", why: "Chivalric romance pushed to gleeful, self-aware excess; Renaissance Italy's favorite epic." },
  { title: "Lazarillo de Tormes", author: "Anonymous", why: "A blind man's boy cons his way up through masters both crueler and holier than he is; the picaresque novel's anonymous, anticlerical founding text.", aka: ["La Vida de Lazarillo de Tormes", "The Life of Lazarillo de Tormes"] },
  { title: "The Lusiads", author: "Luís de Camões", why: "Vasco da Gama's voyage to India, narrated with the old gods still meddling; Portugal's answer to the Aeneid.", aka: ["Os Lusiadas", "Os Lusíadas"] },
  { title: "The Faerie Queene", author: "Edmund Spenser", why: "Allegory built like a cathedral; English verse flexing its full structural range." },
  { title: "Tartuffe", author: "Molière", why: "A con man in religious costume fools an entire household; comedy so dangerous the Church got it banned for five years.", aka: ["Tartuffe, ou l'Imposteur", "The Impostor"] },
  { title: "Paradise Lost", author: "John Milton", why: "Satan gets the best lines; the fall of man as the first great antihero epic." },
  { title: "The Pilgrim's Progress", author: "John Bunyan", why: "Allegory so plain it became the second-best-selling book in English after the Bible.", aka: ["Pilgrim's Progress"] },
  { title: "Robinson Crusoe", author: "Daniel Defoe", why: "The English novel's opening argument for itself: one man, an island, and inventory." },
  { title: "Tom Jones", author: "Henry Fielding", why: "The comic novel's blueprint — plot as clockwork, narrator as co-conspirator.", aka: ["The History of Tom Jones, a Foundling"] },
  { title: "Tristram Shandy", author: "Laurence Sterne", why: "The novel deconstructing itself two centuries before that was a movement.", aka: ["The Life and Opinions of Tristram Shandy, Gentleman"] },
  { title: "Dangerous Liaisons", author: "Pierre Choderlos de Laclos", why: "Seduction as chess, told entirely in letters; cruelty with perfect manners.", aka: ["Les Liaisons Dangereuses"] },
  { title: "Faust", author: "Johann Wolfgang von Goethe", why: "The Western bargain-with-the-devil story, rewritten as the whole of human striving." },
  { title: "Emma", author: "Jane Austen", why: "Austen's most technically perfect novel; a heroine wrong about everything, charmingly." },
  { title: "The Betrothed", author: "Alessandro Manzoni", why: "The Italian national novel; plague, tyranny, and two lovers kept apart by both.", aka: ["I Promessi Sposi"] },
  { title: "The Count of Monte Cristo", author: "Alexandre Dumas", why: "Revenge as a long-form engineering project; the thriller's nineteenth-century ceiling." },
  { title: "Les Misérables", author: "Victor Hugo", why: "Justice, mercy, and the sewers of Paris; the social novel at maximum scale.", aka: ["Les Miserables"] },
  { title: "A Tale of Two Cities", author: "Charles Dickens", why: "The Revolution's best opening line and one of fiction's great sacrifices." },
  { title: "Vanity Fair", author: "William Makepeace Thackeray", why: "A novel with no hero, only operators — satire of ambition without mercy." },
  { title: "Barchester Towers", author: "Anthony Trollope", why: "Church politics as comedy of manners; institutional pettiness, perfectly observed." },
  { title: "Père Goriot", author: "Honoré de Balzac", why: "Paris as a machine for grinding down a father's love; realism's blueprint.", aka: ["Old Goriot", "Father Goriot"] },
  { title: "The Red and the Black", author: "Stendhal", why: "Ambition and hypocrisy dissected with a psychologist's precision, a century early.", aka: ["Le Rouge et le Noir"] },
  { title: "Fathers and Sons", author: "Ivan Turgenev", why: "The generational war named 'nihilism' before the word had settled meaning." },
  { title: "Oblomov", author: "Ivan Goncharov", why: "A man who won't get out of bed becomes Russia's sharpest social diagnosis." },
  { title: "Dead Souls", author: "Nikolai Gogol", why: "A con man buys dead peasants on paper; Russia's soul audited through fraud." },
  { title: "Eugene Onegin", author: "Alexander Pushkin", why: "The novel-in-verse that built modern Russian literature out of nothing." },
  { title: "A Hero of Our Time", author: "Mikhail Lermontov", why: "The Byronic antihero, imported to the Caucasus and given a case file." },
  { title: "Notes from Underground", author: "Fyodor Dostoevsky", why: "The first existentialist novel; spite as philosophy, delivered from a basement." },
  { title: "The Murders in the Rue Morgue", author: "Edgar Allan Poe", why: "A locked room, an armchair genius, and a solution nobody saw coming — deduction as entertainment, invented whole in a single 1841 magazine story." },
  { title: "The Scarlet Letter", author: "Nathaniel Hawthorne", why: "Puritan shame made permanent, stitched to a chest; American guilt's founding text." },
  { title: "Leaves of Grass", author: "Walt Whitman", why: "Twelve poems, self-typeset and self-published, and English verse was never as free again; 'I contain multitudes' as an entire literary program." },
  { title: "My Ántonia", author: "Willa Cather", why: "The prairie remembered as elegy; frontier life without the myth-making.", aka: ["My Antonia"] },
  { title: "The Portrait of a Lady", author: "Henry James", why: "A free American woman chooses her own trap; consciousness rendered in exhaustive close-up." },
  { title: "The Age of Innocence", author: "Edith Wharton", why: "Old New York's unwritten rules, enforced by people too polite to say them aloud." },
  { title: "The Red Badge of Courage", author: "Stephen Crane", why: "War's interior weather — fear, not glory — written by a man who'd never fought." },
  { title: "Sister Carrie", author: "Theodore Dreiser", why: "American ambition without the moral punishment novels usually demand of it." },
  { title: "The Awakening", author: "Kate Chopin", why: "A woman's self-possession as scandal; the marriage plot refused outright." },
  { title: "Dom Casmurro", author: "Machado de Assis", why: "An unreliable narrator poisons his own marriage story with jealousy; Brazil's founding modern novel, a century ahead of its methods." },
  { title: "Twenty Thousand Leagues Under the Sea", author: "Jules Verne", why: "Captain Nemo's submarine predicted the real thing by decades; one of the two founding fathers of science fiction, still the more prophetic." },
  { title: "Germinal", author: "Émile Zola", why: "A mining strike as tragedy; naturalism's argument that poverty is a plot, not a flaw." },
  { title: "The Picture of Dorian Gray", author: "Oscar Wilde", why: "Vanity given a body double; aestheticism's most quotable cautionary tale." },
  { title: "Strange Case of Dr Jekyll and Mr Hyde", author: "Robert Louis Stevenson", why: "The divided self, given a formula and a body count.", aka: ["Dr. Jekyll and Mr. Hyde", "The Strange Case of Dr Jekyll and Mr Hyde"] },
  { title: "Dracula", author: "Bram Stoker", why: "Epistolary horror that invented the modern vampire's entire rulebook." },
  { title: "The Woman in White", author: "Wilkie Collins", why: "The sensation novel's founding text; identity theft as Victorian nightmare." },
  { title: "Alice's Adventures in Wonderland", author: "Lewis Carroll", why: "A mathematician's dream logic, played completely straight; nonsense-as-method that runs straight through to Joyce and Borges.", aka: ["Alice in Wonderland"] },
  { title: "The Adventures of Sherlock Holmes", author: "Arthur Conan Doyle", why: "The consulting detective who made observation itself the plot; every fictional genius-investigator since is working from his method." },
  { title: "The Time Machine", author: "H.G. Wells", why: "Coined the phrase and the device in one stroke; Verne imagined the machines we'd build, Wells imagined what they'd cost us." },
  { title: "Tess of the d'Urbervilles", author: "Thomas Hardy", why: "Fate as a rigged system; Hardy's angriest argument against the moral order." },
  { title: "The Cherry Orchard", author: "Anton Chekhov", why: "An estate sold out from under a family too busy talking to notice; comedy and tragedy finally admit they're the same thing." },
  { title: "Buddenbrooks", author: "Thomas Mann", why: "A merchant dynasty's slow decline, four generations deep; Mann's debut and still his warmest." },
  { title: "A Portrait of the Artist as a Young Man", author: "James Joyce", why: "The bildungsroman rebuilt from the inside of a developing consciousness." },
  { title: "The Good Soldier", author: "Ford Madox Ford", why: "The unreliable narrator's masterclass; 'the saddest story' told by the last to know." },
  { title: "Sons and Lovers", author: "D.H. Lawrence", why: "Working-class desire and mother-love tangled together with uncomfortable honesty." },
  { title: "A Passage to India", author: "E.M. Forster", why: "Colonialism's failure of understanding, staged as a single unresolved incident in a cave." },
  { title: "Mrs Dalloway", author: "Virginia Woolf", why: "One June day in London holds a party's small talk and a shell-shocked veteran's unraveling in the same breath; stream of consciousness handling denial and grief at full precision.", aka: ["Mrs. Dalloway"] },
  { title: "Brideshead Revisited", author: "Evelyn Waugh", why: "Faith and nostalgia for a vanishing English aristocracy, told with real ambivalence." },
  { title: "The Good Soldier Švejk", author: "Jaroslav Hašek", why: "War satirized through sheer, weaponized incompetence; anti-militarism's funniest weapon.", aka: ["The Good Soldier Svejk"] },
  { title: "All Quiet on the Western Front", author: "Erich Maria Remarque", why: "A German teenager's war strips away patriotism, then friendship, then feeling itself; the anti-war novel every later one still argues with, and the first book the Nazis burned.", aka: ["Im Westen nichts Neues"] },
  { title: "The Man Without Qualities", author: "Robert Musil", why: "An empire's collapse examined through a man who refuses to have a personality." },
  { title: "Berlin Alexanderplatz", author: "Alfred Döblin", why: "Weimar Berlin's noise and squalor, montaged into one man's doomed comeback." },
  { title: "Steppenwolf", author: "Hermann Hesse", why: "A man split between bourgeois comfort and wolfish alienation; midlife crisis as metaphysics." },
  { title: "As I Lay Dying", author: "William Faulkner", why: "A family hauls a coffin across Mississippi; fifteen narrators, one impossible errand." },
  { title: "Tender Is the Night", author: "F. Scott Fitzgerald", why: "The Riviera's glamour curdling into psychological ruin; Fitzgerald's most autobiographical wound." },
  { title: "East of Eden", author: "John Steinbeck", why: "Cain and Abel replayed across two California families; Steinbeck's biggest canvas." },
  { title: "The Sun Also Rises", author: "Ernest Hemingway", why: "The Lost Generation drinking through Paris and Pamplona, saying almost nothing directly." },
  { title: "Brave New World", author: "Aldous Huxley", why: "The dystopia that predicted pleasure, not pain, would be the leash." },
  { title: "Animal Farm", author: "George Orwell", why: "Revolution's betrayal compressed into a fable simple enough for a child to feel it." },
  { title: "Journey to the End of the Night", author: "Louis-Ferdinand Céline", why: "Disgust as prose style; nihilism that changed how sentences could sound." },
  { title: "The Plague", author: "Albert Camus", why: "A quarantined city as moral laboratory; solidarity tested against an absurd catastrophe.", aka: ["La Peste"] },
  { title: "Nausea", author: "Jean-Paul Sartre", why: "Existentialism's founding novel — the sheer, physical horror of things simply existing.", aka: ["La Nausée"] },
  { title: "Doctor Zhivago", author: "Boris Pasternak", why: "Revolution and love affair collide across decades; banned in its own country for telling the truth." },
  { title: "The Tin Drum", author: "Günter Grass", why: "A boy who refuses to grow, banging a drum through the Nazi era's madness." },
  { title: "Invisible Cities", author: "Italo Calvino", why: "Marco Polo describes cities that may not exist; fiction as pure architecture of ideas." },
  { title: "The Name of the Rose", author: "Umberto Eco", why: "A murder mystery inside a medieval monastery, and a treatise on semiotics in disguise." },
  { title: "Independent People", author: "Halldór Laxness", why: "An Icelandic sheep farmer's stubborn, doomed independence; Nobel-caliber bleak comedy." },
  { title: "Voss", author: "Patrick White", why: "An explorer vanishes into the Australian interior while a woman in Sydney lives the expedition psychically; the novel behind Australia's only Nobel." },
  { title: "Hunger", author: "Knut Hamsun", why: "A starving writer's mind unraveling on the page; modernist interiority before modernism had a name." },
  { title: "The Bridge on the Drina", author: "Ivo Andrić", why: "Four centuries pass across one Bosnian bridge — empires change, neighbors coexist, then slaughter each other; the book most credited with explaining the Balkans to themselves.", aka: ["Na Drini Ćuprija"] },
  { title: "Wide Sargasso Sea", author: "Jean Rhys", why: "Jane Eyre's 'madwoman in the attic' given her own voice and her own colonial history." },
  { title: "A House for Mr Biswas", author: "V.S. Naipaul", why: "One man's lifelong scrap for a house — and a self — of his own; the Trinidadian novel that won Naipaul his Nobel." },
  { title: "The Unbearable Lightness of Being", author: "Milan Kundera", why: "Love and politics under Soviet occupation, filtered through Nietzsche's eternal return." },
  { title: "Austerlitz", author: "W.G. Sebald", why: "Memory, architecture, and the Holocaust's aftershocks, told in single unbroken paragraphs." },
  { title: "Never Let Me Go", author: "Kazuo Ishiguro", why: "A quiet dystopia about acceptance; horror delivered entirely in understatement." },
  { title: "Suite Française", author: "Irène Némirovsky", why: "France's 1940 collapse, written in real time by an author who didn't survive to finish it.", aka: ["Suite Francaise"] },
  { title: "The Little Prince", author: "Antoine de Saint-Exupéry", why: "A downed pilot's fable about a boy, a rose, and a planet the size of a house; the world's most translated book after the Bible, written by a man who vanished flying reconnaissance the following year.", aka: ["Le Petit Prince"] },
  { title: "Fatelessness", author: "Imre Kertész", why: "A Budapest teenager narrates Auschwitz in a flat, uncomprehending voice that refuses every consoling frame; the fictional counterpart no memoir can quite reach.", aka: ["Fateless", "Sorstalanság"] },
  { title: "Life and Fate", author: "Vasily Grossman", why: "Stalingrad's War and Peace; a book the KGB tried to arrest, not just ban." },
  { title: "One Day in the Life of Ivan Denisovich", author: "Aleksandr Solzhenitsyn", why: "The Gulag rendered in a single ordinary day; the sentence that cracked Soviet silence." },
  { title: "We", author: "Yevgeny Zamyatin", why: "The dystopia 1984 and Brave New World both learned from; glass cities, numbered citizens." },
  { title: "Fahrenheit 451", author: "Ray Bradbury", why: "Censorship imagined from the fireman's side of the flamethrower." },
  { title: "The Handmaid's Tale", author: "Margaret Atwood", why: "Theocracy imagined with bureaucratic precision; dystopia grounded in real historical precedent." },
  { title: "Song of Solomon", author: "Toni Morrison", why: "A man's search for his family's buried name; flight as inheritance and myth." },
  { title: "The Color Purple", author: "Alice Walker", why: "Survival and sisterhood told entirely in letters; trauma answered with hard-won voice." },
  { title: "Gilead", author: "Marilynne Robinson", why: "A dying preacher's letter to his son; American Protestantism's quiet, luminous conscience." },
  { title: "The Road", author: "Cormac McCarthy", why: "Post-apocalypse stripped to a father, a son, and the bare fact of love." },
  { title: "Lonesome Dove", author: "Larry McMurtry", why: "The cattle-drive Western elevated to elegy; the myth and its cost, both taken seriously." },
  { title: "All the King's Men", author: "Robert Penn Warren", why: "A populist demagogue's rise, narrated by the aide who helped build him." },
  { title: "A Confederacy of Dunces", author: "John Kennedy Toole", why: "American comic fiction's strangest, funniest fluke — published posthumously, unrepeatable." },
  { title: "Catch-22", author: "Joseph Heller", why: "The bureaucratic trap that gave English a new phrase for an unwinnable logic." },
  { title: "The Catcher in the Rye", author: "J.D. Salinger", why: "Adolescent alienation's defining voice; phoniness detected everywhere except in the narrator." },
  { title: "On the Road", author: "Jack Kerouac", why: "Restlessness as prose rhythm; the Beat generation's founding travelogue." },
  { title: "American Pastoral", author: "Philip Roth", why: "The American dream detonated by his own daughter; postwar optimism's autopsy." },
  { title: "The Adventures of Augie March", author: "Saul Bellow", why: "'I am an American, Chicago born' — the immigrant-city novel at full, unruly speed." },
  { title: "Rabbit, Run", author: "John Updike", why: "Suburban restlessness given no exit; the ordinary American male examined without flattery." },
  { title: "Gravity's Rainbow", author: "Thomas Pynchon", why: "Paranoia as a structuring principle; postwar fiction's most maximalist, hardest-earned achievement." },
  { title: "Infinite Jest", author: "David Foster Wallace", why: "Addiction, entertainment, and tennis, entwined into a thousand-page argument about attention." },
  { title: "White Noise", author: "Don DeLillo", why: "Consumerism and death anxiety, narrated by a professor of Hitler studies." },
  { title: "The Left Hand of Darkness", author: "Ursula K. Le Guin", why: "Gender reimagined from first principles; science fiction doing anthropology's job." },
  { title: "Dune", author: "Frank Herbert", why: "Ecology, empire, and messianic danger, built into science fiction's most complete world." },
  { title: "Neuromancer", author: "William Gibson", why: "Cyberspace named and imagined before the internet existed to prove it right." },
  { title: "Do Androids Dream of Electric Sheep?", author: "Philip K. Dick", why: "Empathy as the only test that can't be faked; the question Blade Runner borrowed." },
  { title: "Solaris", author: "Stanisław Lem", why: "First contact with an intelligence too alien to ever be understood, not just met." },
  { title: "2666", author: "Roberto Bolaño", why: "Femicide, literature, and evil circling a Mexican border city across five linked novels." },
  { title: "Hopscotch", author: "Julio Cortázar", why: "A novel readable in two different chapter orders; the reader made a co-author.", aka: ["Rayuela"] },
  { title: "The Death of Artemio Cruz", author: "Carlos Fuentes", why: "A dying revolutionary's life replayed in fractured tenses; Mexico's history as one man's conscience." },
  { title: "The Feast of the Goat", author: "Mario Vargas Llosa", why: "Trujillo's dictatorship reconstructed from three angles — the tyrant, the assassins, the survivor." },
  { title: "Love in the Time of Cholera", author: "Gabriel García Márquez", why: "A fifty-year courtship that treats love itself as a chronic, incurable condition." },
  { title: "Kristin Lavransdatter", author: "Sigrid Undset", why: "Medieval Norway's most complete interior life; a woman's whole moral biography, Nobel-crowned." },
  { title: "The Palm-Wine Drinkard", author: "Amos Tutuola", why: "Yoruba folklore fed straight into the novel form; magical realism before the term existed." },
  { title: "Season of Migration to the North", author: "Tayeb Salih", why: "Colonial trauma reversed — an African seducer loose in postwar London." },
  { title: "Cry, the Beloved Country", author: "Alan Paton", why: "Apartheid-era South Africa's moral case made through one father's search for his son." },
  { title: "July's People", author: "Nadine Gordimer", why: "A white family's roles inverted overnight; apartheid's collapse imagined from inside a farmhouse." },
  { title: "Petals of Blood", author: "Ngũgĩ wa Thiong'o", why: "Independence's broken promises, traced through four lives in a betrayed Kenyan town." },
  { title: "Death and the King's Horseman", author: "Wole Soyinka", why: "A colonial officer stops a Yoruba horseman's ritual suicide and breaks a cosmology he never understood; the first African Nobel laureate's most performed play." },
  { title: "Kokoro", author: "Natsume Sōseki", why: "Isolation and guilt in Meiji Japan; a friendship's quiet, devastating confession." },
  { title: "The Wind-Up Bird Chronicle", author: "Haruki Murakami", why: "A missing cat unspools into wells, wartime Manchuria, and Japan's buried history." },
  { title: "Silence", author: "Shūsaku Endō", why: "A missionary's faith tested by torture and God's total silence; conviction under real pressure." },
  { title: "The Makioka Sisters", author: "Jun'ichirō Tanizaki", why: "Four sisters, one marriage crisis at a time, as old Japan gives way to the new." },
  { title: "Rashomon and Other Stories", author: "Ryūnosuke Akutagawa", why: "The same crime, four irreconcilable truths; the story that gave 'Rashomon effect' its name.", aka: ["Rashomon"] },
  { title: "Palace Walk", author: "Naguib Mahfouz", why: "A Cairo patriarch's household, opening the trilogy that won the Arab world's first Nobel." },
  { title: "My Name Is Red", author: "Orhan Pamuk", why: "A murdered miniaturist's case narrated in turn by killer, corpse, and the color red itself; Istanbul's East-West argument staged as a sixteenth-century whodunit.", aka: ["Benim Adım Kırmızı"] },
  { title: "Only Yesterday", author: "S.Y. Agnon", why: "An idealist immigrates to build Zion and gets shadowed by a dog everyone mistakes for rabid; modern Hebrew fiction's founding epic, Nobel-crowned.", aka: ["Tmol Shilshom"] },
  { title: "The God of Small Things", author: "Arundhati Roy", why: "Forbidden love and caste violence in Kerala, told in prose that bends time and syntax." },
  { title: "A Suitable Boy", author: "Vikram Seth", why: "Post-independence India's marriage plot, stretched to thirteen hundred pages without losing momentum." },
  { title: "Untouchable", author: "Mulk Raj Anand", why: "A single day in a Dalit sweeper's life; caste injustice named early and directly." },
  { title: "Lucky Jim", author: "Kingsley Amis", why: "The campus novel's founding comedy; academic phoniness skewered from the inside." },
  { title: "Lord of the Flies", author: "William Golding", why: "Schoolboys revert to savagery without adults watching; civilization's thinness, tested and found wanting." },

  // ── Non-fiction ────────────────────────────────────────────────────────
  { title: "The Histories", author: "Herodotus", why: "The invention of history as inquiry — the 'father of history' asking why, not just what." },
  { title: "The History of the Peloponnesian War", author: "Thucydides", why: "Power politics analyzed without myth or piety; the realist tradition's founding text." },
  { title: "The Annals", author: "Tacitus", why: "Rome's emperors dissected by a senator who trusted no one's motives, least of all the ones in power; history written as autopsy.", aka: ["Annals", "The Annals of Imperial Rome"] },
  { title: "Nicomachean Ethics", author: "Aristotle", why: "Virtue as a habit, not a rule; still the sturdiest framework for a good life." },
  { title: "Symposium", author: "Plato", why: "A drinking party's speeches on love, ascending from bodies to the eternal Forms." },
  { title: "Elements", author: "Euclid", why: "Five self-evident postulates build an entire geometry from scratch; the axiomatic method's founding demonstration, unrivaled as a textbook for two thousand years.", aka: ["Euclid's Elements", "The Elements", "Stoicheia"] },
  { title: "The Principia", author: "Isaac Newton", why: "Three laws of motion and one equation for gravity, proved in Euclid's own geometric style; arguably the single most consequential book science has ever produced.", aka: ["Principia Mathematica", "Philosophiae Naturalis Principia Mathematica", "Mathematical Principles of Natural Philosophy", "Newton's Principia"] },
  { title: "On the Nature of Things", author: "Lucretius", why: "Atomism, mortality, and a universe without gods running it, argued in verse two thousand years before physics caught up.", aka: ["De Rerum Natura", "The Nature of Things"] },
  { title: "Confessions", author: "Saint Augustine", why: "The first real autobiography; interiority and guilt examined before either had a name.", aka: ["The Confessions"] },
  { title: "The Consolation of Philosophy", author: "Boethius", why: "Written in a prison cell awaiting execution; philosophy's argument against fortune's cruelty." },
  { title: "Discourse on Method", author: "René Descartes", why: "'I think, therefore I am' — modern philosophy's starting gun, in under a hundred pages." },
  { title: "Leviathan", author: "Thomas Hobbes", why: "Life without government as 'nasty, brutish, and short' — the case for the state, unsentimental." },
  { title: "An Enquiry Concerning Human Understanding", author: "David Hume", why: "Causation itself put on trial; empiricism's sharpest, most unsettling argument." },
  { title: "Two Treatises of Government", author: "John Locke", why: "Consent of the governed, laid out as first principle; the American founders' owner's manual." },
  { title: "The Social Contract", author: "Jean-Jacques Rousseau", why: "'Man is born free, and everywhere he is in chains' — the case for popular sovereignty." },
  { title: "A Vindication of the Rights of Woman", author: "Mary Wollstonecraft", why: "Reason claimed as women's birthright, a century before suffrage was even on the table." },
  { title: "The Wealth of Nations", author: "Adam Smith", why: "The invisible hand, self-interest, and the division of labor — economics as a discipline begins here." },
  { title: "An Essay on the Principle of Population", author: "Thomas Malthus", why: "Population grows exponentially, food only arithmetically, catastrophe closes the gap — the pamphlet that handed Darwin his 'struggle for existence' the moment he read it.", aka: ["Essay on the Principle of Population"] },
  { title: "The Federalist Papers", author: "Alexander Hamilton", why: "Constitutional argument as serial journalism; the owner's manual for a government built to check itself.", aka: ["Federalist Papers", "The Federalist"] },
  { title: "Critique of Pure Reason", author: "Immanuel Kant", why: "The limits of what the mind can know, mapped with exhausting, load-bearing precision." },
  { title: "Phenomenology of Spirit", author: "G.W.F. Hegel", why: "Consciousness's long, dialectical education toward absolute knowing; difficult, and never fully superseded." },
  { title: "On the Genealogy of Morals", author: "Friedrich Nietzsche", why: "Morality itself put under a genealogist's microscope — where 'good' and 'evil' actually came from." },
  { title: "The Art of War", author: "Sun Tzu", why: "Twenty-five hundred years old and still the first book handed to anyone learning to think about conflict — military, corporate, or otherwise.", aka: ["Art of War"] },
  { title: "On War", author: "Carl von Clausewitz", why: "War as 'the continuation of policy by other means' — every strategist since has had to argue with this book, not around it.", aka: ["Vom Kriege"] },
  { title: "The Communist Manifesto", author: "Karl Marx", why: "'A spectre is haunting Europe' — the pamphlet, with Engels, that launched the twentieth century's central argument." },
  { title: "On Liberty", author: "John Stuart Mill", why: "The harm principle, stated once and never bettered; the case for dissent as a public good." },
  { title: "The Interpretation of Dreams", author: "Sigmund Freud", why: "The unconscious given a grammar; whatever you think of the theory, the questions still stand." },
  { title: "Memories, Dreams, Reflections", author: "Carl Jung", why: "An autobiography written almost entirely from inside dreams and visions rather than outer events; the archetypes-and-collective-unconscious tradition Freud's own case histories never cover." },
  { title: "Course in General Linguistics", author: "Ferdinand de Saussure", why: "Lecture notes stitched together by students after their professor's death, and language hasn't been theorized the same way since; the arbitrary sign and the langue/parole split — structuralism's whole toolkit starts here.", aka: ["Cours de linguistique générale"] },
  { title: "Tristes Tropiques", author: "Claude Lévi-Strauss", why: "An anthropologist's Amazon fieldwork rewritten as memoir, travelogue, and elegy for vanishing cultures; structural anthropology's founding work, and nearly a Prix Goncourt winner despite not being a novel." },
  { title: "The Varieties of Religious Experience", author: "William James", why: "Religion studied as lived psychology, not doctrine; the empirical case for taking mysticism seriously." },
  { title: "The Protestant Ethic and the Spirit of Capitalism", author: "Max Weber", why: "Why capitalism took root where it did; ideas as an economic engine, not just an effect." },
  { title: "Suicide", author: "Émile Durkheim", why: "The first great work of empirical sociology; even the most private act, shown to have a social rate." },
  { title: "The Souls of Black Folk", author: "W.E.B. Du Bois", why: "'Double consciousness' named for the first time; the founding text of Black American thought." },
  { title: "Being and Time", author: "Martin Heidegger", why: "What it means to exist at all, reopened as a question after millennia of assuming the answer." },
  { title: "Being and Nothingness", author: "Jean-Paul Sartre", why: "Freedom as a burden, not a gift; existentialism's fullest, most demanding statement." },
  { title: "The Myth of Sisyphus", author: "Albert Camus", why: "The one serious philosophical question — whether to keep living — answered with the boulder, pushed anyway." },
  { title: "Philosophical Investigations", author: "Ludwig Wittgenstein", why: "Language games replace the picture theory; twentieth-century philosophy's second, self-correcting act." },
  { title: "The Origins of Totalitarianism", author: "Hannah Arendt", why: "How societies actually curdle into total domination, traced with unflinching historical rigor." },
  { title: "Notes of a Native Son", author: "James Baldwin", why: "Essays that fuse the personal and the political without either one flattening the other." },
  { title: "The Autobiography of Benjamin Franklin", author: "Benjamin Franklin", why: "Self-improvement as an American genre, invented by the man who lived it first." },
  { title: "Walden", author: "Henry David Thoreau", why: "Two years in a cabin as an argument against a life of quiet desperation." },
  { title: "Narrative of the Life of Frederick Douglass", author: "Frederick Douglass", why: "A former slave's own testimony, precise and devastating, that literacy itself was the first freedom." },
  { title: "Night", author: "Elie Wiesel", why: "A teenager's own account of Auschwitz, written spare enough to let the facts do all the damage without him saying so; testimony precise enough to help win its author the Nobel Peace Prize.", aka: ["La Nuit"] },
  { title: "Maus", author: "Art Spiegelman", why: "A father's Auschwitz survival drawn as mice stalked by cats; the only comic ever handed a Pulitzer, because no existing category knew what else to call it.", aka: ["Maus: A Survivor's Tale", "The Complete Maus"] },
  { title: "Long Walk to Freedom", author: "Nelson Mandela", why: "Twenty-seven years in prison recounted without bitterness overtaking the argument for justice." },
  { title: "The Decline and Fall of the Roman Empire", author: "Edward Gibbon", why: "Still the most quotable case study in how great powers actually end." },
  { title: "Democracy and Education", author: "John Dewey", why: "Education as the practice of democracy itself, not preparation for some later life." },
  { title: "The Wretched of the Earth", author: "Frantz Fanon", why: "Colonial violence and its psychology, analyzed by a psychiatrist who treated both sides of it." },
  { title: "Orientalism", author: "Edward Said", why: "How the West invented 'the East' to define itself against it; the founding text of postcolonial studies." },
  { title: "The Feminine Mystique", author: "Betty Friedan", why: "'The problem that has no name' — suburban domesticity's discontent, finally given words." },
  { title: "Silent Spring", author: "Rachel Carson", why: "Pesticides traced through the whole food chain; the book that started the environmental movement." },
  { title: "Discipline and Punish", author: "Michel Foucault", why: "The prison as a model for how modern power actually watches and shapes us." },
  { title: "The Double Helix", author: "James D. Watson", why: "DNA's discovery told as a real, messy, competitive race — science with its elbows still out." },
  { title: "A Brief History of Time", author: "Stephen Hawking", why: "Cosmology made legible to a general reader without losing the actual physics underneath." },
  { title: "Gödel, Escher, Bach", author: "Douglas Hofstadter", why: "Logic, art, and music braided into one long argument about how minds might arise from rules.", aka: ["Godel, Escher, Bach", "Gödel Escher Bach"] },
  { title: "Chaos: Making a New Science", author: "James Gleick", why: "The butterfly effect and strange attractors, made vivid enough to explain a whole scientific shift.", aka: ["Chaos"] },
  { title: "The Guns of August", author: "Barbara Tuchman", why: "The first month of World War I, reconstructed with novelistic tension from the actual decisions made." },
  { title: "The Rise and Fall of the Third Reich", author: "William L. Shirer", why: "Nazi Germany's history told by a journalist who watched large parts of it happen." },
  { title: "Capital in the Twenty-First Century", author: "Thomas Piketty", why: "Two centuries of tax data behind one argument: when capital outgrows growth, inequality compounds. Recent, but already the reference point economists argue against." },
  { title: "The General Theory of Employment, Interest and Money", author: "John Maynard Keynes", why: "The book that invented macroeconomics and gave governments a reason to intervene in recessions." },
  { title: "The Road to Serfdom", author: "Friedrich Hayek", why: "The case that central planning's road, however well-intentioned, ends in the loss of freedom." },
  { title: "The Bhagavad Gita", author: "Vyasa", why: "Duty, action, and detachment, argued on a battlefield between a warrior and his charioteer-god.", aka: ["Bhagavad Gita"] },
  { title: "The Analects", author: "Confucius", why: "Fragments of a teacher's conversations that shaped how a quarter of the world thinks about conduct." },
  { title: "The Zhuangzi", author: "Zhuangzi", why: "Confucius's great philosophical rival: parable and paradox instead of maxims, arguing that clinging to fixed categories is the real trap — a man dreams he is a butterfly, then wakes unsure which one is dreaming which.", aka: ["Zhuangzi", "Chuang Tzu", "The Book of Chuang Tzu"] },
  { title: "The Masnavi", author: "Rumi", why: "Sixty-four thousand lines of Sufi parable and ecstatic teaching, dictated over twelve years to a single scribe; eight centuries later, still routinely America's best-selling poet in translation.", aka: ["Masnavi-ye Ma'navi", "Mathnawi", "Masnavi"] },
];

// ── Lookup ─────────────────────────────────────────────────────────────────
// Same matching rules as must-read.ts: normalized title (accent-stripped,
// lowercased, whitespace-collapsed) with alternates; author surname checked
// when both sides know an author.

const byTitle = new Map<string, ClassicEntry>();
for (const entry of CLASSIC) {
  byTitle.set(normalizeForSearch(entry.title), entry);
  for (const alt of entry.aka ?? []) byTitle.set(normalizeForSearch(alt), entry);
}

const surname = (author: string): string => {
  const parts = normalizeForSearch(author).split(" ");
  return parts[parts.length - 1] ?? "";
};

/**
 * Returns the classic entry for a book, or null — including when the book
 * is already a Must Read (the two stamps are mutually exclusive; Must Read
 * wins).
 */
export function getClassic(title: string, author?: string | null): ClassicEntry | null {
  if (isMustRead(title, author)) return null;
  const entry = byTitle.get(normalizeForSearch(title));
  if (!entry) return null;
  if (author && author.trim() && author !== "Unknown") {
    if (!normalizeForSearch(author).includes(surname(entry.author))) return null;
  }
  return entry;
}

export function isClassic(title: string, author?: string | null): boolean {
  return getClassic(title, author) !== null;
}
