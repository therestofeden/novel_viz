-- Canon-first typo-tolerant search (2026-07-17).
-- Reported by Stefano: "homer" / "the odissey" never surfaced The Odyssey.
-- External APIs cannot spell-correct to canonical works (OL fuzzy returns
-- junk, Google Books returns nothing for "odissey"), so search-books now
-- fuzzy-matches the query against our own curated canon and injects the
-- intended book as a candidate. This table is seeded from (a) every book
-- ever analyzed (novel_analyses at time of migration) and (b) a hand-typed
-- tier of marquee world classics that were missing from the popular list
-- entirely (The Odyssey among them). Grows over time; safe to re-run
-- inserts thanks to the lower(title/author) unique index.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.canon_books (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title text NOT NULL,
  author text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS canon_books_title_author_key
  ON public.canon_books ((lower(title)), (lower(author)));

ALTER TABLE public.canon_books ENABLE ROW LEVEL SECURITY;

-- Service-role-only table (search-books reads it via the service client).
CREATE POLICY canon_books_deny_all ON public.canon_books
  AS RESTRICTIVE FOR ALL TO public USING (false) WITH CHECK (false);

-- (a) Everything ever analyzed.
INSERT INTO public.canon_books (title, author, source)
SELECT title, COALESCE(author, ''), 'novel_analyses'
FROM public.novel_analyses
ON CONFLICT ((lower(title)), (lower(author))) DO NOTHING;

-- (b) Marquee classics tier.
INSERT INTO public.canon_books (title, author, source) VALUES
('The Odyssey', 'Homer', 'classics_tier'),
('The Iliad', 'Homer', 'classics_tier'),
('The Aeneid', 'Virgil', 'classics_tier'),
('Metamorphoses', 'Ovid', 'classics_tier'),
('The Divine Comedy', 'Dante Alighieri', 'classics_tier'),
('Inferno', 'Dante Alighieri', 'classics_tier'),
('Oedipus Rex', 'Sophocles', 'classics_tier'),
('Antigone', 'Sophocles', 'classics_tier'),
('The Oresteia', 'Aeschylus', 'classics_tier'),
('Medea', 'Euripides', 'classics_tier'),
('The Republic', 'Plato', 'classics_tier'),
('The Symposium', 'Plato', 'classics_tier'),
('Nicomachean Ethics', 'Aristotle', 'classics_tier'),
('Poetics', 'Aristotle', 'classics_tier'),
('Meditations', 'Marcus Aurelius', 'classics_tier'),
('The Epic of Gilgamesh', 'Anonymous', 'classics_tier'),
('Beowulf', 'Anonymous', 'classics_tier'),
('One Thousand and One Nights', 'Anonymous', 'classics_tier'),
('The Canterbury Tales', 'Geoffrey Chaucer', 'classics_tier'),
('Hamlet', 'William Shakespeare', 'classics_tier'),
('Macbeth', 'William Shakespeare', 'classics_tier'),
('King Lear', 'William Shakespeare', 'classics_tier'),
('Othello', 'William Shakespeare', 'classics_tier'),
('Romeo and Juliet', 'William Shakespeare', 'classics_tier'),
('A Midsummer Night''s Dream', 'William Shakespeare', 'classics_tier'),
('The Tempest', 'William Shakespeare', 'classics_tier'),
('Paradise Lost', 'John Milton', 'classics_tier'),
('Don Quixote', 'Miguel de Cervantes', 'classics_tier'),
('Faust', 'Johann Wolfgang von Goethe', 'classics_tier'),
('The Sorrows of Young Werther', 'Johann Wolfgang von Goethe', 'classics_tier'),
('Pride and Prejudice', 'Jane Austen', 'classics_tier'),
('Emma', 'Jane Austen', 'classics_tier'),
('Sense and Sensibility', 'Jane Austen', 'classics_tier'),
('War and Peace', 'Leo Tolstoy', 'classics_tier'),
('Anna Karenina', 'Leo Tolstoy', 'classics_tier'),
('The Death of Ivan Ilyich', 'Leo Tolstoy', 'classics_tier'),
('Crime and Punishment', 'Fyodor Dostoevsky', 'classics_tier'),
('The Brothers Karamazov', 'Fyodor Dostoevsky', 'classics_tier'),
('The Idiot', 'Fyodor Dostoevsky', 'classics_tier'),
('Notes from Underground', 'Fyodor Dostoevsky', 'classics_tier'),
('Moby-Dick', 'Herman Melville', 'classics_tier'),
('Madame Bovary', 'Gustave Flaubert', 'classics_tier'),
('Les Misérables', 'Victor Hugo', 'classics_tier'),
('The Hunchback of Notre-Dame', 'Victor Hugo', 'classics_tier'),
('The Count of Monte Cristo', 'Alexandre Dumas', 'classics_tier'),
('The Three Musketeers', 'Alexandre Dumas', 'classics_tier'),
('Great Expectations', 'Charles Dickens', 'classics_tier'),
('A Tale of Two Cities', 'Charles Dickens', 'classics_tier'),
('David Copperfield', 'Charles Dickens', 'classics_tier'),
('Oliver Twist', 'Charles Dickens', 'classics_tier'),
('Adventures of Huckleberry Finn', 'Mark Twain', 'classics_tier'),
('The Adventures of Tom Sawyer', 'Mark Twain', 'classics_tier'),
('The Picture of Dorian Gray', 'Oscar Wilde', 'classics_tier'),
('Frankenstein', 'Mary Shelley', 'classics_tier'),
('Dracula', 'Bram Stoker', 'classics_tier'),
('Wuthering Heights', 'Emily Brontë', 'classics_tier'),
('Jane Eyre', 'Charlotte Brontë', 'classics_tier'),
('Middlemarch', 'George Eliot', 'classics_tier'),
('Tess of the d''Urbervilles', 'Thomas Hardy', 'classics_tier'),
('The Portrait of a Lady', 'Henry James', 'classics_tier'),
('Swann''s Way', 'Marcel Proust', 'classics_tier'),
('Ulysses', 'James Joyce', 'classics_tier'),
('Dubliners', 'James Joyce', 'classics_tier'),
('A Portrait of the Artist as a Young Man', 'James Joyce', 'classics_tier'),
('Mrs Dalloway', 'Virginia Woolf', 'classics_tier'),
('To the Lighthouse', 'Virginia Woolf', 'classics_tier'),
('The Trial', 'Franz Kafka', 'classics_tier'),
('The Metamorphosis', 'Franz Kafka', 'classics_tier'),
('The Castle', 'Franz Kafka', 'classics_tier'),
('The Magic Mountain', 'Thomas Mann', 'classics_tier'),
('Death in Venice', 'Thomas Mann', 'classics_tier'),
('Buddenbrooks', 'Thomas Mann', 'classics_tier'),
('Siddhartha', 'Hermann Hesse', 'classics_tier'),
('Steppenwolf', 'Hermann Hesse', 'classics_tier'),
('The Glass Bead Game', 'Hermann Hesse', 'classics_tier'),
('The Stranger', 'Albert Camus', 'classics_tier'),
('The Plague', 'Albert Camus', 'classics_tier'),
('The Myth of Sisyphus', 'Albert Camus', 'classics_tier'),
('Nausea', 'Jean-Paul Sartre', 'classics_tier'),
('1984', 'George Orwell', 'classics_tier'),
('Animal Farm', 'George Orwell', 'classics_tier'),
('Brave New World', 'Aldous Huxley', 'classics_tier'),
('The Great Gatsby', 'F. Scott Fitzgerald', 'classics_tier'),
('The Old Man and the Sea', 'Ernest Hemingway', 'classics_tier'),
('A Farewell to Arms', 'Ernest Hemingway', 'classics_tier'),
('For Whom the Bell Tolls', 'Ernest Hemingway', 'classics_tier'),
('The Sound and the Fury', 'William Faulkner', 'classics_tier'),
('The Grapes of Wrath', 'John Steinbeck', 'classics_tier'),
('East of Eden', 'John Steinbeck', 'classics_tier'),
('Of Mice and Men', 'John Steinbeck', 'classics_tier'),
('One Hundred Years of Solitude', 'Gabriel García Márquez', 'classics_tier'),
('Love in the Time of Cholera', 'Gabriel García Márquez', 'classics_tier'),
('Ficciones', 'Jorge Luis Borges', 'classics_tier'),
('Invisible Cities', 'Italo Calvino', 'classics_tier'),
('If on a winter''s night a traveler', 'Italo Calvino', 'classics_tier'),
('The Name of the Rose', 'Umberto Eco', 'classics_tier'),
('If This Is a Man', 'Primo Levi', 'classics_tier'),
('The Betrothed', 'Alessandro Manzoni', 'classics_tier'),
('The Leopard', 'Giuseppe Tomasi di Lampedusa', 'classics_tier'),
('One, No One and One Hundred Thousand', 'Luigi Pirandello', 'classics_tier'),
('Zeno''s Conscience', 'Italo Svevo', 'classics_tier'),
('The Tartar Steppe', 'Dino Buzzati', 'classics_tier'),
('My Brilliant Friend', 'Elena Ferrante', 'classics_tier'),
('Lolita', 'Vladimir Nabokov', 'classics_tier'),
('The Master and Margarita', 'Mikhail Bulgakov', 'classics_tier'),
('Doctor Zhivago', 'Boris Pasternak', 'classics_tier'),
('Eugene Onegin', 'Alexander Pushkin', 'classics_tier'),
('Dead Souls', 'Nikolai Gogol', 'classics_tier'),
('Fathers and Sons', 'Ivan Turgenev', 'classics_tier'),
('The Red and the Black', 'Stendhal', 'classics_tier'),
('Père Goriot', 'Honoré de Balzac', 'classics_tier'),
('Germinal', 'Émile Zola', 'classics_tier'),
('Candide', 'Voltaire', 'classics_tier'),
('The Social Contract', 'Jean-Jacques Rousseau', 'classics_tier'),
('The Prince', 'Niccolò Machiavelli', 'classics_tier'),
('Leviathan', 'Thomas Hobbes', 'classics_tier'),
('The Wealth of Nations', 'Adam Smith', 'classics_tier'),
('The Communist Manifesto', 'Karl Marx', 'classics_tier'),
('Thus Spoke Zarathustra', 'Friedrich Nietzsche', 'classics_tier'),
('Beyond Good and Evil', 'Friedrich Nietzsche', 'classics_tier'),
('Critique of Pure Reason', 'Immanuel Kant', 'classics_tier'),
('The Art of War', 'Sun Tzu', 'classics_tier'),
('The Analects', 'Confucius', 'classics_tier'),
('Tao Te Ching', 'Lao Tzu', 'classics_tier'),
('The Tale of Genji', 'Murasaki Shikibu', 'classics_tier'),
('Dream of the Red Chamber', 'Cao Xueqin', 'classics_tier'),
('Midnight''s Children', 'Salman Rushdie', 'classics_tier'),
('Things Fall Apart', 'Chinua Achebe', 'classics_tier'),
('Beloved', 'Toni Morrison', 'classics_tier'),
('To Kill a Mockingbird', 'Harper Lee', 'classics_tier'),
('The Catcher in the Rye', 'J.D. Salinger', 'classics_tier'),
('Slaughterhouse-Five', 'Kurt Vonnegut', 'classics_tier'),
('Catch-22', 'Joseph Heller', 'classics_tier'),
('One Flew Over the Cuckoo''s Nest', 'Ken Kesey', 'classics_tier'),
('The Bell Jar', 'Sylvia Plath', 'classics_tier'),
('On the Road', 'Jack Kerouac', 'classics_tier'),
('Lord of the Flies', 'William Golding', 'classics_tier'),
('Fahrenheit 451', 'Ray Bradbury', 'classics_tier'),
('The Lord of the Rings', 'J.R.R. Tolkien', 'classics_tier'),
('The Hobbit', 'J.R.R. Tolkien', 'classics_tier'),
('Foundation', 'Isaac Asimov', 'classics_tier'),
('Do Androids Dream of Electric Sheep?', 'Philip K. Dick', 'classics_tier'),
('The Handmaid''s Tale', 'Margaret Atwood', 'classics_tier'),
('Blood Meridian', 'Cormac McCarthy', 'classics_tier'),
('The Road', 'Cormac McCarthy', 'classics_tier'),
('Gravity''s Rainbow', 'Thomas Pynchon', 'classics_tier'),
('Infinite Jest', 'David Foster Wallace', 'classics_tier'),
('Blindness', 'José Saramago', 'classics_tier'),
('The Book of Disquiet', 'Fernando Pessoa', 'classics_tier'),
('Norwegian Wood', 'Haruki Murakami', 'classics_tier'),
('Kafka on the Shore', 'Haruki Murakami', 'classics_tier'),
('The Temple of the Golden Pavilion', 'Yukio Mishima', 'classics_tier'),
('Kokoro', 'Natsume Sōseki', 'classics_tier'),
('My Name Is Red', 'Orhan Pamuk', 'classics_tier'),
('Dune', 'Frank Herbert', 'classics_tier')
ON CONFLICT ((lower(title)), (lower(author))) DO NOTHING;

-- Fuzzy canon lookup used by search-books (service-role only).
CREATE OR REPLACE FUNCTION public.search_canon(p_q text)
RETURNS TABLE (title text, author text, sim real)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    cb.title,
    cb.author,
    GREATEST(
      similarity(cb.title, p_q),
      similarity(cb.author, p_q),
      word_similarity(p_q, cb.title),
      word_similarity(p_q, cb.author)
    ) AS sim
  FROM public.canon_books cb
  WHERE similarity(cb.title, p_q) > 0.28
     OR similarity(cb.author, p_q) > 0.28
     OR word_similarity(p_q, cb.title) > 0.40
     OR word_similarity(p_q, cb.author) > 0.40
  ORDER BY sim DESC
  LIMIT 6;
$$;

REVOKE EXECUTE ON FUNCTION public.search_canon(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_canon(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.search_canon(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.search_canon(text) TO service_role;
