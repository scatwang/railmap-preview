// map.html · 车站几何属性（轴向）、同城多站、车站标记形状与拾取
// 经典脚本（非 module），与其它 map/*.js 共享全局作用域，加载顺序见 map.html
// 车站几何属性（规范见 docs/11-地图车站标记.md）：
//   st.axis      轴向单位向量（东, 北）：各通过列车 进站前 → 出站后 各 0.4 km 弦方向的倍角平均（≈ 站台方向）
//   st.lat/lon   改为经过列车区间几何端点（在铁路上）的平均位置
const AXIS_KM = 0.4;   // 轴向：通过列车 进站前 → 出站后 各 0.4 km 的弦（≈ 车站处线路切线）
function stationAxes(byName) {
  const bear = new Map(), side = new Map();   // 通过列车的弦方向 / 单侧（始发、终到）进出站方向
  const add = (m, st, a, b) => {
    const dx = (b[1] - a[1]) * Math.cos(a[0] * Math.PI / 180), dy = b[0] - a[0];
    if (dx || dy) { let v = m.get(st); if (!v) m.set(st, v = []); if (v.length < 60) v.push(Math.atan2(dy, dx)); }
  };
  // 车站显示位置：OSM 车站点多在站房上，改用经过列车区间几何端点（在铁路上）的平均位置
  const ends = new Map();
  const addEnd = (st, ll) => { let v = ends.get(st); if (!v) ends.set(st, v = [0, 0, 0]); v[0] += ll[0]; v[1] += ll[1]; v[2]++; };
  for (const tr of D.trains) tr.s.forEach(([name], i) => {
    const st = byName[name]; if (!st) return;
    const arr = tr.l[i - 1], dep = tr.l[i];
    if (arr && dep) {                          // 弯道上取远处的点会偏，只用紧贴车站的弦；端点未补齐的旧数据按缺口比例插值车站位置
      const ga = G[arr[0]], kN = ga._rawKN ?? (ga._rawKN = ga.km[ga.km.length - 1]);
      const gd = G[dep[0]], k0 = gd._rawK0 ?? (gd._rawK0 = gd.km[0]);
      const pa = geomPos(ga, kN), pd = geomPos(gd, k0);
      const din = Math.max(0, arr[3] - kN), dout = Math.max(0, k0), u = din + dout > 1e-4 ? din / (din + dout) : 0.5;
      addEnd(st, [pa[0] + u * (pd[0] - pa[0]), pa[1] + u * (pd[1] - pa[1])]);
      const pa0 = geomPos(ga, Math.max(ga.km[0], kN - AXIS_KM)), pd1 = geomPos(gd, Math.min(gd.km[gd.km.length - 1], k0 + AXIS_KM));
      // 换向折返车：进站与出站方向相反，pa0 → pd1 会变成横跨两股道的垂线；拆成两条单侧弦计入
      if ((pa[0] - pa0[0]) * (pd1[0] - pd[0]) + (pa[1] - pa0[1]) * (pd1[1] - pd[1]) >= 0) add(bear, st, pa0, pd1);
      else { add(bear, st, pa0, pa); add(bear, st, pd, pd1); }
    } else if (arr) {
      const g = G[arr[0]], kN = g._rawKN ?? (g._rawKN = g.km[g.km.length - 1]);
      if (arr[3] - kN < 0.05) addEnd(st, geomPos(g, kN));
      add(side, st, geomPos(g, Math.max(g.km[0], kN - AXIS_KM)), geomPos(g, kN));
    } else if (dep) {
      const g = G[dep[0]], k0 = g._rawK0 ?? (g._rawK0 = g.km[0]);
      if (k0 < 0.05) addEnd(st, geomPos(g, k0));
      add(side, st, geomPos(g, k0), geomPos(g, Math.min(g.km[g.km.length - 1], k0 + AXIS_KM)));
    }
  });
  for (const tr of D.trains) for (const leg of tr.l) if (leg && leg[5]) for (const w of leg[5]) if (w[4] && w[4].startsWith('技术停车')) {
    const st = byName[w[3]]; if (!st) continue;
    const g = G[leg[0]], sw = w[0] * leg[3];
    addEnd(st, geomPos(g, sw));
    add(side, st, geomPos(g, Math.max(g.km[0], sw - AXIS_KM)), geomPos(g, sw));
  }
  for (const [st, v] of ends) {
    const lat = v[0] / v[2], lon = v[1] / v[2], lat0 = st.lat0 ?? st.lat, lon0 = st.lon0 ?? st.lon;
    // 端点离原位置太远（>3 km，多为同名站匹配错）时不挪
    if (Math.hypot((lon - lon0) * Math.cos(lat * Math.PI / 180), lat - lat0) < 0.027) { st.lat = lat; st.lon = lon; }
  }
  // 兜底旧数据：几何首尾折点若缺了车站切分端点（k0 > 0 或 kN < leg.km），用车站坐标补齐首尾
  const doneG = new Uint8Array(G.length);
  for (const tr of D.trains) tr.l.forEach((leg, i) => {
    if (!leg || doneG[leg[0]]) return;
    doneG[leg[0]] = 1;
    const g = G[leg[0]]; if (g._patched) return;
    const n = g.km.length, k0 = g.km[0], kN = g.km[n - 1], L = leg[3];
    const s0 = k0 > 0.005 && byName[tr.s[i][0]], s1 = L - kN > 0.005 && byName[tr.s[i + 1][0]];
    const ok0 = s0 && Math.hypot((g.lon[0] - s0.lon) * 85, (g.lat[0] - s0.lat) * 111) <= k0 + 0.35;
    const ok1 = s1 && Math.hypot((g.lon[n - 1] - s1.lon) * 85, (g.lat[n - 1] - s1.lat) * 111) <= (L - kN) + 0.35;
    if (!ok0 && !ok1) return;
    const m = n + (ok0 ? 1 : 0) + (ok1 ? 1 : 0), o = ok0 ? 1 : 0;
    const km = new Float64Array(m), lon = new Float64Array(m), lat = new Float64Array(m);
    km.set(g.km, o); lon.set(g.lon, o); lat.set(g.lat, o);
    if (ok0) { km[0] = 0; lon[0] = s0.lon; lat[0] = s0.lat; }
    if (ok1) { km[m - 1] = L; lon[m - 1] = s1.lon; lat[m - 1] = s1.lat; }
    g.km = km; g.lon = lon; g.lat = lat; g._patched = 1;
    if (g.ele) {
      const ele = new Int16Array(m);
      ele.set(g.ele, o);
      if (ok0) ele[0] = s0.ele ?? g.ele[0];
      if (ok1) ele[m - 1] = s1.ele ?? g.ele[n - 1];
      g.ele = ele;
    }
  });
  // 轴向：方向的“倍角平均”（上下行方向相反也算同一轴）。优先用通过列车的弦；没有通过列车的站（只有始发终到）
  // 用单侧进出站方向；都没有的站横放。每个站都有轴向，z ≥ 7 一律画长方形
  for (const st of ST) {
    const v = bear.get(st) || side.get(st);
    let cx = 1, cy = 0;
    if (v) { cx = cy = 0; for (const b of v) { cx += Math.cos(2 * b); cy += Math.sin(2 * b); } }
    const phi = cx || cy ? Math.atan2(cy, cx) / 2 : 0;
    st.axis = [Math.cos(phi), Math.sin(phi)];
  }
}
// 同城多站：站名去掉后缀正好是另一个站名（≥2 字）、且相距 < 60 km 的，归到那个不带后缀的站（北京丰台、北京南 → 北京）。
// z ≤ CITY_MAX_Z 时只标不带后缀的站名，其标注门槛按全城最大站的停靠车次（cityN）算
const CITY_MAX_Z = 9;
function cityBases() {
  for (const st of ST) {
    for (let k = st.name.length - 1; k >= 2; k--) {
      const b = STBY[st.name.slice(0, k)];
      if (!b || b === st) continue;
      if (Math.hypot((b.lon - st.lon) * Math.cos(st.lat * Math.PI / 180), b.lat - st.lat) > 0.54) continue;
      st.cityBase = b; b.cityN = Math.max(b.cityN ?? b.n, st.n); break;
    }
  }
  // 省会、直辖市、特别行政区：有同名站用同名站，没有就用以城市名开头、车次最多的站（成都东、重庆北、香港西九龙）
  for (const c of CAPITALS) {
    let b = STBY[c];
    if (!b) for (const st of ST) if (st.name.startsWith(c) && (!b || st.n > b.n)) b = st;
    if (b) b.capital = true;
  }
}
const CAPITALS = ('北京 天津 上海 重庆 石家庄 太原 呼和浩特 沈阳 长春 哈尔滨 南京 杭州 合肥 福州 南昌 济南 郑州 武汉 长沙 ' +
  '广州 南宁 海口 成都 贵阳 昆明 拉萨 西安 兰州 西宁 银川 乌鲁木齐 香港 澳门 台北').split(' ');
const CAPITAL_Z = 6;                  // 此级省会一律标名（不论车次）

// 车站标记形状与尺寸（规范见 docs/11-地图车站标记.md）
const stZoomK = z => z >= 12 ? 2.3 : z === 11 ? 1.88 : z === 10 ? 1.48 : z === 9 ? 1.22 : z === 8 ? 1 : z === 7 ? 0.85 : z === 6 ? 1 : 0.88;
const ST_BIG_N = 100;                 // 当日停靠 ≥ 此数为大站
const ST_RECT_ALL_Z = 7;              // 此级起所有车站（有轴向的）都画长方形
const isBigStation = st => st.n >= ST_BIG_N;   // 只看停靠车次；接算站很多很小，不单独当大站
function stShape(st, z) {
  if (z <= 6 || !st.axis) return 'circle';
  if (z >= ST_RECT_ALL_Z) return 'rect';
  return isBigStation(st) ? 'circle' : 'rect';
}
// 长方形半长 L、半宽 W（像素）：缩小时按等级与缩放系数固定像素，放大后按真实站场尺寸换算，保持长宽比下限
function stRectSize(big, z, mpp, sel) {
  const rb = 2.2 * stZoomK(z) * (big ? 1.25 : 0.95) + (sel ? 2 : 0);
  const [lenM, widM, capL, capW] = big ? [450, 110, 56, 22] : [320, 65, 44, 16];
  const L = Math.min(capL, Math.max(rb * 1.75, lenM / mpp));
  let W = Math.min(capW, Math.max(rb * 0.82, widM / mpp));
  W = Math.min(capW, Math.max(W, L * (z >= 12 ? 0.34 : 0.28)));
  return [L, W];
}

function pickStation(e) {
  const p = map.mouseEventToContainerPoint(e.originalEvent); let best = null, bd = Infinity;
  const slack = isTouch() ? 8 : 0;
  for (const x of stShown) { const d = Math.hypot(x.p.x - p.x, x.p.y - p.y); if (d < x.hr + slack && d < bd) { bd = d; best = x.st; } }
  if (best) return best;
  for (const x of stShown) { const b = x.box; if (b && p.x >= b[0] && p.x <= b[2] && p.y >= b[1] && p.y <= b[3]) return x.st; }   // 站名也能点
  return null;
}
map.on('dragstart', () => { if (follow) { follow = false; draw(); } });
map.on('movestart zoomstart', () => showAuxTip(null));
map.on('click', e => {
  const a = pick(e), pst = a ? null : pickStation(e);
  if (!a && !pst) {
    const pbl = pickBorderLine(e);
    if (pbl && pbl.lid) {
      showAuxTip(null);
      sel = null; selSt = null; lineBackTr = null;
      setLine(pbl.lid);
      draw();
      return;
    }
  }
  showAuxTip(!a && !pst ? pickAux(e) : null);
  sel = a ? a.tr : null;
  selSt = pst;
  setLine(null);
  if (!sel && !selSt) $('panel').style.display = 'none';
  draw();
});
