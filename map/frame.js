// map.html · 每帧绘制：跟随、draw()、关注路径、drawFrame、车站与非客运站
// 经典脚本（非 module），与其它 map/*.js 共享全局作用域，加载顺序见 map.html
// 跟随：车次面板里点“跟随”，每帧把地图中心移到该车；拖动地图、取消或换选车次即停止
let follow = false, drawing = false;
function followSel() {
  if (follow && sel !== followTr) follow = false;
  if (!follow) return;
  const st = state(sel, T); if (!st) return;
  const p = map.latLngToContainerPoint(st.pos), c = map.getSize().divideBy(2);
  c.y -= sheetOcc() / 2;                     // 手机抽屉打开时，跟随点放在露出部分的中央
  if (Math.abs(p.x - c.x) > 0.5 || Math.abs(p.y - c.y) > 0.5) map.panBy([p.x - c.x, p.y - c.y], { animate: false });
}
let followTr = null;

function draw() {
  if (!D || !overlay.ctx || drawing) return;
  syncSlider();
  writeHash();
  drawing = true;
  try { followSel(); drawFrame(); syncDiagram(); syncDgTime(); trackHist(); syncTimeUi(); } finally { drawing = false; }
}
let stopPushMem = new Map(), stopPushRaf = 0;
let focusCache = null;
// 关注车次高亮路径（选中车次时为该车全程；选中车站时为所有停靠车次全程），缓存成离屏画布，动画播放时直接贴图
function drawFocusLayer(ctx, s) {
  if (!focus || s.x <= 0 || s.y <= 0) return;
  const z = map.getZoom(), dpr = devicePixelRatio || 1;
  const origin = map.getPixelOrigin(), topLeft = map.containerPointToLayerPoint([0, 0]);
  const bgCol = css('--bg'), fgCol = css(sel ? '--sel' : '--hl');
  const PAD = 256;
  let ox = 0, oy = 0;
  if (focusCache) {
    ox = (focusCache.origin.x + focusCache.topLeft.x) - (origin.x + topLeft.x);
    oy = (focusCache.origin.y + focusCache.topLeft.y) - (origin.y + topLeft.y);
  }
  const stale = !focusCache
    || focusCache.z !== z || focusCache.dpr !== dpr
    || focusCache.w !== s.x || focusCache.h !== s.y
    || focusCache.focus !== focus || focusCache.sel !== sel || focusCache.gRef !== G
    || focusCache.bgCol !== bgCol || focusCache.fgCol !== fgCol
    || Math.abs(ox) > PAD || Math.abs(oy) > PAD;
  if (stale) {
    const c = (focusCache && focusCache.c) || document.createElement('canvas');
    const cw = s.x + PAD * 2, ch = s.y + PAD * 2;
    const pw = Math.max(1, Math.round(cw * dpr)), ph = Math.max(1, Math.round(ch * dpr));
    if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph; }
    const sx = pw / cw, sy = ph / ch;
    const cctx = c.getContext('2d');
    cctx.setTransform(sx, 0, 0, sy, PAD * sx, PAD * sy);
    cctx.clearRect(-PAD, -PAD, cw, ch);
    const sw = map.containerPointToLatLng([-PAD, s.y + PAD]), ne = map.containerPointToLatLng([s.x + PAD, -PAD]);
    const W = sw.lng, S = sw.lat, E = ne.lng, N = ne.lat;
    const gids = new Set();
    for (const tr of focus) for (const leg of tr.l) if (leg) gids.add(leg[0]);
    cctx.beginPath();
    for (const gi of gids) {
      const g = G[gi]; if (!g) continue;
      let lx = NaN, ly = NaN, out = true;
      for (let j = 0; j < g.km.length; j++) {
        const lon = g.lon[j], lat = g.lat[j], inside = lon >= W && lon <= E && lat >= S && lat <= N;
        if (!inside && out && j + 1 < g.km.length) {   // 视野外的点只保留进出视野的那一个
          const nl = g.lon[j + 1], na = g.lat[j + 1];
          if (!(nl >= W && nl <= E && na >= S && na <= N)) { lx = NaN; continue; }
        }
        out = !inside;
        const q = map.project([lat, lon], z), x = q.x - origin.x - topLeft.x, y = q.y - origin.y - topLeft.y;
        if (isNaN(lx)) cctx.moveTo(x, y);
        else if (Math.abs(x - lx) + Math.abs(y - ly) < 1 && j + 1 < g.km.length) continue;   // 不足 1 像素的点跳过
        else cctx.lineTo(x, y);
        lx = x; ly = y;
      }
    }
    cctx.lineCap = 'round'; cctx.lineJoin = 'round';
    const fw = z <= 5 ? 1.5 : z <= 7 ? 2.2 : 3;   // 缩小时关注线路也变细
    cctx.strokeStyle = bgCol; cctx.lineWidth = fw + 2.5; cctx.stroke();      // 底色描边，与路网及底下其他列车分开
    cctx.strokeStyle = fgCol; cctx.lineWidth = fw; cctx.stroke();
    focusCache = { c, z, dpr, w: s.x, h: s.y, origin, topLeft, focus, sel, gRef: G, bgCol, fgCol };
    ox = 0; oy = 0;
  }
  ctx.drawImage(focusCache.c, ox - PAD, oy - PAD, focusCache.w + PAD * 2, focusCache.h + PAD * 2);
}

function drawFrame() {
  const ctx = overlay.ctx, s = map.getSize(), z = map.getZoom();
  ctx.clearRect(0, 0, s.x, s.y);
  if (sel !== focusSel || (selLine ? null : selSt) !== focusSt) setFocus();
  active = [];
  const useMk = mkOn && typeof getMarker2D === 'function';
  const inIcon = useMk ? z >= 11 : z >= 12;    // 经典模式 z12 起、涂装模式 z11 起把车次放上车身
  const r = useMk
    ? (z >= 17 ? 42 : z >= 16 ? 36 : z >= 15 ? 30 : z >= 14 ? 24 : z >= 13 ? 19 : z >= 12 ? 15 : z >= 11 ? 11.8 : z >= 10 ? 9.2 : z >= 9 ? 7.2 : z >= 8 ? 5.6 : z >= 7 ? 4.4 : z >= 6 ? 3.4 : z >= 5 ? 2.8 : 2.4)
    : (z >= 15 ? 14.5 : z >= 14 ? 13.5 : z >= 13 ? 12 : z >= 12 ? 10.5 : z >= 11 ? 7.6 : z >= 10 ? 6.4 : z >= 9 ? 5.4 : z >= 8 ? 4.4 : z >= 7 ? 3.6 : z >= 6 ? 2.8 : z >= 5 ? 2.5 : 2.3);
  const edge = z >= 11 ? 1.2 : z >= 9 ? 1 : z >= 7 ? 0.7 : 0.5;   // 车身外描边宽度
  const selc = css('--sel'), bg = css('--bg'), edgeC = css('--tEdge'), gold = css('--tGold'), grey = css('--muted');
  const lc = Object.fromEntries(LIVERIES.map(k => [k, css('--t' + k)]));
  const roundOk = z >= 6, fxOk = z >= 7;   // 太小时普速也画尖头、不画复兴号色带
  const noTrains = z <= 3;             // 太远时不画车（选中的除外）
  const pad = useMk ? 96 : inIcon ? 50 : 36;
  const labels = [];
  for (const tr of D.trains) {
    if (noTrains && tr !== sel) continue;
    const st = state(tr, T); if (!st) continue;
    const p = toPx(st.pos);
    if (p.x < -pad || p.y < -pad || p.x > s.x + pad || p.y > s.y + pad) continue;
    active.push({ tr, st, p, slot: 0, targetSlot: 0, stackIdx: 0, sizeTxt: null, hideInTxt: false });
  }
  // 同站同侧停靠的多趟列车：后面进站的车占内侧（贴站台中心线），把先到的已停车往外推挤错开 25% 列车宽度
  const PUSH_MIN = 0.45, PUSH_TAU_MS = 110, PUSH_GRACE_MS = 1500;
  const nowMs = performance.now();
  for (const [k, v] of stopPushMem) if (nowMs - v.t > PUSH_GRACE_MS) stopPushMem.delete(k);
  const stopGroups = new Map();
  for (const a of active) if (a.st.stopSt) {
    const gk = a.st.stopSt + '|' + (a.st.stopSign || 1);
    let g = stopGroups.get(gk); if (!g) stopGroups.set(gk, g = []);
    g.push(a);
  }
  const NP = 0.65, PK = Math.sqrt((0.5 + Math.PI / 8) / (1 - NP / 2));
  for (const grp of stopGroups.values()) {
    grp.sort((x, y) => (y.st.arrT - x.st.arrT) || x.tr.c.localeCompare(y.tr.c) || runOd(x.tr).localeCompare(runOd(y.tr)));
    let acc = 0;
    for (let i = 0; i < grp.length; i++) {
      const a = grp[i];
      a.targetSlot = acc;
      a.stackIdx = i;
      const u = Math.min(1, Math.max(0, (T - (a.st.arrT ?? T)) / PUSH_MIN));
      acc += u * u * (3 - 2 * u);      // 新车进站后 PUSH_MIN 分钟内平滑推开已停列车
    }
    if (grp.length > 1 && inIcon) {
      let maxTxt = '';
      for (const a of grp) { const c0 = a.tr.c.split('/')[0]; if (c0.length > maxTxt.length) maxTxt = c0; }
      const topA = grp.find(a => a.tr === sel || a.tr === hover) || grp[0];
      for (const a of grp) {
        a.sizeTxt = maxTxt;
        if (a !== topA) a.hideInTxt = true;
      }
    }
  }
  let pushGliding = false;
  for (const a of active) {
    const key = trMemKey(a.tr), old = stopPushMem.get(key);
    let slot = a.targetSlot;
    if (old && nowMs - old.t <= 250 && (!a.st.stopSt || !old.st || old.st === a.st.stopSt)) {
      const dt = Math.max(1, nowMs - old.t), alpha = 1 - Math.exp(-dt / PUSH_TAU_MS);
      slot = old.slot + (a.targetSlot - old.slot) * alpha;
      if (Math.abs(a.targetSlot - slot) < 0.01) slot = a.targetSlot;
      else pushGliding = true;
    }
    a.slot = slot;
    if (slot > 1e-3 || a.st.stopSt) stopPushMem.set(key, { slot, t: nowMs, st: a.st.stopSt || (old && old.st) });
    if (slot > 1e-3) {
      const b = map.project(a.st.back, z), ah = map.project(a.st.ahead, z);
      let ang = Math.atan2(ah.y - b.y, ah.x - b.x);
      if (!isFinite(ang) || (ah.x === b.x && ah.y === b.y)) ang = -Math.PI / 2;
      const lx = Math.sin(ang), ly = -Math.cos(ang);
      const emu = EMU.has(a.tr.lv), k = (!emu && roundOk) ? 1 : PK;
      const wBase = useMk ? r * 1.05 : (inIcon ? r : r * 0.9 * k);
      const stepPx = Math.max(edge * 0.9, wBase * 0.25);   // 错开 25% 列车宽度（低缩放保底略大于半描边）
      const dv = slot * stepPx;
      a.p = L.point(a.p.x + lx * dv, a.p.y + ly * dv);
    }
  }
  // 外侧被推开的先画（在下层露出车顶与鼻锥轮廓），最新进站的内侧车后画（在前景完整展示）
  active.sort((x, y) => ((x.tr === sel || x.tr === hover) - (y.tr === sel || y.tr === hover)) || (focus ? focus.has(x.tr) - focus.has(y.tr) : 0) || ((y.slot || 0) - (x.slot || 0)));
  const drawOneTrain = a => {
    // 选中车次时按全局开关 dimOthers 决定是否灰掉其他车；选中车站时车照常着色（路网仍压暗），只是不停这个站的车不标车次
    const isSel = a.tr === sel || a.tr === hover, off = focus && !focus.has(a.tr), dim = dimOthers && off && !!sel;
    const hideLab = off && (sel ? dimOthers : true);
    ctx.globalAlpha = dim ? 0.45 : 1;
    if (useMk) {
      const rawTxt = inIcon && (!hideLab || isSel) ? a.tr.c.split('/')[0] : null;
      const txt = a.hideInTxt && !isSel ? null : rawTxt;
      const sh = drawTrainMarker(ctx, a.p, a.st.back, a.st.ahead, isSel ? r * 1.18 + 2 : r, a.tr, isSel, dim, z, selc, bg, grey, txt, rawTxt ? a.sizeTxt : null, a.st.li);
      a.hit = sh.hit;
      if (!rawTxt && ((z >= 10 && !hideLab && (!a.stackIdx || isSel)) || isSel)) labels.push({ a, lab: sh.label, isSel, pri: a.tr === sel ? 0 : focus && focus.has(a.tr) ? 1 : 2 });
    } else {
      const emu = EMU.has(a.tr.lv), rawTxt = inIcon ? a.tr.c.split('/')[0] : null;
      const txt = a.hideInTxt && !isSel ? null : rawTxt;
      const sh = trainShape(ctx, a.p, a.st.back, a.st.ahead, isSel ? r + (inIcon ? 1.5 : 2.5) : r, !emu && roundOk, txt, a.tr.fx && fxOk && !dim, rawTxt ? a.sizeTxt : null);
      a.hit = sh.hit;
      const lab = sh.label;
      // 外描边：与底下线路分开；动车组车身浅，用深色描边（深色主题即背景色）；选中为品红圈
      ctx.lineJoin = 'round'; ctx.lineWidth = isSel ? 3 : edge; ctx.strokeStyle = isSel ? selc : emu && !dim ? edgeC : bg; ctx.stroke();
      ctx.fillStyle = dim ? grey : lc[a.tr.lv]; ctx.fill();
      if (a.tr.fx && fxOk && !dim) { sh.lower(); ctx.fillStyle = gold; ctx.fill(); }
      if (txt) sh.drawText(!dim && (a.tr.lv === 'S' || a.tr.lv === 'W') ? '#1b1b1b' : '#ffffff');
      else if (!rawTxt && ((z >= 10 && !hideLab && (!a.stackIdx || isSel)) || isSel)) labels.push({ a, lab, isSel, pri: a.tr === sel ? 0 : focus && focus.has(a.tr) ? 1 : 2 });
    }
  };
  if (focus) {
    if (!sel || dimOthers) {
      // 其他车灰掉时（或选中车站时）：其他列车 → 高亮路径（叠加在其他车之上）→ 车站与标注 → 关注/选中列车
      for (const a of active) if (!focus.has(a.tr) && a.tr !== sel && a.tr !== hover) drawOneTrain(a);
      ctx.globalAlpha = 1;
      drawFocusLayer(ctx, s);
      drawStations(ctx, s);
      for (const a of active) if (focus.has(a.tr) || a.tr === sel || a.tr === hover) drawOneTrain(a);
    } else {
      // 其他车不灰时：高亮路径 → 车站与标注 → 其他列车（显示在本车高亮路径之上）→ 关注/选中列车
      drawFocusLayer(ctx, s);
      drawStations(ctx, s);
      for (const a of active) drawOneTrain(a);
    }
  } else {
    drawStations(ctx, s);
    for (const a of active) drawOneTrain(a);
  }
  ctx.globalAlpha = 1;
  drawTrainLabels(ctx, labels);
  if (pushGliding && !playing && !stopPushRaf) {
    stopPushRaf = requestAnimationFrame(() => { stopPushRaf = 0; draw(); });
  }
  $('clock').textContent = fmt(T);
  $('count').textContent = noTrains ? '放大到 z4 显示列车' : `视野内 ${active.length} 趟`;
  if (sel || selLine || !selSt) stPanelKey = null;    // 面板换成别的内容后，对应面板要整份重绘
  if (!sel || selLine) trPanelId = '';
  if (sel || !selLine) linePanelKey = null;
  if (sel) panel(); else if (selLine) linePanel(); else if (selSt) stationPanel();
}

// 车站：圆点大小按当日停靠车次数分级；标注随缩放逐级显示
const stRadius = n => n >= 300 ? 4.6 : n >= 100 ? 3.6 : n >= 30 ? 2.9 : 2.2;
const stDotMin = z => z >= 7 ? 0 : z >= 6 ? 50 : z >= 5 ? 100 : 440;   // 低缩放只画大站
const stLabelMin = z => z >= 10 ? 0 : z >= 9 ? 30 : z >= 8 ? 100 : z >= 6 ? 300 : 440;
const stFont = (z, big) => {
  const fs = big ? (z <= 4 ? 10 : z <= 9 ? 11 : z <= 11 ? 12 : z === 12 ? 13 : 14) : (z <= 4 ? 9 : z <= 11 ? 11 : z === 12 ? 12 : 13);
  return [fs, `${big && z >= 6 ? '600 ' : ''}${fs}px system-ui`];
};
let stShown = [], stLabelBoxes = [];   // 车站标注占用的矩形，车次标签避让
function drawStations(ctx, s) {
  const z = map.getZoom(), minDot = stDotMin(z), minLabel = stLabelMin(z), bg = css('--bg'), fg = css('--fg'), mu = css('--muted');
  const stFill = css('--stFill');
  // 选中单个车次时：只画它自己的停站（含技术停车折返站），且都要标名（标注互相重叠时让大站优先）
  const own = sel ? new Set([...sel.s.map(x => x[0]), ...sel.l.flatMap(l => (l && l[5]) ? l[5].filter(w => w[4] && w[4].startsWith('技术停车')).map(w => w[3]) : [])])
    : selLine && KB ? new Set(KB.lines[selLine].st.map(x => x[0])) : null;
  stShown = []; stLabelBoxes = [];
  const labs = [];
  for (const st of ST) {
    const cityMode = !own && z <= CITY_MAX_Z, nEff = cityMode ? st.cityN ?? st.n : st.n;
    const cap = st.capital && z === CAPITAL_Z;
    if (own ? !own.has(st.name) : nEff < minDot && st !== selSt && !cap) continue;
    const isSel0 = st === selSt;
    const wantLabel = own || isSel0 || cap || (cityMode ? !st.cityBase && nEff >= minLabel : st.n >= minLabel);
    if (z <= 6 && !wantLabel) continue;       // z ≤ 6 只画有站名的车站
    const p = map.latLngToContainerPoint([st.lat, st.lon]);
    if (p.x < -20 || p.y < -20 || p.x > s.x + 20 || p.y > s.y + 20) continue;
    const r = stRadius(st.n) * stZoomK(z), isSel = st === selSt;
    const rr = isSel ? r + 2 : r;
    // 尺寸：缩小时用固定像素；放大后按真实尺度换算、跟地图一起变大，设上限
    const mpp = 156543.03 * Math.cos(st.lat * Math.PI / 180) / 2 ** z;   // 每像素米数
    let ex, ey, rectN = null;                 // 画出图形的半宽、半高（屏幕轴向），站名与点击范围据此让开
    const shape = stShape(st, z), big = isBigStation(st);
    ctx.beginPath();
    if (shape === 'rect') {                   // 沿线路走势的长方形（墨卡托保角，屏幕 y 向下）
      const [L, W] = stRectSize(big, z, mpp, isSel);
      const a = Math.atan2(-st.axis[1], st.axis[0]), c = Math.cos(a), si = Math.sin(a);
      const pt = (u, v) => [p.x + c * u - si * v, p.y + si * u + c * v];
      ctx.moveTo(...pt(-L, -W)); ctx.lineTo(...pt(L, -W)); ctx.lineTo(...pt(L, W)); ctx.lineTo(...pt(-L, W)); ctx.closePath();
      ex = Math.abs(c) * L + Math.abs(si) * W; ey = Math.abs(si) * L + Math.abs(c) * W;
      rectN = [-si, c, W];                    // 长边法线（屏幕坐标）及半宽，站名放在法线上
    } else {                                  // 圆点：放大后按半径约 150 m，上限 28 px；与长方形并存的级别（z7–11）面积 ≥ 1.2 倍普通站长方形
      const [L0, W0] = stRectSize(false, z, mpp, isSel);
      const R = Math.max(Math.min(28, Math.max(rr, 150 / mpp)), z >= 7 ? Math.sqrt(1.2 * 4 * L0 * W0 / Math.PI) : 0);
      ctx.arc(p.x, p.y, R, 0, 2 * Math.PI); ex = ey = R;
    }
    // 填充：长方形用 --stFill（实心），圆点用背景色
    ctx.fillStyle = shape === 'rect' ? stFill : bg; ctx.fill();
    // 轮廓线
    ctx.lineJoin = 'miter'; ctx.lineWidth = isSel ? 2 : 1.2; ctx.strokeStyle = isSel ? css('--sel') : mu; ctx.stroke();
    const ent = { st, p, hr: Math.max(9, Math.min(ex, ey) + 2) };
    if (wantLabel) {
      // 候选中心点：长方形放在长边法线上（先上方/右侧，被占再换对侧），框边离长方形 3 px；圆点放右上角外侧
      const [fs, font] = stFont(z, big || cap || (cityMode && nEff >= ST_BIG_N));
      ctx.font = font;
      const hw = ctx.measureText(dn(st.name)).width / 2 + 1, hh = fs / 2 + 1, cands = [];
      if (rectN) {
        let [nx, ny, W] = rectN;
        if (Math.abs(ny) > 0.2 ? ny > 0 : nx < 0) { nx = -nx; ny = -ny; }
        for (const k of [1, -1]) { const d = W + 3 + Math.abs(nx) * hw + Math.abs(ny) * hh;
          cands.push([p.x + k * nx * d, p.y + k * ny * d]); }
      } else cands.push([p.x + ex + 3 + hw, p.y - ey - hh + 1]);
      labs.push({ st, ent, hw, hh, font, cands });
    }
    stShown.push(ent);
  }
  if (own) labs.sort((a, b) => b.st.n - a.st.n);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const hitB = b => stLabelBoxes.some(q => b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1]);
  for (const l of labs) {
    const boxes = l.cands.map(([x, y]) => [x - l.hw, y - l.hh, x + l.hw, y + l.hh]);
    let k = boxes.findIndex(b => !hitB(b));
    if (k < 0) { if (own) continue; k = 0; }          // 选中车次/线路时标注重叠就不画；平时照画
    const b = boxes[k], [x, y] = l.cands[k];
    stLabelBoxes.push(b); l.ent.box = b;
    ctx.font = l.font;
    ctx.lineWidth = 3; ctx.strokeStyle = bg; ctx.strokeText(dn(l.st.name), x, y);
    ctx.fillStyle = fg; ctx.fillText(dn(l.st.name), x, y);
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  drawAuxStations(ctx, s);
  drawBorderLines(ctx, s);
}

// 非客运站（会让站 / 线路所）：垂直于线路的短刻度线，最后画、站名优先级最低（docs/11 §5.1）
let auxShown = [];
const AUX_NAME = ['会让站（不办客运）', '线路所'];
function auxVisible(z) {
  // 选中车次：只显示该车在此有推定停车（会车、待避、技术停车）的非客运站；选中客里表线路：只显示该线所含的
  if (sel) {
    const nm = new Set(sel.l.flatMap(l => (l && l[5]) ? l[5].map(w => w[3]) : []));
    return z >= 8 ? a => nm.has(a.name) : () => false;
  }
  if (selLine) return z >= 8 ? a => a.lines.includes(String(selLine)) : () => false;
  return z >= 10 ? () => true : () => false;
}
function drawAuxStations(ctx, s) {
  auxShown = [];
  const z = map.getZoom(), show = auxVisible(z);
  if (!AUX.length) return;
  const mu = css('--muted'), bg = css('--bg'), own = !!(sel || selLine);
  const labs = [];
  ctx.lineCap = 'butt'; ctx.lineWidth = 1.6; ctx.strokeStyle = mu;
  for (const a of AUX) {
    if (!show(a) || STBY && STBY[a.name]) continue;       // 与客运站重名的不重复画
    const p = map.latLngToContainerPoint([a.lat, a.lon]);
    if (p.x < -20 || p.y < -20 || p.x > s.x + 20 || p.y > s.y + 20) continue;
    const base = a.kind ? 5 : 7, cap = a.kind ? 8 : 11, len = Math.min(cap, base + Math.max(0, Math.min(z, 15) - 11));
    const nx = a.ay, ny = a.ax, h = len / 2;       // 屏幕法线（线路走向 (ax, -ay) 的垂线），y 向下
    ctx.beginPath(); ctx.moveTo(p.x - nx * h, p.y - ny * h); ctx.lineTo(p.x + nx * h, p.y + ny * h); ctx.stroke();
    auxShown.push({ a, p, hr: Math.max(7, h + 3) });
    if (z >= 12 || own) labs.push({ a, p, nx, ny, h });
  }
  ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = mu;
  const hit = b => stLabelBoxes.some(q => b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1]);
  for (const l of labs) {
    const hw = ctx.measureText(dn(l.a.name)).width / 2 + 1, hh = 6;
    let { nx, ny } = l; if (ny > 0 || (Math.abs(ny) < 0.2 && nx < 0)) { nx = -nx; ny = -ny; }
    const d = l.h + 3 + Math.abs(nx) * hw + Math.abs(ny) * hh;
    for (const k of [1, -1]) {
      const x = l.p.x + k * nx * d, y = l.p.y + k * ny * d, b = [x - hw, y - hh, x + hw, y + hh];
      if (hit(b)) continue;
      stLabelBoxes.push(b); auxShown.find(q => q.a === l.a).box = b;
      ctx.lineWidth = 3; ctx.strokeStyle = bg; ctx.strokeText(dn(l.a.name), x, y); ctx.fillText(dn(l.a.name), x, y);
      break;
    }
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}
