// map.html · 图层与列车位置推算：列车 / 路网 canvas 图层、几何插值、运行曲线、停站姿态、state()
// 经典脚本（非 module），与其它 map/*.js 共享全局作用域，加载顺序见 map.html
// 列车图层：独立 canvas，每帧重绘
const Overlay = L.Layer.extend({
  onAdd(m) { this.c = L.DomUtil.create('canvas', ''); this.c.style.position = 'absolute'; this.c.style.pointerEvents = 'none';
    m.getPanes().overlayPane.appendChild(this.c); m.on('move zoom resize viewreset', this.reset, this); this.reset(); },
  reset() { const s = map.getSize(), dpr = devicePixelRatio || 1;
    L.DomUtil.setPosition(this.c, map.containerPointToLayerPoint([0, 0]));
    this.c.width = s.x * dpr; this.c.height = s.y * dpr; this.c.style.width = s.x + 'px'; this.c.style.height = s.y + 'px';
    this.ctx = this.c.getContext('2d'); this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw(); },
});
const overlay = new Overlay();

// 路网底图：按等级上色，独立 canvas，只在视图变化时重画（不随动画每帧重画）
// 路网分粗细两版（viz/pack.py）：z ≤ RAILS_LO_MAXZ 或精细版还没到时画粗糙版；放大过 RAILS_LO_MAXZ 才下载精细版。
// 未打包（本地）只有一版，两者是同一份
let RAILS_LO = null, RAILS_HI = null, railsHiPromise = null;   // [{cls, pts: Float32Array [lon,lat,...], bbox, ni, single: 0|1}]
const RAILS_LO_MAXZ = 6;
const railsAt = z => (z > RAILS_LO_MAXZ && RAILS_HI) || RAILS_LO || RAILS_HI || [];
function parseRails(rj) {
  const lines = Array.isArray(rj) ? rj : rj.lines, d4 = !Array.isArray(rj) && rj.enc === 'd4';   // 旧格式是纯数组
  let x = 0, y = 0;
  const rails = lines.map(([cls, f, ni, sg]) => {
    let pts;
    if (d4) {                                  // 1e-4 度整数差分，跨折线连续
      pts = new Float32Array(f.length);
      for (let j = 0; j < f.length; j += 2) { x += f[j]; y += f[j + 1]; pts[j] = x / 1e4; pts[j + 1] = y / 1e4; }
    } else pts = Float32Array.from(f);
    let w = 180, e = -180, s = 90, n = -90;
    for (let j = 0; j < pts.length; j += 2) { w = Math.min(w, pts[j]); e = Math.max(e, pts[j]); s = Math.min(s, pts[j + 1]); n = Math.max(n, pts[j + 1]); }
    return { cls, pts, bbox: [w, s, e, n], ni: ni ?? -1, single: sg ? 1 : 0 };
  });
  const aux = (Array.isArray(rj) ? [] : rj.aux || []).map(([name, lon, lat, kind, ax, ay, lns, sw]) => ({ name, lon, lat, kind, ax, ay, lines: lns || [], sw }));
  return { rails, aux, lo: !Array.isArray(rj) && rj.lod === 'lo' };
}
function loadRailsHi() {
  if (railsHiPromise || RAILS_HI || !(DATES && DATES.rails_lo && DATES.rails)) return;
  railsHiPromise = fetch(DATES.rails).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(rj => {
    const { rails, aux } = parseRails(rj);
    RAILS_HI = rails; AUX = aux; AUXBY = Object.fromEntries(AUX.map(a => [a.name, a]));
    if (railLayer.c) railLayer.redraw();
    draw();
  }).catch(() => { railsHiPromise = null; });
}
let AUX = [], AUXBY = {};            // 非客运站 {name, lon, lat, kind: 0 会让站 | 1 线路所, ax, ay（线路走向单位向量）, lines, sw: 1 有道岔证据 | 0 无}
const SINGLE_K = 0.55;               // 单线区段线宽倍数（z ≥ 8）
const RailLayer = L.Layer.extend({
  onAdd(m) { this.c = L.DomUtil.create('canvas', ''); this.c.style.position = 'absolute'; this.c.style.pointerEvents = 'none';
    m.getPanes().overlayPane.appendChild(this.c); m.on('moveend zoomend resize viewreset', this.redraw, this); this.redraw(); },
  redraw() {
    const s = map.getSize(), dpr = devicePixelRatio || 1;
    L.DomUtil.setPosition(this.c, map.containerPointToLayerPoint([0, 0]));
    this.c.width = s.x * dpr; this.c.height = s.y * dpr; this.c.style.width = s.x + 'px'; this.c.style.height = s.y + 'px';
    const ctx = this.c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const b = map.getBounds().pad(0.05), W = b.getWest(), E = b.getEast(), S = b.getSouth(), N = b.getNorth();
    const z = map.getZoom(), z0 = map.getZoom(), origin = map.getPixelOrigin(), topLeft = map.containerPointToLayerPoint([0, 0]);
    if (z > RAILS_LO_MAXZ) loadRailsHi();
    const RAILS = railsAt(z);
    const width = z <= 5 ? [0.6, 0.45, 0.35, 0.3] : z <= 6 ? [0.9, 0.7, 0.5, 0.35] : z <= 8 ? [1.5, 1.1, 0.8, 0.6] : [2.4, 1.9, 1.4, 1];
    const colors = [css('--r0'), css('--r1'), css('--r2'), css('--r3')];
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.globalAlpha = focus || selLine ? 0.3 : 1;   // 有选中时路网压暗
    for (const cls of [3, 2, 1, 0]) {          // 低等级先画，高铁压在上面
      if (z <= 5 && cls === 3) continue;       // 全国视图不画其他普速
      // z ≥ 8 单线区段细一档（SINGLE_K 倍线宽）：先画复线、再画单线
      for (const sg of z >= 8 ? [0, 1] : [null]) {
        ctx.strokeStyle = colors[cls]; ctx.lineWidth = width[cls] * (sg ? SINGLE_K : 1); ctx.beginPath();
        for (const r of RAILS) {
          if (r.cls !== cls || r.bbox[2] < W || r.bbox[0] > E || r.bbox[3] < S || r.bbox[1] > N) continue;
          if (sg !== null && r.single !== sg) continue;
          const p = r.pts;
          for (let j = 0; j < p.length; j += 2) {
            const q = map.project([p[j + 1], p[j]], z0);
            const x = q.x - origin.x - topLeft.x, y = q.y - origin.y - topLeft.y;
            j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
        }
        ctx.stroke();
      }
    }
    // 火车轮渡（粤海轮渡线）：普速线颜色的虚线
    ctx.strokeStyle = colors[2]; ctx.lineWidth = width[2]; ctx.setLineDash([4, 4]); ctx.beginPath();
    for (const r of RAILS) {
      if (r.cls !== 4 || r.bbox[2] < W || r.bbox[0] > E || r.bbox[3] < S || r.bbox[1] > N) continue;
      const p = r.pts;
      for (let j = 0; j < p.length; j += 2) {
        const q = map.project([p[j + 1], p[j]], z0);
        const x = q.x - origin.x - topLeft.x, y = q.y - origin.y - topLeft.y;
        j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
    }
    ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    if (selLine) this.drawLine(ctx, b);
  },
  // 选中的客里表线路：底图中 OSM 线名属于该线、且在该线车站范围内的线段，用高亮色画
  drawLine(ctx, b) {
    const hl = lineHighlight(selLine); if (!hl) return;
    const W = b.getWest(), E = b.getEast(), S = b.getSouth(), N = b.getNorth();
    const z0 = map.getZoom(), origin = map.getPixelOrigin(), topLeft = map.containerPointToLayerPoint([0, 0]);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    for (const r of railsAt(z0)) {
      if (!hl.names.has(r.ni)) continue;
      const bb = r.bbox;
      if (bb[2] < W || bb[0] > E || bb[3] < S || bb[1] > N) continue;
      if (bb[2] < hl.bbox[0] || bb[0] > hl.bbox[2] || bb[3] < hl.bbox[1] || bb[1] > hl.bbox[3]) continue;
      const p = r.pts;
      for (let j = 0; j < p.length; j += 2) {
        const q = map.project([p[j + 1], p[j]], z0), x = q.x - origin.x - topLeft.x, y = q.y - origin.y - topLeft.y;
        j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
    }
    ctx.strokeStyle = css('--bg'); ctx.lineWidth = z0 >= 9 ? 6 : 4.5; ctx.stroke();
    ctx.strokeStyle = css('--hl'); ctx.lineWidth = z0 >= 9 ? 3.5 : 2.5; ctx.stroke();
  },
});
const railLayer = new RailLayer();
const zoomEl = document.getElementById('zoom');
const showZoom = () => { zoomEl.textContent = 'z' + Math.round(map.getZoom()); };
map.on('zoomend', showZoom); showZoom();

function geomPos(g, km) {           // 在几何上按 km 插值
  const k = g.km; let lo = 0, hi = k.length - 1;
  if (km <= k[0]) return [g.lat[0], g.lon[0]];
  if (km >= k[hi]) return [g.lat[hi], g.lon[hi]];
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (k[m] <= km) lo = m; else hi = m; }
  const u = (km - k[lo]) / (k[hi] - k[lo] || 1);
  return [g.lat[lo] + u * (g.lat[hi] - g.lat[lo]), g.lon[lo] + u * (g.lon[hi] - g.lon[lo])];
}
function geomEle(g, km) {           // 在几何上按 km 插值高程（米）
  if (!g.ele) return null;
  const k = g.km; let lo = 0, hi = Math.min(k.length - 1, g.ele.length - 1);
  if (hi < 0) return null;
  if (km <= k[0]) return g.ele[0];
  if (km >= k[hi]) return g.ele[hi];
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (k[m] <= km) lo = m; else hi = m; }
  const u = (km - k[lo]) / (k[hi] - k[lo] || 1);
  const v0 = g.ele[lo], v1 = g.ele[hi];
  if (v0 == null || v1 == null || isNaN(v0) || isNaN(v1)) return null;
  return Math.round(v0 + u * (v1 - v0));
}

// 车头朝向：取前后各 h 处的点连线。h 至少 0.4 km，缩小时按屏幕像素放大（约 HEAD_PX 像素），
// 否则 z5 一像素约 4 km、0.4 km 内的小弯会让车头频繁转向；位置仍在真实轨道上，只是朝向按大尺度走向
const HEAD_KM = 0.4, HEAD_PX = 12;
const headKm = () => Math.max(HEAD_KM, HEAD_PX * 40075.017 * Math.cos(35 * Math.PI / 180) / (256 * 2 ** map.getZoom()));
function at(leg, km, hkOverride) {   // 区间内 km 处的位置及前后点
  // 先把 km 限制在几何实际覆盖的范围内（化简后末折点可能略短于区间全长），
  // 否则停站时前后两点会同落在末折点上，算不出朝向
  const g = G[leg[0]];
  let k0 = g.km[0], kN = g.km[g.km.length - 1];
  const k = Math.min(Math.max(km, k0), kN);
  if (leg[5]) for (const w of leg[5]) if (w[4] && w[4].startsWith('技术停车')) {
    const sw = Math.min(Math.max(w[0] * leg[3], k0), kN);
    if (k <= sw) kN = Math.min(kN, sw); else k0 = Math.max(k0, sw);
  }
  const hk = hkOverride || headKm(), h = Math.min(hk, (kN - k0) / 2 || hk);
  let kb = k - h, ka = k + h;
  if (kb < k0) { ka += k0 - kb; kb = k0; }
  if (ka > kN) { kb -= ka - kN; ka = kN; }
  return { pos: geomPos(g, k), back: geomPos(g, Math.max(k0, kb)), ahead: geomPos(g, Math.min(kN, ka)), ele: geomEle(g, k) };
}
// 区间内 t 时刻的里程与速度：优先按运动学运行曲线 D.profiles[leg[4]]（含两阶段推算限速、弯道/咽喉降速、推定停车及通过校准）插值，缺曲线时回退分段匀速
function legRun(leg, t) {
  const km = leg[3], ws = leg[5];
  let t0 = leg[1], s0 = 0, t1 = leg[2], s1 = km, stop0 = true, stop1 = true;
  if (ws) for (const w of ws) {
    const sw = w[0] * km, isStop = w[2] > w[1] + 0.05;
    if (t <= w[1]) { t1 = w[1]; s1 = sw; stop1 = isStop; break; }
    if (isStop && t <= w[2]) return { km: sw, kmh: 0, wait: w };
    t0 = w[2]; s0 = sw; stop0 = isStop;
  }
  const P = D.profiles && D.profiles[leg[4]], SC = D.profile_scale || 10000, dur = leg[2] - leg[1];
  if (P && P.length >= 4 && dur > 0 && km > 0) {
    const f = Math.max(0, Math.min(1, (t - leg[1]) / dur)), x = f * SC;
    let lo = 0, hi = (P.length >> 1) - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m << 1] <= x) lo = m; else hi = m; }
    const pt0 = P[lo << 1], ps0 = P[(lo << 1) + 1], pt1 = P[hi << 1], ps1 = P[(hi << 1) + 1];
    const pdt = pt1 - pt0, pds = ps1 - ps0;
    if (pdt <= 0 || pds <= 0) return { km: ps0 / SC * km, kmh: 0 };
    const segDt = pdt / SC * dur, segDs = pds / SC * km;
    const u = Math.max(0, Math.min(segDt, (x - pt0) / SC * dur));
    const atStop0 = lo === 0 || ps0 === P[((lo - 1) << 1) + 1];
    const atStop1 = hi === (P.length >> 1) - 1 || ps1 === P[((hi + 1) << 1) + 1];
    const tau0 = atStop0 ? Math.min(0.6, segDt * 0.35) : 0, tau1 = atStop1 ? Math.min(0.6, segDt * 0.35) : 0;
    const vm = segDs / (segDt - 0.5 * (tau0 + tau1));
    const k0 = ps0 / SC * km, k1 = ps1 / SC * km;
    if (u < tau0) return { km: k0 + vm * (u * u / (2 * tau0)), kmh: vm * 60 * (u / tau0) };
    if (u > segDt - tau1) { const r = segDt - u; return { km: k1 - vm * (r * r / (2 * tau1)), kmh: vm * 60 * (r / tau1) }; }
    return { km: k0 + vm * (u - tau0 / 2), kmh: vm * 60 };
  }
  const dt = t1 - t0, ds = s1 - s0;
  if (dt <= 0 || ds <= 0) return { km: s0, kmh: 0 };
  const u = Math.max(0, Math.min(dt, t - t0));
  const tau0 = stop0 ? Math.min(1.5, dt * 0.25) : 0, tau1 = stop1 ? Math.min(1.5, dt * 0.25) : 0;
  const vm = ds / (dt - 0.5 * (tau0 + tau1));
  if (u < tau0) return { km: s0 + vm * (u * u / (2 * tau0)), kmh: vm * 60 * (u / tau0) };
  if (u > dt - tau1) { const r = dt - u; return { km: s1 - vm * (r * r / (2 * tau1)), kmh: vm * 60 * (r / tau1) }; }
  return { km: s0 + vm * (u - tau0 / 2), kmh: vm * 60 };
}
const TERMINAL_DWELL = 5, BLEND_KM = 0.3;   // 始发前、终到后额外显示的停车分钟数；进出站咽喉股道过渡距离（km）
// 停站姿态对齐站台：位置贴合车站中心（距离 < 3 km 时），朝向严格平行于站台轴向 st.axis（或会让站切向），
// 正负号取列车进/出站局部 0.4 km 弦方向在站台轴上的投影，确保任何缩放级别与咽喉弯道下停站列车都平行于站台。
function stopPose(stName, prev, next, fallbackLeg, fallbackKm, arrT) {
  const r = prev ? at(prev, prev[3], HEAD_KM) : next ? at(next, 0, HEAD_KM) : fallbackLeg ? at(fallbackLeg, fallbackKm, HEAD_KM) : null;
  if (!r) return null;
  const cosLat = Math.cos(r.pos[0] * Math.PI / 180) || 1;
  let vx = (r.ahead[1] - r.back[1]) * cosLat, vy = r.ahead[0] - r.back[0];
  if (prev && next) {
    const rOut = at(next, 0, HEAD_KM);
    if (rOut) {
      const vx2 = (rOut.ahead[1] - rOut.back[1]) * cosLat, vy2 = rOut.ahead[0] - rOut.back[0];
      if (vx * vx2 + vy * vy2 >= 0) {
        const n1 = Math.hypot(vx, vy) || 1, n2 = Math.hypot(vx2, vy2) || 1;
        vx = vx / n1 + vx2 / n2; vy = vy / n1 + vy2 / n2;
      }
    }
  }
  const near = o => o && Math.hypot((r.pos[1] - o.lon) * cosLat, r.pos[0] - o.lat) < 0.027;
  const stObj = (STBY && near(STBY[stName]) && STBY[stName]) || (AUXBY && near(AUXBY[stName]) && AUXBY[stName]);
  if (stObj) {
    r.pos = [stObj.lat, stObj.lon];
    const axis = stObj.axis || (stObj.ax != null ? [stObj.ax, stObj.ay] : null);
    if (axis) {
      const [ax, ay] = axis, dot = vx * ax + vy * ay;
      const sgn = Math.abs(dot) > 1e-9 ? (dot >= 0 ? 1 : -1) : ((vx * ay - vy * ax) >= 0 ? 1 : -1);
      const dLat = sgn * ay * 0.002, dLon = sgn * ax * 0.002 / cosLat;
      r.back = [r.pos[0] - dLat, r.pos[1] - dLon];
      r.ahead = [r.pos[0] + dLat, r.pos[1] + dLon];
      r.stopSt = stName; r.stopSign = sgn; r.arrT = arrT ?? 0;
      return r;
    }
  }
  r.stopSt = stName; r.stopSign = vx >= 0 ? 1 : -1; r.arrT = arrT ?? 0;
  return r;
}
function blendStop(r, sp, rRef, w) {
  if (!sp || !rRef || w <= 0) return;
  const dlat = sp.pos[0] - rRef.pos[0], dlon = sp.pos[1] - rRef.pos[1];
  if (Math.abs(dlat) + Math.abs(dlon) < 0.004) {
    r.pos = [r.pos[0] + w * dlat, r.pos[1] + w * dlon];
  }
  const cosLat = Math.cos(r.pos[0] * Math.PI / 180) || 1;
  let x0 = (r.ahead[1] - r.back[1]) * cosLat, y0 = r.ahead[0] - r.back[0];
  let x1 = (sp.ahead[1] - sp.back[1]) * cosLat, y1 = sp.ahead[0] - sp.back[0];
  const n0 = Math.hypot(x0, y0) || 1, n1 = Math.hypot(x1, y1) || 1;
  x0 /= n0; y0 /= n0; x1 /= n1; y1 /= n1;
  if (x0 * x1 + y0 * y1 > 0) {
    const ux = (1 - w) * x0 + w * x1, uy = (1 - w) * y0 + w * y1, un = Math.hypot(ux, uy) || 1;
    const dLat = (uy / un) * 0.002, dLon = (ux / un) * 0.002 / cosLat;
    r.back = [r.pos[0] - dLat, r.pos[1] - dLon];
    r.ahead = [r.pos[0] + dLat, r.pos[1] + dLon];
  }
}
function state(tr, t) {            // 返回 {pos, back, ahead, moving, i, li, km, stopSt, stopSign, arrT}
  const S = tr.s, n = S.length;
  const start = S[0][2], end = S[n - 1][1];
  if (start == null || end == null || t < start - TERMINAL_DWELL || t > end + TERMINAL_DWELL) return null;
  if (t < start) {                   // 始发前：停在始发站，朝出站方向
    const r = tr.l[0] ? stopPose(S[0][0], null, tr.l[0], tr.l[0], 0, start - TERMINAL_DWELL) : null;
    return r && { ...r, moving: false, i: 0, li: 0, km: 0 };
  }
  if (t > end) {                     // 终到后：停在终到站，朝进站方向
    const prev = tr.l[n - 2];
    const r = prev ? stopPose(S[n - 1][0], prev, null, prev, prev[3], end) : null;
    return r && { ...r, moving: false, i: n - 1, li: n - 2, km: prev[3] };
  }
  for (let i = 0; i < n; i++) {
    const a = S[i][1] ?? S[i][2], d = S[i][2] ?? S[i][1];
    if (t >= a && t <= d) {          // 停站：朝向取进站方向（始发站取出站方向），对齐站台轴向
      const prev = tr.l[i - 1], next = tr.l[i];
      const arrT = i === 0 ? start - TERMINAL_DWELL : a;
      const r = stopPose(S[i][0], prev, next, null, 0, arrT);
      return r && { ...r, moving: false, i, li: next ? i : i - 1, km: next ? 0 : prev[3] };   // 停站时线路取出站方向
    }
    if (i < n - 1) {
      const leg = tr.l[i], d2 = S[i][2], a2 = S[i + 1][1];
      if (d2 != null && a2 != null && t > d2 && t < a2) {
        if (!leg) return null;
        const run = legRun(leg, t), prev = tr.l[i - 1];
        if (run.wait) {              // 区间途中停车（技术停车、待避、会车）：对齐所在车站/会让站方向
          const r = stopPose(run.wait[3], null, null, leg, run.km, run.wait[1]);
          return r && { ...r, moving: true, i, kmh: 0, li: i, km: run.km };
        }
        const r = at(leg, run.km);
        if (run.km < BLEND_KM) {     // 出站前 300 m 由站台位置与站台平行朝向平滑过渡到出站股道
          const sp = stopPose(S[i][0], prev, leg, leg, 0, d2);
          blendStop(r, sp, at(leg, 0), 1 - run.km / BLEND_KM);
        } else if (leg[3] - run.km < BLEND_KM) {   // 进站最后 300 m 平滑对齐到站台位置与站台平行朝向
          const sp = stopPose(S[i + 1][0], leg, tr.l[i + 1], leg, leg[3], a2);
          blendStop(r, sp, at(leg, leg[3]), 1 - (leg[3] - run.km) / BLEND_KM);
        }
        return { ...r, moving: true, i, kmh: run.kmh, li: i, km: run.km };
      }
    }
  }
  return null;
}
