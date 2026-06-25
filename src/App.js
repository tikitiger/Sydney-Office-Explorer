import "app/app.css";
import { React, render, useHexData, useHexConfig } from "app/_data.js";
import { Map3D, BASEMAPS, DEFAULT_BASEMAP } from "app/components/Map3D.js";
import { BenchmarkPanel } from "app/components/BenchmarkPanel.js";
import { AgentChat } from "app/components/AgentChat.js";
import { LineChart } from "app/components/LineChart.js";
import { BarChart } from "app/components/BarChart.js";
import { GradeStripChart } from "app/components/GradeStripChart.js";
import { COLOR_ATTRS, buildEncoder, num, gradeRank, GRADE_COLORS } from "app/lib/geo.js";

const h = React.createElement;

const GEO1_ORDER = [
  "Sydney CBD", "Sydney Fringe", "North Sydney", "St Leonards", "Macquarie Park",
  "Chatswood", "Parramatta", "Norwest", "Sydney South", "Sydney Olympic Park/Rhodes",
];
const ALL = "__all__";
const SUBJECT_COMPETITOR_ID = "B021872"; // 388 George Street
const CURRENT_QY = "Q1 2026";

// Grade order — colors imported from geo.js (single source of truth for map + charts)
const GRADE_ORDER = ["A+", "A", "B+", "B", "C+", "C", "D+", "D", "E"];

// Normalize raw property_grade values ("Grade A" → "A", "a+" → "A+")
function normalizeGrade(g) {
  if (!g) return null;
  return String(g).replace(/grade\s*/i, "").trim().toUpperCase();
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function gradeColor(g) {
  const norm = normalizeGrade(g);
  const idx = GRADE_ORDER.indexOf(norm ?? "");
  return GRADE_COLORS[idx >= 0 ? idx : 5];
}

const VAC_BINS = [
  { label: "<5%",   min: 0,    max: 0.05 },
  { label: "5–10%", min: 0.05, max: 0.10 },
  { label: "10–20%",min: 0.10, max: 0.20 },
  { label: "20–30%",min: 0.20, max: 0.30 },
  { label: ">30%",  min: 0.30, max: Infinity },
];

// ---- chart aggregation helpers ----
function computeWeightedTS(selectedIds, tsMap, vKey, wKey) {
  const acc = new Map();
  for (const [id, periods] of Object.entries(tsMap)) {
    if (!selectedIds.has(id)) continue;
    for (const p of periods) {
      const v = p[vKey], w = p[wKey];
      if (v == null || w == null) continue;
      let e = acc.get(p.qy);
      if (!e) { e = { d: p.d, sumVW: 0, sumW: 0 }; acc.set(p.qy, e); }
      e.sumVW += v * w;
      e.sumW += w;
    }
  }
  return [...acc.entries()]
    .map(([qy, e]) => ({ qy, d: e.d, value: e.sumW > 0 ? e.sumVW / e.sumW : null }))
    .filter((d) => d.value != null)
    .sort((a, b) => (a.d || "").localeCompare(b.d || ""));
}

function computeVacDist(selectedIds, tsMap, qy) {
  const vals = [];
  for (const [id, periods] of Object.entries(tsMap)) {
    if (!selectedIds.has(id)) continue;
    for (const p of periods) {
      if (p.qy !== qy || p.vr == null) continue;
      vals.push(p.vr);
    }
  }
  return VAC_BINS.map((b) => ({
    bin: b.label,
    count: vals.filter((v) => v >= b.min && v < b.max).length,
  }));
}

function computeRentDist(selectedIds, tsMap, qy) {
  const vals = [];
  for (const [id, periods] of Object.entries(tsMap)) {
    if (!selectedIds.has(id)) continue;
    for (const p of periods) {
      if (p.qy !== qy || p.nr == null) continue;
      vals.push(p.nr);
    }
  }
  if (vals.length === 0) return [];
  const BW = 200;
  const mn = Math.floor(Math.min(...vals) / BW) * BW;
  const mx = Math.ceil(Math.max(...vals) / BW) * BW;
  const bins = [];
  for (let lo = mn; lo < mx; lo += BW) {
    const count = vals.filter((v) => v >= lo && v < lo + BW).length;
    if (count > 0) bins.push({ bin: String(lo), count });
  }
  return bins;
}

// ---- by-grade chart helpers ----
function computeGradeTS(selected, tsMap, vKey, wKey) {
  const gradeIds = new Map();
  for (const r of selected) {
    const norm = normalizeGrade(r.property_grade);
    if (!norm) continue;
    if (!gradeIds.has(norm)) gradeIds.set(norm, new Set());
    gradeIds.get(norm).add(r.id);
  }
  const rows = [];
  for (const [grade, ids] of gradeIds) {
    const ts = computeWeightedTS(ids, tsMap, vKey, wKey);
    for (const pt of ts) rows.push({ ...pt, grade });
  }
  return rows;
}

function computeGradeDistPoints(selected, tsMap, vKey, qy) {
  const idToGrade = new Map(
    selected.map((r) => [r.id, normalizeGrade(r.property_grade)]),
  );
  const pts = [];
  for (const [id, periods] of Object.entries(tsMap)) {
    const grade = idToGrade.get(id);
    if (!grade) continue;
    for (const p of periods) {
      if (p.qy !== qy || p[vKey] == null) continue;
      pts.push({ id, grade, value: p[vKey] });
    }
  }
  return pts;
}

function App() {
  const { useState, useMemo, useEffect } = React;
  const { rows, status, hasData, isEmpty } = useHexData("019eeeaf-5e18-77de-9256-f8f570328d4e");
  const cfg = useHexConfig();

  const [geo1, setGeo1] = useState(cfg.region ? [cfg.region] : ["Sydney CBD"]);
  const [geo3, setGeo3] = useState([]);
  const [gradeFilter, setGradeFilter] = useState([]);
  const [colorKey, setColorKey] = useState(cfg.color || "property_grade");
  const [basemap, setBasemap] = useState(cfg.basemap || DEFAULT_BASEMAP);
  const [competitors, setCompetitors] = useState([]);
  const [tsMap, setTsMap] = useState(null);
  const [yearFrom, setYearFrom] = useState(null);
  const [yearTo, setYearTo] = useState(null);
  const [chartMode, setChartMode] = useState("overall");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const highlightCompetitors = selectedBuilding != null;

  useEffect(() => {
    if (cfg.basemap && cfg.basemap !== basemap) setBasemap(cfg.basemap);
  }, [cfg.basemap]); // eslint-disable-line

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + "competitors.json").then((r) => r.json()).then(setCompetitors).catch(() => {});
    fetch(import.meta.env.BASE_URL + "timeseries.json").then((r) => r.json()).then(setTsMap).catch(() => {});
  }, []);

  const data = rows || [];

  const competitorMap = useMemo(() => {
    const byCompId = new Map(competitors.map((c) => [c.competitor_id, c]));
    const result = new Map();
    for (const row of data) {
      if (byCompId.has(row.id)) result.set(row.id, byCompId.get(row.id));
      else if (row.property_id && byCompId.has(row.property_id)) result.set(row.id, byCompId.get(row.property_id));
    }
    return result;
  }, [competitors, data]);

  const subjectId = useMemo(
    () => [...competitorMap.entries()].find(([, c]) => c.competitor_id === SUBJECT_COMPETITOR_ID)?.[0],
    [competitorMap],
  );

  const benchmarkPeers = useMemo(() => {
    if (!selectedBuilding) return [];
    const b = selectedBuilding;
    if (highlightCompetitors && b.id === subjectId) {
      return [...competitorMap.keys()]
        .map((id) => data.find((r) => r.id === id))
        .filter((r) => r && r.id !== b.id);
    }
    const myGrade = normalizeGrade(b.property_grade);
    const myIdx = GRADE_ORDER.indexOf(myGrade ?? "");
    const bLat = num(b.latitude), bLon = num(b.longitude);
    return data.filter((r) => {
      if (r.id === b.id) return false;
      const rIdx = GRADE_ORDER.indexOf(normalizeGrade(r.property_grade) ?? "");
      if (myIdx >= 0 && rIdx >= 0 && Math.abs(rIdx - myIdx) > 1) return false;
      if (r.geo_3 && r.geo_3 === b.geo_3) return true;
      const rLat = num(r.latitude), rLon = num(r.longitude);
      if (bLat != null && bLon != null && rLat != null && rLon != null) {
        return haversineKm(bLat, bLon, rLat, rLon) <= 1;
      }
      return false;
    });
  }, [selectedBuilding, data, competitorMap, highlightCompetitors, subjectId]);

  const peerIds = useMemo(
    () => (selectedBuilding ? new Set(benchmarkPeers.map((r) => r.id)) : null),
    [selectedBuilding, benchmarkPeers],
  );

  // ---- year bounds ----
  const yearBounds = useMemo(() => {
    let mn = Infinity, mx = -Infinity;
    for (const r of data) {
      const y = num(r.completion_year);
      if (y != null && y >= 1900 && y <= CURRENT_YEAR) {
        if (y < mn) mn = y;
        if (y > mx) mx = y;
      }
    }
    return mn === Infinity ? null : [Math.floor(mn), Math.ceil(mx)];
  }, [data]);

  useEffect(() => {
    if (yearBounds && yearFrom === null) {
      setYearFrom(yearBounds[0]);
      setYearTo(yearBounds[1]);
    }
  }, [yearBounds]); // eslint-disable-line

  // ---- grade options ----
  const gradeOptions = useMemo(() => {
    const counts = new Map();
    for (const r of data) {
      const g = r.property_grade;
      if (g) counts.set(g, (counts.get(g) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => gradeRank(a[0]) - gradeRank(b[0]))
      .map(([value, count]) => ({ value, count }));
  }, [data]);

  // ---- geo1 options ----
  const geo1Options = useMemo(() => {
    const counts = new Map();
    for (const r of data) {
      const g = r.geo_1;
      if (g) counts.set(g, (counts.get(g) || 0) + 1);
    }
    const keys = [...counts.keys()];
    keys.sort((a, b) => {
      const ia = GEO1_ORDER.indexOf(a), ib = GEO1_ORDER.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return counts.get(b) - counts.get(a);
    });
    return keys.map((k) => ({ value: k, count: counts.get(k) }));
  }, [data]);

  // ---- geo filters ----
  const geo1Filtered = useMemo(
    () => (geo1.length === 0 ? data : data.filter((r) => geo1.includes(r.geo_1))),
    [data, geo1],
  );

  const geo3Options = useMemo(() => {
    const counts = new Map();
    for (const r of geo1Filtered) {
      const g = r.geo_3;
      if (g) counts.set(g, (counts.get(g) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));
  }, [geo1Filtered]);

  const selected = useMemo(() => {
    let out = geo3.length === 0 ? geo1Filtered : geo1Filtered.filter((r) => geo3.includes(r.geo_3));
    if (gradeFilter.length > 0) out = out.filter((r) => gradeFilter.includes(r.property_grade));
    if (yearBounds && yearFrom != null && yearTo != null &&
        (yearFrom > yearBounds[0] || yearTo < yearBounds[1])) {
      out = out.filter((r) => {
        const y = num(r.completion_year);
        if (y == null || y < 1900) return false;
        return y >= yearFrom && y <= yearTo;
      });
    }
    return out;
  }, [geo1Filtered, geo3, gradeFilter, yearFrom, yearTo, yearBounds]);

  // ---- color attrs ----
  const availableColorAttrs = useMemo(
    () => COLOR_ATTRS.filter((a) => data.some((r) => { const v = r[a.key]; return v != null && v !== ""; })),
    [data],
  );

  useEffect(() => {
    if (availableColorAttrs.length && !availableColorAttrs.find((a) => a.key === colorKey)) {
      setColorKey(availableColorAttrs[0].key);
    }
  }, [availableColorAttrs]); // eslint-disable-line

  const attr = useMemo(
    () => availableColorAttrs.find((a) => a.key === colorKey) || availableColorAttrs[0] || COLOR_ATTRS[0],
    [colorKey, availableColorAttrs],
  );
  // Build encoder from full data so colors stay stable when filtering
  const encoder = useMemo(() => buildEncoder(attr, data), [attr, data]);
  const stats = useMemo(() => computeStats(selected), [selected]);

  // ---- chart data ----
  const chartData = useMemo(() => {
    if (!tsMap || selected.length === 0) return null;
    const ids = new Set(selected.map((r) => r.id));

    const vacTS = computeWeightedTS(ids, tsMap, "vr", "va").map((d) => ({
      ...d, value: Math.round(d.value * 1000) / 10,
    }));
    const rentTS = computeWeightedTS(ids, tsMap, "nr", "ra").map((d) => ({
      ...d, value: Math.round(d.value),
    }));
    const vacDist = computeVacDist(ids, tsMap, CURRENT_QY);
    const rentDist = computeRentDist(ids, tsMap, CURRENT_QY);

    const gradeVacTS = computeGradeTS(selected, tsMap, "vr", "va").map((d) => ({
      ...d, value: Math.round(d.value * 1000) / 10,
    }));
    const gradeRentTS = computeGradeTS(selected, tsMap, "nr", "ra").map((d) => ({
      ...d, value: Math.round(d.value),
    }));
    const gradeVacPts = computeGradeDistPoints(selected, tsMap, "vr", CURRENT_QY).map((d) => ({
      ...d, value: Math.round(d.value * 1000) / 10,
    }));
    const gradeRentPts = computeGradeDistPoints(selected, tsMap, "nr", CURRENT_QY);

    // Grades present in selected, in GRADE_ORDER sequence
    const gradesPresent = GRADE_ORDER.filter((g) => selected.some((r) => normalizeGrade(r.property_grade) === g));

    return { vacTS, rentTS, vacDist, rentDist, gradeVacTS, gradeRentTS, gradeVacPts, gradeRentPts, gradesPresent };
  }, [selected, tsMap]);

  const toggleGeo1 = (val) => {
    setGeo1((prev) => prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]);
    setGeo3([]);
  };
  const toggleGeo3 = (val) => {
    setGeo3((prev) => prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]);
  };

  if ((status === "RUNNING" || status === "QUEUED") && !hasData) {
    return h("div", { className: "map-loading" }, "Loading buildings…");
  }
  if ((status === "ERRORED" || status === "CANCELLED") && !hasData) {
    return h("div", { className: "map-loading" }, "Failed to load building data.");
  }
  if (isEmpty) {
    return h("div", { className: "map-loading" }, "No building data available.");
  }

  // fitKey: only top-level region change resets camera — sub-region, grade, year don't
  const fitKey = geo1;
  const yearFiltered = yearBounds && yearFrom != null &&
    (yearFrom > yearBounds[0] || yearTo < yearBounds[1]);

  return h(
    "div",
    { className: "map-app" },
    // ---- header ----
    h(
      "header",
      { className: "map-header" },
      h(
        "div",
        { className: "map-header-brand" },
        h("img", { src: import.meta.env.BASE_URL + "1024px-JLL_logo White.png", alt: "JLL", className: "header-jll-logo" }),
        h(
          "div",
          { className: "map-title-wrap" },
        h("h1", { className: "map-title" }, "Sydney Office Explorer"),
        h("div", { className: "map-sub-row" },
          h("span", { className: "map-sub" },
            `${selected.length.toLocaleString()} buildings · drag to orbit · shift+drag to pan · scroll to zoom`,
          ),
          h("span", { className: "demo-badge" }, "Illustrative data only"),
        ),
      ),
      ), // close map-header-brand
      h(
        "div",
        { className: "map-controls" },
        // Grade chips
        h("div", { className: "ctl" },
          h("span", { className: "ctl-label" + (gradeFilter.length > 0 ? " ctl-label--active" : "") }, "Grade"),
          h("div", { className: "grade-chips" },
            gradeOptions.map(({ value }) =>
              h("button", {
                key: value,
                type: "button",
                className: "grade-chip" + (gradeFilter.includes(value) ? " grade-chip--on" : ""),
                style: gradeFilter.includes(value) ? { background: gradeColor(value), borderColor: gradeColor(value) } : {},
                onClick: () => setGradeFilter((prev) =>
                  prev.includes(value) ? prev.filter((g) => g !== value) : [...prev, value]
                ),
              }, value),
            ),
          ),
        ),
        // Region dropdown
        h("div", { className: "ctl" },
          h("span", { className: "ctl-label" + (geo1.length > 0 ? " ctl-label--active" : "") }, "Region"),
          h(MultiDropdown, { options: geo1Options, selected: geo1, onToggle: toggleGeo1, placeholder: "All regions" }),
        ),
        // Precinct dropdown
        geo3Options.length > 0 ? h("div", { className: "ctl" },
          h("span", { className: "ctl-label" + (geo3.length > 0 ? " ctl-label--active" : "") }, "Precinct"),
          h(MultiDropdown, { options: geo3Options, selected: geo3, onToggle: toggleGeo3, placeholder: "All precincts" }),
        ) : null,
        // Year slider
        yearBounds && yearFrom != null
          ? h(YearSlider, {
              bounds: yearBounds, from: yearFrom, to: yearTo,
              onFrom: setYearFrom, onTo: setYearTo, filtered: yearFiltered,
            })
          : null,
      ),
    ),
    // ---- body ----
    h(
      "div",
      { className: "map-body" },
      // ---- sidebar ----
      h(
        "aside",
        { className: "map-sidebar" + (sidebarOpen ? "" : " sidebar--collapsed") },
        h("div", { className: "sidebar-inner" },
        // Color by + Basemap
        h("div", { className: "sidebar-controls" },
          h("label", { className: "ctl" },
            h("span", { className: "ctl-label" }, "Color by"),
            h("select", {
              className: "ctl-select ctl-select-full", value: colorKey,
              onChange: (e) => setColorKey(e.target.value),
            }, availableColorAttrs.map((a) =>
              h("option", { key: a.key, value: a.key }, a.label),
            )),
          ),
          h("label", { className: "ctl" },
            h("span", { className: "ctl-label" }, "Basemap"),
            h("select", {
              className: "ctl-select ctl-select-full", value: basemap,
              onChange: (e) => setBasemap(e.target.value),
            }, BASEMAPS.map((b) =>
              h("option", { key: b.key, value: b.key }, b.label),
            )),
          ),
          h("div", { className: "sidebar-check-row" },
            h("label", { className: "ctl ctl-check" },
              h("input", {
                type: "checkbox", checked: showLabels,
                onChange: (e) => setShowLabels(e.target.checked),
              }),
              h("span", { className: "ctl-label sidebar-ctl-label" }, "Building labels"),
            ),
          ),
        ),
        // Summary cards 2×3
        h(SummaryCards, { stats, scope: geo1.length === 0 ? "all regions" : "in region" }),
        // Charts toggle + 2×2 grid
        chartData
          ? h("div", null,
              h("div", { className: "chart-section-header" },
                h("span", { className: "chart-section-label" }, "Fundamentals"),
                h("div", { className: "chart-toggle" },
                  h("button", {
                    className: "chart-toggle-btn" + (chartMode === "overall" ? " active" : ""),
                    onClick: () => setChartMode("overall"),
                  }, "Overall"),
                  h("button", {
                    className: "chart-toggle-btn" + (chartMode === "byGrade" ? " active" : ""),
                    onClick: () => setChartMode("byGrade"),
                  }, "By Grade"),
                ),
              ),
              // Stable keys so LineChart cells never remount on mode switch
              h("div", { className: "sidebar-charts" },
                h("div", { key: "c1", className: "chart-cell" },
                  h("div", { className: "chart-cell-title" },
                    chartMode === "overall" ? "Wt Avg Vacancy (%)" : "Vacancy by Grade (%)",
                  ),
                  chartMode === "overall"
                    ? h(LineChart, { data: chartData.vacTS, xField: "d", yField: "value", xType: "temporal", height: 180, area: true, color: "#0c7ba1", yFormat: (v) => v.toFixed(1) + "%" })
                    : h(LineChart, { data: chartData.gradeVacTS, xField: "d", yField: "value", xType: "temporal", height: 180, colorField: "grade", colorScale: { domain: chartData.gradesPresent, range: chartData.gradesPresent.map(gradeColor) }, hideLegend: true, yFormat: (v) => v.toFixed(1) + "%" }),
                ),
                h("div", { key: "c2", className: "chart-cell" },
                  h("div", { className: "chart-cell-title" },
                    chartMode === "overall" ? `Vacancy Dist ${CURRENT_QY}` : `Vacancy Dist by Grade`,
                  ),
                  chartMode === "overall"
                    ? h(BarChart, { data: chartData.vacDist, xField: "bin", yField: "count", height: 200, color: "#0c7ba1" })
                    : h(GradeStripChart, { data: chartData.gradeVacPts, gradeOrder: chartData.gradesPresent, colorOf: gradeColor, height: 200, xFormat: (v) => `${v}%` }),
                ),
                h("div", { key: "c3", className: "chart-cell" },
                  h("div", { className: "chart-cell-title" },
                    chartMode === "overall" ? "Wt Avg Net Rent ($/sqm)" : "Net Rent by Grade ($/sqm)",
                  ),
                  chartMode === "overall"
                    ? h(LineChart, { data: chartData.rentTS, xField: "d", yField: "value", xType: "temporal", height: 180, area: true, color: "#a89480", yFormat: (v) => "$" + Math.round(v).toLocaleString() })
                    : h(LineChart, { data: chartData.gradeRentTS, xField: "d", yField: "value", xType: "temporal", height: 180, colorField: "grade", colorScale: { domain: chartData.gradesPresent, range: chartData.gradesPresent.map(gradeColor) }, hideLegend: true, yFormat: (v) => "$" + Math.round(v).toLocaleString() }),
                ),
                h("div", { key: "c4", className: "chart-cell" },
                  h("div", { className: "chart-cell-title" },
                    chartMode === "overall" ? `Net Rent Dist ${CURRENT_QY}` : `Net Rent Dist by Grade`,
                  ),
                  chartMode === "overall"
                    ? h(BarChart, { data: chartData.rentDist, xField: "bin", yField: "count", height: 180, horizontal: true, color: "#a89480" })
                    : h(GradeStripChart, { data: chartData.gradeRentPts, gradeOrder: chartData.gradesPresent, colorOf: gradeColor, height: 200 }),
                ),
              ),
              // Grade legend shown in byGrade mode
              chartMode === "byGrade" && chartData.gradesPresent.length > 0
                ? h("div", { className: "grade-legend" },
                    chartData.gradesPresent.map((g) =>
                      h("div", { key: g, className: "grade-legend-item" },
                        h("span", { className: "grade-legend-swatch", style: { background: gradeColor(g) } }),
                        h("span", { className: "grade-legend-label" }, g),
                      ),
                    ),
                  )
                : null,
            )
          : h("div", { className: "sidebar-charts-loading" }, "Loading charts…"),
        ), // closes sidebar-inner
      ),
      // ---- sidebar collapse toggle ----
      h("button", {
        className: "sidebar-collapse-btn",
        onClick: () => setSidebarOpen((v) => !v),
        title: sidebarOpen ? "Collapse panel" : "Expand panel",
      }, sidebarOpen ? "‹" : "›"),
      // ---- map area ----
      h(
        "div",
        { className: "map-canvas-area" },
        h(Map3D, { buildings: selected, encoder, geoKey: fitKey, basemap, competitorMap, highlightCompetitors, showLabels, subjectId, peerIds, selectedBuildingId: selectedBuilding?.id, onBuildingClick: setSelectedBuilding }),
        h(Legend, { attr, encoder, panelOpen: !!selectedBuilding }),
        !selectedBuilding ? h("div", { className: "map-click-hint" }, "Click a building to open analysis") : null,
        selectedBuilding ? h(BenchmarkPanel, {
          building: selectedBuilding,
          peers: benchmarkPeers,
          tsMap,
          competitorMap,
          isCompetitorMode: !!(highlightCompetitors && selectedBuilding.id === subjectId),
          onClose: () => setSelectedBuilding(null),
        }) : null,
        h(AgentChat, { buildings: selected, tsMap, selectedBuilding }),
      ),
    ),
    h("footer", { className: "map-footer" },
      h("div", { className: "footer-brand" },
        h("img", { src: import.meta.env.BASE_URL + "1024px-JLL_logo White.png", alt: "JLL", className: "jll-logo-img" }),
        h("span", { className: "footer-divider" }),
        h("span", { className: "footer-label" }, "Research"),
      ),
      h("span", { className: "footer-tag" }, "Hackathon 2026"),
    ),
  );
}

// ---- MultiDropdown ----
function MultiDropdown({ options, selected, onToggle, placeholder }) {
  const { useState, useEffect, useRef } = React;
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const isEmpty = selected.length === 0;

  return h("div", { className: "multi-drop", ref },
    h("button", {
      type: "button",
      className: "multi-drop-btn" + (open ? " multi-drop-btn--open" : "") + (!isEmpty ? " multi-drop-btn--on" : ""),
      onClick: () => setOpen((v) => !v),
    },
      isEmpty
        ? h("span", { className: "multi-drop-placeholder" }, placeholder)
        : h("span", { className: "multi-drop-pills" },
            selected.length <= 2
              ? selected.map((v) => h("span", { key: v, className: "multi-drop-pill" }, v))
              : [
                  h("span", { key: "pill", className: "multi-drop-pill" }, selected[0]),
                  h("span", { key: "more", className: "multi-drop-pill multi-drop-pill--more" }, `+${selected.length - 1}`),
                ],
          ),
      h("span", { className: "multi-drop-chevron" }, open ? "▴" : "▾"),
    ),
    open ? h("div", { className: "multi-drop-menu" },
      !isEmpty ? h("button", {
        type: "button", className: "multi-drop-clear",
        onClick: (e) => { e.stopPropagation(); selected.forEach(onToggle); },
      }, "Clear all") : null,
      options.map(({ value }) => {
        const checked = selected.includes(value);
        return h("div", {
          key: value,
          className: "multi-drop-item" + (checked ? " multi-drop-item--on" : ""),
          onClick: () => onToggle(value),
        },
          h("span", { className: "multi-drop-check" }, checked ? "✓" : ""),
          h("span", { className: "multi-drop-item-label" }, value),
        );
      }),
    ) : null,
  );
}

// ---- YearSlider ----
function YearSlider({ bounds, from, to, onFrom, onTo, filtered }) {
  const [mn, mx] = bounds;
  const span = mx - mn || 1;
  const fromPct = ((from - mn) / span * 100).toFixed(1);
  const toPct = ((to - mn) / span * 100).toFixed(1);
  const fillGrad = (pct) =>
    `linear-gradient(to right, #95c6d5 ${pct}%, rgba(255,255,255,0.15) ${pct}%)`;

  return h("div", { className: "ctl ctl-year" },
    h("span", { className: "ctl-label" + (filtered ? " ctl-label--active" : "") }, "Year built"),
    h("div", { className: "year-row" },
      h("input", {
        type: "range", className: "year-input",
        min: mn, max: mx, value: from,
        style: { background: fillGrad(fromPct) },
        onChange: (e) => onFrom(Math.min(+e.target.value, to)),
      }),
      h("span", { className: "year-val" }, from),
    ),
    h("div", { className: "year-row" },
      h("input", {
        type: "range", className: "year-input",
        min: mn, max: mx, value: to,
        style: { background: fillGrad(toPct) },
        onChange: (e) => onTo(Math.max(+e.target.value, from)),
      }),
      h("span", { className: "year-val" }, to),
    ),
  );
}

const CURRENT_YEAR = 2026;

// ---- computeStats ----
function computeStats(rows) {
  const count = rows.length;
  let ageSum = 0, ageN = 0;
  let aSum = 0, aN = 0;
  let nSum = 0, nN = 0;
  let premium = 0;
  for (const r of rows) {
    const yr = num(r.completion_year);
    if (yr != null && yr >= 1900 && yr <= CURRENT_YEAR) { ageSum += CURRENT_YEAR - yr; ageN++; }
    const ar = num(r.building_area);
    if (ar != null) { aSum += ar; aN++; }
    const nb = num(r.nabers_energy_rating);
    if (nb != null) { nSum += nb; nN++; }
    const g = (r.property_grade || "").trim().toUpperCase().replace(/^GRADE\s+/, "");
    if (g === "A" || g === "A+" || g === "PREMIUM") premium++;
  }
  return {
    count,
    avgAge: ageN ? ageSum / ageN : null,
    avgArea: aN ? aSum / aN : null,
    totalArea: aN ? aSum : null,
    avgNabers: nN ? nSum / nN : null,
    premiumPct: count ? (premium / count) * 100 : null,
  };
}

function fmt(n, digits) {
  if (n == null || !Number.isFinite(n)) return "--";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits == null ? 0 : digits });
}

// ---- SummaryCards — 2 cols × 3 rows ----
function SummaryCards({ stats, scope }) {
  const cards = [
    { label: "Buildings", value: fmt(stats.count), sub: scope || "in region" },
    { label: "Avg building age", value: stats.avgAge == null ? "--" : `${fmt(stats.avgAge, 0)} yrs`, sub: "from completion year" },
    { label: "Avg building area", value: stats.avgArea == null ? "--" : `${fmt(stats.avgArea)} sqm`, sub: "per building" },
    { label: "Total floor area", value: stats.totalArea == null ? "--" : `${fmt(stats.totalArea)} sqm`, sub: "all selected" },
    { label: "Avg NABERS energy", value: stats.avgNabers == null ? "--" : `${fmt(stats.avgNabers, 1)} ★`, sub: "rated only" },
    { label: "Premium share", value: stats.premiumPct == null ? "--" : `${fmt(stats.premiumPct)}%`, sub: "Grade A / A+" },
  ];
  return h("div", { className: "map-cards" },
    cards.map((c, i) =>
      h("div", { key: i, className: "map-card" },
        h("div", { className: "map-card-label" }, c.label),
        h("div", { className: "map-card-value", title: c.value }, c.value),
        c.sub ? h("div", { className: "map-card-sub", title: c.sub }, c.sub) : null,
      ),
    ),
  );
}

// ---- Legend ----
function Legend({ attr, encoder, panelOpen }) {
  return h("div", { className: "map-legend" + (panelOpen ? " map-legend--shifted" : "") },
    h("div", { className: "legend-title" }, attr.label),
    h("div", { className: "legend-items" },
      encoder.legend.map((item, i) =>
        h("div", { key: i, className: "legend-item" },
          h("span", { className: "legend-swatch", style: { background: item.color } }),
          h("span", { className: "legend-label", title: item.label }, item.label),
        ),
      ),
    ),
  );
}

render(h(App));
