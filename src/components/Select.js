/**
 * Select — accessible dropdown select component (Base UI), styled to match Hex.
 * @version 1.0.2
 */
import { BaseSelect, LucideIcons, React } from "app/_data.js";
const h = React.createElement;
const sizeSpecs = {
    sm: {
        minHeight: 24,
        padding: "4px 8px",
        fontSize: "var(--text-sm)",
        itemPadding: "4px 8px",
        itemFontSize: "var(--text-sm)",
        chevron: 14,
    },
    md: {
        minHeight: 28,
        padding: "5px 9px",
        fontSize: "var(--text-base)",
        itemPadding: "6px 10px",
        itemFontSize: "var(--text-base)",
        chevron: 16,
    },
    lg: {
        minHeight: 36,
        padding: "4px 12px",
        fontSize: "var(--text-lg)",
        itemPadding: "8px 12px",
        itemFontSize: "var(--text-lg)",
        chevron: 18,
    },
};
const triggerBase = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "var(--space-2)",
    minWidth: 160,
    fontFamily: "var(--font-body)",
    color: "var(--color-text)",
    background: "var(--color-bg)",
    border: "none",
    borderRadius: "var(--radius)",
    boxShadow: "inset 0 0 0 1px var(--color-border-control)",
    cursor: "pointer",
    outline: "none",
    lineHeight: 1,
    transition: "background-color 120ms ease, box-shadow 120ms ease, color 120ms ease",
};
const popupStyle = {
    background: "var(--color-bg)",
    border: "none",
    borderRadius: "var(--radius)",
    boxShadow: "var(--shadow-popover)",
    padding: "var(--space-1)",
    maxHeight: 320,
    overflowY: "auto",
    position: "relative",
    zIndex: "var(--z-dropdown, 1000)",
    minWidth: "var(--anchor-width)",
};
const itemBase = {
    display: "flex",
    alignItems: "center",
    color: "var(--color-text)",
    borderRadius: "var(--radius)",
    cursor: "pointer",
    outline: "none",
    userSelect: "none",
    transition: "background-color 100ms ease, color 100ms ease",
};
const listOptionStackStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 1,
};
export function Select(props) {
    const options = props.options || [];
    const placeholder = props.placeholder || "Select...";
    const disabled = props.disabled || false;
    const style = props.style;
    const size = props.size || "md";
    const spec = sizeSpecs[size] || sizeSpecs["md"];
    const [internal, setInternal] = React.useState(props.defaultValue != null ? props.defaultValue : undefined);
    const current = props.value != null ? props.value : internal;
    const [open, setOpen] = React.useState(false);
    const [hovered, setHovered] = React.useState(false);
    function handleChange(next) {
        const nextValue = typeof next === "string" ? next : "";
        if (props.value == null)
            setInternal(nextValue);
        if (props.onValueChange)
            props.onValueChange(nextValue);
    }
    const showFocusRing = !disabled && open;
    const emphasize = !disabled && (hovered || open);
    const triggerStateStyle = {
        minHeight: spec.minHeight,
        padding: spec.padding,
        fontSize: spec.fontSize,
        background: emphasize ? "var(--color-bg-muted)" : "var(--color-bg)",
        boxShadow: showFocusRing
            ? "inset 0 0 0 1px var(--color-accent), 0 0 0 3px color-mix(in srgb, var(--color-accent) 18%, transparent)"
            : "inset 0 0 0 1px var(--color-border-control)",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
    };
    const mergedTriggerStyle = Object.assign({}, triggerBase, triggerStateStyle, style);
    const hasValue = current != null && current !== "";
    const valueColor = hasValue
        ? "var(--color-text)"
        : "var(--color-text-placeholder)";
    const portalContainer = typeof document === "undefined" ? undefined : document.body;
    return h(BaseSelect.Root, {
        value: current,
        onValueChange: handleChange,
        disabled,
        open,
        onOpenChange: setOpen,
    }, props.label
        ? h(BaseSelect.Label, {
            style: {
                position: "absolute",
                width: 1,
                height: 1,
                overflow: "hidden",
                clip: "rect(0,0,0,0)",
            },
        }, props.label)
        : null, h(BaseSelect.Trigger, {
        style: mergedTriggerStyle,
        onMouseEnter: function () {
            if (!disabled)
                setHovered(true);
        },
        onMouseLeave: function () {
            setHovered(false);
        },
    }, h("span", { style: { color: valueColor } }, h(BaseSelect.Value, {
        placeholder: placeholder,
        children: function (value) {
            if (value == null || value === "")
                return placeholder;
            const v = typeof value === "string" ? value : String(value);
            for (let i = 0; i < options.length; i++) {
                if (options[i].value === v)
                    return options[i].label;
            }
            return v;
        },
    })), h(BaseSelect.Icon, {
        style: {
            display: "inline-flex",
            alignItems: "center",
            color: "var(--color-text-muted)",
            flexShrink: 0,
        },
    }, h(LucideIcons.ChevronDown, { size: spec.chevron, strokeWidth: 1.5 }))), h(BaseSelect.Portal, { container: portalContainer }, h(BaseSelect.Positioner, {
        sideOffset: 6,
        alignItemWithTrigger: false,
        style: { zIndex: "var(--z-dropdown, 1000)" },
    }, h(BaseSelect.Popup, { style: popupStyle }, h(BaseSelect.List, { style: listOptionStackStyle }, options.map(function (opt) {
        const isSelected = opt.value === current;
        const selectedBg = "color-mix(in srgb, var(--color-accent) 8%, transparent)";
        const selectedBgHighlight = "color-mix(in srgb, var(--color-accent) 14%, transparent)";
        const restingBg = isSelected ? selectedBg : "transparent";
        const highlightBg = isSelected
            ? selectedBgHighlight
            : "var(--color-bg-muted)";
        return h(BaseSelect.Item, {
            key: opt.value,
            value: opt.value,
            style: function (state) {
                const s = state;
                return Object.assign({}, itemBase, {
                    padding: spec.itemPadding,
                    fontSize: spec.itemFontSize,
                    background: s.highlighted ? highlightBg : restingBg,
                    color: isSelected
                        ? "var(--color-accent)"
                        : "var(--color-text)",
                });
            },
        }, h(BaseSelect.ItemText, null, opt.label));
    }))))));
}
export default Select;
