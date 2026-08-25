// Seed-cache book list, part 4/4 (split for deploy-transport size limits — see novelviz-feedback-deploy-edge-function-size-limit memory).
export const BOOKS_4: string[] = [
  // Lawrence, Novik, McCaffrey); literary/alt comics (Chris Ware, Charles
  // Burns, Kirkman, Clowes, O'Malley, Emil Ferris — "Ferris" false-matched
  // Tim Ferriss's extra S on a naive grep, confirmed a real gap on close
  // read); and theater/travel writing (Shakespeare — a full zero, not even
  // Hamlet or Macbeth were present; Ibsen, O'Neill, Stoppard, August
  // Wilson — distinct from already-covered Robert Charles Wilson/E.O.
  // Wilson; Pinter; Pico Iyer, Peter Matthiessen, Colin Thubron, Rory
  // Stewart). Verified "Robinson" wasn't a false positive against
  // already-covered Marilynne Robinson/James A. Robinson, and "Brooks"
  // wasn't already covered via Max Brooks. Added 1-3 titles per author
  // (39 total).
  "Dying Inside by Robert Silverberg",
  "Lord of Light by Roger Zelazny",
  "Nine Princes in Amber by Roger Zelazny",
  "Perdido Street Station by China Miéville",
  "The City & The City by China Miéville",
  "Consider Phlebas by Iain M. Banks",
  "The Player of Games by Iain M. Banks",
  "Revelation Space by Alastair Reynolds",
  "Twenty Thousand Leagues Under the Sea by Jules Verne",
  "Journey to the Center of the Earth by Jules Verne",
  "Red Mars by Kim Stanley Robinson",
  "Doomsday Book by Connie Willis",
  "The Colour of Magic by Terry Pratchett",
  "The Sword of Shannara by Terry Brooks",
  "Magician by Raymond E. Feist",
  "The Dragonbone Chair by Tad Williams",
  "Tigana by Guy Gavriel Kay",
  "Gardens of the Moon by Steven Erikson",
  "Prince of Thorns by Mark Lawrence",
  "Uprooted by Naomi Novik",
  "Dragonflight by Anne McCaffrey",
  "Jimmy Corrigan: The Smartest Kid on Earth by Chris Ware",
  "Black Hole by Charles Burns",
  "The Walking Dead by Robert Kirkman",
  "Ghost World by Daniel Clowes",
  "Scott Pilgrim's Precious Little Life by Bryan Lee O'Malley",
  "My Favorite Thing Is Monsters by Emil Ferris",
  "Hamlet by William Shakespeare",
  "Macbeth by William Shakespeare",
  "A Midsummer Night's Dream by William Shakespeare",
  "A Doll's House by Henrik Ibsen",
  "Long Day's Journey Into Night by Eugene O'Neill",
  "Rosencrantz and Guildenstern Are Dead by Tom Stoppard",
  "Fences by August Wilson",
  "The Birthday Party by Harold Pinter",
  "The Art of Stillness by Pico Iyer",
  "The Snow Leopard by Peter Matthiessen",
  "In Siberia by Colin Thubron",
  "The Places in Between by Rory Stewart",

  // ── Author-gap-scan round 11 (2026-07-15, daily agent) ──────────────────────
  // Scanned contemporary literary/Booker-adjacent, Southern Gothic/American
  // regional, spy-noir-hardboiled crime, business/leadership nonfiction, and
  // African/Caribbean/postcolonial literature — five categories no prior round
  // had touched. Scanned 70 names. Most Booker-adjacent heavyweights (Zadie
  // Smith, McEwan, Julian Barnes, Mantel, Marlon James, Evaristo, Douglas
  // Stuart, Eleanor Catton, Saunders, Egan, Strout, Patchett, Powers, Doerr,
  // Kingsolver, Franzen, Tartt) and most African/postcolonial majors (Achebe,
  // Adichie, Dangarembga, Yaa Gyasi — used as the sanity-check, confirmed
  // covered via "Ngugi wa Thiong'o" without diacritics, itself already
  // covered too) and most business staples (Sinek, Duhigg, Chip/Dan Heath,
  // Cialdini, Ben Horowitz, Jim Collins, Eric Ries, Ray Dalio, Christensen,
  // Phil Knight, Reid Hoffman) were already covered. Found 25 genuine
  // zero-hit gaps: Booker-adjacent (Shehan Karunatilaka, Damon Galgut);
  // Southern Gothic (Flannery O'Connor, Carson McCullers, Eudora Welty,
  // Larry McMurtry, Barry Hannah, Ron Rash, Robert Penn Warren — "Hannah"
  // false-positive-checked against already-covered Hannah Arendt/Kristin
  // Hannah/Hannah Grace, Barry Hannah himself was a real zero); spy-noir
  // (Len Deighton, Mick Herron, James Ellroy, Elmore Leonard, Walter Mosley,
  // Chester Himes, Don Winslow, Dennis Lehane — note the task's "Denis"
  // spelling was a typo, correct is "Dennis Lehane"; le Carré, Greene,
  // Hammett, Chandler already covered); business (Patrick Lencioni only —
  // caught two false negatives before concluding gaps: "Peter Drucker" and
  // "Daniel Pink" bare-surname greps missed existing entries because the
  // array uses their full middle-initial forms "Peter F. Drucker" and
  // "Daniel H. Pink", both already covered); African/Caribbean/postcolonial
  // (Wole Soyinka, Buchi Emecheta, NoViolet Bulawayo, Jamaica Kincaid, Derek
  // Walcott, Edwidge Danticat, Teju Cole). Added 2 titles per author (50
  // total).
  "The Seven Moons of Maali Almeida by Shehan Karunatilaka",
  "Chinaman: The Legend of Pradeep Mathew by Shehan Karunatilaka",
  "The Promise by Damon Galgut",
  "In a Strange Room by Damon Galgut",
  "Wise Blood by Flannery O'Connor",
  "A Good Man Is Hard to Find by Flannery O'Connor",
  "The Heart Is a Lonely Hunter by Carson McCullers",
  "The Member of the Wedding by Carson McCullers",
  "The Optimist's Daughter by Eudora Welty",
  "Delta Wedding by Eudora Welty",
  "Lonesome Dove by Larry McMurtry",
  "The Last Picture Show by Larry McMurtry",
  "Geronimo Rex by Barry Hannah",
  "Airships by Barry Hannah",
  "Serena by Ron Rash",
  "The Cove by Ron Rash",
  "All the King's Men by Robert Penn Warren",
  "World Enough and Time by Robert Penn Warren",
  "The Ipcress File by Len Deighton",
  "Funeral in Berlin by Len Deighton",
  "Slow Horses by Mick Herron",
  "Dead Lions by Mick Herron",
  "L.A. Confidential by James Ellroy",
  "The Black Dahlia by James Ellroy",
  "Get Shorty by Elmore Leonard",
  "Out of Sight by Elmore Leonard",
  "Devil in a Blue Dress by Walter Mosley",
  "A Red Death by Walter Mosley",
  "A Rage in Harlem by Chester Himes",
  "Cotton Comes to Harlem by Chester Himes",
  "The Power of the Dog by Don Winslow",
  "The Cartel by Don Winslow",
  "Mystic River by Dennis Lehane",
  "Gone, Baby, Gone by Dennis Lehane",
  "The Five Dysfunctions of a Team by Patrick Lencioni",
  "The Advantage by Patrick Lencioni",
  "Death and the King's Horseman by Wole Soyinka",
  "The Man Died: Prison Notes by Wole Soyinka",
  "The Joys of Motherhood by Buchi Emecheta",
  "Second-Class Citizen by Buchi Emecheta",
  "We Need New Names by NoViolet Bulawayo",
  "Glory by NoViolet Bulawayo",
  "Annie John by Jamaica Kincaid",
  "A Small Place by Jamaica Kincaid",
  "Omeros by Derek Walcott",
  "Collected Poems 1948-1984 by Derek Walcott",
  "Breath, Eyes, Memory by Edwidge Danticat",
  "The Farming of Bones by Edwidge Danticat",
  "Open City by Teju Cole",
  "Every Day Is for the Thief by Teju Cole",

  // ── Author-gap-scan round 12 (2026-07-16, daily agent) ─────────────────────
  // Scanned ancient epic/philosophy, political theory, 19th-century European
  // and Russian fiction, and world literature (Latin America, Brazil, Egypt,
  // India, China) against the array — categories the array's "Philosophy /
  // Classics" and "Literary Fiction – European/International" sections
  // nominally cover but had real zero-hit gaps in. Machiavelli, Sun Tzu,
  // Nietzsche, Flaubert, Zola, Borges, García Márquez, Darwin, Jung, Kant,
  // Dante, Cervantes, Goethe (author), Odyssey, Confucius, Lao Tzu, Marcus
  // Aurelius, Plutarch, Seneca, Hobbes, Locke, Rousseau, Adam Smith,
  // Kierkegaard, Schopenhauer, Dostoevsky, and Tolstoy were all confirmed
  // already covered (checked before adding anything below). Found 39 genuine
  // zero-hit gaps: ancient/epic (Epic of Gilgamesh, Homer's Iliad specifically
  // — Odyssey was covered but Iliad wasn't, Sappho, Mahabharata and Ramayana
  // via R.K. Narayan's standard retellings, Bhagavad Gita); political/economic
  // philosophy (Lucretius, Clausewitz, Gibbon, Tocqueville, Montesquieu, Ibn
  // Khaldun, Al-Ghazali, Omar Khayyam, Boccaccio); German (Goethe's Faust
  // specifically, Schiller, Hegel); 19th-c. European/Russian fiction (Balzac,
  // Maupassant, Hugo's Les Misérables specifically, Pushkin, Gogol, Turgenev,
  // Lermontov); world literature (Machado de Assis, Guimarães Rosa, Clarice
  // Lispector, Vargas Llosa, Cortázar, Naguib Mahfouz, Tagore, Premchand,
  // R.K. Narayan's own fiction); science/psychology classics (Freud, Newton,
  // Euclid). Added 1-2 titles per author across 39 authors (54 titles total).
  "The Epic of Gilgamesh by N.K. Sandars",
  "The Iliad by Homer",
  "If Not, Winter: Fragments of Sappho by Sappho",
  "The Mahabharata by R.K. Narayan",
  "The Ramayana by R.K. Narayan",
  "The Bhagavad Gita by Eknath Easwaran",
  "Romance of the Three Kingdoms by Luo Guanzhong",
  "Journey to the West by Wu Cheng'en",
  "Dream of the Red Chamber by Cao Xueqin",
  "On the Nature of Things by Lucretius",
  "On War by Carl von Clausewitz",
  "The Decline and Fall of the Roman Empire by Edward Gibbon",
  "Democracy in America by Alexis de Tocqueville",
  "The Spirit of the Laws by Montesquieu",
  "The Muqaddimah by Ibn Khaldun",
  "The Alchemy of Happiness by Al-Ghazali",
  "The Rubaiyat of Omar Khayyam by Omar Khayyam",
  "The Decameron by Giovanni Boccaccio",
  "Faust by Johann Wolfgang von Goethe",
  "Wilhelm Tell by Friedrich Schiller",
  "Phenomenology of Spirit by G.W.F. Hegel",
  "Père Goriot by Honoré de Balzac",
  "Eugénie Grandet by Honoré de Balzac",
  "Bel-Ami by Guy de Maupassant",
  "A Life by Guy de Maupassant",
  "Les Misérables by Victor Hugo",
  "Eugene Onegin by Alexander Pushkin",
  "The Captain's Daughter by Alexander Pushkin",
  "Dead Souls by Nikolai Gogol",
  "The Overcoat and Other Stories by Nikolai Gogol",
  "Fathers and Sons by Ivan Turgenev",
  "First Love by Ivan Turgenev",
  "A Hero of Our Time by Mikhail Lermontov",
  "Dom Casmurro by Machado de Assis",
  "The Posthumous Memoirs of Brás Cubas by Machado de Assis",
  "The Devil to Pay in the Backlands by João Guimarães Rosa",
  "The Hour of the Star by Clarice Lispector",
  "Near to the Wild Heart by Clarice Lispector",
  "The Feast of the Goat by Mario Vargas Llosa",
  "Conversation in the Cathedral by Mario Vargas Llosa",
  "Hopscotch by Julio Cortázar",
  "Blow-Up and Other Stories by Julio Cortázar",
  "Palace Walk by Naguib Mahfouz",
  "Midaq Alley by Naguib Mahfouz",
  "Gitanjali by Rabindranath Tagore",
  "The Home and the World by Rabindranath Tagore",
  "Godaan by Munshi Premchand",
  "The Guide by R.K. Narayan",
  "The Interpretation of Dreams by Sigmund Freud",
  "Civilization and Its Discontents by Sigmund Freud",
  "The Principia by Isaac Newton",
  "The Elements by Euclid",
  // ── Author-gap-scan round 13 (2026-07-18, daily agent) — closing gaps against classic.ts/must-read.ts ──
  "Shakuntala by Kalidasa",
  "The Shahnameh by Ferdowsi",
  "One Thousand and One Nights by Anonymous",
  "The Tale of the Heike by Anonymous",
  "Water Margin by Shi Nai'an",
  "Njal's Saga by Anonymous",
  "The Canterbury Tales by Geoffrey Chaucer",
  "Orlando Furioso by Ludovico Ariosto",
  "The Lusiads by Luís de Camões",
  "The Faerie Queene by Edmund Spenser",
  "Tartuffe by Molière",
  "Robinson Crusoe by Daniel Defoe",
  "Tom Jones by Henry Fielding",
  "Tristram Shandy by Laurence Sterne",
  "Dangerous Liaisons by Pierre Choderlos de Laclos",
  "The Betrothed by Alessandro Manzoni",
  "Vanity Fair by William Makepeace Thackeray",
  "Barchester Towers by Anthony Trollope",
  "Oblomov by Ivan Goncharov",
  "The Red Badge of Courage by Stephen Crane",
  "Sister Carrie by Theodore Dreiser",
  "The Woman in White by Wilkie Collins",
  "Tess of the d'Urbervilles by Thomas Hardy",
  "Buddenbrooks by Thomas Mann",
  "The Good Soldier by Ford Madox Ford",
  "Sons and Lovers by D.H. Lawrence",
  "Brideshead Revisited by Evelyn Waugh",
  "The Good Soldier Švejk by Jaroslav Hašek",
  "The Man Without Qualities by Robert Musil",
  "Berlin Alexanderplatz by Alfred Döblin",
  "Journey to the End of the Night by Louis-Ferdinand Céline",
  "The Plague by Albert Camus",
  "Independent People by Halldór Laxness",
  "Wide Sargasso Sea by Jean Rhys",
  "A House for Mr Biswas by V.S. Naipaul",
  "Austerlitz by W.G. Sebald",
  "Suite Française by Irène Némirovsky",
  "Life and Fate by Vasily Grossman",
  "A Confederacy of Dunces by John Kennedy Toole",
  "Rabbit, Run by John Updike",
  "The Death of Artemio Cruz by Carlos Fuentes",
  "Kristin Lavransdatter by Sigrid Undset",
  "The Palm-Wine Drinkard by Amos Tutuola",
  "Cry, the Beloved Country by Alan Paton",
  "July's People by Nadine Gordimer",
  "Petals of Blood by Ngũgĩ wa Thiong'o",
  "Silence by Shūsaku Endō",
  "Rashomon and Other Stories by Ryūnosuke Akutagawa",
  "A Suitable Boy by Vikram Seth",
  "Untouchable by Mulk Raj Anand",
  "Lucky Jim by Kingsley Amis",
  "The History of the Peloponnesian War by Thucydides",
  "The Annals by Tacitus",
  "The Consolation of Philosophy by Boethius",
  "An Enquiry Concerning Human Understanding by David Hume",
  "A Vindication of the Rights of Woman by Mary Wollstonecraft",
  "The Federalist Papers by Alexander Hamilton",
  "On the Genealogy of Morals by Friedrich Nietzsche",
  "The Varieties of Religious Experience by William James",
  "The Protestant Ethic and the Spirit of Capitalism by Max Weber",
  "The Souls of Black Folk by W.E.B. Du Bois",
  "Being and Time by Martin Heidegger",
  "Philosophical Investigations by Ludwig Wittgenstein",
  "Notes of a Native Son by James Baldwin",
  "The Autobiography of Benjamin Franklin by Benjamin Franklin",
  "Walden by Henry David Thoreau",
  "Narrative of the Life of Frederick Douglass by Frederick Douglass",
  "Democracy and Education by John Dewey",
  "The Wretched of the Earth by Frantz Fanon",
  "Orientalism by Edward Said",
  "The Feminine Mystique by Betty Friedan",
  "The General Theory of Employment, Interest and Money by John Maynard Keynes",
  "Gulliver's Travels by Jonathan Swift",
  "Heart of Darkness by Joseph Conrad",
  "The Magic Mountain by Thomas Mann",
  "The Radetzky March by Joseph Roth",
  "The Book of Disquiet by Fernando Pessoa",
  "The Leopard by Giuseppe Tomasi di Lampedusa",
  "Poetics by Aristotle",
  "A Room of One's Own by Virginia Woolf",

  // ── Round 14 (2026-07-19) — closing residual gaps vs. classic.ts/must-read.ts's
  // same-day additions (King Lear promoted into Must Read; The Tale of Kiều, The
  // Nine Cloud Dream, and Lazarillo de Tormes added to Classic) — Euclid's Elements
  // and Newton's Principia, also added to classic.ts today, were already covered
  // here from round 12 (2026-07-16), so only these four were genuinely missing ──
  "King Lear by William Shakespeare",
  "The Tale of Kiều by Nguyễn Du",
  "The Nine Cloud Dream by Kim Man-jung",
  "Lazarillo de Tormes by Anonymous",

  // ── Round 15 (2026-07-20) — closing residual gaps vs. classic.ts's same-day
  // additions (5 Nobel-laureate-anchored national traditions + Jung). Death and
  // the King's Horseman (Soyinka) and My Name Is Red (Pamuk) were already covered
  // here from round 11's (2026-07-15) postcolonial/international sweep, so only
  // these four were genuinely missing ──
  "The Bridge on the Drina by Ivo Andrić",
  "Fatelessness by Imre Kertész",
  "Only Yesterday by S.Y. Agnon",
  "Memories, Dreams, Reflections by Carl Jung",

  // ── Round 16 (2026-07-21) — closing residual gaps vs. classic.ts's same-day
  // additions (WWI fiction, a second Woolf work, a linguistics/anthropology
  // non-fiction pair, and the third angle of the Holocaust-testimony triangle).
  // All Quiet on the Western Front, Mrs Dalloway, and Night were already
  // covered here from earlier rounds, so only these two were genuinely missing ──
  "Course in General Linguistics by Ferdinand de Saussure",
  "Tristes Tropiques by Claude Lévi-Strauss",

  // ── Round 17 (2026-07-22) — closing residual gaps vs. classic.ts's same-day
  // additions (lyric poetry, Chinese/Sufi philosophy, classical economics, and
  // the graphic-novel gap). Sappho (already covered here since round 11 under
  // "If Not, Winter: Fragments of Sappho"), Leaves of Grass, Night, and Maus
  // were already covered here from earlier rounds, so only these three were
  // genuinely missing ──
  "The Zhuangzi by Zhuangzi",
  "The Masnavi by Rumi",
  "An Essay on the Principle of Population by Thomas Malthus",

  // ── Round 18 (2026-07-23) — closing residual gaps vs. classic.ts's same-day
  // additions (detective fiction and scientific romance's founding titles,
  // plus the children's/fable gap). The Time Machine and Twenty Thousand
  // Leagues Under the Sea were already covered here from earlier rounds
  // (sci-fi ancestor sweeps), so only these two genre-founding pairs were
  // genuinely missing ──
  "The Murders in the Rue Morgue by Edgar Allan Poe",
  "The Adventures of Sherlock Holmes by Arthur Conan Doyle",
  "Alice's Adventures in Wonderland by Lewis Carroll",
  "The Little Prince by Antoine de Saint-Exupéry",

  // ── Round 19 (2026-07-24) — closing residual gaps vs. classic.ts's same-day
  // additions (world historiography beyond Greco-Roman, global travel
  // literature, testimonial autobiography/diary). The Autobiography of
  // Malcolm X and The Diary of a Young Girl were already covered here from
  // earlier rounds, so only these three were genuinely missing ──
  "Records of the Grand Historian by Sima Qian",
  "The Travels of Marco Polo by Marco Polo",
  "The Rihla by Ibn Battuta",

  // ── Round 20 (2026-07-25) — closing residual gaps vs. classic.ts's same-day
  // additions (Philippine/SE Asian, Native American, Yiddish literary
  // traditions, and a 1000-year medieval-scholasticism hole). All four were
  // genuinely missing from this list (House Made of Dawn was already in
  // canon_books from an earlier sweep, but never added here) ──
  "Noli Me Tángere by José Rizal",
  "House Made of Dawn by N. Scott Momaday",
  "Gimpel the Fool and Other Stories by Isaac Bashevis Singer",
  "Summa Theologica by Thomas Aquinas",

  // ── Round 21 (2026-07-26) — closing residual gaps vs. classic.ts's same-day
  // additions (modern Chinese fiction, haibun/Japanese travel poetry, classical
  // economics). Persepolis was already covered here from an earlier round, so
  // only these three were genuinely missing ──
  "Diary of a Madman and Other Stories by Lu Xun",
  "The Narrow Road to the Deep North by Matsuo Bashō",
  "On the Principles of Political Economy and Taxation by David Ricardo",

  // ── Round 22 (2026-07-27) — closing the rationalist-philosophy gap vs.
  // classic.ts's same-day additions (20th-century drama titles — Godot,
  // Death of a Salesman, Streetcar — were already covered here from an
  // earlier round, so only Spinoza's Ethics was genuinely missing) ──
  "Ethics by Baruch Spinoza",

  // ── Round 23 (2026-07-28) — targeted gap sweep against Bloom/Britannica-tier
  // staples across fiction + non-fiction, independent of any same-day classic.ts
  // curation pass. All 14 confirmed absent from canon_books before backfill ──
  "Cosmos by Carl Sagan",
  "Common Sense by Thomas Paine",
  "Bleak House by Charles Dickens",
  "Civil Disobedience by Henry David Thoreau",
  "The Gulag Archipelago by Aleksandr Solzhenitsyn",
  "Demons by Fyodor Dostoevsky",
  "A People's History of the United States by Howard Zinn",
  "The Waves by Virginia Woolf",
  "Das Kapital by Karl Marx",
  "Labyrinths by Jorge Luis Borges",
  "The Structure of Scientific Revolutions by Thomas Kuhn",
  "Civilization and Its Discontents by Sigmund Freud",
  "The Origin of Species by Charles Darwin",
  "The Bluest Eye by Toni Morrison",

  // ── Round 24 (2026-08-09, seed-cache reconciliation) — POPULAR_BOOKS reconciliation
  // against classic.ts/canon_books had drifted since Round 23 (2026-07-28): daily canon
  // curation kept running (rounds 24-43, 2026-07-29 through 2026-08-09) but nothing
  // reconciled those additions into this pre-warm list, so ~20 rounds' worth of newly
  // canonized books were falling through to a live, uncached Gemini call on first
  // visualize instead of an instant cache hit. Cross-checked every canon_books row
  // sourced from that window against this file; these 31 were genuine gaps (many others
  // — Diary of a Madman, Persepolis, Narrow Road to the Deep North, Waiting for Godot,
  // Ethics/Spinoza, Tale of Kiều, Noli Me Tángere, and more — were already covered here
  // from earlier rounds, confirming the two systems still converge independently most
  // of the time; this just closes the residual gap) ──
  "Anarchy, State, and Utopia by Robert Nozick",
  "Argonauts of the Western Pacific by Bronisław Malinowski",
  "Canzoniere by Petrarch",
  "Capitalism and Freedom by Milton Friedman",
  "Capitalism, Socialism and Democracy by Joseph Schumpeter",
  "Dialogue Concerning the Two Chief World Systems by Galileo Galilei",
  "Distinction by Pierre Bourdieu",
  "Duino Elegies by Rainer Maria Rilke",
  "Crowds and Power by Elias Canetti",
  "Gypsy Ballads by Federico García Lorca",
  "The Quran",
  "The Flowers of Evil by Charles Baudelaire",
  "Life A User's Manual by Georges Perec",
  "Red Sorghum by Mo Yan",
  "Reflections on the Revolution in France by Edmund Burke",
  "Requiem by Anna Akhmatova",
  "Relativity: The Special and General Theory by Albert Einstein",
  "Selected Poems of Li Bai",
  "Songs of Innocence and of Experience by William Blake",
  "Syntactic Structures by Noam Chomsky",
  "The Canon of Medicine by Avicenna",
  "The Collected Poems of W.B. Yeats",
  "The Golden Notebook by Doris Lessing",
  "The Logic of Scientific Discovery by Karl Popper",
  "The Mythical Man-Month by Fred Brooks",
  "The Presentation of Self in Everyday Life by Erving Goffman",
  "The Selected Poems of Du Fu",
  "The Street of Crocodiles by Bruno Schulz",
  "The Theory of the Leisure Class by Thorstein Veblen",
  "This Earth of Mankind by Pramoedya Ananta Toer",
  "Wallenstein by Friedrich Schiller",

  // ── Round 46 (2026-08-11, seed-cache reconciliation) — daily canon curation
  // rounds 44 (2026-08-10: Brecht/Schopenhauer/Russell/Chekhov/Paz) and 45
  // (2026-08-11: Maimonides/Racine/Weil/Césaire/Washington) added 10 titles to
  // canon_books, but this pre-warm list wasn't reconciled since Round 24. Of
  // those 10, 3 (Schopenhauer, Russell, Chekhov's 2nd) were already covered
  // here from earlier rounds; these 7 were genuine gaps ──
  "Mother Courage and Her Children by Bertolt Brecht",
  "The Labyrinth of Solitude by Octavio Paz",
  "The Guide for the Perplexed by Maimonides",
  "Phèdre by Jean Racine",
  "Gravity and Grace by Simone Weil",
  "Notebook of a Return to the Native Land by Aimé Césaire",
  "Up From Slavery by Booker T. Washington",

  // ── Round 47 (2026-08-12, seed-cache reconciliation) — daily canon curation
  // round 46 (2026-08-12: Luther/Benjamin/Gramsci/Sontag/Kazantzakis) added 5
  // titles to canon_books; none were previously covered in this pre-warm list ──
  "On the Freedom of a Christian by Martin Luther",
  "The Work of Art in the Age of Mechanical Reproduction by Walter Benjamin",
  "Prison Notebooks by Antonio Gramsci",
  "Against Interpretation by Susan Sontag",
  "Zorba the Greek by Nikos Kazantzakis",

  // ── Round 48 (2026-08-14, seed-cache reconciliation) — daily canon curation
  // rounds 47 (2026-08-13: Cicero/Dhammapada/Hafez/Mabinogion/Calderón) and 48
  // (2026-08-14: Guru Granth Sahib/Vasari/Pirandello/Milton's Areopagitica)
  // were never reconciled into this pre-warm list; closing both gaps in one
  // pass. Solzhenitsyn/Gulag Archipelago already covered above, skipped ──
  "On Duties by Cicero",
  "The Dhammapada",
  "The Divan of Hafez by Hafez",
  "The Mabinogion",
  "Life Is a Dream by Pedro Calderón de la Barca",
  "Guru Granth Sahib",
  "Lives of the Most Excellent Painters, Sculptors, and Architects by Giorgio Vasari",
  "Six Characters in Search of an Author by Luigi Pirandello",
  "Areopagitica by John Milton",

  // ── Round 49 (2026-08-16, seed-cache reconciliation) — daily canon curation
  // rounds 49 (2026-08-15: Hebrew Bible/De Architectura/Al-Jabr/Natya Shastra/
  // Dede Korkut), 50 (2026-08-15, 2nd pass: Táin/Hammurabi/Shannon/Boyle/
  // Zeami), and 51 (2026-08-16: Manas/Rustaveli/Kebra Nagast/Book of the
  // Dead/Humboldt) added 15 titles to canon_books/classic.ts across three
  // rounds; none were previously covered in this pre-warm list (checked by
  // direct grep — only false-positive near-matches, e.g. "Samantha Shannon"
  // and "Humboldt's Gift by Saul Bellow", already present for unrelated
  // reasons) ──
  "The Hebrew Bible",
  "De Architectura by Vitruvius",
  "The Compendious Book on Calculation by Completion and Balancing by Muhammad ibn Musa al-Khwarizmi",
  "The Natya Shastra by Bharata Muni",
  "The Book of Dede Korkut",
  "The Táin",
  "Code of Hammurabi",
  "A Mathematical Theory of Communication by Claude Shannon",
  "The Sceptical Chymist by Robert Boyle",
  "Fūshikaden by Zeami Motokiyo",
  "The Epic of Manas",
  "The Knight in the Panther's Skin by Shota Rustaveli",
  "Kebra Nagast",
  "The Egyptian Book of the Dead",
  "Personal Narrative of Travels to the Equinoctial Regions of the New Continent by Alexander von Humboldt",

  // ── Round 52 (2026-08-17, seed-cache reconciliation) — canon curation round
  // 52 (source tag "curation_round52") added Politics/Pensées/I Ching/On the
  // Revolutions of the Heavenly Spheres/Grimms' Fairy Tales to canon_books;
  // none were previously covered here (checked by direct grep — Aristotle's
  // Nicomachean Ethics and Poetics are present, Politics was not) ──
  "Politics by Aristotle",
  "Pensées by Blaise Pascal",
  "I Ching",
  "On the Revolutions of the Heavenly Spheres by Nicolaus Copernicus",
  "Grimms' Fairy Tales",

  // ── Round 52b (2026-08-17, same-day addendum) — five more picks added to
  // classic.ts/canon_books alongside the round 52 reconciliation above ──
  "Micrologus by Guido of Arezzo",
  "Liber Abaci by Fibonacci",
  "Comentarios Reales de los Incas by Inca Garcilaso de la Vega",
  "I Quattro Libri dell'Architettura by Andrea Palladio",

  // ── Round 53 (2026-08-18) — canon curation round 53 (source tag
  // "daily_agent_canon_backfill_2026_08_18") added five titles to
  // canon_books, closing gaps in drama, children's literature, political
  // theory/law, foundational science, and aesthetics; none were previously
  // covered here (checked by direct grep) ──
  "The Tragical History of Doctor Faustus by Christopher Marlowe",
  "The Adventures of Pinocchio by Carlo Collodi",
  "On Crimes and Punishments by Cesare Beccaria",
  "Astronomia Nova by Johannes Kepler",
  "On the Sublime by Longinus",

  // ── Round 54 (2026-08-19) — canon curation round 54 (source tag
  // "daily_agent_canon_backfill_2026_08_19") added five titles to
  // canon_books, closing gaps in German Realism, Soviet-era Russian epic,
  // Islamic philosophy, Indian philosophy/practice, and anthropology; none
  // were previously covered here (checked by direct grep) ──
  "Effi Briest by Theodor Fontane",
  "And Quiet Flows the Don by Mikhail Sholokhov",
  "The Incoherence of the Philosophers by Al-Ghazali",
  "The Yoga Sutras by Patanjali",
  "The Interpretation of Cultures by Clifford Geertz",

  // ── Round 55 (2026-08-19) — canon curation round 55 (source tag
  // "daily_agent_canon_backfill_2026_08_19") added five titles to
  // canon_books, closing gaps in law, medicine, Pacific/Oceania mythology,
  // authored Central Asian poetry, and game theory; none were previously
  // covered here (checked by direct grep) ──
  "The Institutes of Justinian",
  "The Hippocratic Corpus",
  "The Kumulipo",
  "Khamsa by Alisher Navoi",
  "Theory of Games and Economic Behavior by John von Neumann and Oskar Morgenstern",

  // ── Round 56 (2026-08-20) — canon curation round 56 (source tag
  // "daily_agent_canon_backfill_2026_08_20") added five titles to
  // canon_books, closing gaps in French and Spanish national epic poetry
  // and the founding texts of modern anatomy, chemistry, and genetics;
  // none were previously covered here (checked by direct grep) ──
  "The Song of Roland",
  "Cantar de Mio Cid",
  "On the Fabric of the Human Body by Andreas Vesalius",
  "Elements of Chemistry by Antoine Lavoisier",
  "Experiments on Plant Hybridization by Gregor Mendel",

  // ── Round 57 (2026-08-21) — canon curation round 57 (source tag
  // "daily_agent_canon_backfill_2026_08_21") added five titles to
  // canon_books, closing gaps in Christian scripture, Christian
  // philosophy of history, political-idealist theory, military memoir,
  // and early analytic philosophy; none were previously covered here
  // (checked by direct grep) ──
  "The New Testament",
  "The City of God by Saint Augustine",
  "Utopia by Thomas More",
  "Anabasis by Xenophon",
  "Tractatus Logico-Philosophicus by Ludwig Wittgenstein",

  // ── Round 58 (2026-08-22) — canon curation round 58 (source tag
  // "daily_agent_canon_backfill_2026_08_22") added five titles to
  // canon_books, closing gaps in Heian-era Japanese prose, Greek
  // cosmogony, German Romanticism, Indian fable literature, and Roman
  // prose fiction. Two ("The Pillow Book by Sei Shonagon" and "The
  // Sorrows of Young Werther by Johann Wolfgang von Goethe") were already
  // present above from earlier general popular-book seeding — only the
  // three genuinely new titles are added here to avoid duplicate cache
  // warmup entries ──
  "Theogony by Hesiod",
  "Panchatantra by Vishnu Sharma",
  "Satyricon by Petronius",

  // ── Round 59 (2026-08-22) — canon curation round 59 (source tag
  // "daily_agent_canon_backfill_2026_08_22") added five titles to
  // canon_books, closing gaps in English tragic drama, French Renaissance
  // comic fiction, empiricist epistemology, Italian Renaissance epic, and
  // a second Freud entry. "Civilization and Its Discontents by Sigmund
  // Freud" was already present above (twice, in fact — a pre-existing
  // duplicate not touched by this round) from earlier general
  // popular-book seeding — only the four genuinely new titles are added
  // here to avoid duplicate cache warmup entries ──
  "Othello by William Shakespeare",
  "Gargantua and Pantagruel by François Rabelais",
  "An Essay Concerning Human Understanding by John Locke",
  "Jerusalem Delivered by Torquato Tasso",

  // ── Round 60 (2026-08-23) — canon curation round 60 (source tag
  // "canon_books_curation_round60_2026_08_23") added five titles to
  // canon_books, closing gaps in English Arthurian romance, German heroic
  // epic, American abolitionist fiction, Francophone African women's
  // writing, and a second Ibsen entry. "So Long a Letter by Mariama Ba" was
  // already present above from earlier general popular-book seeding — only
  // the four genuinely new titles are added here to avoid duplicate cache
  // warmup entries ──
  "Le Morte d'Arthur by Thomas Malory",
  "The Nibelungenlied by Anonymous",
  "Uncle Tom's Cabin by Harriet Beecher Stowe",
  "Hedda Gabler by Henrik Ibsen",

  // ── Round 61 (2026-08-23, same-day second pass) — canon curation round
  // 61 (source tag "classic_daily_curation_round61_2026_08_23") added five
  // titles to canon_books: Siddhartha and Utilitarianism were already
  // present above from earlier general popular-book seeding — only the
  // three genuinely new titles are added here to avoid duplicate cache
  // warmup entries ──
  "The Hunchback of Notre-Dame by Victor Hugo",
  "Bartleby, the Scrivener by Herman Melville",
  "The Conference of the Birds by Farid ud-Din Attar",

  // ── Round 62 (2026-08-24) — canon curation round 62 (source tag
  // "classic_daily_curation_round62_2026_08_24") added five titles to
  // canon_books, closing an English Romantic poetry gap (Lyrical Ballads,
  // Don Juan) and a modern-physics/classical-biography gap (QED, What Is
  // Life?, The Twelve Caesars). QED's author already has two other titles
  // seeded above ("Surely You're Joking, Mr. Feynman", "Six Easy Pieces")
  // but not this one — all five below are genuinely new, checked by grep
  // against the full file before adding ──
  "Lyrical Ballads by William Wordsworth and Samuel Taylor Coleridge",
  "Don Juan by Lord Byron",
  "QED: The Strange Theory of Light and Matter by Richard Feynman",
  "What Is Life? by Erwin Schrödinger",
  "The Twelve Caesars by Suetonius",

  // ── Round 63 (2026-08-24) — canon curation round 63 (source tag
  // "classic_daily_curation_round63_2026_08_24") added two titles to
  // canon_books, closing the remaining half of English Romanticism's "Big
  // Six": Keats and Percy Bysshe Shelley were both fully absent even after
  // round 62 added Lyrical Ballads/Don Juan. Checked by grep against the
  // full file first — neither author had any other title seeded (Mary
  // Shelley's Frankenstein, already present, is a different person) ──
  "Lamia, Isabella, The Eve of St. Agnes, and Other Poems by John Keats",
  "Prometheus Unbound by Percy Bysshe Shelley",

  // ── Round 64 (2026-08-25) — canon curation round 64 (source tag
  // "daily_agent_canon_backfill_2026_08_25") added three titles to
  // canon_books, closing three distinct gaps: Chinese Legalism (Han Feizi,
  // the missing third school alongside Confucianism/Daoism), Indian
  // political theory (Arthashastra, the statecraft counterpart to The
  // Prince/The Art of War), and history-of-science physiology (Harvey's De
  // Motu Cordis, the successor Vesalius's already-seeded On the Fabric of
  // the Human Body points toward). Checked by grep against the full file
  // first — none of the three authors had any other title seeded ──
  "Han Feizi by Han Fei",
  "Arthashastra by Kautilya",
  "On the Motion of the Heart and Blood in Animals by William Harvey",
];
