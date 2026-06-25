/**
 * Button — styled button component matching HexButton design.
 * @version 1.0.0
 */
import { React } from "app/_data.js";
import { useThemeRefresh } from "app/components/_chart.js";
const h = React.createElement;
function _css(prop) {
    return getComputedStyle(document.documentElement)
        .getPropertyValue(prop)
        .trim();
}
function colorToRgba(color, alpha) {
    if (color.indexOf("rgb") === 0) {
        const start = color.indexOf("(") + 1;
        const end = color.indexOf(")");
        const parts = color.substring(start, end).split(",");
        return ("rgba(" +
            parts[0].trim() +
            "," +
            parts[1].trim() +
            "," +
            parts[2].trim() +
            "," +
            alpha +
            ")");
    }
    let hex = color.charAt(0) === "#" ? color.substring(1) : color;
    if (hex.length === 3)
        hex =
            hex.charAt(0) +
                hex.charAt(0) +
                hex.charAt(1) +
                hex.charAt(1) +
                hex.charAt(2) +
                hex.charAt(2);
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
}
const INTENT_COLOR_VAR = {
    primary: "--color-accent",
    success: "--color-success",
    danger: "--color-danger",
    warning: "--color-warning",
};
function getIntentColors(intent) {
    if (!intent || intent === "default") {
        return {
            color: _css("--color-text"),
            bg: _css("--color-bg"),
            border: _css("--color-border"),
            hoverBg: _css("--color-bg-muted"),
            activeBg: _css("--color-border-muted"),
            activeBorder: _css("--color-border"),
        };
    }
    const v = INTENT_COLOR_VAR[intent];
    if (!v)
        return getIntentColors("default");
    const c = _css(v);
    return {
        color: c,
        bg: colorToRgba(c, 0.07),
        border: colorToRgba(c, 0.2),
        hoverBg: colorToRgba(c, 0.12),
        activeBg: colorToRgba(c, 0.2),
        activeBorder: colorToRgba(c, 0.3),
    };
}
const baseStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    minWidth: 28,
    minHeight: 28,
    padding: "5px 9px",
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-base)",
    lineHeight: 1,
    borderRadius: "var(--radius)",
    border: "none",
    cursor: "pointer",
    outline: "none",
    backgroundImage: "none",
    textDecoration: "none",
    userSelect: "none",
    transition: "color 150ms ease, background-color 150ms ease, box-shadow 150ms ease",
};
export function Button(props) {
    const intent = props.intent || "default";
    const disabled = props.disabled || false;
    const onClick = props.onClick;
    const children = props.children;
    const style = props.style;
    const type = props.type || "button";
    useThemeRefresh();
    const [hovered, setHovered] = React.useState(false);
    const [pressed, setPressed] = React.useState(false);
    const ic = getIntentColors(intent);
    const bg = pressed ? ic.activeBg : hovered ? ic.hoverBg : ic.bg;
    const border = pressed ? ic.activeBorder : ic.border;
    const computedStyle = Object.assign({}, baseStyle, {
        color: ic.color,
        backgroundColor: bg,
        boxShadow: "inset 0 0 0 1px " + border,
        ...(disabled ? { opacity: 0.5, cursor: "not-allowed" } : null),
        ...style,
    });
    return h("button", {
        type,
        disabled,
        style: computedStyle,
        onClick: disabled ? undefined : onClick,
        onMouseEnter: function () {
            if (!disabled)
                setHovered(true);
        },
        onMouseLeave: function () {
            if (!disabled) {
                setHovered(false);
                setPressed(false);
            }
        },
        onMouseDown: function () {
            if (!disabled)
                setPressed(true);
        },
        onMouseUp: function () {
            if (!disabled)
                setPressed(false);
        },
    }, children);
}
export default Button;
