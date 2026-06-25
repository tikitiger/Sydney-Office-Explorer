import React from 'react'
import { createRoot } from 'react-dom/client'
import * as d3 from 'd3'
import * as DayPicker from 'react-day-picker'
import * as dateFns from 'date-fns'

export { React, d3, DayPicker, dateFns }

export function render(element) {
  createRoot(document.getElementById('root')).render(element)
}

export function useHexData(_id) {
  const [state, setState] = React.useState({
    rows: null,
    status: 'RUNNING',
    hasData: false,
    isEmpty: false,
  })
  React.useEffect(() => {
    fetch('/buildings.json')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load buildings.json')
        return r.json()
      })
      .then((rows) =>
        setState({ rows, status: 'COMPLETE', hasData: true, isEmpty: rows.length === 0 })
      )
      .catch(() =>
        setState({ rows: null, status: 'ERRORED', hasData: false, isEmpty: false })
      )
  }, [])
  return state
}

export function useHexConfig() {
  return {}
}

// Stubs for Base UI components (not in the core app.js chain)
export const BaseSwitch = { Root: 'button', Thumb: 'span' }
export const BaseSelect = {
  Root: ({ children }) => children,
  Trigger: 'button',
  Value: ({ children, placeholder }) => placeholder || '',
  Icon: 'span',
  Portal: ({ children }) => children,
  Positioner: 'div',
  Popup: 'div',
  List: 'ul',
  Item: 'li',
  ItemText: 'span',
  Label: 'label',
}
export const LucideIcons = {
  ChevronDown: ({ size }) => React.createElement('span', null, '▾'),
}
export const BaseTooltip = {
  Provider: ({ children }) => children,
  Root: ({ children }) => children,
  Trigger: ({ children, render }) => render || children || null,
  Portal: ({ children }) => children,
  Positioner: 'div',
  Popup: 'div',
}
export const BaseTabs = {
  Root: 'div',
  List: 'div',
  Tab: 'button',
  Panel: 'div',
}
export const BasePopover = {
  Root: ({ children }) => children,
  Trigger: 'button',
  Portal: ({ children }) => children,
  Positioner: 'div',
  Popup: 'div',
}
