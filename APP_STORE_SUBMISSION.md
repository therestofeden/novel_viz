# NovelViz — App Store Connect Submission Sheet

## Identity

| Field | Value |
|---|---|
| **App Name** | NovelViz |
| **Subtitle** (30 chars max) | AI Book Analysis & Shelf |
| **Bundle ID** | com.novelviz.app |
| **SKU** | NOVELVIZ-001 |
| **Primary Language** | English (U.S.) |
| **Primary Category** | Books |
| **Secondary Category** | Education |

---

## Version Info

| Field | Value |
|---|---|
| **Version** | 1.0.0 |
| **Build** | 1 |
| **Copyright** | © 2026 NovelViz |
| **Min iOS** | 16.0 |

---

## Description

**Short description / Promotional Text (170 chars max):**
```
Turn any book into interactive character maps, timelines, concept graphs, and
personalised recommendations. Your reading life, visualised.
```

**Full Description (4000 chars max):**
```
NovelViz transforms the way you read.

Paste any book title — fiction or non-fiction — and NovelViz uses AI to generate
a rich visual breakdown in seconds: character relationship networks, narrative
timelines, thematic concept maps, chapter-by-chapter pacing, key ideas and
takeaways, and tailored next-read recommendations.

──────────────────────────

WHAT YOU GET

▸ Character Network
   See who connects to whom — allies, rivals, family, tension. Fiction comes alive
   as a living graph you can explore.

▸ Narrative Timeline
   Every major plot event mapped to a visual timeline. Spot turning points and
   structural choices at a glance.

▸ Concept Map
   For non-fiction: surface the core ideas and how they link. Understand a book's
   argument before you've read a word.

▸ Book DNA
   A fingerprint of tone, pacing, complexity, and themes plotted on an elegant
   radar chart. Compare at a glance.

▸ Ideas & Takeaways
   Distilled insights and actionable lessons — the essence of any book in a
   scannable format.

▸ Reader Notes
   Pin your own highlights and thoughts directly to the analysis. Your margin
   notes, organised.

▸ The Shelf
   Build your personal reading shelf with status tracking (Want to Read, Currently
   Reading, Finished). Your whole reading history in one constellation view.

▸ Anti-Shelf
   Done with a book? NovelViz looks at everything on your shelf and suggests what
   to read next — in two modes: Similar (same world, same feel) and Stretch
   (something that will expand your taste).

▸ Compare
   Pick any two books from your shelf and see them side by side: character worlds,
   themes, pacing, tone.

──────────────────────────

BRING YOUR OWN AI

NovelViz uses Google Gemini for all AI features. You connect your own free Gemini
API key (available at Google AI Studio — no credit card required). Your key, your
quota, your data. We never see the content of your analyses.

──────────────────────────

BUILT FOR READERS

NovelViz is designed for people who take books seriously — book clubs, students,
writers studying craft, and obsessive readers who want to go deeper. The
newspaper-inspired typography and ink-on-paper colour palette keep the focus on
ideas, not chrome.

──────────────────────────

PRIVACY

• Sign in with email — no social logins, no tracking
• Your Gemini key is encrypted and stored in your account — never shared
• No ads. No analytics. No data sold.
• Full privacy policy: https://novelviz.app/privacy
```

---

## Keywords (100 chars max, comma-separated)

```
book,reading,AI,analysis,character,timeline,concept map,shelf,tracker,literature,summary
```

---

## URLs

| Field | Value |
|---|---|
| **Support URL** | https://novelviz.app (or https://novelviz.app/support if you add one) |
| **Marketing URL** | https://novelviz.app |
| **Privacy Policy URL** | https://novelviz.app/privacy |

---

## Age Rating

Go to App Store Connect → Age Rating and answer the questionnaire:
- Unrestricted Web Access: **No** (app controls all content)
- All other categories: **None / No**
- **Result: 4+**

---

## App Review Information

**Demo Account** (required — reviewer must be able to log in):
- Create a throwaway account at https://novelviz.app/auth
- Email: `reviewer@novelviz.app` (set this up before submission)
- Password: choose something and paste it in the Notes field

**Notes for reviewer:**
```
NovelViz requires a free Google Gemini API key to use AI features.

To test the app during review:
1. Sign in with the demo credentials provided above.
2. A Gemini key is pre-loaded on this demo account — all AI features work immediately.
3. Tap any book title suggestion on the home screen or type a title in the search bar.
4. The analysis will generate in ~10–15 seconds.
5. Use the tab strip (Characters, Timeline, Concepts, etc.) to explore different views.
6. Tap "+ Add to shelf" to save a book, then navigate to the Shelf tab.

The "Anti-Shelf" tab requires at least 3 books on the shelf to generate
personalised recommendations.

There is no in-app purchase or paywall. The app is free.
```

---

## Screenshots Required

Apple requires screenshots for every device group you support.
Recommended minimum: iPhone 6.9" (Pro Max), iPhone 6.1", iPad Pro 13".

**Suggested scenes to capture (6 per device):**

1. **Home / Search** — search bar + suggested titles
2. **Analysis loading** — loading state with book title
3. **Character Network** — a dense fiction network (try "Game of Thrones" or "Crime and Punishment")
4. **Concept Map** — a non-fiction entry (try "Thinking, Fast and Slow")
5. **The Shelf** — constellation view with 5+ books
6. **Anti-Shelf recommendations** — the cards layout

**Screenshot sizes:**
| Device | Size |
|---|---|
| iPhone 6.9" (Pro Max) | 1320 × 2868 px |
| iPhone 6.1" | 1179 × 2556 px |
| iPad Pro 13" (M4) | 2064 × 2752 px |

Use Xcode Simulator to capture at the correct resolution.
Go to **Device → Screenshot** (⌘S) in Simulator.

---

## Checklist before hitting Submit

- [ ] App builds and runs clean in Xcode (no warnings as errors)
- [ ] Tested on iPhone 16 Pro (physical or Simulator)
- [ ] Tested on iPad (Simulator is fine for review purposes)
- [ ] Privacy Policy live at https://novelviz.app/privacy
- [ ] Demo account created and Gemini key pre-loaded
- [ ] All 6 screenshots uploaded for each device group
- [ ] Age rating questionnaire completed (should be 4+)
- [ ] Bundle ID matches Apple Developer portal provisioning profile
- [ ] App version 1.0.0 / Build 1 set in Xcode target
- [ ] "Automatically manage signing" enabled in Xcode (easiest for v1)
