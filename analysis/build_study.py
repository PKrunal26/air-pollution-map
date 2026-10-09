"""Inline analysis/results.json into analysis/study.template.html -> public/study.html."""
import json
from pathlib import Path
here = Path(__file__).parent
data = json.loads((here / 'results.json').read_text())
data['pairs'] = data['pairs'][:24]
page = (here / 'study.template.html').read_text().replace('/*DATA*/', 'const D=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';')
(here.parent / 'public/study.html').write_text(page)
print('public/study.html', len(page.encode()))
