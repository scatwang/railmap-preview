// map.html · 搜索：车次 / 车站 / 客里表线路联想
// 经典脚本（非 module），与其它 map/*.js 共享全局作用域，加载顺序见 map.html
// ===== 搜索：车次 / 车站 / 客里表线路，边输边联想；空输入时列出最近选过的（同右上角历史） =====
// 桌面：底栏输入框，联想列表向上弹出；手机：底栏放放大镜按钮，点开是顶部对话框
function goTrain(tr) {
  sel = tr; selSt = null; lineBackTr = null; setLine(null); const pts = [];
  for (const leg of tr.l) if (leg) { const g = G[leg[0]]; for (let j = 0; j < g.km.length; j += 5) pts.push([g.lat[j], g.lon[j]]); }
  if (pts.length) map.fitBounds(pts, fitPad(40));
  const st0 = tr.s[0][2]; if (st0 != null && (T < st0 || T > tr.s[tr.s.length - 1][1])) setT(st0 + 1); else draw();
  writeHash(true);
}
function goStation(st) {
  sel = null; selSt = st; lineBackTr = null; setLine(null);
  viewAt([st.lat, st.lon], Math.max(map.getZoom(), 11), undefined, true);
  draw(); writeHash(true);
}
function goLine(lid) {
  sel = null; selSt = null; lineBackTr = null; setLine(lid);
  const hl = lineHighlight(lid); if (hl) map.fitBounds([[hl.bbox[1], hl.bbox[0]], [hl.bbox[3], hl.bbox[2]]], fitPad(30));
  draw(); writeHash(true);
}
let qItems = [], qAct = -1;
const escH = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function qSuggest(raw) {
  raw = raw.trim();
  if (!raw) return HIST.slice(0, 10).map(h => ({ k: 'hist', h }));
  const U = raw.toUpperCase(), out = [];
  const trains = [], stations = [], lines = [];
  if (D && D.trains) {
    const seen = new Map();
    for (const t of D.trains) {
      const codes = t.c.split('/'), m = codes.find(c => c.startsWith(U)); if (!m) continue;
      if (!seen.has(m)) seen.set(m, t);
    }
    for (const [m, t] of seen) trains.push({ k: 'train', m, t });
    trains.sort((a, b) => (a.m === U ? 0 : 1) - (b.m === U ? 0 : 1) || a.m.length - b.m.length || a.m.localeCompare(b.m, 'en', { numeric: true }));
  }
  if (ST && ST.length) {
    for (const st of ST) {
      const nm = dn(st.name), p = nm.startsWith(raw) || st.name.startsWith(raw) ? 0 : nm.includes(raw) ? 1 : st.code && st.code === U ? 0 : -1;
      if (p >= 0) stations.push({ k: 'station', st, p });
    }
    stations.sort((a, b) => a.p - b.p || (b.st.n || 0) - (a.st.n || 0));
  }
  if (KB && KB.lines && /[^\x00-\x7f]/.test(raw)) {
    for (const [lid, ln] of Object.entries(KB.lines)) if (ln.n && ln.n.includes(raw)) lines.push({ k: 'line', lid, ln, p: ln.n.startsWith(raw) ? 0 : 1 });
    lines.sort((a, b) => a.p - b.p || (b.ln.len || 0) - (a.ln.len || 0));
  }
  const codeLike = /^[A-Z]{0,2}\d/.test(U) || (/^[A-Z]+$/.test(U) && !stations.length);
  const groups = codeLike ? [trains.slice(0, 10), stations.slice(0, 4), lines.slice(0, 3)] : [stations.slice(0, 6), lines.slice(0, 4), trains.slice(0, 6)];
  for (const g of groups) out.push(...g);
  return out;
}
function qRender() {
  const raw = $('q').value;
  qItems = qSuggest(raw); qAct = raw.trim() && qItems.length ? 0 : -1;
  const ul = $('qsug');
  if (!qItems.length) {
    ul.innerHTML = raw.trim() ? '<li class="hd">没有匹配的车次、车站或线路</li>' : '';
  } else {
    ul.innerHTML = (raw.trim() ? '' : '<li class="hd">最近查看</li>') + qItems.map((x, i) => {
      let k, b, sub;
      if (x.k === 'hist') { k = HIST_KIND[x.h.k]; b = x.h.label; sub = x.h.sub || ''; }
      else if (x.k === 'train') { const t = x.t, S = t.s; k = '车次'; b = x.m; sub = `${dn(S[0][0])} → ${dn(S[S.length - 1][0])} · ${fmtH(runT0(t))}–${fmtH(runT1(t))}`; }
      else if (x.k === 'station') { k = '车站'; b = dn(x.st.name); sub = `${x.st.code ? '-' + x.st.code + ' · ' : ''}停靠 ${x.st.n} 趟`; }
      else { k = '线路'; b = x.ln.n; sub = `${x.ln.p ? x.ln.p + ' · ' : ''}${x.ln.len ?? '?'} km`; }
      return `<li role="option" data-i="${i}"${i === qAct ? ' class="on"' : ''}><span class="k">${k}</span><b>${escH(b)}</b><span class="s">${escH(sub)}</span></li>`;
    }).join('');
  }
  $('qwrap').classList.toggle('sug', !!ul.innerHTML);
}
function qClose() {
  $('qwrap').classList.remove('sug'); document.body.classList.remove('qOpen');
  $('q').blur();
}
function qPick(x) {
  if (!x) return;
  $('q').value = ''; qClose();
  if (x.k === 'hist') { restoreHist(x.h); writeHash(true); }
  else if (x.k === 'train') { const tr = findRun(x.m); if (tr) goTrain(tr); }
  else if (x.k === 'station') goStation(x.st);
  else goLine(x.lid);
}
// 回车：有高亮的联想就用它，否则按原来的精确查找（车次号 / 站名）
function qSubmit() {
  if (qAct >= 0 && qItems[qAct]) { qPick(qItems[qAct]); return; }
  const raw = $('q').value.trim(); if (!raw) return;
  const tr = findRun(raw.toUpperCase());
  if (tr) { $('q').value = ''; qClose(); goTrain(tr); return; }
  const st = findStation(raw);
  if (st) { $('q').value = ''; qClose(); goStation(st); return; }
  $('q').value = ''; $('q').placeholder = '未找到'; qRender();
}
$('q').addEventListener('input', qRender);
$('q').addEventListener('focus', () => { $('q').placeholder = isSheet() ? '车次 / 站名 / 线路' : '车次/站名，如 G1'; qRender(); });
$('q').addEventListener('blur', () => { if (!isSheet()) setTimeout(() => { if (document.activeElement !== $('q')) $('qwrap').classList.remove('sug'); }, 150); });
$('q').addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!qItems.length) return;
    e.preventDefault();
    qAct = (qAct + (e.key === 'ArrowDown' ? 1 : -1) + qItems.length) % qItems.length;
    $('qsug').querySelectorAll('li[data-i]').forEach(li => li.classList.toggle('on', +li.dataset.i === qAct));
    const on = $('qsug').querySelector('li.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') { e.preventDefault(); qSubmit(); }
  else if (e.key === 'Escape') { e.preventDefault(); $('q').value = ''; qClose(); }
});
// 列表项用 pointerdown 选中（不让输入框先失焦把列表收掉）；手机上按 pointerup 判定，免得滚动列表时误选
let qTouch = null;
$('qsug').addEventListener('pointerdown', e => {
  const li = e.target.closest('li[data-i]'); if (!li) return;
  if (e.pointerType === 'touch') { qTouch = { y: e.clientY, i: +li.dataset.i }; return; }
  e.preventDefault(); qPick(qItems[+li.dataset.i]);
});
$('qsug').addEventListener('pointerup', e => {
  if (!qTouch) return; const t = qTouch; qTouch = null;
  if (Math.abs(e.clientY - t.y) < 10) { e.preventDefault(); qPick(qItems[t.i]); }
});
$('qbtn').onclick = () => { document.body.classList.add('qOpen'); document.body.classList.remove('tOpen'); $('q').focus(); qRender(); };
$('qcancel').onclick = () => { $('q').value = ''; qClose(); };
$('qwrap').addEventListener('click', e => { if (e.target === $('qwrap') && isSheet()) { $('q').value = ''; qClose(); } });   // 点对话框外的遮罩关闭
L.DomEvent.disableClickPropagation($('qwrap')); L.DomEvent.disableScrollPropagation($('qwrap'));
