/**
 * Tabs — accessible tab switcher component (Base UI).
 * @version 1.0.0
 */
import { BaseTabs, React } from "app/_data.js";
const h = React.createElement;
const listStyle = {
    display: "flex",
    gap: "20px",
    boxShadow: "inset 0 -1px 0 0 var(--color-border-muted)",
    marginBottom: "var(--space-4)",
};
const baseTabStyle = {
    padding: "8px 0",
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-sm)",
    fontWeight: "var(--font-weight-medium)",
    color: "var(--color-text-muted)",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    outline: "none",
    transition: "color 100ms ease, box-shadow 100ms ease",
};
const activeTabStyle = {
    color: "var(--color-accent)",
    boxShadow: "inset 0 -1px 0 var(--color-accent)",
};
export function Tabs(props) {
    const tabs = props.tabs || [];
    const [internalValue, setInternalValue] = React.useState(props.value != null
        ? props.value
        : props.defaultValue || (tabs.length > 0 ? tabs[0].value : ""));
    const currentValue = props.value != null ? props.value : internalValue;
    const [hoveredTab, setHoveredTab] = React.useState(null);
    function handleValueChange(v) {
        if (props.value == null)
            setInternalValue(v);
        if (props.onValueChange)
            props.onValueChange(v);
    }
    return h(BaseTabs.Root, {
        value: currentValue,
        onValueChange: handleValueChange,
        style: props.style,
    }, h(BaseTabs.List, { style: listStyle }, tabs.map(function (tab) {
        const isActive = tab.value === currentValue;
        const isHovered = !isActive && tab.value === hoveredTab;
        const tStyle = Object.assign({}, baseTabStyle, isActive ? activeTabStyle : null, isHovered ? { color: "var(--color-accent)" } : null);
        return h(BaseTabs.Tab, {
            key: tab.value,
            value: tab.value,
            style: tStyle,
            onMouseEnter: function () {
                setHoveredTab(tab.value);
            },
            onMouseLeave: function () {
                setHoveredTab(null);
            },
        }, tab.label);
    })), tabs.map(function (tab) {
        return h(BaseTabs.Panel, { key: tab.value, value: tab.value }, tab.content);
    }));
}
export default Tabs;
