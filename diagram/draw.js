// diagram.html · 绘制：上下行开关、坐标映射、draw()
// 经典脚本（非 module），与其它 diagram/*.js 共享全局作用域，加载顺序见 diagram.html
'use strict';
// ===== 绘制 =====
// 上下行：两个按钮各自开关，默认都亮。.value 沿用原来的取值：'' 两个都看，'down' / 'up' 只看一个。
// 最后一个亮着的不能关掉，免得图上什么都没有
(() => {
  const el = $('dir'), on = { down: true, up: true };
  const paint = () => { for (const b of el.children) b.classList.toggle('on', on[b.dataset.v]); };
  Object.defineProperty(el, 'value', {
    get: () => on.down && on.up ? '' : on.down ? 'down' : 'up',
    set: x => { on.down = x !== 'up'; on.up = x !== 'down'; paint(); } });
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    b.blur();
    const k = b.dataset.v, o = k === 'down' ? 'up' : 'down';
    if (on[k] && !on[o]) return;
    on[k] = !on[k]; paint(); el.dispatchEvent(new Event('change'));
  });
  paint();
})();
const dirOk = o => !$('dir').value || o.dir === $('dir').value;
const X = t => PAD.l + (t - view.t0) / (view.t1 - view.t0) * (W - PAD.l - PAD.r);
// 剪口：客里表与 OSM 对不上、多数车在此画不出来的里程段（见 findCuts）。纵轴不压缩，保留真实里程高度：
// 剪口段画成灰色阴影带，跨剪口的运行线按直线虚线接上（斜率即实际速度，不会出现假的水平“停车”）。
// mapK / unmapK 保留为恒等映射（纵轴坐标 = 里程），view.k0/k1 即里程。
let CUTS = [];                          // [[k0, k1], ...]（里程，升序、不重叠）
const mapK = k => k, unmapK = m => m;
const inCut = k => CUTS.some(([a, b]) => k > a + 0.05 && k < b - 0.05);
const Y = k => PAD.t + (mapK(k) - view.k0) / (view.k1 - view.k0) * (H - PAD.t - PAD.b);
const tAt = x => view.t0 + (x - PAD.l) / (W - PAD.l - PAD.r) * (view.t1 - view.t0);
const kAt = y => view.k0 + (y - PAD.t) / (H - PAD.t - PAD.b) * (view.k1 - view.k0);
let COLORS = {};
function draw() {
  COLORS = Object.fromEntries(CLASSES.map(([k]) => [k, css('--c' + k)]));
  const bg = css('--bg'), fg = css('--fg'), muted = css('--muted');
  ctx.setTransform(devicePixelRatio || 1, 0, 0, devicePixelRatio || 1, 0, 0);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.font = '11px system-ui, sans-serif';
  if (!LINE) { ctx.fillStyle = muted; ctx.textAlign = 'center'; ctx.fillText('选一条线路', W / 2, H / 2); return; }
  // 时间网格
  const span = view.t1 - view.t0, step = span > 900 ? 60 : span > 360 ? 30 : span > 120 ? 10 : span > 40 ? 5 : 1;
  ctx.textAlign = 'center';
  for (let m = Math.ceil(view.t0 / step) * step; m <= view.t1; m += step) {
    const x = X(m), major = m % 60 === 0;
    ctx.strokeStyle = css(major ? '--grid' : '--grid2'); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + .5, PAD.t); ctx.lineTo(x + .5, H - PAD.b); ctx.stroke();
    if (major || step <= 10) { ctx.fillStyle = muted; ctx.fillText(fmt(m), x, H - PAD.b + 15); }
  }
  // 车站
  const showPost = $('showPost').checked;
  const showAux = true;
  ctx.textAlign = 'right';
  let lastY = -99;
  STLAB = [];
  for (const s of LINE.st) {
    const post = s.flag & 2;
    if (post && !showPost) continue;
    const cutSt = inCut(s.km);                // 剪口段里的站照画，名字用灰色
    const y = Y(s.km);
    if (y < PAD.t - 2 || y > H - PAD.b + 2) continue;
    ctx.strokeStyle = css(post ? '--grid2' : '--grid'); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD.l, Math.round(y) + .5); ctx.lineTo(W - PAD.r, Math.round(y) + .5); ctx.stroke();
    if (Math.abs(y - lastY) >= 11) {
      ctx.fillStyle = post || !s.ll || cutSt ? muted : fg;
      ctx.fillText(s.name, PAD.l - 34, y + 4);
      if (s.ll) STLAB.push({ s, x0: PAD.l - 34 - ctx.measureText(s.name).width - 2, x1: PAD.l - 32, y0: y - 7, y1: y + 7 });
      ctx.fillStyle = muted; ctx.fillText(kmTxt(s.km), PAD.l - 4, y + 4);
      lastY = y;
    }
  }
  // 非客运站：淡虚线 + 小号站名（线路所加 *）；站名在相邻可显示站名间距 < AUX_LABEL_PX 时隐藏，只留细线
  if (showAux) {
    ctx.save(); ctx.font = '10px system-ui, sans-serif'; ctx.textAlign = 'right';
    ctx.setLineDash([2, 3]); ctx.lineWidth = 1;
    let lastA = -99;
    for (const a of LINE.aux) {
      const y = Y(a.km);
      if (y < PAD.t - 2 || y > H - PAD.b + 2) continue;
      ctx.strokeStyle = css('--grid2'); ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.moveTo(PAD.l, Math.round(y) + .5); ctx.lineTo(W - PAD.r, Math.round(y) + .5); ctx.stroke();
      if (Math.abs(y - lastA) >= AUX_LABEL_PX && !LINE.st.some(s => Math.abs(Y(s.km) - y) < 9)) {
        ctx.globalAlpha = 0.85; ctx.fillStyle = muted;
        ctx.fillText(a.name + (a.kind ? '*' : ''), PAD.l - 34, y + 3.5);
        lastA = y;
      }
    }
    ctx.restore();
  }
  // 剪口：灰色阴影带（斜纹）+ 里程范围
  for (const [a, b] of CUTS) {
    const y0 = Y(a), y1 = Y(b), ym = (y0 + y1) / 2;
    if (y1 < PAD.t || y0 > H - PAD.b) continue;
    ctx.save();
    ctx.beginPath(); ctx.rect(PAD.l, Math.max(PAD.t, y0), W - PAD.l - PAD.r, Math.min(H - PAD.b, y1) - Math.max(PAD.t, y0)); ctx.clip();
    ctx.fillStyle = muted; ctx.globalAlpha = 0.08; ctx.fillRect(PAD.l, y0, W - PAD.l - PAD.r, y1 - y0);
    ctx.globalAlpha = 0.18; ctx.strokeStyle = muted; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = PAD.l - (y1 - y0); x < W - PAD.r; x += 10) { ctx.moveTo(x, y1); ctx.lineTo(x + (y1 - y0), y0); }
    ctx.stroke(); ctx.restore();
    ctx.fillStyle = muted; ctx.textAlign = 'left'; ctx.font = '10px system-ui, sans-serif';
    if (y1 - y0 >= 11) ctx.fillText(`✂ ${kmTxt(a)}–${kmTxt(b)} 数据对不上，虚线为直线连接`, PAD.l + 4, ym + 3.5);
    ctx.font = '11px system-ui, sans-serif';
  }
  // 列车
  ctx.save(); ctx.beginPath(); ctx.rect(PAD.l, PAD.t - 2, W - PAD.l - PAD.r, H - PAD.t - PAD.b + 4); ctx.clip();
  const showWait = $('showWait').checked;
  const visible = TR.filter(o => dirOk(o) && o.bb[1] >= view.t0 && o.bb[0] <= view.t1 && o.bb[3] >= view.k0 && o.bb[2] <= view.k1);
  const thin = visible.length > 600 ? 0.7 : 1;
  for (const pass of [0, 1, 2]) {            // 先画其他车，再画悬停，最后画选中（不灰掉其他车）
    for (const o of visible) {
      const isSel = !!sel && o === sel, hi = isSel || o === hover;
      if ((isSel ? 2 : hi ? 1 : 0) !== pass) continue;
      ctx.strokeStyle = isSel ? css('--sel') : COLORS[o.cls];
      ctx.globalAlpha = hi ? 1 : 0.85;
      ctx.lineWidth = hi ? 2.4 : thin;
      ctx.setLineDash([]);
      for (const p of o.pieces) {
        ctx.beginPath();
        let started = false;
        for (let j = 0; j < p.length; j += 2) {
          const x = X(p[j]), y = Y(p[j + 1]);
          if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      if (o.joins.length) {                     // 跨剪口：细虚线接上
        ctx.setLineDash([1.5, 2.5]);
        for (const [t1, k1, t2, k2] of o.joins) { ctx.beginPath(); ctx.moveTo(X(t1), Y(k1)); ctx.lineTo(X(t2), Y(k2)); ctx.stroke(); }
        ctx.setLineDash([]);
      }
      if (showWait && o.waits.length) {        // 推定停车：底色压掉再画虚线
        for (const w of o.waits) {
          const x0 = X(w[0]), x1 = X(w[1]), y = Y(w[2]);
          if (x1 < PAD.l || x0 > W) continue;
          ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.strokeStyle = bg; ctx.lineWidth = (hi ? 2.4 : thin) + 1.5;
          ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
          ctx.setLineDash([3, 3]); ctx.globalAlpha = 1;
          ctx.strokeStyle = isSel ? css('--sel') : COLORS[o.cls]; ctx.lineWidth = hi ? 2.4 : Math.max(thin, 1);
          ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
        }
        ctx.setLineDash([]);
      }
    }
  }
  ctx.globalAlpha = 1;
  // 站间离开 / 进入本线的线头：小空心圈；按里程聚类，在图右侧标去向（离线后下一站 / 上线前上一站）
  const groups = [];
  for (const o of visible) for (const e of o.exits) {
    if (o !== sel) {
      const x = X(e.t), y = Y(e.k);
      if (x >= PAD.l && x <= W - PAD.r && y >= PAD.t && y <= H - PAD.b) {
        ctx.strokeStyle = COLORS[o.cls]; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 2 * Math.PI); ctx.stroke();
      }
    }
    let g = groups.find(g => Math.abs(g.k - e.k) <= 2.5);
    if (!g) groups.push(g = { k: e.k, n: 0, names: new Map() });
    g.n++; if (e.nm) g.names.set(e.nm, (g.names.get(e.nm) || 0) + 1);
  }
  if (sel && visible.includes(sel)) for (const e of sel.exits) {
    const x = X(e.t), y = Y(e.k);
    if (x >= PAD.l && x <= W - PAD.r && y >= PAD.t && y <= H - PAD.b) {
      ctx.strokeStyle = css('--sel'); ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 2 * Math.PI); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1; ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'right';
  let lastGY = -99;
  for (const g of groups.sort((a, b) => a.k - b.k)) {
    const y = Y(g.k); if (y < PAD.t + 6 || y > H - PAD.b - 4 || y - lastGY < 13) continue;
    const top = [...g.names].sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
    const txt = `⇄ ${top.join('、')}${g.names.size > 3 ? ' 等' : ''}方向 · ${g.n}`;
    const w = ctx.measureText(txt).width;
    ctx.fillStyle = bg; ctx.globalAlpha = 0.85; ctx.fillRect(W - PAD.r - w - 8, y - 8, w + 6, 15); ctx.globalAlpha = 1;
    ctx.fillStyle = muted; ctx.fillText(txt, W - PAD.r - 4, y + 4);
    ctx.strokeStyle = muted; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(W - PAD.r - w - 14, Math.round(y) + .5); ctx.lineTo(W - PAD.r - w - 8, Math.round(y) + .5); ctx.stroke(); ctx.setLineDash([]);
    lastGY = y;
  }
  // 当前时刻（嵌在地图分屏里时由地图页同步，单独打开时取时间参数/地图记忆/当前时刻）：竖线 + 顶部时刻
  if (mapT && typeof mapT.t === 'number' && isFinite(mapT.t)) {
    const t = mapT.t, x = Math.round(X(t)) + .5;
    if (x >= PAD.l && x <= W - PAD.r) {
      const c = css('--now') || '#ffcc33';
      ctx.strokeStyle = c; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, PAD.t); ctx.lineTo(x, H - PAD.b); ctx.stroke();
      ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center';
      const txt = fmt(t), w = ctx.measureText(txt).width;
      ctx.fillStyle = bg; ctx.globalAlpha = 0.85; ctx.fillRect(x - w / 2 - 3, PAD.t + 1, w + 6, 14); ctx.globalAlpha = 1;
      ctx.fillStyle = c; ctx.fillText(txt, x, PAD.t + 12);
      ctx.font = '11px system-ui, sans-serif';
    }
  }
  // 选中车次标注车次号
  if (sel && TR.includes(sel)) {
    ctx.textAlign = 'left'; ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.lineJoin = 'round'; ctx.strokeStyle = bg; ctx.lineWidth = 3; ctx.fillStyle = css('--sel');
    for (const p of sel.pieces) {
      for (let j = 0; j < p.length; j += 2) {
        const x = X(p[j]), y = Y(p[j + 1]);
        if (x >= PAD.l && x <= W - PAD.r && y >= PAD.t && y <= H - PAD.b) {
          ctx.strokeText(sel.tr.c, x + 4, y - 4);
          ctx.fillText(sel.tr.c, x + 4, y - 4);
          break;
        }
      }
    }
  }
  ctx.restore();
  ctx.strokeStyle = css('--line'); ctx.lineWidth = 1;
  ctx.strokeRect(PAD.l + .5, PAD.t + .5, W - PAD.l - PAD.r - 1, H - PAD.t - PAD.b - 1);
}
