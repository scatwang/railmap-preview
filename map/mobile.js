// map.html · 手机 / 触屏界面：底栏、图例、底部抽屉、时间弹层、抽屉遮挡计算
// 经典脚本（非 module），与其它 map/*.js 共享全局作用域，加载顺序见 map.html
// ===== 手机 / 触屏界面 =====
// 底栏高度写进 --barH（手机上底栏两行，且要让出 iPhone 底部手势条的安全区），地图、分屏、抽屉、图例都按它摆
const barH = () => $('bar').offsetHeight || 56;
{
  let lastH = 0;
  const syncBarH = () => {
    const h = barH(); if (h === lastH) return; lastH = h;
    document.documentElement.style.setProperty('--barH', h + 'px');
    requestAnimationFrame(() => map.invalidateSize({ animate: false }));   // 下一帧：首次调用时后面的状态变量还没初始化
  };
  syncBarH();
  if (window.ResizeObserver) new ResizeObserver(syncBarH).observe($('bar'));
  else addEventListener('resize', syncBarH);
}
// 图例：手机上默认收起成左下角按钮，点按钮或图例本身开合
$('legbtn').onclick = () => document.body.classList.toggle('legOpen');
$('legend').addEventListener('click', e => { if (isSheet() && !e.target.closest('button')) document.body.classList.remove('legOpen'); });
// 手机端版权声明：放在日期/时间控制弹层底部（#tattr）
$('tattr').innerHTML = `${BASE_TILES.attr} · 时刻 <a href="https://www.12306.cn" target="_blank" rel="noopener">12306</a> · 里程 <a href="https://kelibiao.com/" target="_blank" rel="noopener">火车wiki</a> · 列车位置为推断结果，非官方信息`;
// 底部抽屉（手机）：「时刻表 | 运行图」两页同一时间只显示一页，点标签或左右滑切换；运行图页 = 分屏开（splitOn）
// 面板开合状态挂到 body.panelOpen；第一页标签按面板内容改名（车次时刻表 / 车站到发 / 客里表）
let drawerWasOpen = false;
function syncDrawer() {
  const pn = $('panel'), open = !!pn.style.display && pn.style.display !== 'none';
  document.body.classList.toggle('panelOpen', open);
  const shown = open || document.body.classList.contains('split');
  if (shown && !drawerWasOpen) $('drawer').style.height = '';   // 每次弹出都回到固定初始高度，拽大只在本次打开内有效
  drawerWasOpen = shown;
  const t1 = $('dtab1'), t2 = $('dtab2'), dg = document.body.classList.contains('split');
  let lab = '详情';
  try {
    if (sel) lab = `${sel.c.split('/')[0]} · 时刻表`;
    else if (selSt) lab = `${dn(selSt.name)} · 车站`;
    else if (selLine && KB && KB.lines[selLine]) lab = `${KB.lines[selLine].n} · 客里表`;
    else if (selLine) lab = '客里表';
  } catch (e) {}                                          // 初始化早期变量还没声明
  if (t1.textContent !== lab) t1.textContent = lab;
  t1.disabled = !open;
  t1.classList.toggle('on', open && !dg); t2.classList.toggle('on', dg);
}
new MutationObserver(syncDrawer).observe($('panel'), { attributes: true, attributeFilter: ['style'], childList: true });
$('dtab1').onclick = () => { if (splitOn) setSplit(false); };
$('dtab2').onclick = () => { if (!splitOn) setSplit(true); };
$('dclose').onclick = () => {
  sel = null; selSt = null; lineBackTr = null; setLine(null);
  $('panel').style.display = 'none';
  if (splitOn) setSplit(false); else { syncDrawer(); draw(); }
};
{
  // 左右跟手滑动切换抽屉页：时刻表页左滑 → 运行图；标签条上左右滑均可
  const dp = $('dpages'), pn = $('panel'), dw = $('dgwrap');
  const clearDrag = () => { dp.classList.remove('swiping'); pn.style.transform = ''; dw.style.transform = ''; };
  const bindSwipe = (el, allowDir) => {
    let g = null;
    el.addEventListener('touchstart', e => {
      if (!isSheet() || e.touches.length !== 1) { g = null; return; }
      const t = e.touches[0]; g = { x: t.clientX, y: t.clientY, lock: 0, dx: 0 };
    }, { passive: true });
    el.addEventListener('touchmove', e => {
      if (!g) return;
      const t = e.touches[0], dx = t.clientX - g.x, dy = t.clientY - g.y;
      if (!g.lock) {
        if (Math.hypot(dx, dy) < 10) return;
        if (Math.abs(dx) < Math.abs(dy) * 1.25) { g = null; return; }
        const dir = dx < 0 ? 'left' : 'right';
        const canGo = (dir === 'left' && !splitOn && allowDir('left'))
          || (dir === 'right' && splitOn && document.body.classList.contains('panelOpen') && allowDir('right'));
        if (!canGo) { g = null; return; }
        g.lock = 1; dp.classList.add('swiping');
      }
      const w = dp.clientWidth || 360;
      const clamped = splitOn ? Math.max(0, Math.min(w, dx)) : Math.min(0, Math.max(-w, dx));
      g.dx = clamped;
      const base = splitOn ? -w : 0;
      pn.style.transform = `translateX(${base + clamped}px)`;
      dw.style.transform = `translateX(${base + w + clamped}px)`;
    }, { passive: true });
    const end = () => {
      if (!g) return;
      const { lock, dx } = g; g = null;
      if (!lock) return;
      const w = dp.clientWidth || 360;
      clearDrag();
      if (dx < -Math.min(64, w * 0.2) && !splitOn) setSplit(true);
      else if (dx > Math.min(64, w * 0.2) && splitOn && document.body.classList.contains('panelOpen')) setSplit(false);
    };
    el.addEventListener('touchend', end, { passive: true });
    el.addEventListener('touchcancel', () => { g = null; clearDrag(); }, { passive: true });
  };
  bindSwipe(pn, d => d === 'left');
  bindSwipe($('dstrip'), () => true);
}
{
  // 上下拽标签条改抽屉高度：下限 = 初始固定高度，上限 = 顶部留出 ~64px 露地图；左右滑仍交给上面的切页手势
  const dr = $('drawer'), ds = $('dstrip');
  let g = null, justDragged = false;
  ds.addEventListener('pointerdown', e => {
    if (!isSheet() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    g = { id: e.pointerId, y: e.clientY, x: e.clientX, h0: dr.offsetHeight, lock: 0 };
  });
  ds.addEventListener('pointermove', e => {
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.lock) {
      if (Math.hypot(dx, dy) < 8) return;
      if (Math.abs(dy) < Math.abs(dx) * 1.25) { g = null; return; }   // 横向：留给切页
      g.lock = 1;
      const h = dr.style.height; dr.style.height = ''; g.min = dr.offsetHeight; dr.style.height = h;   // 读 CSS 的初始高度当下限
      try { ds.setPointerCapture(e.pointerId); } catch (er) {}
      document.body.classList.add('drdrag');
    }
    const max = Math.max(g.min, innerHeight - barH() - 64);
    dr.style.height = Math.round(Math.min(max, Math.max(g.min, g.h0 - dy))) + 'px';
  });
  const end = e => {
    if (!g || e.pointerId !== g.id) return;
    const locked = g.lock; g = null;
    if (!locked) return;
    document.body.classList.remove('drdrag');
    justDragged = true; setTimeout(() => { justDragged = false; }, 350);
    draw();
  };
  ds.addEventListener('pointerup', end); ds.addEventListener('pointercancel', end);
  ds.addEventListener('click', e => { if (justDragged) { e.stopPropagation(); e.preventDefault(); } }, true);   // 拽完松手不误点标签
  MQ_SHEET.addEventListener && MQ_SHEET.addEventListener('change', () => { dr.style.height = ''; });
}
addEventListener('message', e => {
  if (e.origin === location.origin && e.data && e.data.type === 'railmap-swipe' && e.data.dir === 'right') {
    if (isSheet() && splitOn && document.body.classList.contains('panelOpen')) setSplit(false);
  }
});
// 时间控制弹层（手机）：底栏按钮显示「日期 时刻 倍速」，点开是日期 / 时刻轴 / 速度 / 现在 / 微调按钮
$('tbtn').onclick = e => { e.stopPropagation(); document.body.classList.toggle('tOpen'); };
document.addEventListener('pointerdown', e => {
  if (document.body.classList.contains('tOpen') && !e.target.closest('#tctl, #tbtn, #dpop, #tprog')) document.body.classList.remove('tOpen');
});
$('clockrow').addEventListener('click', e => {
  const b = e.target.closest('.tstep'); if (!b || switching) return;
  const lo = +$('slider').min, hi = +$('slider').max;
  jumpT(Math.min(hi, Math.max(lo, Math.round(T) + +b.dataset.dt)));
});
let tbtnKey = '';
function syncTimeUi() {                      // 每次重绘调用：底栏时间按钮的文字、细进度条位置
  const c = $('clock').textContent, d = curDate ? curDate.slice(5) : '';
  const sp = $('spdval').textContent.replace('1秒:', '×'), key = c + '|' + d + '|' + (playing ? sp : '');
  if (key !== tbtnKey) {
    tbtnKey = key;
    const b = $('tbtn'); b.querySelector('.d').textContent = d; b.querySelector('b').textContent = c;
    b.querySelector('.x').textContent = playing ? sp : '';
  }
  const s = $('slider'), lo = +s.min, hi = +s.max;
  $('tprog').querySelector('b').style.width = (hi > lo ? Math.min(1, Math.max(0, (T - lo) / (hi - lo))) * 100 : 0) + '%';
}
{
  // 细进度条拖动：等同拖时间轴（选中列车时同样只覆盖这趟车的运行区间）
  const tp = $('tprog');
  const setFrom = ev => {
    const r = tp.getBoundingClientRect(), s = $('slider');
    const f = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
    s.value = +s.min + f * (+s.max - +s.min);
    s.dispatchEvent(new Event('input'));
  };
  tp.addEventListener('pointerdown', e => {
    e.preventDefault(); tp.setPointerCapture(e.pointerId); tp.classList.add('drag'); setFrom(e);
    const mv = ev => setFrom(ev);
    const up = () => { tp.classList.remove('drag'); tp.removeEventListener('pointermove', mv); tp.removeEventListener('pointerup', up); tp.removeEventListener('pointercancel', up); };
    tp.addEventListener('pointermove', mv); tp.addEventListener('pointerup', up); tp.addEventListener('pointercancel', up);
  });
}
// 地图上被底部抽屉挡住的高度（像素）：跟随居中、定位时把目标放在露出的部分中间
function sheetOcc() {
  if (!isSheet()) return 0;
  const dr = $('drawer'); if (!dr.offsetHeight) return 0;
  const mr = map.getContainer().getBoundingClientRect(), pr = dr.getBoundingClientRect();
  return Math.max(0, Math.min(mr.height * 0.7, mr.bottom - pr.top));
}
const sheetEst = () => Math.max(230, Math.round(map.getSize().y * 0.4));   // 抽屉还没打开时按 40% 估计
// fitBounds 的边距：手机抽屉打开（或即将打开）时底部多留出抽屉的高度
function fitPad(p = 30, sheetSoon = true) {
  if (!isSheet()) return { padding: [p, p] };
  const occ = sheetOcc() || (sheetSoon ? sheetEst() : 0);
  return { paddingTopLeft: [p / 2, p], paddingBottomRight: [p / 2, occ + p / 2] };
}
