/**
 * corridor_diagram.js - Dedicated Beijing–Tianjin Corridor Time-Space Diagram
 *
 * High-DPI Canvas-based Time-Space Diagram (运行图) for window.CorridorDiagram
 * Aligned 1-to-1 with CorridorTrackStrip in corridor.html.
 *
 * Features:
 *  - Responsive high-DPI canvas with auto-resizing & devicePixelRatio scaling.
 *  - Configurable rolling time window (default 90 min) & full-day mode (04:00–24:00).
 *  - Accurate Y-axis mileage mapping [0 .. maxKm] (Beijing at top, Tianjin/Binhai at bottom).
 *  - Train trajectory rendering color-coded by class (G/C/D/Z/T/K/O).
 *  - Trajectory-parallel rotated train code labels on longest visible diagonal segment.
 *  - Amber highlight & callout tag for wait/overtaking stops (⏸ 待避/会车).
 *  - Active intersection dot on NOW playhead cursor line.
 *  - Dramatic golden glow, station stop times, and status callout tag for selected/hovered trains.
 *  - Interactive hit-testing, tooltips, pan & zoom, seek bar on bottom axis.
 */

(function (global) {
  'use strict';

  // =========================================================================
  // 1. Color Palettes & Visual Themes
  // =========================================================================

  const THEMES = {
    dark: {
      bg: '#080c14',
      plotBg: '#090e1a',
      pastFill: 'rgba(2, 6, 23, 0.46)',
      gridMajor: 'rgba(255, 255, 255, 0.12)',
      gridMinor: 'rgba(255, 255, 255, 0.04)',
      border: 'rgba(255, 255, 255, 0.14)',
      fg: '#f1f5f9',
      muted: '#94a3b8',
      stationMajor: '#e2e8f0',
      stationMinor: '#64748b',
      nowLine: '#fb7185',
      nowGlow: 'rgba(251, 113, 133, 0.35)',
      pillBg: '#090e1a',
      pillBorder: 'rgba(255, 255, 255, 0.16)',
      classes: {
        G: '#f43f5e', // Rose
        C: '#06b6d4', // Cyan
        D: '#14b8a6', // Teal
        Z: '#a855f7', // Purple
        T: '#eab308', // Amber
        K: '#22c55e', // Green
        O: '#22c55e',
      },
    },
    light: {
      bg: '#f8fafc',
      plotBg: '#ffffff',
      pastFill: 'rgba(15, 23, 42, 0.04)',
      gridMajor: 'rgba(0, 0, 0, 0.11)',
      gridMinor: 'rgba(0, 0, 0, 0.04)',
      border: 'rgba(0, 0, 0, 0.14)',
      fg: '#0f172a',
      muted: '#64748b',
      stationMajor: '#1e293b',
      stationMinor: '#94a3b8',
      nowLine: '#e11d48',
      nowGlow: 'rgba(225, 29, 72, 0.25)',
      pillBg: '#ffffff',
      pillBorder: 'rgba(0, 0, 0, 0.14)',
      classes: {
        G: '#e11d48',
        C: '#0284c7',
        D: '#0d9488',
        Z: '#7e22ce',
        T: '#ca8a04',
        K: '#16a34a',
        O: '#16a34a',
      },
    },
  };

  // Ensure scoped CSS styles exist for header bar and tooltips
  function ensureStyles() {
    if (typeof document === 'undefined') return;
    const styleId = 'corridor-dg-injected-styles';
    if (document.getElementById(styleId)) return;
    const st = document.createElement('style');
    st.id = styleId;
    st.textContent = `
      .corridor-dg-wrap {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        user-select: none;
        -webkit-user-select: none;
        background: #080c14;
      }
      .corridor-dg-canvas {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        touch-action: none;
        cursor: grab;
      }
      .corridor-dg-canvas.is-dragging {
        cursor: grabbing !important;
      }
      .corridor-dg-header {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 21px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 8px;
        pointer-events: none;
        z-index: 10;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Noto Sans CJK SC", sans-serif;
      }
      .corridor-dg-header > * {
        pointer-events: auto;
      }
      .corridor-dg-title-wrap {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
      }
      .corridor-dg-badge {
        font-size: 9.5px;
        font-weight: 700;
        padding: 1px 5px;
        border-radius: 3px;
        background: rgba(56, 189, 248, 0.15);
        color: #38bdf8;
        border: 1px solid rgba(56, 189, 248, 0.35);
        white-space: nowrap;
      }
      .corridor-dg-title {
        font-size: 10.5px;
        font-weight: 700;
        color: #e2e8f0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .corridor-dg-legend {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
      }
      .corridor-dg-pill {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 8.5px;
        font-weight: 600;
        padding: 0.5px 4px;
        border-radius: 3px;
        line-height: 1.2;
      }
      .corridor-dg-pill-dot {
        width: 4.5px;
        height: 4.5px;
        border-radius: 50%;
      }
      .corridor-dg-hint {
        display: none;
      }
      .corridor-dg-tooltip {
        position: fixed;
        z-index: 99999;
        pointer-events: none;
        display: none;
        padding: 7px 11px;
        border-radius: 6px;
        background: rgba(9, 14, 26, 0.94);
        border: 1px solid rgba(255, 255, 255, 0.18);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
        color: #f1f5f9;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Noto Sans CJK SC", sans-serif;
        font-size: 11px;
        line-height: 1.35;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        transform: translate(-50%, -115%);
        transition: opacity 0.12s ease;
      }
    `;
    document.head.appendChild(st);
  }

  // =========================================================================
  // 2. Math & Coordinate Helper Functions
  // =========================================================================

  function formatTime(tMin) {
    if (tMin == null || !isFinite(tMin)) return '--:--';
    const m = ((Math.round(tMin) % 1440) + 1440) % 1440;
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  function getPtT(p) {
    if (!p) return 0;
    if (Array.isArray(p)) return p[0];
    if (typeof p.t === 'number') return p.t;
    if (typeof p.time === 'number') return p.time;
    return 0;
  }

  function getPtKm(p) {
    if (!p) return 0;
    if (Array.isArray(p)) return p[1];
    if (typeof p.km === 'number') return p.km;
    return 0;
  }

  function getPt(p) {
    if (!p) return { t: 0, km: 0 };
    if (Array.isArray(p)) {
      return { t: p[0], km: p[1], st: p[2] || '', type: p[3] || 'point' };
    }
    return {
      t: p.t != null ? p.t : (p.time != null ? p.time : 0),
      km: p.km != null ? p.km : 0,
      st: p.st || p.station || p.name || '',
      type: p.type || 'point',
    };
  }

  function distToSegment(px, py, x0, y0, x1, y1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x0, py - y0);
    let r = ((px - x0) * dx + (py - y0) * dy) / lenSq;
    r = Math.max(0, Math.min(1, r));
    const projX = x0 + r * dx;
    const projY = y0 + r * dy;
    return Math.hypot(px - projX, py - projY);
  }

  function drawRoundRect(ctx, x, y, w, h, r) {
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
  }

  function resolveTrainClass(entry) {
    if (entry.cls) return entry.cls.toUpperCase();
    const code = (entry.code || (entry.tr && entry.tr.c) || '').split('/')[0].trim().toUpperCase();
    const c0 = code[0] || 'O';
    if (c0 === 'G') return 'G';
    if (c0 === 'C' || c0 === 'S') return 'C';
    if (c0 === 'D') return 'D';
    if (c0 === 'Z') return 'Z';
    if (c0 === 'T') return 'T';
    if (c0 === 'K') return 'K';
    return 'O';
  }

  function isMatchTrain(entry, target) {
    if (!entry || !target) return false;
    if (entry === target) return true;
    if (entry.tr && entry.tr === target) return true;
    if (typeof target === 'string') {
      const tCode = target.split('/')[0].toUpperCase();
      if (entry.code && entry.code.split('/')[0].toUpperCase() === tCode) return true;
      if (entry.tr && entry.tr.c && entry.tr.c.split('/')[0].toUpperCase() === tCode) return true;
    }
    if (typeof target === 'object') {
      if (target.c && entry.tr && entry.tr.c === target.c) return true;
      if (target.code && entry.code === target.code) return true;
    }
    return false;
  }

  function normalizeStop(s, stationKmMap) {
    if (!s) return null;
    if (Array.isArray(s)) {
      const name = s[0] || '';
      const km = stationKmMap.get(name) ?? 0;
      const tArr = s[1] != null ? s[1] : s[2];
      const tDep = s[2] != null ? s[2] : s[1];
      const isWait = !!s[3];
      const waitTitle = typeof s[3] === 'string' ? s[3] : (isWait ? '待避' : '');
      return { name, km, tArr, tDep, isWait, waitTitle };
    }
    const name = s.station || s.name || '';
    const km = s.km != null ? s.km : (stationKmMap.get(name) ?? 0);
    const tArr = s.tArr != null ? s.tArr : (s.arr != null ? s.arr : s.tDep);
    const tDep = s.tDep != null ? s.tDep : (s.dep != null ? s.dep : s.tArr);
    const isWait = !!(s.isWait || s.wait || s.waitTitle);
    const waitTitle = s.waitTitle || (typeof s.wait === 'string' ? s.wait : (isWait ? '待避' : ''));
    return { name, km, tArr, tDep, isWait, waitTitle };
  }

  function getTrainState(entry, T) {
    if (typeof window !== 'undefined' && window.CorridorData && typeof window.CorridorData.getTrainStateAt === 'function') {
      const state = window.CorridorData.getTrainStateAt(entry, T);
      if (state) return state;
    }
    // Fallback: internal linear interpolation along entry.points
    if (!entry || !entry.points || entry.points.length < 2) return null;
    const pts = entry.points;
    const t0 = getPtT(pts[0]);
    const t1 = getPtT(pts[pts.length - 1]);
    if (T < t0 || T > t1) return null;

    for (let i = 1; i < pts.length; i++) {
      const p0 = getPt(pts[i - 1]);
      const p1 = getPt(pts[i]);
      if (p0.t <= T && T <= p1.t) {
        const dt = p1.t - p0.t;
        const r = dt > 0 ? (T - p0.t) / dt : 0;
        const km = p0.km + r * (p1.km - p0.km);
        const isDwell = Math.abs(p1.km - p0.km) < 0.2;
        const stationName = p0.st || p1.st || '';
        return {
          km,
          statusText: isDwell ? (stationName ? `${stationName} 停靠` : '站内停靠') : '区间运行中',
          isDwell,
          station: stationName,
        };
      }
    }
    return null;
  }

  // =========================================================================
  // 3. CorridorDiagram Class Definition
  // =========================================================================

  class CorridorDiagramInstance {
    constructor(containerEl, options) {
      ensureStyles();

      this._container = typeof containerEl === 'string' ? document.getElementById(containerEl) : containerEl;
      if (!this._container) {
        throw new Error('[CorridorDiagram] Target container element not found.');
      }

      this._options = options || {};
      this._onSelectTrain = this._options.onSelectTrain || null;
      this._onHoverTrain = this._options.onHoverTrain || null;
      this._onSeekTime = this._options.onSeekTime || null;

      this._corridor = null;
      this._spanMinutes = 90; // Default rolling time window
      this._panOffsetMin = 0;
      this._lastUserDragTime = 0;

      this._currentT = 720;
      this._selectedTrain = null;
      this._hoveredTrain = null;
      this._themeName = 'dark';

      // Layout Paddings
      this._padT = 32;
      this._padB = 22;
      this._padL = 58;
      this._padR = 32;

      this._isDragging = false;
      this._dragStartX = 0;
      this._dragStartOffset = 0;
      this._hasDragged = false;

      this._stationKmMap = new Map();
      this._hitList = []; // Array of hit testing segments [{ entry, x0, y0, x1, y1 }]

      this._initDOM();
      this._bindEvents();
    }

    _initDOM() {
      this._container.innerHTML = '';
      this._container.classList.add('corridor-dg-wrap');

      // 1. Canvas
      this._canvas = document.createElement('canvas');
      this._canvas.className = 'corridor-dg-canvas';
      this._container.appendChild(this._canvas);
      this._ctx = this._canvas.getContext('2d');

      // 2. Header Bar Overlay (28px height)
      this._headerEl = document.createElement('div');
      this._headerEl.className = 'corridor-dg-header';
      this._headerEl.innerHTML = `
        <div class="corridor-dg-title-wrap">
          <span class="corridor-dg-badge" id="corridor-dg-badge">京津走廊</span>
          <span class="corridor-dg-title" id="corridor-dg-title">实时运行图</span>
        </div>
        <div class="corridor-dg-legend">
          <span class="corridor-dg-pill" style="background:rgba(244,63,94,0.15);color:#f43f5e;border:1px solid rgba(244,63,94,0.35);">
            <span class="corridor-dg-pill-dot" style="background:#f43f5e;"></span>G
          </span>
          <span class="corridor-dg-pill" style="background:rgba(6,182,212,0.15);color:#06b6d4;border:1px solid rgba(6,182,212,0.35);">
            <span class="corridor-dg-pill-dot" style="background:#06b6d4;"></span>C
          </span>
          <span class="corridor-dg-pill" style="background:rgba(20,184,166,0.15);color:#14b8a6;border:1px solid rgba(20,184,166,0.35);">
            <span class="corridor-dg-pill-dot" style="background:#14b8a6;"></span>D
          </span>
          <span class="corridor-dg-pill" style="background:rgba(168,85,247,0.15);color:#a855f7;border:1px solid rgba(168,85,247,0.35);">
            <span class="corridor-dg-pill-dot" style="background:#a855f7;"></span>普
          </span>
        </div>
        <div class="corridor-dg-hint">
          滚轮缩放时间 · 拖拽平移 · 点击车次联动左栏轨道带
        </div>
      `;
      this._container.appendChild(this._headerEl);

      // 3. Tooltip element
      let tip = document.getElementById('corridor-dg-tip');
      if (!tip) {
        tip = document.createElement('div');
        tip.id = 'corridor-dg-tip';
        tip.className = 'corridor-dg-tooltip';
        if (document.body) {
          document.body.appendChild(tip);
        } else {
          this._container.appendChild(tip);
        }
      }
      this._tipEl = tip;
    }

    _bindEvents() {
      // Auto Resize Observer
      if (typeof ResizeObserver !== 'undefined') {
        this._ro = new ResizeObserver(() => {
          this.resize();
        });
        this._ro.observe(this._container);
      }

      // Mouse Move (Hit-Testing & Hover & Cursor)
      this._canvas.addEventListener('mousemove', (e) => this._handleMouseMove(e));

      // Mouse Down (Start Pan)
      this._canvas.addEventListener('mousedown', (e) => this._handleMouseDown(e));

      // Global Mouse Up & Move for Pan Dragging
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        this._boundGlobalMouseMove = (e) => this._handleGlobalMouseMove(e);
        this._boundGlobalMouseUp = (e) => this._handleGlobalMouseUp(e);
        window.addEventListener('mousemove', this._boundGlobalMouseMove);
        window.addEventListener('mouseup', this._boundGlobalMouseUp);
      }

      // Click (Select train or Seek time)
      this._canvas.addEventListener('click', (e) => this._handleClick(e));

      // Wheel (Zoom rolling time window)
      this._canvas.addEventListener('wheel', (e) => this._handleWheel(e), { passive: false });

      // Double Click (Reset zoom & pan to follow NOW playhead)
      this._canvas.addEventListener('dblclick', (e) => this._handleDblClick(e));

      // Mouse Leave (Hide tooltip & clear hover)
      this._canvas.addEventListener('mouseleave', () => {
        if (this._tipEl) this._tipEl.style.display = 'none';
        if (this._hoveredTrain && this._onHoverTrain) {
          this._hoveredTrain = null;
          this._onHoverTrain(null);
          this._render();
        }
      });
    }

    // =======================================================================
    // 4. Public Instance API
    // =======================================================================

    /**
     * Receives precomputed corridor object: { def, stations, maxKm, trains }
     */
    setCorridor(corridorObj) {
      this._corridor = corridorObj || null;
      this._stationKmMap.clear();

      if (this._corridor && Array.isArray(this._corridor.stations)) {
        for (const st of this._corridor.stations) {
          if (st && st.name) {
            this._stationKmMap.set(st.name, st.km);
            if (st.label) this._stationKmMap.set(st.label, st.km);
          }
        }
      }

      // Update header badge & title
      if (this._headerEl) {
        const badgeEl = this._headerEl.querySelector('#corridor-dg-badge');
        const titleEl = this._headerEl.querySelector('#corridor-dg-title');
        const def = (this._corridor && this._corridor.def) || {};
        if (badgeEl) badgeEl.textContent = def.badge || def.title || '走廊';
        if (titleEl) titleEl.textContent = '实时运行图';
      }

      this._render();
    }

    /**
     * Sets rolling time window width in minutes (e.g. 60, 90, 180, 1200)
     */
    setSpan(spanMinutes) {
      if (typeof spanMinutes === 'number' && spanMinutes > 0) {
        this._spanMinutes = spanMinutes;
        this._render();
      }
    }

    getSpan() {
      return this._spanMinutes;
    }

    getCorridor() {
      return this._corridor;
    }

    /**
     * Updates playback time T and selection/hover states, then redraws canvas
     * @param {number} T - Current time in minutes from midnight (0..1440)
     * @param {Object|string|null} selectedTrain
     * @param {Object|string|null} hoveredTrain
     * @param {string|Object} [theme='dark']
     */
    update(T, selectedTrain, hoveredTrain, theme) {
      if (typeof T === 'number' && isFinite(T)) {
        this._currentT = T;
      }
      this._selectedTrain = selectedTrain || null;
      this._hoveredTrain = hoveredTrain || null;

      if (theme) {
        this._themeName = (typeof theme === 'string')
          ? theme
          : (theme.dark === false || theme.light === true ? 'light' : 'dark');
      }

      // If user hasn't dragged in the last 12 seconds, reset panOffsetMin to follow playhead
      if (this._lastUserDragTime > 0 && Date.now() - this._lastUserDragTime > 12000) {
        this._panOffsetMin = 0;
        this._lastUserDragTime = 0;
      }

      this._render();
    }

    resize() {
      if (!this._canvas || !this._container) return;
      const dpr = global.devicePixelRatio || 1;
      const w = this._container.clientWidth || 600;
      const h = this._container.clientHeight || 280;

      const rw = Math.round(w * dpr);
      const rh = Math.round(h * dpr);

      if (this._canvas.width !== rw || this._canvas.height !== rh) {
        this._canvas.width = rw;
        this._canvas.height = rh;
      }
      this._render();
    }

    destroy() {
      if (this._ro) {
        this._ro.disconnect();
        this._ro = null;
      }
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        if (this._boundGlobalMouseMove) window.removeEventListener('mousemove', this._boundGlobalMouseMove);
        if (this._boundGlobalMouseUp) window.removeEventListener('mouseup', this._boundGlobalMouseUp);
      }
      if (this._canvas && this._canvas.parentNode) {
        this._canvas.parentNode.removeChild(this._canvas);
      }
      if (this._headerEl && this._headerEl.parentNode) {
        this._headerEl.parentNode.removeChild(this._headerEl);
      }
    }

    // =======================================================================
    // 5. Internal Coordinate Mapping Helpers
    // =======================================================================

    _getTimeWindow() {
      const span = this._spanMinutes;
      if (span >= 1000) {
        // Full-day mode: 04:00 (240 min) to 24:00 (1440 min)
        return { t0: 240, t1: 1440, span: 1200 };
      }
      // Rolling window mode: current playhead T situated at 28% width
      const t0 = this._currentT - span * 0.28 + this._panOffsetMin;
      const t1 = t0 + span;
      return { t0, t1, span };
    }

    _getDimensions() {
      const dpr = global.devicePixelRatio || 1;
      const w = this._canvas.clientWidth || (this._canvas.width / dpr) || 600;
      const h = this._canvas.clientHeight || (this._canvas.height / dpr) || 280;
      const isCompact = h < 140;
      this._padT = isCompact ? 21 : 32;
      this._padB = isCompact ? 13 : 22;
      this._padL = isCompact ? 50 : 58;
      this._padR = isCompact ? 26 : 32;
      const plotW = Math.max(10, w - this._padL - this._padR);
      const plotH = Math.max(10, h - this._padT - this._padB);

      let maxKm = 120;
      if (this._corridor && typeof this._corridor.maxKm === 'number' && this._corridor.maxKm > 0) {
        maxKm = this._corridor.maxKm;
      } else if (this._corridor && Array.isArray(this._corridor.stations) && this._corridor.stations.length) {
        const lastSt = this._corridor.stations[this._corridor.stations.length - 1];
        if (lastSt && typeof lastSt.km === 'number' && lastSt.km > 0) {
          maxKm = lastSt.km;
        }
      }

      return { w, h, dpr, plotW, plotH, maxKm };
    }

    _xForTime(t, t0, t1, plotW) {
      return this._padL + ((t - t0) / (t1 - t0)) * plotW;
    }

    _timeForX(x, t0, t1, plotW) {
      return t0 + ((x - this._padL) / plotW) * (t1 - t0);
    }

    _yForKm(km, maxKm, plotH) {
      return this._padT + (km / maxKm) * plotH;
    }

    _kmForY(y, maxKm, plotH) {
      return ((y - this._padT) / plotH) * maxKm;
    }

    // =======================================================================
    // 6. Canvas Rendering Pipeline
    // =======================================================================

    _render() {
      if (!this._canvas || !this._ctx) return;
      const ctx = this._ctx;
      const { w, h, dpr, plotW, plotH, maxKm } = this._getDimensions();
      const { t0, t1, span } = this._getTimeWindow();

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const theme = THEMES[this._themeName] || THEMES.dark;
      const isDark = (this._themeName !== 'light');

      // 1. Clear & Background Fill
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = theme.plotBg;
      ctx.fillRect(this._padL, this._padT, plotW, plotH);

      // Empty State Check
      if (!this._corridor || !Array.isArray(this._corridor.stations) || this._corridor.stations.length < 2) {
        ctx.fillStyle = theme.muted;
        ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('正在载入走廊运行图数据…', w / 2, h / 2);
        ctx.restore();
        return;
      }

      const xForTime = (t) => this._xForTime(t, t0, t1, plotW);
      const yForKm = (km) => this._yForKm(km, maxKm, plotH);

      // 2. Past Time Shading [t0, T]
      const nowX = xForTime(this._currentT);
      if (nowX > this._padL) {
        const shadeW = Math.min(plotW, Math.max(0, nowX - this._padL));
        ctx.fillStyle = theme.pastFill;
        ctx.fillRect(this._padL, this._padT, shadeW, plotH);
      }

      // 3. Vertical Time Grid Lines & Bottom HH:MM Axis
      const timeStep = span > 600 ? 60 : span > 240 ? 30 : span > 120 ? 15 : span > 45 ? 10 : 5;
      const startM = Math.ceil(t0 / 5) * 5;

      for (let tm = startM; tm <= t1; tm += 5) {
        const gx = xForTime(tm);
        if (gx < this._padL || gx > this._padL + plotW) continue;

        const isMajor = (tm % timeStep === 0);
        ctx.strokeStyle = isMajor ? theme.gridMajor : theme.gridMinor;
        ctx.lineWidth = isMajor ? 1 : 0.8;
        ctx.beginPath();
        ctx.moveTo(gx + 0.5, this._padT);
        ctx.lineTo(gx + 0.5, this._padT + plotH);
        ctx.stroke();

        if (isMajor) {
          ctx.fillStyle = theme.muted;
          ctx.font = (h < 140 ? '8.5px' : '9.5px') + ' "DIN Alternate", "Bahnschrift", monospace, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(formatTime(tm), gx, this._padT + plotH + (h < 140 ? 7.5 : 13));
        }
      }

      // 4. Horizontal Station Grid Lines & Station Names
      let lastStationY = -999;
      const minStGap = h < 140 ? 9.5 : 11;
      for (const st of this._corridor.stations) {
        const gy = yForKm(st.km);
        if (gy < this._padT - 2 || gy > this._padT + plotH + 2) continue;

        const isMajor = !!st.major;
        ctx.strokeStyle = isMajor ? theme.gridMajor : theme.gridMinor;
        ctx.lineWidth = isMajor ? 1 : 0.8;
        ctx.beginPath();
        ctx.moveTo(this._padL, Math.round(gy) + 0.5);
        ctx.lineTo(this._padL + plotW, Math.round(gy) + 0.5);
        ctx.stroke();

        // Station name on left margin: skip label if within minStGap vertically of previous station label
        if (Math.abs(gy - lastStationY) >= minStGap) {
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.font = isMajor
            ? (h < 140 ? 'bold 9.5px system-ui, -apple-system, sans-serif' : 'bold 11px system-ui, -apple-system, sans-serif')
            : (h < 140 ? '8.5px system-ui, -apple-system, sans-serif' : '10px system-ui, -apple-system, sans-serif');
          ctx.fillStyle = isMajor ? theme.stationMajor : theme.stationMinor;
          ctx.fillText(st.label || st.name, this._padL - 5, gy);
          lastStationY = gy;
        }

        // Official mileage on right margin
        if (Math.abs(gy - lastStationY) < 1 || !isMajor) {
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.font = (h < 140 ? '7.5px' : '8.5px') + ' "DIN Alternate", ui-monospace, monospace, sans-serif';
          ctx.fillStyle = theme.muted;
          ctx.fillText(`${Math.round(st.km)}k`, this._padL + plotW + 3, gy);
        }
      }

      // 5. Train Trajectories & Hit-Testing Cache
      this._hitList = [];
      const trains = this._corridor.trains || [];
      const visibleTrains = [];
      let selectedEntry = null;
      let hoveredEntry = null;

      for (let i = 0; i < trains.length; i++) {
        const entry = trains[i];
        const pts = entry.points;
        if (!pts || pts.length < 2) continue;

        const minT = entry.minT != null ? entry.minT : getPtT(pts[0]);
        const maxT = entry.maxT != null ? entry.maxT : getPtT(pts[pts.length - 1]);

        if (maxT < t0 - 5 || minT > t1 + 5) continue;

        if (isMatchTrain(entry, this._selectedTrain)) {
          selectedEntry = entry;
        } else if (isMatchTrain(entry, this._hoveredTrain)) {
          hoveredEntry = entry;
        } else {
          visibleTrains.push(entry);
        }
      }

      // Clip canvas strictly to plot rectangle for trajectories
      ctx.save();
      ctx.beginPath();
      ctx.rect(this._padL, this._padT, plotW, plotH);
      ctx.clip();

      const isFullDay = (span >= 1000);
      const regularLineWidth = isFullDay ? 0.9 : 1.35;

      // PASS 0: Draw regular background trains (keep full opacity even when a single train is highlighted)
      for (let i = 0; i < visibleTrains.length; i++) {
        const entry = visibleTrains[i];
        this._drawTrainTrajectory(ctx, entry, theme, {
          lineWidth: regularLineWidth,
          alpha: 0.88,
          isHighlight: false,
          xForTime,
          yForKm,
          t0,
          t1,
        });
      }

      // PASS 1: Draw hovered train (if not already selected)
      if (hoveredEntry && hoveredEntry !== selectedEntry) {
        this._drawTrainTrajectory(ctx, hoveredEntry, theme, {
          lineWidth: 2.4,
          alpha: 1.0,
          isHighlight: true,
          isHover: true,
          xForTime,
          yForKm,
          t0,
          t1,
        });
      }

      // PASS 2: Draw selected train on the very top
      if (selectedEntry) {
        this._drawTrainTrajectory(ctx, selectedEntry, theme, {
          lineWidth: 2.8,
          alpha: 1.0,
          isHighlight: true,
          isSelected: true,
          xForTime,
          yForKm,
          t0,
          t1,
        });
      }

      // 6. Draw NOW Playhead Cursor Line
      if (nowX >= this._padL - 1 && nowX <= this._padL + plotW + 1) {
        ctx.strokeStyle = theme.nowLine;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(nowX, this._padT);
        ctx.lineTo(nowX, this._padT + plotH);
        ctx.stroke();

        // Draw active train dots on the NOW playhead (regular first, then hovered/selected on top)
        const activeCandidates = [...visibleTrains, hoveredEntry, selectedEntry].filter(Boolean);
        for (let i = 0; i < activeCandidates.length; i++) {
          const entry = activeCandidates[i];
          const st = getTrainState(entry, this._currentT);
          if (st && typeof st.km === 'number' && st.km >= 0 && st.km <= maxKm) {
            const dy = yForKm(st.km);
            const isSel = (entry === selectedEntry);
            const isHov = (entry === hoveredEntry);
            const cls = resolveTrainClass(entry);
            const color = theme.classes[cls] || theme.classes.O;

            if (isSel || isHov) {
              // Golden glowing pulse dot
              ctx.fillStyle = 'rgba(250, 204, 21, 0.35)';
              ctx.beginPath();
              ctx.arc(nowX, dy, 7.5, 0, Math.PI * 2);
              ctx.fill();

              ctx.fillStyle = '#facc15';
              ctx.beginPath();
              ctx.arc(nowX, dy, 4.2, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1.5;
              ctx.stroke();
            } else {
              // Regular crisp train dot
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(nowX, dy, 2.8, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 0.8;
              ctx.stroke();
            }
          }
        }
      }

      ctx.restore(); // Restore clipping

      // 7. Plot Outer Border & Playhead Header Badge
      ctx.strokeStyle = theme.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(this._padL + 0.5, this._padT + 0.5, plotW, plotH);

      if (nowX >= this._padL && nowX <= this._padL + plotW) {
        const timeBadgeText = formatTime(this._currentT);
        ctx.font = (h < 140 ? 'bold 8.5px' : 'bold 9.5px') + ' "DIN Alternate", "Bahnschrift", monospace, sans-serif';
        const tbw = ctx.measureText(timeBadgeText).width;
        const bh = h < 140 ? 11 : 12;
        const by = h < 140 ? (this._padT + plotH + 1) : (this._padT - bh - 1);
        ctx.fillStyle = theme.nowLine;
        drawRoundRect(ctx, nowX - tbw / 2 - 3.5, by, tbw + 7, bh, 2.5);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(timeBadgeText, nowX, by + bh / 2);
      }

      ctx.restore();
    }

    /**
     * Draws an individual train trajectory polyline, labels, wait dwells, and highlights
     */
    _drawTrainTrajectory(ctx, entry, theme, opts) {
      const { lineWidth, alpha, isHighlight, isSelected, isHover, xForTime, yForKm, t0, t1 } = opts;
      const pts = entry.points;
      if (!pts || pts.length < 2) return;

      const cls = resolveTrainClass(entry);
      const lineColor = theme.classes[cls] || theme.classes.O;

      // 1. Draw outer halo glow for highlighted train
      if (isHighlight) {
        ctx.save();
        ctx.lineWidth = 5.5;
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < pts.length; i++) {
          const p = getPt(pts[i]);
          const px = xForTime(p.t);
          const py = yForKm(p.km);
          if (!started) { ctx.moveTo(px, py); started = true; } else { ctx.lineTo(px, py); }
        }
        ctx.stroke();
        ctx.restore();
      }

      // 2. Draw core trajectory polyline
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.lineWidth = isHighlight ? (isSelected ? 2.8 : 2.5) : lineWidth;
      ctx.strokeStyle = isHighlight ? '#facc15' : lineColor;
      ctx.beginPath();
      let started = false;

      let longestDiagSeg = null;
      let maxDiagLen = 0;

      for (let i = 0; i < pts.length; i++) {
        const p = getPt(pts[i]);
        const px = xForTime(p.t);
        const py = yForKm(p.km);
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);

          const prev = getPt(pts[i - 1]);
          const prevX = xForTime(prev.t);
          const prevY = yForKm(prev.km);

          // Record segment for interactive hit-testing
          this._hitList.push({
            entry,
            x0: prevX,
            y0: prevY,
            x1: px,
            y1: py,
          });

          // Check if segment is diagonal (moving between stations, not dwelling)
          if (Math.abs(p.km - prev.km) > 0.5 && Math.abs(p.t - prev.t) > 0.2) {
            const segT0 = Math.max(prev.t, t0 + 2);
            const segT1 = Math.min(p.t, t1 - 2);
            if (segT1 > segT0) {
              const r0 = (segT0 - prev.t) / (p.t - prev.t);
              const r1 = (segT1 - prev.t) / (p.t - prev.t);
              const sx0 = xForTime(segT0);
              const sy0 = yForKm(prev.km + r0 * (p.km - prev.km));
              const sx1 = xForTime(segT1);
              const sy1 = yForKm(prev.km + r1 * (p.km - prev.km));
              const len = Math.hypot(sx1 - sx0, sy1 - sy0);
              if (len > maxDiagLen) {
                maxDiagLen = len;
                longestDiagSeg = {
                  p0: prev,
                  p1: p,
                  mx: (sx0 + sx1) / 2,
                  my: (sy0 + sy1) / 2,
                  angle: Math.atan2(sy1 - sy0, sx1 - sx0),
                };
              }
            }
          }
        }
      }
      ctx.stroke();
      ctx.restore();

      // 3. Highlight wait / overtaking dwell steps (待避 / 会车)
      const stops = entry.stops || (entry.tr && entry.tr.s) || [];
      if (Array.isArray(stops)) {
        for (let i = 0; i < stops.length; i++) {
          const st = normalizeStop(stops[i], this._stationKmMap);
          if (st && st.isWait && st.tDep != null && st.tArr != null && st.tDep > st.tArr) {
            const sx0 = xForTime(st.tArr);
            const sx1 = xForTime(st.tDep);
            const sy = yForKm(st.km);

            if (sx1 >= this._padL && sx0 <= this._padL + this._getDimensions().plotW) {
              ctx.save();
              // Amber dwell step line
              ctx.strokeStyle = '#f59e0b';
              ctx.lineWidth = isHighlight ? 3.4 : 2.5;
              ctx.beginPath();
              ctx.moveTo(sx0, sy);
              ctx.lineTo(sx1, sy);
              ctx.stroke();

              // Compact callout tag: ⏸ 待避
              const tagX = (sx0 + sx1) / 2;
              const tagY = sy - 6;
              const waitTagText = `⏸ ${st.waitTitle || '待避'}`;

              ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
              const wtw = ctx.measureText(waitTagText).width;
              const pw = wtw + 8;
              const ph = 12;

              ctx.fillStyle = theme.pillBg;
              drawRoundRect(ctx, tagX - pw / 2, tagY - ph, pw, ph, 2.5);
              ctx.fill();
              ctx.strokeStyle = '#f59e0b';
              ctx.lineWidth = 0.8;
              ctx.stroke();

              ctx.fillStyle = '#f59e0b';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(waitTagText, tagX, tagY - ph / 2);
              ctx.restore();
            }
          }
        }
      }

      // 4. Rotated Train Number Label along the Diagonal Line
      const trainCode = entry.code || (entry.tr && entry.tr.c ? entry.tr.c.split('/')[0] : '');
      if (trainCode && longestDiagSeg && maxDiagLen >= 26) {
        ctx.save();
        ctx.translate(longestDiagSeg.mx, longestDiagSeg.my);
        ctx.rotate(longestDiagSeg.angle);

        ctx.font = 'bold 9.5px "DIN Alternate", "Bahnschrift", ui-monospace, sans-serif';
        const tw = ctx.measureText(trainCode).width;
        const pw = tw + 8;
        const ph = 13;

        ctx.fillStyle = theme.pillBg;
        drawRoundRect(ctx, -pw / 2, -ph / 2, pw, ph, 3);
        ctx.fill();

        ctx.strokeStyle = isHighlight ? '#facc15' : lineColor;
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = 0.65;
        ctx.stroke();

        ctx.globalAlpha = 1.0;
        ctx.fillStyle = isHighlight ? '#facc15' : lineColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(trainCode, 0, 0.5);
        ctx.restore();
      }

      // 5. Selected / Hovered Train Details: Stop Times & Prominent Floating Tag
      if (isHighlight) {
        this._drawHighlightDetails(ctx, entry, theme, { xForTime, yForKm });
      }
    }

    /**
     * Draws stop time badges and floating status tag for selected or hovered train
     */
    _drawHighlightDetails(ctx, entry, theme, { xForTime, yForKm }) {
      const stops = entry.stops || (entry.tr && entry.tr.s) || [];
      const trainCode = entry.code || (entry.tr && entry.tr.c ? entry.tr.c.split('/')[0] : '');
      const st = getTrainState(entry, this._currentT);

      // 1. Stop time labels (HH:MM) at each corridor station stop
      if (Array.isArray(stops)) {
        for (let i = 0; i < stops.length; i++) {
          const stop = normalizeStop(stops[i], this._stationKmMap);
          if (!stop || stop.tArr == null) continue;

          const sx = xForTime(stop.tArr);
          const sy = yForKm(stop.km);
          const { plotW, plotH } = this._getDimensions();

          if (sx >= this._padL && sx <= this._padL + plotW && sy >= this._padT && sy <= this._padT + plotH) {
            // Station stop dot
            ctx.fillStyle = '#facc15';
            ctx.beginPath();
            ctx.arc(sx, sy, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Dwell stop time badge
            const timeTxt = (stop.tDep && stop.tDep !== stop.tArr)
              ? `${formatTime(stop.tArr)}-${formatTime(stop.tDep)}`
              : formatTime(stop.tArr);

            ctx.font = '8.5px "DIN Alternate", ui-monospace, monospace, sans-serif';
            const stw = ctx.measureText(timeTxt).width;
            const bpw = stw + 6;
            const bph = 11;

            ctx.fillStyle = theme.pillBg;
            drawRoundRect(ctx, sx - bpw / 2, sy - 14, bpw, bph, 2);
            ctx.fill();
            ctx.strokeStyle = '#facc15';
            ctx.lineWidth = 0.7;
            ctx.stroke();

            ctx.fillStyle = '#facc15';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(timeTxt, sx, sy - 8.5);
          }
        }
      }

      // 2. Prominent floating tag: ★ ${entry.code} · ${st ? st.statusText : entry.model}
      const model = entry.model || (entry.tr && entry.tr.m) || '高速动车组';
      const statusDesc = st && st.statusText ? st.statusText : model;
      const tagText = `★ ${trainCode} · ${statusDesc}`;

      let tagX, tagY;
      if (st && typeof st.km === 'number') {
        tagX = xForTime(this._currentT) + 12;
        tagY = yForKm(st.km) - 14;
      } else if (entry.points && entry.points.length) {
        const midPt = getPt(entry.points[Math.floor(entry.points.length / 2)]);
        tagX = xForTime(midPt.t) + 12;
        tagY = yForKm(midPt.km) - 14;
      } else {
        tagX = this._padL + 20;
        tagY = this._padT + 20;
      }

      const { plotW, plotH } = this._getDimensions();
      ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      const tagW = ctx.measureText(tagText).width + 12;
      const tagH = 17;

      // Keep tag inside plot viewport
      if (tagX + tagW > this._padL + plotW - 4) tagX = tagX - tagW - 24;
      if (tagX < this._padL + 4) tagX = this._padL + 4;
      if (tagY < this._padT + 4) tagY = this._padT + 16;
      if (tagY + tagH > this._padT + plotH - 4) tagY = this._padT + plotH - 20;

      ctx.save();
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#090e1a';
      drawRoundRect(ctx, tagX, tagY - tagH / 2, tagW, tagH, 4);
      ctx.fill();

      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.fillStyle = '#facc15';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(tagText, tagX + 6, tagY);
      ctx.restore();
    }

    // =======================================================================
    // 7. Interactive Hit-Testing & Event Handlers
    // =======================================================================

    _findClosestTrain(mx, my, maxDistPx) {
      let closestEntry = null;
      let minDist = maxDistPx;

      for (let i = 0; i < this._hitList.length; i++) {
        const item = this._hitList[i];
        const dist = distToSegment(mx, my, item.x0, item.y0, item.x1, item.y1);
        if (dist < minDist) {
          minDist = dist;
          closestEntry = item.entry;
        }
      }
      return closestEntry;
    }

    _handleMouseMove(e) {
      if (this._isDragging) return;

      const rect = this._canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { plotW, plotH, maxKm } = this._getDimensions();
      const { t0, t1 } = this._getTimeWindow();

      // Check if hovering bottom time axis
      if (my >= this._padT + plotH - 2 && my <= this._padT + plotH + 20) {
        this._canvas.style.cursor = 'pointer';
        return;
      }

      // Hit-test train trajectories within 8px
      const hovered = this._findClosestTrain(mx, my, 8);

      if (hovered) {
        this._canvas.style.cursor = 'pointer';

        if (this._hoveredTrain !== (hovered.tr || hovered)) {
          this._hoveredTrain = (hovered.tr || hovered);
          if (this._onHoverTrain) this._onHoverTrain(this._hoveredTrain);
          this._render();
        }

        // Show floating tooltip
        this._showTooltip(e, hovered, mx, my, { t0, t1, plotW, plotH, maxKm });
      } else {
        this._canvas.style.cursor = 'grab';

        if (this._tipEl) this._tipEl.style.display = 'none';

        if (this._hoveredTrain) {
          this._hoveredTrain = null;
          if (this._onHoverTrain) this._onHoverTrain(null);
          this._render();
        }
      }
    }

    _showTooltip(e, entry, mx, my, { t0, t1, plotW, maxKm }) {
      if (!this._tipEl) return;

      const cursorT = this._timeForX(mx, t0, t1, plotW);
      const cursorKm = this._kmForY(my, maxKm, this._getDimensions().plotH);
      const cursorTimeStr = formatTime(cursorT);

      const code = entry.code || (entry.tr && entry.tr.c) || '车次';
      const fullCode = entry.fullCode || code;
      const origin = entry.origin || (entry.tr && entry.tr.from) || '';
      const dest = entry.dest || (entry.tr && entry.tr.to) || '';
      const odText = (origin && dest) ? `${origin} → ${dest}` : (entry.tr && entry.tr.od) || '';
      const model = entry.model || (entry.tr && entry.tr.m) || '';

      const st = getTrainState(entry, cursorT);

      // Check if cursor is near any wait stop
      let waitInfo = '';
      const stops = entry.stops || (entry.tr && entry.tr.s) || [];
      if (Array.isArray(stops)) {
        for (const s of stops) {
          const norm = normalizeStop(s, this._stationKmMap);
          if (norm && norm.isWait && norm.tArr != null && norm.tDep != null) {
            if (cursorT >= norm.tArr - 10 && cursorT <= norm.tDep + 10) {
              waitInfo = `在 ${norm.name} 待避 (${formatTime(norm.tArr)}~${formatTime(norm.tDep)})`;
              break;
            }
          }
        }
      }

      const cls = resolveTrainClass(entry);
      const theme = THEMES[this._themeName] || THEMES.dark;
      const color = theme.classes[cls] || theme.classes.O;

      this._tipEl.innerHTML = `
        <div style="font-weight:700; font-size:12px; display:flex; align-items:center; gap:6px;">
          <span style="color:${color}; font-size:13px;">${fullCode}</span>
          ${odText ? `<span style="font-size:11px; color:#cbd5e1; opacity:0.9;">(${odText})</span>` : ''}
        </div>
        <div style="font-size:11px; color:#94a3b8; margin-top:3px; display:flex; align-items:center; gap:6px;">
          ${model ? `<span style="background:rgba(255,255,255,0.1); padding:1px 4px; border-radius:3px; color:#e2e8f0; font-size:10px;">${model}</span>` : ''}
          <span>时刻: <b style="color:#f1f5f9;">${cursorTimeStr}</b></span>
          <span>里程: <b style="color:#f1f5f9;">${Math.round(cursorKm)}km</b></span>
        </div>
        ${st && st.statusText ? `<div style="font-size:10.5px; color:#38bdf8; margin-top:3px;">📍 ${st.statusText}</div>` : ''}
        ${waitInfo ? `<div style="font-size:10.5px; color:#f59e0b; margin-top:3px; font-weight:600;">⏸ ${waitInfo}</div>` : ''}
      `;

      this._tipEl.style.display = 'block';
      this._tipEl.style.left = `${e.clientX}px`;
      this._tipEl.style.top = `${e.clientY - 12}px`;
    }

    _handleMouseDown(e) {
      if (e.button !== 0) return; // Left mouse button only

      const rect = this._canvas.getBoundingClientRect();
      const my = e.clientY - rect.top;
      const { plotH } = this._getDimensions();

      // Don't drag if clicking bottom seek bar
      if (my >= this._padT + plotH - 2) return;

      this._isDragging = true;
      this._hasDragged = false;
      this._dragStartX = e.clientX;
      this._dragStartOffset = this._panOffsetMin;
      this._canvas.classList.add('is-dragging');
    }

    _handleGlobalMouseMove(e) {
      if (!this._isDragging) return;

      const dx = e.clientX - this._dragStartX;
      if (Math.abs(dx) > 3) {
        this._hasDragged = true;
      }

      const { plotW } = this._getDimensions();
      const { span } = this._getTimeWindow();

      // Convert horizontal pixel drag delta to minutes
      const dt = -dx * (span / plotW);
      this._panOffsetMin = this._dragStartOffset + dt;
      this._lastUserDragTime = Date.now();
      this._render();
    }

    _handleGlobalMouseUp() {
      if (this._isDragging) {
        this._isDragging = false;
        this._canvas.classList.remove('is-dragging');
      }
    }

    _handleClick(e) {
      if (this._hasDragged) return; // Avoid triggering click after dragging

      const rect = this._canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { plotW, plotH } = this._getDimensions();
      const { t0, t1 } = this._getTimeWindow();

      // 1. Bottom time axis seek bar or Shift+Click seek
      if (my >= this._padT + plotH - 4 || e.shiftKey) {
        const clickedTime = Math.round(this._timeForX(mx, t0, t1, plotW));
        if (this._onSeekTime && isFinite(clickedTime)) {
          this._onSeekTime(clickedTime);
        }
        return;
      }

      // 2. Trajectory click selection within 10px
      const clicked = this._findClosestTrain(mx, my, 10);
      if (clicked) {
        const trObj = clicked.tr || clicked;
        this._selectedTrain = trObj;
        if (this._onSelectTrain) this._onSelectTrain(trObj);
        this._render();
      } else {
        // Clicked empty plot area: deselect
        if (this._selectedTrain) {
          this._selectedTrain = null;
          if (this._onSelectTrain) this._onSelectTrain(null);
          this._render();
        }
      }
    }

    _handleWheel(e) {
      e.preventDefault();

      const zoomFactor = e.deltaY > 0 ? 1.18 : 0.84;
      const currentSpan = this._spanMinutes;
      const newSpan = Math.max(30, Math.min(1200, Math.round(currentSpan * zoomFactor)));

      if (newSpan !== currentSpan) {
        this.setSpan(newSpan);
      }
    }

    _handleDblClick() {
      // Reset zoom and pan offset to follow playhead
      this._panOffsetMin = 0;
      this._lastUserDragTime = 0;
      this._spanMinutes = 90;
      this._render();
    }
  }

  // =========================================================================
  // 8. Module Exports & Factory
  // =========================================================================

  const CorridorDiagram = {
    /**
     * Creates and attaches a CorridorDiagram instance to containerEl
     * @param {HTMLElement|string} containerEl
     * @param {Object} options - { onSelectTrain, onHoverTrain, onSeekTime }
     * @returns {CorridorDiagramInstance}
     */
    createInstance(containerEl, options) {
      return new CorridorDiagramInstance(containerEl, options);
    },
    THEMES,
  };

  global.CorridorDiagram = CorridorDiagram;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CorridorDiagram;
  }
})(typeof window !== 'undefined' ? window : globalThis);
