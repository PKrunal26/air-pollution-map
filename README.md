# Who Owns the Air?

An exploratory 3D globe artwork, built with React, Three.js and Vite.

## Run locally

`npm install`

`npm run dev`

## Build

`npm run build`

The self-contained static output is in `dist/`. Serve it over HTTP rather than opening `index.html` as a local file.

## What is illustrative

All pollution concentrations, historical trends, source shares, reductions and geographic origin pathways are invented. They are not measurements, forecasts, verified attribution or personal exposure estimates. Atmospheric smoke is an artistic interpretation. The prototype uses 12 predefined cities; searching is local and does not call a geocoder.

The geographic city positions and Natural Earth boundaries are genuine geographic context. The Earth texture is from the official three.js example assets. General pollution formation and health explanations link to EPA references in the About panel.

## Exploration

Drag the globe, pinch or scroll to zoom; when the globe is focused, arrow keys rotate and +/- change distance. Search a demo city to fly closer. Source name buttons select a trace; checkboxes independently toggle layers. The inspector has Atmosphere, Systems and Impact tabs. Compare places, scrub 2015–2024, choose a month or play the timeline. What if? changes only an illustrative intensity rule.

Two WebMCP tools, when supported by the browser, mirror visible controls: `read_atlas_state` and `explore_atmosphere`. Invalid inputs are rejected before state changes.

## Verification

Production build completed. Local browser checks covered Earth rendering, city search/fly-to, chemistry traces, comparisons, timeline changes, mobile source and inspector controls, document bounds, and valid/invalid WebMCP calls. Mobile was inspected at 390 × 844. No external pollution services or credentials are used by this application.
