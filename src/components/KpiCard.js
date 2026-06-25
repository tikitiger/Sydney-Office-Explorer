/**
 * KpiCard — versatile KPI display component for dashboards and data apps.
 * @version 1.0.0
 */
import { React } from "app/_data.js";
const h = React.createElement;
const INTENT_COLORS = {
    success: {
        color: "var(--color-success)",
        bg: "var(--intent-success-bg)",
        bgInverted: "var(--color-success)",
    },
    danger: {
        color: "var(--color-danger)",
        bg: "var(--intent-danger-bg)",
        bgInverted: "var(--color-danger)",
    },
    warning: {
        color: "var(--color-warning)",
        bg: "var(--intent-warning-bg)",
        bgInverted: "var(--color-warning)",
    },
};
const DELTA_PILL_COLORS = {
    up: { bg: "var(--intent-success-bg)", text: "var(--color-success-text)" },
    down: { bg: "var(--intent-danger-bg)", text: "var(--color-danger-text)" },
    neutral: { bg: "var(--intent-neutral-bg)", text: "var(--color-text-muted)" },
};
const BAR_GAUGE_COLORS = {
    success: {
        fill: "var(--color-success-fill)",
        border: "var(--color-success-border)",
    },
    warning: {
        fill: "var(--color-warning-fill)",
        border: "var(--color-warning-border)",
    },
    danger: {
        fill: "var(--color-danger-fill)",
        border: "var(--color-danger-border)",
    },
    default: {
        fill: "var(--color-border-muted)",
        border: "var(--color-border)",
    },
};
function resolveStyles(intent, intentStyle) {
    if (intent === undefined)
        intent = "default";
    if (intentStyle === undefined)
        intentStyle = "subtle";
    const base = {
        bg: "var(--color-bg)",
        text: "var(--color-text)",
        secondaryText: "var(--color-text-muted)",
        deltaUp: "var(--color-success)",
        deltaDown: "var(--color-danger)",
        deltaNeutral: "var(--color-text-muted)",
        sparkline: "var(--viz-1)",
        progressFill: "var(--viz-1)",
        borderStroke: "var(--color-border)",
    };
    if (intent === "default")
        return base;
    const c = INTENT_COLORS[intent];
    if (!c)
        return base;
    if (intentStyle === "subtle") {
        return Object.assign({}, base, {
            bg: c.bg,
            deltaUp: c.color,
            deltaDown: c.color,
            sparkline: c.color,
            progressFill: c.color,
            borderStroke: "var(--intent-subtle-border)",
        });
    }
    if (intentStyle === "inverted") {
        return Object.assign({}, base, {
            bg: c.bgInverted,
            text: "var(--color-text-inverted)",
            secondaryText: "rgba(255,255,255,0.8)",
            deltaUp: "var(--color-text-inverted)",
            deltaDown: "var(--color-text-inverted)",
            deltaNeutral: "rgba(255,255,255,0.7)",
            sparkline: "rgba(255,255,255,0.85)",
            progressFill: "rgba(255,255,255,0.5)",
            borderStroke: "var(--color-border-inverted)",
        });
    }
    if (intentStyle === "text") {
        return Object.assign({}, base, {
            text: c.color,
            deltaUp: c.color,
            deltaDown: c.color,
            sparkline: c.color,
        });
    }
    return base;
}
function resolveCardBorderStroke(styles, border, intentStyle) {
    if (border !== "strong")
        return styles.borderStroke;
    if (intentStyle === "inverted")
        return styles.borderStroke;
    return "var(--color-border)";
}
function renderDelta(delta, styles, deltaStyle) {
    if (!delta)
        return null;
    const arrows = { up: "↑", down: "↓", neutral: "" };
    const colorKey = {
        up: "deltaUp",
        down: "deltaDown",
        neutral: "deltaNeutral",
    };
    const arrow = arrows[delta.direction] || "";
    const color = styles[colorKey[delta.direction] || "deltaNeutral"];
    if (deltaStyle === "pill") {
        const pill = DELTA_PILL_COLORS[delta.direction] || DELTA_PILL_COLORS["neutral"];
        return h("span", {
            style: {
                fontSize: "var(--text-xs)",
                fontWeight: "var(--font-weight-semibold)",
                color: pill.text,
                background: pill.bg,
                padding: "var(--space-1) var(--space-2)",
                borderRadius: "var(--radius)",
                display: "inline-flex",
                alignItems: "center",
                gap: "2px",
            },
        }, arrow, " ", delta.value);
    }
    return h("span", {
        style: {
            fontSize: "var(--text-sm)",
            fontWeight: "var(--font-weight-semibold)",
            color: color,
            display: "inline-flex",
            alignItems: "center",
            gap: "2px",
        },
    }, arrow, " ", delta.value);
}
function renderProgress(progress, position, styles) {
    if (progress == null)
        return null;
    const pct = Math.max(0, Math.min(1, progress)) * 100;
    if (position === "left")
        return null;
    return h("div", {
        style: {
            width: "100%",
            height: "4px",
            borderRadius: "var(--radius)",
            background: styles.borderStroke,
            marginTop: "var(--space-2)",
            overflow: "hidden",
        },
    }, h("div", {
        style: {
            width: pct + "%",
            height: "100%",
            borderRadius: "var(--radius-pill)",
            background: styles.progressFill,
            transition: "width 0.3s ease",
        },
    }));
}
function renderLeftProgress(progress, styles) {
    if (progress == null)
        return null;
    const pct = Math.max(0, Math.min(1, progress)) * 100;
    return h("div", {
        style: {
            width: "4px",
            alignSelf: "stretch",
            borderRadius: "var(--radius-pill)",
            background: styles.borderStroke,
            overflow: "hidden",
            flexShrink: 0,
        },
    }, h("div", {
        style: {
            width: "100%",
            height: pct + "%",
            borderRadius: "var(--radius-pill)",
            background: styles.progressFill,
            transition: "height 0.3s ease",
        },
    }));
}
function renderBarGauge(opts) {
    const label = opts.label;
    const value = opts.value;
    const intent = opts.intent;
    const planProgress = opts.planProgress || 0;
    const planLabel = opts.planLabel;
    const planComparison = opts.planComparison;
    const growthLabel = opts.growthLabel;
    const intentKey = intent === "default" ? "default" : intent || "default";
    const gauge = BAR_GAUGE_COLORS[intentKey] || BAR_GAUGE_COLORS["default"];
    const fillVar = gauge.fill;
    const borderVar = gauge.border;
    const clampedFill = Math.min(planProgress, 1) * 100;
    const targetPos = planProgress > 1 ? (1 / planProgress) * 100 : 100;
    const headerRow = h("div", {
        style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "var(--space-2)",
        },
    }, h("div", {
        style: {
            fontSize: "var(--text-xl)",
            fontWeight: "var(--font-weight-bold)",
            color: "var(--color-text)",
            lineHeight: 1.2,
        },
    }, label), planLabel || planComparison
        ? h("div", {
            style: {
                textAlign: "right",
                flexShrink: 0,
                marginLeft: "var(--space-3)",
            },
        }, planLabel
            ? h("div", {
                style: {
                    fontSize: "var(--text-xs)",
                    fontWeight: "var(--font-weight-semibold)",
                    color: "var(--color-text-muted)",
                },
            }, planLabel)
            : null, planComparison
            ? h("div", {
                style: {
                    fontSize: "var(--text-xs)",
                    color: "var(--color-text-muted)",
                },
            }, planComparison)
            : null)
        : null);
    const bar = h("div", {
        style: {
            position: "relative",
            width: "100%",
            height: "32px",
            borderRadius: "var(--radius)",
            background: "var(--color-bg)",
            overflow: "hidden",
        },
    }, h("div", {
        style: {
            position: "absolute",
            top: 0,
            left: 0,
            width: clampedFill + "%",
            height: "100%",
            background: fillVar,
            borderRadius: "var(--radius)",
            transition: "width 0.3s ease",
        },
    }), h("div", {
        style: {
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            display: "flex",
            alignItems: "center",
            paddingLeft: "var(--space-3)",
            fontSize: "var(--text-sm)",
            fontWeight: "var(--font-weight-bold)",
            color: "var(--color-text)",
            zIndex: 1,
        },
    }, value), h("div", {
        style: {
            position: "absolute",
            top: 0,
            left: targetPos + "%",
            width: 0,
            height: "100%",
            borderRight: "1.5px dashed " + borderVar,
            zIndex: 2,
            transform: targetPos >= 100 ? "translateX(-1.5px)" : undefined,
        },
    }));
    const footer = growthLabel
        ? h("div", {
            style: {
                fontSize: "var(--text-xs)",
                color: "var(--color-text-muted)",
                marginTop: "var(--space-1)",
            },
        }, growthLabel)
        : null;
    return h("div", {
        style: {
            background: "var(--color-bg)",
            borderRadius: "var(--radius)",
            padding: "var(--space-4)",
            border: "1px solid var(--color-border)",
        },
    }, headerRow, bar, footer);
}
export function KpiCard(props) {
    const label = props.label;
    const value = props.value;
    const labelPosition = props.labelPosition || "below";
    const layout = props.layout || "default";
    const delta = props.delta;
    const deltaStyle = props.deltaStyle || "plain";
    const comparison = props.comparison;
    const compareValue = props.compareValue;
    const progress = props.progress;
    const progressPosition = props.progressPosition || "bottom";
    const intent = props.intent || "default";
    const intentStyle = props.intentStyle || "subtle";
    const border = props.border || "default";
    if (layout === "bar-gauge") {
        return renderBarGauge({
            label,
            value,
            intent,
            planProgress: props.planProgress,
            planLabel: props.planLabel,
            planComparison: props.planComparison,
            growthLabel: props.growthLabel,
        });
    }
    const styles = resolveStyles(intent, intentStyle);
    const cardBorderStroke = resolveCardBorderStroke(styles, border, intentStyle);
    const labelEl = label
        ? h("div", {
            style: {
                fontSize: "var(--text-sm)",
                fontWeight: "var(--font-weight-medium)",
                color: styles.secondaryText,
            },
        }, label)
        : null;
    const valueEl = h("div", {
        style: {
            fontSize: "var(--text-2xl)",
            fontWeight: "var(--font-weight-bold)",
            color: styles.text,
            lineHeight: 1.2,
        },
    }, value);
    const deltaEl = renderDelta(delta, styles, deltaStyle);
    const comparisonEl = comparison
        ? h("span", {
            style: {
                fontSize: "var(--text-xs)",
                color: styles.secondaryText,
                marginLeft: "var(--space-1)",
            },
        }, comparison)
        : null;
    const compareValueEl = compareValue
        ? h("div", {
            style: {
                fontSize: "var(--text-xs)",
                color: styles.secondaryText,
                marginTop: "var(--space-1)",
            },
        }, compareValue)
        : null;
    const deltaRow = deltaEl || comparisonEl
        ? h("div", {
            style: {
                display: "flex",
                alignItems: "center",
                gap: "var(--space-1)",
                marginTop: "var(--space-1)",
                flexWrap: "wrap",
            },
        }, deltaEl, comparisonEl)
        : null;
    const progressEl = progress != null && progressPosition === "bottom"
        ? renderProgress(progress, "bottom", styles)
        : null;
    const content = h("div", { style: { flex: 1, minWidth: 0 } }, labelPosition === "above" ? labelEl : null, h(React.Fragment, null, valueEl, labelPosition === "below" ? labelEl : null), deltaRow, compareValueEl, progressEl);
    const showLeftProgress = progress != null && progressPosition === "left";
    return h("div", {
        style: {
            background: styles.bg,
            border: "1px solid " + cardBorderStroke,
            borderRadius: "var(--radius)",
            padding: "var(--space-4)",
            display: "flex",
            gap: showLeftProgress ? "var(--space-3)" : undefined,
        },
    }, showLeftProgress ? renderLeftProgress(progress, styles) : null, content);
}
export default KpiCard;
