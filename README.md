# Who Owns the Air?

A minimal, globe-first environmental artwork. Drag Earth, search one of twelve cities, and zoom closer.

## Real data, first layer

The PM2.5 readout fetches current-time **modeled estimates** from CAMS global atmospheric composition forecasts through Open-Meteo. It uses `domains=cams_global` consistently for all cities, with roughly 45 km grid resolution. These are area estimates, not local sensor readings, source attribution, personal exposure estimates, or citywide averages.

A small geographic label anchors the selected city; the PM2.5 estimate appears in the edge readout. A continuous volumetric plume above that city responds to the same real PM2.5 value: higher concentrations create denser smoke. Its direction, envelope, height and geographic extent are artistic, not a wind, transport, source-attribution or continuous pollution model. It is hidden if no real estimate is available, and at zero concentration. Reduced-motion preference freezes the effect. The displayed time is the estimate’s valid time in UTC. The API is requested on city selection, manual refresh, and every 15 minutes while the page is visible; returning to an old tab also refreshes. A refresh failure labels any saved estimate. Invalid or missing data is never replaced with invented numbers. City changes abort in-flight requests and clear the previous city’s reading.

- [CAMS dataset](https://ads.atmosphere.copernicus.eu/datasets/cams-global-atmospheric-composition-forecasts)
- [Open-Meteo API and source documentation](https://open-meteo.com/en/docs/air-quality-api)
- [Open-Meteo terms](https://open-meteo.com/en/terms)
- [CC BY 4.0 data licence](https://creativecommons.org/licenses/by/4.0/)

Attribution: Copernicus Atmosphere Monitoring Service / ECMWF, via Open-Meteo. This non-commercial artwork uses the free public API; no account, credential, geolocation permission, or scheduled background automation is needed. Only public city coordinates are sent to the feed.

Earth uses NASA Blue Marble Next Generation (July 2004), resampled from the 21600×10800 global composite to 8192×4096 with a 4096×2048 fallback for limited graphics hardware. Anisotropic filtering preserves oblique detail; the coarse normal map was removed. The initial low-resolution map and ocean specular map come from Three.js example assets. Imagery is static, separate from the modeled concentration. Source: https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/

The plume is ray-marched in a bounded 3D volume, with Earth occlusion and frozen drift for reduced motion. Only its density responds to PM2.5; geographic extent remains illustrative.

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
