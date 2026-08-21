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
 * (Historical note: the "Night"/"Bridge on the Drina" flags above, and
 * every other promotion flag raised in this file through 2026-07-25,
 * were resolved on 2026-07-26 — see the dated entry near the end of this
 * comment block and must-read.ts's own header for the full account.)
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
 *
 * 2026-07-24 (daily curation pass): five titles, vetted against
 * moser-the-librarian's rubric, all non-fiction, closing two related gaps.
 * Grepped a fresh candidate pool for world historiography beyond the
 * Greco-Roman "big three" already present (Herodotus/Thucydides/Tacitus),
 * global travel literature (a total gap on both lists), and twentieth-
 * century American testimonial autobiography — catching one expected
 * false-positive first (a bare "Marco Polo" grep hits only the existing
 * Invisible Cities entry's own "why" line, where Calvino's Marco Polo is a
 * fictional narrator, not this list's own Travels — confirmed the real
 * primary source was genuinely absent). Sima Qian's Records of the Grand
 * Historian (Shiji, c. 94 BCE) closes the historiography gap: Herodotus
 * and Thucydides invented Western history-writing and Sima Qian
 * independently invented the Chinese tradition around the same general
 * era, choosing castration over death in 99 BCE specifically so he could
 * finish it — the annals-and-biographies format he built was still the
 * template every official Chinese dynastic history used two thousand
 * years later. Ibn Battuta's The Rihla (dictated 1354-1355, covering
 * travels from 1325-1354) and Marco Polo's The Travels of Marco Polo
 * (dictated to a fellow prisoner in a Genoese jail, c. 1298-1300) close
 * travel literature's total absence from both lists together — the
 * medieval world's two towering eyewitness accounts, one crossing the
 * Islamic world from Morocco to China, the other opening Europe's eyes to
 * the Mongol court. The Autobiography of Malcolm X (as told to Alex
 * Haley, published October 1965, nine months after his assassination)
 * extends the American testimonial-autobiography cluster already anchored
 * by Frederick Douglass's Narrative — a different century's account of
 * Black self-reinvention under different constraints, and one Time named
 * among the ten most influential nonfiction books of the twentieth
 * century. The Diary of a Young Girl (Anne Frank, written 1942-1944,
 * published by her father Otto Frank in 1947 after her death at
 * Bergen-Belsen) closes a real gap this list's own Holocaust-testimony
 * cluster had left open: If This Is a Man (Must Read) and
 * Fatelessness/Night (both Classic) are all retrospective accounts,
 * written after the fact by survivors; Anne Frank's diary is the only
 * contemporaneous document in the group, written in real time by someone
 * who did not survive to revise it into memoir. All five facts (Sima
 * Qian's 99 BCE sentencing and c. 94 BCE completion, Ibn Battuta's
 * 1325-1354 travels and 1355 dictation, Marco Polo's 1298-1300 Genoa
 * imprisonment and dictation, Malcolm X's 29 October 1965 publication
 * date and Time's ranking, Anne Frank's 1942-1944 writing window and 25
 * June 1947 publication) independently verified via WebSearch rather than
 * trusted from recall. All five clear the Lindy/A-tier bar with room to
 * spare, except the one flagged below.
 *
 * The Diary of a Young Girl is flagged, not promoted, as a fifth possible
 * Must Read candidate — alongside the still-open Bridge on the Drina
 * (2026-07-20), Night (2026-07-21), Leaves of Grass (2026-07-22), and
 * Alice's Adventures in Wonderland (2026-07-23) flags, now five awaiting
 * Stefano's own review together. Reasoning: among the small handful of
 * books that plausibly claim to be the single most-read primary document
 * of the Holocaust in the world, translated into dozens of languages and
 * near-universally assigned to schoolchildren as their first encounter
 * with it; its status as the only unmediated, real-time account in a
 * cluster this list has otherwise built entirely from retrospective
 * testimony is a structural distinction, not just a matter of degree.
 * Sima Qian, Ibn Battuta, Marco Polo, and Malcolm X's Autobiography were
 * all explicitly checked against the same bar and confidently held at
 * Classic/A-tier instead: Sima Qian's Records is towering but multi-
 * volume and reference-like rather than something a general reader sits
 * down and reads cover to cover, the same "importance outweighs
 * sit-down-and-read-it" logic applied to Elements and the Principia on
 * 2026-07-19; Ibn Battuta and Marco Polo are each civilization-defining
 * within travel literature specifically, the same tier the Shahnameh and
 * the Ramayana already occupy on this list within their own traditions,
 * not a step above; and Malcolm X's Autobiography, despite Time's
 * ranking, extends an already-well-represented genre (this list's own
 * Frederick Douglass, Must Read's Franklin) rather than founding a new
 * one the way A Doll's House or the Muqaddimah did before their own
 * promotions.
 *
 * Classic count: 226 → 231 (160 fiction + 71 non-fiction).
 *
 * 2026-07-25 (daily curation pass): four titles, vetted against
 * moser-the-librarian's rubric, closing four independent gaps rather than
 * one shared theme — grepped for "Rizal", "Aquinas", "Summa", "Momaday",
 * "Singer", "Gimpel", "Philippine", "Yiddish", "Native American", and
 * "scholastic" across both lists first; all ten came back genuine zero-hits,
 * no false-positive substring collisions this round. Fiction: José Rizal's
 * Noli Me Tángere (Berlin, March 1887) closes Philippine and Southeast
 * Asian literature's total absence from both lists — a satirical portrait
 * of colonial-era friars and abuse that Spanish military prosecutors cited
 * as evidence at the sham trial that sentenced Rizal to a firing squad on
 * 30 December 1896, less than ten years after he wrote it; Filipino
 * historians still credit it as the spark for the revolution that followed.
 * N. Scott Momaday's House Made of Dawn (1968) closes a second total
 * absence — no Native American voice anywhere on either list — with the
 * book that broke the barrier itself: the first Pulitzer Prize for Fiction
 * ever awarded to a Native American writer (1969), and the acknowledged
 * opening of the Native American Renaissance that produced Silko, Erdrich,
 * and Welch after it. Isaac Bashevis Singer's Gimpel the Fool and Other
 * Stories (1957) closes a third gap distinct from the Hebrew literature
 * already represented by Agnon's Only Yesterday (2026-07-20): Yiddish is a
 * separate literary tradition entirely, and this is its Nobel laureate's
 * (1978) breakout collection, brought into English by Saul Bellow's own
 * translation of the title story. Non-fiction: Thomas Aquinas's Summa
 * Theologica (composed 1265-1273, left unfinished at his death) closes a
 * chronological hole this list had left sitting in plain sight — a
 * thousand-year jump straight from Boethius's Consolation of Philosophy
 * (c. 524 CE) to Marco Polo's Travels (c. 1298) with no medieval scholastic
 * philosophy at all, despite Aquinas's Aristotle-and-Christian-doctrine
 * synthesis becoming, by papal decree, the Catholic Church's own standard
 * framework for the next seven centuries. All four facts (Rizal's March
 * 1887 Berlin printing and 30 December 1896 execution date, Momaday's
 * 1968/1969 publication-and-Pulitzer dates, Singer's 1957 Bellow-translated
 * collection and 1978 Nobel, Aquinas's 1265-1273 composition window)
 * independently verified via WebSearch rather than trusted from recall.
 * All four clear the Lindy/A-tier bar with room to spare.
 *
 * Noli Me Tángere is flagged, not promoted, as a sixth possible Must Read
 * candidate — alongside the still-open Bridge on the Drina (2026-07-20),
 * Night (2026-07-21), Leaves of Grass (2026-07-22), Alice's Adventures in
 * Wonderland (2026-07-23), and The Diary of a Young Girl (2026-07-24)
 * flags, now six awaiting Stefano's own review together. Reasoning: no
 * other book on either list carries the same direct, documented causal
 * weight — a novel entered as trial evidence in the proceeding that
 * executed its own author, and credited by name with catalyzing an actual
 * revolution nine years later. Summa Theologica, House Made of Dawn, and
 * Gimpel the Fool were all explicitly checked against the same bar and
 * confidently held at Classic/A-tier instead: the Summa's case is towering
 * but reference-like and six-hundred-questions long, the same "importance
 * outweighs sit-down-and-read-it" logic applied to Sima Qian's Records on
 * 2026-07-24; House Made of Dawn is a tradition's founding breakthrough the
 * same way Voss and Dom Casmurro already are on this list, not a step
 * above them; and Gimpel the Fool, despite Singer's Nobel, is a story
 * collection extending a form (short fiction representing a national
 * tradition) this list already holds at Classic via Rashomon and Other
 * Stories, not a reason to promote past it.
 *
 * Classic count: 231 → 235 (163 fiction + 72 non-fiction).
 *
 * 2026-07-26 (daily curation pass): four titles, vetted against
 * moser-the-librarian's rubric, closing four independent gaps. Grepped a
 * fresh candidate pool — "Lu Xun", "Mo Yan", "Persepolis", "Satrapi",
 * "Ricardo", "Veblen", "Basho"/"Bashō", "Li Bai", "Du Fu", "Strindberg",
 * "Lagerlöf" — across both lists first; all confirmed genuine zero-hits,
 * no false-positive collisions this round. Fiction: Lu Xun's Diary of a
 * Madman and Other Stories (May 1918, New Youth magazine) closes modern
 * Chinese literature's total absence — this list has deep classical Chinese
 * coverage (all Four Great Classical Novels, The Analects, The Zhuangzi)
 * but nothing from the twentieth century; "Diary of a Madman" is the
 * vernacular story credited with breaking Chinese fiction away from three
 * thousand years of classical written Chinese in one stroke, the same kind
 * of tradition-opening claim as Death and the King's Horseman (2026-07-20),
 * placed directly beside it. Non-fiction: Matsuo Bashō's The Narrow Road to
 * the Deep North (composed on an 1689 walking journey, published
 * posthumously 1702) closes a Japanese-poetry gap this list left open even
 * after 2026-07-22's Sappho/Whitman lyric-poetry sweep — haibun is a
 * distinct hybrid form (haiku braided into travel prose), and this is its
 * unrivaled masterpiece; placed beside Marco Polo and the Rihla as a third
 * entry in the travel-literature cluster, since it is, among other things,
 * a first-person account of an actual 1,500-mile journey. David Ricardo's
 * On the Principles of Political Economy and Taxation (19 April 1817)
 * closes a real gap beside The Wealth of Nations and An Essay on the
 * Principle of Population: comparative advantage is one of the very few
 * genuinely non-obvious, still-uncontested results in all of economics,
 * unchanged in two centuries of scrutiny. Marjane Satrapi's Persepolis
 * (French serialization 2000–2003) is this list's second graphic novel,
 * answering the question 2026-07-22's Maus entry deliberately left open
 * ("worth revisiting if the medium produces a second... work of comparable
 * stature") — an autobiographical account of the Iranian Revolution and the
 * Iran–Iraq War, classified non-fiction on the same logic as Maus (the
 * events and the testimony are real; the medium is just black-and-white
 * line art), placed directly after it. All four facts (Lu Xun's May 1918
 * New Youth publication and its "first modern Chinese short story" status,
 * Bashō's 1689 journey/1702 posthumous publication, Ricardo's 19 April 1817
 * publication date, Satrapi's 2000–2003 French serialization) independently
 * verified via WebSearch rather than trusted from recall. All four clear
 * the Lindy/A-tier bar with room to spare.
 *
 * All four explicitly checked against the Must Read bar and confidently
 * held at Classic instead — no new promotion flag this round, alongside the
 * six still-open flags awaiting Stefano's own batch review (Bridge on the
 * Drina 2026-07-20, Night 2026-07-21, Leaves of Grass 2026-07-22, Alice's
 * Adventures in Wonderland 2026-07-23, The Diary of a Young Girl 2026-07-24,
 * Noli Me Tángere 2026-07-25). Reasoning: Lu Xun and Bashō are each
 * civilization-defining within their own national tradition, the same tier
 * Shahnameh and the Ramayana already occupy here, not a step above; Ricardo
 * is a landmark of influence rather than a book a general reader reaches
 * for on its own terms, the same "importance outweighs sit-down-and-read-it"
 * logic applied to Elements and the Principia on 2026-07-19; and Persepolis,
 * despite real durability (a 2007 Oscar-nominated film adaptation, decades
 * of continuous classroom use, repeated censorship-challenge controversy —
 * real signals of lasting weight, not just recency), is 26 years old against
 * a Must Read roster whose graphic-novel precedent (Maus) itself still sits
 * at Classic; two landmark works is a real medium-level signal worth
 * banking, but not yet grounds for jumping the form straight past its own
 * first promotion.
 *
 * Classic count: 235 → 239 (164 fiction + 75 non-fiction).
 *
 * 2026-07-26 (same day, live turn — demotion from Must Read, Stefano's
 * direct instruction, no reasoning requested): The Remains of the Day
 * (Kazuo Ishiguro) and The Selfish Gene (Richard Dawkins) moved down from
 * must-read.ts. Placed beside each author's existing Classic-tier company —
 * Remains of the Day directly beside Ishiguro's own Never Let Me Go; The
 * Selfish Gene directly beside The Double Helix, this list's other
 * landmark-but-not-S-tier biology title. Classic count: 239 → 241
 * (165 fiction + 76 non-fiction).
 *
 * 2026-07-26 (same day, third live turn — promotion out to Must Read,
 * Stefano's explicit sign-off after flagging German philosophy's total
 * absence from must-read.ts): Critique of Pure Reason (Kant), The
 * Communist Manifesto (Marx), and On the Genealogy of Morals (Nietzsche)
 * removed to must-read.ts — see that file's own header for the full
 * reasoning, including why Hegel's Phenomenology of Spirit and Heidegger's
 * Being and Time were deliberately NOT promoted alongside them (both stay
 * here). Gödel, Escher, Bach (Hofstadter) also removed to Must Read, per
 * Stefano's separate confirmation earlier the same day. Classic count:
 * 241 → 237 (165 fiction + 72 non-fiction).
 *
 * 2026-07-26 (same day, fourth live turn — promotion out to Must Read,
 * Stefano's full audit sign-off): eleven titles removed to must-read.ts —
 * see that file's own header for the complete reasoning. Six were the
 * long-open fiction backlog from daily curation runs (Bridge on the Drina,
 * Night, Leaves of Grass, Alice's Adventures in Wonderland, The Diary of a
 * Young Girl, Noli Me Tángere); five were new picks from this session's own
 * audit of Classic for under-tiered giants (The Iliad, Paradise Lost, and
 * the "debatable" pair The Histories and Discourse on Method, plus The
 * Wealth of Nations). The Interpretation of Dreams (Freud) was explicitly
 * considered and held here, not promoted — see must-read.ts's header for
 * why. Classic count: 237 → 226 (159 fiction + 67 non-fiction).
 *
 * 2026-07-27 (daily curation pass, scheduled-task fire, fully autonomous):
 * confirmed both canon files matched the 2026-07-26 extended-session
 * baseline exactly (226/85) before starting. Actually invoked
 * moser-the-librarian. Grepped a fresh candidate pool — "Beckett",
 * "Godot", "Arthur Miller", "Salesman", "Tennessee Williams", "Streetcar",
 * "Kierkegaard", "Spinoza", "Mo Yan", "Sorghum" — all confirmed genuine
 * zero-hits on both lists except "Mo Yan", which only appears inside this
 * file's own 2026-07-26 header prose (a candidate considered, not an
 * actual entry) — deliberately deferred again this round to keep today's
 * pass single-themed rather than padding the batch.
 *
 * Added 5 titles (226 → 231: 162 fiction + 69 non-fiction), closing one
 * clean genre gap plus two independent philosophy picks. Fiction/drama:
 * the 2026-07-18 theater sweep covered ancient Greek tragedy/comedy,
 * Sanskrit drama, and French/Scandinavian/Russian 19th-century realism,
 * but nothing from 20th-century drama's two dominant traditions —
 * American theater and the Absurd. Closed with all three plays the Royal
 * National Theatre's 1998 poll of 800 theater professionals ranked as the
 * century's most significant English-language plays, in that exact order:
 * Samuel Beckett's Waiting for Godot (Paris, 5 January 1953) — ranked
 * first, absurdist theater's founding text; Arthur Miller's Death of a
 * Salesman (Broadway, 10 February 1949, 1949 Pulitzer) — ranked second;
 * Tennessee Williams's A Streetcar Named Desire (Broadway, 3 December
 * 1947, 1948 Pulitzer) — ranked third. Placed together directly after The
 * Cherry Orchard, this list's most recent prior drama entry. Non-fiction:
 * two independent philosophy picks closing a real gap in the rationalist/
 * existentialist lineage. Baruch Spinoza's Ethics (published within months
 * of his death in 1677, too dangerous to release while he was alive to
 * answer for it) — the other great 17th-century rationalist system beside
 * Descartes' Discourse on Method (Must Read), argued in Euclid's own
 * geometric form; placed beside Leviathan for era. Søren Kierkegaard's
 * Fear and Trembling (16 October 1843, pseudonymously as Johannes de
 * Silentio) — existentialism's actual 19th-century founder had zero
 * representation despite Sartre and Camus both already sitting on these
 * two lists; placed directly after Hegel's Phenomenology of Spirit on
 * purpose, since Kierkegaard wrote it explicitly against Hegelian system-
 * building. All five facts (the 1998 National Theatre poll and its exact
 * ranking, each play's premiere date and Pulitzer year, Spinoza's 1677
 * posthumous publication, Kierkegaard's 16 October 1843 date and
 * pseudonym) independently verified via WebSearch before writing each
 * "why" line. All five clear the Lindy/A-tier bar with room to spare;
 * none were close calls.
 *
 * Waiting for Godot is flagged, not promoted, as a possible Must Read
 * candidate — its own 1998 National Theatre ranking (first among all
 * English-language 20th-century plays) argues for a tier above Death of a
 * Salesman and Streetcar, the same "one clear standout, two strong
 * seconds" pattern this list has used before (Bridge on the Drina among
 * 2026-07-20's Nobel cluster; Leaves of Grass among 2026-07-22's lyric-
 * poetry pair). Fear and Trembling is flagged as a second possible
 * candidate — the same logic Stefano applied on 2026-07-26 when he had
 * Kant, Marx, and Nietzsche promoted specifically to close German
 * philosophy's total absence from Must Read applies here too: Kierkegaard
 * is the founder of the existentialist movement Sartre and Camus's own
 * entries represent, and right now sits nowhere on either list. Miller and
 * Williams were explicitly checked against the same bar and held at
 * Classic instead — both towering, but the National Theatre poll itself
 * ranks them a clear step behind Godot, and neither founds a movement the
 * way Godot/absurdism or Fear and Trembling/existentialism does. Spinoza's
 * Ethics was also checked and held at Classic — towering in influence but
 * geometrically argued and reference-dense rather than a book a general
 * reader sits down and reads cover to cover, the same "importance
 * outweighs sit-down-and-read-it" logic applied to Elements/Principia
 * (2026-07-19) and Summa Theologica (2026-07-25). Per the standing default
 * reaffirmed 2026-07-26 ("the daily scheduled task's own default... still
 * applies going forward"), this run flags rather than promotes — S-tier
 * calls remain Stefano's.
 *
 * Classic count: 226 → 231 (162 fiction + 69 non-fiction). Left
 * uncommitted, per the now-standard default for fully autonomous runs
 * with no live user turn (git confirmed in sync with origin before
 * starting, aside from the pre-existing local/origin divergence on
 * unrelated backend files noted in [[novelviz-daily-canon-curation]]'s
 * 2026-07-26 entry, which this run did not touch or attempt to reconcile).
 *
 * 2026-07-28 (daily curation pass, scheduled-task fire, fully autonomous):
 * confirmed both canon files matched the 2026-07-27 baseline exactly
 * (231/85) before starting; local/origin divergence on unrelated backend
 * files persists (untouched, out of scope). Actually invoked
 * moser-the-librarian. Grepped a fresh candidate pool — "Epictetus",
 * "Seneca", "Veblen", "Mo Yan", "Sorghum", "Achebe", "Bulgakov", "Gogol",
 * "Solzhenitsyn", "Weber", "Durkheim" — all confirmed genuine zero-hits
 * except the last four, which were already real entries on this list (not
 * gaps), and Mo Yan, which — as this file's own 2026-07-27 note already
 * recorded — appears only in prior header prose as a deferred candidate,
 * never an actual entry.
 *
 * Added 4 titles (231 → 235: 163 fiction + 71 non-fiction), closing one
 * clean philosophical gap plus two independent picks. Stoicism had stood
 * on exactly one leg for two years: Marcus Aurelius's Meditations (Must
 * Read) represents the emperor's private notebook, but the movement's
 * other two canonical voices — a slave and a courtier — were entirely
 * absent. Closed with Epictetus's The Enchiridion (compiled from memory
 * by his student Arrian roughly a decade into the 2nd century CE, since
 * Epictetus himself, like Socrates, left nothing in writing) and Seneca's
 * Letters from a Stoic (124 letters written in the last two years of a
 * life spent as Nero's advisor, c. 63-65 CE, before Nero ordered his
 * suicide) — placed together directly after Lucretius's On the Nature of
 * Things and before Augustine's Confessions, closing the gap in ancient
 * philosophy chronologically rather than appending at the end. Fiction:
 * Mo Yan's Red Sorghum (1986) — deferred twice already (2026-07-26,
 * 2026-07-27) specifically to avoid padding a single-themed batch; added
 * this round as its own independently-justified pick, not a leftover —
 * the breakthrough novel behind the first Nobel Prize in Literature
 * awarded to a citizen still living in China, in 2012 (Gao Xingjian's 2000
 * prize is often excluded from that specific claim: he held French
 * citizenship and lived in Paris by then); placed directly after Lu Xun,
 * continuing modern Chinese fiction into the following century before the
 * Japan cluster. Non-fiction: Thorstein Veblen's The Theory of the Leisure
 * Class (1899) — a real gap beside Weber's Protestant Ethic and Durkheim's
 * Suicide: "conspicuous consumption" coined here, arguing status display
 * rather than thrift or religious conviction was the real engine driving
 * visible economic behavior, a decade before Weber's book and two after
 * Durkheim's; placed between them for era and cluster. All four facts
 * (Arrian's early-2nd-century-CE compilation date, Seneca's 63-65 CE
 * writing window and 124-letter count, Mo Yan's 1986/2012 dates and the
 * Gao Xingjian citizenship distinction, Veblen's 1899 publication)
 * independently verified via WebSearch before writing each "why" line.
 *
 * No new Must Read flag this round — all four explicitly checked and held
 * at Classic. Epictetus and Seneca are civilization-defining within their
 * own tradition, the same tier Marcus Aurelius's companion texts should
 * occupy rather than exceed (Meditations already sits alone in Must Read
 * as Stoicism's sole S-tier representative — a second or third Stoic
 * voice belongs at the same tier as Epictetus/Seneca, not a promotion
 * case); Mo Yan's Nobel is towering but 40 years
 * younger than this list's typical Must Read bar and hasn't yet
 * accumulated the multi-generational critical consensus of, say, Achebe's
 * Things Fall Apart; Veblen is a landmark of influence and a real
 * conceptual coinage, but read today mostly for that one idea rather than
 * cover to cover, the same "importance outweighs sit-down-and-read-it"
 * logic applied to Elements/Principia (2026-07-19) and Summa Theologica
 * (2026-07-25). The two open flags from 2026-07-27 (Waiting for Godot,
 * Fear and Trembling) remain unresolved, awaiting Stefano's own review —
 * unaffected by this round.
 *
 * Verified: `npx tsc --noEmit` clean. Both vitest suites green
 * (`must-read.test.ts` 85/1 — confirms untouched; `classic.test.ts`
 * 235/3). Ran a normalized-fingerprint dedupe/collision check (NFD-strip-
 * accents, grouped by key rather than raw frequency) across title and
 * every `aka` on both files: 0 internal collisions on either list, 0
 * cross-list collisions, all 4 new titles confirmed present in Classic and
 * absent from Must Read. Section-header line counts (163 fiction + 71
 * non-fiction = 235) independently verified against the header docblock's
 * own claimed count.
 *
 * Classic count: 231 → 235 (163 fiction + 72 non-fiction — corrected
 * 2026-07-29; the "71" originally recorded here was a stale miscount,
 * caught during this round's own section-count verification). Left
 * uncommitted, per the now-standard default for fully autonomous runs with
 * no live user turn.
 *
 * 2026-07-29 (daily curation pass): added 5 titles, closing two
 * philosophy-of-science/political-theory gaps plus three independent
 * picks. Non-fiction: John Rawls's A Theory of Justice (1971) — 20th-
 * century political philosophy's central text, and this list's contract-
 * theory lineage (Hobbes/Locke/Rousseau/Federalist Papers) had nothing
 * past Mill's On Liberty (1859); placed directly after it. Karl Popper's
 * The Logic of Scientific Discovery (1934 German / 1959 English) —
 * falsifiability, the dueling answer to the question Must Read's own
 * Structure of Scientific Revolutions (Kuhn) asks decades later; placed
 * beside Wittgenstein, both Vienna-adjacent. Karl Marx's Capital, Volume I
 * (1867) — a genuinely different book from the Communist Manifesto already
 * in Must Read (per the merit-not-quota principle, 2026-07-19): the actual
 * economics Ricardo's labor theory of value led to, not the ten-page
 * political pamphlet; placed right after Ricardo. Fiction: Isaac Asimov's
 * Foundation (1951) — the Golden Age precursor this list's New Wave/
 * cyberpunk science fiction (Dune, Neuromancer, Left Hand of Darkness) all
 * descend from, and the only work ever to beat The Lord of the Rings for a
 * Hugo (Best All-Time Series, 1966); placed first in the SF cluster,
 * chronologically. T.S. Eliot's The Waste Land (1922) — modern poetry's
 * founding rupture, closing a gap next to Sappho now that both ends of the
 * lyric tradition (ancient origin, modernist break) are represented; no
 * Western 20th-century poem was on either list before this. All five facts
 * (Rawls's 1971 date and 2,000+-paper reception, Popper's 1934/1959
 * publication split, Marx's 14 September 1867 date, Asimov's 1951/1966
 * dates, Eliot's 1922 date and 434-line/five-language count) independently
 * verified via WebSearch before writing each "why" line.
 *
 * Rawls and Popper are each flagged, not promoted, as possible Must Read
 * candidates — the first new flags since 2026-07-27's Godot/Fear and
 * Trembling pair. Rawls: its influence argues for the same tier as Kant's
 * Critique of Pure Reason or Democracy in America (both Must Read as of
 * 2026-07-26) rather than one step below — a case that political
 * philosophy's actual center of 20th-century gravity is sitting in
 * Classic. Popper: its direct dueling-pair relationship to Kuhn's already-
 * Must-Read Structure of Scientific Revolutions is the same "one half of
 * an argument already promoted, other half still waiting" pattern that
 * argued for Fear and Trembling (paired against Hegel) on 2026-07-27.
 * Marx's Capital, Asimov's Foundation, and Eliot's Waste Land were all
 * explicitly checked and held at Classic: Capital is towering but a
 * three-volume treatise read mostly for Volume I's core argument rather
 * than cover to cover, the same "importance outweighs sit-down-and-read-
 * it" logic as Elements/Principia/Summa Theologica; Foundation sits at the
 * same tier as Dune/Neuromancer/Left Hand of Darkness, none of which has
 * ever been promoted — consistent genre calibration, not an oversight;
 * The Waste Land is poetry's Ulysses-level achievement but this list has
 * never promoted a single poem to Must Read (Whitman's Leaves of Grass
 * is the closest precedent and it, too, sits one tier down), so a single
 * new poetry entry doesn't yet argue for lowering that bar.
 *
 * Verified: `npx tsc --noEmit` clean. Both vitest suites green
 * (`must-read.test.ts` 85/1 — confirms untouched; `classic.test.ts`
 * 240/3). Ran a normalized-fingerprint dedupe/collision check (NFD-strip-
 * accents, grouped by key rather than raw frequency) across title and
 * every `aka` on both files: 0 internal collisions on either list, 0
 * cross-list collisions, all 5 new titles confirmed present in Classic and
 * absent from Must Read.
 *
 * Classic count: 235 → 240 (165 fiction + 75 non-fiction). Left
 * uncommitted, per the now-standard default for fully autonomous runs with
 * no live user turn.
 *
 * 2026-07-29 (same day, live turn — Stefano said "ok promote"): four
 * flagged Must Read candidates promoted out, all from open flags rather
 * than newly proposed — two carried over from 2026-07-27 (Waiting for
 * Godot, Fear and Trembling), two from this same day's own curation pass
 * (A Theory of Justice, The Logic of Scientific Discovery). Stefano
 * delegated which ones without naming titles; promoted all four rather
 * than cherry-picking, same call made 2026-07-19 when he delegated "you
 * decide" on the first three-flag backlog — each had already been
 * independently argued on its own merits in the flag itself, not
 * manufactured together for this moment. Classic count: 240 → 236 (164
 * fiction + 72 non-fiction).
 *
 * 2026-07-30 (daily curation pass, scheduled-task fire, fully autonomous):
 * confirmed both canon files matched the 2026-07-29 baseline exactly
 * (Classic 236: 164 fiction + 72 non-fiction; Must Read 89, untouched)
 * before starting — the "ok promote" commit (88507d2) had already landed
 * and was folded into HEAD, so no stacked backlog this round. Actually
 * invoked moser-the-librarian. Grepped a wide candidate pool (Tolkien,
 * Turing, Knuth, Shannon, Fred Brooks, SICP, Dracula, Henry James,
 * Catch-22, Vonnegut, Walcott, Friedan, Adichie, Mahfouz) — most already
 * present; three genuine zero-hit gaps confirmed and closed.
 *
 * Added 3 entries (236 → 239: 166 fiction + 73 non-fiction), each closing
 * an independent gap rather than one theme. High fantasy had zero
 * representation despite this list's deep science-fiction cluster (Dune,
 * Foundation, Neuromancer, Left Hand of Darkness) — closed with **The
 * Lord of the Rings** (J.R.R. Tolkien, published in three volumes across
 * 29 July 1954-20 October 1955, 150M+ copies sold since), placed directly
 * beside Foundation since that entry's own "why" line already name-checks
 * it as the book Foundation beat for the 1966 Hugo Best-All-Time-Series
 * award — the comparison was sitting right there, unclosed, until now.
 * Caribbean poetry was a real gap next to this list's Caribbean prose
 * (Wide Sargasso Sea, A House for Mr Biswas) — closed with **Omeros**
 * (Derek Walcott, 1990), the Iliad and Odyssey relocated to a Caribbean
 * fishing village, published two years before Walcott's 1992 Nobel;
 * placed beside The Waste Land in the modern-poetry cluster. Computer
 * science/software engineering had zero representation across either
 * list — closed with **The Mythical Man-Month** (Fred Brooks, 1975),
 * the book that coined Brooks's Law ("adding manpower to a late software
 * project makes it later") from Brooks's own experience managing IBM's
 * OS/360; still the field's most commonly assigned non-textbook classic.
 * All three facts (Tolkien's exact publication window and sales figure,
 * Walcott's 1990/1992 dates, Brooks's 1975 date and OS/360 origin)
 * independently verified via WebSearch before writing each "why" line.
 *
 * No new Must Read flag this round — all three explicitly checked
 * against the S-tier bar and held at Classic. The Lord of the Rings came
 * closest (its cultural weight arguably exceeds Foundation's, which also
 * sits at Classic) but the calibration precedent Foundation itself set on
 * 2026-07-29 — "sits at the same tier as its own genre-mates, none of
 * which has ever been promoted" — applies with equal force here, so it's
 * flagged rather than promoted unilaterally. Omeros and Mythical
 * Man-Month are each civilization/field-defining within their own
 * tradition, the tier Shahnameh and Ricardo already occupy, not a step
 * above.
 *
 * The Lord of the Rings is flagged, not promoted, as a new possible Must
 * Read candidate — first new flag since 2026-07-29's Rawls/Popper pair
 * (both since cleared). Reasoning: near-unmatched sales and cultural
 * saturation for a 70-year-old novel, and it's the direct rival
 * Foundation's own entry measures itself against — if that entry treats
 * losing to LOTR as the notable fact, LOTR's own claim is at least as
 * strong, not weaker.
 *
 * Verified: `npx tsc --noEmit` clean. Both vitest suites green
 * (`must-read.test.ts` 89/1 — confirms untouched; `classic.test.ts`
 * 239/3). Ran a normalized-fingerprint dedupe/collision check (NFD-strip-
 * accents, grouped by key rather than raw frequency) across title and
 * every `aka` on both files: 0 internal collisions on either list, 0
 * cross-list collisions, all 3 new titles confirmed present in Classic
 * and absent from Must Read.
 *
 * Classic count: 236 → 239 (166 fiction + 73 non-fiction). Left
 * uncommitted, per the standard default for fully autonomous runs with
 * no live user turn.
 *
 * 2026-07-31 (daily curation pass, scheduled-task fire, fully autonomous):
 * confirmed both canon files matched the 2026-07-30 baseline exactly
 * (Classic 239: 166 fiction + 73 non-fiction; Must Read 89, untouched)
 * before starting — git was in sync with origin (20667a7), no stacked
 * backlog this round. Actually invoked moser-the-librarian. Grepped a
 * fresh candidate pool for anthropology/sociology methodology beyond the
 * macro-theoretical voices already present (Weber, Durkheim, Veblen,
 * Lévi-Strauss, Saussure) and for two national-literature gaps (Chile,
 * Indonesia) — all four genuine zero-hits confirmed via grep before
 * adding anything.
 *
 * Added 4 entries (239 → 243: 168 fiction + 75 non-fiction), two
 * independent pairs rather than one theme. Non-fiction: Bronisław
 * Malinowski's Argonauts of the Western Pacific (1922) — placed directly
 * before Tristes Tropiques, whose Amazon fieldwork it precedes by three
 * decades; anthropology's fieldwork/participant-observation founding
 * text sitting right next to structuralism's own founding text, the
 * discipline's two originating instincts back to back the same way
 * Popper sits beside Kuhn. Erving Goffman's The Presentation of Self in
 * Everyday Life (1959) — placed directly after Durkheim's Suicide,
 * sociology's micro/dramaturgical counterweight to Durkheim's macro
 * social facts, symbolic interactionism's founding text and a real gap
 * given the sociology cluster was otherwise entirely structural-
 * functionalist. Fiction: Pablo Neruda's Twenty Love Poems and a Song of
 * Despair (1924) — placed beside Eliot and Walcott in the modern-poetry
 * Nobel cluster, and closes Chile's total absence from either list.
 * Pramoedya Ananta Toer's This Earth of Mankind (1980) — placed beside
 * Season of Migration to the North in the postcolonial-trauma cluster,
 * closing Indonesia and Southeast Asia's total absence (distinct from
 * the Philippines' Noli Me Tángere, since promoted to Must Read); composed
 * from memory during the author's imprisonment on Buru island since he
 * was denied writing materials. All four facts (Malinowski's 1922
 * publication and Trobriand fieldwork, Goffman's 1956 Scotland/1959 US
 * publication, Neruda's 1924 publication at age nineteen and 1971 Nobel,
 * Pramoedya's 1980 publication and Buru imprisonment) independently
 * verified via WebSearch before writing each "why" line.
 *
 * No new Must Read flag this round — all four explicitly checked and
 * held at Classic. Each is civilization/field-defining within its own
 * tradition or discipline (the tier Malinowski and Lévi-Strauss already
 * share, the tier Neruda's own countryman-adjacent poets Sappho/Whitman/
 * Eliot/Walcott occupy), not a step above. The Lord of the Rings flag
 * from 2026-07-30 remains the sole open Must Read candidate, unaffected
 * by this round.
 *
 * Verified: `npx tsc --noEmit` clean. Both vitest suites green
 * (`must-read.test.ts` 89/1 — confirms untouched; `classic.test.ts`
 * 243/3). Ran a normalized-fingerprint dedupe/collision check (NFD-strip-
 * accents, grouped by key rather than raw frequency) across title and
 * every `aka` on both files: 0 internal collisions on either list, 0
 * cross-list collisions, all 4 new titles confirmed present in Classic
 * and absent from Must Read.
 *
 * Classic count: 239 → 243 (168 fiction + 75 non-fiction). Left
 * uncommitted, per the standard default for fully autonomous runs with
 * no live user turn.
 *
 * 2026-07-31, second pass same day (round 30, scheduled-task fire, fully
 * autonomous): grepped for a fresh batch of plausible gaps beyond round
 * 29's — confirmed genuine zero-hits for Canetti, Musil-adjacent Central
 * European modernists (Musil himself already present, but no Schulz),
 * Perec/Queneau (French postwar experimental fiction), and Poland's
 * total absence from fiction specifically (Malinowski, added round 29,
 * is anthropology, not fiction).
 *
 * Added 3 entries (243 → 246: 169 fiction + 77 non-fiction). Fiction:
 * Bruno Schulz's The Street of Crocodiles (1934, aka Cinnamon Shops) —
 * placed directly after Musil's The Man Without Qualities in the
 * fin-de-empire Central European modernist cluster; closes Poland's
 * total fiction absence. Georges Perec's Life A User's Manual (1978) —
 * placed directly after Calvino's Invisible Cities, Oulipo's
 * combinatorial-constraint game turned into the format's own
 * masterpiece and the 1978 Prix Médicis winner. Non-fiction: Elias
 * Canetti's Crowds and Power (1960, aka Masse und Macht) — placed
 * directly after Arendt's Origins of Totalitarianism, the 1981 Nobel
 * committee's stated reason for the prize and mass-psychology's
 * counterpart to Arendt's institutional history of the same era. All
 * three facts (Schulz's 1934 Polish publication and 1942 murder in the
 * Drohobycz ghetto, Perec's 1978 Prix Médicis and Oulipo membership,
 * Canetti's 1960 publication and 1981 Nobel) independently verified via
 * WebSearch before writing each "why" line.
 *
 * No new Must Read flags this round — all three explicitly checked and
 * held at Classic (dense, civilization-defining within their own
 * tradition, but narrower in reach than the Must Read bar). LOTR from
 * 2026-07-27 remains the sole open Must Read candidate.
 *
 * Verified: `npx tsc --noEmit` clean. Both vitest suites green
 * (`must-read.test.ts` 89/1 — confirms untouched; `classic.test.ts`
 * 246/3). Ran the same normalized-fingerprint dedupe/collision check
 * across title and every `aka` on both files: 0 internal collisions on
 * either list, 0 cross-list collisions, all 3 new titles confirmed
 * present in Classic and absent from Must Read.
 *
 * Classic count: 243 → 246 (169 fiction + 77 non-fiction).
 *
 * 2026-08-01 (daily curation pass, scheduled-task fire, fully autonomous):
 * confirmed both canon files matched the 2026-07-31 baseline exactly
 * (Classic 246: 169 fiction + 77 non-fiction; Must Read 89, untouched)
 * before starting — git was in sync with origin (9392bd1), no stacked
 * backlog this round. Actually invoked moser-the-librarian. Grepped a
 * fresh candidate pool — Mishima, Oe, Cortázar, Vargas Llosa, Allende,
 * Ngugi, Adichie, Mahfouz, Jelinek, Munro, Han Kang, Undset, Grass, Böll —
 * most already present (Cortázar/Hopscotch, Vargas Llosa/Feast of the
 * Goat, Mahfouz/Palace Walk, Undset/Kristin Lavransdatter, Grass/Tin
 * Drum, and — caught by the tilde in a follow-up grep — Ngũgĩ wa
 * Thiong'o's Petals of Blood, already present since an earlier round);
 * four genuine zero-hit gaps confirmed and closed.
 *
 * Added 4 titles (246 → 250, all fiction: 173 fiction + 77 non-fiction),
 * closing three independent gaps. Japan's postwar cluster (Kawabata in
 * Must Read; Sōseki, Tanizaki, Endō, Akutagawa, Murakami here) had never
 * included Mishima or Oe — its two other towering, mutually opposed
 * voices. Yukio Mishima's The Temple of the Golden Pavilion (1956) —
 * aestheticism pushed further than Kawabata or Tanizaki ever risked, and
 * grounded in a real 1950 arson at Kyoto's actual Kinkaku-ji; Kenzaburō
 * Ōe's A Personal Matter (1964) — the rawer, more directly autobiographical
 * postwar register, and the book behind Japan's second Nobel (1994),
 * placed directly after Mishima as its generational counterpoint. Isabel
 * Allende's The House of the Spirits (1982) closes Chile's total absence
 * from fiction prose specifically — Neruda's poetry (added 2026-07-31)
 * covers the country, but not the novel — placed beside García Márquez as
 * the Boom's most successful woman writer's direct, acknowledged answer to
 * One Hundred Years of Solitude. Heinrich Böll's Billiards at Half-Past
 * Nine (1959) closes German postwar fiction's one-voice problem: Grass's
 * Tin Drum, three lines up, had stood alone despite Böll's own Nobel
 * (1972, the first German laureate since Thomas Mann) — placed directly
 * beside Grass, a different register of the same reckoning, published the
 * same year. All four facts (Mishima's 1956 publication and the real 1950
 * Kinkaku-ji arson it dramatizes, Oe's 1964 publication and 1994 Nobel,
 * Allende's 1982 Barcelona publication, Böll's 1959 publication and 1972
 * Nobel) independently verified via WebSearch before writing each "why"
 * line.
 *
 * No new Must Read flag this round — all four explicitly checked and held
 * at Classic, each extending an already-represented national tradition
 * rather than founding a new one (the same bar that has kept Foundation,
 * Dune, and Neuromancer at Classic despite individual excellence). The
 * Lord of the Rings flag from 2026-07-30 remains the sole open Must Read
 * candidate, unaffected by this round.
 *
 * Classic count: 246 → 250 (173 fiction + 77 non-fiction). Left
 * uncommitted, per the standard default for fully autonomous runs with no
 * live user turn.
 */

/*
 * 2026-08-02 (daily curation pass, scheduled-task fire, fully autonomous,
 * round 34): confirmed both canon files matched the round-32 baseline
 * exactly (Classic 250: 173 fiction + 77 non-fiction; Must Read 89,
 * untouched) before starting — git in sync with origin (211a7c2). Note:
 * an earlier round 33 same day added Burke/Bourdieu/Chomsky/Friedman but
 * was left uncommitted in a session whose sandbox no longer exists, so
 * that work was unrecoverable and is redone here from scratch (same four
 * titles, independently re-verified) rather than assumed lost silently.
 *
 * Fiction (173) has pulled well ahead of non-fiction (77) across rounds
 * 27-32 — every one of those rounds added fiction only — so this round
 * deliberately searched non-fiction gaps instead. Grepped the full
 * existing non-fiction list first to confirm no overlap before adding.
 *
 * Added 4 titles, all non-fiction (250 → 254: 173 fiction + 81
 * non-fiction):
 * - Edmund Burke's Reflections on the Revolution in France (Nov 1790) —
 *   modern conservative political thought's founding text; political
 *   philosophy here had Hobbes/Locke/Rousseau/Mill's liberal-and-radical
 *   lineage but nothing arguing back against it.
 * - Pierre Bourdieu's Distinction (1979, La Distinction) — taste as class
 *   position, backed by real survey data; the empirical continuation of
 *   Veblen's conspicuous consumption above, closing a 20th-century French
 *   sociology gap next to Durkheim/Lévi-Strauss/Foucault.
 * - Noam Chomsky's Syntactic Structures (1957) — reset linguistics into a
 *   formal/cognitive science and helped trigger the broader cognitive
 *   revolution; the generative counterpart to Saussure's structuralism.
 * - Milton Friedman's Capitalism and Freedom (1962) — the Chicago
 *   School's founding manifesto; economics' missing third leg beside
 *   Keynes and Hayek, both already present.
 *
 * All four facts (Burke's Nov 1790 publication, Bourdieu's 1979 French
 * publication, Chomsky's Feb 1957 publication and its role in
 * linguistics' cognitive turn, Friedman's 1962 University of Chicago
 * Press publication) independently verified via WebSearch before writing
 * each "why" line.
 *
 * No new Must Read flag this round — all four are field-founding but
 * judged "essential second-tier text for their own sub-field" rather
 * than the higher bar recent Must Read promotions (Kant, Rawls, Popper)
 * cleared. The Lord of the Rings flag (2026-07-30) remains the sole open
 * Must Read candidate, unaffected.
 *
 * Classic count: 250 → 254 (173 fiction + 81 non-fiction). Committed and
 * pushed this round (unlike round 33) specifically to avoid a repeat of
 * the same-day data loss.
 */

/*
 * 2026-08-03 (daily curation pass, scheduled-task fire, fully autonomous,
 * round 35): confirmed both canon files matched the round-34 baseline
 * exactly (Classic 254: 173 fiction + 81 non-fiction; Must Read 89,
 * untouched) before starting. Local sandbox git was stale (HEAD stuck at
 * round-32's 211a7c2, two commits behind origin) with a redundant
 * uncommitted duplicate of round-34's own diff sitting in the working
 * tree (same four titles, re-typed with different wording) — reconciled
 * by re-checking-out classic.ts from origin/main first, confirming zero
 * duplicate CLASSIC entries resulted, before starting this round's work.
 *
 * Fiction (173) has been flat across rounds 27-34 while non-fiction (77 →
 * 81) absorbed the last two rounds' additions — so this round added two
 * of each to start narrowing that gap back, not out of quota but because
 * both sides had genuine, independently-verified gaps:
 *
 * - José Saramago's Blindness (1995) — an unexplained epidemic strips a
 *   city of sight and civilization collapses within days; the 1998 Nobel
 *   committee's own centerpiece citation, and the Portuguese-language
 *   canon's total absence from this list until now (Machado de Assis
 *   covers Brazil, nothing covered Portugal itself).
 * - Doris Lessing's The Golden Notebook (1962) — a writer's fractured
 *   notebooks (black, red, yellow, blue) kept separate because no single
 *   one could hold a woman's whole life at once; the 2007 Nobel citation's
 *   named work, and second-wave feminism's foundational novel, sitting
 *   beside Friedan's Feminine Mystique (already here) as its fictional
 *   counterpart.
 * - Robert Nozick's Anarchy, State, and Utopia (1974) — written explicitly
 *   against Rawls's A Theory of Justice (1971, already Must Read), arguing
 *   any state larger than a night-watchman violates individual rights;
 *   the 1975 National Book Award winner, and the exact rebuttal essay this
 *   list's Rawls entry has been missing since it was added.
 * - Joseph Schumpeter's Capitalism, Socialism and Democracy (1942) — coined
 *   "creative destruction," capitalism reframed as a process of continual
 *   entrepreneurial upheaval rather than a static equilibrium; economics'
 *   fourth leg now beside Keynes, Hayek, and Friedman, all already here,
 *   and the account of capitalism none of the other three actually gives.
 *
 * All four facts (Saramago's 1995 publication and 1998 Nobel citation,
 * Lessing's 1962 publication and 2007 Nobel citation, Nozick's 1974
 * publication as a direct answer to Rawls's 1971 book plus its 1975
 * National Book Award, Schumpeter's 1942 publication and the "creative
 * destruction" coinage) independently verified via WebSearch before
 * writing each "why" line.
 *
 * No new Must Read flag this round — Blindness and The Golden Notebook are
 * both Nobel-citation-anchored and excellent but sit closer to "the
 * essential novel for its own literary movement" than the higher
 * foundation-of-everything bar Must Read reserves; Nozick and Schumpeter
 * are the same "essential second-tier text for its sub-field" judgment
 * applied to Burke/Bourdieu/Chomsky/Friedman last round. The Lord of the
 * Rings flag (2026-07-30) remains the sole open Must Read candidate,
 * unaffected by this round.
 *
 * Classic count: 254 → 258 (175 fiction + 83 non-fiction). Committed and
 * pushed this round.
 */

/*
 * 2026-08-04 (daily curation pass, round 36): four titles closing four
 * separate gaps. Fiction: Sundiata: An Epic of Old Mali (the West African
 * oral-epic tradition had zero representation despite Gilgamesh, Beowulf,
 * the Shahnameh, and the Ramayana all being here) and The Poetic Edda
 * (Norse mythology's actual primary source — Njal's Saga, already
 * present, is the saga tradition, a different genre; the Edda is the
 * mythological wellspring behind it and a direct, documented source for
 * The Lord of the Rings). Non-fiction: The Theory of Moral Sentiments
 * (Adam Smith's own preferred book — the Wealth of Nations entry's
 * missing origin point, and the actual first appearance of "the invisible
 * hand") and Mencius (completes the Analects' dialectical counterpart in
 * Confucianism's Four Books; two thousand years of joint use, five
 * centuries as imperial-exam curriculum). All four facts (Niane's 1960
 * translation and thirty-year bestseller run, the Codex Regius/Völuspá/
 * Tolkien connection, Smith spending his final year revising Moral
 * Sentiments over Wealth of Nations, Mencius's role in the Four Books)
 * independently verified via WebSearch before writing each "why" line.
 *
 * No new Must Read flag this round — all four clear Classic comfortably
 * but none argue for S-tier the way the existing Must Read epics
 * (Gilgamesh's absence from Must Read entirely, notwithstanding) do not
 * either. The Lord of the Rings flag (2026-07-30) remains the sole open
 * Must Read candidate, unaffected.
 *
 * Classic count: 258 → 262 (177 fiction + 85 non-fiction).
 *
 * 2026-08-04 (daily curation pass, round 37): four titles closing four
 * more gaps. Non-fiction: The Spirit of the Laws (Montesquieu — the
 * single most direct intellectual source for the U.S. Constitution's
 * separation of powers) and Self-Reliance (Emerson — American
 * individualism's founding scripture, Walden's philosophical parent,
 * already here). Fiction: Miss Julie (Strindberg — Ibsen's naturalist
 * rival, this list's second play after A Doll's House moved to Must
 * Read) and Runaway (Munro — the short story's first-ever representation
 * on this list, via the writer the Nobel called its master).
 *
 * Classic count: 262 → 266 (172 fiction + 94 non-fiction).
 *
 * 2026-08-05 (daily curation pass, round 38): four titles closing four
 * more gaps, verified via WebSearch before writing. Fiction: Long Day's
 * Journey Into Night (O'Neill — the only American playwright ever
 * awarded the Nobel Prize in Literature, and modern American drama's
 * missing entry beside Miller and Williams, both already here) and The
 * Hour of the Star (Lispector — Brazilian fiction's second entry after
 * Machado de Assis, closing a hundred-year gap in that national
 * literature). Non-fiction: The Upanishads (Vedanta's actual source
 * text, one entry upstream of the Bhagavad Gita already here — the
 * Schopenhauer "solace of my life" line independently verified) and
 * Parallel Lives (Plutarch — ancient historiography's missing
 * biographical wing beside Herodotus, Thucydides, Tacitus, and Sima
 * Qian, all already here, and the direct, heavily-lifted-from source of
 * three Shakespeare Roman plays via Thomas North's 1579 translation).
 *
 * No Must Read flag this round. The Lord of the Rings flag (2026-07-30)
 * remains the sole open Must Read candidate, unaffected.
 *
 * Classic count: 266 → 270.
 *
 * 2026-08-05 (same day, SECOND independent scheduled-task fire — a race,
 * not a mistake): a concurrent session ran this same daily curation task
 * in parallel and, working from the pre-this-round baseline, added its
 * own four titles closing four more gaps: The Idiot (Dostoevsky's second
 * Classic entry, within the multi-entry-author precedent this header
 * already grants), In Praise of Folly (Erasmus) and Common Sense (Paine)
 * — both towering, wholly-absent influences in Christian-humanist satire
 * and revolutionary pamphleteering respectively — and Beyond Good and
 * Evil (Nietzsche's aphoristic manifesto, a year ahead of his existing
 * Must Read placement, On the Genealogy of Morals). Both sessions'
 * entries independently clear the merit bar and are mutually
 * non-overlapping (no duplicate titles/authors), so both are kept rather
 * than one being reverted. See [[novelviz-daily-canon-curation-round38-2026-08-05]]
 * for the full race writeup.
 *
 * Note on structure: recent daily rounds (36 onward) have appended new
 * entries at the end of this array regardless of the Fiction/Non-fiction
 * comment markers above, so those two markers no longer reliably bound
 * every entry of their stated type below them — a known, harmless
 * cosmetic drift (getClassic()/isClassic() don't depend on physical
 * position), not something this round attempted to re-sort.
 *
 * Classic count: 270 → 274 (both rounds combined).
 *
 * 2026-08-06 (daily curation pass, round 39): four titles, vetted against
 * moser-the-librarian's rubric, closing a poetry gap this list had somehow
 * left open despite otherwise-deep coverage: English Romanticism, American
 * lyric's other founder, and classical Chinese verse each sat at zero
 * representation, plus one physics companion pick. William Blake's Songs of
 * Innocence and of Experience (1789/1794, hand-engraved and hand-colored by
 * Blake himself) — English Romantic poetry's founding text, on a list that
 * otherwise jumps straight from Milton (Must Read) to Whitman (Must Read)
 * with nothing English in between. Emily Dickinson's Complete Poems
 * (fewer than a dozen of her ~1,800 poems published before her 1886 death;
 * first collected 1890) — American lyric's other founder, the private
 * counterweight to Whitman's public shout, oddly absent given Whitman's own
 * Must Read placement. Du Fu's Selected Poems — China's "Poet Sage," flagged
 * as a candidate on 2026-07-26 alongside Li Bai but never actually added;
 * closes classical Chinese verse's total absence despite this list's deep
 * classical-Chinese fiction (all Four Great Classical Novels) and philosophy
 * (Analects, Zhuangzi, Mencius) coverage. Einstein's Relativity: The Special
 * and General Theory (December 1916, his own popular exposition, no calculus
 * required) — physics' other founding text, placed as the companion Newton's
 * Principia never had. All four facts (Blake's 1789/1794 publication dates
 * and hand-printing method, Dickinson's ~1,800-poem count and 1890 first
 * collection, Du Fu's life dates and An Lushan Rebellion context, Einstein's
 * December 1916 publication) independently verified via WebSearch before
 * writing each "why" line. All four clear the Lindy/A-tier bar with room to
 * spare; none were close calls, and none rise to Must Read's "unmissable"
 * bar — no new promotion flag this round.
 *
 * Classic count: 274 → 278 (178 fiction + 100 non-fiction).
 *
 * 2026-08-07 (daily curation pass, round 40): five titles, vetted against
 * moser-the-librarian's rubric, closing four more world-poetry gaps in one
 * sweep plus one independent non-fiction pick. Grepped a fresh candidate
 * pool first — "Li Bai"/"Li Po", "Khayyam", "Rubaiyat", "Hughes", "Lorca",
 * "Avicenna", "Ibn Sina", "Canon of Medicine" — across both lists; all
 * confirmed genuine zero-hits (Li Bai appears only in this file's own prose,
 * flagged as a candidate on 2026-07-26 and again in round 39's header, but
 * never actually added as an entry until now). Li Bai's Selected Poems
 * closes that overdue gap directly: Du Fu's own entry (added round 39)
 * names Li Bai as his lifelong friend and the only other Tang poet read as
 * closely — an odd omission to leave standing a full round later. The
 * Rubaiyat of Omar Khayyam (tr. Edward FitzGerald, 1859) closes a second
 * Persian-poetry gap this list's existing coverage (the Shahnameh's
 * dynastic epic, Rumi's Sufi devotional Masnavi) never touched — the
 * skeptical, carpe-diem quatrain tradition, plus one of English poetry's
 * strangest afterlives: FitzGerald's translation sold as penny clearance
 * stock at first, then became so admired by the Pre-Raphaelites that
 * dedicated "Omar Khayyam Clubs" were founding across the English-speaking
 * world by the 1880s. Langston Hughes's The Weary Blues (1926, Alfred A.
 * Knopf) closes African American poetry's total absence from a list that
 * already carries Du Bois, Baldwin, and Morrison in prose — blues and jazz
 * rhythm braided into verse for the first time, written when Hughes was
 * twenty-four and still the way most readers first meet the Harlem
 * Renaissance in poetry. Federico García Lorca's Gypsy Ballads (Romancero
 * Gitano, composed 1924-1927, published 1928) closes Spanish-language
 * poetry's total absence — eighteen ballads in traditional eight-syllable
 * meter that made Lorca Spain's most-read twentieth-century poet almost
 * overnight, and the book he was already famous for when Francoist rebels
 * shot him at the outset of the Civil War in 1936. Non-fiction: Avicenna's
 * The Canon of Medicine (completed 1025) closes a gap in Islamic-world
 * non-fiction distinct from the two entries already here (Ibn Khaldun's
 * historical sociology in Must Read, Rumi's mysticism above) — medicine and
 * natural science specifically, and about as Lindy-proven as a book can get:
 * the standard medical textbook in European universities until the
 * mid-seventeenth century and in parts of the Middle East into the
 * nineteenth, reissued sixteen times in the last thirty years of the
 * fifteenth century alone. All five facts (Li Bai's dates and ~1,100
 * surviving poems, FitzGerald's 1859 first edition and its slow rise via
 * the Pre-Raphaelites, Hughes's 1926 Knopf publication at age twenty-four,
 * Lorca's 1924-1927 composition window and 1936 death, Avicenna's 1025
 * completion date and its textbook lifespan) independently verified via
 * WebSearch rather than trusted from recall. All five clear the Lindy/
 * A-tier bar with room to spare; none rise to Must Read's "unmissable" bar
 * — no new promotion flag this round. The Lord of the Rings flag
 * (2026-07-30) remains the sole open Must Read candidate, unaffected.
 *
 * Classic count: 278 → 283 (182 fiction + 101 non-fiction).
 *
 * 2026-08-08 (daily curation pass, round 41): five titles closing five
 * distinct, substantial gaps rather than another single-theme sweep.
 * Grepped a fresh candidate pool first — "Antigone", "Quran", "Koran",
 * "Baudelaire", "Rilke", "Galileo", "Sophocles" (present only via its own
 * Must Read Oedipus Rex entry) — across both lists; all confirmed genuine
 * zero-hits, including "Bible"/"Torah"/"New Testament" (mentioned only as
 * a comparison point in two existing entries' prose, never as a title of
 * their own). The Quran was the largest single gap found: standardized
 * into a single canonical text under Caliph Uthman around 650 CE, with
 * all divergent copies ordered destroyed, and read today by well over a
 * billion people — this list already had room for the Bhagavad Gita, Tao
 * Te Ching, Analects, and the Upanishads, so the Quran's total absence
 * looked more like an oversight than a judgment call. Flagged in
 * must-read.ts as a possible Must Read candidate given its comparable
 * world-historical weight to those texts (Bhagavad Gita and the Upanishads
 * are themselves only Classic, so this isn't a clean slot either way) —
 * not promoted here, per the standing default that S-tier calls are
 * Stefano's alone. Antigone gives Sophocles a second, independently
 * merited entry beside Oedipus Rex — a different play, a different
 * conflict (family duty against the state, first performed around 441
 * BC), and the exact text Hegel's Phenomenology of Spirit, already here,
 * builds one of its most celebrated readings on. Les Fleurs du Mal (1857)
 * closes French Symbolist poetry's total absence: prosecuted for
 * obscenity within a month of publication (six poems banned by a Paris
 * court, not legally restored until 1949), and the book Rimbaud and
 * Verlaine both credited by name as the direct root T.S. Eliot's own
 * Waste Land, already here, grew from. Duino Elegies closes German-
 * language lyric poetry's gap — this list's German representation was
 * philosophy (Kant, Nietzsche, Heidegger, and more) and the novel
 * (Buddenbrooks, The Magic Mountain) until now, with no poetry at all;
 * ten years in the writing, stalled through the trauma of the First World
 * War, finished in a three-week burst in 1922. Dialogue Concerning the
 * Two Chief World Systems (1632) pairs with Newton's Principia, already
 * here, as the scientific revolution's other founding text — and the
 * book that put Galileo before the Inquisition and forced his public
 * recantation the following year. All five facts (the Uthmanic
 * standardization date, Antigone's performance date and its role in
 * Hegel, the 1857 trial and 1949 restoration, Duino Elegies' 1912-1922
 * composition window, the 1632 publication and 1633 trial) independently
 * verified via WebSearch rather than trusted from recall. All five clear
 * the Lindy/A-tier bar with room to spare; none rise to Must Read's
 * "unmissable" bar on their own — no new promotion flag this round beyond
 * the Quran note above.
 *
 * Classic count: 283 → 288 (185 fiction + 103 non-fiction).
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
  { title: "Sappho: Poems and Fragments", author: "Sappho", why: "Nine scrolls of songs written for the lyre, reduced by two thousand years to scraps and one complete poem — still the reason 'lyric' means what it means.", aka: ["The Poems of Sappho", "Sappho"] },
  { title: "The Waste Land", author: "T.S. Eliot", why: "434 lines, five languages, a dedication to Ezra Pound, and modern poetry rewired in one go; the fragmented urban despair of 1922 still reads like it was written for right now.", aka: ["Waste Land"] },
  { title: "Omeros", author: "Derek Walcott", why: "The Iliad and Odyssey relocated to a Caribbean fishing village, spoken by a fisherman named Achille; the book-length poem behind the 1992 Nobel, and the epic tradition's answer to a gap this list's Caribbean prose (Wide Sargasso Sea, A House for Mr Biswas) never closed on the poetry side." },
  { title: "Twenty Love Poems and a Song of Despair", author: "Pablo Neruda", why: "Written at nineteen and never out of print since 1924; the book that made Neruda famous before he turned twenty and Chile's total absence from either list, closed with the same modern-poetry Nobel cluster as Eliot and Walcott.", aka: ["Veinte poemas de amor y una canción desesperada"] },
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
  { title: "The Adventures of Sherlock Holmes", author: "Arthur Conan Doyle", why: "The consulting detective who made observation itself the plot; every fictional genius-investigator since is working from his method." },
  { title: "The Time Machine", author: "H.G. Wells", why: "Coined the phrase and the device in one stroke; Verne imagined the machines we'd build, Wells imagined what they'd cost us." },
  { title: "Tess of the d'Urbervilles", author: "Thomas Hardy", why: "Fate as a rigged system; Hardy's angriest argument against the moral order." },
  { title: "The Cherry Orchard", author: "Anton Chekhov", why: "An estate sold out from under a family too busy talking to notice; comedy and tragedy finally admit they're the same thing." },
  { title: "A Streetcar Named Desire", author: "Tennessee Williams", why: "A faded Southern belle's delusions collide with her sister's brutal husband in one cramped New Orleans flat; American theater's rawest study of desire and cruelty, ranked third in the Royal National Theatre's 1998 poll of the century's most significant English-language plays." },
  { title: "Death of a Salesman", author: "Arthur Miller", why: "A traveling salesman's whole life collapses under myths about success he never once examined; 'attention must be paid' became the line every American tragedy since has had to answer, and that same 1998 National Theatre poll placed it second only to Godot." },
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
  { title: "The Street of Crocodiles", author: "Bruno Schulz", why: "A Galician backwater town's shabby cinnamon-colored shops rewritten as private myth, the father's slow metamorphosis into a cockroach then a condor rendered with total sincerity; a whole cosmology built from one small Polish town by a provincial drawing teacher, murdered by a Gestapo officer in the Drohobycz ghetto in 1942 with a second novel-in-progress never recovered. Poland's total absence from this list, closed.", aka: ["Cinnamon Shops", "Sklepy cynamonowe"] },
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
  { title: "Billiards at Half-Past Nine", author: "Heinrich Böll", why: "Three generations measure their lives against a Cologne abbey their patriarch built and his own son later helped demolish; German conscience worked through in prose published the same year as Grass's Tin Drum above, and the book behind the second German Nobel since Thomas Mann (1972).", aka: ["Billard um halb zehn"] },
  { title: "Invisible Cities", author: "Italo Calvino", why: "Marco Polo describes cities that may not exist; fiction as pure architecture of ideas." },
  { title: "Life A User's Manual", author: "Georges Perec", why: "Ninety-nine chapters tour a Paris apartment building room by room in a knight's-tour path across the floor plan, laying every resident's whole life bare at once; Oulipo's combinatorial-constraint method turned outward into the format's own masterpiece, and the 1978 Prix Médicis winner critics placed beside Ulysses. Belongs directly beside Calvino's own game-as-architecture novel above.", aka: ["La Vie mode d'emploi", "Life: A User's Manual"] },
  { title: "The Name of the Rose", author: "Umberto Eco", why: "A murder mystery inside a medieval monastery, and a treatise on semiotics in disguise." },
  { title: "Independent People", author: "Halldór Laxness", why: "An Icelandic sheep farmer's stubborn, doomed independence; Nobel-caliber bleak comedy." },
  { title: "Voss", author: "Patrick White", why: "An explorer vanishes into the Australian interior while a woman in Sydney lives the expedition psychically; the novel behind Australia's only Nobel." },
  { title: "Hunger", author: "Knut Hamsun", why: "A starving writer's mind unraveling on the page; modernist interiority before modernism had a name." },
  { title: "Wide Sargasso Sea", author: "Jean Rhys", why: "Jane Eyre's 'madwoman in the attic' given her own voice and her own colonial history." },
  { title: "A House for Mr Biswas", author: "V.S. Naipaul", why: "One man's lifelong scrap for a house — and a self — of his own; the Trinidadian novel that won Naipaul his Nobel." },
  { title: "The Unbearable Lightness of Being", author: "Milan Kundera", why: "Love and politics under Soviet occupation, filtered through Nietzsche's eternal return." },
  { title: "Austerlitz", author: "W.G. Sebald", why: "Memory, architecture, and the Holocaust's aftershocks, told in single unbroken paragraphs." },
  { title: "The Remains of the Day", author: "Kazuo Ishiguro", why: "An English butler's decades of loyal service, recounted in a voice too composed to admit what it cost him; restraint used as the instrument of its own quiet devastation." },
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
  { title: "Foundation", author: "Isaac Asimov", why: "Psychohistory predicts an empire's fall centuries out and tries to shorten the dark age after it; the Golden Age precursor this list's New Wave and cyberpunk descendants (Dune, Neuromancer, Left Hand of Darkness) all had to answer to, and the only book ever to beat The Lord of the Rings for a Hugo (Best All-Time Series, 1966)." },
  { title: "The Lord of the Rings", author: "J.R.R. Tolkien", why: "Middle-earth invented the modern fantasy genre almost single-handedly — every quest, every map printed inside the cover, answers to this one; published in three volumes across 1954-55, sold past 150 million copies since, and the very book Foundation's own entry above name-checks as the one it beat for that 1966 Hugo.", aka: ["Lord of the Rings", "LOTR", "The Fellowship of the Ring", "The Two Towers", "The Return of the King"] },
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
  { title: "The House of the Spirits", author: "Isabel Allende", why: "Four generations of the Trueba family, ghosts included, across a thinly-veiled Chile sliding toward Pinochet's coup; written as a letter to a dying grandfather, and the Boom's most direct answer — from its most successful woman writer — to One Hundred Years of Solitude a few lines up.", aka: ["La Casa de los Espíritus"] },
  { title: "Kristin Lavransdatter", author: "Sigrid Undset", why: "Medieval Norway's most complete interior life; a woman's whole moral biography, Nobel-crowned." },
  { title: "The Palm-Wine Drinkard", author: "Amos Tutuola", why: "Yoruba folklore fed straight into the novel form; magical realism before the term existed." },
  { title: "Season of Migration to the North", author: "Tayeb Salih", why: "Colonial trauma reversed — an African seducer loose in postwar London." },
  { title: "This Earth of Mankind", author: "Pramoedya Ananta Toer", why: "Composed word for word in the author's memory during fourteen years of political imprisonment on Buru island, then recited nightly to fellow inmates before ever reaching paper; Dutch colonial Java's caste of blood laid bare through one mixed-race schoolboy, and Indonesia's total absence from either list, closed.", aka: ["Bumi Manusia"] },
  { title: "Cry, the Beloved Country", author: "Alan Paton", why: "Apartheid-era South Africa's moral case made through one father's search for his son." },
  { title: "July's People", author: "Nadine Gordimer", why: "A white family's roles inverted overnight; apartheid's collapse imagined from inside a farmhouse." },
  { title: "Petals of Blood", author: "Ngũgĩ wa Thiong'o", why: "Independence's broken promises, traced through four lives in a betrayed Kenyan town." },
  { title: "Death and the King's Horseman", author: "Wole Soyinka", why: "A colonial officer stops a Yoruba horseman's ritual suicide and breaks a cosmology he never understood; the first African Nobel laureate's most performed play." },
  { title: "Diary of a Madman and Other Stories", author: "Lu Xun", why: "A paranoid narrator becomes convinced everyone around him is secretly a cannibal; published in vernacular Chinese in 1918, the story credited with inventing modern Chinese literature by breaking, for the first time, from three thousand years of classical written Chinese.", aka: ["A Madman's Diary", "Diary of a Madman", "Diary of a Madman and Other Stories by Lu Xun"] },
  { title: "Red Sorghum", author: "Mo Yan", why: "Three generations of a Shandong family through war and revolution, Mao-era history broken open by ghosts, sorghum wine, and animal transformation; the 1986 breakthrough behind China's first Nobel Prize in Literature awarded to a citizen still living in the country, in 2012.", aka: ["Red Sorghum Clan", "Hong Gaoliang Jiazu"] },
  { title: "The Temple of the Golden Pavilion", author: "Yukio Mishima", why: "A stuttering acolyte grows so obsessed with a temple's beauty he burns it down rather than watch it fade; postwar Japan's other towering voice, aestheticism pushed to the edge Kawabata and Tanizaki never went near.", aka: ["Kinkakuji"] },
  { title: "A Personal Matter", author: "Kenzaburō Ōe", why: "A young father recoils from, then chooses, his brain-damaged newborn son — Oe's own life turned into fiction almost in real time; Japan's second Nobel laureate (1994), and a rawer postwar register than Mishima's aestheticism just above.", aka: ["Kojinteki na Taiken"] },
  { title: "Kokoro", author: "Natsume Sōseki", why: "Isolation and guilt in Meiji Japan; a friendship's quiet, devastating confession." },
  { title: "The Wind-Up Bird Chronicle", author: "Haruki Murakami", why: "A missing cat unspools into wells, wartime Manchuria, and Japan's buried history." },
  { title: "Silence", author: "Shūsaku Endō", why: "A missionary's faith tested by torture and God's total silence; conviction under real pressure." },
  { title: "The Makioka Sisters", author: "Jun'ichirō Tanizaki", why: "Four sisters, one marriage crisis at a time, as old Japan gives way to the new." },
  { title: "Rashomon and Other Stories", author: "Ryūnosuke Akutagawa", why: "The same crime, four irreconcilable truths; the story that gave 'Rashomon effect' its name.", aka: ["Rashomon"] },
  { title: "Palace Walk", author: "Naguib Mahfouz", why: "A Cairo patriarch's household, opening the trilogy that won the Arab world's first Nobel." },
  { title: "My Name Is Red", author: "Orhan Pamuk", why: "A murdered miniaturist's case narrated in turn by killer, corpse, and the color red itself; Istanbul's East-West argument staged as a sixteenth-century whodunit.", aka: ["Benim Adım Kırmızı"] },
  { title: "Only Yesterday", author: "S.Y. Agnon", why: "An idealist immigrates to build Zion and gets shadowed by a dog everyone mistakes for rabid; modern Hebrew fiction's founding epic, Nobel-crowned.", aka: ["Tmol Shilshom"] },
  { title: "Gimpel the Fool and Other Stories", author: "Isaac Bashevis Singer", why: "A village baker mocked and cuckolded by everyone chooses faith over revenge anyway; Saul Bellow's own translation of the title story introduced English readers to Yiddish fiction's future Nobel laureate.", aka: ["Gimpel the Fool"] },
  { title: "The God of Small Things", author: "Arundhati Roy", why: "Forbidden love and caste violence in Kerala, told in prose that bends time and syntax." },
  { title: "A Suitable Boy", author: "Vikram Seth", why: "Post-independence India's marriage plot, stretched to thirteen hundred pages without losing momentum." },
  { title: "Untouchable", author: "Mulk Raj Anand", why: "A single day in a Dalit sweeper's life; caste injustice named early and directly." },
  { title: "House Made of Dawn", author: "N. Scott Momaday", why: "A Kiowa war veteran comes home unable to stand fully in either world he's now caught between; the first Pulitzer Prize for Fiction ever awarded to a Native American writer, and the book that opened the door for the Native American Renaissance." },
  { title: "Lucky Jim", author: "Kingsley Amis", why: "The campus novel's founding comedy; academic phoniness skewered from the inside." },
  { title: "Lord of the Flies", author: "William Golding", why: "Schoolboys revert to savagery without adults watching; civilization's thinness, tested and found wanting." },

  // Round 53 (2026-08-18): five picks closing five independent gaps. The
  // Tragical History of Doctor Faustus closes a real hole in this list's
  // drama cluster: Goethe's Faust is already here, but nothing represented
  // the version that came two centuries earlier and gave the legend its
  // first great stage treatment — Marlowe dramatizing the German Faustbuch
  // (by way of its 1592 English translation) just months before his own
  // death, in blank verse that helped set the template Shakespeare wrote
  // in. The Adventures of Pinocchio closes children's literature's total
  // absence from this list — Grimms' Fairy Tales (round 52) is a folklore
  // collection, not a single authored children's novel, and nothing else
  // on either list represents the form at all, despite Pinocchio's status
  // as one of the most translated books ever written. All five facts
  // (Doctor Faustus's A-text publication in 1604 and posthumous B-text in
  // 1616, three years after Marlowe's 1593 death, and its 1592 English
  // source; Pinocchio's 1881-1883 serialization in Giornale per i bambini
  // under the title "Storia di un burattino" and 1883 first book
  // publication) independently verified via WebSearch, continuing the
  // practice standing since round 45.
  { title: "The Tragical History of Doctor Faustus", author: "Christopher Marlowe", why: "Dramatized from the German Faustbuch by way of its 1592 English translation, written in the last months before Marlowe's own death in a 1593 tavern brawl, and published posthumously — the A-text in 1604, a longer B-text in 1616 — this is the Faust legend's first great stage treatment, two centuries before Goethe's Faust, already here. Blank verse pushed toward its Elizabethan limit, and a direct model for the tragic form Shakespeare inherited.", aka: ["Doctor Faustus", "The Tragical History of the Life and Death of Doctor Faustus"] },
  { title: "The Adventures of Pinocchio", author: "Carlo Collodi", why: "Serialized in installments from 1881 as \"Storia di un burattino\" in the Giornale per i bambini — a wooden puppet's nose growing with every lie — and originally meant to end with Pinocchio hanged for his misbehavior partway through; reader demand pushed Collodi to keep going, and the completed novel appeared in book form in 1883. Since translated into more languages than almost any book outside religious scripture. Closes children's literature's total absence from both lists — Grimms' Fairy Tales (round 52) is a folklore collection, not a single authored children's novel, and nothing else here represents the form.", aka: ["Le avventure di Pinocchio", "Pinocchio", "The Story of a Puppet"] },

  // ── Non-fiction ────────────────────────────────────────────────────────
  { title: "The History of the Peloponnesian War", author: "Thucydides", why: "Power politics analyzed without myth or piety; the realist tradition's founding text." },
  { title: "The Annals", author: "Tacitus", why: "Rome's emperors dissected by a senator who trusted no one's motives, least of all the ones in power; history written as autopsy.", aka: ["Annals", "The Annals of Imperial Rome"] },
  { title: "Records of the Grand Historian", author: "Sima Qian", why: "Chose castration over death specifically to live long enough to finish it; built the annals-and-biographies template every official Chinese history would follow for the next two thousand years.", aka: ["Shiji", "The Grand Scribe's Records"] },
  { title: "Nicomachean Ethics", author: "Aristotle", why: "Virtue as a habit, not a rule; still the sturdiest framework for a good life." },
  { title: "Symposium", author: "Plato", why: "A drinking party's speeches on love, ascending from bodies to the eternal Forms." },
  { title: "Elements", author: "Euclid", why: "Five self-evident postulates build an entire geometry from scratch; the axiomatic method's founding demonstration, unrivaled as a textbook for two thousand years.", aka: ["Euclid's Elements", "The Elements", "Stoicheia"] },
  { title: "The Principia", author: "Isaac Newton", why: "Three laws of motion and one equation for gravity, proved in Euclid's own geometric style; arguably the single most consequential book science has ever produced.", aka: ["Principia Mathematica", "Philosophiae Naturalis Principia Mathematica", "Mathematical Principles of Natural Philosophy", "Newton's Principia"] },
  { title: "On the Nature of Things", author: "Lucretius", why: "Atomism, mortality, and a universe without gods running it, argued in verse two thousand years before physics caught up.", aka: ["De Rerum Natura", "The Nature of Things"] },
  { title: "The Enchiridion", author: "Epictetus", why: "A former slave's teaching, compiled from memory by a student decades after his death: control what's yours — judgment, desire, will — and let go of everything else without complaint. Stoicism's other extreme from Marcus Aurelius's private notebook (Must Read) — this one was taught aloud, to anyone who'd listen.", aka: ["Enchiridion", "The Handbook", "The Manual", "Encheiridion"] },
  { title: "Letters from a Stoic", author: "Seneca", why: "A hundred and twenty-four letters written in the last two years of a life spent as Nero's tutor and advisor; Stoicism as a practical, elegant instruction manual for dying well while still very much alive.", aka: ["Epistulae Morales ad Lucilium", "Letters to Lucilius", "Moral Letters to Lucilius"] },
  { title: "Confessions", author: "Saint Augustine", why: "The first real autobiography; interiority and guilt examined before either had a name.", aka: ["The Confessions"] },
  { title: "The Consolation of Philosophy", author: "Boethius", why: "Written in a prison cell awaiting execution; philosophy's argument against fortune's cruelty." },
  { title: "Summa Theologica", author: "Thomas Aquinas", why: "Six hundred-plus questions, each argued through the losing side's best case first; Aristotle fused with Christian doctrine into a system so complete the Church made it its own standard for the next seven hundred years.", aka: ["Summa Theologiae"] },
  { title: "The Travels of Marco Polo", author: "Marco Polo", why: "Dictated to a fellow prisoner in a Genoese jail cell; a Venetian merchant's account of Kublai Khan's court became Europe's window onto Asia, and stayed the reference point for two centuries of explorers after him.", aka: ["The Book of the Marvels of the World", "Il Milione", "The Travels of Marco Polo, Complete"] },
  { title: "The Rihla", author: "Ibn Battuta", why: "Twenty-nine years crossing the length of the Islamic world, Morocco to China, dictated from memory to a scribe on his return; the richest eyewitness account of the fourteenth-century world that survives.", aka: ["Rihla", "The Travels of Ibn Battuta", "A Gift to Those Who Contemplate the Wonders of Cities and the Marvels of Traveling"] },
  { title: "The Narrow Road to the Deep North", author: "Matsuo Bashō", why: "A poet walks a thousand miles through northern Japan on foot, weighing haiku against prose the whole way; the haibun form's masterpiece, and still the reason Bashō is Japan's most translated poet.", aka: ["Oku no Hosomichi", "Narrow Road to the Interior", "The Narrow Road to Oku"] },
  { title: "Leviathan", author: "Thomas Hobbes", why: "Life without government as 'nasty, brutish, and short' — the case for the state, unsentimental." },
  { title: "Ethics", author: "Baruch Spinoza", why: "God and Nature fused into one single substance, proved proposition by proposition in Euclid's own geometric form; too dangerous to publish while Spinoza was alive to face the consequences, it appeared within months of his 1677 death and reshaped what philosophy could even argue about God.", aka: ["Ethics, Demonstrated in Geometrical Order", "Ethica"] },
  { title: "An Enquiry Concerning Human Understanding", author: "David Hume", why: "Causation itself put on trial; empiricism's sharpest, most unsettling argument." },
  { title: "Two Treatises of Government", author: "John Locke", why: "Consent of the governed, laid out as first principle; the American founders' owner's manual." },
  { title: "The Social Contract", author: "Jean-Jacques Rousseau", why: "'Man is born free, and everywhere he is in chains' — the case for popular sovereignty." },
  { title: "A Vindication of the Rights of Woman", author: "Mary Wollstonecraft", why: "Reason claimed as women's birthright, a century before suffrage was even on the table." },
  { title: "An Essay on the Principle of Population", author: "Thomas Malthus", why: "Population grows exponentially, food only arithmetically, catastrophe closes the gap — the pamphlet that handed Darwin his 'struggle for existence' the moment he read it.", aka: ["Essay on the Principle of Population"] },
  { title: "On the Principles of Political Economy and Taxation", author: "David Ricardo", why: "Two countries, two goods, and the 'four numbers' paragraph proving trade still pays off even when one side is better at making everything; comparative advantage, one of economics' oldest results and still one of its truest.", aka: ["Principles of Political Economy and Taxation", "The Principles of Political Economy and Taxation"] },
  { title: "Capital, Volume I", author: "Karl Marx", why: "Ricardo's own labor theory of value, pushed to its logical end until it indicts the whole system it came from; the only volume Marx finished and published himself (1867), and a different book entirely from the Manifesto's ten pages of pamphlet fire — the actual economics, not just the slogan.", aka: ["Das Kapital", "Capital", "Capital: A Critique of Political Economy"] },
  { title: "The Federalist Papers", author: "Alexander Hamilton", why: "Constitutional argument as serial journalism; the owner's manual for a government built to check itself.", aka: ["Federalist Papers", "The Federalist"] },
  { title: "Phenomenology of Spirit", author: "G.W.F. Hegel", why: "Consciousness's long, dialectical education toward absolute knowing; difficult, and never fully superseded." },
  { title: "The Art of War", author: "Sun Tzu", why: "Twenty-five hundred years old and still the first book handed to anyone learning to think about conflict — military, corporate, or otherwise.", aka: ["Art of War"] },
  { title: "On War", author: "Carl von Clausewitz", why: "War as 'the continuation of policy by other means' — every strategist since has had to argue with this book, not around it.", aka: ["Vom Kriege"] },
  { title: "On Liberty", author: "John Stuart Mill", why: "The harm principle, stated once and never bettered; the case for dissent as a public good." },
  { title: "The Interpretation of Dreams", author: "Sigmund Freud", why: "The unconscious given a grammar; whatever you think of the theory, the questions still stand." },
  { title: "Memories, Dreams, Reflections", author: "Carl Jung", why: "An autobiography written almost entirely from inside dreams and visions rather than outer events; the archetypes-and-collective-unconscious tradition Freud's own case histories never cover." },
  { title: "Course in General Linguistics", author: "Ferdinand de Saussure", why: "Lecture notes stitched together by students after their professor's death, and language hasn't been theorized the same way since; the arbitrary sign and the langue/parole split — structuralism's whole toolkit starts here.", aka: ["Cours de linguistique générale"] },
  { title: "Argonauts of the Western Pacific", author: "Bronisław Malinowski", why: "A Polish exile stranded in the Trobriand Islands by the outbreak of WWI turned confinement into method: live with the people, learn the language, participate, don't just observe from a veranda. Fieldwork anthropology's founding methodological text, three decades before Lévi-Strauss's own Amazon travelogue below — participant observation to structuralism's armchair pattern-finding, the field's two founding instincts side by side.", aka: ["Argonauts of the Western Pacific: An Account of Native Enterprise and Adventure in the Archipelagoes of Melanesian New Guinea"] },
  { title: "Tristes Tropiques", author: "Claude Lévi-Strauss", why: "An anthropologist's Amazon fieldwork rewritten as memoir, travelogue, and elegy for vanishing cultures; structural anthropology's founding work, and nearly a Prix Goncourt winner despite not being a novel." },
  { title: "The Varieties of Religious Experience", author: "William James", why: "Religion studied as lived psychology, not doctrine; the empirical case for taking mysticism seriously." },
  { title: "The Protestant Ethic and the Spirit of Capitalism", author: "Max Weber", why: "Why capitalism took root where it did; ideas as an economic engine, not just an effect." },
  { title: "Suicide", author: "Émile Durkheim", why: "The first great work of empirical sociology; even the most private act, shown to have a social rate." },
  { title: "The Presentation of Self in Everyday Life", author: "Erving Goffman", why: "Every social interaction restaged as theater — front stage, back stage, the performance of a self for whichever audience is watching; the dramaturgical, micro-level counterweight to Durkheim's macro social facts just above, and symbolic interactionism's founding text." },
  { title: "The Theory of the Leisure Class", author: "Thorstein Veblen", why: "Coined 'conspicuous consumption' — wealth spent visibly, specifically to be seen wasting it; a decade before Weber's Protestant Ethic, arguing status and display, not thrift, were driving the whole economic engine all along.", aka: ["Theory of the Leisure Class"] },
  { title: "The Souls of Black Folk", author: "W.E.B. Du Bois", why: "'Double consciousness' named for the first time; the founding text of Black American thought." },
  { title: "Being and Time", author: "Martin Heidegger", why: "What it means to exist at all, reopened as a question after millennia of assuming the answer." },
  { title: "Being and Nothingness", author: "Jean-Paul Sartre", why: "Freedom as a burden, not a gift; existentialism's fullest, most demanding statement." },
  { title: "The Myth of Sisyphus", author: "Albert Camus", why: "The one serious philosophical question — whether to keep living — answered with the boulder, pushed anyway." },
  { title: "Philosophical Investigations", author: "Ludwig Wittgenstein", why: "Language games replace the picture theory; twentieth-century philosophy's second, self-correcting act." },
  { title: "The Origins of Totalitarianism", author: "Hannah Arendt", why: "How societies actually curdle into total domination, traced with unflinching historical rigor." },
  { title: "Crowds and Power", author: "Elias Canetti", why: "Soccer crowds, revolutionary mobs, and the Bushmen's pilgrimage all read through one taxonomy of how masses form, swell, and dissolve; decades of solitary study by a Bulgarian-born survivor of interwar Vienna's own mob violence, and the 1981 Nobel committee's stated reason for the prize. Sits directly beside Arendt's own study of how the crowd's psychology curdles into totalitarian domination, from the individual-experience angle her institutional history doesn't cover.", aka: ["Masse und Macht"] },
  { title: "Notes of a Native Son", author: "James Baldwin", why: "Essays that fuse the personal and the political without either one flattening the other." },
  { title: "The Autobiography of Benjamin Franklin", author: "Benjamin Franklin", why: "Self-improvement as an American genre, invented by the man who lived it first." },
  { title: "Walden", author: "Henry David Thoreau", why: "Two years in a cabin as an argument against a life of quiet desperation." },
  { title: "Narrative of the Life of Frederick Douglass", author: "Frederick Douglass", why: "A former slave's own testimony, precise and devastating, that literacy itself was the first freedom." },
  { title: "The Autobiography of Malcolm X", author: "Malcolm X", why: "Hustler to convict to minister to independent thinker, dictated across two years of interviews and published nine months after his assassination; Time later named it one of the ten most influential nonfiction books of the century.", aka: ["Autobiography of Malcolm X"] },
  { title: "Maus", author: "Art Spiegelman", why: "A father's Auschwitz survival drawn as mice stalked by cats; the only comic ever handed a Pulitzer, because no existing category knew what else to call it.", aka: ["Maus: A Survivor's Tale", "The Complete Maus"] },
  { title: "Persepolis", author: "Marjane Satrapi", why: "A girl comes of age through the Iranian Revolution and the war with Iraq, drawn in stark black and white; the second graphic novel, after Maus, to prove the form could carry testimony this heavy.", aka: ["Persepolis: The Story of a Childhood"] },
  { title: "Long Walk to Freedom", author: "Nelson Mandela", why: "Twenty-seven years in prison recounted without bitterness overtaking the argument for justice." },
  { title: "The Decline and Fall of the Roman Empire", author: "Edward Gibbon", why: "Still the most quotable case study in how great powers actually end." },
  { title: "Democracy and Education", author: "John Dewey", why: "Education as the practice of democracy itself, not preparation for some later life." },
  { title: "The Wretched of the Earth", author: "Frantz Fanon", why: "Colonial violence and its psychology, analyzed by a psychiatrist who treated both sides of it." },
  { title: "Orientalism", author: "Edward Said", why: "How the West invented 'the East' to define itself against it; the founding text of postcolonial studies." },
  { title: "The Feminine Mystique", author: "Betty Friedan", why: "'The problem that has no name' — suburban domesticity's discontent, finally given words." },
  { title: "Silent Spring", author: "Rachel Carson", why: "Pesticides traced through the whole food chain; the book that started the environmental movement." },
  { title: "Discipline and Punish", author: "Michel Foucault", why: "The prison as a model for how modern power actually watches and shapes us." },
  { title: "The Double Helix", author: "James D. Watson", why: "DNA's discovery told as a real, messy, competitive race — science with its elbows still out." },
  { title: "The Selfish Gene", author: "Richard Dawkins", why: "Reframes evolution from the gene's point of view rather than the organism's — altruism, kinship, and cooperation all snap into focus once the unit of selection changes; fifty years on, still the clearest popular explanation of the idea." },
  { title: "A Brief History of Time", author: "Stephen Hawking", why: "Cosmology made legible to a general reader without losing the actual physics underneath." },
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
  { title: "The Mythical Man-Month", author: "Fred Brooks", why: "Adding programmers to a late software project makes it later — Brooks's Law, distilled from watching his own team miss deadline after deadline managing IBM's OS/360 in the 1960s; fifty years on, still the first book handed to a new engineering manager, and computer science's total absence from this list until now.", aka: ["Mythical Man-Month", "The Mythical Man-Month: Essays on Software Engineering"] },
  { title: "Reflections on the Revolution in France", author: "Edmund Burke", why: "Published within a year of the Bastille's fall, while most of Europe still cheered the Revolution on — Burke predicted the Terror before it happened, and gave modern conservative political thought its founding argument against remaking society from first principles.", aka: ["Reflections on the Revolution in France: And on the Proceedings in Certain Societies in London Relative to That Event"] },
  { title: "Distinction", author: "Pierre Bourdieu", why: "Taste, dressed up as pure aesthetic preference, unmasked as class position wearing a disguise — backed by a decade of French survey data. The rigorous empirical heir to Veblen's conspicuous consumption above, and 20th-century French sociology's missing entry beside Durkheim, Lévi-Strauss, and Foucault.", aka: ["Distinction: A Social Critique of the Judgement of Taste", "La Distinction"] },
  { title: "Syntactic Structures", author: "Noam Chomsky", why: "A 28-year-old's first book proposed that grammar is a finite set of rules generating infinite sentences — and helped trigger the cognitive revolution across psychology, philosophy, and computer science along the way. Structuralism's Saussure, reopened as a question about the mind rather than the sign." },
  { title: "Capitalism and Freedom", author: "Milton Friedman", why: "The Chicago School's founding manifesto — free markets as the precondition for political freedom, not just economic efficiency. Economics' missing third leg here beside Keynes's case for intervention and Hayek's Austrian warning against planning, both already on this list." },
  { title: "Blindness", author: "José Saramago", why: "A city goes blind for no explained reason, and civilization collapses within days — the 1998 Nobel committee's own centerpiece citation, and the Portuguese-language canon's total absence from this list until now.", aka: ["Ensaio sobre a Cegueira", "Blindness: A Novel"] },
  { title: "The Golden Notebook", author: "Doris Lessing", why: "A writer keeps four separate notebooks — black, red, yellow, blue — because no single one could hold a woman's whole life at once; the 2007 Nobel citation's named work, and the fictional counterpart to Friedan's Feminine Mystique, already here." },
  { title: "Anarchy, State, and Utopia", author: "Robert Nozick", why: "Written directly against Rawls's A Theory of Justice, already Must Read here, arguing any state larger than a night-watchman violates individual rights; the 1975 National Book Award winner, and the exact rebuttal essay this list's Rawls entry has been missing.", aka: ["Anarchy, State and Utopia"] },
  { title: "Capitalism, Socialism and Democracy", author: "Joseph Schumpeter", why: "Coined 'creative destruction' — capitalism reframed as continual entrepreneurial upheaval rather than a static equilibrium; economics' fourth leg now beside Keynes, Hayek, and Friedman, all already here, and the account of capitalism none of the other three actually gives.", aka: ["Capitalism, Socialism, and Democracy"] },
  { title: "Sundiata: An Epic of Old Mali", author: "Anonymous", why: "A griot's recitation of the 13th-century founding of the Mali Empire, brought to the page in 1960 by D.T. Niane from the oral telling of Djeli Mamoudou Kouyaté — a bestseller for thirty years, and the West African oral-epic tradition's total absence from this list until now, alongside Gilgamesh, Beowulf, the Shahnameh, and the Ramayana.", aka: ["Sundiata", "Sunjata", "Soundjata ou l'épopée mandingue"] },
  { title: "The Poetic Edda", author: "Anonymous", why: "Norse myth's primary source, copied into the 13th-century Codex Regius from poems composed centuries earlier — Ragnarök, Odin's hanging on Yggdrasil, and the Völuspá that gave a young Tolkien, by his own account, an encounter with 'something of tremendous force.' The mythological wellspring behind Njal's Saga's world, already here, and a direct source for The Lord of the Rings above.", aka: ["Poetic Edda", "Elder Edda", "Saemundar Edda"] },
  { title: "The Theory of Moral Sentiments", author: "Adam Smith", why: "Smith's first book, and by his own final judgment his better one — he spent his last year revising it rather than the Wealth of Nations. The 'invisible hand' actually debuts here, seventeen years early, in an argument about sympathy and moral judgment rather than markets; the psychological foundation Wealth of Nations quietly stands on, and this list's economics cluster finally gets its origin point rather than just its conclusions." },
  { title: "Mencius", author: "Mencius", why: "The second of Confucianism's Four Books, read for two thousand years alongside the Analects, already here — where Confucius states, Mencius argues, making the case that human nature tends toward good and that a ruler forfeits his mandate by failing his people. Standard imperial-exam curriculum for over five centuries, and the Analects' missing dialectical counterpart." },
  { title: "The Upanishads", author: "Anonymous", why: "Vedanta's foundational texts — Brahman, atman, moksha — that the Bhagavad Gita, already here, argues from rather than originates. Schopenhauer kept a copy open on his desk every night and called it 'the solace of my life, ... the solace of my death'; Hindu philosophy's actual taproot, one entry upstream of its most famous branch.", aka: ["Upanishad", "The Principal Upanishads"] },
  { title: "Parallel Lives", author: "Plutarch", why: "Paired Greek-and-Roman biographies weighing character over chronology, translated into English by Thomas North in 1579 and lifted by Shakespeare almost verbatim for Julius Caesar, Antony and Cleopatra, and Coriolanus — whole speeches barely reworded. Ancient historiography's missing biographical wing beside Herodotus, Thucydides, Tacitus, and Sima Qian, all already here.", aka: ["Plutarch's Lives", "Lives of the Noble Grecians and Romans", "The Lives of the Noble Grecians and Romanes"] },
  { title: "The Spirit of the Laws", author: "Montesquieu", why: "Argues that liberty survives only when power is split into separate legislative, executive, and judicial branches that check each other — the single most direct intellectual source for the U.S. Constitution's structure, cited more by the American founders than almost any other work. Political philosophy's missing 18th-century hinge between Hobbes/Locke's state-of-nature arguments and Rousseau's Social Contract, both already here.", aka: ["De l'esprit des lois", "The Spirit of Laws"] },
  { title: "Self-Reliance", author: "Ralph Waldo Emerson", why: "'To believe your own thought, to believe that what is true for you in your private heart is true for all men — that is genius.' The essay that gave American individualism its founding scripture, and Thoreau's Walden, already here, its direct philosophical parent." },
  { title: "Miss Julie", author: "August Strindberg", why: "A midsummer night, a countess's daughter, and her father's valet collide across class and sex lines in real time on stage — Strindberg's own 1888 preface reads like modern theater's first realist manifesto, and Ibsen's naturalist drama, already here, gets its equally combative rival at last." },
  { title: "Runaway", author: "Alice Munro", why: "Eight stories the Nobel committee singled out by name as the 'crowning achievement' behind her 2013 prize, 'master of the contemporary short story' — the form itself, never before represented on this list even once, gets its entry through the writer who made it a major art on par with the novel." },
  { title: "Long Day's Journey Into Night", author: "Eugene O'Neill", why: "One family, one day, morphine and old grief circling back on themselves by lamplight; O'Neill left instructions to lock the manuscript away for 25 years after his death, but his widow published it three years in instead. He remains the only American playwright ever awarded the Nobel Prize in Literature — modern American drama's missing entry beside Miller and Williams, both already here.", aka: ["Long Days Journey Into Night"] },
  { title: "The Hour of the Star", author: "Clarice Lispector", why: "A ghostwriter narrator doubts his own right to tell a poor typist's story even as he tells it — Lispector's last book, finished months before her own death in 1977. Brazilian fiction's second entry after Machado de Assis, already here, closing a hundred-year gap this list otherwise jumps straight over.", aka: ["A Hora da Estrela"] },

  // 2026-08-05 (daily curation pass): four more titles clearing the same
  // Lindy bar, each closing a real gap rather than padding an author already
  // represented. The Idiot is Dostoevsky's second Classic entry — explicitly
  // within the precedent this file's header already grants him (see the
  // Austen/Steinbeck/... list at the top). Erasmus and Paine were both
  // wholly absent from the canon despite towering influence in their own
  // genres (Christian humanist satire; revolutionary pamphleteering).
  // Beyond Good and Evil gives Nietzsche a Classic-tier entry alongside his
  // existing Must Read placement (On the Genealogy of Morals) — the
  // aphoristic manifesto the Genealogy was written a year later to formalize.
  { title: "The Idiot", author: "Fyodor Dostoevsky", why: "A genuinely, almost pathologically good man dropped into St. Petersburg society to see what his innocence costs him — written in the shadow of Dostoevsky's own near-execution and epilepsy, and his own candidate for the hardest character to write convincingly in all of fiction." },
  { title: "In Praise of Folly", author: "Desiderius Erasmus", why: "Folly herself delivers her own mock-eulogy, skewering popes, scholastic theologians, and princes in one satirical sweep — dashed off in a few days as a guest's parlor trick at Thomas More's house, and read across humanist Europe right up to the eve of the Reformation it helped provoke.", aka: ["Moriae Encomium", "The Praise of Folly"] },
  { title: "Common Sense", author: "Thomas Paine", why: "Fifty cents and forty-seven pages that turned a colonial tax dispute into an argument for outright independence — sold, per capita, more copies than any book in American history, Bible included." },
  { title: "Beyond Good and Evil", author: "Friedrich Nietzsche", why: "Morality's family tree traced back to power and instinct rather than truth, in aphorisms rather than sustained argument — the manifesto that On the Genealogy of Morals, already here as a Must Read, was written a year later to formalize into essays.", aka: ["Beyond Good and Evil: Prelude to a Philosophy of the Future"] },

  // 2026-08-06 (daily curation pass, round 39): four titles closing a
  // three-way poetry gap this list had somehow left open despite deep
  // coverage everywhere else (Sappho, Whitman in Must Read, Eliot, Walcott,
  // Neruda, Bashō) — English Romanticism, American lyric's other founder,
  // and classical Chinese verse — plus one physics companion to Newton's
  // Principia, already here. Li Bai/Du Fu were flagged as a candidate pool
  // on 2026-07-26 but never actually added; closed that overdue gap today.
  { title: "Songs of Innocence and of Experience", author: "William Blake", why: "Hand-engraved, hand-printed, and hand-colored by Blake himself because no ordinary press could be trusted with it — innocence and experience set side by side as the two contrary states every soul cycles through. English Romantic poetry's founding text, on a list that otherwise jumps straight from Milton to Whitman with nothing in between.", aka: ["Songs of Innocence and Experience", "Songs of Innocence", "Songs of Experience"] },
  { title: "The Complete Poems of Emily Dickinson", author: "Emily Dickinson", why: "Fewer than a dozen of her nearly 1,800 poems published in her lifetime; her sister found the rest in a locked box after her death in 1886, and the first collection appeared in 1890 with the dashes and slant rhymes smoothed out for Victorian taste. Compression and private cosmology as a whole poetics — American lyric's other founder, the quiet counterweight to Whitman's shout, already in Must Read." },
  { title: "The Selected Poems of Du Fu", author: "Du Fu", why: "China's 'Poet Sage' — a scholar's son who failed the imperial exams, lived through the An Lushan Rebellion's famine and exile, and turned both into poems of such technical control and moral seriousness that, alongside his friend Li Bai, no later Chinese poet has been read as closely since. Classical Chinese verse's missing entry on a list with deep classical-Chinese fiction (all Four Great Classical Novels) and philosophy (Analects, Zhuangzi, Mencius) but nothing from its poetry.", aka: ["Du Fu: Selected Poems", "Tu Fu", "The Poetry of Du Fu"] },
  { title: "Relativity: The Special and General Theory", author: "Albert Einstein", why: "Space and time unbuilt and rebuilt by the man who did it, explained in December 1916 for readers with no calculus required — physics' other founding text, the popular-but-authoritative companion Newton's Principia, already here, never had until now." },

  // 2026-08-07 (daily curation pass, round 40): five titles closing four
  // world-poetry gaps plus one Islamic-world science pick. Li Bai/Khayyam/
  // Hughes/Lorca close a candidate pool flagged as far back as 2026-07-26
  // (Li Bai specifically) and reflagged in round 39's own header; Avicenna
  // closes a distinct Islamic-world non-fiction gap (medicine/natural
  // science) beside Ibn Khaldun's history and Rumi's mysticism.
  { title: "Selected Poems of Li Bai", author: "Li Bai", why: "Tang China's other giant, alongside his lifelong friend Du Fu (already here) — extravagant, Taoist-inflected imagination, a legendary love of wine, and a death said to have come from leaning out of a boat, drunk, to embrace the moon's reflection in the river. ~1,100 poems survive; closes the overdue gap left open when Du Fu's own entry named him a round ago.", aka: ["Li Po", "Li Bo", "The Selected Poems of Li Po"] },
  { title: "The Rubaiyat of Omar Khayyam", author: "Omar Khayyam", why: "A Persian astronomer-mathematician's skeptical, carpe-diem quatrains, rendered into English by Edward FitzGerald in 1859 — sold off as penny clearance stock at first, then adopted so completely by the Pre-Raphaelites that dedicated 'Omar Khayyam Clubs' had sprung up across the English-speaking world within thirty years. Persian poetry's carpe-diem strand, distinct from the Shahnameh's epic and Rumi's mysticism, both already here.", aka: ["Rubaiyat of Omar Khayyam", "The Rubáiyát of Omar Khayyám"] },
  { title: "The Weary Blues", author: "Langston Hughes", why: "Blues and jazz rhythm braided into verse for the first time, published by Alfred A. Knopf in 1926 when Hughes was twenty-four — 'The Negro Speaks of Rivers' and 'I, Too' among its best-known poems. Closes African American poetry's total absence from a list that already carries Du Bois, Baldwin, and Morrison in prose, and remains most readers' first encounter with the Harlem Renaissance in verse." },
  { title: "Gypsy Ballads", author: "Federico García Lorca", why: "Eighteen ballads in traditional eight-syllable meter, composed 1924-1927 and published 1928, that made Lorca Spain's most-read poet of the century almost overnight — Spanish-language poetry's total absence, closed. He was already famous for this book when Francoist rebels shot him at the outset of the Civil War in 1936.", aka: ["Romancero Gitano", "Gypsy Ballads: Romancero Gitano"] },
  { title: "The Canon of Medicine", author: "Avicenna", why: "A five-volume medical encyclopedia completed in 1025, synthesizing Greek, Roman, Indian, and Persian medicine with the author's own clinical observations — the standard medical textbook in European universities until the mid-seventeenth century and in parts of the Middle East into the nineteenth, reissued sixteen times in the last thirty years of the fifteenth century alone. Islamic-world science and medicine, distinct from Ibn Khaldun's historical sociology (Must Read) and Rumi's mysticism, both already here.", aka: ["Al-Qanun fi al-Tibb", "The Canon"] },

  // 2026-08-08 (daily curation pass, round 41): five titles closing five
  // distinct, substantial gaps. The Quran's total absence was the largest
  // one found — this list already carries the Bhagavad Gita, Tao Te Ching,
  // Analects, and the Upanishads, but not Islam's own foundational
  // scripture; flagged in must-read.ts as a possible Must Read candidate
  // given its comparable world-historical weight to those texts, but not
  // promoted here — S-tier calls remain Stefano's, per the standing
  // default. Antigone gives Sophocles a second, independently merited
  // entry beside his Must Read Oedipus Rex: a different play, a different
  // conflict (family duty against the state), and the exact text Hegel's
  // Phenomenology of Spirit, already here, builds one of its most
  // celebrated readings on. Les Fleurs du Mal closes French Symbolist
  // poetry's total absence — the book Rimbaud and Verlaine both credited
  // by name, and the direct root T.S. Eliot's own Waste Land, already
  // here, grew from. Duino Elegies closes German-language lyric poetry's
  // gap; this list's German representation was philosophy and the novel
  // until now, no poetry at all. Dialogue Concerning the Two Chief World
  // Systems pairs with Newton's Principia, already here, as the
  // scientific revolution's other founding text — and the book that put
  // Galileo before the Inquisition.
  { title: "The Quran", author: "Anonymous", why: "Recited by Muhammad over 23 years and standardized into a single canonical text under Caliph Uthman around 650 CE, with all divergent copies ordered destroyed — the foundational scripture of a civilization of over a billion readers, on a list that already had room for the Bhagavad Gita, Tao Te Ching, and Upanishads.", aka: ["Koran", "The Koran", "Al-Quran", "The Holy Quran"] },
  { title: "Antigone", author: "Sophocles", why: "A sister defies the king's decree and buries her brother anyway, choosing unwritten divine law over the state's — first performed around 441 BC, and the exact text Hegel's Phenomenology of Spirit, already here, builds one of its most celebrated arguments on: family duty against civic law as ethical life's founding conflict. Sophocles's second entry, independently merited alongside his Must Read Oedipus Rex.", aka: ["Antigonē"] },
  { title: "Les Fleurs du Mal", author: "Charles Baudelaire", why: "Prosecuted for obscenity within a month of its 1857 publication — six poems banned by a Paris court and not legally restored until 1949 — from the poet Rimbaud called a genius and a visionary, and Verlaine credited with inventing modern man in verse. French Symbolist poetry's founding text, and the direct root T.S. Eliot's own Waste Land, already here, grew from.", aka: ["The Flowers of Evil", "Flowers of Evil"] },
  { title: "Duino Elegies", author: "Rainer Maria Rilke", why: "Ten years in the writing — begun at a castle on the Adriatic in 1912, stalled through the trauma of the First World War, then finished in a three-week creative burst in 1922 that also produced the Sonnets to Orpheus. Angels, mortality, and the difficulty of being fully present to one's own life, in German lyric poetry's clearest twentieth-century peak; this list's German representation was philosophy and the novel until now, with no poetry at all.", aka: ["Duineser Elegien", "The Duino Elegies"] },
  { title: "Dialogue Concerning the Two Chief World Systems", author: "Galileo Galilei", why: "Three characters argue Copernicus's heliocentrism against Ptolemy's earth-centered universe across four days of conversation — published in 1632 with a papal license, then the direct evidence used to try Galileo before the Inquisition and force his public recantation the following year. The scientific revolution's other founding text, arguing the very possibility Newton's Principia, already here, would go on to complete mathematically.", aka: ["Dialogue Concerning the Two Chief World Systems: Ptolemaic and Copernican", "Dialogo sopra i due massimi sistemi del mondo"] },

  // 2026-08-08 (daily curation pass, round 42, second same-day pass): five
  // more titles closing five further gaps found on a fresh sweep after
  // round 41. Shakespeare's total footprint on this list was just two plays
  // (Hamlet, King Lear, both Must Read) — Macbeth gives him a Classic-tier
  // entry and closes the "only the two Must Read tragedies" gap, the same
  // shape of oversight as round 41's Antigone/Sophocles fix. The Castle is
  // Kafka's third entry (Metamorphosis and The Trial are both Must Read),
  // within the multi-entry precedent this file's header already grants
  // several authors, and specifically closes the gap that only his shorter
  // work was represented, not either of his two great unfinished novels.
  // Thus Spoke Zarathustra was explicitly flagged as a candidate as far
  // back as this file's creation (see must-read.ts's own header note,
  // 2026-07-14: "kept [Genealogy of Morals] over the more culturally iconic
  // Thus Spoke Zarathustra... Zarathustra remains a candidate") but never
  // actually added anywhere — added here at Classic tier, Nietzsche's third
  // entry alongside Genealogy (Must Read) and Beyond Good and Evil
  // (Classic), consistent with the multi-entry precedent. The Kalevala and
  // Popol Vuh close two independent total-absence gaps in the world-epic
  // cluster (Gilgamesh, Beowulf, Shahnameh, Ramayana, Mahabharata, Poetic
  // Edda, Sundiata, all already here): Finland's national epic, and the
  // Americas' total absence from that cluster until now.
  { title: "Macbeth", author: "William Shakespeare", why: "A prophecy, an ambitious wife, and a murdered king's blood that won't wash off — written around 1606 in the shadow of the just-discovered Gunpowder Plot, and first printed only in the 1623 First Folio, seven years after Shakespeare's death. His shortest and bloodiest tragedy, and this list's only Shakespeare beyond the two Must Read plays (Hamlet, King Lear)." },
  { title: "The Castle", author: "Franz Kafka", why: "A land surveyor summoned to a village spends the whole novel failing to reach the castle that summoned him, or even to confirm the summons was real — Kafka broke off mid-sentence in 1922, left instructions to burn it, and his executor Max Brod published it anyway in 1926, two years after Kafka's death. Bureaucracy as an unreachable, possibly nonexistent God; Kafka's third entry alongside The Metamorphosis and The Trial, both already Must Read.", aka: ["Das Schloss", "Das Schloß"] },
  { title: "Thus Spoke Zarathustra", author: "Friedrich Nietzsche", why: "A prophet descends from his mountain to announce the death of God and the coming of the Übermensch, in verse-like parables rather than argument — published in four parts between 1883 and 1885 (the fourth printed in just forty copies), and eternal recurrence's first full statement. Explicitly flagged as a candidate when this list was founded in 2026-07-14 and never actually added until now; Nietzsche's third entry alongside On the Genealogy of Morals (Must Read) and Beyond Good and Evil, already here.", aka: ["Also sprach Zarathustra", "Thus Spake Zarathustra"] },
  { title: "The Kalevala", author: "Anonymous", why: "Compiled by Elias Lönnrot from oral folk songs collected on journeys through 19th-century Karelia — the 'Old Kalevala' in 1835, expanded into its standard 50-poem, 22,000-verse form as the 'New Kalevala' in 1849. Finland's national epic, credited with anchoring a Finnish national identity under Russian rule and a direct influence Tolkien named on The Lord of the Rings, already here — the world-epic cluster's Finnish entry, alongside Gilgamesh, Beowulf, the Shahnameh, and the Poetic Edda.", aka: ["Kalevala"] },
  { title: "Popol Vuh", author: "Anonymous", why: "The K'iche' Maya creation narrative — failed attempts to make humans from mud and wood before the gods succeed with maize, and the Hero Twins' underworld trickery against the Lords of Death — set down in the Latin alphabet around 1554-1558 by K'iche' authors writing under Spanish colonial pressure, then copied and translated into Spanish around 1701 by the Dominican friar Francisco Ximénez after the original K'iche' manuscript was lost. The Americas' total absence from this list's world-epic cluster, closed.", aka: ["Popol Wuj", "The Book of the People"] },

  // 2026-08-09 (daily curation pass, round 43): five more titles, all
  // poetry or verse-drama, closing five independent gaps rather than one
  // theme — the same "several distinct oversights in one pass" shape as
  // round 41. Petrarch's Canzoniere completes Florence's "Three Crowns"
  // alongside Dante's Divine Comedy (Must Read) and Boccaccio's Decameron,
  // already here — an odd trio to have left two-thirds represented.
  // Tagore's Gitanjali closes Indian literature's total absence from
  // modern poetry specifically (Ramayana, Mahabharata, and the Bhagavad
  // Gita already cover epic and philosophy, but nothing written in the
  // last thousand years). Akhmatova's Requiem closes Russian-language
  // poetry's total absence on a list that runs deep in Russian prose
  // (Tolstoy, Dostoevsky, both multi-entry authors here). Schiller's
  // Wallenstein gives Goethe's own Weimar Classicism collaborator, and
  // German drama generally, its first entry — Faust has stood alone in
  // that slot since this list's founding. W.B. Yeats's Collected Poems
  // closes modern English-language lyric poetry's gap and happens to
  // connect directly to the Tagore entry added the same round: Yeats
  // wrote Gitanjali's English introduction in 1912, a year before Tagore
  // won the Nobel Prize Yeats himself would win a decade later.
  { title: "Canzoniere", author: "Petrarch", why: "317 sonnets and other lyric poems addressed to Laura, written and endlessly revised from 1330 until Petrarch's death in 1374 — the founding text of the sonnet sequence, imitated across Europe by Wyatt, Shakespeare, and Ronsard for the next three centuries. Completes Florence's 'Three Crowns' alongside Dante's Divine Comedy (Must Read) and Boccaccio's Decameron, already here.", aka: ["Il Canzoniere", "Rerum vulgarium fragmenta", "Sonnets to Laura"] },
  { title: "Gitanjali", author: "Rabindranath Tagore", why: "A Bengali poet's own English prose-translation of his devotional songs, published in London in November 1912 with an introduction by W.B. Yeats — within a year it made Tagore the first non-European ever awarded the Nobel Prize in Literature (1913). This list's Indian representation was epic and philosophy (the Ramayana, the Mahabharata, the Bhagavad Gita) with no modern poetry at all until now.", aka: ["Gitanjali: Song Offerings", "Song Offerings"] },
  { title: "Requiem", author: "Anna Akhmatova", why: "Composed in fragments between 1935 and 1940 while her son sat in a Leningrad prison during Stalin's Great Terror, then committed to memory and burned page by page so no written copy existed in the house — trusted friends memorized stanzas as insurance. Not published in the Soviet Union until 1987 (Munich, 1963, in the meantime). Russian-language poetry's total absence, closed, on a list that already runs deep in Russian prose.", aka: ["Rekviem"] },
  { title: "Wallenstein", author: "Friedrich Schiller", why: "A trilogy — Wallenstein's Camp, The Piccolomini, Wallenstein's Death — following an imperial general's fall during the Thirty Years' War, written 1796-1799 during the intense collaborative friendship with Goethe (already here, Faust) that historians call Weimar Classicism; generally ranked as Schiller's dramatic masterpiece. Gives German classical drama its first second voice — Faust has stood alone in that slot since this list's founding.", aka: ["The Wallenstein Trilogy", "Wallenstein: A Dramatic Poem"] },
  { title: "The Collected Poems of W.B. Yeats", author: "W.B. Yeats", why: "First assembled in 1933, gathering half a century of work from the Celtic Twilight lyricism of his twenties through 'The Second Coming' (1919) and 'Sailing to Byzantium' (1928) — T.S. Eliot called him, in a 1940 memorial lecture, 'the greatest poet of his time.' First Irish laureate of the Nobel Prize in Literature (1923); wrote the English introduction to Tagore's Gitanjali, already here, the year before Tagore won his own Nobel.", aka: ["Collected Poems of W.B. Yeats", "The Poems of W.B. Yeats"] },

  // 2026-08-10 (daily curation pass, round 44): five titles closing five
  // author-level gaps rather than one theme, same shape as rounds 41-43.
  // Schopenhauer and Russell were both genuine total-absence gaps: this
  // list already quotes Schopenhauer twice in its own header prose (his
  // "solace of my life" line on the Upanishads entry) without ever giving
  // him an entry of his own, and Russell — a Nobel laureate in Literature
  // (1950) "in recognition of his varied and significant writings in which
  // he champions humanitarian ideals and freedom of thought" — had no
  // presence at all despite this list's deep philosophy bench (Kant,
  // Nietzsche, Hegel, Heidegger). Brecht closes German-language drama's
  // second gap in as many rounds: Schiller gave Goethe's Faust its first
  // companion voice last round, but that's still 18th/19th-century Weimar
  // Classicism — twentieth-century German theater, and its most
  // influential form (epic theater, the Verfremdungseffekt), had zero
  // representation. Uncle Vanya gives Chekhov a second entry alongside The
  // Cherry Orchard, the same "only one play" gap this list already closed
  // for Shakespeare (Macbeth, round 42) and Sophocles (Antigone, round
  // 41). The Labyrinth of Solitude closes a genre gap rather than an
  // author gap: this list's Latin American strength is almost entirely
  // fiction (García Márquez, Borges, Cortázar, Vargas Llosa, Rulfo,
  // Fuentes) with no essay or non-fiction voice from the same tradition —
  // Paz's own Nobel (1990) rests substantially on this book.
  { title: "Mother Courage and Her Children", author: "Bertolt Brecht", why: "A canteen wagon-woman drags her three children across the Thirty Years' War, profiting from the fighting until it takes all of them — written in 1939 as Brecht fled the Nazis through Scandinavia, and first staged in Zurich in 1941. The founding text of epic theater's alienation effect (Verfremdungseffekt), and twentieth-century German drama's total absence on this list until now; Schiller's Wallenstein, added last round, is the same war seen through the previous century's very different dramatic idiom.", aka: ["Mother Courage", "Mutter Courage und ihre Kinder"] },
  { title: "The World as Will and Representation", author: "Arthur Schopenhauer", why: "The world reduced to two aspects — a blind, striving 'will' underlying everything, and the merely representational surface our minds perceive — published in 1818 to near-total silence, then expanded into a second volume in 1844 once Schopenhauer's ideas had finally found an audience. Kept open on Schopenhauer's own desk was the Upanishads, already here, which he called 'the solace of my life... the solace of my death' — his direct influence on Nietzsche, Wagner, and Freud, and a total absence on this list until now despite being quoted twice in its own prose." },
  { title: "A History of Western Philosophy", author: "Bertrand Russell", why: "Written in the United States during the Second World War and published in 1945, tracing philosophy from Thales to logical positivism in prose deliberately built for general readers rather than specialists — the book Russell's 1950 Nobel Prize in Literature citation names directly, for writings that 'champion humanitarian ideals and freedom of thought.' A philosophy bench running from Kant through Heidegger had no twentieth-century British voice until now.", aka: ["History of Western Philosophy"] },
  { title: "Uncle Vanya", author: "Anton Chekhov", why: "A rural estate, a professor's second marriage, and the family who kept it running for him finally admitting how much of their lives they've wasted — a 1897 rewrite of Chekhov's earlier, unsuccessful The Wood Demon, then staged by Stanislavski's Moscow Art Theatre in 1899 to the acclaim the original never got. Chekhov's second entry alongside The Cherry Orchard, closing the same 'only one play' gap this list already closed for Shakespeare and Sophocles.", aka: ["Dyadya Vanya"] },
  { title: "The Labyrinth of Solitude", author: "Octavio Paz", why: "Nine essays on Mexican identity written from Paris in 1950, tracing solitude and the fiesta, the Conquest and La Malinche, through to Mexico's place in the modern world — the book substantially behind Paz's own 1990 Nobel Prize in Literature. This list's Latin American strength runs almost entirely through fiction (García Márquez, Borges, Cortázar, Vargas Llosa, Rulfo, Fuentes); its first non-fiction voice from the same tradition.", aka: ["El Laberinto de la Soledad"] },

  // 2026-08-11 (daily curation pass, round 45): five titles closing five
  // independent gaps, same "distinct oversights in one pass" shape as
  // rounds 41-44. Maimonides closes medieval Jewish philosophy's total
  // absence on a list that already runs both of its natural counterparts —
  // Avicenna's Islamic-world philosophy/medicine and Aquinas's Christian
  // scholasticism (Summa Theologica) — without ever giving the third,
  // connecting tradition its own entry; the Guide directly shaped Aquinas's
  // own synthesis a century later. Racine closes French neoclassical
  // tragedy's total absence: Molière's Tartuffe has represented 17th-century
  // French theater alone since this list's founding, comedy with no
  // tragic counterpart. Simone Weil closes a genuine total-absence gap for
  // a singular 20th-century voice — political radical, mystic, and factory
  // worker at once, admired across otherwise incompatible camps (Camus
  // called her "the only great spirit of our times," T.S. Eliot wrote her
  // English introduction). Césaire closes Négritude's total absence: this
  // list already carries its direct intellectual heir (Fanon's The
  // Wretched of the Earth) without the founding text that coined the term
  // itself. Booker T. Washington closes the same "dueling counterpart"
  // pattern this list has used before (Freud/Jung, Hegel/Kierkegaard,
  // Kuhn/Popper) — Du Bois's The Souls of Black Folk, already here,
  // is one half of the most consequential debate in early Black American
  // political thought; Washington's accommodationist case was the other,
  // and arguably the more widely read of the two in its own time.
  { title: "The Guide for the Perplexed", author: "Maimonides", why: "Composed in Judeo-Arabic in Fustat, Egypt around 1190 as a private letter to a troubled disciple, then translated into Hebrew in 1204 by Samuel ibn Tibbon — an attempt to reconcile Aristotelian philosophy with biblical revelation that became the single most influential text in the history of Jewish philosophy, and controversial enough that some communities banned its study outright. Medieval Jewish philosophy's total absence, closed, alongside the Islamic (Avicenna) and Christian (Aquinas) scholastic traditions already here — Maimonides directly shaped Aquinas's own synthesis a century later.", aka: ["The Guide of the Perplexed", "Guide of the Perplexed", "Moreh Nevukhim", "Dalalat al-Ha'irin"] },
  { title: "Phèdre", author: "Jean Racine", why: "A queen's confession of forbidden love for her stepson unravels an entire royal house in 1,654 alexandrine lines — premiered January 1, 1677 at the Hôtel de Bourgogne in Paris, reworking Euripides' Hippolytus into French neoclassical tragedy's defining achievement. Racine's seventh tragedy and his last secular play before retiring from the stage. French 17th-century theater's tragic half, closed — Molière's Tartuffe has stood alone here as its comic half since this list's founding.", aka: ["Phaedra", "Phèdre et Hippolyte"] },
  { title: "Gravity and Grace", author: "Simone Weil", why: "Aphorisms on suffering, attention, and the 'decreation' of the self, assembled from eleven notebooks Weil entrusted to the farmer-philosopher Gustave Thibon in 1942, a year before her death at 34 — Thibon published the arrangement in 1947, giving posthumous shape to a body of thought Weil herself never lived to organize into a book. Camus called her 'the only great spirit of our times'; T.S. Eliot wrote the English edition's introduction. A singular 20th-century voice — political radical, factory worker, and Christian mystic in one person — with no presence on this list until now.", aka: ["La Pesanteur et la Grâce"] },
  { title: "Notebook of a Return to the Native Land", author: "Aimé Césaire", why: "A booklength poem written between 1935 and 1939 on Césaire's return from Paris to colonial Martinique, first published in the journal Volontés in August 1939 — the text that coined the word 'négritude' and became the founding document of the movement it named. This list already carries Négritude's direct intellectual descendant (Fanon's The Wretched of the Earth) without ever including the poem that started it.", aka: ["Cahier d'un retour au pays natal", "Notebook of a Return to My Native Land", "Return to My Native Land"] },
  { title: "Up From Slavery", author: "Booker T. Washington", why: "An autobiography tracing Washington's path from enslaved childhood to founding the Tuskegee Institute, serialized in The Outlook from late 1900 before its 1901 book publication — the clearest statement of his accommodationist strategy for Black advancement through vocational education and economic self-reliance, argued directly against by W.E.B. Du Bois's The Souls of Black Folk, already here. The two books together are the two halves of early Black American political thought's defining argument; only one side has sat on this list until now.", aka: ["Up from Slavery: An Autobiography"] },

  // 2026-08-12 (daily curation pass, round 46): five more titles closing
  // five independent gaps, same discipline as rounds 41-45. Martin Luther
  // closes the Protestant Reformation's total absence — a five-century
  // religious and intellectual rupture that reshaped Europe, with none of
  // its own founding texts on this list until now (Aquinas and Maimonides,
  // both already here, represent the scholastic tradition the Reformation
  // broke from). Walter Benjamin closes the Frankfurt School/critical
  // theory tradition's total absence: this list already runs structuralism
  // (Lévi-Strauss, Saussure) and Foucault's post-structuralist response to
  // it, but never the earlier Frankfurt School current those movements
  // were themselves arguing against. Gramsci closes a distinct gap next to
  // Marx, already here — Marx's entry addresses political economy;
  // Gramsci's "cultural hegemony" is a later, separate argument about how
  // power actually reproduces itself through culture and consent rather
  // than force alone. Sontag closes American criticism's total absence in
  // the second half of the twentieth century — no essayistic/critical
  // voice from that era or country existed on this list before now.
  // Kazantzakis closes modern Greek literature's total absence: every
  // other Greek voice already here (Aeschylus, Sophocles, Aristophanes,
  // Plato, Aristotle) predates the Common Era by two thousand years.
  { title: "On the Freedom of a Christian", author: "Martin Luther", why: "A Christian is 'a perfectly free lord of all, subject to none' and simultaneously 'a perfectly dutiful servant of all, subject to all' — Luther's own choice, by his own later account, for the one work of his he'd preserve if all the others were destroyed. Published in November 1520, the third of his three great reforming treatises that year, after Address to the Christian Nobility of the German Nation and On the Babylonian Captivity of the Church. The Protestant Reformation's total absence, closed — a rupture that reshaped Europe's religious and intellectual life for five centuries, with none of its own founding texts on this list until now.", aka: ["The Freedom of a Christian", "A Treatise on Christian Liberty", "Von der Freiheit eines Christenmenschen"] },
  { title: "The Work of Art in the Age of Mechanical Reproduction", author: "Walter Benjamin", why: "Photography and film strip art of its 'aura' — the unrepeatable presence tied to a unique original in a unique place — while opening it, for the first time, to mass political use. Written in 1935 as Benjamin fled Nazi Germany and first published, in French translation, in the Frankfurt School's own journal, Zeitschrift für Sozialforschung, in 1936. Twentieth-century critical theory and media theory's founding essay — this list already runs structuralism (Lévi-Strauss, Saussure) and Foucault's response to it, but never the Frankfurt School current those movements were themselves reacting against.", aka: ["The Work of Art in the Age of Its Technological Reproducibility", "Das Kunstwerk im Zeitalter seiner technischen Reproduzierbarkeit"] },
  { title: "Prison Notebooks", author: "Antonio Gramsci", why: "More than thirty notebooks and 3,000 pages written in fragments between 1929 and 1935 inside Mussolini's prisons, where Gramsci's own prosecutor demanded a sentence built 'to stop this brain from functioning for twenty years' — smuggled out after his 1937 death and published in Italy from 1947 onward. Introduces 'cultural hegemony': the idea that ruling classes secure consent through culture and institutions as much as through coercion. Marx, already here, addresses political economy; Gramsci is a distinct, later argument about how power actually reproduces itself day to day.", aka: ["Selections from the Prison Notebooks", "Quaderni del carcere"] },
  { title: "Against Interpretation", author: "Susan Sontag", why: "Sontag's 1966 debut essay collection, arguing that criticism had grown obsessed with excavating a work's hidden 'meaning' at the expense of its sensory surface — includes 'Notes on Camp,' the 1964 essay that pulled a private aesthetic sensibility into mainstream vocabulary almost overnight. A commanding American critical voice for the second half of the twentieth century, with zero representation on this list until now.", aka: ["Against Interpretation and Other Essays"] },
  { title: "Zorba the Greek", author: "Nikos Kazantzakis", why: "A buttoned-up Greek intellectual and the boisterous, appetite-driven miner who upends his careful plans on a Cretan hillside — published in 1946, drawn from Kazantzakis's real friendship with a miner named Georgios Zorbas, and the basis for the 1964 film that made Zorba's dance a global shorthand for joy over caution. Modern Greek literature's total absence, closed — every other Greek voice on this list (Aeschylus, Sophocles, Aristophanes, Plato, Aristotle) predates the Common Era by two thousand years.", aka: ["Life and Times of Alexis Zorbas", "Vios kai Politeia tou Alexi Zorba"] },

  // 2026-08-13 (daily curation pass, round 47): five more titles closing
  // five independent gaps, same discipline as rounds 41-46. Cicero closes
  // Roman oratory and practical ethics' total absence — this list runs
  // Roman Stoicism (Seneca, Epictetus, Marcus Aurelius) and Epicureanism
  // (Lucretius) but never the statesman-orator whose own synthesis shaped
  // Western moral and political thought from the Church Fathers through the
  // Renaissance to the Enlightenment. The Dhammapada closes the largest
  // remaining religious gap on either list: this list already runs
  // Hinduism (Bhagavad Gita, Upanishads), Islam (the Quran), Judaism
  // (Maimonides), Confucianism and Taoism (the Analects, Tao Te Ching, the
  // Zhuangzi) — but Buddhism, one of the world's major religious and
  // philosophical traditions, had zero representation. Hafez closes a
  // specific gap inside Persian poetry, already represented by three other
  // forms (Ferdowsi's epic Shahnameh, Rumi's mystical-narrative Masnavi,
  // Khayyam's quatrains) but never by the ghazal, the lyric form Hafez
  // himself perfected. The Mabinogion closes Celtic mythology's total
  // absence next to the other national myth-cycles already here (the
  // Kalevala, the Poetic Edda, Sundiata, Popol Vuh, Njal's Saga) — the last
  // major European mythological tradition still missing. Calderón closes
  // Spanish Golden Age theater's total absence: this list's theater cluster
  // runs French (Molière), Norwegian (Ibsen), Russian (Chekhov), German
  // (Brecht, Schiller), Greek (Aeschylus, Euripides, Aristophanes), but
  // nothing from Spain's own dramatic golden age, the contemporary
  // counterpart to Lope de Vega whom Calderón succeeded as its leading
  // voice. All five facts (Cicero's October-November 44 BCE composition
  // after Caesar's assassination; the Dhammapada's c. 250 BCE compilation
  // within the Pali Canon; Hafez's 1325-1390 lifespan and the Divan's
  // posthumous compilation by Mohammad Golandam; the Mabinogion's two core
  // manuscripts, the White Book of Rhydderch (c. 1350) and the Red Book of
  // Hergest (c. 1382-1410); Life Is a Dream's 1635 premiere and 1636
  // publication) independently verified via WebSearch rather than trusted
  // from recall. All five clear the Lindy/A-tier bar with room to spare;
  // none rise to Must Read's "unmissable" bar on their own — no new
  // promotion flag this round, and the Quran flag from round 41
  // (2026-08-08) remains the sole open Must Read candidate.
  { title: "On Duties", author: "Cicero", why: "A father's advice to his student son, written as a didactic letter in October-November 44 BCE during the chaos following Julius Caesar's assassination — Cicero's synthesis of Stoic ethics (chiefly Panaetius's) into a practical Roman guide for public life: what is honorable, what is advantageous, and what to do when the two seem to conflict. Rome's greatest orator's total absence on this list, closed — a treatise transmitted through the Church Fathers, given central place again by Petrarch in the Renaissance, and read closely by the Enlightenment statesmen who founded the American republic.", aka: ["De Officiis", "On Obligations"] },
  { title: "The Dhammapada", author: "Anonymous", why: "423 verses in 26 chapters, compiled within the Pali Canon around 250 BCE and later glossed by the 5th-century scholar Buddhaghosa — a compact anthology distilling the Buddha's teaching on the path, virtue, and the mind that the Pali Canon's forty-odd volumes elaborate at length. Buddhism's total absence on either list, closed, alongside the Hinduism, Islam, Judaism, Confucianism, and Taoism already represented here.", aka: ["Dhammapada"] },
  { title: "The Divan of Hafez", author: "Hafez", why: "Compiled after Hafez's 1390 death by his friend Mohammad Golandam from ghazals written across a lifetime in Shiraz — Hafez brought the ghazal, a lyric form of linked couplets built on symbol and mood rather than argument, to a perfection Persian poetry has never surpassed. Closes a distinct gap inside a tradition this list already covers three other ways: Ferdowsi's epic Shahnameh, Rumi's mystical Masnavi, Khayyam's quatrains — never, until now, the ghazal itself.", aka: ["Divan-e Hafez", "The Divan-i-Hafiz", "Diwan of Hafez"] },
  { title: "The Mabinogion", author: "Anonymous", why: "Eleven medieval Welsh tales of shape-shifting kings, cursed queens, and Arthurian knights, drawing on oral tradition far older than their two surviving manuscripts, the White Book of Rhydderch (c. 1350) and the Red Book of Hergest (c. 1382-1410) — the richest surviving store of Celtic myth, and a direct influence on Tolkien and the Arthurian romance tradition alike. Celtic mythology's total absence, closed, the last major European myth-cycle still missing beside the Kalevala, the Poetic Edda, Sundiata, Popol Vuh, and Njal's Saga already here.", aka: ["Mabinogion"] },
  { title: "Life Is a Dream", author: "Pedro Calderón de la Barca", why: "Prince Segismundo, imprisoned from birth on a prophecy that he'll become a tyrant, is drugged and briefly given the throne to test the prophecy — then told, once his rule turns violent, that the whole episode was only a dream. Probably first staged in 1635 and published in Madrid in 1636, the defining achievement of Spain's Golden Age theater by the dramatist who inherited Lope de Vega's mantle as its leading voice. Spanish Golden Age drama's total absence on this list, closed, beside the French (Molière), Norwegian (Ibsen), Russian (Chekhov), and German (Brecht, Schiller) theater already here.", aka: ["La vida es sueño"] },

  // 2026-08-14 (daily curation pass, round 48): five more titles closing
  // five independent gaps, same discipline as rounds 41-47. The Guru
  // Granth Sahib closes the largest remaining religious gap of all: this
  // list runs Hinduism, Buddhism, Islam, Judaism, Christianity, and
  // Confucianism/Taoism, but Sikhism — a tradition of roughly 25-30 million
  // adherents worldwide — had zero representation on either list. Vasari
  // closes a total gap in genre rather than tradition: nowhere on this
  // list is there a work of art history or criticism, despite deep
  // coverage of literary, philosophical, and scientific non-fiction; this
  // is the book that invented the biographical survey of artists as a
  // form. Pirandello closes Italian theater's total absence — this list's
  // Italian strength (Manzoni, Calvino, Eco, Lampedusa) runs entirely
  // through fiction, with no dramatic voice at all, despite a theater
  // cluster already running French, Norwegian, Russian, German, Greek, and
  // Spanish (Calderón, added last round). Areopagitica gives Milton a
  // second, independently merited entry beside his Must Read Paradise
  // Lost — a different genre entirely (prose polemic, not epic verse) and
  // the founding text of free-press argument, distinct from Mill's later
  // On Liberty already here. The Gulag Archipelago closes a gap inside an
  // already-covered category: this list runs Holocaust testimony (If This
  // Is a Man, Night, The Diary of a Young Girl) but no equivalent
  // first-person reckoning with the Soviet camp system, despite already
  // carrying Solzhenitsyn's own fiction (One Day in the Life of Ivan
  // Denisovich). All five facts (the Adi Granth's completion on 29
  // August 1604 and its 1708 elevation to eternal Guru; Vasari's 1550 first
  // edition and expanded 1568 second edition; Six Characters' 10 May 1921
  // Rome premiere and the riot it caused; Areopagitica's 23 November 1644
  // publication in defiance of the 1643 Licensing Order; the Gulag
  // Archipelago's 1973 Paris publication by YMCA-Press and its 1918-1956
  // subtitle) independently verified via WebSearch. All five clear the
  // Lindy/A-tier bar with room to spare; The Gulag Archipelago is arguably
  // Must-Read-caliber given its world-historical weight, but the
  // established calibration precedent (Iliad/Oedipus Rex/Quran sitting in
  // Classic despite comparable weight) argues for consistency — flagged
  // for Stefano, not promoted here. The Quran flag from round 41 remains
  // the longest-open Must Read candidate.
  { title: "Guru Granth Sahib", author: "Guru Arjan Dev", why: "Compiled by the fifth Sikh Guru and completed on 29 August 1604, weaving hymns of the first five Gurus together with verses from Hindu and Muslim mystic poets — an act of interfaith synthesis built into the scripture's foundation. In 1708 the tenth Guru, Gobind Singh, declared it the eternal, living Guru of the Sikh faith; no human successor has been named since. Sikhism's total absence on either list, closed — a tradition of some 25-30 million adherents worldwide.", aka: ["Adi Granth", "Sri Guru Granth Sahib", "The Adi Granth"] },
  { title: "Lives of the Most Excellent Painters, Sculptors, and Architects", author: "Giorgio Vasari", why: "Gossip, myth, and genuine research fused into the first biographical survey of artistic genius, written by a working painter who knew several of his subjects personally — a slim single volume in 1550, expanded to three books and 161 lives in a definitive 1568 edition that closes with Vasari's own 42-page autobiography. The book that invented art history as a genre and a total gap on a list otherwise deep in literary, philosophical, and scientific non-fiction.", aka: ["The Lives of the Artists", "Lives of the Artists", "Le Vite"] },
  { title: "Six Characters in Search of an Author", author: "Luigi Pirandello", why: "Six unfinished fictional characters interrupt a theater company's rehearsal, demanding someone finally stage the story their own author abandoned — the 10 May 1921 Rome premiere caused a genuine riot, audience members shouting 'madhouse' and worse before the play went on to reshape twentieth-century drama's relationship to its own artifice. Italian theater's total absence on this list, closed; its fiction (Manzoni, Calvino, Eco, Lampedusa) has never had a dramatic counterpart.", aka: ["Sei personaggi in cerca d'autore"] },
  { title: "Areopagitica", author: "John Milton", why: "Published 23 November 1644 in open defiance of the very Licensing Order it argues against — Parliament required every book pass a government censor before printing, and Milton put his own name on a pamphlet that hadn't. The first great argument for a free press, predating the concept it's now read as anticipating by a century and a half. Milton's second, independently merited entry beside his Must Read Paradise Lost — polemic prose rather than epic verse, and the founding text Mill's own On Liberty, already here, follows two centuries later." },
  { title: "The Gulag Archipelago", author: "Aleksandr Solzhenitsyn", why: "Eleven years of secret writing, built from Solzhenitsyn's own eight years in the camps plus testimony smuggled to him by 227 fellow survivors — published in Paris in 1973 once a typist under interrogation revealed a hidden copy's location, forcing his hand. Subtitled 1918-1956, it made the Soviet camp system impossible to deny abroad and cost its author his citizenship and exile within months. Closes the gap left inside this list's Holocaust-testimony cluster (If This Is a Man, Night, The Diary of a Young Girl), which had no Soviet equivalent despite Solzhenitsyn's own fiction (One Day in the Life of Ivan Denisovich) already being here.", aka: ["The Gulag Archipelago, 1918-1956"] },

  // Round 49 (2026-08-15): five picks closing structural gaps the prior 48
  // rounds hadn't reached. The Hebrew Bible closes the largest remaining
  // hole on either list — Quran, Guru Granth Sahib, Bhagavad Gita, and
  // Dhammapada are all here as scripture read for literary and historical
  // weight, but the text underlying more of this list's own DNA than any
  // other (Paradise Lost, The Scarlet Letter, East of Eden, Moby-Dick) was
  // itself absent. De Architectura closes a pure genre gap: Vasari (round
  // 48) gave this list its first work of art history, but no architectural
  // theory existed anywhere on it, despite Vitruvius's ten books being the
  // only major architectural treatise to survive from classical antiquity.
  // Al-Khwarizmi's algebra treatise closes a parallel gap in mathematics —
  // Euclid's Elements (geometry) and Newton's Principia (physics) are here,
  // but nothing represents algebra's own origin, despite both "algebra"
  // (from the book's Arabic title) and "algorithm" (from the Latinized
  // author's name) descending directly from this one text. The Natya
  // Shastra closes a gap in dramatic theory specifically: Aristotle's
  // Poetics (Must Read) is this list's sole treatise on how drama works,
  // meaning that entire category ran through the West alone despite Sanskrit
  // drama already being represented here by Shakuntala. The Book of Dede
  // Korkut closes a gap in the world-epic cluster (Gilgamesh, Beowulf, the
  // Shahnameh, the Kalevala, the Poetic Edda, Njal's Saga) — Persian,
  // Germanic, Finnish, Norse, and Icelandic epic traditions were all
  // present, but nothing represented the Turkic epic tradition. All five
  // facts (the Hebrew Bible's staged canonization, the Torah by the 5th
  // century BCE, Nevi'im by the 2nd century BCE, Ketuvim debated until
  // roughly 100 CE; De Architectura's composition c. 30-15 BCE, dedicated
  // to Augustus; Al-Jabr's composition c. 820 CE at Baghdad's House of
  // Wisdom; the Natya Shastra's compilation window of 200 BCE-200 CE within
  // a wider 500 BCE-500 CE range of scholarly estimates; Dede Korkut's oral
  // roots in the 9th-10th century CE Oghuz Turkic tradition, written down in
  // the 14th-15th century, surviving in a single 16th-century Dresden
  // manuscript of 12 tales discovered in 1815) independently verified via
  // WebSearch, continuing the practice standing since round 45.
  { title: "The Hebrew Bible", author: "Anonymous", why: "Compiled and canonized in stages across roughly a millennium: the Torah reached canonical status by the 5th century BCE following the return from Babylonian exile, the Nevi'im (Prophets) was largely fixed by the 2nd century BCE, and the Ketuvim (Writings) — the last section — remained debated until close to 100 CE. Closes this list's largest remaining gap: the Quran, Guru Granth Sahib, Bhagavad Gita, and Dhammapada are all here as scripture read for literary and historical weight, but the text with arguably the deepest influence on the rest of this very list — Paradise Lost, The Scarlet Letter, East of Eden, Moby-Dick — was itself absent.", aka: ["Tanakh", "The Tanakh", "Hebrew Scriptures", "Hebrew Bible"] },
  { title: "De Architectura", author: "Vitruvius", why: "Composed roughly 30-15 BCE and dedicated to the emperor Augustus, this is the only major work of architectural theory to survive from classical antiquity — ten books covering materials, construction, city planning, and the proportional theory of the human body that Leonardo later drew as the Vitruvian Man. Closes a pure genre gap: Vasari (round 48) gave this list its first work of art history, but nothing represented architecture, despite deep coverage of literary and philosophical non-fiction elsewhere.", aka: ["On Architecture", "The Ten Books on Architecture", "De architectura libri decem"] },
  { title: "The Compendious Book on Calculation by Completion and Balancing", author: "Muhammad ibn Musa al-Khwarizmi", why: "Written around 820 CE at the House of Wisdom in Baghdad, the source of both major words for its own field: 'algebra' from al-jabr in the book's Arabic title, and 'algorithm' from Algoritmi, the Latinized form of the author's own name that medieval European translators used for his systematic step-by-step methods. Closes a gap beside Euclid's Elements (geometry) and Newton's Principia (physics) already here — nothing on this list represented algebra's own origin.", aka: ["Al-Jabr", "Al-Jabr wa'l-Muqabala", "Kitab al-Jabr", "The Compendious Book on Calculation"] },
  { title: "The Natya Shastra", author: "Bharata Muni", why: "A Sanskrit treatise on the performing arts — 36 chapters and roughly 6,000 verses laying down principles of acting, music, dance, stagecraft, and rasa (aesthetic emotion) theory — traditionally attributed to the sage Bharata and dated by most scholarly estimates to 200 BCE-200 CE. Closes a gap that ran through the West alone: Aristotle's Poetics (Must Read) was this list's only treatise on how drama itself works, despite Sanskrit drama already being represented here by Shakuntala.", aka: ["Natyashastra", "Natya Sastra", "The Natyashastra"] },
  { title: "The Book of Dede Korkut", author: "Anonymous", why: "Twelve tales of the Oghuz Turks rooted in oral tradition dating to the 9th or 10th century CE, first written down in the 14th or 15th century as the Oghuz migrated west into Anatolia, surviving today in a single manuscript copied in 16th-century Dresden and rediscovered there in 1815. Closes the Turkic gap in this list's world-epic cluster — Gilgamesh, Beowulf, the Shahnameh, the Kalevala, the Poetic Edda, and Njal's Saga cover the Mesopotamian, Germanic, Persian, Finnish, Norse, and Icelandic traditions, but none represented the Turkic one.", aka: ["Kitab-i Dedem Korkut", "Dede Korkut", "The Book of Dede Korkut: A Turkish Epic"] },

  // Round 50 (2026-08-15, second same-day curation pass): five more picks,
  // continuing straight past round 49's five without any overlap in scope.
  // The Táin closes Ireland's absence from this list's world-epic cluster —
  // Gilgamesh, Beowulf, the Shahnameh, the Kalevala, the Poetic Edda, Njal's
  // Saga, and (round 49) the Book of Dede Korkut span Mesopotamian, Old
  // English, Persian, Finnish, Norse, Icelandic, and Turkic epic traditions,
  // but Ireland — whose Táin is routinely called the country's national
  // epic — had never been represented despite this list's deep coverage of
  // later Irish literature. The Code of Hammurabi closes a genre this list
  // had never touched at all: law itself, sitting beside Gilgamesh (epic)
  // and the Tao Te Ching (philosophy) as a third pillar of the ancient
  // Mesopotamian-adjacent world, and the oldest and longest surviving
  // written legal code from antiquity. Shannon's 1948 paper and Boyle's
  // 1661 dialogue close two hard-science gaps side by side: physics
  // (Newton, Einstein), biology (Darwin, Watson), astronomy (Galileo), and
  // mathematics (Euclid) were all represented, but chemistry as its own
  // discipline had no founding text, and information theory — the
  // mathematical bedrock under every digital communication system since —
  // had none either, despite computer science already appearing here via
  // The Mythical Man-Month; Shannon is a genuinely-novel-field pick, judged
  // on rigor and foundational status rather than age, the same substitution
  // this list already makes for Brooks's book. Zeami's Fūshikaden closes
  // the East Asian side of the dramatic-theory gap round 49 only partly
  // closed: Aristotle's Poetics (Must Read) covers the West and the Natya
  // Shastra (round 49) covers Sanskrit drama, but nothing represented Noh,
  // whose 14th-century origins make it one of the oldest major theatrical
  // traditions still actively performed. All five facts (the Táin's oldest
  // manuscript witness in the late-11th/early-12th-century Lebor na hUidre,
  // its textual roots traceable to the 7th century CE or earlier, and its
  // pre-Christian first-century CE setting; Hammurabi's code carved c. 1754
  // BCE, rediscovered at Susa in 1901, now in the Louvre; Shannon's paper
  // published in two parts in the Bell System Technical Journal, July and
  // October 1948; Boyle's dialogue published in London in 1661; Zeami's
  // Fūshikaden composed 1400-1402, kept as a secret family transmission
  // within the Kanze school and not published until texts began emerging in
  // the early 20th century, with over a dozen out by 1909) independently
  // verified via WebSearch, continuing the practice standing since round 45.
  { title: "The Táin", author: "Anonymous", why: "Ireland's national epic: the Connacht queen Medb invades Ulster to steal a prize stud bull, opposed almost single-handedly by the teenage hero Cú Chulainn. Its oldest surviving text sits in the Book of the Dun Cow (Lebor na hUidre), compiled at Clonmacnoise in the late 11th or early 12th century, though the underlying material is textually traceable to the 7th century CE or earlier and set in a pre-Christian first-century heroic age. Closes the Irish gap in this list's world-epic cluster — Gilgamesh, Beowulf, the Shahnameh, the Kalevala, the Poetic Edda, Njal's Saga, and (round 49) the Book of Dede Korkut cover the Mesopotamian, Old English, Persian, Finnish, Norse, Icelandic, and Turkic traditions, but none represented Ireland's.", aka: ["Táin Bó Cúailnge", "The Cattle Raid of Cooley", "The Tain"] },
  { title: "Code of Hammurabi", author: "Hammurabi", why: "282 laws carved onto a seven-foot basalt stele around 1754 BCE under the sixth king of Babylon's First Dynasty, covering everything from wages to false accusation to the lex talionis principle of proportional retribution — the oldest and longest surviving legal code from antiquity, and the text the entire idea of written law descends from. Rediscovered in 1901 at Susa in present-day Iran, where it had been carried off as war plunder roughly six centuries after it was carved; now in the Louvre. Closes a genre this list had never touched — nothing here represented law itself, despite deep coverage of the same ancient Mesopotamian-adjacent world through Gilgamesh (epic) and the Tao Te Ching (philosophy).", aka: ["Code of Hammurabi", "Hammurabi's Code", "Laws of Hammurabi"] },
  { title: "A Mathematical Theory of Communication", author: "Claude Shannon", why: "Published in two parts in the Bell System Technical Journal in July and October 1948, this single paper invented information theory whole — defining information mathematically as a reduction of uncertainty, formalizing the bit as its unit, and proving the channel-capacity limits every digital communication system since (modems, Wi-Fi, deep-space probes) has had to obey. James Gleick later called it the single most important development of 1948, ahead of the transistor. A genuinely-novel-field pick, judged on rigor and foundational status rather than age — the same substitution this list already makes for The Mythical Man-Month — closing computer science's information-theory gap the way Euclid and Newton anchor geometry and physics here.", aka: ["The Mathematical Theory of Communication"] },
  { title: "The Sceptical Chymist", author: "Robert Boyle", why: "Published in 1661 as a dialogue demolishing the Aristotelian four-element theory and the alchemists' three-principle model alike, replacing both with something close to the modern definition of a chemical element — a substance that cannot be broken down further by any known method. The historian J.R. Partington credited Boyle as the founder of modern chemistry largely on the strength of this one book, which insisted every claim be settled by experiment rather than inherited authority. Closes chemistry's total absence from this list's hard-science cluster: physics (Newton, Einstein), biology (Darwin, Watson), astronomy (Galileo), and mathematics (Euclid) were all here; chemistry as its own discipline was not.", aka: ["The Skeptical Chemist", "Sceptical Chymist"] },
  { title: "Fūshikaden", author: "Zeami Motokiyo", why: "Composed in stages beginning around 1400-1402 by Noh theater's own founding actor-playwright, kept as a secret transmission within his family's Kanze school rather than published, until Zeami's treatises began emerging publicly in the early 20th century, with over a dozen texts out by 1909 — Japan's first treatise on drama, part practical acting manual and part philosophy of a life spent performing, built around 'the flower' (hana), the fleeting bloom of a performer's presence that must be constantly renewed rather than mastered once. Closes the East Asian side of a dramatic-theory gap round 49 only partly closed: Aristotle's Poetics (Must Read) covers the West and the Natya Shastra (round 49) covers Sanskrit drama, but nothing here represented Noh, whose 14th-century origins make it one of the oldest major theatrical traditions still actively performed.", aka: ["Fushikaden", "Kadensho", "Style and the Flower", "Fūshi Kaden"] },

  // Round 51 (2026-08-16): five picks closing five independent world-
  // tradition gaps, continuing straight past round 50's five with no
  // overlap in scope. The Epic of Manas closes Central Asia's absence
  // from this list's world-epic cluster and gives the Turkic tradition
  // its second, genuinely distinct entry alongside round 49's Dede Korkut
  // — that one fixed the Oghuz migration into Anatolia in a 14th/15th-
  // century manuscript, this one is still a living oral practice recited
  // whole from memory by trained manaschis, and the Guinness World
  // Records holder for the world's longest epic poem at roughly 500,000
  // lines. The Knight in the Panther's Skin closes the Caucasus's total
  // absence from the same cluster — Georgia's national epic, previously
  // touched on this list only through Lermontov's A Hero of Our Time, a
  // Russian outsider's account of the region rather than a text from
  // inside it. Kebra Nagast closes the Horn of Africa's total absence,
  // distinct from Sundiata's West African griot tradition already here —
  // the text that legitimized Ethiopia's Solomonic monarchy into the 20th
  // century and later became a founding Rastafari scripture. The Egyptian
  // Book of the Dead closes ancient Egypt's total absence: this list runs
  // ancient Mesopotamia twice over (Gilgamesh, Hammurabi) and the wider
  // ancient Near East a third time (the Hebrew Bible) without ever
  // representing Egypt, one of the same era's other founding
  // civilizations. Humboldt's Personal Narrative closes a genre gap
  // distinct from this list's existing medieval travel-literature pair
  // (Marco Polo's Travels, Ibn Battuta's Rihla) — scientific field travel
  // writing rather than civilizational eyewitness account, and the book
  // Darwin carried aboard the Beagle and cited more than 400 times in his
  // own work. All five facts (Manas's roughly 500,000-line length and
  // Guinness record, its 1856 partial transcription by Chokan Valikhanov
  // and 1920s first full publication; Rustaveli's Vepkhistqaosani composed
  // c. 1180-1207 during Queen Tamar's reign and dedicated to her; the
  // Kebra Nagast's 14th-century Ge'ez compilation, most likely under
  // Emperor Amda Seyon (1314-1344); the Book of the Dead's roots in
  // Pyramid Texts (c. 2400 BCE) and Coffin Texts (c. 2000 BCE), papyrus
  // copies from c. 1550 BCE onward, and the 1250 BCE Papyrus of Ani's 1888
  // acquisition by E.A. Wallis Budge; Humboldt's Personal Narrative
  // published in seven volumes 1814-1829 and Darwin's 400-plus citations
  // of it) independently verified via WebSearch, continuing the practice
  // standing since round 45.
  { title: "The Epic of Manas", author: "Anonymous", why: "Roughly 500,000 lines long — Guinness World Records' holder for the longest epic poem, some twenty times the combined length of the Iliad and Odyssey — recited whole from memory by trained oral performers called manaschis rather than read from any fixed text; the first partial transcription came only in 1856, from the Kazakh scholar Chokan Valikhanov, and the first full published version not until the 1920s. Closes this list's Central Asian gap in the world-epic cluster: round 49's Dede Korkut covered the Oghuz Turkic tradition that migrated west into Anatolia and was fixed in a 14th/15th-century manuscript, but nothing represented the Kyrgyz steppe tradition further east, which remains a living oral practice rather than a settled text the way Gilgamesh, Beowulf, and the rest of that cluster are.", aka: ["Manas", "Epic of Manas", "Manas Epic"] },
  { title: "The Knight in the Panther's Skin", author: "Shota Rustaveli", why: "6,648 lines in the Rustavelian quatrain form Rustaveli built the poem around, composed roughly 1180-1207 during the reign of Queen Tamar of Georgia and dedicated to her in its prologue — two interwoven love stories, nominally set in Arabia and India, that became Georgia's national epic and the text credited with fixing literary Georgian for the eight centuries since. Closes the Caucasus's total absence from this list's world-epic cluster (Gilgamesh, Beowulf, the Shahnameh, the Kalevala, the Poetic Edda, Njal's Saga, Dede Korkut, the Táin, and this round's own Manas) — a region otherwise touched only through Lermontov's A Hero of Our Time, set there but written by a Russian outsider.", aka: ["Vepkhistqaosani", "The Man in the Panther's Skin", "The Knight in the Tiger's Skin"] },
  { title: "Kebra Nagast", author: "Anonymous", why: "Ethiopia's national epic, compiled in Ge'ez sometime in the 1300s — most likely during the reign of Emperor Amda Seyon (1314-1344) — from older oral and biblical material to trace the Solomonic dynasty's founder, Menelik I, to a union between King Solomon and the Queen of Sheba, and to explain how the Ark of the Covenant came to rest in Ethiopia. The text that legitimized an Ethiopian monarchy ruling into 1974, and later a founding scripture for the Rastafari movement. The Horn of Africa's total absence on this list, closed — distinct from Sundiata's West African griot tradition, already here.", aka: ["The Glory of Kings", "Glory of the Kings", "Kebra Negast"] },
  { title: "The Egyptian Book of the Dead", author: "Anonymous", why: "Not a single fixed text but an evolving collection of roughly 200 spells guiding the soul through the afterlife, rooted in Pyramid Texts dating to around 2400 BCE and Coffin Texts from around 2000 BCE, then copied onto papyrus for burial use from roughly 1550 BCE through the Ptolemaic era. Its most celebrated surviving copy, the 1250 BCE Papyrus of Ani, was cut into thirty-seven sheets and brought to the British Museum by E.A. Wallis Budge in 1888. Ancient Egypt's total absence, closed — this list already runs ancient Mesopotamia twice over (Gilgamesh, Hammurabi) and the wider ancient Near East a third time (the Hebrew Bible), but Egypt, one of the same era's other founding civilizations, had never been represented.", aka: ["Book of the Dead", "The Book of Coming Forth by Day", "Papyrus of Ani"] },
  { title: "Personal Narrative of Travels to the Equinoctial Regions of the New Continent", author: "Alexander von Humboldt", why: "Seven volumes published between 1814 and 1829, recounting Humboldt's 1799-1804 expedition across Latin America — plant geography, ocean currents, volcanic geology, and the interdependence of living systems, argued in prose rather than tabulated as data alone. Darwin carried a dog-eared copy aboard the Beagle in 1831, called it the book that first made him want to travel and observe at all, and cited Humboldt more than 400 times across his own writing. Closes a genre gap distinct from this list's existing medieval travel-literature pair — Marco Polo's Travels and Ibn Battuta's Rihla, both already here, are civilizational eyewitness accounts; this is travel writing rewired into scientific method several centuries later, and the direct link to Darwin's own On the Origin of Species, already here.", aka: ["Personal Narrative", "Personal Narrative of a Journey to the Equinoctial Regions of the New Continent"] },

  // Round 52 (2026-08-17): five picks closing five independent gaps,
  // continuing straight past round 51's five with no overlap in scope. The
  // I Ching closes a gap this list's Confucian/Daoist cluster (the
  // Analects, Mencius, the Tao Te Ching, Zhuangzi) left standing even after
  // round 49's Hebrew Bible closed the scripture gap — nothing represented
  // the older divinatory/cosmological root both traditions grew out of, and
  // its reach extends past Chinese philosophy entirely into the accidental
  // origin story of binary computation. Guido of Arezzo's Micrologus closes
  // music theory's total absence from this list — every other performing
  // art has a founding treatise here (Aristotle's Poetics for Western drama,
  // round 49's Natya Shastra for Sanskrit drama, round 50's Fūshikaden for
  // Noh) but music itself had none, despite this one short 11th-century
  // treatise being the direct ancestor of the staff notation and solfège
  // syllables still taught to every beginning musician today. Fibonacci's
  // Liber Abaci closes the numeral-system gap under this list's existing
  // mathematics cluster: Euclid's Elements (geometry, Must Read) and round
  // 49's Al-Jabr (algebra) were both here, but nothing represented the
  // Hindu-Arabic numeral system itself, the notation both are written in.
  // Comentarios Reales de los Incas closes the Andean gap in this list's
  // cluster of pre-Columbian and colonial-Indigenous civilizational texts —
  // Popol Vuh (Maya/Mesoamerica, round 41) and round 51's Kebra Nagast and
  // Egyptian Book of the Dead cover other continents' founding
  // civilizations, but Inca Peru, the Americas' other great pre-Columbian
  // empire besides the Maya/Aztec sphere, was never represented. Palladio's
  // I Quattro Libri dell'Architettura closes the half of the architecture
  // gap round 49's De Architectura left open: Vitruvius gave this list
  // antiquity's architectural theory, but nothing represented the practical
  // pattern-book tradition that carried that theory into the buildings of
  // the next four centuries, from Palladio's own executed villas through
  // Inigo Jones to Thomas Jefferson. All five facts (the I Ching's core
  // text compiled in stages during the Western Zhou dynasty and likely
  // fixed by the 9th century BCE, its Ten Wings commentaries added later
  // and the whole canonized in 136 BCE, and Leibniz's 1701 letter to the
  // Jesuit missionary Joachim Bouvet that led Bouvet to identify its
  // hexagrams with Leibniz's own new binary arithmetic; the Micrologus's
  // composition c. 1025-1026 and its solmization syllables drawn from the
  // hymn "Ut queant laxis"; Liber Abaci's 1202 composition by a Pisan
  // merchant's son who had learned arithmetic from an Arab teacher in
  // Bugia; Comentarios Reales's 1609 publication in Lisbon and its 1617
  // posthumous second part, Historia General del Perú; I Quattro Libri's
  // 1570 publication in Venice in four volumes) independently verified via
  // WebSearch, continuing the practice standing since round 45.
  { title: "I Ching", author: "Anonymous", why: "The oldest of the Chinese classics: a divination manual of 64 hexagrams built from broken and unbroken lines, its core text compiled in stages during the Western Zhou dynasty and likely fixed by the 9th century BCE, its interpretive commentaries (the 'Ten Wings') added centuries later and traditionally credited to Confucius, and the whole canonized in 136 BCE as first among the Han dynasty's Five Classics. In 1701 Leibniz described his newly invented binary arithmetic in a letter to the Jesuit missionary Joachim Bouvet in Beijing, who wrote back that same year with a diagram of the 64 hexagrams showing that Chinese scholars had been using the same binary logic — broken and unbroken lines standing in for 0 and 1 — millennia earlier. Closes a gap this list's Confucian/Daoist cluster (the Analects, Mencius, the Tao Te Ching, Zhuangzi) left standing: divination and cosmology, the root both traditions grew out of, rather than the ethical philosophy that grew from it.", aka: ["Yijing", "Yi Jing", "Book of Changes", "Zhouyi"] },
  { title: "Micrologus", author: "Guido of Arezzo", why: "Written around 1025-1026 by a Benedictine monk trying to teach choirboys new hymns faster than rote memorization allowed, this treatise introduced the four-line staff that fixed pitch to a specific vertical position for the first time, and the solmization syllables — ut-re-mi-fa-sol-la, drawn from the hymn 'Ut queant laxis' — that became do-re-mi. It was, after Boethius's own De institutione musica, the most widely copied music treatise of the Middle Ages, and its staff and solfège are the direct ancestors of the notation every musician still learns today. Closes music theory's total absence from this list.", aka: ["Micrologus de disciplina artis musicae", "Guido's Micrologus"] },
  { title: "Liber Abaci", author: "Fibonacci", why: "Written in 1202 by a Pisan merchant's son who had learned arithmetic from an Arab teacher in Bugia, on the North African coast, this book introduced Hindu-Arabic numerals and base-10 positional notation to a Europe still doing sums in Roman numerals — the zero included. Its worked problems for merchants (currency conversion, profit margins, and a rabbit-breeding puzzle that produced the sequence later named for its author) sold the new numerals on utility as much as elegance, though full European adoption still took another three centuries. Closes this list's mathematics cluster's remaining gap: Euclid's Elements (geometry, Must Read) and round 49's Al-Jabr (algebra) were both here, but nothing represented the numeral system either is written in.", aka: ["Liber Abaci", "The Book of Calculation", "Book of the Abacus"] },
  { title: "Comentarios Reales de los Incas", author: "Inca Garcilaso de la Vega", why: "Published in Lisbon in 1609, written by the son of a Spanish conquistador and an Inca princess who left Peru for Spain at twenty and spent the rest of his life reconstructing, from childhood memory and correspondence with relatives still in Cuzco, the empire that Spanish conquest had erased within a single generation. Its posthumous second part, published in 1617 as Historia General del Perú, covers the conquest itself; Garcilaso styled himself 'mestizo' in print before the word had wide currency, and the book is now widely credited as the first great work of literature by an American-born author. Closes the Andean gap in this list's cluster of pre-Columbian and colonial-Indigenous civilizational texts — Popol Vuh (Maya/Mesoamerica, round 41) and round 51's Kebra Nagast and Egyptian Book of the Dead cover other continents' founding civilizations, but Inca Peru, the Americas' other great pre-Columbian empire, was never represented.", aka: ["Comentarios Reales", "Royal Commentaries of the Incas", "The Royal Commentaries of the Incas"] },
  { title: "I Quattro Libri dell'Architettura", author: "Andrea Palladio", why: "Published in four volumes in Venice in 1570, distilling Palladio's own survey of Roman ruins and Vitruvius's ancient theory (round 49's De Architectura) into practical designs — classical orders, proportional systems, temple reconstructions, and his own executed villas, including the domed Villa Rotonda — illustrated with woodcuts after his own drawings. Translated into every major Western European language within two centuries and the direct template for Palladianism, from Inigo Jones's English country houses to Thomas Jefferson's Monticello and the University of Virginia's Rotunda, modeled explicitly on Palladio's own dome. Closes the half of round 49's architecture gap that De Architectura left open: Vitruvius gave this list antiquity's theory, but nothing represented the practical pattern-book tradition that carried that theory into the buildings of the next four centuries.", aka: ["The Four Books of Architecture", "I Quattro Libri", "Four Books on Architecture"] },

  // Round 52 canon_books reconciliation (2026-08-17, second same-day pass):
  // backfills this list's editorial side for the migration
  // `canon_books_curation_round52_2026_08_17` (source tag "curation_round52",
  // applied earlier the same day), which added Politics, Pensées, On the
  // Revolutions of the Heavenly Spheres, and Grimms' Fairy Tales straight to
  // canon_books without a matching classic.ts/must-read.ts entry — the same
  // drift pattern flagged in [[novelviz-book-coverage-strategy]] as worth
  // catching early (round 14->15 precedent). I Ching was also part of that
  // migration but is not repeated here — it already has its own entry above,
  // added independently the same day. All four judged Classic (A-tier), not
  // Must Read (S-tier): Politics joins Nicomachean Ethics and Poetics,
  // already here, continuing the standing exception that gives Aristotle
  // three Classic entries rather than the usual one-per-author default —
  // flagged, like Oedipus Rex before it, as arguably Must-Read-caliber on
  // influence alone, but calibration consistency with the rest of Aristotle's
  // placement argues for Classic. On the Revolutions of the Heavenly Spheres
  // joins The Principia and Galileo's Dialogue Concerning the Two Chief World
  // Systems, both already here, completing that three-book arc of the
  // scientific revolution (Copernicus proposes it, Galileo is tried for
  // defending it, Newton mathematically completes it) at the same tier Origin
  // of Species' Must Read promotion did not extend to the rest of this
  // cluster. Grimms' Fairy Tales joins One Thousand and One Nights, already
  // here, as this list's second great folklore-into-literature collection.
  // Pensées joins Montaigne's Essays (Must Read) as the other major work in
  // the French tradition of fragmentary personal philosophical prose, arguing
  // toward faith rather than doubt. All four facts (Politics' composition
  // c. 350 BCE across eight books, its "man is a political animal" argument;
  // Pensées' composition 1658-1662 and posthumous 1670 publication, three
  // years after Pascal's 1662 death, built around the wager argument for
  // belief under uncertainty; De revolutionibus orbium coelestium's 1543
  // Nuremberg publication, reputedly placed in Copernicus's hands only as he
  // lay dying that same year; the Grimm brothers' first 1812 edition of
  // Kinder- und Hausmärchen, expanded across seven editions through 1857)
  // independently verified via WebSearch.
  { title: "Politics", author: "Aristotle", why: "Eight books arguing the polis is the natural unit of human life — 'man is a political animal' — surveying and comparing real constitutions rather than designing an ideal one from first principles, the empirical counterweight to Plato's Republic, already here. Joins Aristotle's Nicomachean Ethics and Poetics, both already here.", aka: ["The Politics"] },
  { title: "Pensées", author: "Blaise Pascal", why: "Unfinished fragments for a planned defense of Christianity, found and published in 1670, three years after Pascal's death — includes the wager, his famous bet that believing in God is the only rational move under genuine uncertainty about his existence. The French tradition of fragmentary personal philosophical prose that Montaigne's Essays, already here, began, aimed now toward faith rather than doubt.", aka: ["Pensees", "Thoughts"] },
  { title: "On the Revolutions of the Heavenly Spheres", author: "Nicolaus Copernicus", why: "Published in Nuremberg in 1543, reputedly placed in Copernicus's hands as he lay dying that same year, proposing that the Earth orbits the sun rather than the reverse — the book that started the scientific revolution Galileo's Dialogue Concerning the Two Chief World Systems, already here, would be tried for defending and Newton's Principia, already here, would mathematically complete.", aka: ["De revolutionibus orbium coelestium", "On the Revolutions of the Celestial Spheres", "De Revolutionibus"] },
  { title: "Grimms' Fairy Tales", author: "Jacob and Wilhelm Grimm", why: "Two philologist brothers' 1812 first edition of Kinder- und Hausmärchen, expanded across seven editions through 1857 — Cinderella, Snow White, Hansel and Gretel, collected from oral sources and shaped into the template the modern fairy tale still follows. This list's second great folklore-into-literature collection, beside One Thousand and One Nights, already here.", aka: ["Grimm's Fairy Tales", "Kinder- und Hausmärchen", "Children's and Household Tales"] },

  // Round 53 non-fiction (2026-08-18), continuing straight from this
  // round's two fiction picks above with three more closing three
  // independent gaps. On Crimes and Punishments closes this list's
  // longstanding political-theory/law gap: Two Treatises, The Social
  // Contract, On Liberty, Democracy in America, The Federalist Papers, and
  // The Spirit of Laws are all here, but nothing represented the founding
  // text of modern criminal-justice reform itself — a 26-year-old
  // Milanese nobleman's 1764 case against torture and the death penalty
  // that Voltaire annotated, Catherine the Great tried to legislate, and
  // Jefferson copied into his own commonplace book. Astronomia Nova closes
  // the missing middle of this list's scientific-revolution arc: round 52
  // added On the Revolutions of the Heavenly Spheres (Copernicus proposes
  // heliocentrism) and Galileo's Dialogue Concerning the Two Chief World
  // Systems (Galileo is tried for defending it) already sit beside
  // Newton's Principia (Newton mathematically completes it) — but the
  // book that actually replaced circular orbits with ellipses, the
  // physical breakthrough Newton's laws of motion would later explain,
  // was never here. On the Sublime closes an aesthetics gap distinct from
  // this list's existing rhetoric/poetics cluster (Aristotle's Poetics,
  // already here) — a 1st-century-CE treatise of disputed authorship,
  // ignored for a millennium, then rediscovered and translated by Boileau
  // in 1674 to become the direct ancestor of Burke's and Kant's writing on
  // the sublime, neither of which is on this list on its own merits but
  // both of which take their central term from this one. All three facts
  // (On Crimes and Punishments's anonymous 1764 publication, its Voltaire
  // commentary and Jefferson commonplace-book citation; Astronomia Nova's
  // 1609 publication after Kepler's decade-long study of Mars using Tycho
  // Brahe's observational data; On the Sublime's 1st-century CE Roman-era
  // Greek composition, disputed authorship conventionally assigned to
  // "Longinus," and Boileau's 1674 French translation) independently
  // verified via WebSearch, continuing the practice standing since round
  // 45.
  { title: "On Crimes and Punishments", author: "Cesare Beccaria", why: "Published anonymously in Milan in 1764 by a 26-year-old nobleman, the founding text of modern penology — the first sustained case against torture and the death penalty, arguing punishment should be proportionate, certain, and public rather than cruel. Voltaire published an annotated French edition, Catherine the Great tried to write its principles into Russian law, and Thomas Jefferson copied passages into his own commonplace book. Closes this list's remaining political-theory/law gap: Two Treatises, The Social Contract, On Liberty, Democracy in America, The Federalist Papers, and The Spirit of Laws are all here, but nothing represented criminal-justice theory itself.", aka: ["Dei delitti e delle pene", "An Essay on Crimes and Punishments", "Of Crimes and Punishments"] },
  { title: "Astronomia Nova", author: "Johannes Kepler", why: "Published in 1609 after a ten-year study of the planet Mars built on Tycho Brahe's observational data, the book that discarded two thousand years of circular-orbit astronomy and proposed, for the first time, that planets move in ellipses. Closes the missing middle of this list's scientific-revolution arc: round 52's On the Revolutions of the Heavenly Spheres (Copernicus proposes heliocentrism) and Galileo's Dialogue Concerning the Two Chief World Systems, already here (Galileo is tried for defending it), flank Newton's Principia, already here (Newton mathematically completes it) — but the physical breakthrough connecting the two, elliptical orbits replacing circular ones, was never represented.", aka: ["New Astronomy", "Astronomia nova ΑΙΤΙΟΛΟΓΗΤΟΣ", "On the Motion of Mars"] },
  { title: "On the Sublime", author: "Longinus", why: "A Roman-era Greek treatise on literary greatness, dated to the 1st century CE and traditionally credited to a shadowy figure called Longinus, though the true author remains disputed. Effectively ignored for a millennium before Boileau's 1674 French translation gave it a second life, making it the direct ancestor of Burke's A Philosophical Enquiry into the Sublime and Beautiful and Kant's Critique of the Power of Judgment, neither on this list independently but both drawing their central term straight from this one. Closes an aesthetics gap distinct from this list's existing rhetoric cluster — Aristotle's Poetics, already here, covers dramatic structure; nothing covered the sublime itself.", aka: ["Peri Hypsous", "On Great Writing", "De Sublimitate", "Pseudo-Longinus"] },

  // Round 54 (2026-08-19): five titles closing five gaps that survived a
  // targeted sweep for categories under-represented after 53 rounds —
  // world literature outside the already-dense French/Russian/Latin
  // American clusters, and non-Western philosophy/social science, both
  // explicitly called out as under-covered. Fiction: Effi Briest (Fontane)
  // closes a real gap in German Realism — Buddenbrooks (Mann), already
  // here, is itself acknowledged (including by Mann himself) as walking
  // the road Effi Briest paved, and the two novels even share a name: a
  // minor character called Buddenbrook appears in Effi Briest's chapter
  // 28, years before Mann borrowed the name for his own family saga. And
  // Quiet Flows the Don (Sholokhov) closes this list's absence of any
  // Soviet-era Russian epic distinct from the 19th-century Tolstoy/
  // Dostoevsky cluster — a Nobel Prize (1965) specifically for "the epic
  // of the Don," covering Cossack life through WWI, the Revolution, and
  // the Civil War from inside the community it depicts. Non-fiction: The
  // Incoherence of the Philosophers (al-Ghazali) closes this list's
  // Islamic-philosophy gap — The Muqaddimah (Must Read) and Al-Jabr
  // (mathematics) represent the Islamic Golden Age's historiography and
  // mathematics, but nothing represented its philosophy, specifically the
  // c. 1095 critique of Avicenna and al-Farabi's Aristotelianism that
  // provoked Averroes' book-length rebuttal (The Incoherence of the
  // Incoherence) seventy years later — one of philosophy's great direct
  // arguments-across-decades, the same structural role Popper/Kuhn play
  // opposite each other on this list. The Yoga Sutras (Patanjali) closes
  // this list's Indian-philosophy gap left open by the Upanishads and the
  // Bhagavad Gita (both Must Read, round 38): those are devotional/
  // metaphysical texts, while this is systematic praxis — 196 aphorisms
  // across four padas organizing the eight-limbed (ashtanga) path
  // classical Yoga still trains from, a different register entirely from
  // scripture. The Interpretation of Cultures (Geertz) closes this list's
  // total absence of anthropology as its own discipline — Tristes
  // Tropiques (Lévi-Strauss) and Malinowski's fieldwork are both here, but
  // neither represents the interpretive turn Geertz's 1973 essay
  // collection (esp. "Thick Description") caused, still the standard
  // starting point for "what does 'culture' even mean" in the field.
  // Judged on rigor/reference-point status rather than hard Lindy age for
  // this one specifically, flagged per the standing rule for fields where
  // the Lindy filter alone underserves a genuinely foundational, still-
  // load-bearing text (same substitution basis as Shannon/round-50 and
  // Mythical Man-Month). All five facts (Effi Briest's Oct 1894–Mar 1895
  // Deutsche Rundschau serialization and 1895 book publication, Mann's
  // 1919 essay naming it one of "the six most significant novels ever
  // written," and the chapter-28 Buddenbrook cameo; And Quiet Flows the
  // Don's 1928–1940 four-volume publication and Sholokhov's 1965 Nobel
  // citation; Tahafut al-Falasifa's c. 1095 composition attacking Avicenna
  // and al-Farabi, and Averroes' Tahafut al-Tahafut rebuttal; the Yoga
  // Sutras' 196 aphorisms, four padas, and ashtanga's eight limbs first
  // named in sutra 2.29; The Interpretation of Cultures's 1973 Basic Books
  // publication and its "Thick Description" opening essay) independently
  // verified via WebSearch.
  { title: "Effi Briest", author: "Theodor Fontane", why: "A seventeen-year-old married off to a much older baron, then slowly suffocated by Prussian propriety and a long-past affair that catches up with her — serialized in 1894–95 and judged Fontane's masterpiece of German Realism. Thomas Mann called it one of 'the six most significant novels ever written' and it directly paved the way for his own Buddenbrooks, already here; a minor character named Buddenbrook even appears in Effi Briest's chapter 28, years before Mann borrowed the name.", aka: ["Effi Briest: A Novel"] },
  { title: "And Quiet Flows the Don", author: "Mikhail Sholokhov", why: "Don Cossack life torn apart across four volumes (1928–1940) by the First World War, the Revolution, and the Civil War that follows — the epic that won Sholokhov the 1965 Nobel Prize in Literature 'for the artistic power and integrity with which... he has given expression to a historic phase in the life of the Russian people.' This list's Soviet-era Russian epic, distinct from the 19th-century Tolstoy/Dostoevsky cluster already here.", aka: ["The Quiet Don", "Tikhy Don", "Tikhii Don"] },
  { title: "The Incoherence of the Philosophers", author: "Al-Ghazali", why: "Written around 1095, a systematic attack on twenty metaphysical claims of the Islamic Aristotelian philosophers — chiefly Avicenna and al-Farabi — using their own logical methods to argue their conclusions never met the demonstrative rigor they claimed. Provoked one of philosophy's great direct rebuttals seventy years later: Averroes' book-length The Incoherence of the Incoherence, arguing point by point that al-Ghazali had misread the philosophers he attacked. Closes this list's Islamic-philosophy gap beside The Muqaddimah (Must Read) and Al-Jabr, already here, which cover historiography and mathematics but not philosophy itself.", aka: ["Tahafut al-Falasifa", "The Incoherence of the Philosophers"] },
  { title: "The Yoga Sutras", author: "Patanjali", why: "196 aphorisms compiled around 400 CE across four padas (chapters), organizing what the text itself names ashtanga — the eight-limbed path from ethical restraint through posture and breath control to absorption — into classical Yoga's founding systematic text. Distinct in register from the Upanishads and the Bhagavad Gita, both Must Read: those are devotional and metaphysical, this is a practice manual, one of Hindu philosophy's six orthodox schools built on a single book.", aka: ["Yoga Sutras of Patanjali", "Patanjali's Yoga Sutras", "Yogasutra"] },
  { title: "The Interpretation of Cultures", author: "Clifford Geertz", why: "A 1973 essay collection built around 'Thick Description,' arguing culture is a web of significance people spin themselves and anthropology's job is to interpret it, not just catalog it — still the standard starting point for what 'culture' means as an analytic term, across anthropology and well beyond it. Closes this list's total absence of anthropology as its own discipline: Tristes Tropiques (Lévi-Strauss) and Malinowski's fieldwork are both here, but neither represents the interpretive turn this book caused. A rigor/reference-point pick rather than a hard-Lindy one — flagged per this list's standing practice for fields the age filter alone underserves.", aka: ["Interpretation of Cultures", "The Interpretation of Cultures: Selected Essays"] },

  // 2026-08-19 (daily curation pass, round 55): five titles closing
  // specialist-field gaps — law, medicine, Pacific/Oceania mythology,
  // authored Central Asian poetry, and game theory. Deep enough into this
  // list now that remaining gaps are field-founding rather than
  // towering-for-general-readers; none rise to Must Read's bar.
  { title: "The Institutes of Justinian", author: "Justinian I", why: "Commissioned by Emperor Justinian I and compiled by a team led by the jurist Tribonian, this four-part codification — Codex, Digest, Institutes, and Novellae — was completed between 529 and 534 CE, distilling a thousand years of Roman legal opinion into a single, teachable system. Rediscovered and taught across medieval Europe from the 11th century onward, it became the direct root of the civil-law tradition that governs most of the world outside the English-speaking common-law sphere today — France's Napoleonic Code and Germany's BGB both trace their lineage straight back to it. Closes this list's remaining gap in law itself: Hammurabi's Code (round 50) is the ancient Near East's founding legal document and Beccaria's On Crimes and Punishments (round 53) reformed criminal law two millennia later, but the actual source of the world's dominant legal tradition was never here.", aka: ["Corpus Juris Civilis", "Institutiones", "Justinian's Code", "Body of Civil Law"] },
  { title: "The Hippocratic Corpus", author: "Hippocrates", why: "A collection of roughly sixty medical treatises gathered under Hippocrates' name — traditionally associated with the Library of Alexandria's 3rd-century-BCE cataloguing — though composed by multiple hands across the 5th and 4th centuries BCE; its most famous single passage, the Hippocratic Oath, is now widely thought not to be Hippocrates' own work but became the profession's ethical touchstone regardless. 'On the Sacred Disease' opens by flatly rejecting epilepsy's supposed divine origin, making this the first sustained argument that disease has natural, observable causes — the founding text of Western clinical medicine as an evidence-based discipline. Distinct from Avicenna's Canon of Medicine, already here, which synthesizes and systematizes centuries later and cites this corpus throughout as its own starting point.", aka: ["Hippocratic Writings", "Corpus Hippocraticum", "The Hippocratic Oath"] },
  { title: "The Kumulipo", author: "Anonymous", why: "A roughly 2,100-line genealogical creation chant tracing the Hawaiian cosmos from primordial darkness through coral polyps, fish, and birds up to the birth of the chiefly line it was composed to honor — likely composed around 1700 CE, transmitted orally for generations until Queen Liliʻuokalani, writing after the 1893 overthrow of the Hawaiian Kingdom, translated it into English and published it in 1897 specifically so it would survive. The single most important text in Hawaiian oral literature, and Pacific/Oceania's total absence from this list's world-cosmogony cluster, closed — Popol Vuh (round 41), Kebra Nagast, and the Egyptian Book of the Dead (both round 51) cover the Americas, the Horn of Africa, and ancient Egypt's founding cosmologies, but no Pacific tradition had ever been represented.", aka: ["Kumulipo", "He Kumulipo", "A Hawaiian Creation Chant"] },
  { title: "Khamsa", author: "Alisher Navoi", why: "Five narrative poems — including Farhad and Shirin and a Layli and Majnun retelling — composed in Chagatai Turkic between 1483 and 1485 by the poet-statesman who set out to prove a Turkic language could carry the same literary weight as Persian, the region's prestige language at the time; Navoi is still called the father of Uzbek and, more broadly, Central Asian Turkic literature, and UNESCO marked his 550th birth-year with an international commemorative year in 1991. Closes a Central Asian gap distinct from this list's existing entries from the region: the Epic of Manas (round 51) is Kyrgyz oral performance and the Book of Dede Korkut (round 49) is an Oghuz oral cycle fixed centuries after composition, while Navoi is deliberately authored, written-down literary poetry — the same register as Ferdowsi's Shahnameh, already here.", aka: ["Khamsa of Navoi", "The Five Poems", "Hamsa"] },
  { title: "Theory of Games and Economic Behavior", author: "John von Neumann and Oskar Morgenstern", why: "Published in 1944, this six-hundred-page collaboration between a mathematician and an economist founded game theory as a mathematical discipline — the minimax theorem and expected-utility axioms it formalizes are what John Nash's own equilibrium concept would extend seven years later. Still the reference point every subsequent result in strategic decision theory, from Cold War deterrence modeling to modern auction design, has had to build on rather than around. Closes a gap sitting at the exact intersection this list had never filled from either side — its mathematics cluster (Euclid's geometry, Al-Khwarizmi's algebra, Fibonacci's numerals, Shannon's information theory) and its economics bench (Smith, Ricardo, Marx, Keynes, Hayek, Friedman, Schumpeter) both stop just short of it.", aka: ["Theory of Games and Economic Behaviour"] },

  // 2026-08-20 (daily curation pass, round 56): five titles closing two
  // gaps — national epic poetry's two largest remaining absences, and a
  // trio of the empirical sciences' own founding texts. Grepped a fresh
  // candidate pool first — "Roland", "Cid", "Vesalius", "Lavoisier",
  // "Mendel" — across both lists; all confirmed genuine zero-hits.
  // Fiction: this list has built out national epic poetry extensively
  // across three years of rounds (Gilgamesh, Beowulf, the Shahnameh, the
  // Ramayana and Mahabharata, the Kalevala, Njal's Saga and the Poetic
  // Edda, the Book of Dede Korkut, the Epic of Manas, the Knight in the
  // Panther's Skin, Sundiata, the Mabinogion, the Lusiads) but had never
  // closed its two largest remaining holes: France and Spain. The Song of
  // Roland (Anonymous, traditionally credited to a scribe named Turold,
  // composed c. 1040–1115) is the oldest surviving major work of French
  // literature and the founding chanson de geste — Charlemagne's rearguard
  // annihilated at Roncevaux, Roland refusing to sound his horn for help
  // until it's too late out of pure stubborn pride. The Cantar de Mio Cid
  // (Anonymous, composed c. 1140–1207) is the oldest preserved Castilian
  // epic, following the historical knight Rodrigo Díaz de Vivar through
  // exile and reconquest — Spain's national epic the same way the Lusiads,
  // already here, are Portugal's. Non-fiction: three founding texts of the
  // empirical sciences, placed as a deliberate trio the same way Euclid/
  // Newton and Vesalius/Lavoisier's own near-contemporaries were paired
  // earlier on this list — each is the moment its discipline broke from
  // inherited authority and started testing the world directly. On the
  // Fabric of the Human Body (Andreas Vesalius, 1543) is the founding text
  // of modern anatomy: the first major treatise based on Vesalius's own
  // human dissections rather than Galen's centuries-old animal-derived
  // anatomy, correcting over two hundred of Galen's errors and setting
  // medicine on the empirical course that led to Harvey's discovery of
  // blood circulation eighty-five years later — distinct from the
  // Hippocratic Corpus (round 55, ancient clinical observation) and
  // Avicenna's Canon of Medicine, already here (medieval synthesis),
  // neither of which involved systematic human dissection. Elements of
  // Chemistry (Antoine Lavoisier, 1789) is chemistry's first modern
  // textbook, built on Lavoisier's own experiments establishing the
  // conservation of mass and a reformed chemical nomenclature still
  // recognizably in use today — distinct from Boyle's The Sceptical
  // Chymist, already here (a 1661 critique of alchemical theory, not yet a
  // positive systematic discipline). Experiments on Plant Hybridization
  // (Gregor Mendel, delivered as two 1865 lectures, published 1866) is
  // genetics' founding text: eight years and 29,000 pea plants distilled
  // into the paired discrete units of inheritance now called genes,
  // ignored for thirty-five years until its rediscovery around 1900 — the
  // missing mechanism Darwin's On the Origin of Species (Must Read) needed
  // and never had. All five facts (Roland's c. 1040–1115 composition
  // window and Oxford manuscript dating, the Cid's c. 1140–1207 composition
  // and Per Abbat's 1207 copy, Vesalius's 1543 publication and correction
  // of two hundred-plus Galenic errors, Lavoisier's 1789 Traité and
  // conservation-of-mass formulation, Mendel's 1865 lectures/1866
  // publication and 29,000-plant pea study) independently verified via
  // WebSearch rather than trusted from recall. All five clear the Lindy/
  // A-tier bar with room to spare; none rise to Must Read's "unmissable"
  // bar — the three science texts sit at Classic on the same "importance
  // outweighs sit-down-and-read-it" tier as Euclid, Newton, and Kepler
  // already here, not a step above them.
  { title: "The Song of Roland", author: "Anonymous", why: "Charlemagne's rearguard is annihilated at Roncevaux while Roland, too proud to sound his horn for help until it's too late, holds the pass to the death — composed c. 1040–1115, the oldest surviving major work of French literature and the founding chanson de geste. France's national epic, closing this list's last major gap in the epic-poetry cluster built up alongside the Lusiads, the Shahnameh, and the Nibelungenlied's Iberian and Persian counterparts.", aka: ["Chanson de Roland", "La Chanson de Roland"] },
  { title: "Cantar de Mio Cid", author: "Anonymous", why: "The historical knight Rodrigo Díaz de Vivar is exiled by his king, wins back honor and territory by the sword, and marries his daughters into royalty — composed c. 1140–1207, the oldest preserved Castilian epic poem and the founding text of Spanish literature. Spain's national epic, the same role the Lusiads, already here, play for Portugal.", aka: ["El Cid", "Cantar de mio Cid", "The Poem of the Cid", "Song of the Cid"] },
  { title: "On the Fabric of the Human Body", author: "Andreas Vesalius", why: "Published in 1543 and built on Vesalius's own human dissections rather than Galen's centuries-old animal-derived anatomy, correcting over two hundred of Galen's errors along the way — the founding text of modern anatomy, and the empirical course that led directly to Harvey's discovery of blood circulation eighty-five years later. Distinct from the Hippocratic Corpus (round 55) and Avicenna's Canon of Medicine, already here, neither of which involved systematic human dissection.", aka: ["De Humani Corporis Fabrica", "De humani corporis fabrica libri septem"] },
  { title: "Elements of Chemistry", author: "Antoine Lavoisier", why: "Chemistry's first modern textbook, published in 1789 and built on Lavoisier's own experiments establishing the conservation of mass and a reformed chemical nomenclature still recognizably in use today. Distinct from Boyle's The Sceptical Chymist, already here — a 1661 critique of alchemical theory, not yet the positive systematic discipline Lavoisier founded.", aka: ["Traité élémentaire de chimie", "Elementary Treatise on Chemistry"] },
  { title: "Experiments on Plant Hybridization", author: "Gregor Mendel", why: "Eight years and 29,000 pea plants distilled into the paired discrete units of inheritance now called genes — delivered as two lectures in 1865, published in 1866, then ignored for thirty-five years until its rediscovery around 1900. Genetics' founding text, and the missing mechanism Darwin's On the Origin of Species (Must Read) needed and never had.", aka: ["Experiments in Plant Hybridization", "Versuche über Pflanzen-Hybriden", "Experiments on Plant Hybridisation"] },
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
