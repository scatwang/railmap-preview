// map.html · 列车标记绘制：车身形状、涂装 Marker、涂装 / 置灰开关、图例图标、车次标签避让
// 经典脚本（非 module），与其它 map/*.js 共享全局作用域，加载顺序见 map.html
// 车身画成侧视的半边：沿行进方向的对称轴切开只保留左半边（中国国铁左侧行车），
// 底边贴着线路、车头朝前，于是同一线路上的上下行分在线路两侧。
// 两种车身后半段都等高；动车组前半段斜线收成尖头，普速前半段四分之一椭圆收成圆头。
// 尖头（车头占 NP）面积 (1−NP/2)·len·w、圆头（车头占一半）(0.5+π/8)·len·w，尖头整体放大 PK 倍使两者面积相同。
const TRAIN_FONT = '"DIN Alternate", "Bahnschrift", "Roboto Condensed", "Arial Narrow", system-ui, sans-serif';
// 返回标签位置，以及画下半个车身的函数 lower()（复兴号用）、车内写车次的函数 drawText()（z≥12 用）。
function trainShape(ctx, p, back, ahead, size, round, txt, fx, sizeTxt) {
  // 朝向用不取整的投影坐标算：latLngToContainerPoint 会取整到像素，
  // 缩小时前后两点（相距 0.4 km）不足 1 像素，方向会退化成上下左右
  const z = map.getZoom(), b = map.project(back, z), a = map.project(ahead, z);
  let ang = Math.atan2(a.y - b.y, a.x - b.x);
  if (!isFinite(ang) || (a.x === b.x && a.y === b.y)) ang = -Math.PI / 2;
  const NP = 0.65, PK = Math.sqrt((0.5 + Math.PI / 8) / (1 - NP / 2)), k = round ? 1 : PK;
  const c = Math.cos(ang), s = Math.sin(ang);
  const lx = s, ly = -c;                                  // 行进方向的左法向（屏幕坐标 y 向下）
  const sTxt = sizeTxt || txt;
  const fk = sTxt ? 0.2 : 0.5;                            // 车内写字时复兴号金带收窄到底边 20%，给车次留出净空
  let w, len, nose, fs = 0, tw = 0, gh = 0, asc = 0, desc = 0, vc = 0, noseClear = 0;
  if (sTxt) {
    w = size;
    fs = Math.round(w * (fx ? 0.9 : 1.02));               // 车次全是无下伸的大写字母与数字，字号放大让字高撑满车身
    ctx.font = `bold ${fs}px ${TRAIN_FONT}`;
    const m = ctx.measureText(sTxt);
    tw = m.width;
    asc = m.actualBoundingBoxAscent || fs * 0.72;
    desc = m.actualBoundingBoxDescent || 0;
    gh = asc + desc;
    vc = w * (fx ? (fk + 1) / 2 : 0.5);
    const vTop = Math.min(0.95, (vc + gh / 2 + 0.6) / w); // 字框上沿占车高的比例，据此算车头斜面/弧面让开的距离
    nose = w * (round ? 0.92 : 1.25);
    noseClear = round ? nose * (1 - Math.sqrt(Math.max(0, 1 - vTop * vTop))) + 1.2 : nose * vTop + 0.8;
    len = Math.max(w * 1.5, 2.2 + tw + noseClear);
  } else {
    w = size * 0.9 * k;
    len = size * 2 * k;
    nose = len * (round ? 0.5 : NP);                      // 车头长度：尖头更长，角度更尖
  }
  // 锚点在车身轴线上：车内写字时居中略偏后（0.45），平时距车尾 30%
  const ANCHOR = sTxt ? 0.45 : 0.3, tx = p.x - c * len * ANCHOR, ty = p.y - s * len * ANCHOR;
  const P = (u, v) => [tx + c * u + lx * v, ty + s * u + ly * v];   // u 沿车身向前，v 向外
  // 从车尾起笔、在车尾收笔：车头处不出现首尾相接的极短线段（粗描边时会被尖角接头拉出长刺）
  ctx.beginPath();
  ctx.moveTo(...P(0, 0));                                 // 车尾（在线路上）
  ctx.lineTo(...P(0, w));                                 // 车尾外侧角
  ctx.lineTo(...P(len - nose, w));
  if (round) {
    // 椭圆参数角 θ：点 = 中心 + nose·cosθ·前向 − w·sinθ·外法向；θ 从 −π/2（车顶）到 0（车头）
    ctx.ellipse(...P(len - nose, 0), nose, w, ang, -Math.PI / 2, 0);
  } else ctx.lineTo(...P(len, 0));                        // 车头（在线路上）
  ctx.closePath();
  const midX = tx + c * len / 2, midY = ty + s * len / 2;
  return {
    label: { x: midX + lx * (w + 4), y: midY + ly * (w + 4) },     // 车身外侧中点再往外一点
    hit(q, pad = 3) {
      const u = (q.x - tx) * c + (q.y - ty) * s, v = (q.x - tx) * lx + (q.y - ty) * ly;
      return u >= -pad && u <= len + pad && v >= -pad && v <= w + pad;
    },
    lower() {                                             // 下半个车身：v 从 0 到 w·fk
      ctx.beginPath();
      ctx.moveTo(...P(0, 0)); ctx.lineTo(...P(len, 0));
      if (round) ctx.ellipse(...P(len - nose, 0), nose, w, ang, 0, -Math.asin(fk), true);
      else ctx.lineTo(...P(len - nose * fk, w * fk));
      ctx.lineTo(...P(0, w * fk));
      ctx.closePath();
    },
    drawText(color) {
      if (!txt) return;
      const uc = (len - noseClear + 2.2) / 2;
      const [cx, cy] = P(uc, vc);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);                                    // 字底永远贴铁轨一侧（v=0），从车尾读向车头
      ctx.font = `bold ${fs}px ${TRAIN_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = color;
      ctx.fillText(txt, 0, (asc - desc) / 2);             // 按实际字形像素高度垂直居中（不留小写字母下伸空位）
      ctx.restore();
    },
  };
}

// 车型涂装极简色块 Marker：24×12 纯几何轮廓 + 2~3 色块（底边 y=10.5 贴着线路、车头 x=1 朝前，左半侧朝外）。
// 车上写车次（z ≥ 11）采用车尾随字加长方案：完整保留车头风挡与斜切眼罩（x=1..headU），仅将车尾平直段按车次字数自动拉长。
function drawTrainMarker(ctx, p, back, ahead, r, tr, isSel, dim, z, selc, bg, grey, txt, sizeTxt, li) {
  const b = map.project(back, z), a = map.project(ahead, z);
  let ang = Math.atan2(a.y - b.y, a.x - b.x);
  if (!isFinite(ang) || (a.x === b.x && a.y === b.y)) ang = -Math.PI / 2;
  const c = Math.cos(ang), s = Math.sin(ang);
  const lx = s, ly = -c;
  const w = r * 1.05, sy = w / 8, sx = sy;
  // 普速车途中换挂机车（tr.lc 为换挂点列表）时按当前区间 li 取机型，不整趟缓存
  const modelKey = Array.isArray(tr.lc) ? markerModelForTrain(tr, li) : (tr._mk || (tr._mk = markerModelForTrain(tr)));
  const headU = modelKey === 'HXD3D' ? 11.8 : 10.5;
  const sTxt = sizeTxt || txt;
  let extraU = 0;
  if (sTxt) {
    const twU = Math.max(6.8, sTxt.length * 3.35);
    const totalU = Math.max(20, Math.ceil((headU + twU + 2.6) * 2) / 2);
    extraU = +(totalU - 22).toFixed(1);
  }
  const len = (22 + extraU) * sx;
  const ANCHOR = sTxt ? 0.45 : 0.3;
  const tx = p.x - c * len * ANCHOR, ty = p.y - s * len * ANCHOR;
  const P = (u, v) => [tx + c * u + lx * v, ty + s * u + ly * v];
  const m = typeof getMarker2D === 'function' ? getMarker2D(modelKey, extraU) : null;
  if (m) {
    const endX = m.endX || 23;
    ctx.save();
    ctx.transform(-sx * c, -sx * s, -sy * lx, -sy * ly, tx + endX * sx * c + 10.5 * sy * lx, ty + endX * sx * s + 10.5 * sy * ly);
    const invS = 1 / Math.sqrt(sx * sy);
    if (isSel) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3.2 * invS;
      ctx.strokeStyle = selc;
      ctx.stroke(m.bodyPath);
    }
    ctx.fillStyle = dim ? grey : m.baseFill;
    ctx.fill(m.bodyPath);
    if (!dim && z >= 6) {
      ctx.save();
      ctx.clip(m.bodyPath);
      for (const [p2d, col] of m.layers) {
        ctx.fillStyle = col;
        ctx.fill(p2d);
      }
      ctx.restore();
    }
    ctx.lineJoin = 'round';
    ctx.lineWidth = (isSel ? 0.9 : z >= 9 ? 0.72 : 0.55) * invS;
    ctx.strokeStyle = dim ? bg : (css('--tEdge') || '#525c68');
    ctx.stroke(m.bodyPath);
    ctx.restore();

    if (txt) {
      const { txtCol: tc0, haloCol: hc0 } = typeof markerStyleColors === 'function'
        ? markerStyleColors(m.key)
        : { txtCol: '#182230', haloCol: '#f5f6f8' };
      const txtCol = dim ? '#ffffff' : tc0;
      const haloCol = dim ? grey : hc0;
      const fx = (1.4 + (endX - headU)) / 2, fy = 6.5, fsSvg = 6.1, haloW = 1.6;
      const u = (fx - 1) * sx, v = (10.5 - fy) * sy;
      const [cx, cy] = P(u, v);
      const fsPx = Math.max(7, fsSvg * sy);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.font = `900 ${fsPx.toFixed(1)}px ${TRAIN_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = haloW * sy;
      ctx.strokeStyle = haloCol;
      ctx.strokeText(txt, 0, 0.3);
      ctx.fillStyle = txtCol;
      ctx.fillText(txt, 0, 0.3);
      ctx.restore();
    }
  }
  const midX = tx + c * len / 2, midY = ty + s * len / 2;
  return {
    label: { x: midX + lx * (w + 4), y: midY + ly * (w + 4) },
    hit(q, pad = 3) {
      const u = (q.x - tx) * c + (q.y - ty) * s, v = (q.x - tx) * lx + (q.y - ty) * ly;
      return u >= -pad && u <= len + pad && v >= -pad && v <= w + pad;
    },
  };
}

// 涂装开关：默认开启，用户手动切换后记入 cookie（railmap_mk=0/1，一年）；hash 里的 mk= 只影响本次打开，不改 cookie
const MK_COOKIE = 'railmap_mk';
let mkOn = !/(?:^|;\s*)railmap_mk=0(?:;|$)/.test(document.cookie);
$('mkbtn').classList.toggle('on', mkOn);
function setMk(on) {
  mkOn = !!on;
  $('mkbtn').classList.toggle('on', mkOn);
  drawLegend();
  draw();
  writeHash(true);
}
$('mkbtn').onclick = () => {
  setMk(!mkOn);
  try { document.cookie = `${MK_COOKIE}=${mkOn ? 1 : 0}; max-age=31536000; path=/; SameSite=Lax`; } catch (e) {}
};

// 他车置灰全局开关：默认开启，切换后记入 localStorage；hash 里的 dim= 只影响本次打开
const DIM_KEY = 'railmap.dimOthers';
let dimOthers = true;
try { const v = localStorage.getItem(DIM_KEY); if (v !== null) dimOthers = v !== '0'; } catch (e) {}
function setDim(on) {
  dimOthers = !!on;
  draw();
  writeHash(true);
}

// 图例图标：随「涂装」开关切换经典五边形与特征涂装 Marker（车尾在左、车头朝右，底边为线路；涂装模式下普速统一用 HXD3D）
function drawLegend() {
  const mapLv = { S: 'CR400AF', W: 'CRH2A', J: 'CR200J1', ZT: 'HXD3D', K: 'HXD3D', O: 'HXD3D' };
  for (const el of document.querySelectorAll('#legend [data-lv]')) {
    const oldSvg = el.querySelector('svg');
    if (oldSvg) oldSvg.remove();
    const lv = el.dataset.lv;
    if (lv === 'ZT' || lv === 'K' || lv === 'O') {
      el.hidden = mkOn;               // 涂装模式下普速改用下面的“等级 × 电力/内燃”机车图例（#legLoco）
      if (mkOn) continue;
    }
    if (mkOn && typeof emuMarkerSvg === 'function') {
      const m = el.dataset.fx ? 'CR400BF' : (mapLv[lv] || 'CR400AF');
      el.insertAdjacentHTML('afterbegin', emuMarkerSvg(m, 1, true));
    } else {
      const emu = EMU.has(lv);
      const body = emu ? 'M1,10.5 L23,10.5 L8.7,2.5 L1,2.5 Z' : 'M2,10 L22,10 A10,7 0 0 0 12,3 L2,3 Z';
      const stripe = el.dataset.fx ? '<path d="M1,10.5 L23,10.5 L15.85,6.5 L1,6.5 Z" fill="var(--tGold)"/>' : '';
      el.insertAdjacentHTML('afterbegin', `<svg width="24" height="12" viewBox="0 0 24 12"><path d="${body}" fill="var(--t${lv})"
        stroke="${emu ? 'var(--tEdge)' : 'none'}" stroke-width="0.8"/>${stripe}</svg>`);
    }
  }
  // 涂装模式的普速机车图例：等级 × 电力/内燃（机型取每日数据 loco_defaults，见 docs/15-普速机车示意.md）
  const ll = $('legLoco');
  if (ll) {
    ll.hidden = !mkOn;
    if (mkOn && typeof emuMarkerSvg === 'function') {
      const dflt = window.LOCO_DEFAULTS || { Z: { E: 'HXD1D', D: 'DF11G' }, T: { E: 'HXD3D', D: 'DF11G' },
                                             K: { E: 'SS9G', D: 'DF4D' }, P: { E: 'HXD3C', D: 'DF4B' } };
      const names = { Z: 'Z 直特', T: 'T 特快', K: 'K 快速', P: '普快·其他' };
      ll.innerHTML = Object.keys(names).filter(g => dflt[g]).map(g =>
        `<div title="${names[g]}：电力区段 ${dflt[g].E}，非电区段 ${dflt[g].D}（示意机型，非实际担当）">`
        + emuMarkerSvg(dflt[g].E, 1, true) + emuMarkerSvg(dflt[g].D, 1, true) + names[g] + '</div>').join('')
        + '<div class="lnote">示意机型 · 左电力 右内燃</div>';
    }
  }
}

// 车次标签避让：选中/悬停的先放；默认位置与已放标签（含车站名）重叠时上下交替挪一行，
// 挪开的标签用细线连回车身；普通标签挪 MAX_TRY 次仍无空位就不画，选中的总会画。
// 帧间记忆防抖：
// 1. 左右朝向防抖（SIDE_HYST）：近南北/浅弯处 lab.x ≈ a.p.x 时锁定上一帧左右侧，避免标签整宽横跳；
// 2. 排序防抢位：同优先级下「上帧已显示 > 偏移量 |dy| 小 > 在屏时间久（born 早）」先放，保证原位(dy=0)车次先占座，
//    不会因数组顺序靠后被移位车次误判原位空闲而周期性互换位置；
// 3. 空间迟滞 + 时间防抖：保持旧槽位用宽松边距（KEEP_PAD），选新槽位用标准边距（NEW_PAD），回原位用严格边距（RET_PAD）
//    且须在当前槽位呆满 HOLD_MS、原位连续空出 RETURN_MS 才回位；被迫换位时优先选同侧就近槽位；
// 4. 显隐防闪烁 + 平滑过渡：短暂被挤掉的标签在 GRACE_MS 内保留记忆，恢复显示需连续空出 SHOW_MS；
//    槽位或朝向变化时对相对车身的偏移做指数阻尼平滑（TAU_MS），消除单帧跳变。
let labMem = new Map(), labMemZoom = null, labAnimRaf = 0;
const trMemKey = tr => tr.c + (tr.od ? '@' + tr.od : '');
function drawTrainLabels(ctx, labels) {
  const z = map.getZoom(), now = performance.now();
  const RETURN_MS = 750, HOLD_MS = 450, SHOW_MS = 180, GRACE_MS = 1500, TAU_MS = 80;
  const SIDE_HYST = 3, KEEP_PAD = -1, NEW_PAD = 0.5, RET_PAD = 2;
  if (z !== labMemZoom) { labMem.clear(); labMemZoom = z; }
  for (const [k, v] of labMem) if (now - v.lastSeen > GRACE_MS) labMem.delete(k);
  if (!labels.length) return;
  const tfs = z <= 10 ? 10 : 11, H = tfs + 2, MAX_TRY = 8, placed = stLabelBoxes.slice();
  const hit = b => placed.some(q => b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1]);
  ctx.font = tfs + 'px system-ui'; ctx.textBaseline = 'middle';
  const bg = css('--bg'), fg = css('--fg'), mu = css('--muted');
  const baseCand = [];
  for (let k = 0; k <= MAX_TRY; k++) baseCand.push((k % 2 ? 1 : -1) * Math.ceil(k / 2) * H);   // 0, +H, −H, +2H, −2H …
  for (const it of labels) it.m = labMem.get(it.key = trMemKey(it.a.tr));
  labels.sort((x, y) => x.pri - y.pri
    || ((y.m && y.m.vis ? 1 : 0) - (x.m && x.m.vis ? 1 : 0))
    || ((x.m ? Math.abs(x.m.dy) : 1e9) - (y.m ? Math.abs(y.m.dy) : 1e9))
    || ((x.m ? x.m.born : Infinity) - (y.m ? y.m.born : Infinity)));
  let gliding = false;
  for (const { a, lab, isSel, key, m: old } of labels) {
    const txt = a.tr.c.split('/')[0], w = ctx.measureText(txt).width;
    const sideDx = lab.x - a.p.x;
    const left = old && old.left !== undefined ? (old.left ? sideDx >= -SIDE_HYST : sideDx > SIDE_HYST) : sideDx >= 0;
    const box = (dy, pad = 0) => {
      const x0 = left ? lab.x : lab.x - w, y = lab.y + dy;
      return [x0 - 1 - pad, y - H / 2 - pad, x0 + w + 1 + pad, y + H / 2 + pad];
    };
    let dy, freeSince = null, slotSince = old ? old.slotSince : now;
    if (old && old.vis && !hit(box(old.dy, KEEP_PAD))) {
      dy = old.dy;
      if (dy !== 0 && now - slotSince >= HOLD_MS && !hit(box(0, RET_PAD))) {
        freeSince = old.freeSince ?? now;
        if (now - freeSince >= RETURN_MS) { dy = 0; freeSince = null; slotSince = now; }
      }
    } else {
      const cand = old ? baseCand.slice().sort((d1, d2) =>
        (Math.abs(d1) + 1.15 * Math.abs(d1 - old.dy)) - (Math.abs(d2) + 1.15 * Math.abs(d2 - old.dy))) : baseCand;
      dy = cand.find(d => !hit(box(d, NEW_PAD)));
      if (dy !== undefined && (!old || dy !== old.dy)) slotSince = now;
    }
    if (dy === undefined) {
      if (!isSel) {
        if (old) { old.vis = false; old.showSince = null; old.freeSince = null; old.lastSeen = now; }
        continue;
      }
      dy = old ? old.dy : 0;
    }
    if (!isSel && old && !old.vis) {                        // 刚被挤掉的普通标签需连续空出 SHOW_MS 才重新显示
      const showSince = old.showSince ?? now;
      if (now - showSince < SHOW_MS) {
        old.showSince = showSince; old.dy = dy; old.left = left; old.lastSeen = now;
        continue;
      }
    }
    const targetOx = lab.x - a.p.x, targetOy = lab.y - a.p.y + dy;
    const dt = old && old.vis && old.lastSeen != null ? Math.max(0, now - old.lastSeen) : 999;
    const alpha = (old && old.vis && old.ox !== undefined && dt <= 250) ? (1 - Math.exp(-Math.max(1, dt) / TAU_MS)) : 1;
    let ox = alpha < 1 ? old.ox + (targetOx - old.ox) * alpha : targetOx;
    let oy = alpha < 1 ? old.oy + (targetOy - old.oy) * alpha : targetOy;
    if (Math.hypot(targetOx - ox, targetOy - oy) < 0.2) { ox = targetOx; oy = targetOy; }
    else gliding = true;
    const rx = a.p.x + ox, ry = a.p.y + oy;
    const bTarget = box(dy, 0);
    const rx0 = left ? rx : rx - w, bRender = [rx0 - 1, ry - H / 2, rx0 + w + 1, ry + H / 2];
    placed.push([Math.min(bTarget[0], bRender[0]), Math.min(bTarget[1], bRender[1]),
                 Math.max(bTarget[2], bRender[2]), Math.max(bTarget[3], bRender[3])]);
    labMem.set(key, {
      dy, left, ox, oy, vis: true,
      born: old ? old.born : now,
      slotSince, freeSince, showSince: null, lastSeen: now,
    });
    if (Math.abs(ry - lab.y) >= 1.5) {                      // 引线：车身外侧 → 标签靠车一端
      ctx.beginPath(); ctx.moveTo(lab.x + (left ? -3 : 3), lab.y); ctx.lineTo(rx, ry);
      ctx.lineWidth = 0.8; ctx.strokeStyle = mu; ctx.stroke();
    }
    ctx.textAlign = left ? 'left' : 'right';
    ctx.lineWidth = 3; ctx.strokeStyle = bg; ctx.strokeText(txt, rx, ry);
    ctx.fillStyle = fg; ctx.fillText(txt, rx, ry);
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  if (gliding && !playing && !labAnimRaf) {
    labAnimRaf = requestAnimationFrame(() => { labAnimRaf = 0; draw(); });
  }
}

// 不取整的屏幕坐标：latLngToContainerPoint 会取整到像素，缩小时（z5 一像素约 4 km）
// 每帧移动不足一像素的列车会停几帧再跳一像素，看起来一顿一顿的
function toPx(ll) {
  const q = map.project(ll, map.getZoom()), o = map.getPixelOrigin(), tl = map.containerPointToLayerPoint([0, 0]);
  return L.point(q.x - o.x - tl.x, q.y - o.y - tl.y);
}

let active = [];
