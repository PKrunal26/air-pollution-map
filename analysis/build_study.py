"""Inline analysis/results.json into analysis/study.template.html -> public/study.html."""
import json
from pathlib import Path
here = Path(__file__).parent
data = json.loads((here / 'results.json').read_text())
data['pairs'] = data['pairs'][:24]
data['mech'] = json.loads((here / 'mechanisms.json').read_text())
# field pigments from the globe so every field keeps its colour here
import subprocess
js = "Promise.all([import('./src/paintLayers.js'),import('./src/weather.js')]).then(([p,w])=>{const o={};p.PAINT_LAYERS.forEach(l=>o[l.id]=l.colour);const m={temperature:'temperature_2m',humidity:'relative_humidity_2m',wind:'wind_speed_10m'};w.WEATHER_LAYERS.forEach(l=>o[m[l.id]]=l.colour);console.log(JSON.stringify(o))})"
data['pigments'] = json.loads(subprocess.run(['node', '-e', js], cwd=here.parent, capture_output=True, text=True, check=True).stdout)
page = (here / 'study.template.html').read_text().replace('/*DATA*/', 'const D=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';')
(here.parent / 'public/study.html').write_text(page)
print('public/study.html', len(page.encode()))
