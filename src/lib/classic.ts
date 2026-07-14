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
  { title: "The Iliad", author: "Homer", why: "War's oldest ledger — rage, glory, and mortality rendered in bronze-age hexameter.", aka: ["Iliad"] },
  { title: "Metamorphoses", author: "Ovid", why: "Every myth Western art keeps repainting, collected and fused into one restless poem." },
  { title: "The Aeneid", author: "Virgil", why: "Empire's founding propaganda, written with enough doubt to survive its own purpose.", aka: ["Aeneid"] },
  { title: "One Thousand and One Nights", author: "Anonymous", why: "The story that swallows stories; frame narrative invented as a survival tactic.", aka: ["Arabian Nights", "The Arabian Nights", "1001 Nights"] },
  { title: "The Tale of the Heike", author: "Anonymous", why: "Samurai Japan's fall from grace, chanted for centuries before it was written down." },
  { title: "Journey to the West", author: "Wu Cheng'en", why: "A monk, a monkey, and sixteenth-century China's wildest religious road trip." },
  { title: "Dream of the Red Chamber", author: "Cao Xueqin", why: "Eighteenth-century China's Middlemarch — a family's rise and ruin in four hundred characters.", aka: ["The Story of the Stone"] },
  { title: "The Canterbury Tales", author: "Geoffrey Chaucer", why: "English literature's big bang; every voice in a pilgrimage party gets to talk." },
  { title: "The Decameron", author: "Giovanni Boccaccio", why: "A plague quarantine's storytelling marathon; the short story invented out of necessity." },
  { title: "Orlando Furioso", author: "Ludovico Ariosto", why: "Chivalric romance pushed to gleeful, self-aware excess; Renaissance Italy's favorite epic." },
  { title: "The Faerie Queene", author: "Edmund Spenser", why: "Allegory built like a cathedral; English verse flexing its full structural range." },
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
  { title: "The Scarlet Letter", author: "Nathaniel Hawthorne", why: "Puritan shame made permanent, stitched to a chest; American guilt's founding text." },
  { title: "My Ántonia", author: "Willa Cather", why: "The prairie remembered as elegy; frontier life without the myth-making.", aka: ["My Antonia"] },
  { title: "The Portrait of a Lady", author: "Henry James", why: "A free American woman chooses her own trap; consciousness rendered in exhaustive close-up." },
  { title: "The Age of Innocence", author: "Edith Wharton", why: "Old New York's unwritten rules, enforced by people too polite to say them aloud." },
  { title: "The Red Badge of Courage", author: "Stephen Crane", why: "War's interior weather — fear, not glory — written by a man who'd never fought." },
  { title: "Sister Carrie", author: "Theodore Dreiser", why: "American ambition without the moral punishment novels usually demand of it." },
  { title: "The Awakening", author: "Kate Chopin", why: "A woman's self-possession as scandal; the marriage plot refused outright." },
  { title: "Germinal", author: "Émile Zola", why: "A mining strike as tragedy; naturalism's argument that poverty is a plot, not a flaw." },
  { title: "The Picture of Dorian Gray", author: "Oscar Wilde", why: "Vanity given a body double; aestheticism's most quotable cautionary tale." },
  { title: "Strange Case of Dr Jekyll and Mr Hyde", author: "Robert Louis Stevenson", why: "The divided self, given a formula and a body count.", aka: ["Dr. Jekyll and Mr. Hyde", "The Strange Case of Dr Jekyll and Mr Hyde"] },
  { title: "Dracula", author: "Bram Stoker", why: "Epistolary horror that invented the modern vampire's entire rulebook." },
  { title: "The Woman in White", author: "Wilkie Collins", why: "The sensation novel's founding text; identity theft as Victorian nightmare." },
  { title: "Tess of the d'Urbervilles", author: "Thomas Hardy", why: "Fate as a rigged system; Hardy's angriest argument against the moral order." },
  { title: "Buddenbrooks", author: "Thomas Mann", why: "A merchant dynasty's slow decline, four generations deep; Mann's debut and still his warmest." },
  { title: "A Portrait of the Artist as a Young Man", author: "James Joyce", why: "The bildungsroman rebuilt from the inside of a developing consciousness." },
  { title: "The Good Soldier", author: "Ford Madox Ford", why: "The unreliable narrator's masterclass; 'the saddest story' told by the last to know." },
  { title: "Sons and Lovers", author: "D.H. Lawrence", why: "Working-class desire and mother-love tangled together with uncomfortable honesty." },
  { title: "A Passage to India", author: "E.M. Forster", why: "Colonialism's failure of understanding, staged as a single unresolved incident in a cave." },
  { title: "Brideshead Revisited", author: "Evelyn Waugh", why: "Faith and nostalgia for a vanishing English aristocracy, told with real ambivalence." },
  { title: "The Good Soldier Švejk", author: "Jaroslav Hašek", why: "War satirized through sheer, weaponized incompetence; anti-militarism's funniest weapon.", aka: ["The Good Soldier Svejk"] },
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
  { title: "Hunger", author: "Knut Hamsun", why: "A starving writer's mind unraveling on the page; modernist interiority before modernism had a name." },
  { title: "Wide Sargasso Sea", author: "Jean Rhys", why: "Jane Eyre's 'madwoman in the attic' given her own voice and her own colonial history." },
  { title: "The Unbearable Lightness of Being", author: "Milan Kundera", why: "Love and politics under Soviet occupation, filtered through Nietzsche's eternal return." },
  { title: "Austerlitz", author: "W.G. Sebald", why: "Memory, architecture, and the Holocaust's aftershocks, told in single unbroken paragraphs." },
  { title: "Never Let Me Go", author: "Kazuo Ishiguro", why: "A quiet dystopia about acceptance; horror delivered entirely in understatement." },
  { title: "Suite Française", author: "Irène Némirovsky", why: "France's 1940 collapse, written in real time by an author who didn't survive to finish it.", aka: ["Suite Francaise"] },
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
  { title: "Kokoro", author: "Natsume Sōseki", why: "Isolation and guilt in Meiji Japan; a friendship's quiet, devastating confession." },
  { title: "The Wind-Up Bird Chronicle", author: "Haruki Murakami", why: "A missing cat unspools into wells, wartime Manchuria, and Japan's buried history." },
  { title: "Silence", author: "Shūsaku Endō", why: "A missionary's faith tested by torture and God's total silence; conviction under real pressure." },
  { title: "The Makioka Sisters", author: "Jun'ichirō Tanizaki", why: "Four sisters, one marriage crisis at a time, as old Japan gives way to the new." },
  { title: "Rashomon and Other Stories", author: "Ryūnosuke Akutagawa", why: "The same crime, four irreconcilable truths; the story that gave 'Rashomon effect' its name.", aka: ["Rashomon"] },
  { title: "Palace Walk", author: "Naguib Mahfouz", why: "A Cairo patriarch's household, opening the trilogy that won the Arab world's first Nobel." },
  { title: "The God of Small Things", author: "Arundhati Roy", why: "Forbidden love and caste violence in Kerala, told in prose that bends time and syntax." },
  { title: "A Suitable Boy", author: "Vikram Seth", why: "Post-independence India's marriage plot, stretched to thirteen hundred pages without losing momentum." },
  { title: "Untouchable", author: "Mulk Raj Anand", why: "A single day in a Dalit sweeper's life; caste injustice named early and directly." },
  { title: "Lucky Jim", author: "Kingsley Amis", why: "The campus novel's founding comedy; academic phoniness skewered from the inside." },
  { title: "Lord of the Flies", author: "William Golding", why: "Schoolboys revert to savagery without adults watching; civilization's thinness, tested and found wanting." },

  // ── Non-fiction ────────────────────────────────────────────────────────
  { title: "The Histories", author: "Herodotus", why: "The invention of history as inquiry — the 'father of history' asking why, not just what." },
  { title: "The History of the Peloponnesian War", author: "Thucydides", why: "Power politics analyzed without myth or piety; the realist tradition's founding text." },
  { title: "Nicomachean Ethics", author: "Aristotle", why: "Virtue as a habit, not a rule; still the sturdiest framework for a good life." },
  { title: "Symposium", author: "Plato", why: "A drinking party's speeches on love, ascending from bodies to the eternal Forms." },
  { title: "Confessions", author: "Saint Augustine", why: "The first real autobiography; interiority and guilt examined before either had a name.", aka: ["The Confessions"] },
  { title: "The Consolation of Philosophy", author: "Boethius", why: "Written in a prison cell awaiting execution; philosophy's argument against fortune's cruelty." },
  { title: "Discourse on Method", author: "René Descartes", why: "'I think, therefore I am' — modern philosophy's starting gun, in under a hundred pages." },
  { title: "Leviathan", author: "Thomas Hobbes", why: "Life without government as 'nasty, brutish, and short' — the case for the state, unsentimental." },
  { title: "An Enquiry Concerning Human Understanding", author: "David Hume", why: "Causation itself put on trial; empiricism's sharpest, most unsettling argument." },
  { title: "Two Treatises of Government", author: "John Locke", why: "Consent of the governed, laid out as first principle; the American founders' owner's manual." },
  { title: "The Social Contract", author: "Jean-Jacques Rousseau", why: "'Man is born free, and everywhere he is in chains' — the case for popular sovereignty." },
  { title: "A Vindication of the Rights of Woman", author: "Mary Wollstonecraft", why: "Reason claimed as women's birthright, a century before suffrage was even on the table." },
  { title: "The Wealth of Nations", author: "Adam Smith", why: "The invisible hand, self-interest, and the division of labor — economics as a discipline begins here." },
  { title: "Critique of Pure Reason", author: "Immanuel Kant", why: "The limits of what the mind can know, mapped with exhausting, load-bearing precision." },
  { title: "Phenomenology of Spirit", author: "G.W.F. Hegel", why: "Consciousness's long, dialectical education toward absolute knowing; difficult, and never fully superseded." },
  { title: "On the Genealogy of Morals", author: "Friedrich Nietzsche", why: "Morality itself put under a genealogist's microscope — where 'good' and 'evil' actually came from." },
  { title: "The Communist Manifesto", author: "Karl Marx", why: "'A spectre is haunting Europe' — the pamphlet, with Engels, that launched the twentieth century's central argument." },
  { title: "On Liberty", author: "John Stuart Mill", why: "The harm principle, stated once and never bettered; the case for dissent as a public good." },
  { title: "The Interpretation of Dreams", author: "Sigmund Freud", why: "The unconscious given a grammar; whatever you think of the theory, the questions still stand." },
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
