// map.html · 客里表线路：高亮、线路面板、面板内点击交互、移到某站
// 经典脚本（非 module），与其它 map/*.js 共享全局作用域，加载顺序见 map.html
// 客里表（map_kelibiao.json）：线路、车站所属线路与接算里程
function setLine(lid) {
  if (lid === selLine) return;
  selLine = lid;
  setFocus();
}
let topMaxLen = null;
function lineHighlight(lid) {                 // {names: Set(底图线名下标), bbox: [w, s, e, n]}
  if (hlCache.has(lid)) return hlCache.get(lid);
  const ln = KB && KB.lines[lid]; let res = null;
  if (ln) {
    if (!topMaxLen) {
      topMaxLen = new Map();
      for (const l of Object.values(KB.lines)) if (l.osm && l.osm[0])
        topMaxLen.set(l.osm[0], Math.max(topMaxLen.get(l.osm[0]) || 0, l.len || 0));
    }
    const idx = new Map(KB.rail_names.map((n, i) => [n, i])), L = ln.len || 0;
    // 次要线名若已是更长干线的主线名（如达成线末段借襄渝线、并行段被拉到京沪高铁），不按全线外接框整名高亮，免得画出分叉
    const own = ln.osm.filter((n, i) => i === 0 || (topMaxLen.get(n) || 0) <= L);
    const names = new Set(own.map(n => idx.get(n)).filter(i => i != null));
    let w = 180, e = -180, s = 90, n = -90;
    for (const [name] of ln.st) { const st = STBY[name] || (AUXBY && AUXBY[name]); if (!st) continue;
      w = Math.min(w, st.lon); e = Math.max(e, st.lon); s = Math.min(s, st.lat); n = Math.max(n, st.lat); }
    if (w > e && ln.osm && ln.osm[0] === ln.n && names.size) {
      for (const r of railsAt(map.getZoom())) if (names.has(r.ni)) {
        w = Math.min(w, r.bbox[0]); s = Math.min(s, r.bbox[1]); e = Math.max(e, r.bbox[2]); n = Math.max(n, r.bbox[3]);
      }
    }
    if (w <= e) res = { names, bbox: [w - 0.08, s - 0.08, e + 0.08, n + 0.08] };
  }
  hlCache.set(lid, res); return res;
}
const kmTxt = km => km == null ? '' : 'K' + (Math.round(km * 10) / 10);
// 单线区间（map.py 的 lines[id].ss / single）：来源说明、区间集合、面板标题行的“部分单线：A–B、C–D”
const SG_SRC = { csv: '单线清单（维基）', link: '联络线', osm_tracks1: 'OSM tracks=1' };
const sgSrcTxt = s => (s || '').split(',').filter(Boolean).map(x => SG_SRC[x] || x).join('、');
function lineSingle(ln) {
  const ss = ln.ss || [], whole = ss.find(x => !x[0] && !x[1]), sec = new Map();
  for (const [a, b, src] of ss) if (a) { sec.set(a + '|' + b, src); sec.set(b + '|' + a, src); }
  const srcOf = g => whole ? whole[2] : sec.get(g[1] + '|' + g[2]);   // 区间（客里表 legs 项）的单线来源，复线为 undefined
  let txt = '';
  if (ln.single === 'all') txt = '单线';
  else if (ln.single === 'part') {
    const runs = []; let cur = null;   // 连续的单线区间合并成段（同一支线内、前一区间止站 = 后一区间起站）
    for (const g of ln.legs) {
      if (srcOf(g) == null) { cur = null; continue; }
      if (cur && cur.zx === g[0] && cur.to === g[1]) cur.to = g[2]; else { cur = { zx: g[0], from: g[1], to: g[2] }; runs.push(cur); }
    }
    const lab = runs.length ? runs.map(r => dn(r.from) + '–' + dn(r.to)) : ss.filter(x => x[0]).map(x => dn(x[0]) + '–' + dn(x[1]));
    txt = '部分单线：' + lab.slice(0, 4).join('、') + (lab.length > 4 ? ` 等 ${lab.length} 段` : '');
  }
  return { srcOf, txt };
}
let linePanelKey = null;
function linePanel() {
  const key = selLine + '|' + (selSt ? selSt.name : '') + '|' + (lineBackTr ? lineBackTr.c + '|' + runOd(lineBackTr) : '') + '|' + (curDate || '');
  if (key === linePanelKey) return;
  linePanelKey = key;
  const ln = KB.lines[selLine], legEnd = new Map(ln.legs.map(g => [g[0] + '|' + g[2], g])), sgl = lineSingle(ln);
  let lastZx = 0;
  const rows = ln.st.map(([name, km, zx, flag, lim, ju, code]) => {
    const g = legEnd.get(zx + '|' + name), head = zx !== lastZx ? `<tr><td colspan="5" class="note">支线 ${zx}</td></tr>` : '';
    lastZx = zx;
    const iv = g ? `${g[3] ?? '?'}${g[4] != null ? ` / ${Math.round(g[4] * 10) / 10}` : ''}${g[5] && g[5] !== 'yes' ? ` <span class="warn" title="客里表里程${g[5] === 'no' ? '不可信' : '待复核'}">⚠</span>` : ''}` : '';
    const sg = g && sgl.srcOf(g) != null ? `<span class="sg" title="单线区间：${sgSrcTxt(sgl.srcOf(g))}">单</span>` : '';
    const jsz = flag & 1;
    const nm = STBY[name] ? `<a data-st="${name}"${jsz ? ' class="jsz" title="接算站"' : ''}>${dn(name)}</a>` : jsz ? `<u class="jsz" title="接算站">${dn(name)}</u>` : dn(name);
    const post = flag & 2 ? '<span class="kb-Post" title="线路所">*</span>' : '';
    const cd = code ? ` <span class="note" title="车站电报略号 ${code}">-${code}</span>` : '';
    const ele = showLnEle && STBY[name] && STBY[name].ele != null ? `<span class="note" style="margin-left:4px" title="车站海拔 ${STBY[name].ele} m">${STBY[name].ele}m</span>` : '';
    return `${head}<tr${selSt && selSt.name === name ? ' class="cur"' : ''}><td>${kbLimHtml(lim)}</td><td class="main">${nm}${post}${cd}${ele}</td><td class="note">${ju || ''}</td><td class="num">${km != null ? Math.round(km * 10) / 10 : ''}</td><td class="num">${iv}${sg}</td></tr>`;
  }).join('');
  const pn = $('panel');
  pn.style.display = 'flex';
  const backHtml = lineBackTr ? `<div style="margin-bottom:2px"><a class="back note" data-back="tr">← 返回 ${lineBackTr.c}</a></div>`
    : selSt ? `<div style="margin-bottom:2px"><a class="back note" data-back="1">← 返回 ${dn(selSt.name)}</a></div>` : '';
  const dgTr = lineBackTr ? '&' + lineBackTr.c.split('/')[0] + (lineBackTr.od ? '&od=' + lineBackTr.od : '') : '';
  const dgDt = typeof curDate !== 'undefined' && curDate && (!DATES || curDate !== DATES.default) ? '&date=' + curDate : '';
  pn.innerHTML = `<span class="x" id="close">✕</span>${backHtml}
    <h3>${ln.n} <span class="note">${ln.p ? `· ${ln.p} · ` : '· '}全长 ${ln.len ?? '?'} km</span> <span style="margin-left:auto;display:inline-flex;align-items:center;gap:6px"><a class="cam${showLnEle ? ' on' : ''}" data-line-ele="1" title="${showLnEle ? '隐藏车站海拔' : '显示车站海拔'}" style="width:auto;padding:0 5px;font-size:11px">海拔</a><a class="note" target="_blank" href="diagram.html#${encodeURIComponent(ln.n)}${dgTr}${dgDt}">运行图 ↗</a></span></h3>
    ${sgl.txt ? `<div class="note" style="margin-bottom:2px"><span class="sg" style="margin-left:0" title="单线来源：${sgSrcTxt([...new Set((ln.ss || []).flatMap(x => x[2].split(',')))].join(','))}">单</span> ${sgl.txt}</div>` : ''}
    ${ln.osm.length ? `<div class="note" style="margin-bottom:2px">OSM：${ln.osm.join('、')}</div>` : ''}
    <div class="tw"><table><thead><tr><th>限</th><th>站名</th><th>局</th><th class="num" title="距本线起始站里程 (km)">自首站</th><th class="num" title="相邻两站间：客里表里程 / OSM路径公里">区间</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="foot"><span><u class="jsz">红下划线</u>接算站 · <b>*</b>线路所 · <span class="warn">⚠</span>未采信 · <span class="sg" style="margin-left:0">单</span>单线区间</span><span class="more" title="符号与标记规则同火车Wiki客里表（×不办行包 ◎不办包裹 ※仅乘降 △不办客运 G高铁快运 Y银通卡 E铁路e卡通）；区间列格式为“客里表里程 / OSM路径公里”，⚠ 表示客里表与 OSM 路径长度不符、未采信的区间。数据：火车wiki">详情...</span></div>`;
  const curRow = pn.querySelector('tr.cur'), tw = pn.querySelector('.tw');
  if (curRow && tw) {
    const hh = tw.querySelector('thead').offsetHeight, wr = tw.getBoundingClientRect(), rr = curRow.getBoundingClientRect();
    tw.scrollTop = rr.top - wr.top - hh - (tw.clientHeight - hh - rr.height) / 2;
  }
  $('close').onclick = () => { setLine(null); lineBackTr = null; if (!selSt) $('panel').style.display = 'none'; draw(); };
}
// 车次面板里的线路名（OSM 线名）→ 客里表线路：OSM 线名对得上的线路里，取含当前区间两端车站最多的；对不上返回 null
let lineBackTr = null;               // 从车次面板点进线路时记下该车，线路面板显示“← 车次”可返回
const kbLineCache = new Map();
function kbLineFor(name, tr, st) {
  if (!KB || !name || !st) return null;
  if (st.lid && KB.lines[st.lid]) return String(st.lid);
  const li = st.li ?? st.i, a = tr.s[li] && tr.s[li][0], b = tr.s[li + 1] && tr.s[li + 1][0];
  const key = name + '|' + tr.c + '|' + runOd(tr) + '|' + a + '|' + b;
  if (kbLineCache.has(key)) return kbLineCache.get(key);
  const trSt = tr._stSet || (tr._stSet = new Set(tr.s.map(x => x[0])));
  let best = null, bs = -1;
  for (const [lid, ln] of Object.entries(KB.lines)) {
    const k = ln.osm.indexOf(name); if (k < 0) continue;
    const names = ln._stSet || (ln._stSet = new Set(ln.st.map(x => x[0])));
    const endHits = (names.has(a) ? 1 : 0) + (names.has(b) ? 1 : 0);
    let trHits = 0; for (const s of trSt) if (names.has(s)) trHits++;
    const exact = ln.n === name ? 2 : (name.length > 1 && ln.n.startsWith(name.slice(0, -1)) ? 1 : 0);
    if (endHits === 0 && trHits < 2 && exact < 2) continue;
    const effEnd = (trHits <= 1 && k > 0 && !exact) ? 0 : endHits;
    const sc = effEnd * 100 + Math.min(trHits, 5) * 10 + exact * 15 + (k === 0 ? 5 : 0) + Math.min(4, (ln.len || 0) / 1000);
    if (sc > bs) { bs = sc; best = lid; }
  }
  kbLineCache.set(key, best); return best;
}
// 面板里的线路名、站名、返回链接、跟随按钮、客里表折叠条、海拔开关：用 pointerdown 委托（播放时面板每帧重绘，click 可能落空）
let kbSubOpen = true, showTrEle = false, showLnEle = false;
try {
  kbSubOpen = localStorage.getItem('railmap.kbSub') !== '0';
  showTrEle = localStorage.getItem('railmap.showTrEle') === '1';
  showLnEle = localStorage.getItem('railmap.showLnEle') === '1';
} catch (e) {}
const CHEV_R_SVG = '<svg class="chev" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4.5 2.5L8 6L4.5 9.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function inMapView(ll) {
  if (!ll || !map.getBounds().contains(ll)) return false;
  const s = map.getSize(), p = map.latLngToContainerPoint(ll), pad = 16;
  if (p.x < pad || p.y < pad || p.x > s.x - pad || p.y > s.y - pad) return false;
  const pn = isSheet() ? $('drawer') : $('panel');
  if (pn && pn.style.display !== 'none' && pn.offsetHeight) {
    const mr = map.getContainer().getBoundingClientRect(), pr = pn.getBoundingClientRect();
    if (isSheet() || mr.left + s.x / 2 < pr.left - 8) {   // 面板没挡住地图中央（桌面右侧浮层 / 手机底部抽屉）时，被面板盖住的点算不在视野内
      const px = p.x + mr.left, py = p.y + mr.top;
      if (px >= pr.left && px <= pr.right && py >= pr.top - pad && py <= pr.bottom) return false;
    }
  }
  return true;
}
function stopLatLng(tr, i, wi) {
  if (!tr) return null;
  if (wi != null) {
    const leg = tr.l[i], ws = leg && leg[5] && leg[5].filter(w => w[2] > w[1] + 0.05), w = ws && ws[wi];
    if (leg && w) {
      const sp = stopPose(w[3], null, null, leg, w[0] * leg[3], w[1]);
      if (sp && sp.pos) return sp.pos;
    }
    const nm = w && w[3], o = nm && (STBY[nm] || (AUXBY && AUXBY[nm]));
    return o ? [o.lat, o.lon] : null;
  }
  const s = tr.s[i]; if (!s) return null;
  const sp = stopPose(s[0], tr.l[i - 1], tr.l[i], null, 0, s[1] ?? s[2]);
  if (sp && sp.pos) return sp.pos;
  const o = STBY[s[0]] || (AUXBY && AUXBY[s[0]]);
  return o ? [o.lat, o.lon] : null;
}
// 把 ll 放到地图露出部分的中央（手机底部抽屉挡住的部分不算）；soon：抽屉还没打开但马上要开
function viewAt(ll, z, opt, soon = false) {
  let occ = sheetOcc();
  if (!occ && soon && isSheet()) occ = sheetEst();
  if (!occ) { map.setView(ll, z, opt); return; }
  map.setView(map.unproject(map.project(ll, z).add([0, occ / 2]), z), z, opt);
}
function panToPos(ll) {
  if (!ll) return false;
  if (follow && sel) {
    if (map.getZoom() < 10) { viewAt(ll, 10, { animate: false }); return true; }
    return false;
  }
  if (!inMapView(ll) || map.getZoom() < 10) {
    follow = false;
    viewAt(ll, Math.max(map.getZoom(), 10));
    return true;
  }
  return false;
}
function handlePanelTap(target, e) {
  const stopRow = sel && target.closest('tr[data-stop]');
  if (stopRow) {
    if (target.closest('.sg')) return;
    e.preventDefault();
    const i = +stopRow.dataset.stop, wi = stopRow.dataset.wait != null ? +stopRow.dataset.wait : null;
    const tEl = target.closest('[data-t]');
    let v = tEl ? +tEl.dataset.t : null;
    if (v == null) {
      if (wi != null) {
        const ws = ((sel.l[i] && sel.l[i][5]) || []).filter(w => w[2] > w[1] + 0.05);
        v = ws[wi] ? (ws[wi][1] ?? ws[wi][2]) : null;
      } else {
        const x = sel.s[i];
        v = x ? (i > 0 && x[1] != null ? x[1] : x[2]) : null;
      }
    }
    const ll = stopLatLng(sel, i, wi);
    if (v != null && okNum(v)) jumpT(v, ll);
    else if (ll) { panToPos(ll); draw(); }
    return;
  }
  const a = target.closest('a[data-line], a[data-st], a[data-pan], a[data-back], a[data-run], a[data-follow], a[data-dim], [data-kb-toggle], [data-tr-ele], [data-line-ele], [data-t]'); if (!a) return;
  e.preventDefault();
  if (a.dataset.t != null) { jumpT(+a.dataset.t, selSt ? [selSt.lat, selSt.lon] : null); return; }
  if (a.dataset.kbToggle) { kbSubOpen = !kbSubOpen; try { localStorage.setItem('railmap.kbSub', kbSubOpen ? '1' : '0'); } catch (err) {} stationPanel(); return; }
  if (a.dataset.trEle) { showTrEle = !showTrEle; try { localStorage.setItem('railmap.showTrEle', showTrEle ? '1' : '0'); } catch (err) {} trPanelId = ''; panel(); return; }
  if (a.dataset.lineEle) { showLnEle = !showLnEle; try { localStorage.setItem('railmap.showLnEle', showLnEle ? '1' : '0'); } catch (err) {} linePanelKey = null; linePanel(); return; }
  if (a.dataset.dim) { setDim(!dimOthers); try { localStorage.setItem(DIM_KEY, dimOthers ? '1' : '0'); } catch (err) {} return; }
  if (a.dataset.follow) { follow = !follow && !!sel; followTr = follow ? sel : null; draw(); return; }
  if (a.dataset.pan) { panToStation(a.dataset.pan); return; }
  if (a.dataset.run) {                // 换到同车次另一始发日的列车；跟随中就接着跟
    const r = panelRuns[+a.dataset.run]; if (!r || r === sel) return;
    sel = r; if (follow) followTr = r;
    const st = state(r, T);
    if (st && !follow && !map.getBounds().contains(st.pos)) map.setView(st.pos, Math.max(map.getZoom(), 8));
  }
  else if (a.dataset.line) { lineBackTr = sel || null; sel = null; setLine(a.dataset.line); const hl = lineHighlight(selLine);
    if (hl) map.fitBounds([[hl.bbox[1], hl.bbox[0]], [hl.bbox[3], hl.bbox[2]]], fitPad(30)); }
  else if (a.dataset.st) { const st = STBY[a.dataset.st]; sel = null; selSt = st; setLine(null);
    if (!inMapView([st.lat, st.lon]) || map.getZoom() < 10) viewAt([st.lat, st.lon], Math.max(map.getZoom(), 10)); }
  else if (a.dataset.back === 'tr') { sel = lineBackTr; lineBackTr = null; setLine(null); }   // 返回原来的车次
  else setLine(null);
  draw();
}
let panelTouch = null;
$('panel').addEventListener('pointerdown', e => {
  if (e.button) return;
  if (e.pointerType === 'touch') {
    const tw = $('panel').querySelector('.tw');
    panelTouch = { x: e.clientX, y: e.clientY, st: tw ? tw.scrollTop : 0, target: e.target };
    return;
  }
  handlePanelTap(e.target, e);
});
$('panel').addEventListener('pointerup', e => {
  if (e.pointerType !== 'touch' || !panelTouch) return;
  const pt = panelTouch; panelTouch = null;
  const tw = $('panel').querySelector('.tw');
  if (Math.hypot(e.clientX - pt.x, e.clientY - pt.y) > 8 || (tw && Math.abs(tw.scrollTop - pt.st) > 4)) return;
  handlePanelTap(pt.target, e);
});
// 地图移到某站（不在视野内或缩放 < z10 时移过去并放大到至少 z10）
function panToStation(name) {
  const st = STBY[name] || (AUXBY && AUXBY[name]); if (!st) return;
  panToPos([st.lat, st.lon]);
  draw();
}
let ST = [];                         // 车站：{name, lat, lon, n, code, ev: [{tr, a, d}]}
