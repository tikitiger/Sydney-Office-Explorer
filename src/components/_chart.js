/**
 * _chart.js — shared primitives for D3 chart components.
 * @version 1.1.0
 *
 * Theme, layout, axes, grid, tooltips, legends, color scales, and overlays.
 * All rendering functions read theme values (CSS vars) internally — callers
 * don't pass colors or fonts. Functions are stateless: pass an SVG selection,
 * a scale, and minimal options.
 */
import { React, d3 } from "app/_data.js";
function numFormat(spec) {
    const f = d3.format(spec);
    return (d) => f(d);
}
function _css(prop) {
    return getComputedStyle(document.documentElement)
        .getPropertyValue(prop)
        .trim();
}
function _cssNum(prop) {
    return parseFloat(_css(prop));
}
export function colors() {
    return {
        text: _css("--color-text"),
        textMuted: _css("--color-text-muted"),
        grid: _css("--color-border-muted"),
        domain: _css("--color-border-muted"),
        bg: _css("--color-bg"),
    };
}
export function font() {
    return _css("--font-body");
}
export function vizPalette() {
    const p = [];
    for (let i = 1; i <= 14; i++)
        p.push(_css("--viz-" + i));
    return p;
}
export function useThemeRefresh() {
    const [, setTick] = React.useState(0);
    React.useEffect(function () {
        if (typeof window === "undefined")
            return;
        const mql = window.matchMedia("(prefers-color-scheme: dark)");
        function handler() {
            setTick(function (n) {
                return n + 1;
            });
        }
        if (mql.addEventListener) {
            mql.addEventListener("change", handler);
            return function () {
                mql.removeEventListener("change", handler);
            };
        }
        mql.addListener(handler);
        return function () {
            mql.removeListener(handler);
        };
    }, [setTick]);
}
export function useContainerWidth(ref) {
    const [width, setWidth] = React.useState(0);
    React.useEffect(function () {
        if (!ref.current)
            return;
        const ro = new ResizeObserver(function (entries) {
            const w = entries[0].contentRect.width;
            if (w > 0)
                setWidth(w);
        });
        ro.observe(ref.current);
        setWidth(ref.current.offsetWidth);
        return function () {
            ro.disconnect();
        };
    }, [ref, setWidth]);
    return width;
}
export function fmt(value, spec) {
    return d3.format(spec || ".3~s")(value);
}
export function truncate(text, max) {
    return text.length <= max ? text : text.slice(0, max - 1) + "…";
}
const EPOCH_S_MIN = 1e9;
const EPOCH_S_MAX = 1e11;
export function parseTemporal(val) {
    if (val instanceof Date)
        return val;
    if (typeof val === "number" && isFinite(val) && Math.abs(val) >= EPOCH_S_MIN)
        return new Date(Math.abs(val) >= EPOCH_S_MAX ? val : val * 1000);
    if (typeof val === "number")
        return new Date(val);
    const s = String(val).trim();
    if (/^\d{10,}$/.test(s)) {
        const n = Number(s);
        return new Date(n >= EPOCH_S_MAX ? n : n * 1000);
    }
    const dm = s.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
    if (dm)
        return new Date(+dm[1], +dm[2] - 1, dm[3] ? +dm[3] : 1);
    return new Date(s);
}
export function tickCount(scale, tickAxis) {
    const isBand = typeof scale.bandwidth === "function";
    if (isBand)
        return 5;
    const rangeArr = scale.range();
    const rangeLength = rangeArr.length >= 2
        ? Math.abs((rangeArr[rangeArr.length - 1] ?? 0) - (rangeArr[0] ?? 0))
        : 0;
    if (rangeLength === 0)
        return 5;
    const pixelsPerTick = tickAxis === "y" ? 50 : 100;
    return Math.max(2, Math.floor(rangeLength / pixelsPerTick));
}
export function axis(g, scale, opts) {
    const c = colors();
    const f = font();
    const orient = opts.orient;
    const isBand = typeof scale.bandwidth === "function";
    const ticks = tickCount(scale, orient === "bottom" || orient === "top" ? "x" : "y");
    const tickSize = _cssNum("--axis-tick-size");
    const tickPadding = _cssNum("--axis-tick-padding");
    const tickFontSize = _css("--axis-tick-font-size");
    const titleFontSize = _css("--axis-title-font-size");
    const titleGap = _cssNum("--axis-title-gap");
    let formatFn;
    if (opts.format) {
        formatFn =
            typeof opts.format === "function" ? opts.format : numFormat(opts.format);
    }
    else if (scale.domain && scale.domain()[0] instanceof Date) {
        formatFn = null;
    }
    else if (isBand) {
        formatFn = function (d) {
            return truncate(String(d), 14);
        };
    }
    else {
        formatFn = numFormat("~s");
    }
    const axisFn = orient === "bottom"
        ? d3.axisBottom
        : orient === "top"
            ? d3.axisTop
            : orient === "right"
                ? d3.axisRight
                : d3.axisLeft;
    const a = axisFn(scale)
        .ticks(ticks)
        .tickSizeInner(tickSize || 4)
        .tickSizeOuter(0)
        .tickPadding(tickPadding || 6);
    if (formatFn)
        a.tickFormat(formatFn);
    const axisG = g.append("g");
    if (orient === "bottom") {
        axisG.attr("transform", "translate(0," + (opts.innerHeight ?? 0) + ")");
    }
    else if (orient === "right") {
        axisG.attr("transform", "translate(" + (opts.innerWidth ?? 0) + ",0)");
    }
    axisG
        .call(a)
        .call(function (sel) {
        sel.select(".domain").attr("stroke", "none");
    })
        .call(function (sel) {
        sel.selectAll(".tick line").attr("stroke", c.grid);
    })
        .call(function (sel) {
        sel
            .selectAll("text")
            .style("fill", "#555555")
            .style("font-size", tickFontSize || "11px")
            .style("font-family", f);
    });
    if (opts.title) {
        const tickBox = axisG.node().getBBox();
        const titleEl = axisG
            .append("text")
            .attr("text-anchor", "middle")
            .style("font-size", titleFontSize || "11px")
            .style("font-weight", 500)
            .style("fill", opts.titleColor ?? c.text)
            .style("font-family", f)
            .text(opts.title);
        if (orient === "bottom") {
            const innerW = opts.innerWidth ?? 0;
            titleEl
                .attr("transform", `translate(${innerW / 2}, ${tickBox.y + tickBox.height + (titleGap || 8)})`)
                .attr("dominant-baseline", "hanging");
        }
        else if (orient === "top") {
            const innerW = opts.innerWidth ?? 0;
            titleEl
                .attr("transform", `translate(${innerW / 2}, ${tickBox.y - (titleGap || 8)})`)
                .attr("dominant-baseline", "text-after-edge");
        }
        else if (orient === "left") {
            const innerH = opts.innerHeight ?? 0;
            titleEl
                .attr("transform", `translate(${tickBox.x - (titleGap || 8)}, ${innerH / 2}) rotate(-90)`)
                .attr("dominant-baseline", "text-after-edge");
        }
        else {
            const innerH = opts.innerHeight ?? 0;
            titleEl
                .attr("transform", `translate(${tickBox.x + tickBox.width + (titleGap || 8)}, ${innerH / 2}) rotate(90)`)
                .attr("dominant-baseline", "text-after-edge");
        }
    }
}
export function measure(svg, render) {
    const g = svg.append("g").style("visibility", "hidden");
    render(g);
    const bbox = g.node().getBBox();
    g.remove();
    return { width: bbox.width, height: bbox.height, x: bbox.x, y: bbox.y };
}
export function measureAxis(svg, scale, opts) {
    const m = measure(svg, function (g) {
        axis(g, scale, opts);
    });
    return { width: m.width, height: m.height };
}
function setAxisRange(scale, orient, dim) {
    const isHorizontalAxis = orient === "top" || orient === "bottom";
    const isBandLike = typeof scale.bandwidth === "function";
    if (isHorizontalAxis || isBandLike)
        scale.range([0, dim]);
    else
        scale.range([dim, 0]);
}
export function layoutMargins(svg, opts) {
    const padTop = opts.pad?.top ?? 16;
    const padRight = opts.pad?.right ?? 16;
    const padBottom = opts.pad?.bottom ?? 16;
    const padLeft = opts.pad?.left ?? 16;
    const orients = ["top", "right", "bottom", "left"];
    const provInnerWidth = Math.max(0, opts.width - padLeft - padRight);
    const provInnerHeight = Math.max(0, opts.height - padTop - padBottom);
    orients.forEach(function (orient) {
        const spec = opts.axes[orient];
        if (!spec)
            return;
        const dim = orient === "top" || orient === "bottom"
            ? provInnerWidth
            : provInnerHeight;
        setAxisRange(spec.scale, orient, dim);
    });
    const extents = {};
    orients.forEach(function (orient) {
        const spec = opts.axes[orient];
        if (!spec)
            return;
        extents[orient] = measureAxis(svg, spec.scale, {
            ...spec.opts,
            orient,
            innerWidth: provInnerWidth,
            innerHeight: provInnerHeight,
        });
    });
    const margin = {
        top: extents.top?.height ?? padTop,
        right: extents.right?.width ?? padRight,
        bottom: extents.bottom?.height ?? padBottom,
        left: extents.left?.width ?? padLeft,
    };
    const innerWidth = Math.max(0, opts.width - margin.left - margin.right);
    const innerHeight = Math.max(0, opts.height - margin.top - margin.bottom);
    orients.forEach(function (orient) {
        const spec = opts.axes[orient];
        if (!spec)
            return;
        const dim = orient === "top" || orient === "bottom" ? innerWidth : innerHeight;
        setAxisRange(spec.scale, orient, dim);
    });
    return { margin, innerWidth, innerHeight };
}
export function grid(g, scale, opts) {
    const c = colors();
    const ticks = tickCount(scale, opts.direction === "horizontal" ? "y" : "x");
    const continuousScale = scale;
    const tickValues = typeof continuousScale.ticks === "function"
        ? continuousScale.ticks(ticks)
        : scale.domain();
    tickValues.forEach(function (tick) {
        if (opts.direction === "horizontal") {
            g.append("line")
                .attr("x1", 0)
                .attr("x2", opts.width || 0)
                .attr("y1", scale(tick) ?? 0)
                .attr("y2", scale(tick) ?? 0)
                .attr("stroke", c.grid);
        }
        else {
            g.append("line")
                .attr("x1", scale(tick) ?? 0)
                .attr("x2", scale(tick) ?? 0)
                .attr("y1", 0)
                .attr("y2", opts.height || 0)
                .attr("stroke", c.grid);
        }
    });
}
export function title(svg, text, opts) {
    if (!text)
        return;
    const o = opts || {};
    const c = colors();
    svg
        .append("text")
        .attr("x", o.x || 0)
        .attr("y", o.y || 16)
        .style("font-size", "13px")
        .style("font-weight", 500)
        .style("fill", c.textMuted)
        .style("font-family", font())
        .text(text);
}
export function legend(svg, keys, opts) {
    const o = opts || {};
    const c = colors();
    const f = font();
    const spacing = o.spacing || 18;
    const legendG = svg
        .append("g")
        .attr("transform", "translate(" + (o.x || 0) + "," + (o.y || 0) + ")");
    keys.forEach(function (key, i) {
        const palette = vizPalette();
        const color = o.getColor ? o.getColor(key) : palette[i % palette.length];
        const row = legendG
            .append("g")
            .attr("transform", "translate(0," + i * spacing + ")");
        row
            .append("rect")
            .attr("width", 10)
            .attr("height", 10)
            .attr("rx", 2)
            .attr("fill", color);
        row
            .append("text")
            .attr("x", 16)
            .attr("y", 9)
            .style("font-size", "11px")
            .style("fill", c.text)
            .style("font-family", f)
            .text(truncate(String(key), 14));
    });
    return legendG;
}
export function createTooltip(container) {
    const f = font();
    return d3
        .select(container)
        .append("div")
        .style("position", "absolute")
        .style("pointer-events", "none")
        .style("background", "#ffffff")
        .style("border", "1px solid rgba(0,0,0,0.12)")
        .style("border-radius", "6px")
        .style("padding", "7px 11px")
        .style("font-size", "11px")
        .style("font-family", f)
        .style("color", "#111111")
        .style("box-shadow", "0 4px 12px rgba(0,0,0,0.10)")
        .style("opacity", 0)
        .style("z-index", 100)
        .style("white-space", "nowrap");
}
export function positionTooltip(tooltip, event, container) {
    const rect = container.getBoundingClientRect();
    const node = tooltip.node();
    const tw = node ? node.offsetWidth : 120;
    const th = node ? node.offsetHeight : 60;
    let vpLeft = event.clientX + 12;
    let vpTop = event.clientY + 12;
    // Flip within container bounds to avoid clipping by parent overflow
    if (vpLeft + tw > rect.right - 4)
        vpLeft = event.clientX - tw - 12;
    if (vpTop + th > rect.bottom - 4)
        vpTop = event.clientY - th - 12;
    if (vpLeft < rect.left + 4)
        vpLeft = rect.left + 4;
    if (vpTop < rect.top + 4)
        vpTop = rect.top + 4;
    tooltip
        .style("left", vpLeft - rect.left + "px")
        .style("top", vpTop - rect.top + "px");
}
export function buildTooltipHtml(rows) {
    return rows
        .map(function (r) {
        if (r.header != null)
            return ('<div style="font-weight:600;margin-bottom:2px">' +
                escapeHtml(r.header) +
                "</div>");
        const dot = r.color
            ? '<span style="color:' + escapeHtml(r.color) + '">●</span> '
            : "";
        if (r.label == null) {
            return "<div>" + dot + escapeHtml(r.value) + "</div>";
        }
        return ("<div>" +
            "<strong>" +
            escapeHtml(r.label) +
            ":</strong> " +
            dot +
            escapeHtml(r.value) +
            "</div>");
    })
        .join("");
}
export function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
export function crosshair(g, container, opts) {
    const o = opts || {};
    const c = colors();
    const groups = o.groups || [];
    const xScale = o.xScale;
    const yScale = o.yScale;
    const innerWidth = o.innerWidth || 0;
    const innerHeight = o.innerHeight || 0;
    const getColor = o.getColor ||
        function () {
            return vizPalette()[0];
        };
    const hasInvert = typeof xScale.invert === "function";
    const isTime = xScale.domain && xScale.domain()[0] instanceof Date;
    const fmtX = o.formatX ||
        (isTime
            ? d3.timeFormat("%b %Y")
            : hasInvert
                ? d3.format("~s")
                : String);
    const fmtY = o.formatY || d3.format(",.0f");
    const tip = createTooltip(container);
    const guideLine = g
        .append("line")
        .attr("y1", 0)
        .attr("y2", innerHeight)
        .attr("stroke", c.grid)
        .attr("stroke-width", 1)
        .style("opacity", 0);
    const dotsG = g.append("g");
    const bisect = hasInvert
        ? d3.bisector(function (d) {
            return d["__x"];
        }).left
        : null;
    function findNearestOrdinal(values, mx) {
        let best = null;
        let bestDist = Infinity;
        for (let i = 0; i < values.length; i++) {
            const px = xScale(values[i]["__x"]);
            const dist = Math.abs(px - mx);
            if (dist < bestDist) {
                bestDist = dist;
                best = values[i];
            }
        }
        return best;
    }
    g.append("rect")
        .attr("width", innerWidth)
        .attr("height", innerHeight)
        .attr("fill", "transparent")
        .style("cursor", "crosshair")
        .on("mousemove", function (event) {
        const mx = d3.pointer(event)[0];
        let snappedX = null;
        let nearestDist = Infinity;
        groups.forEach(function (series) {
            let d;
            if (hasInvert) {
                const xVal = xScale.invert(mx);
                const idx = bisect(series.values, xVal, 1);
                const d0 = series.values[idx - 1];
                const d1 = series.values[idx];
                if (!d0 && !d1)
                    return;
                d = !d0
                    ? d1
                    : !d1
                        ? d0
                        : xVal - d0["__x"] >
                            d1["__x"] - xVal
                            ? d1
                            : d0;
            }
            else {
                d = findNearestOrdinal(series.values, mx);
                if (!d)
                    return;
            }
            const dist = Math.abs(xScale(d["__x"]) - mx);
            if (dist < nearestDist) {
                nearestDist = dist;
                snappedX = d["__x"];
            }
        });
        if (snappedX == null)
            return;
        const snappedPx = xScale(snappedX);
        guideLine.attr("x1", snappedPx).attr("x2", snappedPx).style("opacity", 1);
        dotsG.selectAll("*").remove();
        let html = "";
        groups.forEach(function (series) {
            let d;
            if (hasInvert) {
                const idx = bisect(series.values, snappedX, 1);
                const d0 = series.values[idx - 1];
                const d1 = series.values[idx];
                if (!d0 && !d1)
                    return;
                d = !d0
                    ? d1
                    : !d1
                        ? d0
                        : Math.abs(snappedX - d0["__x"]) <=
                            Math.abs(d1["__x"] - snappedX)
                            ? d0
                            : d1;
            }
            else {
                d = null;
                for (let i = 0; i < series.values.length; i++) {
                    if (series.values[i]["__x"] === snappedX) {
                        d = series.values[i];
                        break;
                    }
                }
                if (!d)
                    return;
            }
            const col = getColor(series.key);
            dotsG
                .append("circle")
                .attr("cx", xScale(d["__x"]) ?? 0)
                .attr("cy", yScale(d["__yPos"] != null
                ? d["__yPos"]
                : d["__y"]) ?? 0)
                .attr("r", 4)
                .attr("fill", col)
                .attr("stroke", c.bg)
                .attr("stroke-width", 2);
            const label = groups.length === 1
                ? ""
                : '<span style="color:' +
                    escapeHtml(col) +
                    '">●</span> ' +
                    escapeHtml(series.key) +
                    ": ";
            html += '<div style="color:#555555">' + label + escapeHtml(fmtY(d["__y"])) + "</div>";
        });
        html =
            '<div style="font-weight:600;margin-bottom:3px;color:#111111">' +
                escapeHtml(fmtX(snappedX)) +
                "</div>" +
                html;
        tip.html(html).style("opacity", 1);
        positionTooltip(tip, event, container);
    })
        .on("mouseout", function () {
        guideLine.style("opacity", 0);
        dotsG.selectAll("*").remove();
        tip.style("opacity", 0);
    });
}
export function getCurve(name) {
    if (name === "step")
        return d3.curveStep;
    if (name === "linear")
        return d3.curveLinear;
    return d3.curveMonotoneX;
}
export function colorScale(domain, range) {
    return d3
        .scaleOrdinal()
        .domain(domain)
        .range(range || vizPalette());
}
export function sequentialScale(domain, ramp) {
    return d3.scaleSequential(ramp || d3.interpolateBlues).domain(domain);
}
export function divergingScale(domain, ramp) {
    return d3.scaleDiverging(ramp || d3.interpolateRdBu).domain(domain);
}
export function refLines(g, scales, lines, opts) {
    if (!lines || lines.length === 0)
        return;
    const o = opts || {};
    const c = colors();
    const f = font();
    lines.forEach(function (line) {
        const isX = line.axis === "x";
        const pos = (isX ? scales.x : scales.y)(line.value);
        const dash = line.style === "solid" ? "none" : "4 3";
        const stroke = line.color || c.textMuted;
        const el = isX
            ? g
                .append("line")
                .attr("x1", pos)
                .attr("x2", pos)
                .attr("y1", 0)
                .attr("y2", o.innerHeight || 0)
            : g
                .append("line")
                .attr("x1", 0)
                .attr("x2", o.innerWidth || 0)
                .attr("y1", pos)
                .attr("y2", pos);
        el.attr("stroke", stroke)
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", dash);
        if (line.label) {
            g.append("text")
                .attr("x", isX ? pos + 4 : (o.innerWidth || 0) + 4)
                .attr("y", isX ? 12 : pos - 4)
                .style("font-size", "10px")
                .style("fill", stroke)
                .style("font-family", f)
                .text(line.label);
        }
    });
}
export function annotations(g, scales, notes) {
    if (!notes || notes.length === 0)
        return;
    const c = colors();
    const f = font();
    notes.forEach(function (note) {
        const px = scales.x(note.x);
        const py = scales.y(note.y);
        const anchor = note.anchor || "top";
        const color = note.color || c.text;
        g.append("circle")
            .attr("cx", px)
            .attr("cy", py)
            .attr("r", 3)
            .attr("fill", color);
        let dx = 0;
        let dy = 0;
        let textAnchor = "start";
        if (anchor === "top") {
            dy = -8;
            textAnchor = "middle";
        }
        else if (anchor === "bottom") {
            dy = 16;
            textAnchor = "middle";
        }
        else if (anchor === "left") {
            dx = -8;
            textAnchor = "end";
        }
        else if (anchor === "right") {
            dx = 8;
        }
        g.append("text")
            .attr("x", px + dx)
            .attr("y", py + dy)
            .attr("text-anchor", textAnchor)
            .style("font-size", "11px")
            .style("fill", color)
            .style("font-family", f)
            .text(note.label);
    });
}
