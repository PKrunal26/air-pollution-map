# Who Owns the Air?

A minimal, globe-first environmental artwork. Drag Earth, search one of twelve cities, and zoom closer.

## Real data, first layer

The PM2.5 readout fetches current-time **modeled estimates** from CAMS global atmospheric composition forecasts through Open-Meteo. It uses `domains=cams_global` consistently for all cities, with roughly 45 km grid resolution. These are area estimates, not local sensor readings, source attribution, personal exposure estimates, or citywide averages.

The globe now shows a global PM2.5 concentration layer, sampled at 2,664 real locations on a 5-degree grid including land, oceans and poles. A single UTC valid time is requested for every sample from `domains=cams_global` using nearest-cell selection. The bundled snapshot records provider model coordinates, retrieval time, units and all sample values. The timestamp is always visible; this is a saved snapshot, not an automatically refreshed global feed.

The coloured shell smoothly interpolates between samples. Its display grid is much coarser than CAMS's native roughly 45 km grid: do not read local boundaries or fine details from this layer. Colour and opacity encode concentration with a fixed numerical legend, not health categories. Slight shell height is exaggerated and is not a plume-altitude or wind model. The single-city decorative plume has been replaced by this worldwide field.

The separate city estimate refreshes on selection, manually and every 15 minutes while visible. It can differ from the global layer because its time and sample location differ. City changes abort requests; missing data never becomes a fabricated zero.

Regenerate a snapshot with `node scripts/fetch-global-air.mjs YYYY-MM-DDTHH:00 /absolute/cache/path` from the site directory. The downloader spaces requests to respect rate limits, caches raw responses for resuming, validates one common UTC timestamp, and refuses incomplete or invalid grids before writing the public asset. No automation was scheduled.

- [CAMS dataset](https://ads.atmosphere.copernicus.eu/datasets/cams-global-atmospheric-composition-forecasts)
- [Open-Meteo API and source documentation](https://open-meteo.com/en/docs/air-quality-api)
- [Open-Meteo terms](https://open-meteo.com/en/terms)
- [CC BY 4.0 data licence](https://creativecommons.org/licenses/by/4.0/)

Attribution: Copernicus Atmosphere Monitoring Service / ECMWF, via Open-Meteo. This non-commercial artwork uses the free public API; no account, credential, geolocation permission, or scheduled background automation is needed. Only public city coordinates are sent to the feed.

Earth uses NASA Blue Marble Next Generation (July 2004), resampled from the 21600×10800 global composite to 8192×4096 with a 4096×2048 fallback for limited graphics hardware. Anisotropic filtering preserves oblique detail; the coarse normal map was removed. The initial low-resolution map and ocean specular map come from Three.js example assets. Imagery is static, separate from the modeled concentration. Source: https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/

The global layer follows the Earth surface, occludes on the far side, and has no invented animated drift. The previous single-city volume is retained as unused reference code.

## Run

```sh
npm install
npm run dev
npm test
npm run build
```

Deploy the existing Sites project declared in `.openai/hosting.json`; retain its current audience.

## Verification

Four data-boundary tests cover units and UTC timestamps, missing/invalid values, upstream errors, abort signal propagation and preservation of the provider’s concentration. The live browser flow was checked for New Delhi and London, manual source attribution, and mobile layout. The browser’s displayed values matched the live feed: Delhi 71.0 and London 3.9 micrograms per cubic metre, valid 8 October 2026 at 10:00 UTC. Those values are verification evidence, not bundled fallback data.

## Earlier exploration

`src/prototype/previous-interface.jsx` and `src/data.js` retain the prior illustrative concept for future work. The current interface does not render its invented concentrations, source shares, pathways, timeline or scenarios. Future source attribution requires an appropriate dataset and methodology.
