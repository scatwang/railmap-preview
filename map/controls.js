// map.html · 控件：底图透明度、播放与倍速、时间轴、“现在”、键盘、动画循环
// 经典脚本（非 module），与其它 map/*.js 共享全局作用域，加载顺序见 map.html
$('baseop').value = baseOpacity;
$('baseop').oninput = e => { setBaseOpacity(+e.target.value);
  try { localStorage.setItem('railmap.baseOpacity2', e.target.value); } catch (err) {} };
$('baseop').onchange = e => e.target.blur();

// 按钮、链接点击后不留焦点，免得焦点框留在按钮上、按空格又触发按钮而不是播放/暂停
document.addEventListener('click', e => {
  const el = e.target.closest('button, a');
  if (el) el.blur();
});

// 播放/暂停按钮 + 分段对数速度滑块：
// 两端：最慢 1×（实时速度，1 秒 = 1 秒）、最快 3600×（1 秒 = 1 小时）
// 中间 3 个等距吸附挡：25% = 60×（1 秒 1 分）、50% = 300×（1 秒 5 分，默认）、75% = 1200×（1 秒 20 分）
const SPD_KNOTS = [[0, 1], [0.25, 60], [0.5, 300], [0.75, 1200], [1, 3600]];
const SPD_STEPS = [1, 2, 3, 5, 10, 15, 30, 60, 120, 180, 300, 600, 900, 1200, 1800, 2700, 3600];
const SPD_SNAP_R = 0.04;   // 靠近吸附挡 ±4% 行程自动磁吸
let speed = 300;
function snapU(u) {
  if (u <= 0.015) return 0;
  if (u >= 0.985) return 1;
  for (let i = 1; i < SPD_KNOTS.length - 1; i++) {
    const ku = SPD_KNOTS[i][0];
    if (Math.abs(u - ku) <= SPD_SNAP_R) return ku;
  }
  return u;
}
function uToSpeed(u) {
  u = snapU(u);
  for (let i = 0; i < SPD_KNOTS.length - 1; i++) {
    const [u0, v0] = SPD_KNOTS[i], [u1, v1] = SPD_KNOTS[i + 1];
    if (u <= u1 || i === SPD_KNOTS.length - 2) {
      if (Math.abs(u - u0) < 1e-6) return v0;
      if (Math.abs(u - u1) < 1e-6) return v1;
      const t = (u - u0) / (u1 - u0), raw = v0 * Math.pow(v1 / v0, t);
      return raw < 60 ? Math.max(1, Math.min(60, Math.round(raw))) : Math.max(1, Math.min(60, Math.round(raw / 60))) * 60;
    }
  }
  return 3600;
}
function speedToU(v) {
  v = Math.max(1, Math.min(3600, v));
  for (let i = 0; i < SPD_KNOTS.length - 1; i++) {
    const [u0, v0] = SPD_KNOTS[i], [u1, v1] = SPD_KNOTS[i + 1];
    if (v <= v1 || i === SPD_KNOTS.length - 2) {
      return u0 + (u1 - u0) * Math.log(v / v0) / Math.log(v1 / v0);
    }
  }
  return 1;
}
function fmtSpd(v) {
  if (v <= 1) return '1秒:1秒';
  if (v < 60) return `1秒:${Math.round(v)}秒`;
  if (v >= 3600) return '1秒:1小时';
  return `1秒:${Math.round(v / 60)}分钟`;
}
function setSpeed(v) {
  speed = Math.max(1, Math.min(3600, Math.round(v)));
  $('speed').value = speedToU(speed);
  const label = fmtSpd(speed);
  $('spdval').textContent = label;
  for (const tk of $('spdticks').children) tk.classList.toggle('on', +tk.dataset.v === speed);
  $('spdbox').title = `播放速度 ${label}（${speed}×，↑ ↓ 键调节）· 中间 3 挡吸附：1秒:1分钟 / 1秒:5分钟 / 1秒:20分钟`;
}
function stepSpeed(dir) {
  if (dir > 0) {
    setSpeed(SPD_STEPS.find(v => v > speed) ?? 3600);
  } else {
    for (let i = SPD_STEPS.length - 1; i >= 0; i--) if (SPD_STEPS[i] < speed) { setSpeed(SPD_STEPS[i]); return; }
    setSpeed(1);
  }
}
function setPlay(on, v) {
  if (v) setSpeed(v);
  if (on && !playing && sel && T >= +$('slider').max) jumpT(+$('slider').min);   // 选中列车已播完：从始发重播
  playing = on; last = performance.now();
  const pb = $('playbtn');
  pb.textContent = playing ? '❚❚' : '▶';
  pb.classList.toggle('on', playing);
  pb.title = playing ? '暂停（空格键）' : '播放（空格键）';
  if (!on) writeHash(true);
}
$('playbtn').onclick = e => { e.currentTarget.blur(); setPlay(!playing); };
$('speed').oninput = e => { setSpeed(uToSpeed(+e.target.value)); };
$('speed').onchange = e => e.target.blur();
setSpeed(speed);

function setT(t) { T = t; $('slider').value = t; draw(); saveView(); }
// 选中列车时，滑块只覆盖这趟车：始发前到终到后各留 TERMINAL_DWELL 分钟。
// 跨日：区间按当前数据日的分钟数算，前一天始发的为负，次日到达的超过 1440。拖到当天以外时经 jumpT 切到相邻日期，
// 按（车次，始发日期）接上同一列车；新一天的区间整体平移 1440，滑块的相对位置不变，拖动是连续的。
// 新选中一趟车时，当前时刻不在它的区间里就跳到区间内最近的一端
let sliderKey = '';
function syncSlider() {
  const id = sel ? sel.c + '|' + runOd(sel) : '', key = sel ? id + '|' + dataDate() : '';
  if (key === sliderKey) return;
  const fresh = id !== sliderKey.split('|').slice(0, 2).join('|');
  sliderKey = key;
  const lo = sel ? runT0(sel) - TERMINAL_DWELL : 0, hi = sel ? runT1(sel) + TERMINAL_DWELL : 1440, s = $('slider');
  s.min = lo; s.max = hi; s.value = T; s.classList.toggle('run', !!sel);
  s.title = sel ? `时间轴限定在 ${sel.c} 始发前到终到后` : '';
  if (sel && fresh && !contRoll && !switching && (T < lo || T > hi)) jumpT(Math.min(hi, Math.max(lo, T)));
}
// 时刻表里的时刻可点：跳到该时刻。时刻是当前数据日的分钟数，超出 0–24:00（前一天始发车的头几站、跨夜车的后几站）
// 就切到对应日期，选中的列车按（车次，始发日期）接续
const tm = (v, f) => `<span class="tm" data-t="${v}" title="跳到这个时刻">${f(v)}</span>`;
function jumpT(v, ll) {
  const k = Math.floor(v / 1440);
  if (k === 0 || v === 1440 || !curDate) {
    if (ll) panToPos(ll);
    setT(Math.min(1440, Math.max(0, v)));
    return;
  }
  const t = new Date(curDate + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + k);
  const day = t.toISOString().slice(0, 10), e = dateEntry(day);
  if (!e || !e.selectable || !e.file) {
    if (ll) { follow = false; panToPos(ll); }
    setT(k < 0 ? 0 : 1440);
    return;
  }
  contRoll = true;
  loadDate(day).then(ok => {
    contRoll = false;
    if (!ok && ll) follow = false;
    if (ll) panToPos(ll);
    setT(ok ? v - 1440 * k : (k < 0 ? 0 : 1440));
  });
}
$('slider').oninput = e => { const v = +e.target.value;
  if (v >= 0 && v <= 1440) setT(v); else if (!switching) jumpT(v); };
$('slider').onchange = e => e.target.blur();
// “现在”：切到北京时间的今天、当前时刻，按 1× 实时播放。今天没有可选数据就提示，不动当前日期时刻。
// 选中的列车此刻不在运行区间（时间轴被限定在它始发前到终到后）就取消选中，免得播放立刻停在终到
function flashNow(msg) {
  const b = $('nowbtn'); clearTimeout(b._t); b.textContent = msg; b.disabled = true;
  b._t = setTimeout(() => { b.textContent = '现在'; b.disabled = false; }, 2000);
}
function goNow() {
  if (switching) return;
  const n = new Date(Date.now() + 8 * 3600e3), day = n.toISOString().slice(0, 10);
  const t = () => { const m = new Date(Date.now() + 8 * 3600e3); return m.getUTCHours() * 60 + m.getUTCMinutes() + m.getUTCSeconds() / 60; };
  const go = () => {
    const v = t();
    if (sel && (v < runT0(sel) - TERMINAL_DWELL || v > runT1(sel) + TERMINAL_DWELL)) {
      sel = null; follow = false; if (!selSt && !selLine) $('panel').style.display = 'none';
    }
    setT(v); setPlay(true, 1); writeHash(true);
  };
  if (!DATES || day === curDate) { go(); return; }
  const e = dateEntry(day);
  if (!e || !e.selectable || !e.file) { flashNow('今天无数据'); return; }
  loadDate(day).then(ok => ok ? go() : flashNow('加载失败'));
}
$('nowbtn').onclick = e => { e.currentTarget.blur(); goNow(); };
// 键盘：空格播放/暂停；N 切到现在；W A S D 平移地图（见下方，Shift 加速）；← → 快退/快进（幅度为当前倍速下 5 秒播放的时长，300× 即 25 分钟）；↑ ↓ 加速/减速，按住均可连续调。
// 仅在文本输入框、下拉框聚焦时不拦截；按钮或滑块纵使残留焦点也照常响应快捷键
function handleKey(code, repeat) {
  if (code === 'Space') { if (!repeat) setPlay(!playing); return true; }
  if (code === 'KeyN') { if (!repeat) goNow(); return true; }
  if (code === 'ArrowUp' || code === 'ArrowDown') {
    stepSpeed(code === 'ArrowUp' ? 1 : -1);
    return true;
  }
  if (code === 'ArrowLeft' || code === 'ArrowRight') {
    const step = 5 * speed / 60, lo = +$('slider').min, hi = +$('slider').max;
    if (!switching) jumpT(Math.min(hi, Math.max(lo, T + (code === 'ArrowRight' ? step : -step))));
    return true;
  }
  return false;
}
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest('input:not([type=range]), select, textarea, [contenteditable]')) return;
  if (handleKey(e.code, e.repeat)) {
    e.preventDefault(); e.stopPropagation();              // 捕获阶段拦下，不触发聚焦按钮，也不让 Leaflet 用方向键平移地图
  }
}, true);
{
  // WASD 平移地图（方向键已用于时间/倍速）：按住连续平移，速度随窗口大小，Shift 加速；只认主页面的按键，运行图 iframe 不转发
  const PAN = { KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] }, held = new Set();
  let raf = 0, lastT = 0, fast = false;
  const loop = now => {
    if (!held.size) { raf = 0; return; }
    const dt = Math.min(50, now - lastT) / 1000; lastT = now;
    let dx = 0, dy = 0; for (const k of held) { dx += PAN[k][0]; dy += PAN[k][1]; }
    if (dx || dy) {
      const s = map.getSize(), v = Math.max(400, Math.min(s.x, s.y) * 0.9) * (fast ? 2.5 : 1) * dt, n = Math.hypot(dx, dy);
      if (follow) { follow = false; draw(); }   // 同拖动地图：退出跟随
      map.panBy([dx / n * v, dy / n * v], { animate: false });
    }
    raf = requestAnimationFrame(loop);
  };
  document.addEventListener('keydown', e => {
    if (!PAN[e.code] || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest('input:not([type=range]), select, textarea, [contenteditable]')) return;
    e.preventDefault(); fast = e.shiftKey; held.add(e.code);
    if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(loop); }
  }, true);
  document.addEventListener('keyup', e => { if (PAN[e.code]) held.delete(e.code); fast = e.shiftKey; }, true);
  addEventListener('blur', () => held.clear());
}
addEventListener('message', e => {
  if (e.origin === location.origin && e.data && e.data.type === 'railmap-key') handleKey(e.data.code, e.data.repeat);
});
let last = performance.now();
setPlay(false);
function tick(now) {
  if (playing && !switching) {
    T += (now - last) / 60000 * speed;
    const hi = +$('slider').max;
    if (sel && T >= hi) { setT(hi); setPlay(false); }   // 选中列车：播到终到后停下
    else if (T >= 1440) {                 // 过 24:00：下一天可选就切过去接着播，否则回到当天 0:00
      const nx = curDate && nextDay(curDate), e = nx && dateEntry(nx);
      if (e && e.selectable) { const over = T - 1440; T = 1440; setT(T); contRoll = true;
        loadDate(nx).then(ok => { contRoll = false; setT(ok ? Math.min(over, 1440) : 0); }); }
      else setT(0);
    } else setT(T);
  }
  last = now; requestAnimationFrame(tick);
}
