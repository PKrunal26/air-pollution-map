# Event Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collectible cards of real air-pollution events that visitors find on the globe's monthly history, earn by answering a cause question, flip, and share as an Instagram story.

**Architecture:**
- **Content** is one hand-written `src/cards/deck.json`. Art comes from a hand-run tool (`scripts/card-tools.py`), and its output is committed under `public/cards/`.
- **Game logic** is plain, tested modules in `src/cards/`: deck checks and the "is a card here?" test, collection rules and storage, the recovery link, URL options, and the share layout.
- **React components** in `src/cards/` plug into the existing header, readout and one-panel-at-a-time state in `src/main.jsx`.

**Tech Stack:**
- React 19, Vite 7, plain CSS files in `src/styles/`.
- Tests with `node --test` (`tests/*.test.js`), no React test runner.
- Python 3 with numpy, plus Node for the art tool.
- GoatCounter for counts.

**Spec:** `docs/superpowers/specs/2026-10-16-event-cards-design.md`. Card candidates are in `docs/cards/deck.xlsx`.

## Global Constraints

- **Commits:** only after the owner says yes. Never push to `main`, because a push to `main` deploys the site. Work on branch `event-cards`.
- **Cards are found only in Monthly mode** (timeline `kind === 'history'`). Hourly mode never shows cards.
- **Finding a card:**
  - Footprint buffer default `bufferKm: 150`, measured on the sphere.
  - A wrong-month hint shows when the pin is one month either side of a card's months.
- **Questions:** one try each. A wrong answer starts a wait of exactly 3,600,000 ms (1 hour). Finding any card you have not collected yet clears every wait.
- **Wrong-answer copy** shows the pick, the misconception correction, and "A different question opens in 1 hour, or as soon as you find another card." It never shows the correct answer.
- **Rarity colours:** common `#8e9a84`, uncommon `#a9bccc`, rare `#e3c76a`. Dots: 1, 2 or 3 filled, sizes 4/6/8 px.
- **CO ink** `#c693ad`.
- **WHO 24-hour guidelines:**
  - PM2.5 15 µg/m³ (fire types)
  - PM10 45 µg/m³ (dust)
  - CO 4000 µg/m³ (= 4 mg/m³; CO variants)
- **Card:**
  - 1:2, laid out at 300 × 600. Art fills the top 460 and fades into `#0a0d0c`.
  - 2 px rarity border drawn above everything.
  - Flip 0.75 s with `var(--motion)`, instant under `prefers-reduced-motion`.
- **Front:** type pill at top left, rarity pill at top right. At the bottom left: month above the title, then the stats Peak, × WHO, Area, Reach.
- **Back:**
  - Map strip; month · region; title; about 70 words; "Often blamed" block; sources and "Full dot at X µg/m³"; "NN / NN" and "Found D Mon YYYY" (only when the date is known).
  - No site name on the card.
- **Share image:**
  - 1080 × 1920 PNG.
  - Card straight and centred on that card's wide map, blurred and dimmed.
  - "Find it yourself" and `pkrunal26.github.io/air-pollution-map` below the card.
  - Nothing inside the top 13 % or bottom 12 %.
- **Storage:** keys start `air-atlas.`, and every read and write is wrapped in try/catch.
- **Copy and type:**
  - Headings are plain, with no catchy titles or eyebrow kickers.
  - Numbers use the system sans with `font-variant-numeric: tabular-nums`, never monospace.
- **The deck only grows.** `src/cards/order.json` lists every id ever published, in order. Never reorder or remove.

## Review Focus

1. **Browser storage unavailable** (private mode, Instagram's in-app browser). The game still works for the session, Save link still works, and nothing throws. Test: Task 3, `throwing storage keeps working in memory`.
2. **Recovery links that are old, garbled or for a different deck size.** A short code made before newer cards decodes those as not collected. Garbage gives an empty set. Restoring merges with the current collection and never wipes it. Tests: Task 4.
3. **Pins and footprints across the date line or near the poles.** A footprint spanning 180° still finds pins on both sides. A polar pin does not match a tropical card. Test: Task 2, `date line footprint matches both sides`.
4. **The device clock moves.** A clock set back never produces a wait longer than 1 hour or a negative wait. Test: Task 3, `wait never exceeds one hour even if clock moves back`.
5. **Shared links to unknown cards, or a history that fails to load.** `?card=nope` is ignored. A shared card still shows face-up when the monthly history is unavailable; it just doesn't move the globe. Tests: Task 5 and Task 11's verification step.

---

## File map

| File | Responsibility |
|---|---|
| `src/cards/deck.json` | The hand-written deck (content only) |
| `src/cards/order.json` | Every card id ever published, in order (append-only record) |
| `src/cards/deck.js` | `validateDeck`, `monthKey`, `cardAt` (footprint test) |
| `src/cards/collection.js` | Collection state and rules (find, answer, wait), storage adapter |
| `src/cards/recovery.js` | `?deck=` code: encode and decode collected cards and variants |
| `src/cards/cardParams.js` | `?card=` and `?deck=` URL options |
| `src/cards/share.js` | Story layout numbers, canvas drawing, share sheet or download, found counts |
| `src/cards/CardView.jsx` | Card front, back and flip |
| `src/cards/CardQuestion.jsx` | Focused question modal and its outcomes |
| `src/cards/ReadoutCardRow.jsx` | "A card is here" row inside the readout |
| `src/cards/CardsPanel.jsx` | Compendium panel: progress, filters, grid, clue view, Save link |
| `src/styles/cards.css` | All card UI styles |
| `src/AirComposition.jsx` | Gains an optional `footer` prop |
| `src/main.jsx` | Wiring: header button, panel state `'cards'`, pin handling, URL options |
| `scripts/card-tools.py`, `scripts/card-land.mjs` | Hand-run: `stats <id>` prints measurements; `art <id>` writes art files |
| `public/cards/` | `<id>.svg`, `<id>-wide.svg`, `<id>-co.svg`, `<id>-co-wide.svg` |
| `.github/workflows/pages.yml` | History field lists gain `pm10`, `carbon_monoxide` |
| `tests/fixtures/cards-deck.json` | Three-card test deck |
| `tests/cards-*.test.js` | Tests per module |

---

### Task 1: Deck format and validation

**Files:**
- Create: `src/cards/deck.js`, `src/cards/deck.json` (`[]`), `src/cards/order.json` (`[]`), `tests/fixtures/cards-deck.json`, `tests/cards-deck.test.js`

**Interfaces:**
- Produces:
  - `validateDeck(deck: Card[]): Card[]`. Returns the deck, or throws `Error('Invalid card <id>: <reason>')`.
  - `monthKey(validAt: number): string`, for example `'2024-11'`.
  - The `Card` shape below.
  - `HISTORY_START = '2022-08'`.

`Card` shape (exact keys):

```js
{
  id: 'indonesia-2026', number: 3, name: 'Indonesian peat haze', type: 'Peat fire',   // type ∈ TYPES
  rarity: 'rare', rarityNote: 'Highest September in the record…',                    // rarity ∈ common|uncommon|rare
  field: 'pm2_5', months: ['2026-09','2026-10'],
  footprint: [[lon,lat], …],            // ≥3 points, open ring, lon in [-180,180]
  bufferKm: 150, sourcePoint: [114.0,-2.0],
  stats: {peak:{value:659,unit:'µg/m³',note:'…'}, whoX:{value:2.5,note:'…'}, areaKm2:{value:2157000,note:'…'}, reachKm:{value:2120,note:'…'}},
  scale: 90, region: 'Kalimantan and Sumatra',
  clues: {riddle:'…', region:'…', country:'…', month:'…'},
  questions: [{prompt:'…', options:['…','…','…','…'], answer:1, explanation:'…', source:'…'}],   // 2–3 items
  back: ['para 1','para 2'], blamed: '…', actual: '…', sources: ['…'],
  variants: [{kind:'co', field:'carbon_monoxide', months:[…], stats:{…same keys…}, scale:4000,
              question:{…one question…}}]   // optional; kind 'co' only
}
```

`TYPES = ['Wildfire','Peat fire','Crop burning','Savanna burning','Dust storm']`

- [ ] **Step 1: Write the fixture and failing tests.**
  - The fixture `tests/fixtures/cards-deck.json` has three cards:
    - `test-fire`: Indonesia-like footprint, months `['2026-09']`, one CO variant.
    - `test-dateline`: footprint spanning lon 175 to −175, months `['2024-07']`.
    - `test-dust`: field `dust`, months `['2025-06','2025-07']`.
  - Tests:
    - `valid fixture passes`: `validateDeck(fixture)` deep-equals the fixture.
    - `real deck validates`: `validateDeck(JSON.parse(readFileSync('src/cards/deck.json')))` does not throw.
    - `rejects`: one `assert.throws(..., /Invalid card/)` per case:
      - duplicate id
      - duplicate number
      - unknown type
      - rarity `'epic'`
      - month `'2021-12'` (before `HISTORY_START`)
      - footprint with 2 points
      - question whose `answer` is out of range
      - question with no `source`
      - fewer than 2 or more than 3 questions
      - variant kind `'pm10'`
    - `monthKey`: `monthKey(Date.UTC(2024,10,1))` equals `'2024-11'`.
    - `deck only grows`: `order.json` must be a prefix of the deck's ids in order, and every deck id must appear in `order.json` (so publishing a card means appending to both).
- [ ] **Step 2: Run `node --test tests/cards-deck.test.js`.** Expected: fails because the module is missing.
- [ ] **Step 3: Implement `validateDeck` and `monthKey` in `src/cards/deck.js`.** The checks are exactly those listed in Step 1. `HISTORY_START` is exported.
- [ ] **Step 4: Run `node --test tests/cards-deck.test.js`, then `npm test`.** Expected: all pass, and the existing suites are unchanged.
- [ ] **Step 5: Commit (with the owner's OK):** `Add the event card deck format and its checks`.

### Task 2: Is a card here? (`cardAt`)

**Files:**
- Modify: `src/cards/deck.js`
- Test: `tests/cards-deck.test.js`

**Interfaces:**
- Consumes: the `Card` shape from Task 1.
- Produces: `cardAt(deck: Card[], {lat, lon, month, layers, owned}): {status, card, variant}`.
  - `layers` is a `Set` of enabled field ids. `owned` is a `Set` of collected base card ids.
  - `status` is one of `'found' | 'variant' | 'near-month' | 'none'`.
  - `variant` is the variant object when `status === 'variant'`, otherwise `null`.

Rules:
- **Inside:** point-in-polygon, or within `bufferKm` of the polygon's edge.
- **Variant first:** if inside, the month matches the variant's `months`, `layers` has the variant's field, and `owned` has the card id, then `'variant'`.
- **Then base:** inside and `month` in `months` gives `'found'`.
- **Near month:** inside and one month from any listed month gives `'near-month'`.
- **First match wins** in deck order.

Distance method (the tests do not determine it):
- Work in a local equirectangular frame centred on the pin: `x = wrap(lon − lon0) · cos(lat0) · 111.32`, `y = (lat − lat0) · 110.57` in km, where `wrap` maps into (−180, 180].
- Point-in-polygon is a ray cast in that frame.
- The buffer is the minimum point-to-segment distance in that frame.

- [ ] **Step 1: Write the failing tests.**
  - `inside, right month → found`
  - `inside, wrong month two away → none`
  - `inside, month one after → near-month`
  - `100 km outside edge → found` (within 150)
  - `200 km outside → none`
  - `date line footprint matches both sides` (lon 179.5 and −179.5)
  - `polar pin does not match tropical card` (lat 89, lon 114)
  - `variant needs CO layer and owned base`: three asserts, one each for no layer, not owned, and both present (`'variant'`)
  - `first matching card wins`
- [ ] **Step 2: Run them.** Expected: fail because `cardAt` is not exported.
- [ ] **Step 3: Implement `cardAt`** using the method above.
- [ ] **Step 4: Run `node --test tests/cards-deck.test.js`.** Expected: pass.
- [ ] **Step 5: Commit (with the owner's OK):** `Find cards by footprint and month`.

### Task 3: Collection rules and storage

**Files:**
- Create: `src/cards/collection.js`, `tests/cards-collection.test.js`

**Interfaces:**
- Produces, all pure (state in, new state out; never mutate):
  - `emptyState(): State`, where `State = {v:1, collected:{[key]:atMs|null}, found:{[key]:atMs}, attempts:{[key]:{q:number, waitUntil:ms}}}`. `key` is the card id, or `'<id>:co'` for a variant.
  - `variantKey(id, kind) => '<id>:<kind>'`
  - `markFound(state, key, now): State`. If `key` was neither collected nor found yet, it also clears every `attempts[*].waitUntil`.
  - `questionFor(card, state, key): {question, index}`. Base cards use `card.questions[index % length]`; variants use `variant.question`.
  - `answer(state, key, card, choice, now): {state, correct}`. Correct sets `collected[key] = now`. Wrong sets `attempts[key] = {q: q+1, waitUntil: now + WAIT_MS}`.
  - `waitLeft(state, key, now): ms`, clamped to `[0, WAIT_MS]`.
  - `WAIT_MS = 3600000`
  - `loadCollection(storage = globalThis.localStorage): State` and `saveCollection(state, storage)`, using key `'air-atlas.cards'`. They tolerate a missing or throwing storage and bad JSON (giving `emptyState()`).
  - `mergeCollected(state, keys: string[]): State`. Adds collected keys with `null` dates and keeps existing ones.

- [ ] **Step 1: Write the failing tests**, using the fixture deck and `now` values:
  - `find then answer right collects`
  - `wrong answer starts one-hour wait and moves to next question`: `waitLeft === 3600000`, and `questionFor(...).index === 1`.
  - `question index wraps around the pool`
  - `finding a new card clears every wait`
  - `re-finding a collected card does not clear waits`
  - `wait never exceeds one hour even if clock moves back`: `waitUntil` set at now = 10,000,000, then `waitLeft` at now = 0 equals 3600000.
  - `variant uses its own question and key`
  - `throwing storage keeps working in memory`: a storage whose `getItem` and `setItem` throw makes load return `emptyState()` and save not throw.
  - `bad JSON gives empty state`
  - `mergeCollected keeps existing dates`
- [ ] **Step 2: Run `node --test tests/cards-collection.test.js`.** Expected: fail.
- [ ] **Step 3: Implement the functions** listed under Interfaces in `src/cards/collection.js`.
- [ ] **Step 4: Run it.** Expected: pass.
- [ ] **Step 5: Commit (with the owner's OK):** `Card collection rules: find, answer, one-hour wait`.

### Task 4: Recovery link code

**Files:**
- Create: `src/cards/recovery.js`, `tests/cards-recovery.test.js`

**Interfaces:**
- Consumes: `order.json` ids, and `variantKey` from Task 3.
- Produces:
  - `encodeDeck(collectedKeys: string[], order: string[]): string`
  - `decodeDeck(code: string, order: string[]): string[]`, which returns the collected keys and gives `[]` for any malformed input.

Format:
- `'1.'` followed by base64url (no padding) of a bit array.
- For each `order[i]`, bit `2i` means the base card is collected and bit `2i+1` means its CO variant is collected.
- Bit `n` is in byte `n>>3`, mask `1<<(n&7)`. Trailing zero bytes are dropped.

- [ ] **Step 1: Write the failing tests.**
  - `round trip`
  - `empty collection encodes to "1."`
  - `old shorter code decodes with newer cards uncollected`: encode with a 2-id order, decode with a 3-id order.
  - `bits beyond order are ignored`
  - `garbage gives empty`: `'xyz'`, `'2.AA'`, `'1.!!'`, `''`, `null`.
  - `variant bit only when variant collected`
- [ ] **Step 2: Run them.** Expected: fail.
- [ ] **Step 3: Implement the codec** in the format above (use `btoa`/`atob` with base64url substitution, available in Node 20+ and browsers).
- [ ] **Step 4: Run them.** Expected: pass.
- [ ] **Step 5: Commit (with the owner's OK):** `Recovery link code for card collections`.

### Task 5: Card URL options

**Files:**
- Create: `src/cards/cardParams.js`, `tests/cards-params.test.js`

**Interfaces:**
- Produces: `parseCardParams(search: string, knownIds: Set<string>): {card: string|null, deck: string|null}`.
  - `card` is set only when it is in `knownIds`.
  - `deck` is set only when it matches `/^1\.[A-Za-z0-9_-]*$/` and is at most 200 characters.
  - `parseEmbedParams` stays unchanged, so its full-object tests still pass.

- [ ] **Step 1: Write the failing tests.**
  - `known card id kept`
  - `unknown card ignored` (`?card=nope`)
  - `deck code validated`
  - `both together`
  - `no params gives nulls`
- [ ] **Step 2: Run them.** Expected: fail.
- [ ] **Step 3: Implement `parseCardParams`.**
- [ ] **Step 4: Run them, then `npm test`.** Expected: pass.
- [ ] **Step 5: Commit (with the owner's OK):** `Parse ?card= and ?deck= options`.

### Task 6: Card tools (stats and art)

**Files:**
- Create:
  - `scripts/card-tools.py`, with subcommands `stats <id>` and `art <id> [--co]`
  - `scripts/card-land.mjs`, which takes `lon0 lon1 lat0 lat1 W H` and prints an SVG land path from `world-atlas/land-50m.json`
- Add to the README: a short "Event cards" section on running the tools.

**Interfaces:**
- Consumes:
  - `src/cards/deck.json` for the card's `field`, `months`, `footprint`, `bufferKm`, `sourcePoint` and `scale`.
  - `art: {lon0, lon1, latCenter}`, an extra deck key that `validateDeck` must accept as optional.
  - `public/data/air-history.json` and its frames.
- Produces:
  - `stats` prints JSON, measured on the card's first month (or the month with the highest footprint mean if there are several):
    - `{peak, whoX, areaKm2, reachKm, notes}`
    - Peak is the highest cell in the footprint plus buffer, in the card's layer.
    - whoX is the footprint-mean of the WHO field divided by its guideline: PM2.5 for fire types, PM10 for Dust storm, CO for the variant. If that field is not in the history, it prints `null` with the reason.
    - Area is the area of cells at least twice their own median.
    - Reach is the greatest great-circle distance from `sourcePoint` to an elevated cell.
  - `art` writes `public/cards/<id>.svg` (viewBox 300 × 460) and `<id>-wide.svg` (viewBox 1080 × 1920, the same centre with 3.6× the span), plus `-co` versions with `--co`.

Art rules, matching the mockups the owner approved:
- Halftone lattice in lat/lon with step 0.5°; longitude step divided by cos(latCenter); alternate rows offset by half a step.
- Dot radius = `0.56 · sqrt(min(v/scale, 1)) · step_px`.
- Ink is the layer colour from `src/camsFields.json`.
- Land fill `#36433a` on sea `#0a0d0c`. Coastline `#e9efdf` at 0.8 opacity, drawn over the dots.
- Longitudes are wrapped around the crop centre, so outlines crossing the date line never streak.
- `latSpan = (lon1 − lon0) · cos(latCenter) · H / W`.

- [ ] **Step 1:** Add `art` to `validateDeck`'s optional keys, with a test that `art` must contain three finite numbers when present. Run `npm test`. Expected: pass.
- [ ] **Step 2: Implement both scripts.** Running with an unknown id exits non-zero with `unknown card <id>`.
- [ ] **Step 3: Verify.** Temporarily copy the fixture card `test-fire` into `deck.json` with an `art` block centred on Borneo, run `uv run --with numpy python scripts/card-tools.py art test-fire`, and open `public/cards/test-fire.svg` in the browser preview. Expected: Borneo and Sumatra coastlines over ochre dots. Then run `stats test-fire`. Expected: JSON with four numbers, and `whoX` not `null` for PM2.5. Revert the temporary deck entry and delete the test art.
- [ ] **Step 4: Commit (with the owner's OK):** `Hand-run tools for card stats and art`.

### Task 7: Deck content (with the owner)

Content, not code. It can run alongside Tasks 8 to 12. Shortlist: the Proposed rows in `docs/cards/deck.xlsx`, after the owner's Status review.

**Files:**
- Modify: `src/cards/deck.json`, `src/cards/order.json`, `docs/cards/deck.xlsx`
- Create: `public/cards/*.svg`

For each card, in number order:

- [ ] **Step 1: Draw the footprint.** Use 5–12 points around the plume. Check it against the monthly globe at the card's month (`?t=YYYY-MM`). Record the months.
- [ ] **Step 2: Measure the stats.** Run `card-tools.py stats <id>` and copy the values and notes into the card.
- [ ] **Step 3: Choose the scale and crop by eye, then generate the art.** Run `card-tools.py art <id>` and check the event reads clearly.
- [ ] **Step 4: Research and write the text, citing a source for every claim:**
  - clues (riddle, region, country, month)
  - 2–3 cause questions, each with the common belief as one wrong option and an explanation
  - back paragraphs (about 70 words)
  - `blamed` / `actual`
- [ ] **Step 5: Check the rarity claims named in the spec:**
  - Indonesia 2026 compared with 2015 and 2019
  - Spain 2025 as its worst season in decades
- [ ] **Step 6: Owner review.** The owner reads each card's text and approves it. Then append the id to `order.json` and run `npm test` (deck validation, deck only grows). Expected: pass.
- [ ] **Step 7: Commit (with the owner's OK)**, one commit per small batch of cards: `Add event cards NN–NN`.

CO variants come after Task 8 has published CO.
- [ ] **Step 8:** For the peat, boreal and Amazon fire cards, check whether CO stands out with `card-tools.py stats <id>` on `carbon_monoxide`. Add a `variants` entry only where it does, generate `--co` art, write its question, and get owner review.

### Task 8: PM10 and CO in the monthly history

**Files:**
- Modify: `.github/workflows/pages.yml`. The three history lists (rebuild `printf`, rebuild `build`, nightly `month`) change from `pm2_5 dust nitrogen_dioxide` to `pm2_5 dust nitrogen_dioxide pm10 carbon_monoxide`, with `xargs -P 5`.
- Test: `tests/airFrames.test.js`

- [ ] **Step 1: Write a test.** `history manifest accepts five fields`: build a manifest like the existing history fixture with `fieldOrder: ['pm2_5','dust','nitrogen_dioxide','pm10','carbon_monoxide']` and frame `byteLength = 900*451*5*2`. `parseHistoryManifest` must not throw.
- [ ] **Step 2: Run `npm test`.** Expected: pass. The parser already accepts any global field list; this test pins that behaviour.
- [ ] **Step 3: Edit the workflow lists** as above.
- [ ] **Step 4: Ask the owner before anything leaves the machine.** Then push the branch and run the workflow with `rebuild_history: true` (about 2 hours, roughly 8 GB downloaded per new field). Pushing to `main` deploys the site, so the owner decides when.
- [ ] **Step 5: Verify.** Run `npm run data:pull`. `public/data/air-history.json` should have `fieldOrder` with five ids and frame `byteLength` 4,059,000. Open `?t=2024-11` with the PM10 layer on: dots draw for November 2024.

### Task 9: Card view (front, back, flip)

**Files:**
- Create: `src/cards/CardView.jsx`, `src/styles/cards.css`

**Interfaces:**
- Consumes: `Card` (Task 1).
- Produces: `<CardView card variant={null|'co'} flipped onFlip foundAt={ms|null} total={number} size={1}/>`.
  - `size` scales the whole card with CSS `--card-scale`.
  - The art comes from `public/cards/<id>[-co].svg`, using the `import.meta.env.BASE_URL` prefix.

What it renders:
- Front and back exactly as in Global Constraints.
- Stats formatting: Peak as an integer with a thousands separator, × WHO to one decimal place followed by "×", Area as "2.2M" or "906k" with "km²", Reach as an integer with "km".
- The back's map strip uses the same art file at `object-fit: cover`.
- Faces use `backface-visibility: hidden` only while flipping is possible (`size >= 1`); thumbnails pass `size < 1` and render the front only. This fixes a rendering bug seen in the mockups.
- The card is a `button`. Enter or Space flips it, and `aria-pressed={flipped}`.

- [ ] **Step 1: Implement and wire a temporary preview.** `?cardpreview=<id>` renders one CardView over the globe, dev builds only (`import.meta.env.DEV`).
- [ ] **Step 2: Verify in the browser preview** with a Task 7 card, or the fixture plus art from Task 6:
  - The front matches the approved mockup: pills, left-aligned bottom block, gold border visible on all four sides.
  - Clicking flips in about 0.75 s.
  - With reduced motion, the flip is instant.
  - Tab then Enter flips the card.
  - Take a screenshot for the owner.
- [ ] **Step 3: Remove the preview hook. Run `npm run build`.** Expected: the build succeeds.
- [ ] **Step 4: Commit (with the owner's OK):** `Card view with flip`.

### Task 10: Finding and answering (readout row and question)

**Files:**
- Create: `src/cards/ReadoutCardRow.jsx`, `src/cards/CardQuestion.jsx`
- Modify:
  - `src/AirComposition.jsx`: add an optional `footer` prop, rendered as the last child of the section, only when `location.pinned`.
  - `src/main.jsx`
  - `src/styles/cards.css`

**Interfaces:**
- Consumes: `cardAt` (Task 2); `loadCollection`, `saveCollection`, `markFound`, `questionFor`, `answer`, `waitLeft` (Task 3); `CardView` (Task 9); `track` from `src/analytics.js`.
- Produces:
  - In `main.jsx`: state `cards` (from `loadCollection()`, saved on every change), and `cardHit = {status, card, variant}` computed when the probe is pinned and the timeline is history. `month = monthKey(timeline.manifest.frames[frameIndex].validAt)`, `layers` is the enabled paint ids, and `owned` is the collected base ids.
  - `<ReadoutCardRow hit waitMs onAnswer/>`
  - `<CardQuestion card variant state onAnswer onClose onShare onShowCards/>`

Behaviour (copy is exact):
- `'found'` or `'variant'`: call `markFound` (in `main.jsx`, `track('card-found/<id>')` when this adds a new key) and show a row with a face-down mini card, "A card is here", "Answer one question to collect it", and an Answer button.
  - If `waitLeft > 0`, the row reads "New question in N min, or find another card" and Answer is disabled.
  - If already collected, the row reads "You have this card" and offers View.
- `'near-month'`: the row is a single muted line, "Something happened here in another month."
- **Answer** opens `CardQuestion`. It dims the globe (backdrop `#05070699`), shows the face-down card beside the prompt and four options, then "One try. If you miss, a different question opens in an hour, or sooner if you find another card."
- **Right:**
  - The card flips face-up.
  - Heading "Right: " plus the explanation's first sentence, then the explanation.
  - Buttons: Share (primary), See your cards, Keep exploring.
  - Tracks `card-collected/<id>`.
- **Wrong:**
  - The pick is outlined in `#d9785f` with "Your answer".
  - Then "Common belief, but not the main cause." plus the question's `explanation`, and the Global Constraints wait copy.
  - Keep exploring.
  - Tracks `card-wrong/<id>`.
- Escape closes the modal. Focus is trapped while it is open and returns to the readout.

- [ ] **Step 1: Implement the components and wiring.**
- [ ] **Step 2: Verify in the browser preview** with a real card from Task 7:
  - Monthly mode at the card month: pin inside, and the row appears. Pin one month off: the hint shows. Hourly mode: no row.
  - Answer wrong: the wait copy shows, and pinning again shows the minute countdown.
  - Pin a different card: the first card's wait clears.
  - Answer right: the card flips, and a reload keeps it collected.
  - In a private window: everything works for the session.
  - Take screenshots for the owner.
- [ ] **Step 3: Run `npm test && npm run build`.** Expected: pass.
- [ ] **Step 4: Commit (with the owner's OK):** `Find a card from the readout and answer to collect it`.

### Task 11: Cards panel, shared cards, restore

**Files:**
- Create: `src/cards/CardsPanel.jsx`
- Modify: `src/main.jsx`, `src/styles/cards.css`

**Interfaces:**
- Consumes: `CardView`, `encodeDeck`, `decodeDeck`, `mergeCollected`, `parseCardParams`, the deck, `order.json`.
- Produces:
  - Header button "Cards" plus a tabular count "3/15", placed before `CitySearch` in the header `nav`. On phones it is an icon with the count.
  - `panel === 'cards'` follows the existing one-panel-at-a-time rule, and opening it clears the probe.

Panel layout, top to bottom (the Compendium):
1. **Title row:** "Cards", "N of M", and a close button.
2. **Progress:** three bars (Rare, Uncommon, Common), each with `got/total`.
3. **Type filters:** All, Wildfire, Peat, Crop, Savanna, Dust.
4. **Grid:** three columns, one slot per card in number order.
   - Unknown: a numbered face-down card with its rarity colour on the edge.
   - Found but not collected: a faint (0.18 opacity, greyscale) print of the art, plus "Found · N min" while waiting.
   - Collected: a `CardView` thumbnail. Tapping it opens the card large and flippable, with Share.
   - A collected card whose CO variant exists but is not collected gets a 12 px dot `#7fb7d9`.
5. **Clue view**, when a face-down slot is tapped:
   - "← All cards", the large face-down card, and "NN · Rarity · Type".
   - The riddle, then Region, Country and Month as separate steps, each opened with its own button.
   - A J–D month strip, greyed until Month is opened; then the card's months are highlighted.
   - Which steps are open is kept per card in `air-atlas.cards.clues`.
6. **Footer:** "Your cards are kept in this browser. Save a link to keep them anywhere." and a Save link button, which copies `location.origin + location.pathname + '?deck=' + encodeDeck(...)` and confirms "Link copied".
   - Phone: the panel is a full-width sheet.

URL options:
- **`?deck=` on load:** merge the decoded keys into the collection, remove `deck` from the address with `history.replaceState`, and open the panel.
- **`?card=` on load:**
  1. Open the card large and face-up, front and back readable by flipping.
  2. Switch to Monthly mode and seek to the card's first month once the history timeline exists.
  3. Fly the globe to `sourcePoint`.
  4. Show a "Hunt for this card" button, which opens the panel on its clue view.
  5. Do not add the card to the collection.
  - If the history never loads, the card still shows.

- [ ] **Step 1: Implement the panel, the header button and the URL handling.**
- [ ] **Step 2: Verify in the browser preview:**
  - Grid states match the approved Compendium mockup.
  - Filters narrow the grid.
  - Clue steps open in order and persist after a reload.
  - Save link, then opening it in a fresh private window, restores the cards and keeps cards already present there.
  - `?card=<id>` shows the card face-up at its month.
  - `?card=nope` opens the normal atlas.
  - Phone viewport: the sheet layout.
  - Take screenshots for the owner.
- [ ] **Step 3: Run `npm test && npm run build`.** Expected: pass.
- [ ] **Step 4: Commit (with the owner's OK):** `Cards panel, shared cards and restore links`.

### Task 12: Share image and found counts

**Files:**
- Create: `tests/cards-share.test.js`
- Modify: `src/cards/share.js`, `src/cards/CardQuestion.jsx` and `CardsPanel.jsx` (wire Share), `src/main.jsx`

**Interfaces:**
- Produces:
  - `storyLayout(): {width:1080, height:1920, card:{x,y,w,h}, caption:{y1,y2}}`
    - The card is 1:2 and centred.
    - `card.y ≥ 0.13·1920` and `caption.y2 ≤ 0.88·1920`.
    - Card width 600.
  - `drawStory(ctx, {card, variant, images:{wide, art}}, layout)` draws the wide map scaled to cover, with `ctx.filter = 'blur(40px) brightness(.55)'`, then the card (art, fade, pills, text, stats, border) at the layout rect, then the caption.
  - `shareCard(card, variant): Promise<'shared'|'downloaded'|'failed'>`
    - Renders a 1080 × 1920 PNG.
    - Uses `navigator.share({files:[file]})` when `navigator.canShare?.({files:[file]})`.
    - Otherwise downloads `<id>.png`.
    - Tracks `card-shared/<id>`.
  - `fetchFoundCount(id): Promise<number|null>`
    - Gets `https://krunalp.goatcounter.com/counter/${encodeURIComponent('card-collected/'+id)}.json`.
    - Parses `count`, which may contain thousands separators.
    - Returns `null` on any failure, and the UI then hides the line.

- [ ] **Step 1: Write the failing test** `storyLayout keeps card and caption inside Instagram safe zones`, using the exact bounds above.
- [ ] **Step 2: Run it.** Expected: fail.
- [ ] **Step 3: Implement `share.js`.**
- [ ] **Step 4: Run `npm test`.** Expected: pass.
- [ ] **Step 5: Verify in the browser preview:**
  - Download the PNG: 1080 × 1920, card straight and centred on the blurred wide map, caption readable, nothing in the top 13 % or bottom 12 %.
  - Compare with the approved share mockup.
- [ ] **Step 6: Owner step.** Enable GoatCounter's "Allow adding visitor counts on your website". Check that the counter URL returns JSON for an event that has been tracked. Until then the count line stays hidden.
- [ ] **Step 7: Commit (with the owner's OK):** `Story share image and found counts`.

### Task 13: Final check

- [ ] **Step 1: Run `npm test && npm run build`.** Expected: all pass.
- [ ] **Step 2: Full walk-through in the browser preview**, desktop and phone viewports:
  1. Hunt from a clue.
  2. Find the card.
  3. Answer wrong, then find another card to clear the wait.
  4. Answer right.
  5. Flip, share, Save link, restore.
  6. Open a shared `?card=` link.
  7. Get a CO variant (if Task 7 Step 8 is done).
- [ ] **Step 3: Add an "Event cards" section to the README** covering the rules, files, tools and data. Hand over to the owner for merge and deploy.
