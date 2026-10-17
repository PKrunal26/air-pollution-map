"""Hand-run tools for event cards (not part of the build).

  python scripts/card-tools.py stats <id> [--co]   # prints the card's four stats, measured on its footprint
  python scripts/card-tools.py art <id> [--co]     # writes public/cards/<id>[-co].svg and <id>[-co]-wide.svg

Reads src/cards/deck.json and the published monthly history (public/data/air-history.json, air-month-NN.bin.gz;
run `npm run data:pull` first). Needs numpy. Values are copied into the deck by hand with their method notes.
"""
import gzip, json, math, pathlib, subprocess, sys
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / 'public' / 'data'
W_, H_ = 900, 451
LAT = -90 + 0.4 * np.arange(H_)
LON = -180 + 0.4 * np.arange(W_)
CELL_KM2 = (0.4 * 111.32) ** 2 * np.cos(np.radians(LAT))[:, None] * np.ones((1, W_))
WHO = {'pm2_5': 15.0, 'pm10': 45.0, 'carbon_monoxide': 4000.0}  # WHO 2021 24-hour guidelines, µg/m³
CATALOG = {f['id']: f for f in json.loads((ROOT / 'src' / 'camsFields.json').read_text())}


def fail(message):
    print(message, file=sys.stderr)
    sys.exit(1)


def load_card(card_id, co):
    deck = json.loads((ROOT / 'src' / 'cards' / 'deck.json').read_text())
    card = next((c for c in deck if c['id'] == card_id), None)
    if card is None:
        fail(f'unknown card {card_id}')
    if not co:
        return card, card
    variant = next((v for v in card.get('variants', []) if v['kind'] == 'co'), None)
    if variant is None:
        fail(f'card {card_id} has no co variant')
    return card, {**card, **variant}


def load_history():
    manifest = json.loads((DATA / 'air-history.json').read_text())
    months = [np.datetime64(f['validAt'], 'ms').astype('datetime64[M]').astype(str) for f in manifest['frames']]
    order = manifest['fieldOrder']

    def frame(month, field):
        if field not in order:
            return None
        entry = manifest['frames'][months.index(month)]
        raw = np.frombuffer(gzip.open(DATA / entry['compressedFile']).read(), dtype='<f2').astype(np.float32)
        i = order.index(field)
        return raw[i * W_ * H_:(i + 1) * W_ * H_].reshape(H_, W_)

    def median(field):
        if field not in order:
            return None
        return np.nanmedian(np.stack([frame(m, field) for m in months]), axis=0)

    return months, frame, median


def wrap(d):
    return (d + 180) % 360 - 180


def footprint_mask(card, buffer_km=0):
    """Cells inside the footprint, or within buffer_km of its edge (same flat-frame method as src/cards/deck.js).
    Stats use the footprint itself: bufferKm is leeway for pins, and would reach into a neighbouring card (Delhi, Lahore)."""
    pts = card['footprint']
    xs = [pts[0][0]]
    for i in range(1, len(pts)):
        xs.append(xs[-1] + wrap(pts[i][0] - pts[i - 1][0]))
    mid = sum(xs) / len(xs)
    pad = buffer_km / 100 + 1
    lat_lo, lat_hi = min(p[1] for p in pts) - pad, max(p[1] for p in pts) + pad
    mask = np.zeros((H_, W_), bool)
    for yi in np.where((LAT >= lat_lo) & (LAT <= lat_hi))[0]:
        lat = LAT[yi]
        k = math.cos(math.radians(lat))
        for xi in range(W_):
            lon = LON[xi]
            shift = wrap(mid - lon) - mid
            poly = [((x + shift) * k * 111.32, (p[1] - lat) * 110.57) for x, p in zip(xs, pts)]
            if abs(poly[0][0]) > 6000:
                continue
            inside, best = False, math.inf
            for i in range(len(poly)):
                (x1, y1), (x2, y2) = poly[i], poly[i - 1]
                if (y1 > 0) != (y2 > 0) and 0 < (x2 - x1) * (0 - y1) / (y2 - y1) + x1:
                    inside = not inside
                dx, dy = x2 - x1, y2 - y1
                t = 0 if dx == dy == 0 else max(0, min(1, -(x1 * dx + y1 * dy) / (dx * dx + dy * dy)))
                best = min(best, math.hypot(x1 + t * dx, y1 + t * dy))
            mask[yi, xi] = inside or best <= buffer_km
    return mask


def pick_month(card, mask, frame):
    """The card's month with the highest footprint mean; stats and art both use it."""
    return max(card['months'], key=lambda m: float(np.nanmean(frame(m, card['field'])[mask])))


def who_field(card, co):
    if co:
        return 'carbon_monoxide'
    return 'pm10' if card['type'] == 'Dust storm' else 'pm2_5'


def stats(card_id, co):
    base, card = load_card(card_id, co)
    months, frame, median = load_history()
    mask = footprint_mask(base)
    field = card['field']
    if field not in json.loads((DATA / 'air-history.json').read_text())['fieldOrder']:
        fail(f'{field} is not in the monthly history yet')
    month = pick_month(card, mask, frame)
    v = frame(month, field)
    usual = median(field)
    elevated = mask & (v >= 2 * np.maximum(usual, 0.5))
    lo, la = map(math.radians, base['sourcePoint'])
    lat2, lon2 = np.radians(LAT)[:, None], np.radians(LON)[None, :]
    dist = 6371 * np.arccos(np.clip(np.sin(la) * np.sin(lat2) + np.cos(la) * np.cos(lat2) * np.cos(lon2 - lo), -1, 1))
    wf = who_field(base, co)
    wv = frame(month, wf)
    who = None if wv is None else round(float(np.nanmean(wv[mask])) / WHO[wf], 2)
    print(json.dumps({
        'month': month,
        'peak': round(float(np.nanmax(v[mask])), 1),
        'whoX': who,
        'areaKm2': int(round(float(np.nansum(CELL_KM2[elevated])), -3)),
        'reachKm': int(round(float(dist[elevated].max()) if elevated.any() else 0)),
        'notes': {
            'peak': f'Highest {month} monthly-mean {field} cell in the footprint, CAMS via Open-Meteo.',
            'whoX': (f'Footprint-mean {wf} ÷ WHO 2021 24-hour guideline {WHO[wf]:g} µg/m³.' if who is not None
                     else f'{wf} is not in the monthly history yet.'),
            'areaKm2': 'Footprint cells at or above twice their own median over the record.',
            'reachKm': 'Greatest distance from the source point to such a cell.',
        },
    }, ensure_ascii=False, indent=1))


def svg(card, month, frame, lon0, lon1, lat_center, width, height, step=0.5):
    cosm = math.cos(math.radians(lat_center))
    span = (lon1 - lon0) * cosm * height / width
    lat0, lat1 = lat_center - span / 2, lat_center + span / 2
    v = frame(month, card['field'])
    colour = CATALOG[card['field']]['colour']
    land = subprocess.run(['node', str(ROOT / 'scripts' / 'card-land.mjs'), *map(str, (lon0, lon1, lat0, lat1, width, height))],
                          capture_output=True, text=True, check=True).stdout
    step_px = step / (lat1 - lat0) * height
    # Explicit width/height: Firefox cannot draw a viewBox-only SVG onto a canvas (share image).
    # The land outline is defined once and used twice (fill under the dots, stroke over them); dots share one fill.
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" preserveAspectRatio="xMidYMid slice">',
           f'<defs><path id="land" d="{land}"/></defs><rect width="{width}" height="{height}" fill="#0a0d0c"/><use href="#land" fill="#36433a"/>',
           f'<g fill="{colour}">']
    num = lambda v: f'{v:.1f}'.rstrip('0').rstrip('.')  # x and y are never negative here

    def sample(la, lo):
        y, x = (la + 90) / 0.4, ((lo + 180) % 360) / 0.4
        y0, x0 = int(y), int(x)
        fy, fx = y - y0, x - x0
        g = lambda yy, xx: v[min(yy, H_ - 1), xx % W_]
        return g(y0, x0) * (1 - fx) * (1 - fy) + g(y0, x0 + 1) * fx * (1 - fy) + g(y0 + 1, x0) * (1 - fx) * fy + g(y0 + 1, x0 + 1) * fx * fy

    lstep, row, la = step / cosm, 0, lat1
    while la >= lat0:
        lo = lon0 + (lstep / 2 if row % 2 else 0)
        while lo <= lon1:
            value = sample(la, lo)
            if value == value and value > 0:
                r = 0.56 * math.sqrt(min(value / card['scale'], 1)) * step_px
                if r > 0.15:
                    out.append(f'<circle cx="{num((lo - lon0) / (lon1 - lon0) * width)}" cy="{num((lat1 - la) / (lat1 - lat0) * height)}" r="{r:.2f}"/>')
            lo += lstep
        la -= step * math.sqrt(3) / 2
        row += 1
    out.append('</g><use href="#land" fill="none" stroke="#e9efdf" stroke-width="0.9" opacity="0.8"/></svg>')
    return ''.join(out)


def art(card_id, co):
    base, card = load_card(card_id, co)
    crop = base.get('art')
    if not crop:
        fail(f'card {card_id} has no art crop (art: lon0, lon1, latCenter)')
    months, frame, _ = load_history()
    if frame(card['months'][0], card['field']) is None:
        fail(f'{card["field"]} is not in the monthly history yet')
    month = pick_month(card, footprint_mask(base), frame)
    out = ROOT / 'public' / 'cards'
    out.mkdir(exist_ok=True)
    name = card_id + ('-co' if co else '')
    lon0, lon1, c = crop['lon0'], crop['lon1'], crop['latCenter']
    half = (lon1 - lon0) * 3.6 / 2
    (out / f'{name}.svg').write_text(svg(card, month, frame, lon0, lon1, c, 300, 460))
    (out / f'{name}-wide.svg').write_text(svg(card, month, frame, (lon0 + lon1) / 2 - half, (lon0 + lon1) / 2 + half, c, 1080, 1920, step=1.2))
    print(f'wrote public/cards/{name}.svg and {name}-wide.svg ({month})')


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if a != '--co']
    if len(args) != 2 or args[0] not in ('stats', 'art'):
        fail(__doc__)
    (stats if args[0] == 'stats' else art)(args[1], '--co' in sys.argv)
