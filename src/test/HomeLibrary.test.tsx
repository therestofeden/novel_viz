import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { HomeLibrary, type LibraryBook } from "@/components/HomeLibrary";
import { glyphSource } from "@/lib/dna-glyph";

const IDS = [
  "interiority", "plot_density", "time_linearity", "scale", "realism", "tonal_register",
  "prose_density", "moral_ambiguity", "character_vs_plot", "political_charge",
  "formal_experimentation", "ending_openness",
];
const axes = (scores: number[]) => scores.map((score, i) => ({ id: IDS[i], score }));
const mk = (title: string, scores: number[], rating: number | null = 9): LibraryBook => ({
  cacheKey: title.toLowerCase(),
  slug: title.toLowerCase().replace(/\s+/g, "-"),
  title,
  author: "Someone",
  rating,
  fiction: true,
  glyph: glyphSource(title, "fiction", axes(scores)),
});

const BOOKS = [
  mk("Stoner", [92, 20, 50, 25, 100, 15, 65, 75, 95, 35, 10, 15]),
  mk("Beloved", [80, 45, 25, 40, 40, 15, 85, 85, 85, 90, 75, 65], 10),
  mk("Blindness", [15, 70, 95, 75, 40, 5, 85, 70, 40, 90, 70, 50], null),
];

function view(over: Partial<React.ComponentProps<typeof HomeLibrary>> = {}) {
  const onOpen = vi.fn();
  render(
    <MemoryRouter>
      <HomeLibrary
        name="Stefano"
        search={<form aria-label="search" />}
        continueBook={{ title: "The Remains of the Day", author: "Kazuo Ishiguro", startedAt: null, slug: "the-remains-of-the-day", glyph: glyphSource("The Remains of the Day", "fiction", axes([85, 30, 40, 30, 95, 40, 70, 60, 80, 40, 30, 60])) }}
        shelf={{ total: 5, reading: 1, finished: 3 }}
        finishedThisYear={3}
        notesCount={2}
        recommendation={null}
        books={BOOKS}
        onOpen={onOpen}
        {...over}
      />
    </MemoryRouter>,
  );
  return onOpen;
}

describe("<HomeLibrary>", () => {
  it("greets the reader by name and shows the book in hand", () => {
    view();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/^(Still up|Good (morning|afternoon|evening)), Stefano\.$/);
    // the title appears on the plate and on the card
    expect(screen.getAllByText("The Remains of the Day").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Pick up where you left off")).toBeTruthy();
  });

  it("draws the reading shape once there are three fiction books, naming the nearest", () => {
    view();
    expect(screen.getByRole("img", { name: /Your reading shape, the average of 3 finished books/ })).toBeTruthy();
    expect(screen.getByText(/The book closest to your average is/)).toBeTruthy();
  });

  it("says so honestly with fewer than three books instead of faking a shape", () => {
    view({ books: BOOKS.slice(0, 2) });
    expect(screen.getByText("Your shape appears after three books.")).toBeTruthy();
    expect(screen.getByRole("img", { name: /appears here once you have finished/ })).toBeTruthy();
  });

  it("lists finished books with ratings, and opens one by slug", () => {
    const onOpen = view();
    expect(screen.getByText("10 / 10")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Beloved, rated 10 out of 10/ }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ title: "Beloved", slug: "beloved" }));
  });

  it("handles a brand-new reader: nothing in progress, nothing finished", () => {
    view({ continueBook: null, books: [], shelf: { total: 0, reading: 0, finished: 0 }, finishedThisYear: 0, notesCount: 0 });
    expect(screen.getByText("Nothing in progress yet.")).toBeTruthy();
    expect(screen.getByText(/lands here, drawn as its own shape/)).toBeTruthy();
  });

  it("works without a name", () => {
    view({ name: null });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/\.$/);
    expect(screen.getByRole("heading", { level: 1 }).textContent).not.toContain(",");
  });
});
