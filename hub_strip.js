/**
 * hub_strip.js - Component A: 1.5D Linear Track Strip (window.HubTrackStrip)
 *
 * Full-width horizontal schematic railway track strip at the bottom of hub.html,
 * where real side-profile train SVGs (EMU / Conventional locomotives) run left
 * and right along a straightened corridor.
 *
 * Chinese Railway Hub HUD System (CR-HUD)
 */

(function (global) {
  'use strict';

  // =========================================================================
  // 1. Math, Distance, and Coordinate Utilities
  // =========================================================================

  /** Calculates great-circle distance between two lat/lon coordinates in km */
  function geoDistKm(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 30;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
            + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /** Normalizes station name string */
  function normStName(st) {
    if (!st) return '';
    if (typeof st === 'string') return st.trim();
    return (st.name || '').trim();
  }

  /**
   * Smoothstep interpolation curve: 3x^2 - 2x^3
   * Provides zero acceleration at station start and smooth deceleration into next station.
   */
  function smoothstep(t) {
    const x = Math.max(0, Math.min(1, t));
    return x * x * (3 - 2 * x);
  }

  /**
   * Resolves station sequence for corridor based on hubConfig.
   */
  function resolveCorridorStationList(hubConfig) {
    if (hubConfig) {
      if (Array.isArray(hubConfig.trackStripStations) && hubConfig.trackStripStations.length >= 2) {
        return hubConfig.trackStripStations.map(normStName);
      }
      if (hubConfig.trackStripSection) {
        if (Array.isArray(hubConfig.trackStripSection) && hubConfig.trackStripSection.length >= 2) {
          return hubConfig.trackStripSection.map(normStName);
        }
        if (Array.isArray(hubConfig.trackStripSection.stations) && hubConfig.trackStripSection.stations.length >= 2) {
          return hubConfig.trackStripSection.stations.map(normStName);
        }
      }
      if (hubConfig.id === 'jingjin') {
        return ['北京西', '北京南', '亦庄', '廊坊', '武清', '天津西', '天津', '滨海'];
      }
      if (hubConfig.id === 'shanghai') {
        return ['安亭北', '上海虹桥', '莘庄', '上海南', '春申', '上海松江', '金山北'];
      }
      if (hubConfig.diagramSection) {
        if (Array.isArray(hubConfig.diagramSection) && hubConfig.diagramSection.length >= 2) {
          return hubConfig.diagramSection.map(normStName);
        }
        if (Array.isArray(hubConfig.diagramSection.stations) && hubConfig.diagramSection.stations.length >= 2) {
          return hubConfig.diagramSection.stations.map(normStName);
        }
      }
    }
    return ['北京南', '亦庄', '廊坊', '武清', '天津西', '天津', '天津南', '滨海'];
  }

  /**
   * Computes cumulative km along corridor stations using STBY coordinates.
   */
  function computeStationKm(stList, STBY) {
    const kmList = [0];
    let cum = 0;
    for (let i = 1; i < stList.length; i++) {
      const prevName = stList[i - 1];
      const curName = stList[i];
      const sPrev = STBY && STBY[prevName];
      const sCur = STBY && STBY[curName];
      if (sPrev && sCur && sPrev.lat != null && sCur.lat != null) {
        const d = geoDistKm(sPrev.lat, sPrev.lon, sCur.lat, sCur.lon);
        cum += Math.max(1, Math.round(d * 10) / 10);
      } else {
        cum += 35;
      }
      kmList.push(Math.round(cum * 10) / 10);
    }
    return kmList;
  }

  /**
   * Computes screen x positions with proportional spacing and minimum gap constraint
   * so close stations (such as 天津西 and 天津) do not overlap.
   */
  function computeStationX(kmList, totalW, padL = 48, padR = 48, minGap = 58) {
    const n = kmList.length;
    if (n === 0) return [];
    if (n === 1) return [padL];

    const availW = Math.max(minGap * (n - 1), totalW - padL - padR);
    const totalKm = Math.max(1, kmList[n - 1] - kmList[0]);

    // 1. Raw proportional position
    const xs = kmList.map(k => padL + ((k - kmList[0]) / totalKm) * availW);

    // 2. Forward pass: enforce minGap from left to right
    for (let i = 1; i < n; i++) {
      if (xs[i] < xs[i - 1] + minGap) {
        xs[i] = xs[i - 1] + minGap;
      }
    }

    // 3. Backward pass if rightmost station exceeded right boundary
    const maxAllowedRight = totalW - padR;
    if (xs[n - 1] > maxAllowedRight) {
      xs[n - 1] = maxAllowedRight;
      for (let i = n - 2; i >= 0; i--) {
        if (xs[i] > xs[i + 1] - minGap) {
          xs[i] = xs[i + 1] - minGap;
        }
      }
    }

    // 4. Ensure leftmost station doesn't shift left of padL
    if (xs[0] < padL) {
      const shift = padL - xs[0];
      for (let i = 0; i < n; i++) xs[i] += shift;
    }

    return xs.map(x => Math.round(x * 10) / 10);
  }

  // =========================================================================
  // 2. Train Side-Profile Icon Helper
  // =========================================================================

  /**
   * Obtains a crisp half-car side profile SVG string for any EMU or locomotive.
   */
  function getTrainHalfSvg(tr, h = 16) {
    if (typeof locoHalfSvg === 'function') {
      try {
        const s = locoHalfSvg(tr, h);
        if (s) return s;
      } catch (e) {}
    }
    if (typeof global !== 'undefined' && typeof global.locoHalfSvg === 'function') {
      try {
        const s = global.locoHalfSvg(tr, h);
        if (s) return s;
      } catch (e) {}
    }
    if (typeof window !== 'undefined' && typeof window.locoHalfSvg === 'function') {
      try {
        const s = window.locoHalfSvg(tr, h);
        if (s) return s;
      } catch (e) {}
    }
    if (typeof emuHalfSvg === 'function') {
      try {
        const m = (tr && (tr.m || tr.ts)) || '';
        const s = emuHalfSvg(m, h);
        if (s) return s;
      } catch (e) {}
    }

    // Clean standalone SVG fallback
    const scale = h / 24;
    const w = Math.round(72 * scale);
    const code = (tr && (tr.c || tr.code || '')) + '';
    const isHighSpeed = /^[GCD]/i.test(code);
    const fill = isHighSpeed ? '#38bdf8' : '#15803d';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 96 32">`
      + `<path d="M4,24 L10,8 L30,4.5 L94,4.5 L94,26.5 L4,26.5 Z" fill="${fill}"/>`
      + `<rect x="18" y="7" width="10" height="4" rx="0.5" fill="#0f172a"/>`
      + `<rect x="36" y="8" width="50" height="4" rx="0.5" fill="#cbd5e1" fill-opacity="0.4"/>`
      + `<circle cx="20" cy="28.5" r="2.5" fill="#334155"/>`
      + `<circle cx="80" cy="28.5" r="2.5" fill="#334155"/>`
      + `</svg>`;
  }

  /**
   * Checks if a train matches spotlightTrain.
   */
  function isTrainSpotlight(tr, spotlightTrain) {
    if (!spotlightTrain || !tr) return false;
    const c = tr.c || '';
    if (typeof spotlightTrain === 'string') {
      const q = spotlightTrain.trim();
      if (!q) return false;
      if (c === q || tr.no === q) return true;
      const parts = c.split('/');
      if (parts[0] === q || parts[1] === q) return true;
      if (c.startsWith(q)) return true;
      return false;
    }
    if (typeof spotlightTrain === 'object') {
      if (tr === spotlightTrain) return true;
      const sq = (spotlightTrain.c || spotlightTrain.code || '').trim();
      if (sq && (c === sq || c.split('/')[0] === sq || c.split('/')[1] === sq)) return true;
      if (spotlightTrain.no && tr.no === spotlightTrain.no) return true;
    }
    return false;
  }

  // =========================================================================
  // 3. HubTrackStrip Core Class
  // =========================================================================

  const HubTrackStrip = {
    _config: null,
    _stby: null,
    _data: null,

    // Station geometry
    _stationNames: [],
    _stationKm: [],
    _stationX: [],
    _stMap: new Map(), // name -> { idx, km, x }

    // Precomputed corridor trains
    _corridorTrains: [],

    // DOM & Cache
    _container: null,
    _lastWidth: 0,
    _lastHeight: 76,
    _lastTheme: '',
    _bgSvg: null,
    _labelsLayer: null,
    _trainsLayer: null,
    _pulseLayer: null,
    _spritePool: new Map(), // trainCode -> HTMLElement

    /**
     * Initializes the corridor configuration and precomputes train paths.
     * @param {Object} hubConfig - Hub configuration object (e.g. HUB_CONFIGS.jingjin)
     * @param {Object} STBY - Station dictionary mapping name -> { lon, lat, ... }
     * @param {Object} D - Full timetable data object { trains: [...] }
     */
    init(hubConfig, STBY, D) {
      this._config = hubConfig || {};
      this._stby = STBY || {};
      this._data = D || {};

      this._stationNames = resolveCorridorStationList(hubConfig);
      this._stationKm = computeStationKm(this._stationNames, this._stby);

      this._stMap.clear();
      this._stationNames.forEach((name, i) => {
        this._stMap.set(name, {
          idx: i,
          name,
          km: this._stationKm[i]
        });
      });

      // Index trains traversing at least 2 stations along this corridor
      const trains = (this._data && this._data.trains) || [];
      const corridorTrains = [];

      for (let tIdx = 0; tIdx < trains.length; tIdx++) {
        const tr = trains[tIdx];
        const stops = tr.s || [];
        const pts = [];

        for (let sIdx = 0; sIdx < stops.length; sIdx++) {
          const [stName, aVal, dVal] = stops[sIdx];
          if (this._stMap.has(stName)) {
            const meta = this._stMap.get(stName);
            const a = (aVal != null && aVal !== '') ? Number(aVal) : null;
            const dep = (dVal != null && dVal !== '') ? Number(dVal) : null;
            const arrT = (a != null) ? a : dep;
            const depT = (dep != null) ? dep : a;

            if (arrT != null && depT != null) {
              pts.push({
                name: stName,
                idx: meta.idx,
                km: meta.km,
                arr: Math.min(arrT, depT),
                dep: Math.max(arrT, depT)
              });
            }
          }
        }

        if (pts.length >= 2) {
          // Check monotonicity of station sequence
          const diffs = [];
          for (let k = 0; k < pts.length - 1; k++) {
            diffs.push(pts[k + 1].idx - pts[k].idx);
          }
          const isDown = diffs.every(d => d > 0);
          const isUp = diffs.every(d => d < 0);

          if (isDown || isUp) {
            const direction = isDown ? 'down' : 'up';
            const firstStop = pts[0];
            const lastStop = pts[pts.length - 1];

            // 5 min buffer before departure at first station, 3 min buffer after arrival
            const minT = firstStop.dep - 5;
            const maxT = lastStop.arr + 3;

            // Class speed tier for priority
            const code = tr.c || '';
            let priorityScore = 10;
            if (code.startsWith('G')) priorityScore = 50;
            else if (code.startsWith('C')) priorityScore = 40;
            else if (code.startsWith('D')) priorityScore = 30;
            else if (code.startsWith('Z')) priorityScore = 20;
            else if (code.startsWith('T')) priorityScore = 15;

            corridorTrains.push({
              tr,
              points: pts,
              direction,
              minT,
              maxT,
              priorityScore
            });
          }
        }
      }

      this._corridorTrains = corridorTrains;
      this._lastWidth = 0;
      this._spritePool.clear();
      if (this._container) {
        this._container.innerHTML = '';
      }
      return this;
    },

    /**
     * Updates the track strip DOM and train sprites for simulation time T.
     * @param {HTMLElement|string} containerEl - Container element or ID
     * @param {number} T - Current time in minutes from midnight (0..1440)
     * @param {string|Object} [spotlightTrain] - Train code or train object to spotlight
     * @param {string} [theme] - 'dark' | 'light' (auto-detected if omitted)
     */
    update(containerEl, T, spotlightTrain, theme) {
      if (!containerEl) return;
      const el = (typeof containerEl === 'string') ? document.getElementById(containerEl) : containerEl;
      if (!el) return;

      this._injectStyles();

      // Theme detection
      const curTheme = theme || (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
      const w = el.clientWidth || 1000;
      const h = el.clientHeight || 76;

      // Rebuild static track background if container resized or on first pass
      if (el !== this._container || Math.abs(w - this._lastWidth) > 2 || curTheme !== this._lastTheme) {
        this._container = el;
        this._lastWidth = w;
        this._lastHeight = h;
        this._lastTheme = curTheme;
        this._buildStaticLayout(el, w, h, curTheme);
      }

      // Collect active corridor trains at time T
      const activeDown = [];
      const activeUp = [];

      for (let i = 0; i < this._corridorTrains.length; i++) {
        const item = this._corridorTrains[i];
        if (T < item.minT || T > item.maxT) continue;

        const pos = this._computeTrainPosition(item, T);
        if (pos == null) continue;

        const isSpotlight = isTrainSpotlight(item.tr, spotlightTrain);
        const score = item.priorityScore + (isSpotlight ? 1000 : 0) + (pos.isStopped ? 0 : 5);

        const rec = {
          entry: item,
          tr: item.tr,
          code: item.tr.c || '',
          x: pos.x,
          isStopped: pos.isStopped,
          stoppedStation: pos.stoppedStation,
          isSpotlight,
          score,
          stacked: false,
          condensed: false
        };

        if (item.direction === 'down') {
          activeDown.push(rec);
        } else {
          activeUp.push(rec);
        }
      }

      // Collision de-cluttering on Down track (45px threshold)
      this._declutterTrack(activeDown);
      // Collision de-cluttering on Up track (45px threshold)
      this._declutterTrack(activeUp);

      // Render/update train DOM sprites
      const activeKeys = new Set();

      // Track 1 (Top / Down): SVG flipped horizontally (scaleX(-1)), resting at y = 30px
      const topTrackY = 14;  // 30 - 16
      for (let i = 0; i < activeDown.length; i++) {
        const rec = activeDown[i];
        const key = 'd_' + rec.code;
        activeKeys.add(key);
        this._renderTrainSprite(rec, key, topTrackY, true, curTheme);
      }

      // Track 2 (Bottom / Up): SVG pointing left (scaleX(1)), resting at y = 52px
      const bottomTrackY = 36; // 52 - 16
      for (let i = 0; i < activeUp.length; i++) {
        const rec = activeUp[i];
        const key = 'u_' + rec.code;
        activeKeys.add(key);
        this._renderTrainSprite(rec, key, bottomTrackY, false, curTheme);
      }

      // Hide or recycle sprites that are no longer active
      this._spritePool.forEach((spriteEl, key) => {
        if (!activeKeys.has(key)) {
          spriteEl.style.display = 'none';
        }
      });

      // Update station stop pulsing dots on tracks
      this._updateStationPulse(activeDown, activeUp, curTheme);
    },

    /**
     * Computes train fractional position u ∈ [0, 1] and x coordinate at time T.
     * @private
     */
    _computeTrainPosition(trainEntry, T) {
      const pts = trainEntry.points;
      const n = pts.length;
      if (n === 0) return null;

      const firstStop = pts[0];
      const lastStop = pts[n - 1];

      // Boarding before origin departure
      if (T <= firstStop.dep) {
        return {
          x: this._getStationX(firstStop.name),
          isStopped: true,
          stoppedStation: firstStop.name
        };
      }

      // Arrived after destination arrival
      if (T >= lastStop.arr) {
        return {
          x: this._getStationX(lastStop.name),
          isStopped: true,
          stoppedStation: lastStop.name
        };
      }

      // Intermediate legs and stops
      for (let k = 0; k < n - 1; k++) {
        const pA = pts[k];
        const pB = pts[k + 1];

        // Stopped at station pA
        if (T >= pA.arr && T <= pA.dep) {
          return {
            x: this._getStationX(pA.name),
            isStopped: true,
            stoppedStation: pA.name
          };
        }

        // In transit between pA and pB
        if (T > pA.dep && T < pB.arr) {
          const dt = Math.max(0.5, pB.arr - pA.dep);
          const alpha = (T - pA.dep) / dt;
          const u = smoothstep(alpha);
          const xA = this._getStationX(pA.name);
          const xB = this._getStationX(pB.name);
          const x = xA + u * (xB - xA);
          return {
            x,
            isStopped: false,
            stoppedStation: null
          };
        }

        // Stopped at station pB
        if (T >= pB.arr && T <= pB.dep) {
          return {
            x: this._getStationX(pB.name),
            isStopped: true,
            stoppedStation: pB.name
          };
        }
      }

      return null;
    },

    /**
     * Gets precomputed x position for station name.
     * @private
     */
    _getStationX(stName) {
      const idx = this._stationNames.indexOf(stName);
      if (idx >= 0 && this._stationX[idx] != null) {
        return this._stationX[idx];
      }
      return 50;
    },

    /**
     * De-clutters train badge labels within 45px on the same track.
     * Stacks or prioritizes the faster/spotlight train.
     * @private
     */
    _declutterTrack(trainList) {
      if (trainList.length <= 1) return;
      trainList.sort((a, b) => a.x - b.x);

      for (let i = 1; i < trainList.length; i++) {
        const prev = trainList[i - 1];
        const cur = trainList[i];
        const dist = cur.x - prev.x;

        if (dist < 45) {
          if (cur.score >= prev.score) {
            prev.stacked = true;
          } else {
            cur.stacked = true;
          }
          // If 3 or more trains severely clump within 30px
          if (i >= 2 && cur.x - trainList[i - 2].x < 45) {
            const lowest = [trainList[i - 2], prev, cur].reduce((min, it) => it.score < min.score ? it : min);
            lowest.condensed = true;
          }
        }
      }
    },

    /**
     * Builds static track SVG, ticks, station labels, and kilometer markers.
     * @private
     */
    _buildStaticLayout(container, w, h, theme) {
      container.innerHTML = '';
      container.className = 'hub-track-strip-wrap' + (theme === 'dark' ? ' hts-dark' : '');

      const padL = 50;
      const padR = 50;
      this._stationX = computeStationX(this._stationKm, w, padL, padR, 60);

      const isDark = theme === 'dark';
      const railColorDown = isDark ? 'rgba(56, 189, 248, 0.40)' : 'rgba(13, 148, 136, 0.50)';
      const railColorUp = isDark ? 'rgba(251, 191, 36, 0.40)' : 'rgba(217, 119, 6, 0.50)';
      const tickColor = isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(28, 36, 43, 0.18)';
      const dotStroke = isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(28, 36, 43, 0.35)';
      const dotFill = isDark ? '#0f172a' : '#ffffff';

      // 1. Static SVG layer
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'hts-bg-svg');
      svg.setAttribute('width', w);
      svg.setAttribute('height', h);
      svg.style.position = 'absolute';
      svg.style.left = '0';
      svg.style.top = '0';
      svg.style.width = '100%';
      svg.style.height = '100%';
      svg.style.pointerEvents = 'none';

      let svgHtml = '';

      // Subtle track ballast beds
      svgHtml += `<rect x="${padL - 16}" y="29" width="${w - padL - padR + 32}" height="2.5" rx="1" fill="${railColorDown}"/>`
               + `<rect x="${padL - 16}" y="51" width="${w - padL - padR + 32}" height="2.5" rx="1" fill="${railColorUp}"/>`;

      // Direction hints at far ends
      const dirTextDownLeft = (this._config && this._config.id === 'shanghai') ? '下行 往杭' : '下行 往津滨';
      const dirTextUpLeft = '← 上行 进京';
      svgHtml += `<text x="8" y="27" fill="${isDark ? '#38bdf8' : '#0d9488'}" font-size="8.5" font-weight="700" opacity="0.8">${dirTextDownLeft} →</text>`
               + `<text x="8" y="58" fill="${isDark ? '#fbbf24' : '#d97706'}" font-size="8.5" font-weight="700" opacity="0.8">${dirTextUpLeft}</text>`;

      // Station vertical ticks and station dots
      for (let i = 0; i < this._stationNames.length; i++) {
        const x = this._stationX[i];
        // Vertical spine line across both tracks
        svgHtml += `<line x1="${x}" y1="21" x2="${x}" y2="60" stroke="${tickColor}" stroke-width="1.2" stroke-dasharray="2,2"/>`
                 + `<circle cx="${x}" cy="30" r="3.2" fill="${dotFill}" stroke="${dotStroke}" stroke-width="1.4"/>`
                 + `<circle cx="${x}" cy="52" r="3.2" fill="${dotFill}" stroke="${dotStroke}" stroke-width="1.4"/>`;
      }

      svg.innerHTML = svgHtml;
      container.appendChild(svg);
      this._bgSvg = svg;

      // 2. Station pulse indicator layer (in SVG)
      const pulseG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      pulseG.setAttribute('class', 'hts-pulse-layer');
      svg.appendChild(pulseG);
      this._pulseLayer = pulseG;

      // 3. Station Labels Layer (DOM)
      const labelsLayer = document.createElement('div');
      labelsLayer.className = 'hts-labels-layer';
      labelsLayer.style.position = 'absolute';
      labelsLayer.style.inset = '0';
      labelsLayer.style.pointerEvents = 'none';

      for (let i = 0; i < this._stationNames.length; i++) {
        const x = this._stationX[i];
        const name = this._stationNames[i];
        const km = this._stationKm[i];

        // Top station name
        const nameEl = document.createElement('div');
        nameEl.className = 'hts-st-name';
        nameEl.style.left = `${x}px`;
        nameEl.textContent = name;
        labelsLayer.appendChild(nameEl);

        // Bottom kilometer label
        const kmEl = document.createElement('div');
        kmEl.className = 'hts-st-km';
        kmEl.style.left = `${x}px`;
        kmEl.textContent = `${km}km`;
        labelsLayer.appendChild(kmEl);
      }
      container.appendChild(labelsLayer);
      this._labelsLayer = labelsLayer;

      // 4. Trains Layer (DOM)
      const trainsLayer = document.createElement('div');
      trainsLayer.className = 'hts-trains-layer';
      trainsLayer.style.position = 'absolute';
      trainsLayer.style.inset = '0';
      container.appendChild(trainsLayer);
      this._trainsLayer = trainsLayer;
    },

    /**
     * Renders or updates a DOM train sprite.
     * @private
     */
    _renderTrainSprite(rec, key, trackY, isDown, theme) {
      let spriteEl = this._spritePool.get(key);
      const isSpotlight = rec.isSpotlight;

      if (!spriteEl) {
        spriteEl = document.createElement('div');
        spriteEl.className = 'hts-train-sprite ' + (isDown ? 'hts-down' : 'hts-up');
        spriteEl.dataset.code = rec.code;

        // Tooltip description
        const stockDesc = (typeof formatRollingStock === 'function')
          ? formatRollingStock(rec.tr)
          : (rec.tr.m || rec.tr.ts || 'CR400AF');
        spriteEl.title = `${rec.code} · ${stockDesc}`;

        // Train code label badge
        const lbl = document.createElement('div');
        lbl.className = 'hts-train-label';
        lbl.textContent = rec.code;
        spriteEl.appendChild(lbl);

        // SVG wrapper (scaled horizontally)
        const svgWrap = document.createElement('div');
        svgWrap.className = 'hts-train-svg-wrap';
        svgWrap.innerHTML = getTrainHalfSvg(rec.tr, 16);
        spriteEl.appendChild(svgWrap);

        // Stop pulsing indicator dot
        const stopDot = document.createElement('div');
        stopDot.className = 'hts-stop-dot';
        stopDot.style.display = 'none';
        spriteEl.appendChild(stopDot);

        // Click handler to spotlight train across the HUD
        spriteEl.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('hub-select-train', {
              detail: { train: rec.tr, code: rec.code }
            }));
            if (typeof window.selectTrain === 'function') {
              window.selectTrain(rec.tr);
            }
          }
        });

        this._trainsLayer.appendChild(spriteEl);
        this._spritePool.set(key, spriteEl);
      }

      // Smooth translation (centered at 24px half-width of 48px icon)
      const xPixel = Math.round(rec.x - 24);
      spriteEl.style.transform = `translate3d(${xPixel}px, ${trackY}px, 0)`;
      spriteEl.style.display = 'block';

      // Horizontal orientation: Down track flips nose to the right, Up track points left
      const svgWrap = spriteEl.querySelector('.hts-train-svg-wrap');
      if (svgWrap) {
        svgWrap.style.transform = isDown ? 'scaleX(-1)' : 'scaleX(1)';
      }

      // Classes for stacking / spotlight / stopped
      spriteEl.classList.toggle('hts-stacked', rec.stacked);
      spriteEl.classList.toggle('hts-condensed', rec.condensed);
      spriteEl.classList.toggle('hts-spotlight', isSpotlight);

      // Stopped pulsing dot
      const stopDot = spriteEl.querySelector('.hts-stop-dot');
      if (stopDot) {
        stopDot.style.display = rec.isStopped ? 'block' : 'none';
      }
    },

    /**
     * Updates station stop pulsing rings on the tracks.
     * @private
     */
    _updateStationPulse(activeDown, activeUp, theme) {
      if (!this._pulseLayer) return;

      const stoppedDown = new Set(activeDown.filter(t => t.isStopped && t.stoppedStation).map(t => t.stoppedStation));
      const stoppedUp = new Set(activeUp.filter(t => t.isStopped && t.stoppedStation).map(t => t.stoppedStation));

      let pulseHtml = '';
      const isDark = theme === 'dark';
      const colorDown = isDark ? '#38bdf8' : '#0d9488';
      const colorUp = isDark ? '#fbbf24' : '#d97706';

      for (let i = 0; i < this._stationNames.length; i++) {
        const name = this._stationNames[i];
        const x = this._stationX[i];
        if (stoppedDown.has(name)) {
          pulseHtml += `<circle cx="${x}" cy="30" r="6" fill="none" stroke="${colorDown}" stroke-width="1.8" class="hts-pulse-ring"/>`;
        }
        if (stoppedUp.has(name)) {
          pulseHtml += `<circle cx="${x}" cy="52" r="6" fill="none" stroke="${colorUp}" stroke-width="1.8" class="hts-pulse-ring"/>`;
        }
      }
      this._pulseLayer.innerHTML = pulseHtml;
    },

    /**
     * Injects CSS styles once into document.head.
     * @private
     */
    _injectStyles() {
      if (typeof document === 'undefined') return;
      if (document.getElementById('hub-track-strip-styles')) return;

      const styleEl = document.createElement('style');
      styleEl.id = 'hub-track-strip-styles';
      styleEl.textContent = `
        .hub-track-strip-wrap {
          position: relative;
          width: 100%;
          height: 76px;
          box-sizing: border-box;
          overflow: hidden;
          user-select: none;
          border-radius: 6px;
          background: rgba(243, 241, 233, 0.94);
          border: 1px solid rgba(28, 36, 43, 0.15);
          box-shadow: 0 3px 12px rgba(0, 0, 0, 0.08);
          font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif;
        }
        html.dark .hub-track-strip-wrap,
        .hub-track-strip-wrap.hts-dark {
          background: rgba(11, 17, 30, 0.92);
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
        }
        .hts-st-name {
          position: absolute;
          top: 3px;
          transform: translateX(-50%);
          font-size: 11px;
          font-weight: 700;
          color: #1e293b;
          white-space: nowrap;
          pointer-events: none;
          letter-spacing: 0.2px;
        }
        html.dark .hts-st-name,
        .hts-dark .hts-st-name {
          color: #f1f5f9;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
        }
        .hts-st-km {
          position: absolute;
          bottom: 3px;
          transform: translateX(-50%);
          font-size: 9px;
          font-family: "DIN Alternate", "Bahnschrift", ui-monospace, monospace;
          font-variant-numeric: tabular-nums;
          color: #64748b;
          white-space: nowrap;
          pointer-events: none;
        }
        html.dark .hts-st-km,
        .hts-dark .hts-st-km {
          color: #94a3b8;
        }
        .hts-train-sprite {
          position: absolute;
          left: 0;
          top: 0;
          width: 48px;
          height: 16px;
          pointer-events: auto;
          cursor: pointer;
          will-change: transform;
          transition: filter 0.15s ease;
          z-index: 20;
        }
        .hts-train-sprite:hover {
          z-index: 60;
          filter: drop-shadow(0 0 6px rgba(56, 189, 248, 0.85));
        }
        .hts-train-svg-wrap {
          width: 48px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          transform-origin: center center;
        }
        .hts-train-svg-wrap svg {
          display: block;
          width: 48px;
          height: 16px;
        }
        .hts-train-label {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          padding: 0.5px 3.5px;
          font-size: 9px;
          font-weight: 800;
          font-family: "DIN Alternate", "Bahnschrift", ui-monospace, monospace;
          line-height: 11px;
          border-radius: 2px;
          white-space: nowrap;
          pointer-events: none;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.22);
          transition: top 0.15s ease;
        }
        .hts-train-sprite.hts-down .hts-train-label {
          top: -12px;
          background: rgba(240, 253, 250, 0.94);
          border: 1px solid #0d9488;
          color: #0f766e;
        }
        html.dark .hts-train-sprite.hts-down .hts-train-label,
        .hts-dark .hts-train-sprite.hts-down .hts-train-label {
          background: rgba(8, 47, 73, 0.94);
          border: 1px solid #38bdf8;
          color: #38bdf8;
        }
        .hts-train-sprite.hts-up .hts-train-label {
          top: 17px;
          background: rgba(254, 243, 199, 0.94);
          border: 1px solid #d97706;
          color: #b45309;
        }
        html.dark .hts-train-sprite.hts-up .hts-train-label,
        .hts-dark .hts-train-sprite.hts-up .hts-train-label {
          background: rgba(69, 26, 3, 0.94);
          border: 1px solid #fbbf24;
          color: #fbbf24;
        }
        .hts-train-sprite.hts-down.hts-stacked .hts-train-label {
          top: -22px;
        }
        .hts-train-sprite.hts-up.hts-stacked .hts-train-label {
          top: 27px;
        }
        .hts-train-sprite.hts-condensed .hts-train-label {
          width: 5px;
          height: 5px;
          padding: 0;
          border-radius: 50%;
          overflow: hidden;
          color: transparent;
        }
        .hts-train-sprite.hts-spotlight {
          z-index: 100 !important;
          filter: drop-shadow(0 0 6px rgba(245, 158, 11, 0.95)) !important;
        }
        .hts-train-sprite.hts-spotlight .hts-train-label {
          background: rgba(245, 158, 11, 0.40) !important;
          border: 1.5px solid #f59e0b !important;
          color: #fbbf24 !important;
          box-shadow: 0 0 10px rgba(245, 158, 11, 0.9) !important;
          font-size: 9.5px;
        }
        .hts-stop-dot {
          position: absolute;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #ef4444;
          left: 21.5px;
          bottom: -2.5px;
          animation: htsPulse 1.2s infinite ease-in-out;
        }
        .hts-pulse-ring {
          animation: htsPulse 1.4s infinite ease-in-out;
          transform-origin: center center;
        }
        @keyframes htsPulse {
          0% { transform: scale(0.8); opacity: 0.6; }
          50% { transform: scale(1.3); opacity: 1; }
          100% { transform: scale(0.8); opacity: 0.6; }
        }
      `;
      document.head.appendChild(styleEl);
    },

    /** Returns currently resolved corridor station list */
    getCorridorStations() {
      return this._stationNames.map((name, i) => ({
        name,
        km: this._stationKm[i],
        x: this._stationX[i] || 0
      }));
    },

    /** Returns all precomputed corridor trains */
    getCorridorTrains() {
      return this._corridorTrains;
    },

    /** Cleans up DOM resources */
    destroy() {
      if (this._container) {
        this._container.innerHTML = '';
      }
      this._spritePool.clear();
      this._stMap.clear();
      this._corridorTrains = [];
    }
  };

  // =========================================================================
  // 4. Global & Module Exports
  // =========================================================================

  global.HubTrackStrip = HubTrackStrip;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HubTrackStrip;
  }

})(typeof window !== 'undefined' ? window : globalThis);
