"""Replace the snapshot, the 48-hour forecast frames and the weather with the newest model runs (pip install omfiles numpy).
Usage: python scripts/refresh-forecast.py /absolute/cache/path
Run from the site checkout. Picks the latest 3-hourly hour, not in the future, that the newest CAMS global, CAMS Europe
and ECMWF IFS runs all cover, with every time-bar hour (one step before it to 45 hours after) in both CAMS runs, then
runs the single-purpose fetch scripts in order. Any failed check stops the run with a non-zero exit.
"""
import datetime as dt, json, pathlib, subprocess, sys, urllib.request

cache = pathlib.Path(sys.argv[1])
BASE = 'https://openmeteo.s3.amazonaws.com/data_spatial/'
STEP = dt.timedelta(hours=3)

def latest(domain):
    m = json.loads(urllib.request.urlopen(BASE + domain + '/latest.json', timeout=30).read())
    assert m['completed'] is True, domain
    parse = lambda s: dt.datetime.fromisoformat(s.replace('Z', '+00:00'))
    return parse(m['reference_time']), {parse(v) for v in m['valid_times']}

(global_run, global_hours), (europe_run, europe_hours), (weather_run, weather_hours) = (latest(d) for d in ('cams_global', 'cams_europe', 'ecmwf_ifs025'))
now = dt.datetime.now(dt.timezone.utc)
hour = now.replace(minute=0, second=0, microsecond=0, hour=now.hour - now.hour % 3)
for _ in range(16):
    bar = [hour - STEP + i * STEP for i in range(17)]
    if hour in weather_hours and all(h in global_hours and h in europe_hours for h in bar):
        break
    hour -= STEP
else:
    sys.exit('No hour is covered by all three runs')
iso = lambda t: t.strftime('%Y-%m-%dT%H:%M')
print('snapshot', iso(hour), 'runs: global', iso(global_run), 'europe', iso(europe_run), 'weather', iso(weather_run), flush=True)

# The weather file (about 45 MB) is downloaded whole: reading it by byte ranges takes over 15 minutes.
weather_file = cache / ('weather-' + weather_run.strftime('%Y-%m-%dT%H%MZ-') + hour.strftime('%Y-%m-%dT%H%M.om'))
if not weather_file.exists():
    cache.mkdir(parents=True, exist_ok=True)
    weather_file.write_bytes(urllib.request.urlopen(BASE + 'ecmwf_ifs025/' + weather_run.strftime('%Y/%m/%d/%H%MZ/') + hour.strftime('%Y-%m-%dT%H%M.om'), timeout=300).read())
python = sys.executable
for step in [
    ['scripts/fetch-native-air.py', iso(hour), str(cache), '--run', iso(global_run)],
    ['scripts/fetch-air-frames.py', iso(global_run), iso(bar[0]), iso(bar[-1]), str(cache)],
    ['scripts/fetch-europe-native.py', iso(hour), str(cache), '--run', iso(europe_run)],
    ['scripts/fetch-europe-frames.py', iso(europe_run), str(cache)],
    ['scripts/prepare-weather.py', iso(hour), '--run', iso(weather_run) + 'Z', '--file', str(weather_file)],
    ['scripts/compress-native.py'],
]:
    print('>', ' '.join(step), flush=True)
    # The fetch scripts print their full metadata; only the last line is kept in the log.
    result = subprocess.run([python, *step], capture_output=True, text=True)
    if result.returncode:
        sys.exit(result.stdout[-2000:] + result.stderr[-4000:])
    print(' ', (result.stdout.strip().splitlines() or [''])[-1], flush=True)
print('done', flush=True)
