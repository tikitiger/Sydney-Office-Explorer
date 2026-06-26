import { React } from "app/_data.js";
import { project, DEFAULT_HEIGHT, shade, pointInRing, num } from "app/lib/geo.js";

const h = React.createElement;
const PITCH_DEFAULT = 50 * (Math.PI / 180);
const PITCH_MIN = 0;
const PITCH_MAX = 85 * (Math.PI / 180);

const EARTH_R = 6378137;
const WORLD = 2 * Math.PI * EARTH_R;
const HALF_W = Math.PI * EARTH_R;
const tileImgCache = new Map();

export const BASEMAPS = [
  {
    key: "light", label: "Light", dark: false, subdomains: ["a", "b", "c", "d"],
    url: (s, z, x, y) => `https://${s}.basemaps.cartocdn.com/light_all/${z}/${x}/${y}.png`,
  },
  {
    key: "dark", label: "Dark", dark: true, subdomains: ["a", "b", "c", "d"],
    url: (s, z, x, y) => `https://${s}.basemaps.cartocdn.com/dark_all/${z}/${x}/${y}.png`,
  },
  {
    key: "voyager", label: "Voyager", dark: false, subdomains: ["a", "b", "c", "d"],
    url: (s, z, x, y) => `https://${s}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`,
  },
  {
    key: "positron", label: "Positron (no labels)", dark: false, subdomains: ["a", "b", "c", "d"],
    url: (s, z, x, y) => `https://${s}.basemaps.cartocdn.com/light_nolabels/${z}/${x}/${y}.png`,
  },
  {
    key: "osm", label: "OSM", dark: false, subdomains: [""],
    url: (s, z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
  },
  {
    key: "satellite", label: "Satellite", dark: true, subdomains: [""],
    url: (s, z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
  },
];
export const DEFAULT_BASEMAP = "light";
const BASEMAP_BY_KEY = new Map(BASEMAPS.map((b) => [b.key, b]));
const LIGHT = (() => {
  const v = [-0.5, -0.85];
  const m = Math.hypot(v[0], v[1]);
  return [v[0] / m, v[1] / m];
})();

function prepBuilding(row) {
  let raw;
  try {
    raw = JSON.parse(row.polygons_json);
  } catch (e) {
    return null;
  }
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const rings = [];
  let sx = 0, sy = 0, n = 0;
  for (const ring of raw) {
    if (!Array.isArray(ring) || ring.length < 3) continue;
    const pr = [];
    for (const pt of ring) {
      const p = project(pt[0], pt[1]);
      pr.push(p);
      sx += p[0];
      sy += p[1];
      n++;
    }
    rings.push(pr);
  }
  if (!rings.length || n === 0) return null;
  let hgt = num(row.height);
  if (hgt == null || hgt <= 0) hgt = DEFAULT_HEIGHT;
  return { row, rings, cx: sx / n, cy: sy / n, height: hgt };
}

export function Map3D({ buildings, encoder, geoKey, basemap, competitorMap, highlightCompetitors, showLabels = true, subjectId, peerIds, selectedBuildingId, focusBuildingId, onBuildingClick }) {
  const baseDef = BASEMAP_BY_KEY.get(basemap) || BASEMAP_BY_KEY.get(DEFAULT_BASEMAP);
  const isDark = !!baseDef.dark;
  const { useRef, useEffect, useState, useMemo, useCallback } = React;
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const camRef = useRef(null);
  const drawnRef = useRef([]);
  const dragRef = useRef(null);
  const rafRef = useRef(null);
  const drawRef = useRef(null);
  const [size, setSize] = useState({ w: 900, h: 640 });
  const [hover, setHover] = useState(null);
  const [tileTick, setTileTick] = useState(0);
  const tileCacheRef = useRef(tileImgCache);

  const getTile = useCallback((url) => {
    const cache = tileCacheRef.current;
    let e = cache.get(url);
    if (e) return e.loaded ? e.img : null;
    const img = new Image();
    e = { img, loaded: false };
    cache.set(url, e);
    img.onload = () => { e.loaded = true; setTileTick((t) => t + 1); };
    img.onerror = () => { e.loaded = false; };
    img.src = url;
    return null;
  }, []);

  const geom = useMemo(() => {
    const out = [];
    for (const b of buildings) {
      const p = prepBuilding(b);
      if (p) out.push(p);
    }
    return out;
  }, [buildings]);

  const meanSecLat = useMemo(() => {
    if (!buildings.length) return 1.2;
    let s = 0, c = 0;
    for (const b of buildings) {
      const lat = num(b.latitude);
      if (lat != null) {
        s += 1 / Math.cos(lat * (Math.PI / 180));
        c++;
      }
    }
    return c ? s / c : 1.2;
  }, [buildings]);

  const fit = useCallback(() => {
    if (!geom.length) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const g of geom) {
      for (const ring of g.rings) {
        for (const p of ring) {
          if (p[0] < minX) minX = p[0];
          if (p[0] > maxX) maxX = p[0];
          if (p[1] < minY) minY = p[1];
          if (p[1] > maxY) maxY = p[1];
        }
      }
    }
    const spanX = Math.max(maxX - minX, 1);
    const spanY = Math.max(maxY - minY, 1);
    const cosP = Math.cos(PITCH_DEFAULT);
    const pad = 0.78;
    const zoomX = (size.w * pad) / spanX;
    const zoomY = (size.h * pad) / (spanY * cosP);
    const zoom = Math.min(zoomX, zoomY);
    camRef.current = {
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      zoom,
      bearing: -0.35,
      pitch: PITCH_DEFAULT,
    };
  }, [geom, size.w, size.h]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const cam = camRef.current;
    if (!canvas || !cam) return;
    const dpr = window.devicePixelRatio || 1;
    const { w, h: H } = size;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, H);
    ctx.fillStyle = isDark ? "#1a1a22" : getCss("--color-bg-muted", "#f8fafb");
    ctx.fillRect(0, 0, w, H);

    const sinB = Math.sin(cam.bearing), cosB = Math.cos(cam.bearing);
    const cosP = Math.cos(cam.pitch), sinP = Math.sin(cam.pitch);
    const ox = w / 2, oy = H * 0.62;
    const hk = cam.zoom * meanSecLat;

    const tp = (mx, my, ez) => {
      const dx = mx - cam.cx, dy = my - cam.cy;
      const rx = (dx * cosB - dy * sinB) * cam.zoom;
      const ry = (dx * sinB + dy * cosB) * cam.zoom;
      const z = ez * hk;
      return [ox + rx, oy - ry * cosP - z * sinP, ry];
    };

    const invGround = (sx, sy) => {
      const P = (sx - ox) / cam.zoom;
      const Q = (oy - sy) / (cam.zoom * cosP);
      const u = P * cosB + Q * sinB;
      const v = -P * sinB + Q * cosB;
      return [cam.cx + u, cam.cy + v];
    };
    if (cosP > 0.02) {
      // Clamp far corners so high-pitch views don't request tiles at infinite distance.
      const MAX_DIST = 40000;
      const clampCorner = ([wx, wy]) => {
        const d = Math.hypot(wx - cam.cx, wy - cam.cy);
        if (d <= MAX_DIST) return [wx, wy];
        const f = MAX_DIST / d;
        return [cam.cx + (wx - cam.cx) * f, cam.cy + (wy - cam.cy) * f];
      };
      const corners = [
        clampCorner(invGround(0, 0)), clampCorner(invGround(w, 0)),
        clampCorner(invGround(0, H)), clampCorner(invGround(w, H)),
      ];
      let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity;
      for (const c of corners) {
        if (c[0] < mnx) mnx = c[0];
        if (c[0] > mxx) mxx = c[0];
        if (c[1] < mny) mny = c[1];
        if (c[1] > mxy) mxy = c[1];
      }
      let z = Math.round(Math.log2((WORLD * cam.zoom) / 256));
      z = Math.max(1, Math.min(19, z));
      const n = Math.pow(2, z);
      const tileWorld = WORLD / n;
      let txMin = Math.floor((mnx + HALF_W) / tileWorld);
      let txMax = Math.floor((mxx + HALF_W) / tileWorld);
      let tyMin = Math.floor((HALF_W - mxy) / tileWorld);
      let tyMax = Math.floor((HALF_W - mny) / tileWorld);
      const MAXR = 14;
      const cTx = Math.floor((cam.cx + HALF_W) / tileWorld);
      const cTy = Math.floor((HALF_W - cam.cy) / tileWorld);
      txMin = Math.max(txMin, cTx - MAXR);
      txMax = Math.min(txMax, cTx + MAXR);
      tyMin = Math.max(tyMin, cTy - MAXR);
      tyMax = Math.min(tyMax, cTy + MAXR);
      const factor = tileWorld / 256;
      const a = cosB * cam.zoom * factor;
      const b = -sinB * cam.zoom * cosP * factor;
      const c2 = sinB * cam.zoom * factor;
      const d2 = cosB * cam.zoom * cosP * factor;
      for (let tx = txMin; tx <= txMax; tx++) {
        for (let ty = tyMin; ty <= tyMax; ty++) {
          if (ty < 0 || ty >= n) continue;
          const wx = ((tx % n) + n) % n;
          const subs = baseDef.subdomains;
          const sub = subs[(wx + ty) % subs.length];
          const url = baseDef.url(sub, z, wx, ty);
          const img = getTile(url);
          if (!img) continue;
          const x0 = -HALF_W + tx * tileWorld;
          const yTop = HALF_W - ty * tileWorld;
          const uu = x0 - cam.cx, vv = yTop - cam.cy;
          const e = ox + (uu * cosB - vv * sinB) * cam.zoom;
          const f = oy - (uu * sinB + vv * cosB) * cam.zoom * cosP;
          ctx.setTransform(a * dpr, b * dpr, c2 * dpr, d2 * dpr, e * dpr, f * dpr);
          try { ctx.drawImage(img, 0, 0, 257, 257); } catch (_) {}
        }
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const drawn = [];
    const hoverId = hover && hover.row ? hover.row.id : null;
    const strokeStyle = isDark ? "rgba(255,255,255,0.32)" : "rgba(0,0,0,0.18)";
    const strokeW = isDark ? 0.5 : 0.4;
    const hoverStroke = getCss("--color-text", "#01011b");

    // Sort buildings far-to-near so near buildings paint over far ones.
    // Depth = ry component of centroid (positive = farther into screen).
    const sortedGeom = [...geom].sort((a, b) => {
      const ryA = (a.cx - cam.cx) * sinB + (a.cy - cam.cy) * cosB;
      const ryB = (b.cx - cam.cx) * sinB + (b.cy - cam.cy) * cosB;
      return ryB - ryA; // descending: far buildings first
    });

    ctx.lineJoin = "round";

    const COMPETITOR_STROKE = "#08475e";
    const SUBJECT_STROKE = "#ffffff";
    for (const g of sortedGeom) {
      const color = encoder.getColor(g.row);
      const isHover = g.row.id === hoverId;
      const isCompetitor = !!(highlightCompetitors && peerIds && peerIds.has(g.row.id));
      const isSubject = !!(highlightCompetitors && g.row.id === selectedBuildingId);
      if (highlightCompetitors && !isCompetitor && !isSubject) ctx.globalAlpha = 0.25;
      const screenRings = [];
      const wallQuadsForHit = [];

      for (const ring of g.rings) {
        const base = ring.map((p) => tp(p[0], p[1], 0));
        const roof = ring.map((p) => tp(p[0], p[1], g.height));
        screenRings.push(roof);

        // Determine ring winding (CCW in web-mercator = positive signed area).
        // Used to ensure outward normals point away from the building interior.
        let signedArea2x = 0;
        for (let k = 0; k < ring.length - 1; k++) {
          signedArea2x += ring[k][0] * ring[k + 1][1] - ring[k + 1][0] * ring[k][1];
        }
        const normalSign = signedArea2x > 0 ? 1 : -1;

        // Footprint ground shadow — drawn first so walls cover it.
        ctx.beginPath();
        for (let k = 0; k < base.length; k++) {
          const p = base[k];
          if (k === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
        }
        ctx.closePath();
        ctx.fillStyle = "rgba(0,0,0,0.06)";
        ctx.fill();

        // Collect visible walls (backface-culled using world-space normals).
        const wallFaces = [];
        for (let k = 0; k < ring.length - 1; k++) {
          // World-space outward normal for this edge.
          const wex = ring[k + 1][0] - ring[k][0];
          const wey = ring[k + 1][1] - ring[k][1];
          const wnl = Math.hypot(wex, wey) || 1;
          const wnx = (wey / wnl) * normalSign;
          const wny = (-wex / wnl) * normalSign;
          // Camera view direction is (sinB, cosB); wall faces camera when dot < 0.
          if (wnx * sinB + wny * cosB >= 0) continue;

          const a = base[k], b = base[k + 1], rb = roof[k + 1], ra = roof[k];
          // Screen-space normal for diffuse lighting.
          const ex = b[0] - a[0], ey = b[1] - a[1];
          const nl = Math.hypot(ex, ey) || 1;
          const nx = ey / nl, ny = -ex / nl;
          // Higher base keeps wall color visible; range 0.65–0.97 instead of 0.40–0.92.
          const lit = 0.65 + 0.32 * Math.max(0, nx * LIGHT[0] + ny * LIGHT[1]);
          // Depth = avg ry of the two base corners (roof corners share same ry).
          const wallDepth = (a[2] + b[2]) / 2;
          const quad = [a, b, rb, ra];
          wallFaces.push({ depth: wallDepth, quad, fill: shade(color, Math.max(0.65, Math.min(0.97, lit))) });
          wallQuadsForHit.push(quad);
        }

        // Sort walls within this ring far-to-near (descending ry).
        wallFaces.sort((a, b) => b.depth - a.depth);

        // Draw walls.
        for (const wf of wallFaces) {
          const q = wf.quad;
          ctx.beginPath();
          ctx.moveTo(q[0][0], q[0][1]);
          for (let k = 1; k < 4; k++) ctx.lineTo(q[k][0], q[k][1]);
          ctx.closePath();
          ctx.fillStyle = wf.fill;
          ctx.fill();
        }

        // Draw roof last — always on top within this building.
        ctx.beginPath();
        for (let k = 0; k < roof.length; k++) {
          const p = roof[k];
          if (k === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
        }
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        if (isHover) {
          ctx.strokeStyle = hoverStroke;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else if (isSubject) {
          ctx.strokeStyle = SUBJECT_STROKE;
          ctx.lineWidth = 2.5;
          ctx.stroke();
        } else if (isCompetitor) {
          ctx.strokeStyle = COMPETITOR_STROKE;
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          ctx.strokeStyle = strokeStyle;
          ctx.lineWidth = strokeW;
          ctx.stroke();
        }
      }

      if (highlightCompetitors && !isCompetitor) ctx.globalAlpha = 1;
      drawn.push({ row: g.row, rings: screenRings, wallQuads: wallQuadsForHit });
    }
    // ---- Building label pass ----
    if (showLabels || highlightCompetitors) {
      const canvasW = size.w, canvasH = size.h;
      const FSIZ = 11;
      ctx.font = `600 ${FSIZ}px "Lato","IBM Plex Sans",system-ui`;
      ctx.textBaseline = "middle";
      const PAD_H = 5, PAD_V = 2;
      const LH = FSIZ + PAD_V * 2;
      const LGAP = 7;

      const drawLabel = (lbl, px, py, lw) => {
        ctx.save();
        // Leader line
        ctx.beginPath();
        ctx.moveTo(px + lw / 2, py + LH);
        ctx.lineTo(lbl.apexX, lbl.apexY - 2);
        ctx.setLineDash([2, 3]);
        ctx.strokeStyle = lbl.isSub
          ? "rgba(255,255,255,0.7)"
          : lbl.isComp ? "rgba(8,71,94,0.6)"
          : (isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)");
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
        // Label background
        const bgFill = lbl.isSub
          ? "rgba(255,255,255,0.97)"
          : lbl.isComp ? "rgba(8,71,94,0.92)"
          : (isDark ? "rgba(12,20,32,0.78)" : "rgba(255,255,255,0.86)");
        ctx.fillStyle = bgFill;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(px, py, lw, LH, 3);
        else ctx.rect(px, py, lw, LH);
        ctx.fill();
        // Subject: draw a colored left accent bar
        if (lbl.isSub) {
          ctx.fillStyle = "#0c7ba1";
          ctx.fillRect(px, py, 3, LH);
        }
        // Text
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = lbl.isSub
          ? "rgba(255,255,255,0.6)"
          : lbl.isComp ? "rgba(4,31,43,0.4)"
          : (isDark ? "rgba(12,20,32,0.5)" : "rgba(255,255,255,0.7)");
        ctx.strokeText(lbl.name, px + PAD_H + (lbl.isSub ? 3 : 0), py + LH / 2);
        ctx.fillStyle = lbl.isSub
          ? "rgba(8,71,94,0.97)"
          : lbl.isComp ? "rgba(255,255,255,0.97)"
          : (isDark ? "rgba(220,235,248,0.97)" : "rgba(20,24,34,0.92)");
        ctx.fillText(lbl.name, px + PAD_H + (lbl.isSub ? 3 : 0), py + LH / 2);
        ctx.restore();
      };

      // Collect on-screen candidates with apex + screen span
      const candidates = [];
      for (const d of drawn) {
        const isComp = !!(highlightCompetitors && peerIds && peerIds.has(d.row.id));
        const isSub = !!(highlightCompetitors && d.row.id === selectedBuildingId);
        // When highlighting, only show peer/subject labels
        if (highlightCompetitors && !isComp && !isSub) continue;
        const name = (d.row.building_name || (d.row.address ? d.row.address.split(/[\n,]/)[0] : "")).trim();
        if (!name) continue;
        let apexY = Infinity, apexX = 0, xMin = Infinity, xMax = -Infinity;
        for (const ring of d.rings) {
          for (const pt of ring) {
            if (pt[1] < apexY) { apexY = pt[1]; apexX = pt[0]; }
            if (pt[0] < xMin) xMin = pt[0];
            if (pt[0] > xMax) xMax = pt[0];
          }
        }
        if (apexY === Infinity) continue;
        if (apexX < -40 || apexX > canvasW + 40 || apexY < -40 || apexY > canvasH + 40) continue;
        const screenSpan = xMax - xMin;
        if (screenSpan < 6) continue;
        candidates.push({
          name: name.length > 30 ? name.slice(0, 28) + "…" : name,
          apexX, apexY,
          height: num(d.row.height) || 0,
          screenSpan,
          isComp,
          isSub,
        });
      }

      if (highlightCompetitors) {
        // Show ALL competitor labels — no cap, no overlap check
        for (const lbl of candidates) {
          const tw = ctx.measureText(lbl.name).width;
          const lw = tw + PAD_H * 2;
          drawLabel(lbl, lbl.apexX - lw / 2, lbl.apexY - LGAP - LH, lw);
        }
      } else {
        // Score by height × screen span so zoomed-in view gets relevant labels
        candidates.sort((a, b) => {
          const sA = a.height * Math.max(1, a.screenSpan);
          const sB = b.height * Math.max(1, b.screenSpan);
          return sB - sA;
        });
        const nc = candidates.length;
        const maxLabels = nc <= 10 ? nc : nc <= 25 ? 20 : nc <= 60 ? 15 : 12;
        const boxes = [];
        const overlaps = (x, y, w, h) => boxes.some(
          (b) => x < b.x + b.w + 3 && x + w + 3 > b.x && y < b.y + b.h + 2 && y + h + 2 > b.y
        );
        for (const lbl of candidates.slice(0, maxLabels)) {
          const tw = ctx.measureText(lbl.name).width;
          const lw = tw + PAD_H * 2;
          const bx = lbl.apexX - lw / 2;
          const by = lbl.apexY - LGAP - LH;
          let px = null, py = null;
          for (const [dx, dy] of [
            [0, 0], [0, -(LH + 5)], [0, -(LH + 5) * 2],
            [lw * 0.5, 0], [-lw * 0.5, 0],
            [lw * 0.5, -(LH + 5)], [-lw * 0.5, -(LH + 5)],
          ]) {
            if (!overlaps(bx + dx, by + dy, lw, LH)) { px = bx + dx; py = by + dy; break; }
          }
          if (px === null) continue;
          boxes.push({ x: px, y: py, w: lw, h: LH });
          drawLabel(lbl, px, py, lw);
        }
      }
    }

    drawnRef.current = drawn;
  }, [geom, encoder, size, hover, meanSecLat, getTile, tileTick, baseDef, isDark, competitorMap, highlightCompetitors, showLabels, peerIds, selectedBuildingId]);

  // Keep drawRef always pointing at latest draw so requestDraw never goes stale
  useEffect(() => { drawRef.current = draw; });

  const requestDraw = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (drawRef.current) drawRef.current();
    });
  }, []); // stable ref — never recreated, always calls latest draw

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      setSize({ w: Math.max(320, Math.round(cr.width)), h: Math.max(360, Math.round(cr.height)) });
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    canvas.style.width = size.w + "px";
    canvas.style.height = size.h + "px";
  }, [size]);

  useEffect(() => {
    fit();
    requestDraw();
  }, [geoKey]); // eslint-disable-line

  useEffect(() => {
    if (!focusBuildingId) return;
    const match = geom.find((g) => g.row.id === focusBuildingId);
    if (!match || !camRef.current) return;
    const cam = camRef.current;
    let minX = Infinity, maxX = -Infinity;
    for (const ring of match.rings) {
      for (const p of ring) {
        if (p[0] < minX) minX = p[0];
        if (p[0] > maxX) maxX = p[0];
      }
    }
    const spanX = Math.max(maxX - minX, 1);
    const targetZoom = (size.w * 0.25) / spanX;
    cam.cx = match.cx;
    cam.cy = match.cy;
    cam.zoom = Math.max(cam.zoom, targetZoom);
    requestDraw();
  }, [focusBuildingId]); // eslint-disable-line

  useEffect(() => {
    if (!camRef.current) fit();
    requestDraw();
  }, [encoder, size, hover, draw]); // eslint-disable-line

  const onPointerDown = (e) => {
    const pan = e.button === 2 || e.button === 1 || e.shiftKey;
    if (pan) e.preventDefault();
    dragRef.current = { x: e.clientX, y: e.clientY, moved: false, mode: pan ? "pan" : "orbit" };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.x;
      const dy = e.clientY - dragRef.current.y;
      dragRef.current.x = e.clientX;
      dragRef.current.y = e.clientY;
      if (Math.hypot(dx, dy) > 3) dragRef.current.moved = true;
      const cam = camRef.current;
      if (cam) {
        if (dragRef.current.mode === "pan") {
          const cosB = Math.cos(cam.bearing), sinB = Math.sin(cam.bearing);
          const cosP = Math.max(0.05, Math.cos(cam.pitch));
          const dP = dx / cam.zoom;
          const dQ = -dy / (cam.zoom * cosP);
          const du = dP * cosB + dQ * sinB;
          const dv = -dP * sinB + dQ * cosB;
          cam.cx -= du;
          cam.cy -= dv;
        } else {
          cam.bearing += dx * 0.006;
          cam.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, cam.pitch + dy * 0.004));
        }
        if (hover) setHover(null);
        requestDraw();
      }
      return;
    }
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const drawn = drawnRef.current;
    let found = null;
    for (let i = drawn.length - 1; i >= 0; i--) {
      const d = drawn[i];
      for (const ring of d.rings) {
        if (pointInRing([mx, my], ring)) { found = d.row; break; }
      }
      if (!found && d.wallQuads) {
        for (const quad of d.wallQuads) {
          if (pointInRing([mx, my], quad)) { found = d.row; break; }
        }
      }
      if (found) break;
    }
    if ((found && (!hover || hover.row.id !== found.id)) || (!found && hover)) {
      setHover(found ? { row: found, x: mx, y: my } : null);
    } else if (found && hover) {
      setHover({ row: found, x: mx, y: my });
    }
  };
  const onPointerUp = (e) => {
    const wasDrag = dragRef.current?.moved;
    const lastHover = hover;
    dragRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}
    if (!wasDrag && onBuildingClick) onBuildingClick(lastHover?.row ?? null);
  };
  const onWheel = (e) => {
    e.preventDefault();
    const cam = camRef.current;
    if (!cam) return;
    const f = Math.exp(-e.deltaY * 0.0012);
    cam.zoom = Math.max(cam.zoom * 0.2, Math.min(cam.zoom * 5, cam.zoom * f));
    requestDraw();
  };

  return h(
    "div",
    { ref: wrapRef, className: "map3d-wrap", "data-testid": "map3d" },
    h("canvas", {
      ref: canvasRef,
      style: { display: "block", cursor: dragRef.current ? "grabbing" : "grab", touchAction: "none" },
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerLeave: () => { dragRef.current = null; setHover(null); },
      onWheel,
      onContextMenu: (e) => e.preventDefault(),
    }),
    hover ? h(BuildingTooltip, { hover, w: size.w, h: size.h, competitorMap }) : null,
  );
}

function cleanOwner(raw) {
  if (!raw || typeof raw !== "string") return null;
  const KEEP_UPPER = /^(PTY|LTD|LLC|RE|UOL|ISPT|GMPL|P\/L|ACT|NSW|VIC|QLD|WA|SA|TAS|NZC)$/;
  const parts = raw
    .split(/\s*\|\s*/)
    .map((p) => p.trim())
    .filter((p) => p && !/^(unknown|unspecified)$/i.test(p));
  if (!parts.length) return null;
  return parts
    .map((part) => {
      const letters = part.match(/[a-zA-Z]/g) || [];
      const isAllCaps = letters.length > 0 && letters.every((c) => c >= "A" && c <= "Z");
      if (!isAllCaps) return part;
      return part.replace(/\b([A-Z/]+)\b/g, (w) =>
        KEEP_UPPER.test(w) ? w : w[0] + w.slice(1).toLowerCase(),
      );
    })
    .join(" · ") || null;
}

function field(label, value) {
  if (value == null || value === "" || value === "--") return null;
  return h(
    "div",
    { className: "tt-row" },
    h("span", { className: "tt-k" }, label),
    h("span", { className: "tt-v" }, String(value)),
  );
}

function BuildingTooltip({ hover, w, h: H, competitorMap }) {
  const r = hover.row;
  const comp = competitorMap ? competitorMap.get(r.id) : null;
  const flip = hover.x > w - 280;
  const below = hover.y < 220;
  const style = {
    left: flip ? hover.x - 12 : hover.x + 14,
    top: below ? hover.y + 16 : hover.y - 12,
    transform: `translate(${flip ? "-100%" : "0"}, ${below ? "0" : "-100%"})`,
  };
  const geo = [r.geo_1, r.geo_2, r.geo_3].filter(Boolean).join(" › ");
  const nb = (v) => (v == null || v === "" ? null : `${v} ★`);
  return h(
    "div",
    { className: "map-tooltip", style },
    h("div", { className: "tt-title" }, r.building_name || r.address || "Building"),
    r.address && r.building_name ? h("div", { className: "tt-sub" }, r.address) : null,
    geo ? h("div", { className: "tt-geo" }, geo) : null,
    h(
      "div",
      { className: "tt-grid" },
      field("Grade", r.property_grade),
      field("Category", r.property_category),
      field("Owner", cleanOwner(r.owner)),
      field("Developer", r.developer),
      field("Area", r.building_area != null ? `${Math.round(r.building_area).toLocaleString()} sqm` : null),
      field("Levels", r.NumberOfLevels > 0 ? r.NumberOfLevels : null),
      field("Completed", r.completion_year),
      field("Height", r.height != null ? `${Math.round(r.height)} m` : null),
      field("NABERS energy", nb(r.nabers_energy_rating)),
      field("NABERS water", nb(r.nabers_water_rating)),
      field("NABERS IEQ", nb(r.nabers_ieq_rating)),
      field("Green Star", nb(r.green_star_rating)),
    ),
    comp ? h(
      "div",
      { className: "tt-competitor" },
      h("div", { className: "tt-comp-title" }, "Competitor"),
      h(
        "div",
        { className: "tt-grid" },
        field("Status", comp.status),
        field("Vacancy", comp.vacancy_pct != null ? `${Math.round(Number(comp.vacancy_pct))}%` : null),
        field("Vacant area", comp.vacant_area ? `${Math.round(Number(comp.vacant_area)).toLocaleString()} sqm` : null),
        field("Electrification", comp.electrification),
        field("NABERS", comp.nabers ? `${comp.nabers} ★` : null),
        field("NABERS expiry", comp.nabers_expiry ? comp.nabers_expiry.slice(0, 10) : null),
        field("Net zero tenants", comp.net_zero_tenants),
        field("Net zero (2)", comp.net_zero_tenants_2),
        field("Net zero (3)", comp.net_zero_tenants_3),
      ),
    ) : null,
  );
}

const cssCache = {};
function getCss(name, fallback) {
  if (cssCache[name]) return cssCache[name];
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    cssCache[name] = v || fallback;
    return cssCache[name];
  } catch (e) {
    return fallback;
  }
}
