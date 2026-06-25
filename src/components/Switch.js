/**
 * Switch — toggle switch component wrapping Base UI Switch.
 * @version 1.0.0
 */
import { BaseSwitch, React } from "app/_data.js";
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
const TRACK_W = 26;
const TRACK_H = 14;
const THUMB_SIZE = 14;
export function Switch(props) {
    const checked = props.checked;
    const defaultChecked = props.defaultChecked;
    const onCheckedChange = props.onCheckedChange;
    const label = props.label;
    const disabled = props.disabled || false;
    const name = props.name;
    const required = props.required || false;
    const style = props.style;
    useThemeRefresh();
    const [hovered, setHovered] = React.useState(false);
    const [internalChecked, setInternalChecked] = React.useState(defaultChecked || false);
    const isChecked = checked != null ? checked : internalChecked;
    const accent = _css("--color-accent");
    const bg = _css("--color-bg");
    const borderColor = _css("--color-border");
    let trackBg;
    let trackShadow;
    if (isChecked) {
        trackBg =
            hovered && !disabled
                ? colorToRgba(accent, 0.3)
                : colorToRgba(accent, 0.2);
        trackShadow = "inset 0 0 0 1px " + accent;
    }
    else {
        trackBg = hovered && !disabled ? colorToRgba(accent, 0.1) : "transparent";
        trackShadow = "inset 0 0 0 1px " + borderColor;
    }
    const thumbBg = bg;
    const thumbShadow = isChecked
        ? "inset 0 0 0 1px " + accent
        : "inset 0 0 0 1px " + borderColor;
    const thumbLeft = isChecked ? TRACK_W - THUMB_SIZE : 0;
    const rootStyle = {
        all: "unset",
        position: "relative",
        display: "inline-block",
        width: TRACK_W + "px",
        height: TRACK_H + "px",
        borderRadius: TRACK_H / 2 + "px",
        backgroundColor: trackBg,
        boxShadow: trackShadow,
        cursor: disabled ? "not-allowed" : "pointer",
        flexShrink: 0,
        transition: "background-color 150ms ease, box-shadow 150ms ease",
        WebkitTapHighlightColor: "transparent",
    };
    const thumbStyle = {
        display: "block",
        position: "absolute",
        top: 0,
        left: thumbLeft + "px",
        width: THUMB_SIZE + "px",
        height: THUMB_SIZE + "px",
        borderRadius: "50%",
        backgroundColor: thumbBg,
        boxShadow: thumbShadow,
        transition: "left 150ms ease, box-shadow 150ms ease",
    };
    const containerStyle = Object.assign({
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        fontFamily: "var(--font-body)",
        fontSize: "var(--text-base)",
        color: "var(--color-text)",
        lineHeight: 1.3,
        cursor: disabled ? "not-allowed" : "pointer",
        userSelect: "none",
    }, disabled ? { opacity: 0.45 } : null, style);
    function handleCheckedChange(val) {
        if (checked == null)
            setInternalChecked(val);
        if (onCheckedChange)
            onCheckedChange(val);
    }
    const rootProps = {
        checked: checked != null ? checked : undefined,
        defaultChecked: checked != null ? undefined : defaultChecked,
        onCheckedChange: handleCheckedChange,
        disabled,
        name,
        required,
        style: rootStyle,
        onMouseEnter: function () {
            if (!disabled)
                setHovered(true);
        },
        onMouseLeave: function () {
            if (!disabled)
                setHovered(false);
        },
    };
    return h("label", { style: containerStyle }, h(BaseSwitch.Root, rootProps, h(BaseSwitch.Thumb, { style: thumbStyle })), label ? h("span", null, label) : null);
}
export default Switch;
