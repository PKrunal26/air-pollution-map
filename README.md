# Who Owns the Air?

A minimal, globe-first environmental artwork. Drag Earth, search one of twelve cities, and zoom closer. The Globe selector switches between a neutral white surface, charcoal and NASA satellite imagery without changing the data, camera or paint strengths. White uses ivory land and blue-grey oceans, with stronger pigment contrast and coverage for visibility. This display adjustment does not change the concentration fields or relative layer weights. Neutral surfaces include subdued country outlines; the existing ocean specular texture supplies the land/water mask.

## Real data, first layer

The PM2.5 readout fetches current-time **modeled estimates** from CAMS global atmospheric composition forecasts through Open-Meteo. It uses `domains=cams_global` consistently for all cities, with roughly 45 km grid resolution. These are area estimates, not local sensor readings, source attribution, personal exposure estimates, or citywide averages.

The globe shows four global pollutant fields: PM2.5, nitrogen dioxide, ozone and dust. Each is sampled at 2,664 real locations on a 5-degree grid across land, oceans and poles. A single UTC valid time is requested for all four in every batch using `domains=cams_global` and nearest-cell selection. The bundled `global-air-layers.json` records provider model coordinates, retrieval time, units and all original values. Its timestamp is visible; global data is a saved snapshot rather than an automatically refreshing feed.

Each layer has a fixed pigment colour and a separate fixed visual concentration range: PM2.5 0–100, NO2 0–20, ozone 0–120, dust 0–100 µg/m³. Concentration sets the local pigment weight; the paint-strength slider scales only that visual weight. A single shader combines pigment absorption in logarithmic colour space and increases coverage with accumulated display weight. Mixing is independent of toggle order. This is an artistic pigment model, not a physical aerosol colour simulation, combined health index or chemical reaction. Dust overlaps particulate matter and is not an additional independent source contribution.

The coloured shell interpolates between the samples; the display is much coarser than the source's native roughly 45 km grid. Each raw array is preserved unchanged. Only a quantised, clamped visual weight enters the display texture. Slight shell height is exaggerated for visibility and does not show real altitude, wind or source attribution.

The separate current city PM2.5 estimate continues to refresh on selection, manually and every 15 minutes while visible. It may differ from the global snapshot because its time and sample location differ. Missing data never becomes an invented zero.

Regenerate the four-layer snapshot with `node scripts/fetch-global-air.mjs YYYY-MM-DDTHH:00 /absolute/cache/path`. The downloader spaces requests, caches raw responses for resuming, retries transient interruptions, checks units, coordinates and a common UTC timestamp, and refuses incomplete fields before writing the public asset. No automation was scheduled. The previous single-field snapshot is retained as a reference, not displayed.

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

Data-boundary tests cover units and UTC timestamps, missing/invalid values, upstream errors, abort signal propagation and preservation of provider values. Global tests check complete sampled fields and longitude wrapping. Paint tests check a green yellow/cyan mixture, neutral zero-strength/all-off states, bounded results and mixing independence from control order. The renderer and numerical controls are checked in the browser before publishing.

## Earlier exploration

`src/prototype/previous-interface.jsx` and `src/data.js` retain the prior illustrative concept for future work. The current interface does not render its invented concentrations, source shares, pathways, timeline or scenarios. Future source attribution requires an appropriate dataset and methodology.
