/**
 * DatePicker — date selection (single date or range), popover or inline.
 * @version 1.0.3
 *
 * Wraps react-day-picker v9 with a Base UI Popover trigger. Calendar styling is
 * coordinated through CSS tokens (--color-date-selected-bg, --color-date-range-bg,
 * --color-accent) so dark mode is automatic. The wrapper has no internal theme
 * subscription — it reads only via var(--token).
 *
 * Props (common):
 *   mode             - "single" | "range" (default: "single")
 *   inline           - boolean, render calendar inline instead of popover (default: false)
 *   value            - Date | null (single) or { from: Date, to: Date|null } (range).
 *                      Pass null to clear; controlled detection uses key presence,
 *                      so null is a valid controlled value.
 *   defaultValue     - same shape as value, for uncontrolled use
 *   onValueChange    - (next) => void. In range mode, fires once with
 *                      { from, to: null } after the first click and again with
 *                      { from, to } after the second click.
 *   minDate          - Date, inclusive lower bound
 *   maxDate          - Date, inclusive upper bound
 *   dateFormat       - date-fns format string for the trigger label
 *                      (default: locale "medium" date style, e.g. "Apr 24, 2026")
 *   placeholder      - trigger text when nothing selected
 *                      (default: "Pick a date" / "Pick a date range")
 *   disabled         - boolean (default: false)
 *   size             - "sm" | "md" | "lg" (default: "md") — matches Select sizing
 *   label            - visible label rendered above trigger (string)
 *   "aria-label"     - SR-only label if no visible label. Falls back to
 *                      `label` when set; otherwise defaults to "Select date"
 *                      / "Select date range" based on mode.
 *   style            - merged onto outermost element
 *
 * Props (range only, ignored when mode="single"):
 *   presets          - true | false | Array<{ label, getRange }> (default: true)
 *                      Each custom preset: { label: string, getRange: () => { from, to } }
 *   numberOfMonths   - 1 | 2 (default: 2)
 *
 * Usage:
 *   import { DatePicker } from "app/components/DatePicker.js";
 *   React.createElement(DatePicker, {
 *     mode: "range",
 *     defaultValue: { from: new Date(), to: null },
 *     onValueChange: function(r) { console.log(r); },
 *   })
 */
import { BasePopover, DayPicker, LucideIcons, React, dateFns, } from "app/_data.js";
import "app/components/DatePicker.css";
const sizeSpecs = {
    sm: {
        minHeight: 24,
        padding: "4px 8px",
        fontSize: "var(--text-sm)",
        chevron: 14,
        minWidth: 160,
    },
    md: {
        minHeight: 28,
        padding: "5px 9px",
        fontSize: "var(--text-base)",
        chevron: 16,
        minWidth: 180,
    },
    lg: {
        minHeight: 36,
        padding: "4px 12px",
        fontSize: "var(--text-lg)",
        chevron: 18,
        minWidth: 200,
    },
};
const hasOwn = Object.prototype.hasOwnProperty;
const h = React.createElement;
const triggerBaseStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "var(--space-2)",
    fontFamily: "var(--font-body)",
    color: "var(--color-text)",
    background: "var(--color-bg)",
    border: "none",
    borderRadius: "var(--radius)",
    boxShadow: "inset 0 0 0 1px var(--color-border)",
    cursor: "pointer",
    outline: "none",
    textAlign: "left",
    lineHeight: 1,
    transition: "background-color 120ms ease, box-shadow 120ms ease, color 120ms ease",
};
const triggerHoverBackground = "color-mix(in srgb, var(--color-accent) 4%, var(--color-bg))";
const labelStyle = {
    display: "block",
    marginBottom: "var(--space-1)",
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-sm)",
    fontWeight: "var(--font-weight-medium)",
    color: "var(--color-text-muted)",
};
const popoverContentStyle = {
    background: "var(--color-bg)",
    border: "1px solid var(--color-border-muted)",
    borderRadius: "var(--radius)",
    boxShadow: "var(--shadow-lg)",
    padding: "var(--space-3)",
    display: "flex",
    gap: "var(--space-3)",
    fontFamily: "var(--font-body)",
    color: "var(--color-text)",
    position: "relative",
    zIndex: "var(--z-dropdown, 1000)",
};
const inlineWrapStyle = {
    display: "inline-flex",
    flexDirection: "column",
    gap: "var(--space-1)",
    fontFamily: "var(--font-body)",
    color: "var(--color-text)",
};
const inlineCalendarBoxStyle = {
    background: "var(--color-bg)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius)",
    padding: "var(--space-3)",
    display: "flex",
    gap: "var(--space-3)",
};
const calendarRootStyle = {
    ["--rdp-accent-color"]: "var(--color-accent)",
    ["--rdp-accent-background-color"]: "var(--color-date-range-bg)",
    ["--rdp-day-height"]: "32px",
    ["--rdp-day-width"]: "32px",
    ["--rdp-day_button-height"]: "30px",
    ["--rdp-day_button-width"]: "30px",
    ["--rdp-day_button-border-radius"]: "var(--radius)",
    ["--rdp-week_number-border-radius"]: "var(--radius)",
    ["--rdp-nav-height"]: "2.25rem",
    ["--rdp-nav_button-height"]: "2rem",
    ["--rdp-nav_button-width"]: "2rem",
    ["--rdp-months-gap"]: "var(--space-4)",
    ["--rdp-range_middle-background-color"]: "var(--color-date-range-bg)",
    ["--rdp-range_middle-color"]: "var(--color-text)",
    ["--rdp-range_start-color"]: "var(--color-accent)",
    ["--rdp-range_end-color"]: "var(--color-accent)",
    ["--rdp-range_start-date-background-color"]: "var(--color-date-selected-bg)",
    ["--rdp-range_end-date-background-color"]: "var(--color-date-selected-bg)",
    ["--rdp-today-color"]: "var(--color-accent)",
    ["--rdp-selected-border"]: "0",
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-base)",
    color: "var(--color-text)",
};
const calendarModifierStyles = {
    selected: {
        background: "var(--color-date-selected-bg)",
        color: "var(--color-accent)",
        borderRadius: "var(--radius)",
    },
    range_start: {
        color: "var(--color-accent)",
    },
    range_end: {
        color: "var(--color-accent)",
    },
    range_middle: {
        background: "var(--color-date-range-bg)",
        color: "var(--color-text)",
    },
    today: {
        fontWeight: "var(--font-weight-semibold)",
    },
    outside: {
        color: "var(--color-text-muted)",
    },
    disabled: {
        color: "var(--color-text-muted)",
        opacity: 0.4,
    },
};
const presetRailStyle = {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-1)",
    paddingRight: "var(--space-3)",
    borderRight: "1px solid var(--color-border-muted)",
    minWidth: 130,
};
const presetButtonStyle = {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "6px 10px",
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-sm)",
    color: "var(--color-text)",
    background: "transparent",
    border: "1px solid transparent",
    borderRadius: "var(--radius)",
    cursor: "pointer",
    outline: "none",
    transition: "background-color 100ms ease, color 100ms ease",
};
const presetActiveBg = "color-mix(in srgb, var(--color-accent) 8%, transparent)";
const presetActiveBgHover = "color-mix(in srgb, var(--color-accent) 14%, transparent)";
function rangesEqual(a, b) {
    if (!a || !b || !a.from || !b.from)
        return false;
    if (a.from.getTime() !== b.from.getTime())
        return false;
    const aTo = a.to == null ? null : a.to.getTime();
    const bTo = b.to == null ? null : b.to.getTime();
    return aTo === bTo;
}
function defaultPresets() {
    return [
        {
            label: "Today",
            getRange: function () {
                const d = dateFns.startOfDay(new Date());
                return { from: d, to: d };
            },
        },
        {
            label: "Yesterday",
            getRange: function () {
                const d = dateFns.startOfDay(dateFns.subDays(new Date(), 1));
                return { from: d, to: d };
            },
        },
        {
            label: "Last 7 days",
            getRange: function () {
                const to = dateFns.startOfDay(new Date());
                const from = dateFns.subDays(to, 6);
                return { from, to };
            },
        },
        {
            label: "Last 14 days",
            getRange: function () {
                const to = dateFns.startOfDay(new Date());
                const from = dateFns.subDays(to, 13);
                return { from, to };
            },
        },
        {
            label: "Last 30 days",
            getRange: function () {
                const to = dateFns.startOfDay(new Date());
                const from = dateFns.subDays(to, 29);
                return { from, to };
            },
        },
        {
            label: "This month",
            getRange: function () {
                const now = new Date();
                return { from: dateFns.startOfMonth(now), to: dateFns.startOfDay(now) };
            },
        },
        {
            label: "Last month",
            getRange: function () {
                const prev = dateFns.subMonths(new Date(), 1);
                return {
                    from: dateFns.startOfMonth(prev),
                    to: dateFns.endOfMonth(prev),
                };
            },
        },
        {
            label: "Last 90 days",
            getRange: function () {
                const to = dateFns.startOfDay(new Date());
                const from = dateFns.subDays(to, 89);
                return { from, to };
            },
        },
        {
            label: "Year to date",
            getRange: function () {
                const now = new Date();
                return { from: dateFns.startOfYear(now), to: dateFns.startOfDay(now) };
            },
        },
    ];
}
function formatLabel(date, fmt) {
    if (!date)
        return "";
    if (fmt)
        return dateFns.format(date, fmt);
    return date.toLocaleDateString(undefined, { dateStyle: "medium" });
}
function rangeLabel(range, fmt) {
    if (!range || !range.from)
        return "";
    if (!range.to)
        return formatLabel(range.from, fmt);
    return formatLabel(range.from, fmt) + " - " + formatLabel(range.to, fmt);
}
function toRdpSingle(value) {
    if (!value || value instanceof Date)
        return value || undefined;
    return undefined;
}
function toRdpRange(value) {
    if (!value || value instanceof Date)
        return undefined;
    const r = value;
    return { from: r.from, to: r.to == null ? undefined : r.to };
}
function initialMonth(value) {
    if (value instanceof Date)
        return value;
    if (value && value.from)
        return value.from;
    return new Date();
}
function fromRdpSingle(next) {
    return next == null ? null : next;
}
function fromRdpRange(next) {
    if (!next || !next.from)
        return null;
    return { from: next.from, to: next.to == null ? null : next.to };
}
export function DatePicker(props) {
    const mode = props.mode || "single";
    const inline = props.inline || false;
    const disabled = props.disabled || false;
    const size = props.size || "md";
    const sizeSpec = sizeSpecs[size] || sizeSpecs.md;
    const dateFormat = props.dateFormat;
    const minDate = props.minDate;
    const maxDate = props.maxDate;
    const presets = mode === "range"
        ? hasOwn.call(props, "presets")
            ? (props.presets ?? false)
            : true
        : false;
    const numberOfMonths = props.numberOfMonths != null
        ? props.numberOfMonths
        : mode === "range"
            ? 2
            : 1;
    const placeholder = props.placeholder ||
        (mode === "range" ? "Pick a date range" : "Pick a date");
    const isControlled = hasOwn.call(props, "value");
    const [internal, setInternal] = React.useState(hasOwn.call(props, "defaultValue")
        ? (props.defaultValue ?? null)
        : null);
    const current = isControlled
        ? (props.value ?? null)
        : internal;
    const [open, setOpen] = React.useState(false);
    const [hovered, setHovered] = React.useState(false);
    function commitPublic(publicNext, opts) {
        if (!isControlled)
            setInternal(publicNext);
        if (props.onValueChange)
            props.onValueChange(publicNext);
        if (!inline && opts.closeOnComplete) {
            let done = false;
            if (mode === "single") {
                done = !!publicNext;
            }
            else {
                const r = publicNext;
                done = !!(r && r.from && r.to && r.from.getTime() !== r.to.getTime());
            }
            if (done)
                setOpen(false);
        }
        if (!inline && opts.alwaysClose)
            setOpen(false);
    }
    function handleSingleChange(next) {
        commitPublic(fromRdpSingle(next), { closeOnComplete: true });
    }
    function handleRangeChange(next) {
        commitPublic(fromRdpRange(next), { closeOnComplete: true });
    }
    const disabledMatchers = [];
    if (minDate)
        disabledMatchers.push({ before: minDate });
    if (maxDate)
        disabledMatchers.push({ after: maxDate });
    function renderCalendar() {
        const calendarBase = {
            numberOfMonths,
            defaultMonth: initialMonth(current),
            disabled: disabled
                ? true
                : disabledMatchers.length
                    ? disabledMatchers
                    : undefined,
            modifiersStyles: calendarModifierStyles,
            style: calendarRootStyle,
            showOutsideDays: true,
        };
        const calendar = mode === "single"
            ? h(DayPicker.DayPicker, {
                ...calendarBase,
                mode: "single",
                selected: toRdpSingle(current),
                onSelect: handleSingleChange,
            })
            : h(DayPicker.DayPicker, {
                ...calendarBase,
                mode: "range",
                selected: toRdpRange(current),
                onSelect: handleRangeChange,
            });
        if (mode === "range" && presets) {
            const presetList = Array.isArray(presets)
                ? presets
                : defaultPresets();
            const currentRange = current;
            return [
                h("div", { key: "rail", style: presetRailStyle }, presetList.map(function (p) {
                    const isActive = rangesEqual(currentRange, p.getRange());
                    const restingBg = isActive ? presetActiveBg : "transparent";
                    const hoverBg = isActive
                        ? presetActiveBgHover
                        : "var(--color-bg-muted)";
                    const buttonStyle = {
                        ...presetButtonStyle,
                        background: restingBg,
                        color: isActive ? "var(--color-accent)" : "var(--color-text)",
                    };
                    return h("button", {
                        key: p.label,
                        type: "button",
                        style: buttonStyle,
                        onMouseEnter: function (e) {
                            e.currentTarget.style.background = hoverBg;
                        },
                        onMouseLeave: function (e) {
                            e.currentTarget.style.background = restingBg;
                        },
                        onClick: function () {
                            if (disabled)
                                return;
                            const r = p.getRange();
                            const from = minDate && r.from < minDate ? minDate : r.from;
                            const to = r.to && maxDate && r.to > maxDate ? maxDate : r.to;
                            if (from && to && from > to)
                                return;
                            commitPublic({ from, to }, { alwaysClose: true });
                        },
                    }, p.label);
                })),
                h("div", { key: "cal" }, calendar),
            ];
        }
        return calendar;
    }
    const triggerLabelText = mode === "range"
        ? rangeLabel(current, dateFormat) || placeholder
        : formatLabel(current, dateFormat) || placeholder;
    const hasValue = mode === "range" ? !!(current && current.from) : !!current;
    if (inline) {
        return h("div", { style: { ...inlineWrapStyle, ...(props.style || {}) } }, props.label ? h("label", { style: labelStyle }, props.label) : null, h("div", { style: inlineCalendarBoxStyle }, renderCalendar()));
    }
    const showFocusRing = !disabled && open;
    const emphasize = !disabled && (hovered || open);
    const triggerComputed = {
        ...triggerBaseStyle,
        minHeight: sizeSpec.minHeight,
        padding: sizeSpec.padding,
        fontSize: sizeSpec.fontSize,
        minWidth: sizeSpec.minWidth,
        background: emphasize ? triggerHoverBackground : "var(--color-bg)",
        boxShadow: showFocusRing
            ? "inset 0 0 0 1px var(--color-accent), 0 0 0 3px color-mix(in srgb, var(--color-accent) 18%, transparent)"
            : emphasize
                ? "inset 0 0 0 1px var(--color-border-strong)"
                : "inset 0 0 0 1px var(--color-border)",
        ...(!hasValue ? { color: "var(--color-text-placeholder)" } : null),
        ...(disabled ? { opacity: 0.5, cursor: "not-allowed" } : null),
    };
    const ariaLabel = props["aria-label"] ||
        (typeof props.label === "string" ? props.label : undefined) ||
        (mode === "range" ? "Select date range" : "Select date");
    const portalContainer = typeof document === "undefined" ? undefined : document.body;
    return h("div", {
        style: {
            display: "inline-flex",
            flexDirection: "column",
            gap: "var(--space-1)",
            ...(props.style || {}),
        },
    }, props.label ? h("label", { style: labelStyle }, props.label) : null, h(BasePopover.Root, { open, onOpenChange: setOpen }, h(BasePopover.Trigger, {
        disabled,
        "aria-label": ariaLabel,
        style: triggerComputed,
        onMouseEnter: function () {
            if (!disabled)
                setHovered(true);
        },
        onMouseLeave: function () {
            setHovered(false);
        },
    }, h("span", null, triggerLabelText), h("span", {
        "aria-hidden": "true",
        style: {
            display: "inline-flex",
            alignItems: "center",
            color: "var(--color-text-muted)",
            flexShrink: 0,
        },
    }, h(LucideIcons.ChevronDown, {
        size: sizeSpec.chevron,
        strokeWidth: 1.5,
    }))), h(BasePopover.Portal, { container: portalContainer }, h(BasePopover.Positioner, {
        sideOffset: 6,
        align: "start",
        style: { zIndex: "var(--z-dropdown, 1000)" },
    }, h(BasePopover.Popup, { style: popoverContentStyle }, renderCalendar())))));
}
export default DatePicker;
