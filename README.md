# Who Owns the Air?

A minimal, globe-first environmental artwork. Drag Earth, search one of twelve cities, and zoom closer. The Globe selector switches between a neutral white surface, charcoal and NASA satellite imagery without changing the data, camera or paint strengths. White uses ivory land and blue-grey oceans, with stronger pigment contrast and coverage for visibility. This display adjustment does not change the concentration fields or relative layer weights. Neutral surfaces include subdued country outlines; the existing ocean specular texture supplies the land/water mask.

## Real data, first layer

The PM2.5 readout fetches current-time **modeled estimates** from CAMS global atmospheric composition forecasts through Open-Meteo. It uses `domains=cams_global` consistently for all cities, with roughly 45 km grid resolution. These are area estimates, not local sensor readings, source attribution, personal exposure estimates, or citywide averages.

The globe shows the complete native CAMS global fields of PM2.5, nitrogen dioxide, ozone and dust: 900 × 451 cells at 0.4° (roughly 45 km), or 405,900 cells per layer. All four arrays are extracted from the same 03:00 UTC forecast-valid time on 9 October 2026 and the same 12:00 UTC model run on 8 October. The bulk archive's hierarchical OM file records grid projection, timestamps and individual variable units. Those are checked before extraction. Native source arrays are preserved. Display dots interpolate those values onto an equal-area spherical distribution; this does not increase the scientific resolution.

`global-air-native.json` records source URL, valid time, model reference time, units, grid layout, ranges and SHA-256 hashes. `global-air-native.bin` holds the decoded source float32 values in little-endian, layer-major order. The browser checks length, field order, checksum and every value before display; unavailable or invalid fields show an error. The binary is 6,494,400 bytes. This is a saved global snapshot, not an automatically refreshing feed.
Each layer has a fixed pigment colour and a separate fixed visual concentration range: PM2.5 0–100, NO2 0–20, ozone 0–120, dust 0–100 µg/m³. Concentration sets the local pigment weight; the paint-strength slider scales only that visual weight. A single shader combines pigment absorption in logarithmic colour space. Crisp circular marks at each sample location use size and opacity to indicate accumulated display weight. Mixing is independent of toggle order. This is an artistic pigment model, not a physical aerosol colour simulation, combined health index or chemical reaction. Dust overlaps particulate matter and is not an additional independent source contribution.

Dots use a Fibonacci sphere with approximately uniform nearest-neighbour spacing and equal surface area per sample, including around both poles. Zoom changes the global display from 256,000 to 512,000 to 1,024,000 dots with hysteresis. Each dot samples the native field by bilinear interpolation; these are display samples, not additional observations or monitoring stations. Dot footprint scales with physical spacing and camera projection. Four independent, slightly offset circular ink masks give each pollutant its own misregistered print plate. Coverage and pigment absorption are combined per fragment, retaining commutative colour mixing and unchanged source values. The offset is a display treatment in screen space; sample coordinates do not move. Charcoal uses neutral graphite land and nearly black oceans.

Close zoom adds the actual CAMS European ensemble at 0.1° (roughly 11 km) for all four pollutants. The 700 × 420 source grids use the same 9 October 2026 03:00 UTC valid time as the global snapshot, from the 8 October 00:00 UTC run. The original north-to-south OM rows are reversed for consistent browser sampling, with floats preserved exactly. `europe-air-native.json` records source, grid, units, time and SHA-256; the 4,704,000-byte binary is verified before display. Regional dots use the same equal-area construction, restricted to coverage. A boundary feather and camera-distance transition replace global marks rather than double-counting the fields. These are separate models, which can disagree. Outside Europe, data remain at about 45 km.

The globe opens with no city selected. A selected city can be cleared. Repeated zoom buttons operate relative to the current camera, including after wheel zoom; selection focuses only when a place is chosen.

The separate current city PM2.5 estimate continues to refresh on selection, manually and every 15 minutes while visible. It may differ from the global snapshot because its time and sample location differ. Missing data never becomes an invented zero.

Regenerate the native snapshot from the site checkout with `python scripts/fetch-native-air.py YYYY-MM-DDTHH:00 /absolute/cache/path` using Python with `omfiles` and `numpy` installed. Use a common native hour that contains all four fields; gases and dust are not present in every hourly spatial file. The downloader validates the run, valid time, projection, grid shape, units and all values, and caches the original OM file. No automation was scheduled. The earlier 5° JSON snapshot and point-API downloader remain as unused references.

- [Public bulk archive and layout](https://github.com/open-meteo/open-data#data-organization)
- [CAMS dataset](https://ads.atmosphere.copernicus.eu/datasets/cams-global-atmospheric-composition-forecasts)
- [Open-Meteo API and source documentation](https://open-meteo.com/en/docs/air-quality-api)
- [Open-Meteo terms](https://open-meteo.com/en/terms)
- [CC BY 4.0 data licence](https://creativecommons.org/licenses/by/4.0/)

Attribution: Copernicus Atmosphere Monitoring Service / ECMWF, via Open-Meteo. This non-commercial artwork uses the free public API; no account, credential, geolocation permission, or scheduled background automation is needed. Only public city coordinates are sent to the feed.

Earth uses NASA Blue Marble Next Generation (July 2004), resampled from the 21600×10800 global composite to 8192×4096 with a 4096×2048 fallback for limited graphics hardware. Anisotropic filtering preserves oblique detail; the coarse normal map was removed. The initial low-resolution map and ocean specular map come from Three.js example assets. Imagery is static, separate from the modeled concentration. Source: https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/

The global sample marks follow the Earth surface, hide on the far side, and have no invented animated drift. The previous single-city volume is retained as unused reference code.

## Run

```sh
npm install
npm run dev
npm test
npm run build
```

Deploy the existing Sites project declared in `.openai/hosting.json`; retain its current audience.

## Verification

Data-boundary tests cover units and UTC timestamps, missing/invalid values, upstream errors, abort signal propagation and preservation of provider values. Global tests check complete sampled fields and longitude wrapping. Paint tests check a green yellow/cyan mixture, neutral zero-strength/all-off states, bounded results and mixing independence from control order. Native tests verify exact preservation of all 1,623,600 source floats, grid orientation against 28 independently requested API values at seven locations, and rejection of truncated, corrupted, nonfinite, negative or mislabeled fields. Additional tests check polar/equatorial surface density and nearest-neighbour distances, stable zoom detail thresholds, date-line sampling, and regional float preservation, units, orientation, API values and checksum failures. The renderer is checked at the North Pole and close regional zoom; clearing and zoom-out controls are exercised before publishing.

## Earlier exploration

`src/prototype/previous-interface.jsx` and `src/data.js` retain the prior illustrative concept for future work. The current interface does not render its invented concentrations, source shares, pathways, timeline or scenarios. Future source attribution requires an appropriate dataset and methodology.
