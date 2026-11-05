// diagram.html · 交互：缩放平移、与地图页通信、控件、线路搜索、初始化（最后加载）
// 经典脚本（非 module），与其它 diagram/*.js 共享全局作用域，加载顺序见 diagram.html
'use strict';
// ===== 交互 =====
function resize() {
  const wrap = $('wrap'), bar = $('bar').getBoundingClientRect();
  $('main').style.top = bar.height + 'px';
  W = wrap.clientWidth; H = wrap.clientHeight;
  PAD.l = W < 520 ? 86 : 112;
  const dpr = devicePixelRatio || 1;
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  draw();
}
function resetView() {
  const pad = (kmax - kmin) * 0.02;
  view = { t0: view.t0 < -200 || view.t1 > 1700 ? 0 : 0, t1: 1440, k0: mapK(kmin) - pad, k1: mapK(kmax) + pad };
  if (W && W < 520) {                       // 手机窄屏：24 小时挤不下，只看当前时刻前后共 4 小时
    const tc = mapT && isFinite(mapT.t) ? mapT.t : 720;
    view.t0 = tc - 80; view.t1 = tc + 160;
  }
}
// 列车选中状态下弹出或切换时自动放大，使选中车次在线上的时间和里程跨度至少占画布长宽的 60%（横轴最多放大到 2 小时视野）
const FIT_RATIO = 0.6, FIT_MIN_T = 120;
function fitSel() {
  if (!sel) return;
  const [tmin, tmax, kmn, kmx] = sel.bb;
  const dt = tmax - tmin, dk = mapK(kmx) - mapK(kmn);
  const wt = Math.min(3600, Math.max(FIT_MIN_T, dt / FIT_RATIO));
  if (view.t1 - view.t0 > wt || tmin < view.t0 || tmax > view.t1) {
    const tc = (tmin + tmax) / 2;
    view.t0 = tc - wt / 2; view.t1 = tc + wt / 2;
  }
  const pad = (kmax - kmin) * 0.02, fk0 = mapK(kmin) - pad, fk1 = mapK(kmax) + pad;
  if (view.k1 - view.k0 > dk / FIT_RATIO || mapK(kmn) < view.k0 || mapK(kmx) > view.k1) {
    const wk = Math.min(fk1 - fk0, Math.max(2, dk / FIT_RATIO)), kc = (mapK(kmn) + mapK(kmx)) / 2;
    let k0 = kc - wk / 2, k1 = kc + wk / 2;
    if (k0 < fk0) { k0 = fk0; k1 = k0 + wk; }
    if (k1 > fk1) { k1 = fk1; k0 = k1 - wk; }
    view.k0 = k0; view.k1 = k1;
  }
}
cv.addEventListener('wheel', e => {
  e.preventDefault();
  const z = Math.exp(e.deltaY * 0.0015);
  if (e.shiftKey || e.ctrlKey) {
    const km = kAt(e.offsetY);
    view.k0 = km - (km - view.k0) * z; view.k1 = km + (view.k1 - km) * z;
    if (view.k1 - view.k0 < 2) { const c = (view.k0 + view.k1) / 2; view.k0 = c - 1; view.k1 = c + 1; }
  } else {
    const tm = tAt(e.offsetX);
    view.t0 = tm - (tm - view.t0) * z; view.t1 = tm + (view.t1 - tm) * z;
    if (view.t1 - view.t0 < 10) { const c = (view.t0 + view.t1) / 2; view.t0 = c - 5; view.t1 = c + 5; }
    if (view.t1 - view.t0 > 3600) { const c = (view.t0 + view.t1) / 2; view.t0 = c - 1800; view.t1 = c + 1800; }
  }
  draw();
}, { passive: false });
// 车站名可点：在地图上显示该站。嵌在地图分屏里时发消息给地图页；单独打开时在新标签页打开地图并定位到该站
let STLAB = [];
const stLabAt = (x, y) => STLAB.find(b => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) || null;
function showStation(s) {
  if (window.parent !== window) { window.parent.postMessage({ type: 'railmap-station', name: s.name, ll: s.ll }, location.origin); return; }
  window.open(`map.html#${curDate ? 'date=' + curDate + '&' : ''}station=${encodeURIComponent(s.name)}`, 'railmap-map');
}
// 侧栏时刻表停站经纬度 [lon, lat]
function stopLonLat(tr, i, wi) {
  if (!tr) return null;
  if (wi != null) {
    const leg = tr.l[i], ws = leg && leg[5] && leg[5].filter(w => w[2] > w[1] + 0.05), w = ws && ws[wi];
    if (w && w[3] && STN[w[3]]) return STN[w[3]].ll;
    const g = leg && G[leg[0]];
    if (g && g.lon.length && w) {
      const targetKm = w[0] * leg[3];
      let j = 0; while (j + 1 < g.km.length && g.km[j + 1] < targetKm) j++;
      return [g.lon[j], g.lat[j]];
    }
    return null;
  }
  const nm = tr.s[i] && tr.s[i][0];
  if (nm && STN[nm]) return STN[nm].ll;
  const s = nm && LINE && LINE.st.find(x => x.name === nm);
  if (s && s.ll) return s.ll;
  const next = tr.l[i], prev = tr.l[i - 1];
  if (next && G[next[0]] && G[next[0]].lon.length) return [G[next[0]].lon[0], G[next[0]].lat[0]];
  if (prev && G[prev[0]] && G[prev[0]].lon.length) { const g = G[prev[0]], m = g.lon.length - 1; return [g.lon[m], g.lat[m]]; }
  return null;
}
// 侧栏“地图”：在地图上高亮选中的车次。嵌在地图分屏里时发消息给地图页；单独打开时在新标签页打开地图并选中该车
function showTrainOnMap(tr) {
  const code = tr.c.split('/')[0];
  if (window.parent !== window) { window.parent.postMessage({ type: 'railmap-train', code, od: tr.od || null, line: lineId }, location.origin); return; }
  window.open(`map.html#${curDate ? 'date=' + curDate + '&' : ''}train=${encodeURIComponent(code)}${tr.od ? '&od=' + tr.od : ''}`, 'railmap-map');
}
// 地图页同步过来的当前时刻 {t: 当日分钟, date}；连续消息合并到下一帧重画。单独打开时从网址参数、本机记忆或北京时间初始化
let mapT = null, mapTRaf = 0;
function initStandaloneTime(h) {
  if (h && h.time != null) { mapT = { t: h.time, date: curDate }; return; }
  try {
    const sv = JSON.parse(localStorage.getItem('railmap.view'));
    if (sv && typeof sv.t === 'number' && isFinite(sv.t) && sv.t >= 0 && sv.t <= 1440) {
      mapT = { t: sv.t, date: sv.date || curDate };
      return;
    }
  } catch (e) {}
  const now = new Date(Date.now() + 8 * 3600e3);
  mapT = { t: now.getUTCHours() * 60 + now.getUTCMinutes(), date: curDate };
}
addEventListener('message', e => {
  if (e.origin !== location.origin || !e.data) return;
  if (e.data.type === 'railmap-fit-sel') {
    if (sel) { resetView(); fitSel(); draw(); }
    return;
  }
  if (e.data.type !== 'railmap-time') return;
  mapT = { t: e.data.t, date: e.data.date };
  if (!mapTRaf) mapTRaf = requestAnimationFrame(() => { mapTRaf = 0; draw(); });
});
if (window.parent !== window) {
  window.parent.postMessage({ type: 'railmap-time-req' }, location.origin);
} else {
  addEventListener('storage', e => {
    if (e.key !== 'railmap.view' || !e.newValue) return;
    try {
      const sv = JSON.parse(e.newValue);
      if (sv && typeof sv.t === 'number' && isFinite(sv.t)) {
        mapT = { t: sv.t, date: sv.date || curDate };
        if (!mapTRaf) mapTRaf = requestAnimationFrame(() => { mapTRaf = 0; draw(); });
      }
    } catch (err) {}
  });
}
let drag = null, moved = false;
const EMBED_NARROW = () => window.parent !== window && innerWidth <= 760;
// 触屏：双指捏合缩放（横向张开缩放时间、纵向张开缩放里程，双指中点跟手平移），双击（双点）复位
const ptrs = new Map();
let pinch = null, lastTap = null;
const isTouchEv = e => e.pointerType === 'touch' || e.pointerType === 'pen';
function pinchStart() {
  const [a, b] = [...ptrs.values()];
  pinch = { ax: Math.abs(a.x - b.x), ay: Math.abs(a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, v: { ...view } };
  pinch.tm = pinch.v.t0 + (pinch.mx - PAD.l) / (W - PAD.l - PAD.r) * (pinch.v.t1 - pinch.v.t0);
  pinch.km = pinch.v.k0 + (pinch.my - PAD.t) / (H - PAD.t - PAD.b) * (pinch.v.k1 - pinch.v.k0);
  drag = null; moved = true; tip.style.display = 'none';
}
function pinchMove() {
  const [a, b] = [...ptrs.values()], v = pinch.v;
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  // 两指在该方向上分开不到 40px 时不缩放这个方向（只平移），免得斜着捏时另一轴乱跳
  const zt = pinch.ax > 40 ? pinch.ax / Math.max(20, Math.abs(a.x - b.x)) : 1;
  const zk = pinch.ay > 40 ? pinch.ay / Math.max(20, Math.abs(a.y - b.y)) : 1;
  let wt = (v.t1 - v.t0) * zt, wk = (v.k1 - v.k0) * zk;
  wt = Math.min(3600, Math.max(10, wt)); wk = Math.max(2, wk);
  const ft = (mx - PAD.l) / (W - PAD.l - PAD.r), fk = (my - PAD.t) / (H - PAD.t - PAD.b);
  view = { t0: pinch.tm - ft * wt, t1: pinch.tm - ft * wt + wt, k0: pinch.km - fk * wk, k1: pinch.km - fk * wk + wk };
  draw();
}
cv.addEventListener('pointerdown', e => {
  ptrs.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
  cv.setPointerCapture(e.pointerId);
  if (ptrs.size === 2) { pinchStart(); return; }
  if (ptrs.size > 2) return;
  drag = { x: e.offsetX, y: e.offsetY, v: { ...view }, touch: isTouchEv(e) }; moved = false;
});
const ptrEnd = e => {
  ptrs.delete(e.pointerId);
  if (pinch) {
    if (ptrs.size < 2) pinch = null;
    if (ptrs.size === 1) {                    // 抬起一指：剩下那根手指接着拖动平移
      const [p] = [...ptrs.values()]; drag = { x: p.x, y: p.y, v: { ...view }, touch: true }; moved = true;
    }
    return true;
  }
  return false;
};
cv.addEventListener('pointercancel', e => { ptrEnd(e); drag = null; cv.classList.remove('drag'); });
cv.addEventListener('pointerup', e => {
  cv.classList.remove('drag');
  if (ptrEnd(e)) return;
  if (drag && !moved && drag.touch) {        // 双点复位
    const now = performance.now();
    if (lastTap && now - lastTap.t < 320 && Math.hypot(e.offsetX - lastTap.x, e.offsetY - lastTap.y) < 30) {
      lastTap = null; drag = null; resetView(); draw(); return;
    }
    lastTap = { t: now, x: e.offsetX, y: e.offsetY };
  }
  if (drag && !moved && stLabAt(e.offsetX, e.offsetY)) { showStation(stLabAt(e.offsetX, e.offsetY).s); drag = null; return; }
  if (drag && !moved) {
    const n = nearest(e.offsetX, e.offsetY, drag.touch ? 16 : 6);
    sel = n ? n.o : null; wantSel = sel ? [sel.tr.c.split('/')[0], sel.tr.od] : null; writeHash(); sidePanel(); draw();
    if (sel && EMBED_NARROW()) showTrainOnMap(sel.tr);   // 手机分屏不显示侧栏：点中的车直接在地图上选中，时刻表看抽屉的「时刻表」页
  }
  drag = null;
});
cv.addEventListener('pointermove', e => {
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
  if (pinch) { if (ptrs.size >= 2) pinchMove(); return; }
  if (drag) {
    const dx = e.offsetX - drag.x, dy = e.offsetY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > (drag.touch ? 8 : 3)) { moved = true; cv.classList.add('drag'); }
    if (moved) {
      const dt = dx / (W - PAD.l - PAD.r) * (drag.v.t1 - drag.v.t0), dk = dy / (H - PAD.t - PAD.b) * (drag.v.k1 - drag.v.k0);
      view = { t0: drag.v.t0 - dt, t1: drag.v.t1 - dt, k0: drag.v.k0 - dk, k1: drag.v.k1 - dk };
      tip.style.display = 'none'; draw();
    }
    return;
  }
  if (isTouchEv(e)) return;                   // 触屏没有悬停
  if (!LINE) return;
  const lab = stLabAt(e.offsetX, e.offsetY);
  cv.style.cursor = lab ? 'pointer' : '';
  if (lab) {
    if (hover) { hover = null; draw(); }
    tip.innerHTML = `<b>${lab.s.name}</b> <span class="note">K${kmTxt(lab.s.km)} · 点击在地图上显示</span>`; tip.style.display = 'block';
    tip.style.left = (e.clientX + 14) + 'px'; tip.style.top = (e.clientY + 14) + 'px';
    return;
  }
  const n = nearest(e.offsetX, e.offsetY);
  const h = n ? n.o : null;
  if (h !== hover) { hover = h; draw(); }
  if (n) {
    const tr = n.o.tr, w = n.o.waits.find(w => w[0] <= n.t && n.t <= w[1] && Math.abs(w[2] - n.k) < 0.5);
    const spdTxt = !w && n.kmh > 1 ? ` · <span class="note">${Math.round(n.kmh / 5) * 5} km/h</span>` : '';
    tip.innerHTML = `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--c${n.o.cls});margin-right:4px"></span><b>${tr.c}</b>${spdTxt}<div class="note">${tr.s[0][0]} → ${tr.s[tr.s.length - 1][0]}</div>`
      + (w ? `<div class="note"><i>${w[3]} ${w[4] && w[4].startsWith('技术停车') ? w[4] : w[4] + '（推定）'}</i>${w[5] ? `：${w[5]}` : ''}</div>` : '');
    tip.style.display = 'block';
    const tx = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 6);
    tip.style.left = tx + 'px'; tip.style.top = (e.clientY + 14) + 'px';
  } else tip.style.display = 'none';
});
cv.addEventListener('pointerleave', () => { tip.style.display = 'none'; if (hover) { hover = null; draw(); } });
cv.addEventListener('dblclick', () => { resetView(); draw(); });
addEventListener('resize', resize);
$('showPost').onchange = draw;
$('dir').onchange = () => { if (sel && !dirOk(sel)) sel = null; writeHash(); sidePanel(); draw(); };
$('showWait').onchange = () => { sampleTrains(); sel = wantSel ? findTrain(wantSel[0], wantSel[1]) : null; draw(); };
$('fitbtn').onclick = () => { resetView(); draw(); };
$('zx').onchange = e => { e.target.blur(); zx = +e.target.value; selectLine(lineId, true); };
// 线路搜索联想（代替原生 datalist，手机和桌面都能直接点选）
{
  const esc = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  let lqItems = [], lqAct = -1, lqTouch = null;
  const lqSuggest = raw => {
    const q = raw.trim();
    const list = !q ? LINE_OPTS.slice().sort((a, b) => b.len - a.len)
      : LINE_OPTS.filter(o => o.label.includes(q) || o.id === q)
          .sort((a, b) => (a.label.startsWith(q) ? 0 : 1) - (b.label.startsWith(q) ? 0 : 1) || b.len - a.len);
    return list.slice(0, 30);
  };
  const lqRender = () => {
    const raw = $('lineq').value;
    lqItems = lqSuggest(raw);
    lqAct = raw.trim() && lqItems.length ? 0 : -1;
    const ul = $('lqsug');
    if (!lqItems.length) ul.innerHTML = '<li class="hd">没有匹配的线路</li>';
    else ul.innerHTML = (raw.trim() ? '' : '<li class="hd">按里程排序（输入线名筛选）</li>')
      + lqItems.map((o, i) => `<li role="option" data-i="${i}"${i === lqAct ? ' class="on"' : ''}><b>${esc(o.label)}</b><span class="s">${o.p ? esc(o.p) + ' · ' : ''}${o.len || '?'} km</span></li>`).join('');
    $('lqwrap').classList.add('open');
  };
  const lqClose = (restore = true) => {
    $('lqwrap').classList.remove('open');
    if (restore && !$('lineq').value.trim() && LINE) $('lineq').value = lineLabel(lineId);
  };
  const lqPick = id => {
    if (!id) return;
    $('lqwrap').classList.remove('open'); $('lineq').blur();
    zx = 0; selectLine(id, true);
  };
  $('lineq').addEventListener('focus', () => { $('lineq').select(); lqRender(); });
  $('lineq').addEventListener('input', lqRender);
  $('lineq').addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== $('lineq')) lqClose(true); }, 150));
  $('lineq').addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!lqItems.length) return;
      e.preventDefault();
      lqAct = (lqAct + (e.key === 'ArrowDown' ? 1 : -1) + lqItems.length) % lqItems.length;
      $('lqsug').querySelectorAll('li[data-i]').forEach(li => li.classList.toggle('on', +li.dataset.i === lqAct));
      const on = $('lqsug').querySelector('li.on'); if (on) on.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const v = $('lineq').value.trim(), exact = LINE_BY_LABEL[v] || (KB.lines[v] ? v : null) || findLineId(v, false);
      if (lqAct >= 0 && lqItems[lqAct]) lqPick(lqItems[lqAct].id);
      else if (exact) lqPick(exact);
      else lqClose(true);
    } else if (e.key === 'Escape') { e.preventDefault(); $('lineq').blur(); lqClose(true); }
  });
  $('lqclr').addEventListener('pointerdown', e => {
    e.preventDefault(); $('lineq').value = ''; $('lineq').focus(); lqRender();
  });
  $('lqsug').addEventListener('pointerdown', e => {
    const li = e.target.closest('li[data-i]'); if (!li) return;
    if (e.pointerType === 'touch') { lqTouch = { y: e.clientY, i: +li.dataset.i }; return; }
    e.preventDefault(); lqPick(lqItems[+li.dataset.i].id);
  });
  $('lqsug').addEventListener('pointerup', e => {
    if (!lqTouch) return; const t = lqTouch; lqTouch = null;
    if (Math.abs(e.clientY - t.y) < 10) { e.preventDefault(); lqPick(lqItems[t.i].id); }
  });
}
const defaultDate = () => {
  if (!DATES) return null;
  const ss = selectable();
  if (!ss.length) return null;
  const today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  return (ss.find(x => x.date === DATES.default) || ss.find(x => x.date === today) || ss[ss.length - 1]).date;
};
$('date').onchange = e => {
  e.target.blur();
  if (window.parent !== window) window.parent.postMessage({ type: 'railmap-date', date: e.target.value }, location.origin);
  switchDate(e.target.value);
};
const stepDate = k => { const ss = selectable(), i = ss.findIndex(x => x.date === curDate), j = i + k;
  if (i >= 0 && j >= 0 && j < ss.length) {
    if (window.parent !== window) window.parent.postMessage({ type: 'railmap-date', date: ss[j].date }, location.origin);
    switchDate(ss[j].date);
  }
};
$('dprev').onclick = () => stepDate(-1);
$('dnext').onclick = () => stepDate(1);
document.addEventListener('click', e => {
  const el = e.target.closest('button, a, input[type=checkbox]');
  if (el) el.blur();
});
// 嵌在地图分屏里时，把空格、方向键与 N（切到现在）转给地图页控制播放/快进快退/倍速
document.addEventListener('keydown', e => {
  if (window.parent === window || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest('input:not([type=checkbox]), select, textarea, [contenteditable]')) return;
  if (e.code === 'Space' || e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'KeyN') {
    e.preventDefault(); e.stopPropagation();
    window.parent.postMessage({ type: 'railmap-key', code: e.code, repeat: e.repeat }, location.origin);
  }
}, true);
let wantSel = null;
addEventListener('hashchange', () => {
  if (!D || !KB) return;
  const h = readHash();
  if (h.time != null) mapT = { t: h.time, date: h.date || curDate };
  const dv = h.dir === 'up' || h.dir === 'down' ? h.dir : '';
  if (dv !== $('dir').value) $('dir').value = dv;
  const targetDate = (h.date && dateEntry(h.date) && dateEntry(h.date).selectable ? h.date : null) || defaultDate();
  if (targetDate && targetDate !== curDate) { switchDate(targetDate, h); return; }
  const lid = findLineId(h.line);
  if (lid && (lid !== lineId || +(h.zx || 0) !== zx) && KB && KB.lines[lid]) {
    zx = +(h.zx || 0);
    selectLine(lid, true, [h.train, h.od]);
    return;
  }
  const prevSel = sel;
  wantSel = h.train ? [h.train, h.od] : null;
  sel = findTrain(h.train, h.od);
  if (sel && !dirOk(sel)) $('dir').value = '';
  if (sel && sel !== prevSel) { resetView(); fitSel(); }
  writeHash(); sidePanel(); draw();
});

function selectLine(id, reset, wantTrain) {
  if (wantTrain !== undefined) wantSel = wantTrain && wantTrain[0] ? wantTrain : null;
  const [selCode, selOd] = wantSel || [sel ? sel.tr.c.split('/')[0] : null, sel ? sel.tr.od : null];
  lineId = id;
  $('lineq').value = id ? lineLabel(id) : '';
  buildLine();
  sampleTrains();
  sel = findTrain(selCode, selOd);
  if (sel && !dirOk(sel)) $('dir').value = '';
  if (reset) { resetView(); fitSel(); }
  writeHash(); sidePanel(); draw();
}
async function switchDate(date, h) {
  const e = dateEntry(date);
  if (DATES && (!e || !e.selectable)) { renderDates(); return; }
  const ok = await loadDate(date);
  if (!ok) return;
  const curH = h || readHash();
  const targetLine = findLineId(curH && curH.line);
  const newLine = Boolean(targetLine && KB.lines[targetLine] && (targetLine !== lineId || !LINE));
  if (targetLine && KB.lines[targetLine]) { zx = +(curH.zx || 0); lineId = targetLine; }
  selectLine(lineId, newLine, curH && curH.train ? [curH.train, curH.od] : undefined);
}

(async function init() {
  $('legend').innerHTML = CLASSES.map(([k, n]) => `<span class="note"><i style="background:var(--c${k})"></i>${n}</span>`).join('');
  resize();
  try { const r = await fetch('map_dates.json', { cache: 'no-cache' }); if (r.ok) DATES = await r.json(); } catch (e) {}
  if (DATES && !selectable().length) DATES = null;
  if (!DATES) { $('date').style.display = $('dprev').style.display = $('dnext').style.display = 'none'; }
  if (DATES && DATES.geo) preloadGeo(DATES.geo);
  const kbrPromise = fetch((DATES && DATES.kelibiao) || 'map_kelibiao.json').then(r => r.json());
  let h = readHash();
  if (h.dir === 'up' || h.dir === 'down') $('dir').value = h.dir;
  let date = (h.date && dateEntry(h.date) && dateEntry(h.date).selectable ? h.date : null) || defaultDate();
  const [, ok] = await Promise.all([
    kbrPromise.then(kb => { KB = kb; renderLineList(); }),
    loadDate(date),
  ]);
  if (!ok) return;
  h = readHash();
  const latestDate = (h.date && dateEntry(h.date) && dateEntry(h.date).selectable ? h.date : null) || defaultDate();
  if (latestDate && latestDate !== curDate && !(await loadDate(latestDate))) return;
  if (window.parent !== window) window.parent.postMessage({ type: 'railmap-time-req' }, location.origin);
  else initStandaloneTime(h);
  zx = +(h.zx || 0);
  const lid = findLineId(h.line);
  if (lid) {
    selectLine(lid, true, [h.train, h.od]);
  } else { sidePanel(); draw(); $('lineq').focus(); }
  resize();
})();
