// diagram.html · 网址锚点：线路查找、读写锚点
// 经典脚本（非 module），与其它 diagram/*.js 共享全局作用域，加载顺序见 diagram.html
'use strict';
// ===== 网址锚点 =====
function findLineId(v, allowNumericId = true) {
  if (!KB || !v) return null;
  try { v = decodeURIComponent(String(v)).trim(); } catch (e) { v = String(v).trim(); }
  if (allowNumericId && KB.lines[v]) return v;
  for (const [id, ln] of Object.entries(KB.lines)) {
    if (ln.n === v) return id;
  }
  const vNorm = v.replace(/线$/, '');
  for (const [id, ln] of Object.entries(KB.lines)) {
    if (ln.n.replace(/线$/, '') === vNorm || ln.n === v + '线' || ln.n + '线' === v) return id;
  }
  const ALIAS = {
    '京沪高铁': '京沪高速线',
    '京广高铁': '京广高铁',
    '京包客专': '京包客专线',
    '石太客专': '石太客专线',
    '兰新客专': '兰新客专线',
    '成渝高铁': '成渝客专',
  };
  if (ALIAS[v]) {
    for (const [id, ln] of Object.entries(KB.lines)) {
      if (ln.n === ALIAS[v]) return id;
    }
  }
  if (vNorm.length >= 2) {
    for (const [id, ln] of Object.entries(KB.lines)) {
      if (ln.n.includes(vNorm)) return id;
    }
  }
  return null;
}

function readHash() {
  const h = {};
  let raw = '';
  try { raw = decodeURIComponent(location.hash.slice(1)); } catch (e) { raw = location.hash.slice(1); }
  if (!raw) return h;
  const pairs = raw.split('&');
  for (const kv of pairs) {
    if (!kv) continue;
    const i = kv.indexOf('=');
    if (i < 0) {
      const token = kv.trim();
      const lid = findLineId(token, false);
      if (lid) h.line = lid;
      else if (!h.train) h.train = token;
      continue;
    }
    const k = kv.slice(0, i).trim(), v = kv.slice(i + 1).trim();
    if (k === 'train' || k === 'tr' || k === 'c') h.train = v;
    else if (k === 'line' || k === 'ln') h.line = findLineId(v, true) || v;
    else if (k === 'date' || k === 'd') h.date = v;
    else if (k === 'time' || k === 't') {
      if (v.includes(':')) {
        const [hh, mm] = v.split(':').map(Number);
        if (!isNaN(hh) && !isNaN(mm)) h.time = Math.max(0, Math.min(1440, hh * 60 + mm));
      } else {
        const num = Number(v);
        if (!isNaN(num) && num >= 0 && num <= 1440) h.time = num;
      }
    } else h[k] = v;
  }
  return h;
}
function writeHash() {
  const parts = [];
  if (lineId && KB && KB.lines[lineId]) parts.push(KB.lines[lineId].n);
  if (sel) {
    parts.push(sel.tr.c.split('/')[0]);
    if (sel.tr.od) parts.push('od=' + sel.tr.od);
  }
  if (zx) parts.push('zx=' + zx);
  if ($('dir').value) parts.push('dir=' + $('dir').value);
  const isDefaultDate = !curDate || (DATES && curDate === DATES.default);
  if (curDate && !isDefaultDate) parts.push('date=' + curDate);
  const h = parts.join('&');
  if (h !== location.hash.slice(1)) history.replaceState(null, '', '#' + h);
}
const findTrain = (code, od) => !code ? null : (od
  ? TR.find(o => o.tr.c.split('/').includes(code) && o.tr.od === od)
  : TR.find(o => o.tr.c.split('/').includes(code) && !o.tr.od))
  || TR.find(o => o.tr.c.split('/').includes(code)) || null;
