/**
 * Tooltip — accessible hover tooltip component (Base UI).
 * @version 1.0.1
 */
import { BaseTooltip, React } from "app/_data.js";
const h = React.createElement;
const tipPopupStyle = {
    padding: "4px 8px",
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-sm)",
    color: "var(--color-bg)",
    background: "var(--color-text)",
    borderRadius: "var(--radius)",
    maxWidth: 240,
    lineHeight: "var(--leading-normal)",
    boxShadow: "var(--shadow-md)",
    position: "relative",
    zIndex: "var(--z-tooltip, 1100)",
    pointerEvents: "none",
};
export function Tooltip(props) {
    const content = props.content;
    const children = props.children;
    const side = props.side || "top";
    const delayMs = props.delayMs != null ? props.delayMs : 200;
    const portalContainer = typeof document === "undefined" ? undefined : document.body;
    return h(BaseTooltip.Provider, { delay: delayMs }, h(BaseTooltip.Root, null, h(BaseTooltip.Trigger, { render: children }), h(BaseTooltip.Portal, { container: portalContainer }, h(BaseTooltip.Positioner, { side, sideOffset: 6, style: { zIndex: "var(--z-tooltip, 1100)" } }, h(BaseTooltip.Popup, { style: Object.assign({}, tipPopupStyle, props.style) }, content)))));
}
export default Tooltip;
