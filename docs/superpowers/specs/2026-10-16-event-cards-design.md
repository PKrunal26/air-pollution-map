# Event cards: design

Date: 2026-10-16. Status: design agreed in discussion; awaiting review of this written version.

## Purpose

Make the atlas more fun and more shared. Visitors hunt for collectible cards of real air-pollution events (wildfire smoke, peat haze, crop burning, dust storms) by finding them on the globe in the right place and month, earn each card by answering a question about its cause, and share the card as an Instagram story. The question corrects a common belief (for example that Diwali fireworks cause North India's November smog), so collecting teaches something.

Success: people collect more than one card, and share cards that bring new visitors back to the atlas.

## Scope

In the first version:

- A hand-made deck of about 15 cards (20 at most), all findable in the monthly history (August 2022 onward).
- Finding a card on the globe, answering a question, collecting it, flipping it, sharing it.
- CO variants (a second print of some fire cards).
- A Cards panel with the collection and the clues.
- Collection kept in the browser, with a recovery link.
- PM10 and CO added to the monthly history.

Not in the first version: accounts or sign-in; seeing other people's collections; leaderboards; cards from the 48-hour forecast; events before August 2022 (London 1952, Bhopal, the ozone hole); a pipeline that detects events automatically.

## Rules of the game

### The deck

- Written by hand. About 15 cards; a new card is added only when an event deserves one.
- The deck only grows. Cards are never reordered or removed once live, because recovery links refer to cards by position.
- Candidates, measurements and status live in `docs/cards/deck.xlsx` (Deck sheet; events that do not show in the monthly data are listed under Not visible).
- No two cards share a place and month, or one pin would find both. Variants are the exception, separated by layer (see CO variants).

### Rarity

By how often the event happens, never by how much harm it did:

| Rarity | Meaning | Target share | Colour |
|---|---|---|---|
| Common | Every year (a season) | about 10 of 20 | grey-green `#8e9a84` |
| Uncommon | Every few years | about 6 of 20 | silver `#a9bccc` |
| Rare | Once in decades at this scale | about 4 of 20 | gold `#e3c76a` |

The evidence for a rarity is the same calendar month in other years of the record (Deck sheet, "Same month, other years").

### Types

Wildfire, Peat fire, Crop burning, Savanna burning, Dust storm. Accident, transit, fireworks and urban types were considered; no such event shows in 45 km monthly means (see Not visible).

### Finding a card

- Only in the time bar's Monthly mode. Hourly mode never shows cards.
- A pin counts when it lies inside the card's footprint, in one of the card's months.
- Footprint: a hand-drawn polygon around the event, widened by `bufferKm` (default 150 km) on every side. Distance is measured on the sphere; the date line is handled.
- Months: every month the footprint is elevated (for example September and October), not just the peak.
- A pin in the right place but one month off shows a quiet line in the readout: "Something happened here in another month."
- The card's layer does not need to be on (except for CO variants).

### The question

- Every question is about cause, with the common belief as one wrong option. Not general trivia.
- Each card has 2 or 3 questions. Each question has four options, one correct answer, an explanation, and a source.
- One try per question.
- Wrong answer: the pick is marked and the common belief gets a one-line correction. The correct answer is not shown, because the next question may ask the same thing another way.
- Then a 1-hour wait, after which the next question in the card's pool opens.
- Finding any card you have not collected yet clears every wait.
- The wait is stored in the browser, so a determined person can get around it. That is acceptable without a leaderboard.

### CO variants

- Same number as the base card, a second print in the CO layer's ink.
- Found by pinning the same place and month with the CO layer on, after you own the base card.
- Only for events where CO stands out. Peat smoulders and gives off far more CO than flaming grass fires: in the hourly snapshot of 15 October 2026, CO over Kalimantan peaked at 32 mg/m³ (about 8× WHO), while Central African savanna fires stayed near 0.65 mg/m³. Expect 3 to 5 variants: peat, boreal and Amazon fires.
- One CO question of its own, with the same wait rules.
- Variants do not count toward the 20-card limit.

### Collection and recovery

- Kept in the browser. All storage access sits in one module, so optional sign-in can replace it later without touching the rest.
- "Save link" in the Cards panel makes a short link (`?deck=<code>`, one bit per card and per variant) that restores the collection on any device. It is not secure, and does not need to be.

### Sharing

- A shared link (`?card=<id>`) opens the globe at the card's place and month, with the card face-up (both sides readable).
- The visitor does not receive the card. A "Hunt for this card" button opens the panel on its clue.
- Counts ("N people found this card") come from GoatCounter events. They depend on GoatCounter's public counter being enabled for the site; if it is not, the line is hidden.

## Card content

### Stats (front)

| Stat | Definition |
|---|---|
| Peak | Highest monthly-mean cell in the footprint, in the card's own layer (µg/m³). |
| × WHO | Footprint-average monthly mean ÷ the WHO 2021 24-hour guideline: PM2.5 ÷ 15 µg/m³ for fire types, PM10 ÷ 45 µg/m³ for dust, CO ÷ 4 mg/m³ for CO variants. A monthly mean is the average of daily means, so this reads "on an average day, N× the WHO daily guideline". |
| Area | Total area of footprint cells at or above twice their own usual level. Usual is each cell's median over all months in the record. |
| Reach | Greatest distance from the source point to an elevated cell (km). |

Values are measured once by hand from the published monthly data and written into the deck with a one-line method note. Past months never change.

### Art

- Front art is the real monthly field around the footprint, printed with the globe's halftone rules: dot area grows with the value, a regular lattice, solid ink, no jitter.
- Land is filled and coastlines are drawn over the dots.
- Scale is set per card by eye, so the event reads clearly. "Full dot at X µg/m³" is printed on the back.
- The image is made once per card by a hand-run tool (not part of the build) and committed as a static file under `public/cards/`.

### Back

The back carries, in order:

1. A strip of the same map.
2. Month · region, then the title.
3. About 70 words on what happened and why.
4. "Often blamed": the misconception and the correction.
5. Sources and the card's scale.
6. "NN / 15" and the date you found it.

No site name.

All text is written by hand and sourced before launch.

## Interface

Mockups from the session are in `.superpowers/brainstorm/` (not committed).

### Card

- 1:2, drawn at 300 × 600.
- The art fills the top 460 px and fades into the background.
- Top-left: type in a dark pill. Top-right: rarity in a dark pill, with its colour and 1–3 dots of growing size.
- Bottom-left, left-aligned: month above the title, then one row of four stats (value, small unit, label).
- Border of 2 px in the rarity colour, drawn above the art so it is never clipped.
- Tap or Enter flips it: a 3D turn of 0.75 s; instant with reduced motion.

### Header button and Cards panel (Compendium)

- "Cards 3/15" sits in the header next to Find a place. On phones it is an icon with the count.
- It opens a panel from the top right, one panel at a time like search and the layers panel. On phones the panel becomes a full-width sheet.
- Panel contents, top to bottom:
  - progress bars per rarity
  - type filters (All, Wildfire, Peat, Crop, Savanna, Dust)
  - a three-column grid of every slot
  - Save link
- Slot states:
  - Unknown: a numbered face-down card with the rarity colour on its edge.
  - Found, question waiting: a faint print of the art, with the time left.
  - Collected: the card's front. A blue dot means a CO print exists and is not yet collected.
- Tapping a face-down slot opens its clue view. It shows the riddle, then Region, Country and Month as separate steps you open one at a time. A month strip (J to D) stays greyed until Month is opened.

### Finding and answering

1. A pin inside a footprint adds a row to the readout: a face-down card, "A card is here", and Answer.
2. Answer dims the globe and opens the face-down card beside its question.
3. Right: the card flips face-up, with one paragraph on why. Buttons: Share (primary), See your cards, Keep exploring.
4. Wrong: the pick is marked, the misconception is corrected, and "A different question opens in 1 hour, or as soon as you find another card".
5. During the wait, the readout row says "New question in 47 min, or find another card", and Answer is disabled.

### Share image

- 1080 × 1920 PNG, drawn in the browser.
- The card sits straight and centred on the globe at the card's month and place, blurred and dimmed.
- "Find it yourself" and the site address sit under the card.
- Card and link stay clear of Instagram's top 13 % and bottom 12 %.
- Sent through the system share sheet where supported; downloaded otherwise.

## Architecture

### Content

- `src/cards/deck.json` holds every card's fields:
  - `id`, `number`, `name`, `type`, `rarity`, `rarityNote`
  - `field`, `months[]`, `footprint` (polygon), `bufferKm`, `sourcePoint`
  - `stats{peak, whoX, areaKm2, reachKm}`, each with a method note
  - `scale`, `clues{riddle, region, country, month}`, `questions[]` (prompt, options, answer, explanation, source)
  - `back`, `blamed`, `actual`, `sources[]`, `art`
  - `variants[]` (`co`: field, months, stats, question, art)
- `public/cards/<id>.webp` and `public/cards/<id>-co.webp` are the art files.

### Logic

Plain modules with no UI and no globe code.

- `src/cards/deck.js`
  - validates the deck
  - `cardAt(lat, lon, month, layers)` returns `found`, `variant`, `near-month` or `none`
  - point-in-polygon with the buffer on the sphere
- `src/cards/collection.js` is the only module that touches storage. It holds:
  - collected cards and variants
  - found-not-collected cards
  - per-card question index and wait end time
  - the rules: a wrong answer starts a 1-hour wait and moves to the next question; a new find clears every wait
  - the recovery link codec (`?deck=`)
- `src/cards/share.js` draws the story image on a canvas, opens the share sheet, and falls back to a download.

### Interface

- `CardsButton`, `CardsPanel` (grid, filters, clue view), `CardView` (front, back, flip), `CardQuestion` (modal), and the readout row.
- They match the existing glass style and the one-panel-at-a-time rule.

### Wiring

- The existing pin event calls `cardAt` only while the timeline is in history mode.
- `?card=` and `?deck=` are parsed next to the existing URL options.
- Events are sent through `track()`: `card-found/<id>`, `card-collected/<id>`, `card-shared/<id>`, `card-wrong/<id>`.

### Data jobs

Add `pm10` and `carbon_monoxide` to the monthly history.

- The browser already accepts any global field list in `air-history.json`.
- The changes are the field lists in `.github/workflows/pages.yml` (the rebuild step and the nightly `month` step), followed by one run of the workflow with `rebuild_history`. That run downloads about 8 GB per field and runs on GitHub.
- Monthly frames grow from 3 to 5 fields, about 0.85 MB more per month compressed.
- PM10 and CO also appear in the atlas's monthly mode as a side effect.
- The workflow deploys on push to `main`, so it runs only with the owner's go-ahead.

### Tests

- Deck structure: unique ids, append-only order against a frozen list, valid polygons, months inside the history range, every question with one correct answer and a source.
- `cardAt`: inside, buffer edge, outside, date line, wrong month (near-month), variant needs the CO layer and the base card.
- Collection: wait start and end, reset on a new find, question rotation, all with a fake clock.
- Recovery codec: round trip, and links made before newer cards or variants were added.

## Still to do before build

- Draw each card's footprint polygon and re-measure its four stats on it (current numbers come from rough boxes).
- Check rarity claims:
  - Is Indonesia 2026 larger than 2015 and 2019?
  - Was Spain 2025 its worst season in decades?
- Write clues, questions, explanations, back text and sources for every card. All current text is draft.
- Choose which fire cards get CO variants, once CO is in the history.
- Check that GoatCounter's public counter can be enabled.
- Decide whether the hand-run art tool is kept in `scripts/` or outside the repo.
- Phone layouts (panel sheet, question modal) follow the desktop designs; they were not mocked separately.
