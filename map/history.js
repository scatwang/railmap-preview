// map.html · 选中历史（右上角恢复按钮与列表）
// 经典脚本（非 module），与其它 map/*.js 共享全局作用域，加载顺序见 map.html
// ===== 选中历史 =====
// 每次重绘比较当前选中对象（车次 / 客里表线路 / 车站）；换了就把上一个记进历史（同一对象只留最新一条，最多 12 条，存 localStorage）。
// 什么都没选中时右上角显示最近一条，点击恢复；▾ 列出全部历史
let HIST = [], histCur = null, histShown = null;
try { HIST = JSON.parse(localStorage.getItem('railmap.hist') || '[]'); } catch (e) { HIST = []; }
const histKey = h => h ? h.k + ':' + h.v + (h.od ? '@' + h.od : '') : '';
function histNow() {
  if (sel) return { k: 'train', v: sel.c.split('/')[0], od: sel.od || null, label: sel.c, sub: `${sel.s[0][0]} → ${sel.s[sel.s.length - 1][0]}${sel.od ? ' · ' + sel.od.slice(5) + ' 始发' : ''}` };
  if (selLine) return { k: 'line', v: selLine, label: (KB && KB.lines[selLine] && KB.lines[selLine].n) || selLine };
  if (selSt) {
    const kl = KBST[selSt.name] || [];
    const ju = (kl.find(r => r.ju) || {}).ju || '';
    return { k: 'station', v: selSt.name, label: dn(selSt.name), sub: ju || '' };
  }
  return null;
}
const HIST_KIND = { train: '车次', line: '线路', station: '车站' };
function trackHist() {
  const now = histNow(), key = histKey(now);
  if (key !== histKey(histCur)) {
    if (histCur) {
      HIST = [histCur, ...HIST.filter(h => histKey(h) !== histKey(histCur))].slice(0, 12);
      try { localStorage.setItem('railmap.hist', JSON.stringify(HIST)); } catch (e) {}
    }
    histCur = now;
  }
  const list = HIST.filter(h => histKey(h) !== key);
  const show = !now && list.length > 0;
  const sig = show ? histKey(list[0]) + '|' + list.length : '';
  if (sig === histShown) return;
  histShown = sig;
  $('hist').style.display = show ? 'block' : 'none';
  if (!show) { $('hist').classList.remove('open'); return; }
  const h0 = list[0];
  $('histBtn').textContent = `↺ ${HIST_KIND[h0.k]} ${h0.label}`;
  $('histBtn').title = `恢复选中：${h0.label}${h0.sub ? '（' + h0.sub + '）' : ''}`;
  $('histList').innerHTML = HIST.map((h, i) => `<li data-i="${i}" title="${h.sub || ''}"><span class="k">${HIST_KIND[h.k]}</span>${h.label}${h.sub ? ` <span class="note">${h.sub}</span>` : ''}</li>`).join('')
    + '<li class="clr" data-clr="1">清空历史</li>';
}
function restoreHist(h) {
  if (!h) return;
  $('hist').classList.remove('open');
  if (h.k === 'train') {
    const tr = findRun(h.v, h.od); if (!tr) { alert(`当前日期没有 ${h.label}`); return; }
    sel = tr; selSt = null; lineBackTr = null; setLine(null);
    const s0 = tr.s[0][2]; if (s0 != null && (T < s0 || T > tr.s[tr.s.length - 1][1])) setT(s0 + 1);
    const st = state(tr, T); if (st && !map.getBounds().contains(st.pos)) map.setView(st.pos, Math.max(map.getZoom(), 8));
  } else if (h.k === 'line') {
    if (!KB || !KB.lines[h.v]) return;
    sel = null; selSt = null; lineBackTr = null; setLine(h.v);
    const hl = lineHighlight(h.v); if (hl) map.fitBounds([[hl.bbox[1], hl.bbox[0]], [hl.bbox[3], hl.bbox[2]]], fitPad(30));
  } else if (h.k === 'station') {
    const st = STBY[h.v]; if (!st) { alert(`当前日期没有车站 ${h.label}`); return; }
    sel = null; selSt = st; setLine(null);
    if (!map.getBounds().contains([st.lat, st.lon])) map.setView([st.lat, st.lon], Math.max(map.getZoom(), 10));
  }
  draw();
}
$('histBtn').onclick = () => restoreHist(HIST.find(h => histKey(h) !== histKey(histCur)));
$('histDd').onclick = e => { e.stopPropagation(); $('hist').classList.toggle('open'); };
$('histList').onclick = e => {
  const li = e.target.closest('li'); if (!li) return;
  if (li.dataset.clr) { HIST = []; histShown = null; try { localStorage.removeItem('railmap.hist'); } catch (err) {} trackHist(); return; }
  restoreHist(HIST[+li.dataset.i]);
};
document.addEventListener('pointerdown', e => { if (!e.target.closest('#hist')) $('hist').classList.remove('open'); });
L.DomEvent.disableClickPropagation($('hist')); L.DomEvent.disableScrollPropagation($('hist'));
