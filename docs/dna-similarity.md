# How NovelViz measures "If you loved this shape"

Every book NovelViz maps gets a **DNA**: twelve axes, each scored from 0 to 100.
Fiction and non-fiction use different axes and are never compared with each
other. The "If you loved this shape" row on a book page lists the books whose
DNA sits closest to this one. This page explains exactly how "closest" is
computed, so anyone can check it or reuse it.

The method is deliberately simple. Code:

- Reference implementation, readable and tested: [`src/lib/dna-similarity.ts`](../src/lib/dna-similarity.ts)
  and its tests in [`src/test/dna-similarity.test.ts`](../src/test/dna-similarity.test.ts)
- What production runs (PostgreSQL): `public.get_dna_neighbours` in
  [`supabase/migrations/20261118183051_dna_neighbours_exact_ranking.sql`](../supabase/migrations/20261118183051_dna_neighbours_exact_ranking.sql).
  The two give identical results; this was checked against every mapped book.

## The axes

| Fiction | Non-fiction |
|---|---|
| `interiority`, `plot_density`, `time_linearity`, `scale`, `realism`, `tonal_register`, `prose_density`, `moral_ambiguity`, `character_vs_plot`, `political_charge`, `formal_experimentation`, `ending_openness` | `accessibility`, `idea_density`, `structure`, `scope`, `evidence_rigor`, `tone`, `prose_density`, `certainty`, `theory_vs_case`, `political_charge`, `structural_innovation`, `actionability` |

What each axis means, and its two poles, is in `DNA_AXIS_META` / `NF_DNA_AXIS_META` in [`src/lib/novel-types.ts`](../src/lib/novel-types.ts).

Scores come from the book's analysis. When readers drag an axis on a book page,
the row is re-ranked for their version of the book, with the same arithmetic.

## Distance

For a book **A** and a candidate **B**, take every axis both have scored
(at least 10 of the 12, otherwise B is skipped):

```
distance(A, B) = sqrt( Σ over shared axes (score_A − score_B)² )
```

That is ordinary **Euclidean distance**. Smaller is closer.

### Why not cosine similarity?

Cosine similarity compares the *direction* of two vectors and ignores their
*size*. DNA scores are positions on fixed scales, not proportions, so size
matters: a book scoring 20 on every axis and one scoring 80 on every axis
point in exactly the same direction (cosine = 1.0, "identical") while being
as different as two books can be. Euclidean distance calls them 208 points
apart, which matches what a reader would say.

## Match percentage

```
match % = clamp(0, 100, round(100 − sqrt(Σ gap² / n)))
```

where `n` is the number of shared axes and halves round up. `sqrt(Σ gap² / n)`
(the same thing as `distance / sqrt(n)`) is the root-mean-square gap per axis, so "84% match" means the two books are, on a
typical axis, about 16 points apart. In practice the closest eight books for
any title land between about 74% and 84%, which is why the page shows the
number small: the ranking carries the meaning, the percentage is a footnote.

## "Closest on…"

Under each book the page names up to three axes where the two scores are
within 10 points of each other, closest first (ties in alphabetical order of the axis id).

## Which books can appear

- Only books with their own NovelViz page, so every result is a link.
- Never the book itself, under any spelling.
- Never the "Our pick" title shown at the start of the same row (it would
  otherwise appear twice).
- One entry per title: titles are folded before comparing (lowercase, accents
  removed, subtitle after `:` `(` `[` dropped, a leading "The", "A" or "An"
  dropped, punctuation collapsed), so "The Odyssey" and "Odyssey" or two
  editions of the same book count once; the closer copy is kept.
- Never a book on NovelViz's do-not-recommend list: hate propaganda and
  extremist or terrorist manifestos (for example *Mein Kampf*). Those books
  stay searchable and keep their own page, but are never suggested anywhere
  in the app, and have no neighbours of their own.

Ties on distance are broken by the book's internal id, so the same input
always gives the same order.

## What "Our pick" is

The first book in the row is different in kind: a single recommendation
written by the AI model (Google Gemini) with a sentence on why. It is a
judgement, not a measurement, and the page labels it that way. Everything
after it is the measurement described above.
