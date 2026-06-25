import pandas as pd, json, math, os

os.chdir(os.path.join(os.path.dirname(__file__), 'public'))

df = pd.read_excel('Competitor analysis - Portfolio summary.xlsx', sheet_name='Sheet4', index_col=0)

def clean(v):
    if v is None: return None
    if isinstance(v, float) and math.isnan(v): return None
    if isinstance(v, pd.Timestamp): return str(v.date())
    s = str(v).strip()
    if s in ('nan', 'NaN', 'NR', 'N/A', ''): return None
    return s

# Deduplicate index labels (NET ZERO Tenants appears 3 times)
seen = {}
new_idx = []
for label in df.index:
    clean_label = str(label).strip()
    if clean_label in seen:
        seen[clean_label] += 1
        new_idx.append(clean_label + '_' + str(seen[clean_label]))
    else:
        seen[clean_label] = 1
        new_idx.append(clean_label)
df.index = new_idx

comps = []
for bid in df.columns:
    col = df[bid]
    def g(k):
        return clean(col.get(k))
    comps.append({
        'competitor_id': bid,
        'address':            g('Address'),
        'status':             g('Status'),
        'precinct':           g('Precinct'),
        'market':             g('Market'),
        'grade':              g('Grade'),
        'building_area':      clean(col.get('Building Area')),
        'vacant_area':        clean(col.get('Vacant Area (2Q25)')),
        'vacancy_pct':        clean(col.get('Vacancy %')),
        'year_built':         clean(col.get('Year Built')),
        'levels':             clean(col.get('Levels')),
        'nabers':             g('NABERS'),
        'nabers_expiry':      g('NABERS Expiry'),
        'electrification':    g('Electirifaction status\n1:Complete\n2: Underway\n3: Planned'),
        'owners':             g('Owners'),
        'net_zero_tenants':   g('NET ZERO Tenants (>5,000 sqm)'),
        'net_zero_tenants_2': g('NET ZERO Tenants (>5,000 sqm)_2'),
        'net_zero_tenants_3': g('NET ZERO Tenants (>5,000 sqm)_3'),
    })

with open('competitors.json', 'w') as f:
    json.dump(comps, f, indent=2)
ids = [c['competitor_id'] for c in comps]
print('Written', len(comps), 'competitors:', ids)
