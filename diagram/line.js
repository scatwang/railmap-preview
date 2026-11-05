// diagram.html · 线路参照折线、投影到本线、列车采样、剪口
// 经典脚本（非 module），与其它 diagram/*.js 共享全局作用域，加载顺序见 diagram.html
'use strict';
// ===== 线路 =====
let LINE_OPTS = [], LINE_BY_LABEL = {};
const lineLabel = (id, dup) => { const ln = KB.lines[id]; return dup && dup[ln.n] > 1 ? `${ln.n}（${id}）` : ln.n; };
function renderLineList() {
  const ids = Object.keys(KB.lines).sort((a, b) => KB.lines[a].n.localeCompare(KB.lines[b].n, 'zh'));
  const dup = {};
  for (const id of ids) dup[KB.lines[id].n] = (dup[KB.lines[id].n] || 0) + 1;
  LINE_OPTS = ids.map(id => ({ id, label: lineLabel(id, dup), len: KB.lines[id].len || 0, p: KB.lines[id].p || '' }));
  LINE_BY_LABEL = Object.fromEntries(LINE_OPTS.map(o => [o.label, o.id]));
}

// 线路参照折线：该支线有坐标的车站（按里程），平面坐标（km）+ 网格索引
// 参照折线选几何（见 buildLine）：两站之间这一截在本线上（onSegs）的占比 ≥ REF_OWN_FRAC 的优先；车站离几何 < REF_NEAR_KM 才截用
const REF_OWN_FRAC = 0.5, REF_NEAR_KM = 2, REF_MAX_TRY = 40;   // 每个站间最多看这么多条不同几何（按跨度从小到大）
function buildLine() {
  const ln = KB.lines[lineId];
  if (!ln) { LINE = null; return; }
  const zxs = [...new Set(ln.st.map(x => x[2]))].sort((a, b) => a - b);
  if (!zxs.includes(zx)) zx = zxs[0] ?? 0;
  $('zx').style.display = zxs.length > 1 ? '' : 'none';
  $('zx').innerHTML = zxs.map(z => `<option value="${z}">${z ? '支线 ' + z : '正线'}</option>`).join('');
  $('zx').value = zx;
  const st = ln.st.filter(x => x[2] === zx && x[1] != null).map(([name, km, , flag]) => {
    const info = STN[name];
    const ll = info ? (Array.isArray(info) ? info : info.ll) : null;
    const ele = info ? (Array.isArray(info) ? null : info.ele) : null;
    return { name, km, flag, ll, ele };
  });
  st.sort((a, b) => a.km - b.km);
  const withLL = st.filter(s => s.ll);
  const lat0 = withLL.length ? withLL.reduce((a, s) => a + s.ll[1], 0) / withLL.length : 35;
  const kx = 111.32 * Math.cos(lat0 * Math.PI / 180), ky = 110.54;
  // 本线的轨道：主线名（客里表线路 OSM 线名投票第一）的轨道 + 共线段归属含本线的轨道（network.membership，
  // 按客里表区间偏向本线求出的路径边）。数据没有归属（旧数据）时退回按全部对应线名判断。
  const hasMember = !!(D.member_sets && D.gmember);
  const own = new Set((hasMember ? (ln.osm || []).slice(0, 1) : (ln.osm || [])).map(n => D.line_names.indexOf(n)).filter(i => i >= 0));
  const mem = new Set();
  if (hasMember) D.member_sets.forEach((ids, i) => { if (ids.includes(+lineId)) mem.add(i); });
  LINE = { own, mem, any: !!(ln.osm && ln.osm.length) };   // onSegs 先要用到，下面再补全
  segCache.clear();
  const refSt = withLL.filter((s, i) => i === 0 || s.km > withLL[i - 1].km);
  const P = refSt.map(s => ({ x: s.ll[0] * kx, y: s.ll[1] * ky, km: s.km }));
  // 参照折线：相邻两个有坐标的站之间，尽量用列车实际走过的几何（站间直线在弯道处会偏出几公里）。
  // 候选：停站 A→C 都在本线、覆盖这两站的区间几何。把两站坐标投影到几何上（离几何都要 < REF_NEAR_KM），
  // 截出两站之间这一截，里程按两站官方里程线性分配；没有可用候选就用站间直线。
  // 挑选顺序：这一截上本线 OSM 线名占多数的优先，再比跨度（覆盖的本线站数）小，最后比这一截的本线占比。
  //   只按跨度挑时，跨度小的并行线几何会被选中：京九线马回岭–德安，D/G 车“庐山→德安”走昌九城际，
  //   跨度比京九上的 K 车小，两线最远相距 3 km，京九的车投影不上，图上成了“数据对不上”的剪口。
  //   占比只算两站之间这一截，不算整个区间：贵广客专佛山西–广州南，OSM 叫南广线（共线段），
  //   整段占比达标的“肇庆东→广州南”却走盐五联络线，按整段算会选错。
  //   距离不达标的候选直接跳过（胶济线淄博–昌乐，昌乐站坐标在胶济客专上、离胶济线 2.4 km）。
  const idx = new Map(refSt.map((s, i) => [s.name, i]));
  const cands = new Map();                // i → Map(gid → 跨度)（第 i 与 i+1 站之间的候选几何，同一几何取最小跨度）
  const nearestKm = (g, x, y) => { let bd = Infinity, bk = 0;
    for (let v = 0; v < g.km.length; v++) { const d = Math.hypot(g.lon[v] * kx - x, g.lat[v] * ky - y); if (d < bd) { bd = d; bk = g.km[v]; } }
    return [bk, bd]; };
  const subFrac = (gid, k0, k1) => {      // 几何 gid 上 [k0, k1] km 这一截里在本线上的占比
    const sg = onSegs(gid), g = G[gid], total = g.km[g.km.length - 1] || 1;
    if (!sg || k1 - k0 < 1e-6) return 0.5;
    const f0 = k0 / total, f1 = k1 / total; let f = 0;
    sg.forEach((x, j) => { if (x[1] !== 1) return;
      const a = Math.max(f0, x[0]), b = Math.min(f1, j + 1 < sg.length ? sg[j + 1][0] : 1); if (b > a) f += b - a; });
    return f / (f1 - f0);
  };
  for (const tr of D.trains) {
    if (tr.od) continue;
    for (let i = 0; i + 1 < tr.s.length; i++) {
      const leg = tr.l[i]; if (!leg) continue;
      const a = idx.get(tr.s[i][0]), b = idx.get(tr.s[i + 1][0]);
      if (a == null || b == null || a === b) continue;
      const lo = Math.min(a, b), hi = Math.max(a, b);
      for (let j = lo; j < hi; j++) {
        const m = cands.get(j) || cands.set(j, new Map()).get(j);
        if (!(m.get(leg[0]) <= hi - lo)) m.set(leg[0], hi - lo);
      }
    }
  }
  const ref = [];                          // [{x, y, km, real}]
  for (let j = 0; j + 1 < P.length; j++) {
    const A = P[j], B = P[j + 1];
    if (!ref.length) ref.push({ ...A, real: true });
    let pick = null;
    const list = [...(cands.get(j) || [])].sort((u, v) => u[1] - v[1]).slice(0, REF_MAX_TRY);
    for (const [gid, span] of list) {
      const g = G[gid];
      const [ka, da] = nearestKm(g, A.x, A.y), [kb, db] = nearestKm(g, B.x, B.y);
      if (!(da < REF_NEAR_KM && db < REF_NEAR_KM && Math.abs(kb - ka) > 0.2)) continue;
      const fr = subFrac(gid, Math.min(ka, kb), Math.max(ka, kb)), good = fr >= REF_OWN_FRAC;
      if (pick && (pick.good > good || (pick.good === good && (pick.span < span || (pick.span === span && pick.fr >= fr))))) continue;
      pick = { g, ka, kb, span, fr, good };
    }
    if (pick) {
      const { g, ka, kb } = pick, lo = Math.min(ka, kb), hi = Math.max(ka, kb), pts = [];
      for (let v = 0; v < g.km.length; v++) if (g.km[v] > lo && g.km[v] < hi) pts.push(v);
      if (ka > kb) pts.reverse();
      for (const v of pts) {
        const f = (g.km[v] - ka) / (kb - ka);
        ref.push({ x: g.lon[v] * kx, y: g.lat[v] * ky, km: A.km + f * (B.km - A.km), real: true });
      }
    }
    ref.push({ ...B, real: !!pick });
  }
  const chords = [];
  for (let i = 0; i + 1 < ref.length; i++) {
    const a = ref[i], b = ref[i + 1], len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-6) continue;
    chords.push({ a, b, len, tol: b.real ? 1.5 : Math.min(8, Math.max(1.5, 0.12 * len)) });
  }
  const CELL = 20, grid = new Map();
  chords.forEach((c, i) => {
    const t = Math.max(c.tol, OWN_TOL_KM);
    const x0 = Math.floor((Math.min(c.a.x, c.b.x) - t) / CELL), x1 = Math.floor((Math.max(c.a.x, c.b.x) + t) / CELL);
    const y0 = Math.floor((Math.min(c.a.y, c.b.y) - t) / CELL), y1 = Math.floor((Math.max(c.a.y, c.b.y) + t) / CELL);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const k = x + ',' + y; (grid.get(k) || grid.set(k, []).get(k)).push(i); }
  });
  kmin = st.length ? st[0].km : 0; kmax = st.length ? st[st.length - 1].km : 100;
  if (kmax - kmin < 1) kmax = kmin + 1;
  // 非客运站（会让站 / 线路所）：map_kelibiao 的 aux，里程是 build 时按坐标在相邻客运站间内插的。
  // 只用于显示与对齐推定停车台阶，不加入参照折线（参照折线是按列车实际几何截取的，站点内插点不在其上，加进去会引入折返风险）。
  const aux = (ln.aux || []).filter(a => a[2] === zx).map(([name, km, , kind]) => ({ name, km, kind }));
  aux.sort((a, b) => a.km - b.km);
  const auxMap = new Map(aux.map(a => [a.name, a.km]));
  LINE = { ln, st, aux, auxMap, chords, grid, CELL, kx, ky, own, mem, any: LINE.any, nLL: withLL.length };
}
let PD = Infinity;                      // 最近一次投影的横向距离（km）
// 列车所在轨道在本线上（onSegs 状态 1）时，投影容差放宽到 OWN_TOL_KM：1.5 km 的容差是为挡住并行线，
// 本线轨道不必挡。复线上下行分开选线的（如襄渝线白河县–蜀河，二线另走一条线位，OSM 都叫襄渝线），
// 参照线只能沿其中一条，另一方向的车离它可能超过 1.5 km。
const OWN_TOL_KM = 4;
function projectLL(lon, lat, minTol = 0) {   // → 线上里程，或 NaN（离线）；横向距离存 PD
  const L = LINE, x = lon * L.kx, y = lat * L.ky;
  const ids = L.grid.get(Math.floor(x / L.CELL) + ',' + Math.floor(y / L.CELL));
  PD = Infinity;
  if (!ids) return NaN;
  let best = NaN, bd = Infinity;
  for (const i of ids) {
    const c = L.chords[i], dx = c.b.x - c.a.x, dy = c.b.y - c.a.y;
    const u = Math.max(0, Math.min(1, ((x - c.a.x) * dx + (y - c.a.y) * dy) / (c.len * c.len)));
    const d = Math.hypot(c.a.x + u * dx - x, c.a.y + u * dy - y);
    if (d <= Math.max(c.tol, minTol) && d < bd) { bd = d; best = c.a.km + u * (c.b.km - c.a.km); }
  }
  PD = bd;
  return best;
}

// 几何 gid 上哪些部分在本线上：[[起点比例, 状态], …]，状态 1 本线（主线名或共线段归属含本线）、
// 0 无名轨道、-1 别线。只按轨道归属判断，不看距离：贴得再近的并行线也是别线（如昌九城际在九江、庐山、德安、
// 永修附近离京九线只有几十米，以前按距离算会把昌九城际的车画到京九线图上）。
// 夹在两段本线之间、短于 GAP_KM 的别线段（单独命名的桥、站场、疏解线）算本线。几何没有线路分段时返回 null（不筛）。
const GAP_KM = 12;
const segCache = new Map();
function onSegs(gid) {
  if (segCache.has(gid)) return segCache.get(gid);
  const sg = (D.glines && D.glines[gid]) || [], gm = (D.gmember && D.gmember[gid]) || [];
  let res = null;
  if (sg.length && LINE.any) {
    const cuts = [...new Set([...sg.map(x => x[0]), ...gm.map(x => x[0])])].sort((a, b) => a - b);
    res = [];
    let i = 0, j = 0;
    for (const f of cuts) {
      while (i + 1 < sg.length && sg[i + 1][0] <= f + 1e-9) i++;
      while (j + 1 < gm.length && gm[j + 1][0] <= f + 1e-9) j++;
      const name = sg[i][1], m = gm.length && gm[j][0] <= f + 1e-9 ? gm[j][1] : -1;
      const st = LINE.own.has(name) || (m >= 0 && LINE.mem.has(m)) ? 1 : name < 0 ? 0 : -1;
      if (!res.length || res[res.length - 1][1] !== st) res.push([f, st]);
    }
    const total = G[gid].km[G[gid].km.length - 1] || 1;
    for (let k = 1; k + 1 < res.length; k++)
      if (res[k][1] === -1 && (res[k + 1][0] - res[k][0]) * total <= GAP_KM && res[k - 1][1] === 1 && res.slice(k + 1).some(x => x[1] === 1))
        res[k] = [res[k][0], 1];
  }
  segCache.set(gid, res);
  return res;
}
const mapCache = new Map();
function geomMap(gid) {
  if (mapCache.has(gid)) return mapCache.get(gid);
  const g = G[gid], segs = onSegs(gid) || [], n = g.km.length, total = g.km[n - 1] || 1;
  const out = new Float32Array(n);
  out.foreign = new Uint8Array(n);       // 1：该点在别线的轨道上（车离开了本线，见 findCuts）
  let si = 0;
  for (let v = 0; v < n; v++) {
    const f = g.km[v] / total;
    while (si + 1 < segs.length && segs[si + 1][0] <= f + 1e-6) si++;
    const stt = segs.length ? segs[si][1] : 1;
    if (stt === -1) { out[v] = NaN; out.foreign[v] = 1; continue; }
    out[v] = projectLL(g.lon[v], g.lat[v], stt === 1 ? OWN_TOL_KM : 0);
  }
  mapCache.set(gid, out);
  return out;
}
const legTouches = gid => { const s = onSegs(gid); return !s || s.some(x => x[1] === 1); };
function geomForeign(gid, km) {         // 几何 gid 上 km 处是否在别线名的轨道上
  const g = G[gid], fo = geomMap(gid).foreign, k = g.km, n = k.length;
  if (km <= k[0]) return fo[0];
  if (km >= k[n - 1]) return fo[n - 1];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (k[mid] <= km) lo = mid; else hi = mid; }
  return fo[lo] | fo[hi];
}
function geomKmToLine(gid, km) {
  const g = G[gid], m = geomMap(gid), k = g.km, n = k.length;
  if (km <= k[0]) return m[0];
  if (km >= k[n - 1]) return m[n - 1];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (k[mid] <= km) lo = mid; else hi = mid; }
  const a = m[lo], b = m[hi];
  if (!(a === a) || !(b === b)) return NaN;
  const u = (km - k[lo]) / (k[hi] - k[lo] || 1);
  return a + u * (b - a);
}
// 区间内 t 时刻的几何里程：优先按运动学运行曲线 D.profiles[leg[4]]（含两阶段推算限速、弯道/咽喉降速、推定停车及通过校准）折线插值
function legKm(leg, t) {
  const km = leg[3], useWait = !$('showWait') || $('showWait').checked, ws = useWait && leg[5];
  let t0 = leg[1], s0 = 0;
  if (t <= t0) return 0;
  if (t >= leg[2]) return km;
  const P = (useWait || !leg[5]) && D.profiles && D.profiles[leg[4]], SC = D.profile_scale || 10000, dur = leg[2] - t0;
  if (P && P.length >= 4 && dur > 0) {
    const x = Math.max(0, Math.min(SC, (t - t0) / dur * SC));
    let lo = 0, hi = (P.length >> 1) - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m << 1] <= x) lo = m; else hi = m; }
    const pt0 = P[lo << 1], ps0 = P[(lo << 1) + 1], pt1 = P[hi << 1], ps1 = P[(hi << 1) + 1];
    return (pt1 > pt0 ? ps0 + (x - pt0) / (pt1 - pt0) * (ps1 - ps0) : ps0) / SC * km;
  }
  if (ws) for (const w of ws) {
    const sw = w[0] * km;
    if (t <= w[1]) return w[1] > t0 ? s0 + (t - t0) / (w[1] - t0) * (sw - s0) : s0;
    if (t <= w[2]) return sw;
    t0 = w[2]; s0 = sw;
  }
  return t < leg[2] && leg[2] > t0 ? s0 + (t - t0) / (leg[2] - t0) * (km - s0) : km;
}

// 每趟车：在线上的连续折线（[t, km] 交错的 Float32Array 列表）+ 推定停车段
const AUX_LABEL_PX = 14;               // 非客运站站名最小纵向间距（像素）
const STEP = 0.5, JUMP_KM = 6, EXIT_KM = 1.5;
const nearStation = k => LINE.st.some(s => !(s.flag & 2) && Math.abs(s.km - k) <= EXIT_KM);
function sampleTrains() {
  mapCache.clear();
  segCache.clear();
  TR = [];
  CUTS = [];
  if (!LINE || LINE.nLL < 2) return;
  for (const tr of D.trains) {
    const legs = tr.l;
    if (!legs.some(l => l && legTouches(l[0]))) continue;
    const pieces = [], waits = [];
    // 每截记 fb：这一截之前的空档里，在别线名轨道上的采样点占比（findCuts 据此区分“车离开本线”与“画不出来”）
    let cur = [], curFb = 0, gapN = 0, gapF = 0;
    const flush = () => { if (cur.length >= 4) { const p = Float32Array.from(cur); p.fb = curFb; pieces.push(p); } cur = []; };
    const push = (t, k, foreign) => {
      if (!(k === k)) { flush(); gapN++; if (foreign) gapF++; return; }
      if (cur.length && Math.abs(k - cur[cur.length - 1]) > JUMP_KM && t - cur[cur.length - 2] < 3) flush();
      if (!cur.length) { curFb = gapN ? gapF / gapN : 0; gapN = gapF = 0; }
      cur.push(t, k);
    };
    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      if (!leg || !legTouches(leg[0])) { flush(); continue; }
      const dep = leg[1], arr = leg[2], useWait = !$('showWait') || $('showWait').checked, ws = (useWait && leg[5]) || [];
      const ts = [dep];
      for (let t = dep + STEP; t < arr; t += STEP) ts.push(t);
      for (const w of ws) if (w[1] > dep && w[2] < arr) ts.push(w[1], w[2]);
      const P = (useWait || !leg[5]) && D.profiles && D.profiles[leg[4]], SC = D.profile_scale || 10000;
      if (P) for (let j = 2; j < P.length - 2; j += 2) ts.push(dep + P[j] / SC * (arr - dep));
      ts.push(arr);
      ts.sort((a, b) => a - b);
      for (let k = 0; k < ts.length; k++) {
        const t = ts[k];
        if (k > 0 && t - ts[k - 1] < 1e-4) continue;
        const s = legKm(leg, t);
        push(t, geomKmToLine(leg[0], s), geomForeign(leg[0], s));
      }
      // 到站停车（下一区间发车前）：下一区间会从同一点接上，形成水平段（不含 t_in == t_out 的通过校准折点）
      for (const w of leg[5] || []) if (w[2] > w[1] + 0.05) {
        const k = geomKmToLine(leg[0], w[0] * leg[3]);
        if (k === k) {
          // 停在非客运站：台阶落在该站的内插里程上（与推算里程差 3 km 以内才对齐，防同名站误吸附）
          const ak = LINE.auxMap.get(w[3]);
          waits.push([w[1], w[2], ak != null && Math.abs(ak - k) < 3 ? ak : k, w[3], w[4], w[5]]);
        }
      }
    }
    flush();
    if (!pieces.length) continue;
    let tmin = Infinity, tmax = -Infinity, kmn = Infinity, kmx = -Infinity;
    for (const p of pieces) for (let j = 0; j < p.length; j += 2) {
      if (p[j] < tmin) tmin = p[j]; if (p[j] > tmax) tmax = p[j];
      if (p[j + 1] < kmn) kmn = p[j + 1]; if (p[j + 1] > kmx) kmx = p[j + 1];
    }
    if (kmx - kmn < 2) continue;              // 只是在线上某站附近擦过
    // 方向：各段里程净变化之和，增加为下行（客里表里程从起点端算起），减少为上行
    let net = 0;
    for (const p of pieces) net += p[p.length - 1] - p[1];
    // 在站间离开 / 进入本线的线头（离最近车站 > EXIT_KM）：记下离线后的下一站 / 上线前的上一站，图上标去向
    const exits = [], S = tr.s;
    for (const p of pieces) for (const [t, k, out] of [[p[0], p[1], false], [p[p.length - 2], p[p.length - 1], true]]) {
      if (nearStation(k)) continue;
      let nm = null;
      if (out) { const x = S.find(x => (x[1] ?? x[2]) > t + 0.01); nm = x && x[0]; }
      else { for (const x of S) if ((x[2] ?? x[1]) < t - 0.01) nm = x[0]; }
      exits.push({ t, k, out, nm });
    }
    TR.push({ tr, pieces, waits, exits, joins: [], cls: clsOf(tr.c), bb: [tmin, tmax, kmn, kmx], dir: net >= 0 ? 'down' : 'up' });
  }
  findCuts();
}

// 剪口：同一趟车相邻两截运行线之间的空档（前一截末 → 后一截首，相隔 < CUT_MAX_MIN 分钟、
// 沿行车方向前进 ≥ CUT_MIN_KM）说明车其实一直在线上、只是这段画不出来（OSM 线名与客里表不一致、参照线偏离等）。
// 空档里的轨道主要是别线名的（≥ FOREIGN_GAP）不算：那是车离开本线走了并行线，两端照常标去向。
// 按 1 km 分格统计：某格被空档覆盖的车次 ≥ 2 且 ≥ 经过该格车次的 30%，算差别段；相邻格合并为剪口（≥ CUT_MIN_KM）。
// 落在剪口里的空档用虚线接上（joins），两端不再算出入本线（exits）。
const CUT_MAX_MIN = 120, CUT_MIN_KM = 2, FOREIGN_GAP = 0.5;
function findCuts() {
  if (!TR.length) return;
  const n = Math.ceil(kmax - kmin) + 1, gapN = new Int32Array(n), passN = new Int32Array(n);
  const bin = k => Math.max(0, Math.min(n - 1, Math.floor(k - kmin)));
  const gaps = [];
  for (const o of TR) {
    const ps = [...o.pieces].sort((a, b) => a[0] - b[0]);
    const sgn = o.dir === 'down' ? 1 : -1;
    for (const p of ps) {
      let lo = Infinity, hi = -Infinity;
      for (let j = 1; j < p.length; j += 2) { if (p[j] < lo) lo = p[j]; if (p[j] > hi) hi = p[j]; }
      for (let b = bin(lo); b <= bin(hi); b++) passN[b]++;
    }
    for (let i = 0; i + 1 < ps.length; i++) {
      const p = ps[i], q = ps[i + 1];
      const t1 = p[p.length - 2], k1 = p[p.length - 1], t2 = q[0], k2 = q[1];
      if (t2 - t1 > CUT_MAX_MIN || t2 < t1 || (k2 - k1) * sgn < CUT_MIN_KM) continue;
      if (q.fb >= FOREIGN_GAP) continue;  // 空档里主要走别线名的轨道：车确实离开了本线（如郑渝高铁的车在长寿北–重庆北走并行的郑渝线），不是画不出来
      gaps.push({ o, t1, k1, t2, k2 });
      for (let b = bin(Math.min(k1, k2)) + 1; b < bin(Math.max(k1, k2)); b++) gapN[b]++;
    }
  }
  const bad = Array.from(gapN, (g, b) => g >= 2 && g >= 0.3 * (g + passN[b]));
  for (let b = 0; b < n; b++) {
    if (!bad[b]) continue;
    let e = b; while (e + 1 < n && bad[e + 1]) e++;
    if (e - b + 1 >= CUT_MIN_KM) CUTS.push([kmin + b, kmin + e + 1]);
    b = e;
  }
  // 空档两端各放宽 3 km 仍落在某个剪口里的：接上
  for (const g of gaps) {
    const lo = Math.min(g.k1, g.k2), hi = Math.max(g.k1, g.k2);
    if (!CUTS.some(([a, b]) => lo >= a - 3 && hi <= b + 3)) continue;
    g.o.joins.push([g.t1, g.k1, g.t2, g.k2]);
    g.o.exits = g.o.exits.filter(e => !((e.t === g.t1 && e.k === g.k1) || (e.t === g.t2 && e.k === g.k2)));
  }
}
