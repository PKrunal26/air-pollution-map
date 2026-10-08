export const AIR_SOURCE = {
 name: 'CAMS global atmospheric composition forecasts',
 url: 'https://ads.atmosphere.copernicus.eu/datasets/cams-global-atmospheric-composition-forecasts',
 apiDocumentation: 'https://open-meteo.com/en/docs/air-quality-api',
 licence: 'https://creativecommons.org/licenses/by/4.0/',
};

export function airQualityUrl(city) {
 if (!Number.isFinite(city.lat) || !Number.isFinite(city.lon) || Math.abs(city.lat)>90 || Math.abs(city.lon)>180) throw new Error('Invalid location');
 const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
 url.search = new URLSearchParams({latitude:String(city.lat),longitude:String(city.lon),current:'pm2_5',domains:'cams_global',timeformat:'unixtime',timezone:'GMT',forecast_days:'1'}).toString();
 return url.toString();
}

export function parseAirQuality(payload, fetchedAt = Date.now()) {
 const value = payload?.current?.pm2_5;
 const seconds = payload?.current?.time;
 if (payload?.error || typeof value!=='number' || !Number.isFinite(value) || value<0 || typeof seconds!=='number' || !Number.isFinite(seconds) || seconds<=0 || payload?.current_units?.time!=='unixtime' || payload?.current_units?.pm2_5!=='μg/m³') throw new Error('No valid PM₂.₅ estimate returned');
 if (!Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude)) throw new Error('Missing model grid location');
 const validAt = seconds * 1000;
 if (validAt > fetchedAt + 3600000) throw new Error('Unexpected future estimate');
 return {pm25:value,validAt,fetchedAt,grid:{lat:payload.latitude,lon:payload.longitude},kind:'modeled',domain:'cams_global'};
}

export async function fetchAirQuality(city, {signal,fetcher=fetch,now=Date.now} = {}) {
 const response = await fetcher(airQualityUrl(city), {signal,cache:'no-store'});
 if (!response.ok) throw new Error(`Air-quality service unavailable (${response.status})`);
 return parseAirQuality(await response.json(), now());
}
