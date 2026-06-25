import { d3 } from "app/_data.js";

// ---- Web mercator projection (meters, y up) ----
const DEG = Math.PI / 180;
const R = 6378137;

export function project(lng, lat) {
  return [R * lng * DEG, R * Math.log(Math.tan(Math.PI / 4 + (lat * DEG) / 2))];
}

export const DEFAULT_HEIGHT = 30;

// ---- palette ----
export const VIZ = [
  "#0c7ba1", "#08475e", "#e30613", "#95c6d5", "#d1b9a7",
  "#626468", "#4a9eb8", "#1a5f7a", "#8b040a", "#b8d8e0",
  "#a89480", "#e8a0a5", "#2e3033",
];

// Fixed grade colors — A+ = red (premium) descending to charcoal
export const GRADE_COLORS = [
  "#e30613", // A+
  "#08475e", // A
  "#1a5f7a", // B+
  "#0c7ba1", // B
  "#4a9eb8", // C+
  "#95c6d5", // C
  "#d1b9a7", // D+
  "#626468", // D
  "#2e3033", // E
];
export const OTHER_COLOR = "#d4d5d6";
export const NODATA_COLOR = "#e8edef";

const RAMP = d3.interpolateRgbBasis([
  "#e8f4f8", "#95c6d5", "#0c7ba1", "#08475e", "#041f2b",
]);

const MAX_CAT = 12;

// ---- attribute config ----
// Rank for ordinal grade-style categories (premium -> lower).
const GRADE_RANK = { "A+": 0, A: 1, "B+": 2, B: 3, "C+": 4, C: 5, "D+": 6, D: 7, E: 8 };
export function gradeRank(label) {
  const g = String(label).replace(/grade/i, "").trim().toUpperCase();
  return GRADE_RANK[g] != null ? GRADE_RANK[g] : 999;
}

export const COLOR_ATTRS = [
  { key: "geo_2", label: "Sub-Region", kind: "cat" },
  { key: "geo_3", label: "Precinct", kind: "cat" },
  { key: "property_grade", label: "Property Grade", kind: "cat", ordinal: true, rank: gradeRank, colors: GRADE_COLORS },
  { key: "property_category", label: "Property Category", kind: "cat" },
  { key: "owner", label: "Owner", kind: "cat" },
  { key: "nabers_energy_rating", label: "NABERS Energy Rating", kind: "num" },
  { key: "nabers_water_rating", label: "NABERS Water Rating", kind: "num" },
  { key: "nabers_ieq_rating", label: "NABERS IEQ Rating", kind: "num" },
  { key: "green_star_rating", label: "Green Star Rating", kind: "num" },
  { key: "completion_year", label: "Completion Year", kind: "num", noComma: true },
  { key: "building_area", label: "Building Area", kind: "num" },
];

export function num(v) {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
export function shade(color, f) {
  let r, g, b;
  if (color[0] === "#") {
    [r, g, b] = hexToRgb(color);
  } else {
    // d3 numeric interpolators return "rgb(r, g, b)" strings
    const m = color.match(/\d+/g);
    r = m ? +m[0] : 0; g = m ? +m[1] : 0; b = m ? +m[2] : 0;
  }
  const c = (x) => Math.max(0, Math.min(255, Math.round(x * f)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}

function fmtNum(n) {
  if (n == null) return "--";
  if (Math.abs(n) >= 1000) return d3.format(",")(Math.round(n));
  return d3.format(n % 1 === 0 ? "" : ".1f")(n);
}

// Build a color encoder for the given attribute over the given rows.
// Returns { getColor(row), legend: [{label,color}], type }
export function buildEncoder(attr, rows) {
  const fmtVal = attr.noComma ? (n) => (n == null ? "--" : String(Math.round(n))) : fmtNum;
  if (attr.kind === "cat") {
    const counts = new Map();
    for (const r of rows) {
      const v = r[attr.key];
      const k = v == null || v === "" ? null : String(v);
      if (k != null) counts.set(k, (counts.get(k) || 0) + 1);
    }
    const ordered =
      attr.ordinal && attr.rank
        ? [...counts.keys()].sort(
            (a, b) => attr.rank(a) - attr.rank(b) || counts.get(b) - counts.get(a),
          )
        : [...counts.entries()].sort((a, b) => b[1] - a[1]).map((d) => d[0]);
    const top = ordered.slice(0, MAX_CAT);
    const palette = attr.colors || VIZ;
    const colorOf = new Map(top.map((c, i) => [c, palette[i % palette.length]]));
    const hasOther = ordered.length > top.length;
    const hasNull = rows.some((r) => r[attr.key] == null || r[attr.key] === "");

    const legend = top.map((c) => ({ label: c, color: colorOf.get(c) }));
    if (hasOther) legend.push({ label: "Other", color: OTHER_COLOR });
    if (hasNull) legend.push({ label: "No data", color: NODATA_COLOR });

    return {
      type: "cat",
      legend,
      getColor(row) {
        const v = row[attr.key];
        if (v == null || v === "") return NODATA_COLOR;
        return colorOf.get(String(v)) || OTHER_COLOR;
      },
    };
  }

  // numeric
  const vals = [];
  for (const r of rows) {
    const n = num(r[attr.key]);
    if (n != null) vals.push(n);
  }
  const distinct = [...new Set(vals)].sort((a, b) => a - b);
  const hasNull = rows.some((r) => num(r[attr.key]) == null);

  if (distinct.length === 0) {
    return { type: "num", legend: [{ label: "No data", color: NODATA_COLOR }], getColor: () => NODATA_COLOR };
  }

  if (distinct.length <= 8) {
    // ordered discrete values
    const colorOf = new Map(
      distinct.map((v, i) => [v, RAMP(distinct.length === 1 ? 0.5 : i / (distinct.length - 1))]),
    );
    const legend = distinct.map((v) => ({ label: fmtVal(v), color: colorOf.get(v) }));
    if (hasNull) legend.push({ label: "No data", color: NODATA_COLOR });
    return {
      type: "num",
      legend,
      getColor(row) {
        const n = num(row[attr.key]);
        if (n == null) return NODATA_COLOR;
        return colorOf.get(n) || NODATA_COLOR;
      },
    };
  }

  // quantile bins (5)
  const NB = 5;
  const sortedVals = vals.slice().sort((a, b) => a - b);
  const q = (p) => d3.quantileSorted(sortedVals, p);
  const edges = [sortedVals[0]];
  for (let i = 1; i < NB; i++) edges.push(q(i / NB));
  edges.push(sortedVals[sortedVals.length - 1]);
  // dedupe edges
  const uniq = [...new Set(edges)];
  const bins = uniq.length - 1;
  const colorFor = (i) => RAMP(bins <= 1 ? 0.5 : i / (bins - 1));

  function binIndex(n) {
    for (let i = 0; i < bins; i++) {
      if (n <= uniq[i + 1] || i === bins - 1) return i;
    }
    return bins - 1;
  }
  const legend = [];
  for (let i = 0; i < bins; i++) {
    legend.push({ label: `${fmtVal(uniq[i])} – ${fmtVal(uniq[i + 1])}`, color: colorFor(i) });
  }
  if (hasNull) legend.push({ label: "No data", color: NODATA_COLOR });

  return {
    type: "num",
    legend,
    getColor(row) {
      const n = num(row[attr.key]);
      if (n == null) return NODATA_COLOR;
      return colorFor(binIndex(n));
    },
  };
}

// point in polygon (ring of [x,y] screen coords)
export function pointInRing(pt, ring) {
  let inside = false;
  const x = pt[0], y = pt[1];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
