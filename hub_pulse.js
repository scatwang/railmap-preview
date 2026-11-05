/**
 * hub_pulse.js - Component B + E: 24h Traffic Heartbeat Waveform & 8-Station Pulse Bars
 *
 * Chinese Railway Hub HUD System (CR-HUD)
 * Provides window.HubPulse with:
 *   - init(hubConfig, STBY, D)
 *   - update(containerEl, T, theme)
 *   - setMode({ wave, stations })
 *   - getMode()
 *   - invalidate()
 */

(function (global) {
  'use strict';

  // ---------------------------------------------------------------------------
  // 1. Color Palettes & Constants
  // ---------------------------------------------------------------------------
  const WAVE_COLORS = {
    light: {
      G: '#2563eb', // 高速: Royal Blue
      C: '#0891b2', // 城际/市域: Cyan
      D: '#0d9488', // 动车: Teal
      P: '#d97706', // 普速: Amber/Orange
      playhead: '#0284c7',
      contour: 'rgba(15, 23, 42, 0.70)',
      grid: 'rgba(28, 36, 43, 0.10)',
      text: '#94a3b8'
    },
    dark: {
      G: '#3b82f6', // 高速: Sky Blue
      C: '#06b6d4', // 城际/市域: Vivid Cyan
      D: '#14b8a6', // 动车: Teal
      P: '#f59e0b', // 普速: Bright Amber
      playhead: '#38bdf8',
      contour: 'rgba(255, 255, 255, 0.80)',
      grid: 'rgba(255, 255, 255, 0.10)',
      text: '#64748b'
    }
  };

  const NUM_BUCKETS = 289; // 0..288 (t = 0, 5, 10, ... 1440)
  const BUCKET_STEP = 5;

  // ---------------------------------------------------------------------------
  // 2. CSS Injection for Sleek Glassmorphic Styling
  // ---------------------------------------------------------------------------
  const STYLE_ID = 'hub-pulse-styles';
  function injectStyles() {
    if (typeof document === 'undefined' || !document.createElement || !document.head) return;
    if (document.getElementById(STYLE_ID)) return;

    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
      .hub-pulse-panel {
        width: 280px;
        box-sizing: border-box;
        border-radius: 8px;
        padding: 9px 11px 9px 11px;
        font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
        font-size: 11px;
        line-height: 1.35;
        backdrop-filter: blur(14px) saturate(160%);
        -webkit-backdrop-filter: blur(14px) saturate(160%);
        user-select: none;
        pointer-events: auto;
        transition: background 0.25s ease, border-color 0.25s ease, color 0.25s ease, box-shadow 0.25s ease;
      }

      /* Light Theme (图纸米白) */
      .hub-pulse-panel,
      .hub-pulse-panel.light {
        background: rgba(245, 243, 236, 0.88);
        border: 1px solid rgba(28, 36, 43, 0.14);
        color: #1c242b;
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.08);
      }

      /* Dark Theme (调度暗黑) */
      .hub-pulse-panel.dark,
      html.dark .hub-pulse-panel {
        background: rgba(13, 20, 34, 0.88);
        border: 1px solid rgba(255, 255, 255, 0.14);
        color: #f1f5f9;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.42);
      }

      /* Section Headers */
      .hub-pulse-sec-hdr {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        margin-bottom: 5px;
      }
      .hub-pulse-sec-title {
        font-size: 11.5px;
        font-weight: 700;
        letter-spacing: 0.03em;
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .hub-pulse-sec-en {
        font-size: 8.5px;
        font-weight: 600;
        letter-spacing: 0.06em;
        color: #64748b;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      html.dark .hub-pulse-sec-en,
      .hub-pulse-panel.dark .hub-pulse-sec-en {
        color: #94a3b8;
      }

      /* Part 1: Live Breakdown Badge */
      .hub-pulse-badge-row {
        margin-bottom: 4px;
        font-size: 9.8px;
        font-variant-numeric: tabular-nums;
        color: #475569;
        display: flex;
        align-items: center;
        justify-content: space-between;
        white-space: nowrap;
        overflow: hidden;
      }
      html.dark .hub-pulse-badge-row,
      .hub-pulse-panel.dark .hub-pulse-badge-row {
        color: #cbd5e1;
      }
      .hub-pulse-badge-row b {
        font-weight: 700;
        color: inherit;
      }
      .hp-tag {
        font-weight: 600;
      }
      .hp-tag-g { color: #2563eb; }
      .hp-tag-c { color: #0891b2; }
      .hp-tag-d { color: #0d9488; }
      .hp-tag-p { color: #d97706; }
      html.dark .hp-tag-g, .hub-pulse-panel.dark .hp-tag-g { color: #38bdf8; }
      html.dark .hp-tag-c, .hub-pulse-panel.dark .hp-tag-c { color: #22d3ee; }
      html.dark .hp-tag-d, .hub-pulse-panel.dark .hp-tag-d { color: #2dd4bf; }
      html.dark .hp-tag-p, .hub-pulse-panel.dark .hp-tag-p { color: #fbbf24; }
      .hp-sep {
        color: rgba(148, 163, 184, 0.6);
        padding: 0 1px;
      }

      /* Wave Canvas */
      .hub-pulse-canvas-wrap {
        position: relative;
        width: 260px;
        height: 82px;
        border-radius: 4px;
        overflow: hidden;
        background: rgba(128, 128, 128, 0.05);
      }
      .hub-pulse-canvas {
        display: block;
        width: 260px;
        height: 82px;
      }

      /* Divider */
      .hub-pulse-divider {
        height: 1px;
        margin: 7px 0 6px 0;
        background: rgba(28, 36, 43, 0.10);
      }
      html.dark .hub-pulse-divider,
      .hub-pulse-panel.dark .hub-pulse-divider {
        background: rgba(255, 255, 255, 0.10);
      }

      /* Part 2: Station Rows */
      .hub-pulse-stations-list {
        display: flex;
        flex-direction: column;
        gap: 1px;
      }
      .hub-pulse-station-row {
        height: 22px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 7px;
      }
      .hub-pulse-st-name {
        width: 50px;
        flex-shrink: 0;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.02em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .hub-pulse-bar-wrap {
        flex: 1;
        height: 4.5px;
        border-radius: 999px;
        background: rgba(128, 128, 128, 0.18);
        position: relative;
        overflow: visible;
      }
      html.dark .hub-pulse-bar-wrap,
      .hub-pulse-panel.dark .hub-pulse-bar-wrap {
        background: rgba(255, 255, 255, 0.14);
      }
      .hub-pulse-bar-fill {
        height: 100%;
        border-radius: 999px;
        background: #2563eb;
        width: 0%;
        transition: width 0.12s linear;
      }
      html.dark .hub-pulse-bar-fill,
      .hub-pulse-panel.dark .hub-pulse-bar-fill {
        background: #38bdf8;
      }
      .hub-pulse-bar-tip {
        position: absolute;
        top: 50%;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        transform: translate(-50%, -50%);
        pointer-events: none;
        transition: left 0.12s linear, background-color 0.2s ease, box-shadow 0.2s ease;
      }
      .hub-pulse-st-stats {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 10px;
        font-family: "DIN Alternate", ui-monospace, SFMono-Regular, monospace;
        font-variant-numeric: tabular-nums;
        color: #475569;
        min-width: 62px;
        justify-content: flex-end;
      }
      html.dark .hub-pulse-st-stats,
      .hub-pulse-panel.dark .hub-pulse-st-stats {
        color: #cbd5e1;
      }
      .hub-pulse-st-stats b {
        color: inherit;
        font-weight: 700;
      }

      /* Live Dot Beacon */
      .hub-pulse-live-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: rgba(148, 163, 184, 0.35);
        flex-shrink: 0;
        transition: background-color 0.2s ease, box-shadow 0.2s ease;
      }
      .hub-pulse-live-dot.active {
        background: #10b981;
        box-shadow: 0 0 6px #10b981;
        animation: hub-pulse-beacon 1.2s ease-in-out infinite;
      }

      @keyframes hub-pulse-beacon {
        0% { transform: scale(0.9); opacity: 0.8; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.75); }
        70% { transform: scale(1.25); opacity: 1; box-shadow: 0 0 0 4.5px rgba(16, 185, 129, 0); }
        100% { transform: scale(0.9); opacity: 0.8; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
      }

      /* Independent Mode Toggles */
      .hub-pulse-panel.hp-hide-wave .hub-pulse-wave-sec,
      .hub-pulse-panel.hp-hide-wave .hub-pulse-divider {
        display: none !important;
      }
      .hub-pulse-panel.hp-hide-stations .hub-pulse-stations-sec,
      .hub-pulse-panel.hp-hide-stations .hub-pulse-divider {
        display: none !important;
      }
    `;
    document.head.appendChild(styleEl);
  }

  // ---------------------------------------------------------------------------
  // 3. Train Classification & Geometry Utilities
  // ---------------------------------------------------------------------------

  /**
   * Classify train into 4 stacked categories:
   *   'G': 高速 (G-prefix)
   *   'C': 城际/市域 (C-prefix, S-prefix)
   *   'D': 动车 (D-prefix)
   *   'P': 普速 (Z, T, K, Y, numericals, others)
   */
  function getTrainCategory(tr) {
    if (!tr) return 'P';
    const code = (tr.c || tr.code || tr.train_no || '').split('/')[0].trim().toUpperCase();
    const c0 = code[0];
    if (c0 === 'G') return 'G';
    if (c0 === 'C' || c0 === 'S') return 'C';
    if (c0 === 'D') return 'D';
    return 'P';
  }

  /**
   * Precompute which track geometries intersect the hub bounding box
   */
  function precomputeGeomBbox(G, geoms, bbox) {
    const arr = G || geoms;
    if (!arr || !bbox) return null;
    const res = new Uint8Array(arr.length);
    const [w, s, e, n] = bbox;
    for (let i = 0; i < arr.length; i++) {
      const g = arr[i];
      if (!g) continue;
      if (g.lon && g.lat) {
        const lons = g.lon, lats = g.lat;
        for (let j = 0; j < lons.length; j++) {
          const x = lons[j], y = lats[j];
          if (x >= w && x <= e && y >= s && y <= n) {
            res[i] = 1;
            break;
          }
        }
      } else if (Array.isArray(g)) {
        for (let j = 0; j < g.length; j++) {
          const p = g[j];
          const x = p[1], y = p[2];
          if (x >= w && x <= e && y >= s && y <= n) {
            res[i] = 1;
            break;
          }
        }
      }
    }
    return res;
  }

  // ---------------------------------------------------------------------------
  // 4. Binary Search Helpers for Fast Runtime Querying
  // ---------------------------------------------------------------------------

  function countEventsLe(events, T) {
    let low = 0, high = events.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (events[mid].time <= T) low = mid + 1;
      else high = mid;
    }
    return low;
  }

  function countEventsBetween(events, t0, t1) {
    let low0 = 0, high0 = events.length;
    while (low0 < high0) {
      const mid = (low0 + high0) >>> 1;
      if (events[mid].time < t0) low0 = mid + 1;
      else high0 = mid;
    }
    let low1 = 0, high1 = events.length;
    while (low1 < high1) {
      const mid = (low1 + high1) >>> 1;
      if (events[mid].time <= t1) low1 = mid + 1;
      else high1 = mid;
    }
    return Math.max(0, low1 - low0);
  }

  // ---------------------------------------------------------------------------
  // 5. HubPulse Engine Implementation
  // ---------------------------------------------------------------------------

  let _config = null;
  let _stby = null;
  let _data = null;

  // Waveform precomputations
  let _buckets = [];          // 289 items: { G, C, D, P, total, time }
  let _minuteG = null;        // Uint16Array(1441)
  let _minuteC = null;
  let _minuteD = null;
  let _minuteP = null;
  let _maxWaveTotal = 1;
  let _maxScale = 10;

  // Station pulse precomputations: map of stName -> { events, dwells, totalEv, maxHourly }
  let _stationStats = {};

  // Display modes
  let _mode = {
    wave: true,
    stations: true
  };

  // DOM caching
  let _container = null;
  let _domReady = false;
  let _canvasEl = null;
  let _badgeEl = null;
  let _stDomMap = {};
  let _lastRenderedMinute = -1;
  let _lastRenderedTheme = null;

  const HubPulse = {
    /**
     * Precompute 24h waveform buckets and major station activity
     * @param {Object} hubConfig Configuration from HUB_CONFIGS (bbox, majorStations, minorStations)
     * @param {Object} STBY Station coordinate lookup map
     * @param {Object} D Timetable and geometry dataset
     */
    init(hubConfig, STBY, D) {
      _config = hubConfig || {};
      _stby = STBY || {};
      _data = D || {};

      this.invalidate();

      const bbox = _config.bbox || [115.85, 38.92, 117.75, 40.25];
      const majorStations = _config.majorStations || [];
      const minorStations = _config.minorStations || [];
      const allHubStations = new Set([...majorStations, ...minorStations]);

      const trains = (D && Array.isArray(D.trains)) ? D.trains : [];
      const G = (D && (D._G || D.geoms)) || (typeof window !== 'undefined' ? window.G : null);

      // Fast geometry check against bbox
      const geomTouches = precomputeGeomBbox(G, D && D.geoms, bbox);

      // Initialize minute arrays
      _minuteG = new Uint16Array(1441);
      _minuteC = new Uint16Array(1441);
      _minuteD = new Uint16Array(1441);
      _minuteP = new Uint16Array(1441);

      // 1. Process active train intervals for waveform
      for (let ti = 0; ti < trains.length; ti++) {
        const tr = trains[ti];
        const intervals = [];

        // Legs inside bbox
        if (Array.isArray(tr.l) && geomTouches) {
          for (let li = 0; li < tr.l.length; li++) {
            const leg = tr.l[li];
            if (!leg) continue;
            const t0 = leg[1], t1 = leg[2];
            if (t1 < 0 || t0 > 1440) continue;
            if (geomTouches[leg[0]] === 1) {
              intervals.push([Math.max(0, t0), Math.min(1440, t1)]);
            }
          }
        }

        // Dwell stops at hub stations
        if (Array.isArray(tr.s)) {
          for (let si = 0; si < tr.s.length; si++) {
            const s = tr.s[si];
            if (allHubStations.has(s[0])) {
              const arr = s[1], dep = s[2];
              if (arr != null && dep != null) {
                intervals.push([Math.max(0, arr), Math.min(1440, dep)]);
              } else if (arr != null) {
                intervals.push([Math.max(0, arr - 5), Math.min(1440, arr + 5)]);
              } else if (dep != null) {
                intervals.push([Math.max(0, dep - 5), Math.min(1440, dep + 5)]);
              }
            }
          }
        }

        if (!intervals.length) continue;

        // Merge overlapping intervals for this train
        intervals.sort((a, b) => a[0] - b[0]);
        const merged = [];
        for (let ii = 0; ii < intervals.length; ii++) {
          const iv = intervals[ii];
          if (!merged.length || iv[0] > merged[merged.length - 1][1]) {
            merged.push(iv);
          } else {
            merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], iv[1]);
          }
        }

        const cat = getTrainCategory(tr);
        const targetArr = (cat === 'G') ? _minuteG : (cat === 'C') ? _minuteC : (cat === 'D') ? _minuteD : _minuteP;

        for (let mi = 0; mi < merged.length; mi++) {
          const sM = Math.max(0, Math.floor(merged[mi][0]));
          const eM = Math.min(1440, Math.ceil(merged[mi][1]));
          for (let m = sM; m <= eM; m++) {
            targetArr[m]++;
          }
        }
      }

      // Build 289 5-minute waveform buckets
      _buckets = new Array(NUM_BUCKETS);
      let maxTot = 0;
      for (let i = 0; i < NUM_BUCKETS; i++) {
        const t = i * BUCKET_STEP;
        const g = _minuteG[t];
        const c = _minuteC[t];
        const d = _minuteD[t];
        const p = _minuteP[t];
        const tot = g + c + d + p;
        if (tot > maxTot) maxTot = tot;
        _buckets[i] = { G: g, C: c, D: d, P: p, total: tot, time: t };
      }
      _maxWaveTotal = Math.max(1, maxTot);
      // Headroom for visual elegance
      _maxScale = Math.ceil((_maxWaveTotal * 1.15) / 10) * 10;
      if (_maxScale < 10) _maxScale = 10;

      // 2. Precompute major station events and dwell periods
      _stationStats = {};
      for (let si = 0; si < majorStations.length; si++) {
        _stationStats[majorStations[si]] = { events: [], dwells: [], totalEv: 0, maxHourly: 1 };
      }

      for (let ti = 0; ti < trains.length; ti++) {
        const tr = trains[ti];
        if (!Array.isArray(tr.s) || tr.s.length === 0) continue;
        const nStops = tr.s.length;

        for (let si = 0; si < nStops; si++) {
          const [stName, arrVal, depVal] = tr.s[si];
          const stObj = _stationStats[stName];
          if (!stObj) continue;

          const beg = (si === 0);
          const end = (si === nStops - 1);
          const a = (arrVal != null && arrVal !== '') ? Number(arrVal) : null;
          const d = (depVal != null && depVal !== '') ? Number(depVal) : null;

          // Arrival event
          if (a != null && a >= 0 && a <= 1440 && !beg) {
            stObj.events.push({ time: a, type: 'arr', tr });
          }
          // Departure event
          if (d != null && d >= 0 && d <= 1440 && !end) {
            stObj.events.push({ time: d, type: 'dep', tr });
          }

          const dwellArr = (a != null) ? a : d;
          const dwellDep = (d != null) ? d : a;
          stObj.dwells.push({
            arr: dwellArr,
            dep: dwellDep,
            hasArr: (a != null && !beg),
            hasDep: (d != null && !end),
            tr
          });
        }
      }

      for (let si = 0; si < majorStations.length; si++) {
        const stName = majorStations[si];
        const stObj = _stationStats[stName];
        stObj.events.sort((x, y) => x.time - y.time);
        stObj.totalEv = stObj.events.length;

        // Slide 60-min window every 5 minutes to find max hourly intensity
        let maxHourly = 0;
        for (let m = 0; m <= 1440; m += 5) {
          const cnt = countEventsBetween(stObj.events, m - 30, m + 30);
          if (cnt > maxHourly) maxHourly = cnt;
        }
        stObj.maxHourly = Math.max(1, maxHourly);
      }

      return this;
    },

    /**
     * Invalidate internal caches to force full redraw
     */
    invalidate() {
      _domReady = false;
      _lastRenderedMinute = -1;
      _lastRenderedTheme = null;
      _stDomMap = {};
    },

    /**
     * Configure component visibility mode
     * @param {Object} opts { wave: boolean, stations: boolean }
     */
    setMode(opts) {
      if (!opts) return this;
      if (opts.wave !== undefined) _mode.wave = !!opts.wave;
      if (opts.stations !== undefined) _mode.stations = !!opts.stations;

      if (_container) {
        _container.classList.toggle('hp-hide-wave', !_mode.wave);
        _container.classList.toggle('hp-hide-stations', !_mode.stations);
        _container.style.display = (!_mode.wave && !_mode.stations) ? 'none' : '';
      }
      return this;
    },

    /**
     * Retrieve current component mode
     */
    getMode() {
      return { wave: _mode.wave, stations: _mode.stations };
    },

    /**
     * Main render / update loop called on animation frames
     * @param {HTMLElement|string} containerEl DOM element or element ID
     * @param {number} T Current simulation time in minutes (0..1440)
     * @param {string} theme 'dark' or 'light'
     */
    update(containerEl, T, theme) {
      if (typeof document === 'undefined') return;
      injectStyles();

      let root = (typeof containerEl === 'string') ? document.getElementById(containerEl) : containerEl;
      if (!root) {
        // Create fallback top-left overlay container if element ID was specified but not found
        if (typeof containerEl === 'string') {
          root = document.createElement('div');
          root.id = containerEl;
          root.style.position = 'absolute';
          root.style.top = '38px';
          root.style.left = '18px';
          root.style.zIndex = '960';
          const parent = document.getElementById('main-area') || document.body;
          parent.appendChild(root);
        } else {
          return;
        }
      }

      if (_container !== root) {
        _container = root;
        _domReady = false;
      }

      const isDark = (theme === 'dark') || document.documentElement.classList.contains('dark');
      const curTheme = isDark ? 'dark' : 'light';

      if (!_domReady) {
        this._buildDom(root, curTheme);
        _domReady = true;
      }

      // Sync theme class
      if (_lastRenderedTheme !== curTheme) {
        root.classList.toggle('dark', isDark);
        root.classList.toggle('light', !isDark);
        _lastRenderedTheme = curTheme;
      }

      // Handle visibility mode
      if (!_mode.wave && !_mode.stations) {
        root.style.display = 'none';
        return;
      }
      root.style.display = '';

      // Part 1: Heartbeat Waveform Update
      if (_mode.wave) {
        this._drawWaveform(T, isDark);
        this._updateWaveBadge(T);
      }

      // Part 2: Major Stations Pulse Bars Update
      if (_mode.stations) {
        this._updateStationBars(T, isDark);
      }
    },

    /**
     * Build the inner DOM skeleton
     */
    _buildDom(root, curTheme) {
      root.className = `hub-pulse-panel ${curTheme}`;
      if (!_mode.wave) root.classList.add('hp-hide-wave');
      if (!_mode.stations) root.classList.add('hp-hide-stations');

      const majorStations = (_config && _config.majorStations) || [];
      const stCount = majorStations.length;
      const stCountName = (stCount === 8) ? '八大站' : (stCount === 4) ? '四大站' : `${stCount}大站`;

      root.innerHTML = `
        <!-- Part 1: 24h Hub Traffic Heartbeat Waveform -->
        <section class="hub-pulse-wave-sec">
          <div class="hub-pulse-sec-hdr">
            <div class="hub-pulse-sec-title">
              <span>全天车流脉搏波谱</span>
              <span class="hub-pulse-sec-en">HEARTBEAT 24H</span>
            </div>
          </div>
          <div class="hub-pulse-badge-row" id="hp-badge-row">
            <span id="hp-badge-text">在途 -- 列 · 高速 -- · 城际 -- · 动车 -- · 普速 --</span>
          </div>
          <div class="hub-pulse-canvas-wrap">
            <canvas class="hub-pulse-canvas" id="hp-wave-canvas" width="260" height="82"></canvas>
          </div>
        </section>

        <!-- Divider -->
        <div class="hub-pulse-divider"></div>

        <!-- Part 2: Major Stations Pulse Bars -->
        <section class="hub-pulse-stations-sec">
          <div class="hub-pulse-sec-hdr">
            <div class="hub-pulse-sec-title">
              <span>${stCountName}实时活力条</span>
              <span class="hub-pulse-sec-en">PULSE BARS</span>
            </div>
            <div class="hub-pulse-sec-en" style="font-size:9px;">已办 / 全天</div>
          </div>
          <div class="hub-pulse-stations-list" id="hp-stations-list"></div>
        </section>
      `;

      _canvasEl = root.querySelector('#hp-wave-canvas');
      _badgeEl = root.querySelector('#hp-badge-text');

      const listContainer = root.querySelector('#hp-stations-list');
      _stDomMap = {};

      for (let i = 0; i < majorStations.length; i++) {
        const stName = majorStations[i];
        const row = document.createElement('div');
        row.className = 'hub-pulse-station-row';
        row.setAttribute('data-station', stName);

        row.innerHTML = `
          <span class="hub-pulse-st-name" title="${stName}">${stName}</span>
          <div class="hub-pulse-bar-wrap">
            <div class="hub-pulse-bar-fill"></div>
            <div class="hub-pulse-bar-tip"></div>
          </div>
          <div class="hub-pulse-st-stats">
            <span class="hub-pulse-counts"><b>0</b>/0</span>
            <span class="hub-pulse-live-dot" title="暂无车次进出"></span>
          </div>
        `;

        listContainer.appendChild(row);

        _stDomMap[stName] = {
          fillEl: row.querySelector('.hub-pulse-bar-fill'),
          tipEl: row.querySelector('.hub-pulse-bar-tip'),
          countsEl: row.querySelector('.hub-pulse-counts'),
          dotEl: row.querySelector('.hub-pulse-live-dot'),
          lastDone: -1,
          lastTotal: -1,
          lastHeatLevel: -1,
          lastLive: null
        };
      }
    },

    /**
     * Update live breakdown text above waveform
     */
    _updateWaveBadge(T) {
      if (!_badgeEl) return;
      const mInt = Math.max(0, Math.min(1440, Math.round(T)));
      const g = _minuteG ? _minuteG[mInt] : 0;
      const c = _minuteC ? _minuteC[mInt] : 0;
      const d = _minuteD ? _minuteD[mInt] : 0;
      const p = _minuteP ? _minuteP[mInt] : 0;
      const tot = g + c + d + p;

      _badgeEl.innerHTML = `
        <span>在途 <b>${tot}</b> 列</span>
        <span class="hp-sep">·</span>
        <span class="hp-tag hp-tag-g">高速 <b>${g}</b></span>
        <span class="hp-sep">·</span>
        <span class="hp-tag hp-tag-c">城际 <b>${c}</b></span>
        <span class="hp-sep">·</span>
        <span class="hp-tag hp-tag-d">动车 <b>${d}</b></span>
        <span class="hp-sep">·</span>
        <span class="hp-tag hp-tag-p">普速 <b>${p}</b></span>
      `;
    },

    /**
     * Render the 24h stacked area waveform canvas
     */
    _drawWaveform(T, isDark) {
      if (!_canvasEl) return;
      const ctx = _canvasEl.getContext('2d');
      if (!ctx) return;

      const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
      const cssW = 260;
      const cssH = 82;

      if (_canvasEl.width !== Math.round(cssW * dpr) || _canvasEl.height !== Math.round(cssH * dpr)) {
        _canvasEl.width = Math.round(cssW * dpr);
        _canvasEl.height = Math.round(cssH * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      const colors = isDark ? WAVE_COLORS.dark : WAVE_COLORS.light;

      const plotW = cssW;
      const plotTop = 4;
      const plotBottom = 66;
      const plotH = plotBottom - plotTop;

      const maxScale = _maxScale || 10;
      const N = NUM_BUCKETS - 1; // 288 segments

      // Pre-compute coordinate arrays for the 289 buckets
      const x = new Float32Array(NUM_BUCKETS);
      const y0 = new Float32Array(NUM_BUCKETS);
      const yG = new Float32Array(NUM_BUCKETS);
      const yC = new Float32Array(NUM_BUCKETS);
      const yD = new Float32Array(NUM_BUCKETS);
      const yP = new Float32Array(NUM_BUCKETS);

      for (let i = 0; i < NUM_BUCKETS; i++) {
        x[i] = (i / N) * plotW;
        y0[i] = plotBottom;
        const b = _buckets[i] || { G: 0, C: 0, D: 0, P: 0 };
        yG[i] = plotBottom - (b.G / maxScale) * plotH;
        yC[i] = yG[i] - (b.C / maxScale) * plotH;
        yD[i] = yC[i] - (b.D / maxScale) * plotH;
        yP[i] = yD[i] - (b.P / maxScale) * plotH;
      }

      function drawBand(yUpper, yLower, fillColor) {
        ctx.fillStyle = fillColor;
        ctx.beginPath();
        ctx.moveTo(x[0], yUpper[0]);
        for (let i = 1; i < NUM_BUCKETS; i++) {
          ctx.lineTo(x[i], yUpper[i]);
        }
        for (let i = NUM_BUCKETS - 1; i >= 0; i--) {
          ctx.lineTo(x[i], yLower[i]);
        }
        ctx.closePath();
        ctx.fill();
      }

      function drawAllBands() {
        drawBand(yG, y0, colors.G);
        drawBand(yC, yG, colors.C);
        drawBand(yD, yC, colors.D);
        drawBand(yP, yD, colors.P);
      }

      const clampedT = Math.max(0, Math.min(1440, T));
      const xPlay = (clampedT / 1440) * plotW;

      // 1. Draw future time > T in muted ghost silhouette (opacity: 0.22)
      if (xPlay < plotW) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(xPlay, 0, plotW - xPlay, plotBottom);
        ctx.clip();
        ctx.globalAlpha = 0.22;
        drawAllBands();
        ctx.restore();
      }

      // 2. Draw past time <= T in rich stacked colors (opacity: 0.90)
      if (xPlay > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, xPlay, plotBottom);
        ctx.clip();
        ctx.globalAlpha = 0.90;
        drawAllBands();

        // Top contour stroke for the illuminated past area
        ctx.beginPath();
        ctx.moveTo(x[0], yP[0]);
        for (let i = 1; i < NUM_BUCKETS; i++) {
          if (x[i] >= xPlay) {
            const frac = (xPlay - x[i - 1]) / Math.max(0.001, x[i] - x[i - 1]);
            const yInterp = yP[i - 1] + (yP[i] - yP[i - 1]) * frac;
            ctx.lineTo(xPlay, yInterp);
            break;
          }
          ctx.lineTo(x[i], yP[i]);
        }
        ctx.strokeStyle = colors.contour;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
      }

      // 3. Crisp vertical playhead line at T
      ctx.beginPath();
      ctx.moveTo(xPlay, plotTop);
      ctx.lineTo(xPlay, plotBottom);
      ctx.strokeStyle = colors.playhead;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Glowing playhead dot on the top curve
      const k = Math.max(0, Math.min(N, (clampedT / 1440) * N));
      const k0 = Math.floor(k);
      const k1 = Math.min(N, k0 + 1);
      const kf = k - k0;
      const curTopY = yP[k0] + (yP[k1] - yP[k0]) * kf;

      ctx.beginPath();
      ctx.arc(xPlay, curTopY, 2.8, 0, Math.PI * 2);
      ctx.fillStyle = isDark ? '#ffffff' : colors.playhead;
      ctx.fill();
      ctx.strokeStyle = isDark ? colors.playhead : '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 4. Time Axis Line and Tick Labels (00, 04, 08, 12, 16, 20, 24)
      ctx.beginPath();
      ctx.moveTo(0, plotBottom);
      ctx.lineTo(plotW, plotBottom);
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = '9px "DIN Alternate", ui-monospace, SFMono-Regular, monospace';
      ctx.fillStyle = colors.text;
      ctx.textBaseline = 'top';

      const axisMarks = [
        { m: 0, label: '00' },
        { m: 240, label: '04' },
        { m: 480, label: '08' },
        { m: 720, label: '12' },
        { m: 960, label: '16' },
        { m: 1200, label: '20' },
        { m: 1440, label: '24' }
      ];

      for (let j = 0; j < axisMarks.length; j++) {
        const item = axisMarks[j];
        const tx = (item.m / 1440) * plotW;

        // Subtle tick line
        ctx.beginPath();
        ctx.moveTo(tx, plotBottom);
        ctx.lineTo(tx, plotBottom + 2.5);
        ctx.strokeStyle = colors.grid;
        ctx.lineWidth = 1;
        ctx.stroke();

        if (j === 0) ctx.textAlign = 'left';
        else if (j === axisMarks.length - 1) ctx.textAlign = 'right';
        else ctx.textAlign = 'center';

        ctx.fillText(item.label, tx, plotBottom + 3.5);
      }
    },

    /**
     * Update the 8-station pulse bars
     */
    _updateStationBars(T, isDark) {
      const majorStations = (_config && _config.majorStations) || [];
      const clampedT = Math.max(0, Math.min(1440, T));

      for (let si = 0; si < majorStations.length; si++) {
        const stName = majorStations[si];
        const dom = _stDomMap[stName];
        const stat = _stationStats[stName];
        if (!dom || !stat) continue;

        // 1. Done events up to T
        const doneCount = countEventsLe(stat.events, clampedT);
        const totalEv = stat.totalEv;
        const compPct = totalEv > 0 ? Math.min(100, Math.max(0, (doneCount / totalEv) * 100)) : 0;

        // 2. Hourly intensity [T - 30, T + 30] vs max hourly intensity
        const hourlyRate = countEventsBetween(stat.events, clampedT - 30, clampedT + 30);
        const hourlyRatio = stat.maxHourly > 0 ? Math.min(1, Math.max(0, hourlyRate / stat.maxHourly)) : 0;

        // 3. Currently active (stopped or arriving/departing within T ± 3 min)
        let activeNow = 0;
        const dwells = stat.dwells || [];
        for (let di = 0; di < dwells.length; di++) {
          const dw = dwells[di];
          if (dw.arr != null && dw.dep != null && dw.arr <= clampedT && clampedT <= dw.dep) {
            activeNow++;
            continue;
          }
          if (dw.hasArr && Math.abs(dw.arr - clampedT) <= 3) {
            activeNow++;
            continue;
          }
          if (dw.hasDep && Math.abs(dw.dep - clampedT) <= 3) {
            activeNow++;
            continue;
          }
        }
        const isLive = (activeNow > 0);

        // Update completion fill bar
        if (dom.lastDone !== doneCount || dom.lastTotal !== totalEv) {
          dom.fillEl.style.width = `${compPct.toFixed(1)}%`;
          dom.countsEl.innerHTML = `<b>${doneCount}</b>/${totalEv}`;
          dom.lastDone = doneCount;
          dom.lastTotal = totalEv;
        }

        // Update glowing tip (position + hourly traffic heat glow)
        const heatLevel = Math.round(hourlyRatio * 10);
        if (dom.lastHeatLevel !== heatLevel || dom.lastDone !== doneCount) {
          dom.tipEl.style.left = `${compPct.toFixed(1)}%`;

          let tipColor = '#06b6d4';
          let tipShadow = '0 0 5px rgba(6, 182, 212, 0.7)';
          if (hourlyRatio >= 0.75) {
            tipColor = '#ef4444'; // Peak heat: Red
            tipShadow = '0 0 8px rgba(239, 68, 68, 0.9)';
          } else if (hourlyRatio >= 0.40) {
            tipColor = '#f59e0b'; // Moderate heat: Amber
            tipShadow = '0 0 6px rgba(245, 158, 11, 0.8)';
          }

          dom.tipEl.style.backgroundColor = tipColor;
          dom.tipEl.style.boxShadow = tipShadow;
          dom.tipEl.style.opacity = String(0.35 + 0.65 * hourlyRatio);
          dom.lastHeatLevel = heatLevel;
        }

        // Update live pulse dot
        if (dom.lastLive !== isLive) {
          dom.dotEl.classList.toggle('active', isLive);
          dom.dotEl.title = isLive ? `${activeNow} 趟车到发中 (T ± 3分)` : '暂无列车进出';
          dom.lastLive = isLive;
        }
      }
    }
  };

  // ---------------------------------------------------------------------------
  // 6. Global & Module Export
  // ---------------------------------------------------------------------------
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HubPulse;
  }
  if (global) {
    global.HubPulse = HubPulse;
  }
})(typeof window !== 'undefined' ? window : this);
