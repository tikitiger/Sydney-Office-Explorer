import { React, d3 } from "app/_data.js";

const h = React.createElement;

const TICK_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Lato', sans-serif";
const GRID_COLOR = "rgba(0,0,0,0.07)";
const TICK_COLOR = "#555555";
const TICK_COLOR_STRONG = "#333333";

export function BarChart({ data, xField, yField, height, color, horizontal }) {
  const wrapperRef = React.useRef(null);
  const renderRef = React.useRef(null);
  const [width, setWidth] = React.useState(0);

  // Horizontal bars: use explicit height if provided, else dynamic
  const chartHeight = horizontal && !height
    ? Math.max(200, (data ? data.length : 0) * 32 + 60)
    : (height || 200);

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

    const barFill = color || "#2563eb";
    const barFillBase = hexToRgba(barFill, 0.82);
    const barFillHover = hexToRgba(barFill, 1.0);

    const tip = d3.select(container)
      .append("div")
      .style("position", "absolute").style("pointer-events", "none")
      .style("background", "#ffffff")
      .style("border", "1px solid rgba(0,0,0,0.12)")
      .style("border-radius", "6px").style("padding", "6px 10px")
      .style("font-size", "11px").style("font-family", TICK_FONT)
      .style("color", "#111111")
      .style("box-shadow", "0 4px 12px rgba(0,0,0,0.10)")
      .style("opacity", "0").style("z-index", "100").style("white-space", "nowrap");

    const svg = d3
      .select(container)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${chartHeight}`)
      .attr("width", "100%")
      .style("font-family", TICK_FONT)
      .style("font-size", "11px")
      .style("overflow", "visible");

    if (horizontal) {
      // Horizontal bars: bins on y-axis, count on x-axis (x-axis at top)
      const m = { top: 24, right: 48, bottom: 8, left: 60 };
      const iw = Math.max(10, width - m.left - m.right);
      const ih = Math.max(10, chartHeight - m.top - m.bottom);

      const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

      const yScale = d3.scaleBand()
        .domain(data.map((d) => d[xField]))
        .range([0, ih])
        .padding(0.3);

      const xMax = d3.max(data, (d) => +d[yField]) || 1;
      const xScale = d3.scaleLinear().domain([0, xMax]).nice().range([0, iw]);

      // Vertical grid lines (contained within chart area)
      g.selectAll(".vgrid")
        .data(xScale.ticks(4)).enter().append("line")
        .attr("x1", (d) => xScale(d)).attr("x2", (d) => xScale(d))
        .attr("y1", 0).attr("y2", ih)
        .attr("stroke", GRID_COLOR).attr("stroke-width", 1);

      // Bars
      const showTip = (event, d) => {
        const wRect = container.getBoundingClientRect();
        const tw = tip.node().offsetWidth || 100;
        let lx = event.clientX + 10 - wRect.left;
        if (lx + tw > wRect.width - 4) lx = event.clientX - tw - 10 - wRect.left;
        tip.html(`<strong>$${d[xField]}</strong>/sqm — <strong>${d[yField]}</strong> buildings`)
          .style("opacity", "1")
          .style("left", lx + "px")
          .style("top", (event.clientY - 40 - wRect.top) + "px");
      };
      g.selectAll(".bar")
        .data(data).enter().append("rect")
        .attr("y", (d) => yScale(d[xField]) ?? 0)
        .attr("x", 0)
        .attr("rx", 2)
        .attr("height", yScale.bandwidth())
        .attr("width", (d) => Math.max(0, xScale(Math.max(0, +d[yField])) ?? 0))
        .attr("fill", barFillBase)
        .attr("stroke", "none")
        .style("cursor", "default")
        .on("mouseover", function(event, d) { d3.select(this).attr("fill", barFillHover); showTip(event, d); })
        .on("mousemove", showTip)
        .on("mouseout", function() { d3.select(this).attr("fill", barFillBase); tip.style("opacity", "0"); });

      // Value labels at bar ends
      g.selectAll(".val-label")
        .data(data).enter().append("text")
        .attr("x", (d) => Math.max(0, xScale(Math.max(0, +d[yField])) ?? 0) + 5)
        .attr("y", (d) => (yScale(d[xField]) ?? 0) + yScale.bandwidth() / 2)
        .attr("dy", "0.35em")
        .style("font-size", "10.5px").style("fill", TICK_COLOR_STRONG)
        .style("font-family", TICK_FONT)
        .text((d) => d[yField]);

      // X axis at top
      const xg = g.append("g").call(d3.axisTop(xScale).ticks(4).tickSizeOuter(0).tickSize(0));
      xg.select(".domain").remove();
      xg.selectAll(".tick text").attr("fill", TICK_COLOR).style("font-size", "11px");

      // Y axis (bin labels)
      const yg = g.append("g").call(d3.axisLeft(yScale).tickSizeOuter(0).tickSize(0));
      yg.select(".domain").remove();
      yg.selectAll(".tick text").attr("fill", TICK_COLOR_STRONG).style("font-size", "11px")
        .attr("dx", "-4px");

    } else {
      // Vertical bars
      const m = { top: 6, right: 6, bottom: 28, left: 32 };
      const iw = Math.max(10, width - m.left - m.right);
      const ih = Math.max(10, chartHeight - m.top - m.bottom);

      const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

      const xScale = d3.scaleBand()
        .domain(data.map((d) => d[xField]))
        .range([0, iw])
        .padding(0.25);

      const yMax = d3.max(data, (d) => +d[yField]) || 1;
      const yScale = d3.scaleLinear().domain([0, yMax]).nice().range([ih, 0]);

      // Horizontal grid lines only
      g.append("g")
        .call(d3.axisLeft(yScale).ticks(4).tickSize(-iw).tickFormat(""))
        .call((s) => s.select(".domain").remove())
        .call((s) => s.selectAll(".tick line").attr("stroke", GRID_COLOR));

      const totalCount = d3.sum(data, (dd) => +dd[yField]) || 1;
      // Bars
      const showTipV = (event, d) => {
        const wRect = container.getBoundingClientRect();
        const tw = tip.node().offsetWidth || 100;
        let lx = event.clientX + 10 - wRect.left;
        if (lx + tw > wRect.width - 4) lx = event.clientX - tw - 10 - wRect.left;
        const pct = Math.round((+d[yField] / totalCount) * 100);
        tip.html(`<strong>${d[xField]}</strong>: ${d[yField]} buildings (${pct}%)`)
          .style("opacity", "1")
          .style("left", lx + "px")
          .style("top", (event.clientY - 40 - wRect.top) + "px");
      };
      g.selectAll(".bar")
        .data(data).enter().append("rect")
        .attr("x", (d) => xScale(d[xField]) ?? 0)
        .attr("y", (d) => yScale(Math.max(0, +d[yField])) ?? 0)
        .attr("rx", 2)
        .attr("width", xScale.bandwidth())
        .attr("height", (d) => Math.max(0, ih - (yScale(Math.max(0, +d[yField])) ?? ih)))
        .attr("fill", barFillBase)
        .attr("stroke", "none")
        .style("cursor", "default")
        .on("mouseover", function(event, d) { d3.select(this).attr("fill", barFillHover); showTipV(event, d); })
        .on("mousemove", showTipV)
        .on("mouseout", function() { d3.select(this).attr("fill", barFillBase); tip.style("opacity", "0"); });

      // X axis
      const xg = g.append("g")
        .attr("transform", `translate(0,${ih})`)
        .call(d3.axisBottom(xScale).tickSizeOuter(0).tickSize(0));
      xg.select(".domain").remove();
      xg.selectAll(".tick text").attr("fill", TICK_COLOR).style("font-size", "11px");

      // Y axis
      const yg = g.append("g").call(
        d3.axisLeft(yScale).ticks(4).tickSizeOuter(0).tickSize(0),
      );
      yg.select(".domain").remove();
      yg.selectAll(".tick text").attr("fill", TICK_COLOR).style("font-size", "11px");
    }
  }, [data, xField, yField, chartHeight, color, horizontal, width]);

  if (!data || data.length === 0) {
    return h("div", {
      style: {
        height: (height || 200) + "px", display: "flex", alignItems: "center",
        justifyContent: "center", color: "#aaa", fontSize: "11px",
      },
    }, "No data");
  }

  return h(
    "div",
    { ref: wrapperRef, style: { width: "100%", height: chartHeight + "px", position: "relative" } },
    h("div", { ref: renderRef, style: { position: "absolute", inset: 0 } }),
  );
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default BarChart;
