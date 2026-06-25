import pandas as pd, json, math, os

os.chdir(os.path.join(os.path.dirname(__file__), 'public'))

df = pd.read_excel('Sydney_Office_REDS_Enriched.xlsx', sheet_name='F1 Time Series')

def cn(v):
    if v is None: return None
    if isinstance(v, float) and math.isnan(v): return None
    try:
        n = float(v)
        return None if math.isnan(n) else round(n, 4)
    except: return None

def cd(v):
    if isinstance(v, pd.Timestamp): return str(v.date())
    s = str(v).split(' ')[0]
    return s if s != 'NaT' else None

out = {}
for _, row in df.iterrows():
    pid = str(row['property_id']).strip()
    rec = {
        'qy': str(row['quarter']) + ' ' + str(int(row['year'])),
        'd':  cd(row['date']),
        'vr': cn(row['Vacancy Rate']),
        'va': cn(row['Building Area (Vacancy)']),
        'nr': cn(row['Net Rent']),
        'ra': cn(row['Building Area (Rents)']),
    }
    if pid not in out: out[pid] = []
    out[pid].append(rec)

for pid in out:
    out[pid].sort(key=lambda r: r['d'] or '')

with open('timeseries.json', 'w') as f:
    json.dump(out, f, separators=(',', ':'))

total = sum(len(v) for v in out.values())
print(f'Written timeseries.json: {len(out)} buildings, {total} records')
