/**
 * corridor_strip.js - 1.5D Linear Track Strip (window.CorridorStrip)
 *
 * Dedicated Beijing-Tianjin Railway Corridor Visualization Component.
 * Renders an authentic, high-craft 4-track railway schematic (Down Main, Down Siding,
 * Up Main, Up Siding) with real-time train side-profile sprites, siding turnout divergence,
 * multi-level collision-free callout pills, live station telemetry, and spotlight mini-card.
 *
 * Chinese Railway HUD System (CR-HUD)
 */

(function (global) {
  'use strict';

  // =========================================================================
  // 1. Math, Geometry, and Spacing Utilities
  // =========================================================================

  /** Normalizes station name string */
  function normStName(st) {
    if (!st) return '';
    if (typeof st === 'string') return st.trim();
    return (st.name || '').trim();
  }

  /**
   * Smoothstep interpolation curve: 3x^2 - 2x^3
   * Provides zero acceleration at station start and smooth deceleration into stop.
   */
  function smoothstep(t) {
    const x = Math.max(0, Math.min(1, t));
    return x * x * (3 - 2 * x);
  }

  /**
   * Resolves rolling stock model key for a train object or string.
   */
  function resolveModel(tr) {
    if (!tr) return 'CR400AF';
    if (typeof tr === 'string') return tr.trim();
    if (tr.m) return tr.m;
    if (tr.model) return tr.model;
    if (tr.ts) return tr.ts;
    const c = ((tr.c || tr.code || '') + '').toUpperCase();
    if (c.startsWith('G')) return 'CR400AF';
    if (c.startsWith('C')) return 'CRH3C';
    if (c.startsWith('D')) return 'CRH2A';
    if (c.startsWith('Z')) return 'HXD1D';
    if (c.startsWith('T')) return 'HXD3D';
    if (c.startsWith('K')) return 'SS9G';
    return 'CR400AF';
  }

  /**
   * Checks whether a given train matches a target (train object or code string).
   */
  function isTrainMatch(tr, target) {
    if (!tr || !target) return false;
    if (tr === target) return true;
    if (typeof target === 'string') {
      const q = target.trim();
      if (!q) return false;
      const c = (tr.c || tr.code || tr.train_no || '') + '';
      if (c === q || tr.no === q) return true;
      const parts = c.split('/');
      if (parts.includes(q)) return true;
      if (c.startsWith(q)) return true;
      return false;
    }
    if (typeof target === 'object') {
      if (target.tr && target.tr === tr) return true;
      const c1 = (tr.c || tr.code || '') + '';
      const c2 = (target.c || target.code || '') + '';
      if (c1 && c2 && (c1 === c2 || c1.split('/')[0] === c2.split('/')[0])) return true;
      if (tr.no && target.no && tr.no === target.no) return true;
    }
    return false;
  }

  /**
   * Lays out a slice of stations [0 .. m-1] proportionally onto [xStart, xEnd]
   * while strictly pinning xs[0] = xStart and xs[m-1] = xEnd and enforcing minGap.
   */
  function layoutSegmentProportional(segStations, xStart, xEnd, minGap) {
    const m = segStations.length;
    if (m === 0) return [];
    if (m === 1) return [Math.round(xStart * 10) / 10];

    const spanW = Math.max(10, xEnd - xStart);
    const effGap = Math.min(minGap, Math.floor(spanW / Math.max(1, m - 1)));
    const km0 = segStations[0].km || 0;
    const kmLast = segStations[m - 1].km || 1;
    const totalKm = Math.max(0.1, kmLast - km0);

    const xs = segStations.map(st => xStart + ((st.km - km0) / totalKm) * spanW);
    xs[0] = xStart;
    xs[m - 1] = xEnd;

    // Forward pass: enforce effGap from left to right (keeping xs[0] pinned at xStart)
    for (let i = 1; i < m - 1; i++) {
      if (xs[i] < xs[i - 1] + effGap) {
        xs[i] = xs[i - 1] + effGap;
      }
    }

    // Backward pass: enforce effGap from right to left (keeping xs[m-1] pinned at xEnd)
    for (let i = m - 2; i >= 1; i--) {
      if (xs[i] > xs[i + 1] - effGap) {
        xs[i] = xs[i + 1] - effGap;
      }
    }

    xs[0] = xStart;
    xs[m - 1] = xEnd;
    return xs.map(x => Math.round(x * 10) / 10);
  }

  /**
   * Computes station X positions across [padL, totalW - padR].
   * If the corridor contains a Tianjin hub station (天津 / 天津南 / 天津西),
   * pins the Tianjin station at a fixed horizontal anchor (64% of usable width)
   * so all 3 corridors have their Tianjin stations vertically aligned 1-to-1.
   */
  function computeStationX(stations, totalW, padL = 56, padR = 56, minGap = 62) {
    const n = stations.length;
    if (n === 0) return [];
    if (n === 1) return [Math.round(totalW / 2)];

    const xLeft = padL;
    const xRight = Math.max(padL + 100, totalW - padR);
    const tjIdx = stations.findIndex(st => st && (st.isTianjinHub || /^天津/.test(st.name || '')));

    if (tjIdx > 0) {
      const xTianjin = Math.round((xLeft + (xRight - xLeft) * 0.64) * 10) / 10;
      const leftXs = layoutSegmentProportional(stations.slice(0, tjIdx + 1), xLeft, xTianjin, minGap);
      if (tjIdx < n - 1) {
        const rightXs = layoutSegmentProportional(stations.slice(tjIdx), xTianjin, xRight, minGap);
        return leftXs.concat(rightXs.slice(1));
      }
      return leftXs;
    }

    return layoutSegmentProportional(stations, xLeft, xRight, minGap);
  }

  /**
   * Creates a piecewise-linear mapping function from kilometer to stage X coordinate.
   * Guarantees a train at km = stations[i].km sits at exact pixel stationX[i].
   */
  function createKmToX(stations, xs, totalW, padL = 56, padR = 56) {
    const n = stations.length;
    if (n === 0) return () => padL;
    if (n === 1) return () => xs[0];

    return function kmToX(km) {
      if (km == null || isNaN(km)) return xs[0];

      // Left of first station: extrapolate using first segment scale
      if (km <= stations[0].km) {
        const dKm = stations[1].km - stations[0].km;
        if (dKm > 0) {
          const slope = (xs[1] - xs[0]) / dKm;
          return Math.max(12, xs[0] + (km - stations[0].km) * slope);
        }
        return xs[0];
      }

      // Right of last station: extrapolate using last segment scale
      if (km >= stations[n - 1].km) {
        const dKm = stations[n - 1].km - stations[n - 2].km;
        if (dKm > 0) {
          const slope = (xs[n - 1] - xs[n - 2]) / dKm;
          return Math.min(totalW - 12, xs[n - 1] + (km - stations[n - 1].km) * slope);
        }
        return xs[n - 1];
      }

      // Piecewise linear interpolation within matching interval [i, i+1]
      for (let i = 0; i < n - 1; i++) {
        const k0 = stations[i].km;
        const k1 = stations[i + 1].km;
        if (km >= k0 && km <= k1) {
          const span = k1 - k0;
          const frac = span > 0 ? (km - k0) / span : 0;
          return xs[i] + frac * (xs[i + 1] - xs[i]);
        }
      }

      return xs[n - 1];
    };
  }

  // =========================================================================
  // 2. Train Side-Profile Icon Helpers
  // =========================================================================

  /** Clean standalone fallback SVG for half car */
  function fallbackHalfSvg(tr, h = 20) {
    const scale = h / 24;
    const w = Math.round(72 * scale);
    const code = (tr && (tr.c || tr.code || '')) + '';
    const isHighSpeed = /^[GCD]/i.test(code);
    const fill = isHighSpeed ? '#38bdf8' : '#15803d';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 96 32">`
      + `<path d="M4,24 L12,8 L32,4.5 L94,4.5 L94,26.5 L4,26.5 Z" fill="${fill}"/>`
      + `<rect x="18" y="7" width="10" height="4" rx="0.5" fill="#0f172a"/>`
      + `<rect x="36" y="8" width="50" height="4" rx="0.5" fill="#cbd5e1" fill-opacity="0.4"/>`
      + `<circle cx="20" cy="28.5" r="2.5" fill="#334155"/>`
      + `<circle cx="80" cy="28.5" r="2.5" fill="#334155"/>`
      + `</svg>`;
  }

  /** Clean standalone fallback SVG for full car */
  function fallbackFullSvg(tr, h = 22) {
    const scale = h / 24;
    const w = Math.round(110 * scale);
    const code = (tr && (tr.c || tr.code || '')) + '';
    const isHighSpeed = /^[GCD]/i.test(code);
    const fill = isHighSpeed ? '#38bdf8' : '#15803d';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 140 32">`
      + `<path d="M4,24 L14,8 L36,4.5 L136,4.5 L136,26.5 L4,26.5 Z" fill="${fill}"/>`
      + `<rect x="20" y="7" width="12" height="4" rx="0.5" fill="#0f172a"/>`
      + `<rect x="40" y="8" width="90" height="4" rx="0.5" fill="#cbd5e1" fill-opacity="0.4"/>`
      + `<circle cx="24" cy="28.5" r="2.5" fill="#334155"/>`
      + `<circle cx="120" cy="28.5" r="2.5" fill="#334155"/>`
      + `</svg>`;
  }

  /** Clean standalone fallback SVG for marker */
  function fallbackMarkerSvg(tr, isDown) {
    const code = (tr && (tr.c || tr.code || '')) + '';
    const isHighSpeed = /^[GCD]/i.test(code);
    const fill = isHighSpeed ? '#38bdf8' : '#15803d';
    const flip = isDown ? ' transform="scale(-1,1) translate(-32,0)"' : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="16" viewBox="0 0 32 16">`
      + `<g${flip}><path d="M2,14 L8,3 L30,3 L30,14 Z" fill="${fill}" stroke="#334155" stroke-width="1"/></g>`
      + `</svg>`;
  }

  /**
   * Generates train SVG HTML string according to iconMode:
   * - 'half' (default): 60x20px crisp side-profile head car
   * - 'full': 96x22px full car side-profile
   * - 'marker': 32x16px livery marker
   */
  function getTrainIconSvg(tr, iconMode = 'half', isDown = true, height = 20, codeStr = '') {
    const m = (typeof window !== 'undefined' && typeof window.markerModelForTrain === 'function' && iconMode === 'marker')
      ? window.markerModelForTrain(tr)
      : resolveModel(tr);
    const code = codeStr || ((tr && (tr.c || tr.code || '')) + '').split('/')[0] || 'G1';

    if (iconMode === 'marker') {
      const fnWithCode = (typeof global !== 'undefined' && global.emuMarkerWithCodeSvg)
        || (typeof window !== 'undefined' && window.emuMarkerWithCodeSvg);
      if (typeof fnWithCode === 'function') {
        try {
          const scale = (height || 16) / 10.5;
          const s = fnWithCode(m, code, scale, isDown);
          if (s) return s;
        } catch (e) {}
      }
      const fn = (typeof global !== 'undefined' && global.emuMarkerSvg)
        || (typeof window !== 'undefined' && window.emuMarkerSvg);
      if (typeof fn === 'function') {
        try {
          const s = fn(m, 1.35, isDown);
          if (s) return s;
        } catch (e) {}
      }
      return fallbackMarkerSvg(tr, isDown);
    }

    if (iconMode === 'full') {
      const fullFn = (typeof global !== 'undefined' && global.fullTrainSideSvg)
        || (typeof window !== 'undefined' && window.fullTrainSideSvg);
      if (typeof fullFn === 'function') {
        try {
          const s = fullFn(tr, height || 22);
          if (s) return s;
        } catch (e) {}
      }
      const emuFn = (typeof global !== 'undefined' && global.emuSvg)
        || (typeof window !== 'undefined' && window.emuSvg);
      if (typeof emuFn === 'function') {
        try {
          const s = emuFn(m, (height || 22) / 32, false);
          if (s) return s;
        } catch (e) {}
      }
      return fallbackFullSvg(tr, height || 22);
    }

    // Default 'half' mode
    const halfFn = (typeof global !== 'undefined' && global.emuHalfSvg)
      || (typeof window !== 'undefined' && window.emuHalfSvg);
    if (typeof halfFn === 'function') {
      try {
        const s = halfFn(m, height || 20);
        if (s) return s;
      } catch (e) {}
    }
    const locoFn = (typeof global !== 'undefined' && global.locoHalfSvg)
      || (typeof window !== 'undefined' && window.locoHalfSvg);
    if (typeof locoFn === 'function') {
      try {
        const s = locoFn(tr, height || 20);
        if (s) return s;
      } catch (e) {}
    }
    const emuFn = (typeof global !== 'undefined' && global.emuSvg)
      || (typeof window !== 'undefined' && window.emuSvg);
    if (typeof emuFn === 'function') {
      try {
        const s = emuFn(m, (height || 20) / 24, true);
        if (s) return s;
      } catch (e) {}
    }
    return fallbackHalfSvg(tr, height || 20);
  }

  // =========================================================================
  // 3. Fallback Train State Engine (when CorridorData is absent or standalone)
  // =========================================================================

  /**
   * Built-in fallback to compute train state at time T if CorridorData.getTrainStateAt is unavailable.
   */
  function fallbackGetTrainState(entry, T, stations) {
    if (!entry) return null;
    const tr = entry.tr || entry;
    const stops = entry.stops || entry.points || tr.s || [];
    if (!stops || stops.length < 2) return null;

    // Fast bounds filter
    const minT = entry.minT != null ? entry.minT : (entry.points && entry.points[0] ? entry.points[0].dep - 5 : null);
    const maxT = entry.maxT != null ? entry.maxT : (entry.points && entry.points[entry.points.length - 1] ? entry.points[entry.points.length - 1].arr + 3 : null);
    if (minT != null && maxT != null && (T < minT || T > maxT)) return null;

    // Normalize stops
    const pts = [];
    for (let i = 0; i < stops.length; i++) {
      const s = stops[i];
      let name, arr, dep, km = null, isWait = false;
      if (Array.isArray(s)) {
        name = s[0];
        arr = Number(s[1]);
        dep = Number(s[2]);
      } else {
        name = s.name;
        arr = Number(s.arr != null ? s.arr : s.dep);
        dep = Number(s.dep != null ? s.dep : s.arr);
        km = s.km;
        isWait = !!s.isWait;
      }
      if (km == null && stations) {
        const matched = stations.find(st => st.name === name);
        if (matched) km = matched.km;
      }
      if (km != null && !isNaN(arr) && !isNaN(dep)) {
        pts.push({
          name,
          km,
          arr: Math.min(arr, dep),
          dep: Math.max(arr, dep),
          isWait: isWait || (dep - arr >= 10)
        });
      }
    }

    if (pts.length < 2) return null;
    const isDown = pts[pts.length - 1].km > pts[0].km;
    const dir = entry.dir || (isDown ? 'down' : 'up');

    // Stopped at station
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (T >= p.arr && T <= p.dep) {
        return {
          tr,
          code: ((tr.c || tr.code || '') + '').split('/')[0],
          dir,
          km: p.km,
          kmh: 0,
          isStopped: true,
          isWait: p.isWait,
          sidingRatio: 1.0,
          station: p.name,
          from: pts[0].name,
          to: pts[pts.length - 1].name,
          model: tr.m || tr.model || tr.ts || ''
        };
      }
    }

    // Running between stations
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      if (T > p0.dep && T < p1.arr) {
        const dur = p1.arr - p0.dep;
        const frac = dur > 0 ? (T - p0.dep) / dur : 0;
        const smoothFrac = smoothstep(frac);
        const km = p0.km + smoothFrac * (p1.km - p0.km);
        const dist = Math.abs(p1.km - p0.km);
        const kmh = dur > 0 ? Math.round(dist / (dur / 60)) : 250;

        // Turnout divergence transition
        let sidingRatio = 0;
        const turnTime = 1.2;
        if (T - p0.dep < turnTime) {
          sidingRatio = Math.max(0, 1 - (T - p0.dep) / turnTime);
        } else if (p1.arr - T < turnTime) {
          sidingRatio = Math.max(0, 1 - (p1.arr - T) / turnTime);
        }

        return {
          tr,
          code: ((tr.c || tr.code || '') + '').split('/')[0],
          dir,
          km,
          kmh,
          isStopped: false,
          isWait: false,
          sidingRatio,
          station: null,
          nextStation: p1.name,
          from: pts[0].name,
          to: pts[pts.length - 1].name,
          model: tr.m || tr.model || tr.ts || ''
        };
      }
    }

    return null;
  }

  /**
   * Resolves train state using window.CorridorData if available, else built-in fallback.
   */
  function resolveTrainState(entry, T, stations) {
    if (typeof global !== 'undefined' && global.CorridorData && typeof global.CorridorData.getTrainStateAt === 'function') {
      try {
        const st = global.CorridorData.getTrainStateAt(entry, T, { ports: true });
        if (st) {
          if (st.sidingRatio == null) {
            st.sidingRatio = st.isStopped ? 1.0 : 0.0;
          }
          return st;
        }
      } catch (e) {}
    }
    if (typeof window !== 'undefined' && window.CorridorData && typeof window.CorridorData.getTrainStateAt === 'function') {
      try {
        const st = window.CorridorData.getTrainStateAt(entry, T, { ports: true });
        if (st) {
          if (st.sidingRatio == null) {
            st.sidingRatio = st.isStopped ? 1.0 : 0.0;
          }
          return st;
        }
      } catch (e) {}
    }
    return fallbackGetTrainState(entry, T, stations);
  }

  /**
   * Assigns collision-free vertical staggering levels (0, 1, 2) to active trains
   * using greedy interval scheduling when two trains on the same track are within threshold px.
   */
  function assignStaggerLevels(trainList, threshold = 64) {
    const occupiedUntil = [-Infinity, -Infinity, -Infinity];

    for (let i = 0; i < trainList.length; i++) {
      const item = trainList[i];
      const x = item.x;
      let chosenLevel = 0;
      let found = false;

      // 优先沿用上一帧的层级，避免车一动就整格换层
      const pl = item.prevLevel;
      if (pl != null && pl >= 0 && pl < 3 && x - occupiedUntil[pl] >= threshold) {
        chosenLevel = pl;
        found = true;
      }

      for (let lvl = 0; !found && lvl < 3; lvl++) {
        if (x - occupiedUntil[lvl] >= threshold) {
          chosenLevel = lvl;
          found = true;
          break;
        }
      }

      if (!found) {
        let minX = Infinity;
        for (let lvl = 0; lvl < 3; lvl++) {
          if (occupiedUntil[lvl] < minX) {
            minX = occupiedUntil[lvl];
            chosenLevel = lvl;
          }
        }
      }

      occupiedUntil[chosenLevel] = x + threshold;
      item.level = chosenLevel;
    }
  }

  // =========================================================================
  // 4. CSS Injection
  // =========================================================================

  function injectCorridorStripStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('corridor-strip-styles')) return;

    const style = document.createElement('style');
    style.id = 'corridor-strip-styles';
    style.textContent = `
      .corridor-strip-root {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        position: relative;
        box-sizing: border-box;
        overflow: hidden;
        user-select: none;
        border-radius: 10px;
        background: #090e1a;
        color: #f1f5f9;
        border: 1px solid rgba(148, 163, 184, 0.16);
        box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.38);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      }
      .corridor-strip-root.theme-light {
        background: #ffffff;
        color: #0f172a;
        border: 1px solid #e2e8f0;
        box-shadow: 0 4px 16px -2px rgba(0, 0, 0, 0.08);
      }

      /* ===== Header Bar ===== */
      .cs-header-bar {
        height: 22px;
        min-height: 22px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 8px;
        gap: 6px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.14);
        background: linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.75) 100%);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 20;
      }
      .corridor-strip-root.theme-light .cs-header-bar {
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
      }

      .cs-header-left {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }
      .cs-badge-pill {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 1px 6px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.2px;
        border: 1px solid rgba(56, 189, 248, 0.35);
        background: rgba(56, 189, 248, 0.12);
        color: #38bdf8;
      }
      .cs-speed-tag {
        font-size: 10px;
        font-family: ui-monospace, monospace;
        font-weight: 600;
        padding: 1px 5px;
        border-radius: 3px;
        background: rgba(148, 163, 184, 0.15);
        color: #94a3b8;
      }
      .corridor-strip-root.theme-light .cs-speed-tag {
        background: #f1f5f9;
        color: #64748b;
      }
      .cs-route-sub {
        font-size: 11px;
        color: #94a3b8;
        white-space: nowrap;
      }
      .corridor-strip-root.theme-light .cs-route-sub {
        color: #64748b;
      }

      /* Segmented switch buttons */
      .cs-switch-group {
        display: inline-flex;
        align-items: center;
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid rgba(148, 163, 184, 0.25);
        border-radius: 5px;
        padding: 1px;
        margin-left: 4px;
      }
      .corridor-strip-root.theme-light .cs-switch-group {
        background: #e2e8f0;
        border-color: #cbd5e1;
      }
      .cs-switch-btn {
        background: transparent;
        border: none;
        outline: none;
        padding: 2px 7px;
        font-size: 10.5px;
        font-weight: 600;
        color: #94a3b8;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .cs-switch-btn:hover {
        color: #f1f5f9;
      }
      .cs-switch-btn.active {
        background: #38bdf8;
        color: #090e1a;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
      }
      .corridor-strip-root.theme-light .cs-switch-btn {
        color: #64748b;
      }
      .corridor-strip-root.theme-light .cs-switch-btn.active {
        background: #0284c7;
        color: #ffffff;
      }

      /* Telemetry Badges */
      .cs-header-telemetry {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: #94a3b8;
        white-space: nowrap;
      }
      .corridor-strip-root.theme-light .cs-header-telemetry {
        color: #64748b;
      }
      .cs-telemetry-pill b {
        font-family: ui-monospace, monospace;
        font-weight: 700;
        color: #f1f5f9;
      }
      .corridor-strip-root.theme-light .cs-telemetry-pill b {
        color: #0f172a;
      }
      .cs-telemetry-pill.down b { color: #38bdf8; }
      .cs-telemetry-pill.up b { color: #fbbf24; }
      .cs-telemetry-pill.stop b { color: #f43f5e; }
      .corridor-strip-root.theme-light .cs-telemetry-pill.down b { color: #0284c7; }
      .corridor-strip-root.theme-light .cs-telemetry-pill.up b { color: #d97706; }
      .corridor-strip-root.theme-light .cs-telemetry-pill.stop b { color: #e11d48; }
      .cs-telemetry-div {
        opacity: 0.35;
      }

      /* Spotlight Mini-Card */
      .cs-header-spotlight {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 2px 8px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 5px;
        cursor: pointer;
        transition: all 0.15s ease;
        max-width: 320px;
        flex-shrink: 0;
      }
      .cs-header-spotlight:hover {
        background: rgba(56, 189, 248, 0.1);
        border-color: rgba(56, 189, 248, 0.4);
      }
      .corridor-strip-root.theme-light .cs-header-spotlight {
        background: #f1f5f9;
        border-color: #e2e8f0;
      }
      .corridor-strip-root.theme-light .cs-header-spotlight:hover {
        background: #e2e8f0;
        border-color: #cbd5e1;
      }
      .cs-spotlight-svg {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 22px;
      }
      .cs-spotlight-meta {
        display: flex;
        flex-direction: column;
        line-height: 1.15;
      }
      .cs-spotlight-row1 {
        display: flex;
        align-items: baseline;
        gap: 5px;
      }
      .cs-spotlight-code {
        font-weight: 800;
        font-size: 12px;
        letter-spacing: 0.2px;
        color: #f1f5f9;
      }
      .corridor-strip-root.theme-light .cs-spotlight-code {
        color: #0f172a;
      }
      .cs-spotlight-stock {
        font-size: 9.5px;
        padding: 0.5px 3.5px;
        border-radius: 2px;
        background: rgba(56, 189, 248, 0.18);
        color: #38bdf8;
        font-family: ui-monospace, monospace;
        font-weight: 600;
      }
      .corridor-strip-root.theme-light .cs-spotlight-stock {
        background: rgba(2, 132, 199, 0.12);
        color: #0284c7;
      }
      .cs-spotlight-status {
        font-size: 9.5px;
        font-weight: 600;
        padding: 0.5px 4.5px;
        border-radius: 3px;
        background: rgba(34, 197, 94, 0.18);
        color: #4ade80;
      }
      .cs-spotlight-status.wait {
        background: rgba(239, 68, 68, 0.2);
        color: #f87171;
      }
      .cs-spotlight-status.stop {
        background: rgba(245, 158, 11, 0.2);
        color: #fbbf24;
      }
      .cs-spotlight-od {
        font-size: 10px;
        color: #94a3b8;
        white-space: nowrap;
      }
      .corridor-strip-root.theme-light .cs-spotlight-od {
        color: #64748b;
      }
      .cs-spotlight-idle {
        font-size: 11px;
        color: #94a3b8;
        padding: 2px 6px;
      }

      /* ===== Schematic 4-Track Stage ===== */
      .cs-stage {
        flex: 1;
        position: relative;
        overflow: hidden;
        cursor: default;
      }
      .cs-stage-svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
      }

      /* Station Headers Layer */
      .cs-station-headers-layer {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 40px;
        pointer-events: none;
        z-index: 5;
      }
      .cs-station-col {
        position: absolute;
        top: 2px;
        transform: translateX(-50%);
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 3px;
        pointer-events: auto;
        white-space: nowrap;
      }
      .cs-st-live-badge {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        font-size: 8.5px;
        font-weight: 700;
        padding: 0.5px 3.5px;
        border-radius: 3px;
        background: rgba(244, 63, 94, 0.2);
        color: #fb7185;
        border: 1px solid rgba(244, 63, 94, 0.35);
      }
      .cs-st-pulse-dot {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: #f43f5e;
        box-shadow: 0 0 6px #f43f5e;
      }
      .cs-st-name-pill {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        font-size: 9.5px;
        font-weight: 600;
        color: #94a3b8;
        padding: 0px 3.5px;
        border-radius: 3px;
        background: rgba(15, 23, 42, 0.78);
        border: 1px solid rgba(148, 163, 184, 0.15);
        transition: all 0.15s ease;
      }
      .corridor-strip-root.theme-light .cs-st-name-pill {
        color: #475569;
        background: rgba(241, 245, 249, 0.85);
        border-color: #cbd5e1;
      }
      .cs-st-name-pill.major {
        font-size: 10.5px;
        font-weight: 800;
        color: #f8fafc;
        border-color: rgba(148, 163, 184, 0.3);
      }
      .corridor-strip-root.theme-light .cs-st-name-pill.major {
        color: #0f172a;
        border-color: #94a3b8;
      }
      .cs-st-name-pill.is-active {
        border-color: #38bdf8;
        color: #38bdf8;
        box-shadow: 0 0 8px rgba(56, 189, 248, 0.35);
      }

      /* ===== Real-Time Train Sprites Layer ===== */
      .cs-trains-layer {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 10;
      }
      .cs-train-sprite {
        position: absolute;
        left: 0;
        top: 0;
        will-change: transform;
        pointer-events: auto;
        cursor: pointer;
        z-index: 10;
        transition: filter 0.12s ease;
      }
      .cs-train-sprite:hover {
        z-index: 45 !important;
        filter: drop-shadow(0 0 8px rgba(56, 189, 248, 0.6));
      }
      .cs-train-sprite.selected {
        z-index: 60 !important;
        filter: drop-shadow(0 0 10px rgba(56, 189, 248, 0.85));
      }

      .cs-train-icon-wrap {
        position: absolute;
        left: 50%;
        top: 0;
        transform-origin: center center;
      }
      /* Scale Down trains so nose points right (scaleX -1), Up trains nose points left (scaleX 1) */
      .cs-train-sprite.dir-down .cs-train-icon-wrap {
        transform: translate(-50%, -50%) scaleX(-1);
      }
      .cs-train-sprite.dir-up .cs-train-icon-wrap {
        transform: translate(-50%, -50%) scaleX(1);
      }
      .cs-train-sprite.mode-marker .cs-train-icon-wrap {
        transform: translate(-50%, -85%);
      }
      .cs-od-label {
        position: absolute;
        left: 0;
        top: -24px;
        transform: translateX(-50%);
        font-size: 8.5px;
        line-height: 1;
        font-weight: 600;
        white-space: nowrap;
        color: #cbd5e1;
        text-shadow: 0 0 2px rgba(5, 8, 16, 0.95), 0 0 3px rgba(5, 8, 16, 0.85);
        pointer-events: none;
      }
      .cs-train-sprite.mode-marker .cs-od-label {
        top: -31px;
      }
      .corridor-strip-root.theme-light .cs-od-label {
        color: #334155;
        text-shadow: 0 0 2px #fff, 0 0 3px rgba(255, 255, 255, 0.9);
      }

      /* Leader Line */
      .cs-leader-line {
        position: absolute;
        left: 50%;
        width: 1px;
        background: rgba(148, 163, 184, 0.45);
        pointer-events: none;
        transform: translateX(-50%);
      }

      /* Callout Pill */
      .cs-callout-pill {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        display: inline-flex;
        align-items: center;
        gap: 2.5px;
        padding: 0.5px 4px;
        border-radius: 3px;
        background: rgba(15, 23, 42, 0.92);
        border: 1px solid rgba(148, 163, 184, 0.3);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
        white-space: nowrap;
        font-size: 9px;
        line-height: 1.15;
        transition: all 0.12s ease;
      }
      .corridor-strip-root.theme-light .cs-callout-pill {
        background: rgba(255, 255, 255, 0.95);
        border: 1px solid rgba(100, 116, 139, 0.3);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
      }
      .cs-train-sprite.selected .cs-callout-pill {
        border-color: #38bdf8;
        background: rgba(15, 23, 42, 0.96);
        box-shadow: 0 0 10px rgba(56, 189, 248, 0.6);
      }

      .cs-pill-code {
        font-weight: 800;
        letter-spacing: 0.2px;
        color: #f1f5f9;
      }
      .corridor-strip-root.theme-light .cs-pill-code {
        color: #0f172a;
      }
      .cs-pill-tag {
        font-size: 8.5px;
        font-weight: 600;
        padding: 0.5px 3px;
        border-radius: 2px;
        font-family: ui-monospace, monospace;
      }
      .cs-pill-tag.speed {
        background: rgba(56, 189, 248, 0.15);
        color: #38bdf8;
      }
      .corridor-strip-root.theme-light .cs-pill-tag.speed {
        background: rgba(2, 132, 199, 0.12);
        color: #0284c7;
      }
      .cs-pill-tag.stop {
        background: rgba(245, 158, 11, 0.22);
        color: #fbbf24;
      }
      .cs-pill-tag.wait {
        background: rgba(239, 68, 68, 0.25);
        color: #f87171;
      }
    `;
    document.head.appendChild(style);
  }

  // =========================================================================
  // 5. CorridorStripInstance Core Class
  // =========================================================================

  class CorridorStripInstance {
    constructor(containerEl, options = {}) {
      this._container = (typeof containerEl === 'string')
        ? document.getElementById(containerEl)
        : containerEl;

      this._options = options || {};
      this._corridor = null;

      // Track geometry cache
      this._stationX = [];
      this._kmToX = () => 56;
      this._lastWidth = 0;
      this._lastHeight = 0;
      this._theme = 'dark';
      this._iconMode = 'half';
      this._activeCorridorId = '';

      // DOM elements
      this._rootEl = null;
      this._headerEl = null;
      this._stageEl = null;
      this._stageSvg = null;
      this._stationHeadersLayer = null;
      this._trainsLayer = null;

      // Header component sub-elements
      this._badgeEl = null;
      this._speedTagEl = null;
      this._routeSubEl = null;
      this._switchGroupEl = null;
      this._telemetryEl = null;

      // Sprite DOM recycling pool: key -> HTMLElement
      this._spritePool = new Map();

      // State cache
      this._selectedTrain = null;
      this._hoveredTrain = null;
      this._lastT = null;

      this._initDom();
      this._setupResizeObserver();
    }

    _initDom() {
      if (!this._container) return;
      injectCorridorStripStyles();

      this._container.innerHTML = '';
      this._rootEl = document.createElement('div');
      this._rootEl.className = 'corridor-strip-root';

      // 1. Header Bar
      this._headerEl = document.createElement('div');
      this._headerEl.className = 'cs-header-bar';

      // Left: badge + speed + route + segmented switches
      const hLeft = document.createElement('div');
      hLeft.className = 'cs-header-left';
      this._badgeEl = document.createElement('span');
      this._badgeEl.className = 'cs-badge-pill';
      this._speedTagEl = document.createElement('span');
      this._speedTagEl.className = 'cs-speed-tag';
      this._routeSubEl = document.createElement('span');
      this._routeSubEl.className = 'cs-route-sub';
      this._switchGroupEl = document.createElement('div');
      this._switchGroupEl.className = 'cs-switch-group';
      this._switchGroupEl.style.display = 'none';

      hLeft.appendChild(this._badgeEl);
      hLeft.appendChild(this._speedTagEl);
      hLeft.appendChild(this._routeSubEl);
      hLeft.appendChild(this._switchGroupEl);

      // Center-Left: Telemetry Badges
      this._telemetryEl = document.createElement('div');
      this._telemetryEl.className = 'cs-header-telemetry';

      this._headerEl.appendChild(hLeft);
      this._headerEl.appendChild(this._telemetryEl);

      // 2. Stage
      this._stageEl = document.createElement('div');
      this._stageEl.className = 'cs-stage';
      this._stageEl.addEventListener('click', (e) => {
        if (e.target === this._stageEl || e.target === this._stageSvg) {
          if (typeof this._options.onSelectTrain === 'function') {
            this._options.onSelectTrain(null);
          }
        }
      });

      // SVG schematic track canvas
      this._stageSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this._stageSvg.setAttribute('class', 'cs-stage-svg');

      // Station headers layer (DOM overlay)
      this._stationHeadersLayer = document.createElement('div');
      this._stationHeadersLayer.className = 'cs-station-headers-layer';

      // Trains layer (DOM overlay)
      this._trainsLayer = document.createElement('div');
      this._trainsLayer.className = 'cs-trains-layer';

      this._stageEl.appendChild(this._stageSvg);
      this._stageEl.appendChild(this._stationHeadersLayer);
      this._stageEl.appendChild(this._trainsLayer);

      this._rootEl.appendChild(this._headerEl);
      this._rootEl.appendChild(this._stageEl);
      this._container.appendChild(this._rootEl);
    }

    _setupResizeObserver() {
      if (typeof ResizeObserver === 'undefined' || !this._container) return;
      this._resizeObserver = new ResizeObserver(() => {
        this.resize();
      });
      this._resizeObserver.observe(this._container);
    }

    /**
     * Sets the active corridor object: { def, stations, maxKm, trains }
     */
    setCorridor(corridorObj) {
      this._corridor = corridorObj || null;
      if (corridorObj && corridorObj.def) {
        this._activeCorridorId = corridorObj.def.id || '';
      }

      // Clear sprite DOM pool on corridor change
      this._spritePool.clear();
      if (this._trainsLayer) {
        this._trainsLayer.innerHTML = '';
      }

      this._rebuildHeaderDetails();
      this.resize();
      return this;
    }

    /**
     * Forces re-measurement and rebuilds track schematic geometry.
     */
    resize() {
      if (!this._stageEl || !this._corridor) return;
      const w = this._stageEl.clientWidth || 1000;
      const h = this._stageEl.clientHeight || 260;

      this._lastWidth = w;
      this._lastHeight = h;

      const stations = this._corridor.stations || [];
      this._stationX = computeStationX(stations, w, 56, 56, 62);
      this._kmToX = createKmToX(stations, this._stationX, w, 56, 56);

      this._rebuildStaticSvg(w, h);
      this._rebuildStationHeaders();

      // Trigger update with last known state if available
      if (this._lastT != null) {
        this.update(this._lastT, this._selectedTrain, this._hoveredTrain, this._theme, this._iconMode);
      }
    }

    /**
     * Rebuilds static header text, speed tag, subtitle, and segmented switches.
     */
    _rebuildHeaderDetails() {
      if (!this._corridor) return;
      const def = this._corridor.def || {};
      const stations = this._corridor.stations || [];
      const maxKm = this._corridor.maxKm || (stations.length ? stations[stations.length - 1].km : 0);

      // Badge pill
      const badgeText = def.badge || def.name || '走廊';
      this._badgeEl.textContent = badgeText;
      if (def.accentColor) {
        this._badgeEl.style.borderColor = def.accentColor + '55';
        this._badgeEl.style.background = def.accentColor + '18';
        this._badgeEl.style.color = def.accentColor;
      }

      // Speed tag + total mileage
      this._speedTagEl.textContent = (def.speedTag || def.speed || '350 km/h') + (maxKm ? ` · ${maxKm} km` : '');
      this._routeSubEl.textContent = '';
      this._routeSubEl.style.display = 'none';

      // Switchable Corridors segmented switch (e.g. Row 3: c3_jh_conv <-> c4_jxt)
      const switches = this._options.switchableCorridors;
      if (Array.isArray(switches) && switches.length > 1) {
        this._switchGroupEl.style.display = 'inline-flex';
        this._switchGroupEl.innerHTML = '';

        switches.forEach(item => {
          let cid = '';
          let clabel = '';
          if (typeof item === 'string') {
            cid = item;
            clabel = item === 'c3_jh_conv' ? '京沪普速' : (item === 'c4_jxt' ? '京雄·津兴' : item);
          } else if (item && typeof item === 'object') {
            cid = item.id || (item.def && item.def.id) || '';
            clabel = item.label || item.name || (item.def && (item.def.badge || item.def.name)) || cid;
          }

          const btn = document.createElement('button');
          btn.className = 'cs-switch-btn' + (cid === this._activeCorridorId ? ' active' : '');
          btn.textContent = clabel;
          btn.dataset.id = cid;

          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (cid === this._activeCorridorId) return;
            if (typeof this._options.onSwitchCorridor === 'function') {
              this._options.onSwitchCorridor(cid);
            }
          });

          this._switchGroupEl.appendChild(btn);
        });
      } else {
        this._switchGroupEl.style.display = 'none';
      }
    }

    /**
     * Rebuilds static 4-track schematic SVG geometry.
     */
    _rebuildStaticSvg(w, h) {
      if (!this._stageSvg || !this._corridor) return;
      const stations = this._corridor.stations || [];
      const xs = this._stationX;
      const isDark = this._theme !== 'light';

      const isUltra = h < 110;
      const isCompact = h < 165;
      const yCatenary = isUltra ? 15 : (isCompact ? Math.max(20, Math.round(h * 0.20)) : 44);
      const yDownSiding = Math.round(h * (isUltra ? 0.34 : isCompact ? 0.29 : 0.30));
      const yDownMain = Math.round(h * (isUltra ? 0.47 : isCompact ? 0.42 : 0.43));
      const yCenter = Math.round(h * (isUltra ? 0.56 : isCompact ? 0.53 : 0.53));
      const yUpMain = Math.round(h * (isUltra ? 0.75 : isCompact ? 0.64 : 0.64));
      const yUpSiding = Math.round(h * (isUltra ? 0.89 : isCompact ? 0.77 : 0.77));
      const yKmZone = isUltra ? h - 2 : (isCompact ? h - 4 : h - 22);

      // Theme colors
      const downColor = isDark ? '#38bdf8' : '#0284c7';
      const downSidingColor = isDark ? 'rgba(56, 189, 248, 0.65)' : 'rgba(2, 132, 199, 0.65)';
      const downGlow = isDark ? 'rgba(56, 189, 248, 0.08)' : 'rgba(2, 132, 199, 0.06)';

      const upColor = isDark ? '#fbbf24' : '#d97706';
      const upSidingColor = isDark ? 'rgba(251, 191, 36, 0.65)' : 'rgba(217, 119, 6, 0.65)';
      const upGlow = isDark ? 'rgba(251, 191, 36, 0.08)' : 'rgba(217, 119, 6, 0.06)';

      const spineColor = isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(100, 116, 139, 0.16)';
      const catenaryColor = isDark ? 'rgba(148, 163, 184, 0.30)' : 'rgba(100, 116, 139, 0.35)';
      const mastColor = isDark ? 'rgba(148, 163, 184, 0.38)' : 'rgba(100, 116, 139, 0.45)';

      const platformFill = isDark ? 'rgba(30, 41, 59, 0.88)' : '#f1f5f9';
      const platformStroke = isDark ? 'rgba(148, 163, 184, 0.28)' : '#cbd5e1';
      const platformText = isDark ? '#cbd5e1' : '#475569';
      const kmTextColor = isDark ? '#94a3b8' : '#64748b';
      const trackLabelColor = isDark ? 'rgba(148, 163, 184, 0.35)' : 'rgba(100, 116, 139, 0.45)';

      let s = '';

      // 1. Vertical Station Alignment Spines
      const tjIdx = stations.findIndex(st => st && (st.isTianjinHub || /^天津/.test(st.name || '')));
      for (let i = 0; i < stations.length; i++) {
        const stX = xs[i];
        if (i === tjIdx) {
          const tjSpineColor = isDark ? 'rgba(56, 189, 248, 0.42)' : 'rgba(2, 132, 199, 0.40)';
          s += `<line x1="${stX}" y1="0" x2="${stX}" y2="${h}" stroke="${tjSpineColor}" stroke-width="1.5" stroke-dasharray="3,2"/>`;
        } else {
          s += `<line x1="${stX}" y1="${isCompact ? 20 : 36}" x2="${stX}" y2="${yKmZone - (isCompact ? 8 : 6)}" stroke="${spineColor}" stroke-width="1" stroke-dasharray="2,3"/>`;
        }
      }

      // 2. Overhead Catenary Contact Wire & Masts
      s += `<line x1="0" y1="${yCatenary}" x2="${w}" y2="${yCatenary}" stroke="${catenaryColor}" stroke-width="1" stroke-dasharray="6,4"/>`;
      if (!isCompact) {
        const mastPad = 56;
        for (let mx = mastPad; mx <= w - mastPad; mx += 90) {
          s += `<line x1="${mx}" y1="18" x2="${mx}" y2="48" stroke="${mastColor}" stroke-width="1.8"/>`
            + `<line x1="${mx - 8}" y1="26" x2="${mx + 8}" y2="26" stroke="${mastColor}" stroke-width="1.2"/>`
            + `<rect x="${mx - 2}" y="35" width="4" height="6" rx="1" fill="${mastColor}"/>`;
        }
      }

      // 3. Down Siding Track & Diagonal Turnout Switches
      for (let i = 0; i < stations.length; i++) {
        const stX = xs[i];
        // Siding platform track
        s += `<line x1="${stX - 38}" y1="${yDownSiding}" x2="${stX + 38}" y2="${yDownSiding}" stroke="${downSidingColor}" stroke-width="1.8"/>`;
        // Turnout entry switch
        s += `<path d="M ${stX - 54} ${yDownMain} C ${stX - 44} ${yDownMain}, ${stX - 48} ${yDownSiding}, ${stX - 38} ${yDownSiding}" fill="none" stroke="${downSidingColor}" stroke-width="1.8"/>`;
        // Turnout exit switch
        s += `<path d="M ${stX + 38} ${yDownSiding} C ${stX + 48} ${yDownSiding}, ${stX + 44} ${yDownMain}, ${stX + 54} ${yDownMain}" fill="none" stroke="${downSidingColor}" stroke-width="1.8"/>`;
        // Turnout points/frogs
        s += `<circle cx="${stX - 54}" cy="${yDownMain}" r="1.6" fill="${downColor}"/>`;
        s += `<circle cx="${stX + 54}" cy="${yDownMain}" r="1.6" fill="${downColor}"/>`;
      }

      // 4. Down Main Track (Single Line)
      s += `<line x1="0" y1="${yDownMain}" x2="${w}" y2="${yDownMain}" stroke="${downColor}" stroke-width="2"/>`;

      // Down Direction Label
      if (!isUltra) {
        for (let i = 0; i < stations.length - 1; i++) {
          const gap = xs[i + 1] - xs[i];
          if (gap >= 120) {
            const midX = (xs[i] + xs[i + 1]) / 2;
            s += `<text x="${midX}" y="${yDownMain - 7}" text-anchor="middle" font-size="9" font-weight="600" fill="${trackLabelColor}" letter-spacing="0.5">下行 往津/沪 →</text>`;
            break;
          }
        }
      }

      // 6. Up Main Track (Single Line)
      s += `<line x1="0" y1="${yUpMain}" x2="${w}" y2="${yUpMain}" stroke="${upColor}" stroke-width="2"/>`;

      // Up Direction Label
      if (!isUltra) {
        for (let i = stations.length - 1; i > 0; i--) {
          const gap = xs[i] - xs[i - 1];
          if (gap >= 120) {
            const midX = (xs[i] + xs[i - 1]) / 2;
            s += `<text x="${midX}" y="${yUpMain + 15}" text-anchor="middle" font-size="9" font-weight="600" fill="${trackLabelColor}" letter-spacing="0.5">← 上行 进京</text>`;
            break;
          }
        }
      }

      // 7. Up Siding Track & Diagonal Turnout Switches
      for (let i = 0; i < stations.length; i++) {
        const stX = xs[i];
        // Siding platform track
        s += `<line x1="${stX - 38}" y1="${yUpSiding}" x2="${stX + 38}" y2="${yUpSiding}" stroke="${upSidingColor}" stroke-width="1.8"/>`;
        // Turnout entry switch (for Up trains heading left)
        s += `<path d="M ${stX + 54} ${yUpMain} C ${stX + 44} ${yUpMain}, ${stX + 48} ${yUpSiding}, ${stX + 38} ${yUpSiding}" fill="none" stroke="${upSidingColor}" stroke-width="1.8"/>`;
        // Turnout exit switch
        s += `<path d="M ${stX - 38} ${yUpSiding} C ${stX - 48} ${yUpSiding}, ${stX - 44} ${yUpMain}, ${stX - 54} ${yUpMain}" fill="none" stroke="${upSidingColor}" stroke-width="1.8"/>`;
        // Turnout points/frogs
        s += `<circle cx="${stX + 54}" cy="${yUpMain}" r="1.6" fill="${upColor}"/>`;
        s += `<circle cx="${stX - 54}" cy="${yUpMain}" r="1.6" fill="${upColor}"/>`;
      }

      // 7b. 进出线（斜线）与方向标注
      s += this._buildPortsSvg(w, h, { yDownMain, yUpMain, isUltra, isCompact, isDark });

      // 8. Bottom Kilometer Axis & Inter-Station Distance Labels
      if (!isUltra) {
        for (let i = 0; i < stations.length; i++) {
          const st = stations[i];
          const stX = xs[i];
          s += `<text x="${stX}" y="${yKmZone}" text-anchor="middle" font-size="8.5" font-family="ui-monospace, monospace" font-weight="700" fill="${kmTextColor}">${st.km}km</text>`;
        }
      }
      if (!isCompact) {
        for (let i = 0; i < stations.length - 1; i++) {
          const gap = xs[i + 1] - xs[i];
          const dKm = stations[i + 1].km - stations[i].km;
          if (gap >= 68 && dKm > 0) {
            const midX = (xs[i] + xs[i + 1]) / 2;
            s += `<text x="${midX}" y="${yKmZone + 11}" text-anchor="middle" font-size="8.5" font-family="ui-monospace, monospace" fill="${kmTextColor}" opacity="0.75">⟵ ${dKm} km ⟶</text>`;
          }
        }
      }

      this._stageSvg.innerHTML = s;
    }

    /**
     * 进出线端口几何：分支端口画两条平行斜线（下行线、上行线各一条）通向上/下边缘，
     * 两端顺延端口只在边缘标方向。几何存到 this._portGeo 供列车顺延动画使用。
     */
    _buildPortsSvg(w, h, { yDownMain, yUpMain, isUltra, isCompact, isDark }) {
      this._portGeo = {};
      const CD = global.CorridorData;
      const def = this._corridor && this._corridor.def;
      if (!CD || typeof CD.corridorPorts !== 'function' || !def || !def.stations) return '';
      const ports = CD.corridorPorts(def);
      const lineColor = isDark ? 'rgba(148, 163, 184, 0.55)' : 'rgba(100, 116, 139, 0.6)';
      const textColor = isDark ? '#cbd5e1' : '#334155';
      const haloColor = isDark ? 'rgba(10, 14, 24, 0.9)' : 'rgba(255, 255, 255, 0.92)';
      const yTopEnd = isUltra ? 16 : (isCompact ? 22 : 40);
      const yBotEnd = h - 3;
      const k = 1.5; // 斜率 dx/dy
      const fs = isUltra ? 9 : 10;
      const textAttr = `font-size="${fs}" font-weight="700" fill="${textColor}" stroke="${haloColor}" stroke-width="3" paint-order="stroke" stroke-linejoin="round"`;
      let s = '';
      for (const p of ports) {
        if (p.kind === 'edge') {
          this._portGeo[p.id] = { edge: p.side };
          if (p.label) {
            // 标在上行线下方，避开两端列车
            const ty = Math.min(h - 3, yUpMain + fs + 3);
            s += p.side === 'L'
              ? `<text x="4" y="${ty}" text-anchor="start" ${textAttr}>← ${p.label}</text>`
              : `<text x="${w - 4}" y="${ty}" text-anchor="end" ${textAttr}>${p.label} →</text>`;
          }
          continue;
        }
        const jx = this._kmToX(p.km);
        const yEnd = p.top ? yTopEnd : yBotEnd;
        const mk = (y0) => ({ x0: jx, y0, x1: jx + p.lean * k * Math.abs(y0 - yEnd), y1: yEnd });
        const g = { down: mk(yDownMain), up: mk(yUpMain) };
        this._portGeo[p.id] = g;
        for (const seg of [g.down, g.up]) {
          s += `<line x1="${seg.x0.toFixed(1)}" y1="${seg.y0}" x2="${seg.x1.toFixed(1)}" y2="${seg.y1}" stroke="${lineColor}" stroke-width="1.6" stroke-linecap="round"/>`;
        }
        s += `<circle cx="${jx}" cy="${yDownMain}" r="2" fill="${lineColor}"/><circle cx="${jx}" cy="${yUpMain}" r="2" fill="${lineColor}"/>`;
        if (p.label) {
          const xs = [g.down.x1, g.up.x1];
          const tx = p.lean > 0 ? Math.max(...xs) + 4 : Math.min(...xs) - 4;
          const anchor = p.lean > 0 ? 'start' : 'end';
          const ty = p.top ? yEnd + fs * 0.35 : yEnd - 2;
          s += `<text x="${tx.toFixed(1)}" y="${ty}" text-anchor="${anchor}" ${textAttr}>${p.label}</text>`;
        }
      }
      return s;
    }

    /**
     * Rebuilds station header name pills and live stop badges in DOM overlay.
     */
    _rebuildStationHeaders() {
      if (!this._stationHeadersLayer || !this._corridor) return;
      this._stationHeadersLayer.innerHTML = '';
      const stations = this._corridor.stations || [];
      const xs = this._stationX;

      const majorNames = new Set(['北京', '北京南', '北京西', '北京丰台', '天津', '天津南', '天津西', '滨海', '沧州西', '沧州', '雄安', '济南西', '南京南', '上海虹桥', '廊坊', '武清']);
      const tjIdx = stations.findIndex(st => st && (st.isTianjinHub || /^天津/.test(st.name || '')));

      stations.forEach((st, i) => {
        const isMajor = !!(st.isMajor || st.major || majorNames.has(st.name));
        const isTjHub = (i === tjIdx);
        const col = document.createElement('div');
        col.className = 'cs-station-col';
        col.style.left = `${xs[i]}px`;
        col.dataset.station = st.name;

        // Name pill
        const pill = document.createElement('div');
        pill.className = 'cs-st-name-pill' + (isMajor ? ' major' : '') + (isTjHub ? ' tj-hub' : '');
        if (isTjHub) {
          pill.style.borderColor = 'rgba(56, 189, 248, 0.55)';
          pill.style.boxShadow = '0 0 8px rgba(56, 189, 248, 0.22)';
        }

        let roofIcon = '';
        if (isMajor) {
          roofIcon = '<svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" style="opacity:0.85; flex-shrink:0;"><path d="M8 1.5 L1 6.5 H3 V14 H13 V6.5 H15 Z M5 8 H11 V13 H5 Z"/></svg>';
        }

        pill.innerHTML = `${roofIcon}<span>${st.label || st.name}</span>`;
        col.appendChild(pill);
        this._stationHeadersLayer.appendChild(col);
      });
    }

    /**
     * Updates live station stop badges based on currently stopped active trains.
     */
    _updateStationLiveBadges(activeStates) {
      if (!this._stationHeadersLayer) return;
      const stoppedStationSet = new Set();

      for (let i = 0; i < activeStates.length; i++) {
        const st = activeStates[i];
        const sName = st.station || st.stopStName;
        if (st.isStopped && sName) {
          stoppedStationSet.add(sName);
        }
      }

      const cols = this._stationHeadersLayer.children;
      for (let i = 0; i < cols.length; i++) {
        const col = cols[i];
        const sName = col.dataset.station;
        const isStoppedHere = stoppedStationSet.has(sName);
        const badge = col.querySelector('.cs-st-live-badge');
        const pill = col.querySelector('.cs-st-name-pill');

        if (badge) {
          badge.style.display = isStoppedHere ? 'inline-flex' : 'none';
        }
        if (pill) {
          pill.classList.toggle('is-active', isStoppedHere);
        }
      }
    }

    /**
     * Updates header telemetry counters:
     * 全天 ${corridor.trains.length} 列 · 下行 ${downCount} 列 · 上行 ${upCount} 列 · 停靠/待避 ${stopCount} 列
     */
    _updateTelemetryBadges(activeStates) {
      if (!this._telemetryEl || !this._corridor) return;
      const totalCount = (this._corridor.trains && this._corridor.trains.length) || 0;
      let downCount = 0;
      let upCount = 0;
      let stopCount = 0;

      for (let i = 0; i < activeStates.length; i++) {
        const st = activeStates[i];
        if (st.dir === 'down') downCount++;
        else if (st.dir === 'up') upCount++;
        if (st.isStopped) stopCount++;
      }

      this._telemetryEl.innerHTML = `
        <span class="cs-telemetry-pill">全天 <b>${totalCount}</b> 列</span>
        <span class="cs-telemetry-div">/</span>
        <span class="cs-telemetry-pill down">下行 <b>${downCount}</b> 列</span>
        <span class="cs-telemetry-div">/</span>
        <span class="cs-telemetry-pill up">上行 <b>${upCount}</b> 列</span>
        <span class="cs-telemetry-div">/</span>
        <span class="cs-telemetry-pill stop">停靠/待避 <b>${stopCount}</b> 列</span>
      `;
    }

    /**
     * Main update loop: updates train positions, siding turnout offsets,
     * header counters, and spotlight mini-card at simulation time T.
     */
    update(T, selectedTrain = null, hoveredTrain = null, theme = 'dark', iconMode = 'half') {
      if (!this._container || !this._corridor) return;

      this._lastT = T;
      this._selectedTrain = selectedTrain;
      this._hoveredTrain = hoveredTrain;
      this._iconMode = iconMode || 'half';

      // Theme sync
      const curTheme = theme || (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
      if (curTheme !== this._theme) {
        this._theme = curTheme;
        this._rootEl.classList.toggle('theme-light', curTheme === 'light');
        if (this._lastWidth && this._lastHeight) {
          this._rebuildStaticSvg(this._lastWidth, this._lastHeight);
        }
      }

      // Ensure geometry is up to date if container dimensions changed
      const curW = (this._stageEl && this._stageEl.clientWidth) || this._lastWidth || 1000;
      const curH = (this._stageEl && this._stageEl.clientHeight) || this._lastHeight || 130;
      if (Math.abs(curW - this._lastWidth) > 2 || Math.abs(curH - this._lastHeight) > 2 || !this._stationX.length) {
        this._lastWidth = curW;
        this._lastHeight = curH;
        const sts = this._corridor.stations || (this._corridor.def && this._corridor.def.stations) || [];
        this._stationX = computeStationX(sts, curW, 56, 56, 58);
        this._kmToX = createKmToX(sts, this._stationX, curW, 56, 56);
        this._rebuildStaticSvg(curW, curH);
        this._rebuildStationHeaders();
      }

      const h = this._lastHeight || 130;
      const isUltra = h < 110;
      const isCompact = h < 165;
      const yDownSiding = Math.round(h * (isUltra ? 0.34 : isCompact ? 0.29 : 0.30));
      const yDownMain = Math.round(h * (isUltra ? 0.47 : isCompact ? 0.42 : 0.43));
      const yUpMain = Math.round(h * (isUltra ? 0.75 : isCompact ? 0.64 : 0.64));
      const yUpSiding = Math.round(h * (isUltra ? 0.89 : isCompact ? 0.77 : 0.77));

      // 1. Collect all active train states at simulation time T
      const trains = this._corridor.trains || [];
      const stations = this._corridor.stations || (this._corridor.def && this._corridor.def.stations) || [];
      const activeStates = [];

      for (let i = 0; i < trains.length; i++) {
        const entry = trains[i];
        const st = resolveTrainState(entry, T, stations);
        if (st && st.km != null) {
          activeStates.push(st);
        }
      }

      // 2. Update Header Telemetry Badges & Spotlight Mini-Card
      this._updateTelemetryBadges(activeStates);
      this._updateStationLiveBadges(activeStates);

      // 3. Compute X, Y coordinates and Staggering Levels
      const downTrains = [];
      const upTrains = [];

      for (let i = 0; i < activeStates.length; i++) {
        const st = activeStates[i];
        st.x = this._kmToX(st.km);

        if (st.dir === 'down') {
          const ratio = st.sidingRatio != null ? st.sidingRatio : (st.isStopped ? 1.0 : 0.0);
          st.y = yDownMain + (yDownSiding - yDownMain) * ratio;
          downTrains.push(st);
        } else {
          const ratio = st.sidingRatio != null ? st.sidingRatio : (st.isStopped ? 1.0 : 0.0);
          st.y = yUpMain + (yUpSiding - yUpMain) * ratio;
          upTrains.push(st);
        }
      }

      // 进出线顺延段：沿斜线（车身随之倾斜）一直开出画面，或越过两端继续前进
      for (let i = 0; i < activeStates.length; i++) {
        const st = activeStates[i];
        const pr = st.portRun;
        if (!pr || !this._portGeo) continue;
        const g = this._portGeo[pr.port.id];
        if (!g) continue;
        const u = Math.max(0, Math.min(1, pr.frac));
        if (g.edge) {
          const span = g.edge === 'L' ? st.x + 90 : (this._lastWidth - st.x) + 90;
          st.x += (g.edge === 'L' ? -1 : 1) * u * span;
        } else {
          const seg = st.dir === 'down' ? g.down : g.up;
          const x0 = st.x, y0 = st.y;
          // 沿斜线延长到画面外
          const yOut = seg.y1 < y0 ? -60 : h + 60;
          const sc = (yOut - y0) / ((seg.y1 - y0) || 1);
          const ex = x0 + (seg.x1 - x0) * sc;
          st.x = x0 + (ex - x0) * u;
          st.y = y0 + (yOut - y0) * u;
          // 车头朝运动方向，车身贴着斜线倾斜
          let vx = ex - x0, vy = yOut - y0;
          if (pr.phase === 'in') { vx = -vx; vy = -vy; }
          st._faceDown = vx >= 0;
          st._rot = st._faceDown ? Math.atan2(vy, vx) : Math.atan2(-vy, -vx);
        }
      }

      // Sort and assign collision-free staggering levels
      downTrains.sort((a, b) => a.x - b.x);
      upTrains.sort((a, b) => a.x - b.x);
      for (const st of downTrains.concat(upTrains)) {
        const sp = this._spritePool.get((st.code || '') + '_' + (st.dir || 'down'));
        st.prevLevel = sp && sp.style.display !== 'none' ? sp._lvl : null;
      }
      assignStaggerLevels(downTrains, 64);
      assignStaggerLevels(upTrains, 64);

      // 4. Update Train Sprites DOM Pool
      const activeKeys = new Set();
      const allActive = downTrains.concat(upTrains);

      for (let i = 0; i < allActive.length; i++) {
        const st = allActive[i];
        const tr = st.tr;
        const key = (st.code || '') + '_' + (st.dir || 'down');
        activeKeys.add(key);

        let spriteEl = this._spritePool.get(key);
        if (!spriteEl) {
          spriteEl = document.createElement('div');
          spriteEl.className = 'cs-train-sprite';

          // Inner elements
          const leaderEl = document.createElement('div');
          leaderEl.className = 'cs-leader-line';

          const pillEl = document.createElement('div');
          pillEl.className = 'cs-callout-pill';

          const codeEl = document.createElement('span');
          codeEl.className = 'cs-pill-code';
          const tagEl = document.createElement('span');
          tagEl.className = 'cs-pill-tag';
          pillEl.appendChild(codeEl);
          pillEl.appendChild(tagEl);

          const iconWrapEl = document.createElement('div');
          iconWrapEl.className = 'cs-train-icon-wrap';

          const odEl = document.createElement('div');
          odEl.className = 'cs-od-label';
          spriteEl._odEl = odEl;

          spriteEl.appendChild(leaderEl);
          spriteEl.appendChild(pillEl);
          spriteEl.appendChild(iconWrapEl);
          spriteEl.appendChild(odEl);

          // Cached element references for high-speed frame updates
          spriteEl._leaderEl = leaderEl;
          spriteEl._pillEl = pillEl;
          spriteEl._codeEl = codeEl;
          spriteEl._tagEl = tagEl;
          spriteEl._iconWrapEl = iconWrapEl;

          // Click & Hover Events
          spriteEl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof this._options.onSelectTrain === 'function') {
              this._options.onSelectTrain(spriteEl._trainObj);
            }
          });
          spriteEl.addEventListener('mouseenter', () => {
            if (typeof this._options.onHoverTrain === 'function') {
              this._options.onHoverTrain(spriteEl._trainObj);
            }
          });
          spriteEl.addEventListener('mouseleave', () => {
            if (typeof this._options.onHoverTrain === 'function') {
              this._options.onHoverTrain(null);
            }
          });

          this._trainsLayer.appendChild(spriteEl);
          this._spritePool.set(key, spriteEl);
        }

        spriteEl._trainObj = tr;
        spriteEl.style.display = '';

        // Direction & Mode Classes
        // 车头朝向：斜线顺延段按实际运动方向（折返出岔时会掉头）
        const faceDown = st._faceDown != null ? st._faceDown : st.dir === 'down';
        spriteEl.classList.toggle('dir-down', faceDown);
        spriteEl.classList.toggle('dir-up', !faceDown);
        spriteEl.classList.toggle('mode-marker', this._iconMode === 'marker');

        const isSelected = isTrainMatch(tr, selectedTrain);
        const isHovered = isTrainMatch(tr, hoveredTrain);
        spriteEl.classList.toggle('selected', isSelected);
        spriteEl.classList.toggle('hovered', isHovered);

        // 始发终到
        const ent = st.entry || {};
        const odText = (ent.origin && ent.dest) ? `${ent.origin}-${ent.dest}`
          : (st.from && st.to) ? `${st.from}-${st.to}`
          : (tr && tr.s && tr.s.length) ? `${tr.s[0][0]}-${tr.s[tr.s.length - 1][0]}` : '';
        if (spriteEl._odEl && spriteEl._odEl._text !== odText) {
          spriteEl._odEl._text = odText;
          spriteEl._odEl.textContent = odText;
        }

        // Slight vertical stagger when two trains on the same direction are very close horizontally
        const lvl = st.level || 0;
        spriteEl._lvl = lvl;
        const yTarget = lvl === 0 ? 0 : (st.dir === 'down' ? -lvl * 5.5 : lvl * 5.5);
        // 错层偏移按模拟时间平滑过渡（时间常数 0.25 分钟），跳时/重新出现时直接到位
        const dtSim = spriteEl._lastT != null ? T - spriteEl._lastT : Infinity;
        if (spriteEl._yOff == null || !(dtSim > 0) || dtSim > 5) {
          if (spriteEl._yOff == null || dtSim !== 0) spriteEl._yOff = yTarget;
        } else {
          spriteEl._yOff += (yTarget - spriteEl._yOff) * (1 - Math.exp(-dtSim / 0.25));
        }
        spriteEl._lastT = T;
        const yStagger = spriteEl._yOff;

        // Hardware-accelerated sub-pixel position for smooth 60fps animation
        const rot = st._rot ? ` rotate(${(st._rot * 180 / Math.PI).toFixed(1)}deg)` : '';
        spriteEl.style.transform = `translate3d(${st.x.toFixed(1)}px, ${(st.y + yStagger).toFixed(1)}px, 0)${rot}`;

        // Hide external callout pill & speed tag: train code is drawn directly on the marker body
        const pillEl = spriteEl._pillEl || spriteEl.querySelector('.cs-callout-pill');
        const leaderEl = spriteEl._leaderEl || spriteEl.querySelector('.cs-leader-line');
        if (pillEl) pillEl.style.display = 'none';
        if (leaderEl) leaderEl.style.display = 'none';

        // Update Icon SVG (large marker with train code on body)
        const iconH = isUltra ? 20 : 24;
        const iconWrapEl = spriteEl._iconWrapEl || spriteEl.querySelector('.cs-train-icon-wrap');
        const iconKey = `${resolveModel(tr)}_${this._iconMode}_${faceDown}_${iconH}_${st.code}`;
        if (iconWrapEl && iconWrapEl._iconKey !== iconKey) {
          iconWrapEl._iconKey = iconKey;
          iconWrapEl.innerHTML = getTrainIconSvg(tr, this._iconMode, faceDown, iconH, st.code);
        }
      }

      // Hide inactive train sprites
      this._spritePool.forEach((spriteEl, key) => {
        if (!activeKeys.has(key)) {
          spriteEl.style.display = 'none';
        }
      });

      return {
        activeCount: activeStates.length,
        stoppedCount: activeStates.filter(s => s.isStopped).length,
        downCount: downTrains.length,
        upCount: upTrains.length
      };
    }

    /** Returns current corridor object */
    getCorridor() {
      return this._corridor;
    }

    /** Cleans up DOM elements and listeners */
    destroy() {
      if (this._resizeObserver) {
        this._resizeObserver.disconnect();
        this._resizeObserver = null;
      }
      this._spritePool.clear();
      if (this._container) {
        this._container.innerHTML = '';
      }
      this._corridor = null;
    }
  }

  // =========================================================================
  // 6. Public Static API
  // =========================================================================

  const CorridorStrip = {
    /**
     * Creates a new CorridorStrip instance inside containerEl.
     * @param {HTMLElement|string} containerEl
     * @param {Object} options - { onSelectTrain, onHoverTrain, onSwitchCorridor, switchableCorridors }
     * @returns {CorridorStripInstance}
     */
    createInstance(containerEl, options) {
      return new CorridorStripInstance(containerEl, options);
    },

    computeStationX,
    createKmToX,
    getTrainIconSvg,
    assignStaggerLevels,
    resolveModel
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CorridorStrip;
  }
  global.CorridorStrip = CorridorStrip;

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
