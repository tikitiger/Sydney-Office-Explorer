import { React } from "app/_data.js";
import { num } from "app/lib/geo.js";

const h = React.createElement;
const { useState, useRef, useEffect, useMemo } = React;

const GRADE_ORDER = ["A+", "A", "B+", "B", "C+", "C", "D+", "D", "E"];

function buildSystemPrompt(buildings, tsMap, selectedBuilding) {
  const count = buildings.length;

  const gradeCounts = {};
  buildings.forEach((r) => {
    const g = (r.property_grade || "").replace(/grade\s*/i, "").trim().toUpperCase() || "Unknown";
    gradeCounts[g] = (gradeCounts[g] || 0) + 1;
  });
  const gradeStr = GRADE_ORDER
    .filter((g) => gradeCounts[g])
    .map((g) => `${g}:${gradeCounts[g]}`)
    .join(", ");

  const tsRows = buildings.map((r) => {
    const series = tsMap?.[r.id] || tsMap?.[r.property_id];
    const latest = series?.[series.length - 1];
    return { r, latest };
  });

  const vacRows = tsRows.filter((x) => x.latest?.vr != null);
  const rentRows = tsRows.filter((x) => x.latest?.nr != null);
  const avgVac = vacRows.length
    ? ((vacRows.reduce((s, x) => s + x.latest.vr, 0) / vacRows.length) * 100).toFixed(1)
    : "N/A";
  const avgRent = rentRows.length
    ? Math.round(rentRows.reduce((s, x) => s + x.latest.nr, 0) / rentRows.length)
    : "N/A";

  const byNla = [...buildings]
    .sort((a, b) => (num(b.building_area) || 0) - (num(a.building_area) || 0))
    .slice(0, 6);
  const topStr = byNla.map((r) => {
    const series = tsMap?.[r.id] || tsMap?.[r.property_id];
    const ts = series?.[series.length - 1];
    const grade = (r.property_grade || "?").replace(/grade\s*/i, "").trim().toUpperCase();
    const vac = ts ? ` vac ${(ts.vr * 100).toFixed(1)}%` : "";
    const rent = ts ? ` rent $${Math.round(ts.nr)}/sqm` : "";
    return `  • ${r.building_name || r.address} (${grade}, ${Math.round(num(r.building_area) || 0).toLocaleString()} sqm${vac}${rent})`;
  }).join("\n");

  let selectedCtx = "";
  if (selectedBuilding) {
    const s = selectedBuilding;
    const series = tsMap?.[s.id] || tsMap?.[s.property_id];
    const latest = series?.[series.length - 1];
    const grade = (s.property_grade || "").replace(/grade\s*/i, "").trim().toUpperCase();
    selectedCtx = `\nCurrently selected: ${s.building_name || s.address} (Grade ${grade}, ${Math.round(num(s.building_area) || 0).toLocaleString()} sqm${latest ? `, vac ${(latest.vr * 100).toFixed(1)}%, rent $${Math.round(latest.nr)}/sqm` : ""})`;
  }

  return `You are an expert commercial real estate analyst specialising in the Sydney CBD and metropolitan office market. You have access to live data on ${count} office buildings currently visible on an interactive 3D map.

Market data (Q1 2026):
• Buildings visible: ${count}
• Grade distribution: ${gradeStr}
• Avg vacancy rate: ${avgVac}%
• Avg net rent: $${avgRent}/sqm${selectedCtx}

Largest buildings by NLA:
${topStr}

Respond concisely with commercial insight. Use Australian commercial real estate terminology. Focus on actionable intelligence. If asked about a specific building or precinct, draw on the data provided.`;
}

async function callAnthropic(messages, systemPrompt) {
  const key = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!key) throw new Error("NO_KEY");

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${resp.status}`);
  }
  const data = await resp.json();
  return data.content[0].text;
}

export function AgentChat({ buildings, tsMap, selectedBuilding }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const systemPrompt = useMemo(
    () => buildSystemPrompt(buildings || [], tsMap, selectedBuilding),
    [buildings, tsMap, selectedBuilding],
  );

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg = { role: "user", content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setLoading(true);
    try {
      const reply = await callAnthropic(history, systemPrompt);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      const errText =
        e.message === "NO_KEY"
          ? "No API key found. Add VITE_ANTHROPIC_API_KEY to your .env.local to enable AI analysis."
          : `Error: ${e.message}`;
      setMessages((prev) => [...prev, { role: "assistant", content: errText }]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return h("div", { className: "chat-panel" + (open ? "" : " chat-panel--collapsed") },
    h("button", {
      className: "chat-tab",
      onClick: () => setOpen((v) => !v),
      title: open ? "Close AI assistant" : "Ask AI about this market",
    }, open ? "▾ AI" : "✦ AI"),
    open
      ? h("div", { className: "chat-body" },
          h("div", { className: "chat-header" },
            h("div", { className: "chat-header-left" },
              h("span", { className: "chat-header-title" }, "AI Analysis"),
              h("span", { className: "chat-header-sub" }, `${(buildings || []).length} buildings`),
            ),
            h("button", {
              className: "chat-clear",
              onClick: () => setMessages([]),
              title: "Clear conversation",
            }, "✕"),
          ),
          h("div", { ref: scrollRef, className: "chat-messages" },
            messages.length === 0
              ? h("div", { className: "chat-empty" },
                  h("div", { className: "chat-empty-icon" }, "✦"),
                  h("div", { className: "chat-empty-text" },
                    "Ask about vacancy trends, building performance, or compare precincts across the Sydney office market.",
                  ),
                )
              : messages.map((m, i) =>
                  h("div", { key: i, className: `chat-msg chat-msg--${m.role}` },
                    h("div", { className: "chat-bubble" }, m.content),
                  ),
                ),
            loading
              ? h("div", { className: "chat-msg chat-msg--assistant" },
                  h("div", { className: "chat-bubble chat-bubble--loading" },
                    h("span", { className: "chat-dots" }, "···"),
                  ),
                )
              : null,
          ),
          h("div", { className: "chat-input-row" },
            h("textarea", {
              className: "chat-input",
              value: input,
              onChange: (e) => setInput(e.target.value),
              onKeyDown,
              placeholder: "Ask about the Sydney office market…",
              rows: 2,
            }),
            h("button", {
              className: "chat-send" + (loading || !input.trim() ? " chat-send--disabled" : ""),
              onClick: send,
              disabled: loading || !input.trim(),
            }, "→"),
          ),
        )
      : null,
  );
}

export default AgentChat;
