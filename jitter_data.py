"""
Applies small random noise (<0.3 std dev) to numeric fields in the public JSON files
so the published demo uses illustrative rather than exact figures.
Run once: python jitter_data.py
"""
import json, math, random, statistics, os

random.seed(42)
BASE = os.path.join(os.path.dirname(__file__), 'public')


def to_float(v):
    try: return float(v)
    except: return None

def std(values):
    nums = [to_float(v) for v in values if v is not None]
    nums = [v for v in nums if v is not None and not math.isnan(v)]
    return statistics.stdev(nums) if len(nums) >= 2 else 0


def jitter_float(v, sigma, lo=None, hi=None, decimals=4):
    if v is None: return None
    noisy = float(v) + random.gauss(0, 0.3 * sigma)
    if lo is not None: noisy = max(lo, noisy)
    if hi is not None: noisy = min(hi, noisy)
    return round(noisy, decimals)


# ── buildings.json ────────────────────────────────────────────────────────────
with open(os.path.join(BASE, 'buildings.json')) as f:
    buildings = json.load(f)

float_fields = {
    'height':               dict(lo=3),
    'building_area':        dict(lo=100),
    'nabers_energy_rating': dict(lo=0, hi=6, decimals=1),
    'nabers_water_rating':  dict(lo=0, hi=6, decimals=1),
    'nabers_ieq_rating':    dict(lo=0, hi=6, decimals=1),
    'green_star_rating':    dict(lo=0, hi=6, decimals=1),
    'NumberOfLevels':       dict(lo=1, decimals=0),
    'shp_height':           dict(lo=3),
    'shp_nabers':           dict(lo=0, hi=6, decimals=1),
}

for field, opts in float_fields.items():
    vals = [b.get(field) for b in buildings]
    sigma = std([v for v in vals if v is not None])
    if sigma == 0:
        continue
    for b in buildings:
        if b.get(field) is not None and to_float(b[field]) is not None:
            b[field] = jitter_float(b[field], sigma, **opts)

with open(os.path.join(BASE, 'buildings.json'), 'w') as f:
    json.dump(buildings, f)
print(f'buildings.json: jittered {len(buildings)} rows')


# ── timeseries.json ───────────────────────────────────────────────────────────
with open(os.path.join(BASE, 'timeseries.json')) as f:
    ts = json.load(f)

ts_fields = {
    'vr': dict(lo=0, hi=1, decimals=4),   # vacancy rate
    'va': dict(lo=0, decimals=0),          # vacant area sqm
    'nr': dict(lo=0, decimals=2),          # net rent $/sqm
    'ra': dict(lo=0, decimals=0),          # rent area sqm
}

all_records = [r for recs in ts.values() for r in recs]
for field, opts in ts_fields.items():
    vals = [r.get(field) for r in all_records]
    sigma = std([v for v in vals if v is not None])
    if sigma == 0:
        continue
    for r in all_records:
        if r.get(field) is not None:
            r[field] = jitter_float(r[field], sigma, **opts)

with open(os.path.join(BASE, 'timeseries.json'), 'w') as f:
    json.dump(ts, f, separators=(',', ':'))
total = sum(len(v) for v in ts.values())
print(f'timeseries.json: jittered {total} records across {len(ts)} buildings')


# ── competitors.json ──────────────────────────────────────────────────────────
with open(os.path.join(BASE, 'competitors.json')) as f:
    comps = json.load(f)

def parse_num(s):
    if s is None: return None
    try: return float(str(s).replace(',', '').replace('%', '').strip())
    except: return None

def fmt_back(orig, noisy):
    if orig is None: return None
    s = str(orig)
    if '%' in s: return f'{noisy:.1f}%'
    if ',' in s: return f'{noisy:,.0f}'
    try:
        int(orig)
        return str(int(round(noisy)))
    except:
        return str(round(noisy, 2))

comp_fields = {
    'building_area': dict(lo=0),
    'vacant_area':   dict(lo=0),
    'vacancy_pct':   dict(lo=0, hi=100),
}

for field, opts in comp_fields.items():
    nums = [parse_num(c.get(field)) for c in comps]
    sigma = std([v for v in nums if v is not None])
    if sigma == 0:
        continue
    for c, num in zip(comps, nums):
        if num is not None:
            noisy = jitter_float(num, sigma, **opts)
            c[field] = fmt_back(c.get(field), noisy)

with open(os.path.join(BASE, 'competitors.json'), 'w') as f:
    json.dump(comps, f, indent=2)
print(f'competitors.json: jittered {len(comps)} competitors')
