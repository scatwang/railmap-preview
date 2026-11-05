/**
 * corridor_data.js - Dedicated 3-Line Beijing–Tianjin Corridor Dataset & Trajectory Engine
 * 
 * Precomputes accurate, monotonic (t, km) train trajectories and real-time kinematics
 * for the Beijing–Tianjin railway corridors:
 *   1. 京津城际铁路 (Row 1 — 350 km/h)
 *   2. 京沪高速铁路·京津段 (Row 2 — 350 km/h)
 *   3. 京沪铁路·京津普速段 (Row 3 Default — 120–160 km/h)
 *   4. 京雄—津兴城际通道 (Row 3 Alternate — 250–300 km/h)
 * 
 * Shared by both the Left 1.5D Linear Track Strip (轨道带) and
 * the Right Synchronized Time-Space Diagram (运行图).
 */

(function (global) {
  'use strict';

  // Projection scaling constants around Beijing-Tianjin latitude (~39.5° N)
  const KY = 111.0;
  const KX = 111.0 * Math.cos(39.5 * Math.PI / 180);

  /**
   * Corridor Definitions
   */
  const CORRIDOR_DEFS = {
    c1_intercity: {
      id: 'c1_intercity',
      badge: '① 京津城际铁路',
      subtitle: '北京南 ↔ 武清 ↔ 天津 ↔ 滨海 · 165 km',
      speedTag: '350 km/h',
      accent: '#06b6d4',
      osmLines: ['京津城际线'],
      minSpanKm: 15,
      // 进出线端口：km=接轨点，bearing=外侧方位角（度，东=0、北=90），edges=两端顺延
      ports: [
        { id: 'ts', km: 120, label: '唐山方向', bearing: 30 }
      ],
      edges: { L: '', R: '' },
      stations: [
        { name: '北京南', km: 0, lon: 116.3724, lat: 39.86348, major: true },
        { name: '亦庄', km: 22, lon: 116.59629, lat: 39.81176, major: false },
        { name: '武清', km: 84, lon: 117.0099, lat: 39.37106, major: true },
        { name: '天津', km: 120, lon: 117.20368, lat: 39.13575, major: true, aliases: ['天津西'] },
        { name: '军粮城北', km: 140, lon: 117.42119, lat: 39.06579, major: false },
        { name: '塘沽', km: 160, lon: 117.63489, lat: 39.02643, major: true },
        { name: '滨海', km: 165, lon: 117.67877, lat: 39.00348, major: true }
      ]
    },

    c2_jh_hsr: {
      id: 'c2_jh_hsr',
      badge: '② 京沪高速铁路·京津段',
      subtitle: '北京南 ↔ 廊坊 ↔ 天津西/天津南 ↔ 沧州西 · 210 km',
      speedTag: '350 km/h',
      accent: '#3b82f6',
      osmLines: ['京沪高铁', '京津联络线'],
      minSpanKm: 18,
      ports: [
        { id: 'ts', km: 122, label: '唐山方向', bearing: 30 },
        { id: 'bz', km: 122, label: '霸州方向', bearing: 180 }
      ],
      edges: { L: '', R: '济南方向' },
      stations: [
        { name: '北京南', km: 0, lon: 116.3724, lat: 39.86348, major: true },
        { name: '廊坊', km: 60, lon: 116.70295, lat: 39.50839, major: true },
        { name: '京津所', km: 110, lon: 117.050, lat: 39.155, major: false, isPost: true },
        { name: '天津南', label: '天津南/西', km: 122, lon: 117.0545, lat: 39.05605, major: true, aliases: ['天津西'] },
        { name: '沧州西', km: 210, lon: 116.76026, lat: 38.30577, major: true }
      ]
    },

    c3_jh_conv: {
      id: 'c3_jh_conv',
      badge: '③ 京沪铁路·京津普速段',
      subtitle: '北京/丰台 ↔ 廊坊北 ↔ 杨村 ↔ 天津西/天津 ↔ 沧州 · 264 km',
      speedTag: '120–160 km/h',
      accent: '#10b981',
      osmLines: ['京沪线', '津山线', '天津西线'],
      minSpanKm: 20,
      ports: [
        { id: 'sq', km: 2, label: '双桥方向', bearing: 5 },
        { id: 'bd', km: 16, label: '保定方向', bearing: -120 },
        { id: 'zjk', km: 16, label: '张家口方向', bearing: 135 },
        { id: 'bz', km: 28, label: '霸州方向', bearing: -95 },
        { id: 'ts', km: 148, label: '唐山方向', bearing: 30 },
        { id: 'tg', km: 148, label: '塘沽方向', bearing: -15, lean: 1, top: true }
      ],
      edges: { L: '', R: '德州方向' },
      stations: [
        { name: '北京', km: 0, lon: 116.42101, lat: 39.90112, major: true },
        { name: '北京南', km: 9, lon: 116.3724, lat: 39.86348, major: false },
        { name: '北京丰台', km: 16, lon: 116.29534, lat: 39.85, major: true, aliases: ['北京西'] },
        { name: '黄村', km: 33, lon: 116.322, lat: 39.723, major: false, aliases: ['安定'] },
        { name: '廊坊北', km: 74, lon: 116.66794, lat: 39.57744, major: true, aliases: ['广阳'] },
        { name: '杨村', km: 109, lon: 117.058, lat: 39.381, major: false, aliases: ['汉沟镇', '北仓', '南仓'] },
        { name: '天津', label: '天津/西', km: 148, lon: 117.15712, lat: 39.15736, major: true, aliases: ['天津西', '天津北'] },
        { name: '杨柳青', km: 163, lon: 116.99577, lat: 39.14171, major: false },
        { name: '静海', km: 191, lon: 116.92454, lat: 38.93182, major: false, aliases: ['唐官屯'] },
        { name: '青县', km: 232, lon: 116.83287, lat: 38.5771, major: false },
        { name: '沧州', km: 264, lon: 116.87244, lat: 38.30895, major: true }
      ]
    },

    c4_jxt: {
      id: 'c4_jxt',
      badge: '③ 京雄—津兴城际通道',
      subtitle: '北京西 ↔ 大兴机场 ↔ 固安东 ↔ 胜芳 ↔ 天津西 · 149 km',
      speedTag: '250–300 km/h',
      accent: '#f59e0b',
      osmLines: ['京雄城际线', '津兴城际线'],
      minSpanKm: 15,
      ports: [
        { id: 'lf', km: 64, label: '廊坊方向', bearing: 45 },
        { id: 'xa', km: 70, label: '雄安方向', bearing: -135 }
      ],
      edges: { L: '', R: '' },
      stations: [
        { name: '北京西', km: 0, lon: 116.3151, lat: 39.89367, major: true },
        { name: '北京大兴', km: 22, lon: 116.3223, lat: 39.71917, major: false },
        { name: '大兴机场', km: 47, lon: 116.41062, lat: 39.51292, major: true },
        { name: '固安东', km: 64, lon: 116.39832, lat: 39.37106, major: true },
        { name: '永清东', km: 77, lon: 116.50609, lat: 39.30412, major: false },
        { name: '安次', km: 97, lon: 116.69116, lat: 39.23609, major: false },
        { name: '胜芳', km: 113, lon: 116.7535, lat: 39.13765, major: true },
        { name: '天津西', km: 149, lon: 117.15712, lat: 39.15736, major: true, aliases: ['天津'] }
      ]
    }
  };

  /**
   * Train classification letter helper
   */
  const clsOf = c => {
    const h = c && c[0];
    if ('GDCSZK'.includes(h)) return h;
    if (h === 'T' || h === 'N') return 'T';
    if (h === 'V') return 'K';
    return 'O';
  };

  /**
   * Distance along leg at time t, considering kinematic profile (D.profiles[leg[4]]) and scheduled waits (leg[5])
   */
  function legKm(leg, t, D) {
    const km = leg[3];
    const ws = leg[5];
    let t0 = leg[1], s0 = 0;
    if (t <= t0) return 0;
    if (t >= leg[2]) return km;
    const P = D && D.profiles && D.profiles[leg[4]], SC = (D && D.profile_scale) || 10000, dur = leg[2] - t0;
    if (P && P.length >= 4 && dur > 0) {
      const x = Math.max(0, Math.min(SC, (t - t0) / dur * SC));
      let lo = 0, hi = (P.length >> 1) - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m << 1] <= x) lo = m; else hi = m; }
      const pt0 = P[lo << 1], ps0 = P[(lo << 1) + 1], pt1 = P[hi << 1], ps1 = P[(hi << 1) + 1];
      return (pt1 > pt0 ? ps0 + (x - pt0) / (pt1 - pt0) * (ps1 - ps0) : ps0) / SC * km;
    }
    if (ws) {
      for (const w of ws) {
        const sw = w[0] * km;
        if (t <= w[1]) return w[1] > t0 ? s0 + (t - t0) / (w[1] - t0) * (sw - s0) : s0;
        if (t <= w[2]) return sw;
        t0 = w[2];
        s0 = sw;
      }
    }
    return t < leg[2] && leg[2] > t0 ? s0 + (t - t0) / (leg[2] - t0) * (km - s0) : km;
  }

  /**
   * Interpolate (lon, lat) along decoded track geometry G[gid] for a given leg distance sKm
   */
  function getGeomLL(G, gid, sKm, totalLegKm) {
    const g = G && G[gid];
    if (!g || !g.km || g.km.length === 0) return null;
    const n = g.km.length;
    if (n === 1) return { lon: g.lon[0], lat: g.lat[0], frac: 0 };
    const u = Math.max(0, Math.min(1, sKm / (totalLegKm || 1)));
    const targetKm = g.km[0] + u * (g.km[n - 1] - g.km[0]);
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (g.km[mid] <= targetKm) lo = mid;
      else hi = mid;
    }
    const span = g.km[hi] - g.km[lo] || 1;
    const v = (targetKm - g.km[lo]) / span;
    return {
      lon: g.lon[lo] + v * (g.lon[hi] - g.lon[lo]),
      lat: g.lat[lo] + v * (g.lat[hi] - g.lat[lo]),
      frac: u
    };
  }

  // 进出线顺延段：列车在走廊外侧再画 PORT_RUN_KM 公里后淡出
  const PORT_RUN_KM = 12;

  function angDiff(a, b) {
    let d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  }

  /** 走廊上 km 处的经纬度（按车站折线插值） */
  function llAtKm(def, K) {
    const s = def.stations;
    for (let i = 0; i < s.length - 1; i++) {
      if (K <= s[i + 1].km) {
        const u = Math.max(0, (K - s[i].km) / ((s[i + 1].km - s[i].km) || 1));
        return { lon: s[i].lon + u * (s[i + 1].lon - s[i].lon), lat: s[i].lat + u * (s[i + 1].lat - s[i].lat) };
      }
    }
    return s[s.length - 1];
  }

  function bearingOf(a, b) {
    return Math.atan2((b.lat - a.lat) * KY, (b.lon - a.lon) * KX) * 180 / Math.PI;
  }

  /** 走廊在 km 处的走向方位（km 增大方向） */
  function axisBearingAt(def, K) {
    const a = llAtKm(def, Math.max(0, K - 8));
    const b = llAtKm(def, K + 8);
    return bearingOf(a, b);
  }

  /** 端口列表（含两端顺延 edgeL/edgeR），带走向信息 */
  function corridorPorts(def) {
    if (def._ports) return def._ports;
    const maxKm = def.stations[def.stations.length - 1].km;
    const edges = def.edges || {};
    const out = (def.ports || []).map(p => ({ ...p, kind: 'branch' }));
    out.push({ id: 'edgeL', kind: 'edge', side: 'L', km: 0, label: edges.L || '', bearing: axisBearingAt(def, 0) + 180 });
    out.push({ id: 'edgeR', kind: 'edge', side: 'R', km: maxKm, label: edges.R || '', bearing: axisBearingAt(def, maxKm) });
    for (const p of out) {
      // 相对走廊走向的夹角：lean=+1 朝 km 增大一侧斜出，side=top 在下行方向左手侧
      const rel = (p.bearing - axisBearingAt(def, p.km)) * Math.PI / 180;
      if (p.lean == null) p.lean = Math.cos(rel) >= 0 ? 1 : -1;
      if (p.top == null) p.top = Math.sin(rel) >= 0;
    }
    def._ports = out;
    return out;
  }

  /** 走廊端点附近的平均速度（km/h），用于顺延段 */
  function boundarySpeed(points, atStart) {
    const n = points.length;
    const b = atStart ? points[0] : points[n - 1];
    for (let k = 1; k < n; k++) {
      const p = atStart ? points[k] : points[n - 1 - k];
      const dkm = Math.abs(p.km - b.km), dt = Math.abs(p.t - b.t);
      if (dkm >= 6 && dt > 0) return Math.max(40, Math.min(350, dkm / dt * 60));
    }
    return 100;
  }

  /**
   * 判定列车从哪个端口进入/驶出走廊；在走廊上始发/终到则返回 null。
   */
  function pickPort(def, stKmMap, STBY, tr, boundary, isIn) {
    const K = boundary.km;
    const terminal = isIn ? tr.s[0][0] : tr.s[tr.s.length - 1][0];
    if (stKmMap.has(terminal) && Math.abs(stKmMap.get(terminal) - K) < 8) return null;
    const maxKm = def.stations[def.stations.length - 1].km;
    const cands = corridorPorts(def).filter(p =>
      p.kind === 'edge' ? (p.side === 'L' ? K <= 4 : K >= maxKm - 4) : Math.abs(p.km - K) <= 12);
    if (!cands.length) return null;
    if (cands.length === 1) return cands[0];
    // 用走廊外侧第一个距离 >25km 的停站推断方位
    let refB = null;
    if (STBY) {
      const j = llAtKm(def, K);
      const n = tr.s.length;
      for (let k = 0; k < n; k++) {
        const s = isIn ? tr.s[n - 1 - k] : tr.s[k];
        const ts = isIn ? (s[2] != null ? s[2] : s[1]) : (s[1] != null ? s[1] : s[2]);
        if (ts == null || (isIn ? ts > boundary.t + 0.01 : ts < boundary.t - 0.01)) continue;
        const q = STBY[s[0]];
        if (!q || q.lon == null) continue;
        if (Math.hypot((q.lon - j.lon) * KX, (q.lat - j.lat) * KY) > 25) { refB = bearingOf(j, q); break; }
      }
    }
    if (refB == null) {
      cands.sort((a, b) => Math.abs(a.km - K) - Math.abs(b.km - K));
      return cands[0];
    }
    cands.sort((a, b) => angDiff(a.bearing, refB) - angDiff(b.bearing, refB));
    return cands[0];
  }

  /**
   * Builds the precomputed dataset and trajectories for a specific corridor.
   * 
   * @param {string} corridorId - 'c1_intercity' | 'c2_jh_hsr' | 'c3_jh_conv' | 'c4_jxt'
   * @param {Object} D - Map data with trains, glines, line_names
   * @param {Array} G - Decoded geometry array [{ km, lon, lat }, ...]
   * @param {Object} [STBY] - Optional station coordinate dictionary
   * @returns {Object} { def, trains }
   */
  function buildCorridor(corridorId, D, G, STBY) {
    const def = CORRIDOR_DEFS[corridorId];
    if (!def) throw new Error('Unknown corridorId: ' + corridorId);

    // 1. Build station lookup map stKmMap
    const stKmMap = new Map();
    def.stations.forEach(s => {
      stKmMap.set(s.name, s.km);
      if (s.aliases) s.aliases.forEach(a => stKmMap.set(a, s.km));
    });
    // Explicit wait-station km mappings for c3_jh_conv
    if (corridorId === 'c3_jh_conv') {
      const c3Waits = {
        '安定': 51,
        '广阳': 74,
        '杨村': 109,
        '汉沟镇': 116,
        '北仓': 123,
        '南仓': 130,
        '天津西': 148,
        '天津北': 145,
        '天津': 148,
        '唐官屯': 215
      };
      for (const [k, v] of Object.entries(c3Waits)) stKmMap.set(k, v);
    }

    // Reference chords connecting sequential corridor stations
    const chords = [];
    for (let i = 0; i < def.stations.length - 1; i++) {
      const a = def.stations[i], b = def.stations[i + 1];
      const ax = a.lon * KX, ay = a.lat * KY, bx = b.lon * KX, by = b.lat * KY;
      const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
      chords.push({ a, b, ax, ay, bx, by, dx, dy, len });
    }
    // Branch chord for c2_jh_hsr to 天津西 via 京津联络线
    if (corridorId === 'c2_jh_hsr') {
      const jjs = def.stations.find(s => s.name === '京津所');
      if (jjs) {
        const a = jjs;
        const b = { name: '天津西', km: 122, lon: 117.15712, lat: 39.15736 };
        const ax = a.lon * KX, ay = a.lat * KY, bx = b.lon * KX, by = b.lat * KY;
        const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
        chords.push({ a, b, ax, ay, bx, by, dx, dy, len });
      }
    }

    // 2. Set of own line indices in D.line_names matching def.osmLines
    const ownLineIndices = new Set();
    def.osmLines.forEach(name => {
      const idx = D.line_names.indexOf(name);
      if (idx >= 0) ownLineIndices.add(idx);
    });

    // 3. Helper projectLL(lon, lat)
    function projectLL(lon, lat) {
      const x = lon * KX, y = lat * KY;
      let best = NaN, bd = Infinity;
      for (const c of chords) {
        const u = Math.max(0, Math.min(1, ((x - c.ax) * c.dx + (y - c.ay) * c.dy) / (c.len * c.len)));
        const d = Math.hypot(c.ax + u * c.dx - x, c.ay + u * c.dy - y);
        if (d <= 14 && d < bd) {
          bd = d;
          best = c.a.km + u * (c.b.km - c.a.km);
        }
      }
      return best;
    }

    // 4. Helper legUsesCorridor(leg)
    function legUsesCorridor(leg) {
      if (!leg) return 0;
      const gid = leg[0];
      const g = G && G[gid];
      if (!g || !g.km || g.km.length < 2) return 0;
      const segs = (D.glines && D.glines[gid]) || [];
      if (!segs.length) return 0;
      const totalGkm = g.km[g.km.length - 1] || 1;
      let ownKm = 0;
      let si = 0;
      for (let j = 0; j < g.km.length - 1; j++) {
        const kMid = (g.km[j] + g.km[j + 1]) / 2;
        const f = kMid / totalGkm;
        while (si + 1 < segs.length && segs[si + 1][0] <= f) si++;
        const lineIdx = segs[si][1];
        if (ownLineIndices.has(lineIdx)) {
          const latMid = (g.lat[j] + g.lat[j + 1]) / 2;
          const lonMid = (g.lon[j] + g.lon[j + 1]) / 2;
          if (latMid >= 38.15 && latMid <= 40.05 && lonMid >= 116.15 && lonMid <= 117.85) {
            ownKm += (g.km[j + 1] - g.km[j]);
          }
        }
      }
      return ownKm;
    }

    // Helper to test if a point on geometry is on ownLineIndices
    function isPointOnOwnLine(gid, frac) {
      const segs = (D.glines && D.glines[gid]) || [];
      if (!segs.length) return true;
      let si = 0;
      while (si + 1 < segs.length && segs[si + 1][0] <= frac) si++;
      return ownLineIndices.has(segs[si][1]);
    }

    const corridorMaxKm = def.stations[def.stations.length - 1].km;
    const processedTrains = [];

    // 5. Sample each train
    for (const tr of D.trains) {
      if (!tr || tr.od) continue;

      // Filter: train must traverse the corridor
      // For c2_jh_hsr: train must serve the Beijing-Tianjin corridor (Beijing South, Langfang, or Tianjin West)
      if (corridorId === 'c2_jh_hsr') {
        const hasBj = tr.s.some(s => s[0] === '北京南' || s[0] === '北京');
        const hasLf = tr.s.some(s => s[0] === '廊坊');
        const hasTj = tr.s.some(s => s[0] === '天津西' || s[0] === '天津南');
        if (!hasBj && !(hasLf && hasTj)) continue;
      }
      // For c3_jh_conv: train must traverse Beijing-Langfang-Tianjin-Cangzhou corridor (not just Dongbei-Tangshan-Bazhou)
      if (corridorId === 'c3_jh_conv') {
        const hasBj = tr.s.some(s => ['北京', '北京丰台', '北京西', '北京南'].includes(s[0]));
        const hasLf = tr.s.some(s => ['廊坊北', '广阳'].includes(s[0]));
        const hasCz = tr.s.some(s => ['沧州', '青县', '静海'].includes(s[0]));
        if (!hasBj && !(hasLf && hasCz) && !(hasCz && tr.s.some(s => s[0].includes('天津')))) continue;
      }

      let totOwnKm = 0;
      const legOwnKms = new Float32Array(tr.l.length);
      for (let i = 0; i < tr.l.length; i++) {
        const k = legUsesCorridor(tr.l[i]);
        legOwnKms[i] = k;
        totOwnKm += k;
      }
      if (totOwnKm < (corridorId === 'c3_jh_conv' ? 15 : def.minSpanKm < 16 ? 12 : 15)) continue;

      const rawPoints = [];
      const stops = [];

      for (let i = 0; i < tr.l.length; i++) {
        const leg = tr.l[i];
        if (!leg) continue;
        if (legOwnKms[i] <= 0.1) continue;

        const s0Name = tr.s[i][0];
        const s1Name = tr.s[i + 1][0];
        const dep = leg[1], arr = leg[2], totalLegKm = leg[3] || 1;
        const gid = leg[0];
        const g = G && G[gid];
        if (!g || !g.km || g.km.length < 2) continue;

        // Record scheduled stop at s0Name
        if (tr.s[i][1] != null && tr.s[i][2] != null && tr.s[i][2] > tr.s[i][1]) {
          let km0 = stKmMap.get(s0Name);
          if (km0 === undefined) km0 = projectLL(g.lon[0], g.lat[0]);
          if (!isNaN(km0)) {
            stops.push({
              stName: s0Name,
              km: km0,
              tArr: tr.s[i][1],
              tDep: tr.s[i][2],
              isWait: false
            });
          }
        }

        // Sampling points along leg
        const ws = leg[5] || [];
        const tSamples = [dep];
        for (const w of ws) {
          if (w[1] > dep && w[1] < arr) tSamples.push(w[1]);
          if (w[2] > dep && w[2] < arr) tSamples.push(w[2]);
        }
        const P = D && D.profiles && D.profiles[leg[4]], SC = (D && D.profile_scale) || 10000;
        if (P) {
          for (let j = 2; j < P.length - 2; j += 2) {
            tSamples.push(dep + (P[j] / SC) * (arr - dep));
          }
        }
        // Intermediate ~4 km geometry steps
        const numSteps = Math.max(2, Math.ceil(totalLegKm / 4));
        for (let s = 1; s < numSteps; s++) {
          tSamples.push(dep + (s / numSteps) * (arr - dep));
        }
        tSamples.push(arr);
        tSamples.sort((a, b) => a - b);

        for (const t of tSamples) {
          let kmVal = NaN;
          if (t === dep && stKmMap.has(s0Name)) {
            kmVal = stKmMap.get(s0Name);
          } else if (t === arr && stKmMap.has(s1Name)) {
            kmVal = stKmMap.get(s1Name);
          } else {
            const sDist = legKm(leg, t, D);
            const ll = getGeomLL(G, gid, sDist, totalLegKm);
            if (ll && isPointOnOwnLine(gid, ll.frac)) {
              kmVal = projectLL(ll.lon, ll.lat);
            }
          }
          if (!isNaN(kmVal)) {
            rawPoints.push({ t, km: kmVal });
          }
        }

        // Collect inferred overtakes/waits from leg[5]
        for (const w of ws) {
          if (w[2] > w[1] + 0.1) {
            let waitKm = stKmMap.get(w[3]);
            if (waitKm === undefined) {
              const wDist = (w[0] || 0) * totalLegKm;
              const ll = getGeomLL(G, gid, wDist, totalLegKm);
              if (ll) waitKm = projectLL(ll.lon, ll.lat);
            }
            if (waitKm !== undefined && !isNaN(waitKm) && waitKm >= 0 && waitKm <= corridorMaxKm) {
              stops.push({
                stName: w[3],
                km: waitKm,
                tArr: w[1],
                tOut: w[2],
                tDep: w[2],
                isWait: true,
                waitTitle: w[4] || '待避',
                waitDetail: w[5] || ''
              });
            }
          }
        }

        // Record scheduled arrival stop at s1Name if final leg on corridor
        const isNextLegOnCorridor = i + 1 < tr.l.length && tr.l[i + 1] && legOwnKms[i + 1] > 0.1;
        if (!isNextLegOnCorridor && tr.s[i + 1][1] != null && tr.s[i + 1][2] != null && tr.s[i + 1][2] > tr.s[i + 1][1]) {
          let km1 = stKmMap.get(s1Name);
          if (km1 === undefined) km1 = projectLL(g.lon[g.lon.length - 1], g.lat[g.lat.length - 1]);
          if (!isNaN(km1)) {
            stops.push({
              stName: s1Name,
              km: km1,
              tArr: tr.s[i + 1][1],
              tDep: tr.s[i + 1][2],
              isWait: false
            });
          }
        }
      }

      if (rawPoints.length < 2) continue;

      // Sort points chronologically
      rawPoints.sort((a, b) => a.t - b.t);

      // Compute minKm, maxKm, and net travel direction
      let minKm = Infinity, maxKm = -Infinity;
      for (const p of rawPoints) {
        if (p.km < minKm) minKm = p.km;
        if (p.km > maxKm) maxKm = p.km;
      }
      if (maxKm - minKm < def.minSpanKm) continue;

      const netKm = rawPoints[rawPoints.length - 1].km - rawPoints[0].km;
      const isDown = netKm >= 0;

      // Enforce monotonicity along the travel direction
      const points = [];
      let lastKm = isDown ? -Infinity : Infinity;
      for (const p of rawPoints) {
        let k = p.km;
        if (isDown) {
          if (k < lastKm) k = lastKm;
          lastKm = k;
        } else {
          if (k > lastKm) k = lastKm;
          lastKm = k;
        }
        // Avoid duplicate consecutive identical timestamps
        if (points.length && Math.abs(points[points.length - 1].t - p.t) < 1e-4) {
          points[points.length - 1].km = k;
        } else {
          points.push({ t: p.t, km: k });
        }
      }

      if (points.length < 2) continue;

      const minT = points[0].t;
      const maxT = points[points.length - 1].t;

      stops.sort((a, b) => a.tArr - b.tArr);

      const inPort = pickPort(def, stKmMap, STBY, tr, points[0], true);
      const outPort = pickPort(def, stKmMap, STBY, tr, points[points.length - 1], false);

      processedTrains.push({
        tr,
        inPort,
        outPort,
        inSpeed: inPort ? boundarySpeed(points, true) : 0,
        outSpeed: outPort ? boundarySpeed(points, false) : 0,
        code: tr.c.split('/')[0],
        fullCode: tr.c,
        cls: clsOf(tr.c),
        dir: isDown ? 'down' : 'up',
        minT,
        maxT,
        minKm,
        maxKm,
        points,
        stops,
        origin: tr.s[0][0],
        dest: tr.s[tr.s.length - 1][0],
        model: tr.m || tr.ts || ''
      });
    }

    // Sort trains by minT
    processedTrains.sort((a, b) => a.minT - b.minT);

    return {
      id: corridorId,
      def,
      stations: def.stations,
      maxKm: corridorMaxKm,
      trains: processedTrains
    };
  }

  /**
   * Evaluates the real-time kinematic state of a train at minute T.
   * 
   * @param {Object} entry - A train trajectory entry from corridor.trains
   * @param {number} T - Current time in minutes (0.0 to 1440.0+)
   * @returns {Object|null} Train kinematic state, or null if inactive
   */
  function getTrainStateAt(entry, T, opts) {
    if (!entry || !entry.points || entry.points.length === 0) return null;

    const stoppedAt = (stop) => ({
      active: true, entry, tr: entry.tr, code: entry.code, dir: entry.dir,
      km: stop.km, kmh: 0, isStopped: true, onSiding: true, sidingRatio: 1.0,
      stopStName: stop.stName, station: stop.stName, isWait: !!stop.isWait,
      waitTitle: stop.waitTitle || '', waitDetail: stop.waitDetail || '',
      statusText: `${stop.stName} 停靠`
    });

    // 进出线顺延段（仅轨道图请求 opts.ports 时返回，运行图不画走廊外的部分）
    if (opts && opts.ports) {
      const run = (port, speed, dt, p, phase) => {
        const dist = dt * speed / 60;
        if (dist > PORT_RUN_KM) return null;
        return {
          active: true, entry, tr: entry.tr, code: entry.code, dir: entry.dir,
          km: p.km, kmh: Math.round(speed), isStopped: false, onSiding: false, sidingRatio: 0,
          stopStName: null, isWait: false,
          portRun: { port, phase, dist, frac: dist / PORT_RUN_KM },
          statusText: port.label ? `${phase === 'in' ? '自' : '驶往'}${port.label}` : `${Math.round(speed)} km/h`
        };
      };
      // 边界站有停站（如 G5 在北京南 474–479 停车）时，驶入段在到站时结束，驶出段在开车后才开始
      const p0 = entry.points[0], pN = entry.points[entry.points.length - 1];
      const s0 = entry.stops[0], sN = entry.stops[entry.stops.length - 1];
      const tIn = (s0 && s0.tArr < entry.minT && Math.abs(s0.km - p0.km) < 1) ? s0.tArr : entry.minT;
      const tOut = (sN && sN.tDep > entry.maxT && Math.abs(sN.km - pN.km) < 1) ? sN.tDep : entry.maxT;
      if (entry.inPort && T < tIn) {
        const r = run(entry.inPort, entry.inSpeed, tIn - T, p0, 'in');
        if (r && tIn < entry.minT) r.sidingRatio = Math.max(0, 1 - (tIn - T) / 0.8);
        return r;
      }
      if (entry.outPort && T > tOut) {
        const r = run(entry.outPort, entry.outSpeed, T - tOut, pN, 'out');
        if (r && tOut > entry.maxT) r.sidingRatio = Math.max(0, 1 - (T - tOut) / 0.8);
        return r;
      }
      if (entry.inPort && T < entry.minT) return stoppedAt(s0);
      if (entry.outPort && T > entry.maxT) return stoppedAt(sN);
    }

    // Grace windows: 1.5 min before origin departure, 1.0 min after terminal arrival
    if (T < entry.minT - 1.5 || T > entry.maxT + 1.0) {
      return null;
    }

    // 1. Check if T falls inside the origin boarding grace window
    if (T < entry.minT) {
      const p0 = entry.points[0];
      const originSt = (entry.stops[0] && entry.stops[0].stName) || entry.origin;
      return {
        active: true,
        entry,
        tr: entry.tr,
        code: entry.code,
        dir: entry.dir,
        km: p0.km,
        kmh: 0,
        isStopped: true,
        onSiding: true,
        sidingRatio: 1.0,
        stopStName: originSt,
        isWait: false,
        waitTitle: '',
        waitDetail: '',
        statusText: `${originSt} 候车`
      };
    }

    // 2. Check if T falls inside the final arrival grace window
    if (T > entry.maxT) {
      const pN = entry.points[entry.points.length - 1];
      const lastStop = entry.stops[entry.stops.length - 1];
      const destSt = (lastStop && lastStop.stName) || entry.dest;
      return {
        active: true,
        entry,
        tr: entry.tr,
        code: entry.code,
        dir: entry.dir,
        km: pN.km,
        kmh: 0,
        isStopped: true,
        onSiding: true,
        sidingRatio: 1.0,
        stopStName: destSt,
        isWait: false,
        waitTitle: '',
        waitDetail: '',
        statusText: `${destSt} 终到`
      };
    }

    // 3. Check if T is inside any scheduled passenger stop or inferred wait
    for (const stop of entry.stops) {
      if (T >= stop.tArr && T <= stop.tDep) {
        return {
          active: true,
          entry,
          tr: entry.tr,
          code: entry.code,
          dir: entry.dir,
          km: stop.km,
          kmh: 0,
          isStopped: true,
          onSiding: true,
          sidingRatio: 1.0,
          stopStName: stop.stName,
          station: stop.stName,
          isWait: !!stop.isWait,
          waitTitle: stop.waitTitle || '',
          waitDetail: stop.waitDetail || '',
          statusText: stop.isWait
            ? `${stop.stName} ${stop.waitTitle || '待避'}`
            : `${stop.stName} 停靠`
        };
      }
    }

    // 4. Moving train: binary search / scan entry.points for [p0, p1]
    const pts = entry.points;
    let lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].t <= T) lo = mid;
      else hi = mid;
    }

    const p0 = pts[lo], p1 = pts[hi];
    const dt = Math.max(0.01, p1.t - p0.t);
    const dkm = p1.km - p0.km;
    const alpha = Math.max(0, Math.min(1, (T - p0.t) / dt));
    const km = p0.km + alpha * dkm;

    // Check turnout gliding (sidingRatio): smoothly ramps 0.0 <-> 1.0 over 0.8 min near stops
    let sidingRatio = 0.0;
    for (const stop of entry.stops) {
      if (T >= stop.tDep && T - stop.tDep <= 0.8) {
        // Departed stop: gliding back from siding to mainline (1.0 -> 0.0)
        sidingRatio = Math.max(sidingRatio, 1.0 - (T - stop.tDep) / 0.8);
      } else if (T <= stop.tArr && stop.tArr - T <= 0.8) {
        // Approaching stop: diverging from mainline to siding (0.0 -> 1.0)
        sidingRatio = Math.max(sidingRatio, 1.0 - (stop.tArr - T) / 0.8);
      }
    }
    // 始发出站 / 终到进站（非进出线端口）也要渐变，避免在站线和正线之间瞬跳
    if (!entry.inPort && T - entry.minT <= 0.8) sidingRatio = Math.max(sidingRatio, 1.0 - (T - entry.minT) / 0.8);
    if (!entry.outPort && entry.maxT - T <= 0.8) sidingRatio = Math.max(sidingRatio, 1.0 - (entry.maxT - T) / 0.8);
    sidingRatio = Math.max(0, Math.min(1, sidingRatio));

    // Instantaneous speed calculation (km/h)
    let kmh = Math.min(355, Math.round(Math.abs(dkm) / (dt / 60)));
    if (sidingRatio > 0.05) {
      // Smoothly limit turnout switch speed to 45-80 km/h
      kmh = Math.round(kmh * (1.0 - sidingRatio * 0.65));
    }

    return {
      active: true,
      entry,
      tr: entry.tr,
      code: entry.code,
      dir: entry.dir,
      km,
      kmh,
      isStopped: false,
      onSiding: sidingRatio > 0.05,
      sidingRatio,
      stopStName: null,
      isWait: false,
      statusText: `${kmh} km/h`
    };
  }

  /** 整体平移一条列车轨迹的时间（跨夜车从前一天补到当天用） */
  function shiftEntry(e, dt) {
    return {
      ...e,
      minT: e.minT + dt,
      maxT: e.maxT + dt,
      points: e.points.map(p => ({ ...p, t: p.t + dt })),
      stops: e.stops.map(st => ({
        ...st,
        tArr: st.tArr + dt,
        tDep: st.tDep + dt,
        ...(st.tOut != null ? { tOut: st.tOut + dt } : {})
      })),
      tShift: (e.tShift || 0) + dt
    };
  }

  // Export module
  const CorridorData = {
    CORRIDOR_DEFS,
    clsOf,
    legKm,
    getGeomLL,
    buildCorridor,
    getTrainStateAt,
    corridorPorts,
    shiftEntry,
    PORT_RUN_KM
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CorridorData;
  }
  global.CorridorData = CorridorData;

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
