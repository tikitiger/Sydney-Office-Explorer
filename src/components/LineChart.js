/**
 * LineChart — line chart component powered by D3.js.
 * @version 1.1.0
 *
 * Props:
 *   data          - array of row objects (required)
 *   xField        - field name for x-axis
 *   yField        - field name for y-axis (numeric)
 *   xType         - "temporal" | "quantitative" | "ordinal" (default: "temporal").
 *                   Temporal x values may be Date objects, ISO strings, or
 *                   epoch seconds/milliseconds (numbers or numeric strings).
 *   colorField    - optional field for multi-series (one line per group)
 *   colorScale    - optional { domain: string[], range: string[] }
 *   area          - boolean, fill under line with 0.3 opacity (default: false)
 *   title         - chart title string (optional)
 *   xTitle        - x-axis title (optional)
 *   yTitle        - y-axis title (optional)
 *   height        - pixel height (default: 300)
 *   tooltipFields - optional array of { field, title, format }
 *   interpolate   - "linear" | "monotone" | "step" (default: "monotone")
 *   zeroBaseline  - boolean, force y-axis to include zero (default: false)
 *   strokeWidth   - line stroke width (default: 2)
 *
 * Usage:
 *   import { LineChart } from "app/components/LineChart.js";
 *   React.createElement(LineChart, {
 *     data: rows,
 *     xField: "date",
 *     yField: "revenue",
 *     colorField: "channel",
 *     title: "Revenue over time",
 *   })
 */
import { React, d3 } from "app/_data.js";
import { axis, title as chartTitle, crosshair, font, getCurve, grid, layoutMargins, legend, parseTemporal, useContainerWidth, useThemeRefresh, vizPalette, } from "app/components/_chart.js";
const h = React.createElement;
export function LineChart(props) {
    const data = props.data;
    const xField = props.xField;
    const yField = props.yField;
    const xType = props.xType || "temporal";
    const colorField = props.colorField;
    const colorScaleSpec = props.colorScale;
    const area = props.area || false;
    const seriesColor = props.color || null;
    const title = props.title;
    const xTitle = props.xTitle;
    const yTitle = props.yTitle;
    const chartHeight = props.height || 300;
    const interpolate = props.interpolate || "monotone";
    const zeroBaseline = props.zeroBaseline || false;
    const strokeWidth = props.strokeWidth || 2;
    const yFormat = props.yFormat || null;
    const hideLegend = props.hideLegend || false;
    useThemeRefresh();
    const f = font();
    const palette = vizPalette();
    const wrapperRef = React.useRef(null);
    const renderRef = React.useRef(null);
    const containerWidth = useContainerWidth(wrapperRef);
    React.useEffect(
    function () {
        if (!renderRef.current ||
            !data ||
            data.length === 0 ||
            containerWidth === 0)
            return;
        const container = renderRef.current;
        d3.select(container).selectAll("*").remove();
        const hasColor = !!colorField;
        const showLegend = hasColor && !hideLegend;
        const legendWidth = showLegend ? 110 : 0;
        const legendGap = showLegend ? 24 : 0;
        const width = containerWidth || 600;
        const isOrdinal = xType === "ordinal";
        const parseX = function (val) {
            if (xType === "temporal")
                return parseTemporal(val);
            if (isOrdinal)
                return String(val);
            return +String(val);
        };
        const parsedData = data.map(function (d) {
            const copy = Object.assign({}, d);
            copy.__x = parseX(d[xField]);
            copy.__y = +d[yField];
            return copy;
        });
        let sortByX;
        if (isOrdinal) {
            const domainOrder = {};
            parsedData.forEach(function (d) {
                if (domainOrder[d.__x] == null)
                    domainOrder[d.__x] = Object.keys(domainOrder).length;
            });
            sortByX = function (a, b) {
                return (domainOrder[a.__x] || 0) - (domainOrder[b.__x] || 0);
            };
        }
        else {
            sortByX = function (a, b) {
                return a.__x - b.__x;
            };
        }
        let groups;
        let seriesKeys;
        if (hasColor) {
            seriesKeys =
                colorScaleSpec && colorScaleSpec.domain
                    ? colorScaleSpec.domain
                    : Array.from(new Set(parsedData.map(function (d) {
                        return d[colorField];
                    })));
            groups = seriesKeys.map(function (key) {
                return {
                    key: key,
                    values: parsedData
                        .filter(function (d) {
                        return d[colorField] === key;
                    })
                        .sort(sortByX),
                };
            });
        }
        else {
            seriesKeys = ["__single__"];
            groups = [
                { key: "__single__", values: parsedData.slice().sort(sortByX) },
            ];
        }
        let xScale;
        if (xType === "temporal") {
            xScale = d3.scaleTime().domain(d3.extent(parsedData, function (d) {
                return d.__x;
            }));
        }
        else if (isOrdinal) {
            const xDomain = [];
            const xSeen = {};
            parsedData.forEach(function (d) {
                if (!xSeen[d.__x]) {
                    xSeen[d.__x] = true;
                    xDomain.push(d.__x);
                }
            });
            xScale = d3.scalePoint().domain(xDomain).padding(0.5);
        }
        else {
            xScale = d3
                .scaleLinear()
                .domain(d3.extent(parsedData, function (d) {
                return d.__x;
            }))
                .nice();
        }
        const yExtent = d3.extent(parsedData, function (d) {
            return d.__y;
        });
        let yMin = yExtent[0] ?? 0;
        const yMax = yExtent[1] ?? 0;
        if (zeroBaseline) {
            yMin = Math.min(0, yMin);
        }
        const yScale = d3.scaleLinear().domain([yMin, yMax]).nice();
        const colorDom = seriesKeys;
        const colorRng = colorScaleSpec && colorScaleSpec.range ? colorScaleSpec.range : palette;
        const ordinalColor = d3
            .scaleOrdinal()
            .domain(colorDom)
            .range(colorRng);
        const getColor = function (key) {
            if (key === "__single__") return seriesColor || (palette[0] ?? "");
            return ordinalColor(key);
        };
        const svg = d3
            .select(container)
            .append("svg")
            .attr("viewBox", "0 0 " + width + " " + chartHeight)
            .attr("width", "100%")
            .style("font-family", f)
            .style("overflow", "visible");
        chartTitle(svg, title);
        const xAxisOpts = { title: xTitle };
        const yAxisOpts = { title: yTitle };
        const { innerHeight, innerWidth, margin } = layoutMargins(svg, {
            width,
            height: chartHeight,
            axes: {
                bottom: { scale: xScale, opts: xAxisOpts },
                left: { scale: yScale, opts: yAxisOpts },
            },
            pad: {
                top: title ? 32 : 12,
                right: showLegend ? legendWidth + legendGap : 24,
            },
        });
        const g = svg
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
        grid(g, yScale, { direction: "horizontal", width: innerWidth });
        axis(g, xScale, {
            orient: "bottom",
            innerHeight,
            innerWidth,
            title: xTitle,
        });
        axis(g, yScale, { orient: "left", innerHeight, title: yTitle });
        const curve = getCurve(interpolate);
        const lineGen = d3
            .line()
            .x(function (d) {
            return xScale(d.__x) ?? 0;
        })
            .y(function (d) {
            return yScale(d.__y) ?? 0;
        })
            .curve(curve);
        const areaGen = d3
            .area()
            .x(function (d) {
            return xScale(d.__x) ?? 0;
        })
            .y0(yScale(zeroBaseline ? 0 : yMin) ?? 0)
            .y1(function (d) {
            return yScale(d.__y) ?? 0;
        })
            .curve(curve);
        groups.forEach(function (series, si) {
            const col = getColor(series.key);
            if (area) {
                const gradId = "lg-" + si + "-" + col.replace("#", "");
                const defs = g.append("defs");
                const grad = defs.append("linearGradient")
                    .attr("id", gradId)
                    .attr("x1", "0").attr("y1", "0")
                    .attr("x2", "0").attr("y2", "1");
                grad.append("stop").attr("offset", "0%")
                    .attr("stop-color", col).attr("stop-opacity", 0.30);
                grad.append("stop").attr("offset", "100%")
                    .attr("stop-color", col).attr("stop-opacity", 0);
                g.append("path")
                    .datum(series.values)
                    .attr("d", areaGen)
                    .attr("fill", "url(#" + gradId + ")")
                    .attr("stroke", "none");
            }
            g.append("path")
                .datum(series.values)
                .attr("d", lineGen)
                .attr("fill", "none")
                .attr("stroke", col)
                .attr("stroke-width", strokeWidth);
        });
        crosshair(g, container, {
            groups: groups,
            xScale: xScale,
            yScale: yScale,
            innerWidth: innerWidth,
            innerHeight: innerHeight,
            getColor: getColor,
            formatY: yFormat || undefined,
        });
        if (showLegend) {
            legend(svg, seriesKeys, {
                x: width - legendWidth - 8,
                y: margin.top + 4,
                getColor: function (k) {
                    return ordinalColor(k);
                },
            });
        }
        // Last-point callouts — circle for all series, value label for single series only
        groups.forEach(function (series) {
            if (series.values.length === 0) return;
            const col = getColor(series.key);
            const last = series.values[series.values.length - 1];
            const cx = xScale(last.__x) ?? 0;
            const cy = yScale(last.__y) ?? 0;
            g.append("circle")
                .attr("cx", cx).attr("cy", cy).attr("r", 3.5)
                .attr("fill", col)
                .attr("stroke", "#ffffff").attr("stroke-width", 1.5);
            if (!hasColor && yFormat) {
                const label = yFormat(last.__y);
                const lx = Math.min(cx + 5, innerWidth - label.length * 6 - 2);
                const ly = cy - 5;
                g.append("text")
                    .attr("x", lx).attr("y", ly)
                    .attr("fill", col)
                    .style("font-size", "10px").style("font-weight", "600")
                    .style("font-family", f)
                    .text(label);
            }
        });
    }, [
        area,
        chartHeight,
        colorField,
        colorScaleSpec,
        containerWidth,
        data,
        f,
        hideLegend,
        interpolate,
        palette,
        seriesColor,
        strokeWidth,
        yFormat,
        title,
        xField,
        xTitle,
        xType,
        yField,
        yTitle,
        zeroBaseline,
    ]);
    if (!data || data.length === 0) {
        return h("div", {
            style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: chartHeight + "px",
                color: "var(--color-text-muted)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-base)",
            },
        }, "No data available");
    }
    return h("div", {
        ref: wrapperRef,
        style: { width: "100%", minHeight: chartHeight, position: "relative" },
    }, h("div", {
        ref: renderRef,
        style: {
            position: "absolute",
            top: 0,
            left: 0,
            width: containerWidth || "100%",
            height: chartHeight,
        },
    }));
}
export default LineChart;
