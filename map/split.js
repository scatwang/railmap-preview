// map.html · 分屏运行图（iframe 嵌 diagram.html）与地图的双向同步
// 经典脚本（非 module），与其它 map/*.js 共享全局作用域，加载顺序见 map.html
// ===== 分屏运行图 =====
// 下半屏用 iframe 嵌 diagram.html，通过它的网址锚点（date、line、train、od）切换线路并同步高亮车次：
// 选中客里表线路就显示该线；选中车次时显示它当前所在线路（随车换线）；都没有时保留上一条
let splitOn = false, dgHash = null, dgLine = null, dgPin = null;
// 分屏不记忆：只有网址带 split=1 才打开
function dgLineNow() {
  if (selLine) return selLine;
  if (!sel) return null;
  if (dgPin && dgPin.tr === sel) return dgPin.line;
  const st = state(sel, T), ln = st && lineAt(sel, st);
  if (ln && (ln.lid || ln.name)) { const lid = ln.lid || kbLineFor(ln.name, sel, st); if (lid) return lid; }
  for (let li = 0; li < sel.l.length; li++) {
    const leg = sel.l[li], segs = leg && D.glines && D.glines[leg[0]];
    if (!segs) continue;
    for (const g of segs) if (g[1] >= 0) {
      const lid = kbLineFor(D.line_names[g[1]], sel, { i: li, li });
      if (lid) return lid;
    }
  }
  return null;
}
function syncDiagram() {
  if (!splitOn) return;
  const lid = dgLineNow() || dgLine;
  if (!lid) { $('dghint').style.display = ''; return; }
  dgLine = lid;
  const tr = sel || lineBackTr;
  const isDefDt = !curDate || (DATES && curDate === DATES.default);
  const lineName = KB && KB.lines[lid] ? KB.lines[lid].n : lid;
  const trPart = tr ? '&' + tr.c.split('/')[0] + (tr.od ? '&od=' + tr.od : '') : '';
  const dtPart = !isDefDt && curDate ? '&date=' + curDate : '';
  const h = `${encodeURIComponent(lineName)}${trPart}${dtPart}`;
  if (h === dgHash) return;
  dgHash = h; $('dghint').style.display = 'none';
  const f = $('dg');
  if (!f.getAttribute('src')) f.src = 'diagram.html#' + h;
  else try { f.contentWindow.location.hash = h; } catch (e) { f.src = 'diagram.html#' + h; }
}
// 地图当前时刻同步给运行图（画一条竖线）：时刻或日期变了才发；运行图页加载完也会来要一次
let dgTimeKey = null;
function syncDgTime(force) {
  if (!splitOn) return;
  const f = $('dg'); if (!f.getAttribute('src') || !f.contentWindow) return;
  const key = curDate + '|' + T;
  if (!force && key === dgTimeKey) return;
  dgTimeKey = key;
  f.contentWindow.postMessage({ type: 'railmap-time', t: T, date: curDate }, location.origin);
}
$('dg').addEventListener('load', () => syncDgTime(true));
addEventListener('message', e => {
  if (e.origin !== location.origin || !e.data) return;
  if (e.data.type === 'railmap-time-req') syncDgTime(true);
  else if (e.data.type === 'railmap-date' && e.data.date && e.data.date !== curDate) loadDate(e.data.date);
});
function setSplit(on) {
  splitOn = on;
  if (on) dgHash = null;
  document.body.classList.toggle('split', on);
  $('dgbtn').classList.toggle('on', on);
  syncDrawer(); document.body.classList.remove('legOpen');
  map.invalidateSize({ animate: false });
  draw();
  if (on) {
    const f = $('dg');
    if (f.getAttribute('src') && f.contentWindow) f.contentWindow.postMessage({ type: 'railmap-fit-sel' }, location.origin);
  }
  writeHash(true);
}
$('dgbtn').onclick = () => setSplit(!splitOn);
// 运行图里点车站名：选中该站并移到地图视野中（保留已选的客里表线路，取消选中的车次）
addEventListener('message', e => {
  if (e.origin !== location.origin || !e.data || e.data.type !== 'railmap-station') return;
  const st = STBY[e.data.name], ll = st ? [st.lat, st.lon] : e.data.ll ? [e.data.ll[1], e.data.ll[0]] : null;
  if (!ll) return;
  if (st) { sel = null; selSt = st; }
  viewAt(ll, Math.max(map.getZoom(), 11), undefined, !!st);
  draw();
});
// 运行图侧栏时刻表点停站/时刻：跳到该站停车或发车时刻，不在视野内则移过去并放大到至少 z10
addEventListener('message', e => {
  if (e.origin !== location.origin || !e.data) return;
  if (e.data.type === 'railmap-stop') {
    const tr = e.data.code ? findRun(e.data.code, e.data.od) : sel;
    const o = e.data.name && (STBY[e.data.name] || (AUXBY && AUXBY[e.data.name]));
    const ll = (tr && e.data.i != null && stopLatLng(tr, e.data.i, e.data.wi))
      || (o && [o.lat, o.lon])
      || (e.data.ll && [e.data.ll[1], e.data.ll[0]]) || null;
    if (okNum(e.data.t)) jumpT(e.data.t, ll);
    else if (ll) { panToPos(ll); draw(); }
    return;
  }
  if (e.data.type === 'railmap-jump-t' && okNum(e.data.t)) { jumpT(e.data.t); return; }
  if (e.data.type !== 'railmap-pan') return;
  if (STBY[e.data.name] || (AUXBY && AUXBY[e.data.name])) panToStation(e.data.name);
  else if (e.data.ll) { panToPos([e.data.ll[1], e.data.ll[0]]); draw(); }
});
// 运行图侧栏点“地图”：在地图上选中（高亮）该车次，必要时把时间拨到它运行期间并移到视野中；
// 下半屏运行图保持原线路不跳走（dgPin），直到在地图上换选别的对象
addEventListener('message', e => {
  if (e.origin !== location.origin || !e.data || e.data.type !== 'railmap-train') return;
  const tr = findRun(e.data.code, e.data.od); if (!tr) return;
  dgPin = e.data.line ? { tr, line: e.data.line } : null;
  sel = tr; selSt = null; lineBackTr = null; setLine(null);
  const s0 = tr.s[0][2]; if (s0 != null && (T < s0 || T > tr.s[tr.s.length - 1][1])) setT(s0 + 1);
  const st = state(tr, T);
  if (st && !map.getBounds().contains(st.pos)) map.setView(st.pos, Math.max(map.getZoom(), 8));
  draw();
});
try { const h = localStorage.getItem('railmap.dgH'); if (h) document.body.style.setProperty('--dgH', h); } catch (e) {}
$('dgsplit').addEventListener('pointerdown', e => {
  e.preventDefault(); document.body.classList.add('dgdrag');
  const H = innerHeight - barH(), lo = Math.min(120, H * 0.25);
  const move = ev => { const px = Math.min(H - lo, Math.max(lo, H - ev.clientY));
    document.body.style.setProperty('--dgH', px + 'px'); map.invalidateSize({ animate: false }); };
  const up = () => { document.body.classList.remove('dgdrag'); removeEventListener('pointermove', move); removeEventListener('pointerup', up);
    try { localStorage.setItem('railmap.dgH', getComputedStyle(document.body).getPropertyValue('--dgH').trim()); } catch (e) {}
    draw(); };
  addEventListener('pointermove', move); addEventListener('pointerup', up);
});
