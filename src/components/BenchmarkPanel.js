import { React } from "app/_data.js";
import { GRADE_COLORS, num } from "app/lib/geo.js";

const h = React.createElement;

const GRADE_ORDER = ["A+", "A", "B+", "B", "C+", "C", "D+", "D", "E"];
const CURRENT_YEAR = 2026;
const MAX_RATING = 6;

function latestTs(tsMap, row) {
  if (!tsMap || !row) return null;
  const series = tsMap[row.id] || tsMap[row.property_id] || null;
  if (!series || !series.length) return null;
  return series[series.length - 1];
}

function gradeColor(g) {
  const norm = (g || "").replace(/grade\s*/i, "").trim().toUpperCase();
  const idx = GRADE_ORDER.indexOf(norm);
  return GRADE_COLORS[idx >= 0 ? idx : 5];
}

function MetricBar({ label, subjectVal, peerVals, format, higherIsBetter }) {
  if (subjectVal == null && peerVals.length === 0) return null;

  const all = [...peerVals, ...(subjectVal != null ? [subjectVal] : [])];
  const minV = Math.min(...all);
  const maxV = Math.max(...all);
  const range = maxV - minV || 1;
  const pct = (v) => Math.max(0, Math.min(100, ((v - minV) / range) * 100));

  const sorted = [...peerVals].sort((a, b) => a - b);
  const q1 = sorted.length >= 4 ? sorted[Math.floor(sorted.length * 0.25)] : sorted[0] ?? minV;
  const q3 = sorted.length >= 4 ? sorted[Math.floor(sorted.length * 0.75)] : sorted[sorted.length - 1] ?? maxV;
  const subjPct = subjectVal != null ? pct(subjectVal) : null;
  const peerAvg = peerVals.length > 0 ? peerVals.reduce((a, b) => a + b, 0) / peerVals.length : null;

  let rankText = null;
  if (subjectVal != null && peerVals.length > 0) {
    const beats = higherIsBetter
      ? peerVals.filter((v) => v < subjectVal).length
      : peerVals.filter((v) => v > subjectVal).length;
    const p = Math.round((beats / peerVals.length) * 100);
    rankText = p >= 60 ? `Top ${100 - p}%` : p <= 40 ? `Below avg` : "Near average";
  }

  return h("div", { className: "bp-metric" },
    h("div", { className: "bp-metric-top" },
      h("span", { className: "bp-metric-label" }, label),
      h("div", { className: "bp-metric-vals" },
        subjectVal != null ? h("span", { className: "bp-metric-subject-val" }, format(subjectVal)) : null,
        peerAvg != null ? h("span", { className: "bp-metric-peer-val" }, `avg ${format(peerAvg)}`) : null,
      ),
    ),
    h("div", { className: "bp-bar-track" },
      peerVals.length >= 2
        ? h("div", { className: "bp-bar-iqr", style: { left: `${pct(q1)}%`, width: `${Math.max(2, pct(q3) - pct(q1))}%` } })
        : null,
      subjPct != null ? h("div", { className: "bp-bar-marker", style: { left: `calc(${subjPct}% - 5px)` } }) : null,
    ),
    rankText ? h("div", { className: "bp-metric-rank" }, rankText) : null,
  );
}

function SpecItem({ label, value, peerVals }) {
  const n = num(value);
  const hasVal = n != null && n > 0;
  const peerNums = (peerVals || []).map(num).filter((v) => v != null && v > 0);
  const subjPct = hasVal ? (n / MAX_RATING) * 100 : null;
  const sorted = [...peerNums].sort((a, b) => a - b);
  const q1 = sorted.length >= 4 ? sorted[Math.floor(sorted.length * 0.25)] : sorted[0] ?? 0;
  const q3 = sorted.length >= 4 ? sorted[Math.floor(sorted.length * 0.75)] : sorted[sorted.length - 1] ?? MAX_RATING;
  const peerAvg = peerNums.length ? peerNums.reduce((a, b) => a + b, 0) / peerNums.length : null;
  const stars = hasVal ? "★".repeat(Math.min(MAX_RATING, Math.round(n))) : null;
  const peerStars = peerAvg ? "★".repeat(Math.min(MAX_RATING, Math.round(peerAvg))) : null;

  return h("div", { className: "bp-spec-item" },
    h("div", { className: "bp-spec-label" }, label),
    h("div", { className: "bp-spec-val-row" },
      h("div", { className: "bp-spec-value" + (hasVal ? "" : " bp-spec-na") }, hasVal ? n.toFixed(1) : "NR"),
      hasVal ? h("div", { className: "bp-spec-stars" }, stars) : null,
    ),
    h("div", { className: "bp-bar-track bp-spec-bar" },
      peerNums.length >= 2
        ? h("div", { className: "bp-bar-iqr", style: { left: `${(q1 / MAX_RATING) * 100}%`, width: `${Math.max(2, ((q3 - q1) / MAX_RATING) * 100)}%` } })
        : null,
      subjPct != null ? h("div", { className: "bp-bar-marker", style: { left: `calc(${subjPct}% - 5px)` } }) : null,
    ),
    peerAvg != null
      ? h("div", { className: "bp-spec-peer" },
          `avg ${peerAvg.toFixed(1)} `,
          h("span", { className: "bp-spec-peer-stars" }, peerStars),
        )
      : null,
  );
}

function parseNztEntry(str) {
  if (!str) return null;
  const m = str.match(/^(.+?)\s*\((.+)\)$/);
  if (!m) return { tenant: str, detail: null };
  return { tenant: m[1].trim(), detail: m[2].trim() };
}

// Compact card with horizontal pill stats
function PeerCard({ row, tsMap, comp }) {
  const ts = latestTs(tsMap, row);
  const vac = ts ? (ts.vr * 100).toFixed(1) + "%" : null;
  const rent = ts ? "$" + Math.round(ts.nr / 10) * 10 : null;
  const nb = num(row.nabers_energy_rating);
  const gs = num(row.green_star_rating);
  const nabers = nb != null && nb > 0 ? nb.toFixed(1) + "★" : null;
  const greenStar = gs != null && gs > 0 ? gs.toFixed(1) + "★" : null;
  const grade = (row.property_grade || "").replace(/grade\s*/i, "").trim().toUpperCase();
  const color = gradeColor(row.property_grade);
  const title = row.building_name || row.address || "Building";
  const nztCount = comp
    ? ["net_zero_tenants", "net_zero_tenants_2", "net_zero_tenants_3"].filter((k) => comp[k]).length
    : 0;
  const elec = comp && comp.electrification && comp.electrification !== "N/A" ? comp.electrification : null;

  return h("div", { className: "bp-peer-card" },
    h("div", { className: "bp-peer-card-header" },
      h("div", { className: "bp-peer-grade", style: { background: color } }, grade || "?"),
      h("div", { className: "bp-peer-name" }, title),
    ),
    h("div", { className: "bp-peer-pills" },
      vac ? h("span", { className: "bp-pill" }, vac + " vac") : null,
      rent ? h("span", { className: "bp-pill" }, rent + "/sqm") : null,
      nabers ? h("span", { className: "bp-pill bp-pill--green" }, "NRG " + nabers) : null,
      greenStar ? h("span", { className: "bp-pill bp-pill--green" }, "GS " + greenStar) : null,
      nztCount > 0 ? h("span", { className: "bp-pill bp-pill--teal" }, nztCount + " NZT") : null,
      elec ? h("span", { className: "bp-pill bp-pill--amber" }, elec) : null,
    ),
  );
}

export function BenchmarkPanel({ building, peers, tsMap, isCompetitorMode, onClose, competitorMap }) {
  const [collapsed, setCollapsed] = React.useState(false);

  if (!building) return null;

  const r = building;
  const bArea = num(r.building_area);
  const bYear = num(r.completion_year);
  const bAge = bYear != null && bYear >= 1900 ? CURRENT_YEAR - bYear : null;
  const bTs = latestTs(tsMap, r);
  const bVac = bTs ? bTs.vr * 100 : null;
  const bRent = bTs ? bTs.nr : null;

  const peerTsData = peers.map((p) => latestTs(tsMap, p)).filter(Boolean);
  const peerVacs = peerTsData.map((t) => t.vr * 100);
  const peerRents = peerTsData.map((t) => t.nr);
  const peerAreas = peers.map((p) => num(p.building_area)).filter((v) => v != null);
  const peerYears = peers.map((p) => num(p.completion_year)).filter((y) => y != null && y >= 1900);
  const peerAges = peerYears.map((y) => CURRENT_YEAR - y);

  const bGrade = (r.property_grade || "").replace(/grade\s*/i, "").trim().toUpperCase();
  const bGradeColor = gradeColor(r.property_grade);

  const context = isCompetitorMode
    ? `${peers.length} pre-defined competitors`
    : peers.length === 0
    ? "No nearby peers found"
    : `${peers.length} peer${peers.length !== 1 ? "s" : ""} · grade ±1 · nearby`;

  const buildingTitle = r.building_name || r.address || "Building";

  // NZT grouped by building: subject first, then each competitor
  const nztGroups = [];
  if (isCompetitorMode && competitorMap) {
    for (const bldg of [r, ...peers]) {
      const comp = competitorMap.get(bldg.id);
      if (!comp) continue;
      const entries = ["net_zero_tenants", "net_zero_tenants_2", "net_zero_tenants_3"]
        .map((k) => comp[k] ? parseNztEntry(comp[k]) : null)
        .filter(Boolean);
      if (entries.length) {
        nztGroups.push({
          building: bldg.building_name || bldg.address || comp.address || "",
          isSubject: bldg.id === r.id,
          entries,
        });
      }
    }
  }

  return h("div", { className: "bp-panel" + (collapsed ? " bp-panel--collapsed" : "") },
    h("button", {
      className: "bp-tab",
      onClick: () => setCollapsed((v) => !v),
      title: collapsed ? "Expand" : "Collapse",
    }, collapsed ? "▸" : "◂"),
    collapsed ? null : h("div", { className: "bp-content" },
      // Header
      h("div", { className: "bp-header" },
        h("div", { className: "bp-header-top" },
          h("div", { className: "bp-grade-badge", style: { background: bGradeColor } }, bGrade || "?"),
          h("div", { className: "bp-header-text" },
            h("div", { className: "bp-building-name" }, buildingTitle),
            r.address && r.address !== buildingTitle
              ? h("div", { className: "bp-building-addr" }, r.address)
              : null,
          ),
          h("button", { className: "bp-close", onClick: onClose, title: "Close" }, "✕"),
        ),
        h("div", { className: "bp-context" }, `vs. ${context}`),
      ),
      // Building profile (first)
      h("div", { className: "bp-section" },
        h("div", { className: "bp-section-title" }, "Building"),
        h(MetricBar, {
          label: "NLA (sqm)", subjectVal: bArea, peerVals: peerAreas,
          format: (v) => Math.round(v).toLocaleString(), higherIsBetter: true,
        }),
        h(MetricBar, {
          label: "Age", subjectVal: bAge, peerVals: peerAges,
          format: (v) => Math.round(v) + " yrs", higherIsBetter: false,
        }),
      ),
      // Market metrics (second)
      h("div", { className: "bp-section" },
        h("div", { className: "bp-section-title" }, "Market"),
        h(MetricBar, {
          label: "Net rent ($/sqm)", subjectVal: bRent, peerVals: peerRents,
          format: (v) => "$" + Math.round(v).toLocaleString(), higherIsBetter: false,
        }),
        h(MetricBar, {
          label: "Vacancy rate", subjectVal: bVac, peerVals: peerVacs,
          format: (v) => v.toFixed(1) + "%", higherIsBetter: false,
        }),
      ),
      // Green credentials
      h("div", { className: "bp-section" },
        h("div", { className: "bp-section-title" }, "Green credentials"),
        h("div", { className: "bp-specs-grid" },
          h(SpecItem, { label: "NABERS Energy", value: r.nabers_energy_rating, peerVals: peers.map((p) => p.nabers_energy_rating) }),
          h(SpecItem, { label: "NABERS Water", value: r.nabers_water_rating, peerVals: peers.map((p) => p.nabers_water_rating) }),
          h(SpecItem, { label: "NABERS IEQ", value: r.nabers_ieq_rating, peerVals: peers.map((p) => p.nabers_ieq_rating) }),
          h(SpecItem, { label: "Green Star", value: r.green_star_rating, peerVals: peers.map((p) => p.green_star_rating) }),
        ),
      ),
      // Peer / competitor list (above NZT)
      peers.length > 0 ? h("div", { className: "bp-section" },
        h("div", { className: "bp-section-title" },
          isCompetitorMode ? "Competitors" : "Peer buildings",
        ),
        h("div", { className: "bp-peer-list" },
          peers.map((p) =>
            h(PeerCard, {
              key: p.id,
              row: p,
              tsMap,
              comp: competitorMap ? competitorMap.get(p.id) : null,
            }),
          ),
        ),
      ) : null,
      // Net zero tenants — grouped by building
      nztGroups.length > 0 ? h("div", { className: "bp-section" },
        h("div", { className: "bp-section-title" }, "Net zero tenants"),
        h("div", { className: "bp-nzt-groups" },
          nztGroups.map((g, gi) =>
            h("div", { key: gi, className: "bp-nzt-group" },
              h("div", { className: "bp-nzt-group-header" },
                g.isSubject
                  ? h("span", { className: "bp-nzt-group-tag bp-nzt-group-tag--subject" }, "Subject")
                  : h("span", { className: "bp-nzt-group-tag" }, "Competitor"),
                h("span", { className: "bp-nzt-group-name" }, g.building),
              ),
              h("div", { className: "bp-nzt-list" },
                g.entries.map((e, ei) =>
                  h("div", { key: ei, className: "bp-nzt-row" },
                    h("div", { className: "bp-nzt-tenant" }, e.tenant),
                    e.detail ? h("div", { className: "bp-nzt-detail" }, e.detail) : null,
                  ),
                ),
              ),
            ),
          ),
        ),
      ) : null,
    ),
  );
}

export default BenchmarkPanel;
