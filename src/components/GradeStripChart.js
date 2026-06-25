import { React, d3 } from "app/_data.js";

const h = React.createElement;

const TICK_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Lato', sans-serif";
const TICK_COLOR = "#555555";
const GRID_COLOR = "rgba(0,0,0,0.07)";

// Deterministic jitter using sin-based pseudo-random for stable renders
function jitter(idx, bandwidth) {
  return Math.sin(idx * 6.971 + 1.23) * bandwidth * 0.38;
}

export function GradeStripChart({ data, gradeOrder, colorOf, height = 130, xFormat }) {
  const wrapperRef = React.useRef(null);
  const renderRef = React.useRef(null);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    if (!wrapperRef.current) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(Math.round(entries[0].contentRect.width));
    });
    ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, []);

  React.useEffect(() => {
    if (!renderRef.current || !data || data.length === 0 || width === 0) return;
    const container = renderRef.current;
    d3.select(container).selectAll("*").remove();

    const fontFam = getComputedStyle(document.documentElement).getPropertyValue("--font-body").trim() || TICK_FONT;

    // Only include grades that appear in data, in gradeOrder order
    const gradesInData = gradeOrder.filter((g) => data.some((d) => d.grade === g));
    if (gradesInData.length === 0) return;

    const m = { top: 4, right: 20, bottom: 22, left: 28 };
    const iw = Math.max(10, width - m.left - m.right);
    const ih = Math.max(10, height - m.top - m.bottom);

    const xVals = data.map((d) => d.value).filter((v) => v != null && isFinite(v));
    const xMin = d3.min(xVals) ?? 0;
    const xMax = d3.max(xVals) ?? 1;
    const xScale = d3.scaleLinear().domain([xMin, xMax]).nice().range([0, iw]);

    const yScale = d3.scaleBand()
      .domain(gradesInData)
      .range([0, ih])
      .padding(0.2);

    const svg = d3.select(container)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%")
      .style("font-family", fontFam)
      .style("font-size", "11px")
      .style("overflow", "visible");

    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

    // Grid lines
    g.append("g")
      .call(d3.axisBottom(xScale).ticks(3).tickSize(ih).tickFormat(""))
      .attr("transform", "translate(0,0)")
      .call((s) => s.select(".domain").remove())
      .call((s) => s.selectAll(".tick line")
        .attr("stroke", GRID_COLOR)
        .attr("y1", 0));

    // Grade bands (subtle background stripes)
    gradesInData.forEach((grade, gi) => {
      if (gi % 2 === 0) {
        g.append("rect")
          .attr("x", 0).attr("y", yScale(grade) ?? 0)
          .attr("width", iw).attr("height", yScale.bandwidth())
          .attr("fill", "rgba(0,0,0,0.03)");
      }
    });

    // Dots — grouped by grade, deterministic jitter within band
    const gradeCounters = new Map();
    data
      .filter((d) => d.value != null && isFinite(d.value) && gradesInData.includes(d.grade))
      .forEach((d) => {
        const cnt = gradeCounters.get(d.grade) || 0;
        gradeCounters.set(d.grade, cnt + 1);
        const cy = (yScale(d.grade) ?? 0) + yScale.bandwidth() / 2 + jitter(cnt, yScale.bandwidth());
        g.append("circle")
          .attr("cx", xScale(d.value) ?? 0)
          .attr("cy", cy)
          .attr("r", 3)
          .attr("fill", colorOf(d.grade))
          .attr("opacity", 0.65);
      });

    // X axis
    const xg = g.append("g").attr("transform", `translate(0,${ih})`)
      .call(d3.axisBottom(xScale).ticks(3).tickSizeOuter(0).tickSize(0)
        .tickFormat(xFormat || ((v) => String(Math.round(v)))));
    xg.select(".domain").remove();
    xg.selectAll(".tick text").attr("fill", TICK_COLOR).style("font-size", "11px");

    // Y axis (grade labels)
    const yg = g.append("g").call(
      d3.axisLeft(yScale).tickSizeOuter(0).tickSize(0),
    );
    yg.select(".domain").remove();
    yg.selectAll(".tick text").attr("fill", TICK_COLOR).style("font-size", "11px").attr("dx", "-2px");

  }, [data, gradeOrder, colorOf, height, xFormat, width]);

  if (!data || data.length === 0) {
    return h("div", {
      style: {
        height: height + "px", display: "flex", alignItems: "center",
        justifyContent: "center", color: "var(--color-text-placeholder)", fontSize: "11px",
      },
    }, "No data");
  }

  return h(
    "div",
    { ref: wrapperRef, style: { width: "100%", height: height + "px", position: "relative" } },
    h("div", { ref: renderRef, style: { position: "absolute", inset: 0 } }),
  );
}

export default GradeStripChart;
