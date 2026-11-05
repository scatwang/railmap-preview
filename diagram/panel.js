// diagram.html · 悬停 / 点击拾取与侧栏时刻表
// 经典脚本（非 module），与其它 diagram/*.js 共享全局作用域，加载顺序见 diagram.html
'use strict';
// ===== 悬停 / 点击 =====
function nearest(mx, my, tol = 6) {
  const t = tAt(mx), k = kAt(my);
  const dt = tol / (W - PAD.l - PAD.r) * (view.t1 - view.t0), dk = tol / (H - PAD.t - PAD.b) * (view.k1 - view.k0);
  let best = null, bd = tol;
  for (const o of TR) {
    if (!dirOk(o)) continue;
    if (o.bb[0] > t + dt || o.bb[1] < t - dt || mapK(o.bb[2]) > k + dk || mapK(o.bb[3]) < k - dk) continue;
    for (const p of o.pieces) for (let j = 2; j < p.length; j += 2) {
      const t0 = p[j - 2], t1 = p[j];
      if (Math.max(t0, t1) < t - dt || Math.min(t0, t1) > t + dt) continue;
      const ax = X(t0), ay = Y(p[j - 1]), bx = X(t1), by = Y(p[j + 1]);
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      const u = l2 ? Math.max(0, Math.min(1, ((mx - ax) * dx + (my - ay) * dy) / l2)) : 0;
      const d = Math.hypot(ax + u * dx - mx, ay + u * dy - my);
      if (d < bd) {
        const dtSeg = t1 - t0, dkSeg = Math.abs(p[j + 1] - p[j - 1]);
        bd = d; best = { o, t: t0 + u * dtSeg, k: p[j - 1] + u * (p[j + 1] - p[j - 1]), kmh: dtSeg > 0 ? dkSeg / (dtSeg / 60) : 0 };
      }
    }
  }
  return best;
}
function between(k) {                      // 里程 k 所在站间
  const st = LINE.st.filter(s => !(s.flag & 2));
  let a = null, b = null;
  for (const s of st) { if (s.km <= k + 0.3) a = s; if (s.km >= k - 0.3 && !b) b = s; }
  if (a && b && a === b) return `${a.name}`;
  return `${a ? a.name : '?'} – ${b ? b.name : '?'}`;
}

// ===== 侧栏 =====
function trainSpan(tr) {
  let km = 0;
  for (const l of tr.l) if (l && l[3] > 0) km += l[3];
  const t0 = tr.s[0][2] ?? tr.s[0][1], z = tr.s[tr.s.length - 1], t1 = z[1] ?? z[2];
  const dt = Math.round(t1 - t0), h = Math.floor(dt / 60), m = dt % 60;
  const dur = dt > 0 ? (h ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m`) : '';
  return [km > 0 ? `${Math.round(km)} km` : '', dur].filter(Boolean).join(' · ');
}
function sidePanel() {
  const side = $('side');
  if (!LINE) { side.innerHTML = '<div class="note">选一条客里表线路，查看该线当日运行图。</div>'; return; }
  const counts = {};
  for (const o of TR) counts[o.cls] = (counts[o.cls] || 0) + 1;
  const e = dateEntry(curDate) || {};
  const cutsKm = kmTxt(CUTS.reduce((a, [x, y]) => a + y - x, 0));
  const cutsAll = CUTS.map(([x, y]) => `${kmTxt(x)}–${kmTxt(y)}`).join('、');
  const cutsBrief = CUTS.slice(0, 2).map(([x, y]) => `${kmTxt(x)}–${kmTxt(y)}`).join('、') + (CUTS.length > 2 ? ' 等' : '');
  let html = `<h3>${LINE.ln.n}${zx ? ` <span class="note">支线 ${zx}</span>` : ''} <span class="note">${LINE.ln.p ? `· ${LINE.ln.p} · ` : '· '}全长 ${LINE.ln.len ?? '?'} km · 经过 ${TR.length} 趟</span></h3>
    <div class="note ln-meta">${CLASSES.filter(([k]) => counts[k]).map(([k, n]) => `${n} ${counts[k]}`).join(' · ')} · 下行 ${TR.filter(o => o.dir === 'down').length} · 上行 ${TR.filter(o => o.dir === 'up').length}${$('dir').value ? `（只看${$('dir').value === 'down' ? '下行' : '上行'}）` : ''}</div>
    ${e.prev_inferred || D.prev_inferred ? '<div class="note warn ln-meta">凌晨在途的前一两天始发车为推定</div>' : ''}
    ${LINE.nLL < LINE.st.length ? `<div class="note ln-meta">本线 ${LINE.st.length} 站中 ${LINE.nLL} 站有坐标 <span class="more" title="无客运停站的线路所等没有坐标，不参与定位">详情...</span></div>` : ''}
    ${CUTS.length ? `<div class="note ln-meta">✂ 数据对不上 ${CUTS.length} 段共 ${cutsKm} km（${cutsBrief}） · <span class="more" title="剪口段：${cutsAll} km。多数车在这些段画不出来（OSM 线名或走向与客里表不一致），图上画成灰色斜纹带，两侧运行线按直线用细虚线接上（斜率为两端之间的平均速度）。">详情...</span></div>` : ''}`;
  if (sel) {
    const tr = sel.tr, S = tr.s;
    const sh = tr.od && curDate ? Math.round((Date.parse(curDate) - Date.parse(tr.od)) / 864e5) * 1440 : 0, f = v => fmtH(v + sh);
    const onLine = new Set(LINE.st.map(s => s.name));
    const span = trainSpan(tr);
    const emu = emuTag(tr, true);
    html += `<div class="tr-hd" style="border-top:1px solid var(--line);margin-top:8px;padding-top:8px">
      <h3><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--c${sel.cls})"></span>${tr.c}
        <span style="margin-left:auto;display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:normal">
          <a id="onmap" title="在地图上高亮这趟车">地图${EXT_SVG}</a>
          <a id="unsel" class="note" title="取消选中" style="color:var(--muted)">✕</a>
        </span>
      </h3>
      <div class="od">${S[0][0]} → ${S[S.length - 1][0]}<span class="note">${[span, tr.od ? `${tr.od.slice(5)} 始发${tr.inf ? '（推定）' : ''}` : ''].filter(Boolean).join(' · ')}</span></div>
      ${emu ? `<div class="emu-row">${emu}</div>` : ''}
    </div>
    <div class="tw"><table><thead><tr><th>车站</th><th class="num">到</th><th class="num">发</th><th class="num">停</th></tr></thead><tbody>${S.map((x, i) => {
      const beg = i === 0, end = i === S.length - 1;
      const dw = !beg && !end && x[1] != null && x[2] != null ? Math.round(x[2] - x[1]) : 0;
      const dwTxt = beg ? '<span class="note">始发</span>' : end ? '<span class="note">终到</span>' : dw > 0 ? dw + "'" : '';
      const row = `<tr class="${onLine.has(x[0]) ? '' : 'off'}" data-stop="${i}"><td><a data-pan="${x[0]}" title="跳到${x[0]}${beg ? '发车' : '停车'}时刻并定位地图">${x[0]}</a></td><td class="num">${!beg && x[1] != null ? tm(x[1], f) : ''}</td><td class="num">${!end && x[2] != null ? tm(x[2], f) : ''}</td><td class="num">${dwTxt}</td></tr>`;
      const ws = ((tr.l[i] && tr.l[i][5]) || []).filter(w => w[2] > w[1] + 0.05);
      return row + ws.map((w, wi) => {
        const wdw = Math.max(1, Math.round(w[2] - w[1]));
        const why = (w[5] || '推断：图定时分比正常运行多出的时间按途中停车处理').replace(/"/g, '&quot;');
        const wSt = w[3] ? `<a data-pan="${w[3]}" title="跳到${w[3]}停车时刻并定位地图">${w[3]}</a>` : w[3];
        return `<tr class="wait" data-stop="${i}" data-wait="${wi}" title="${why}"><td>↳ ${wSt} <span class="note">${w[4]}</span></td><td class="num">${tm(w[1], f)}</td><td class="num">${tm(w[2], f)}</td><td class="num">${wdw}'</td></tr>`;
      }).join('');
    }).join('')}</tbody></table></div>
    <div class="foot"><span>灰色非本线 · ↳ 斜体推定待避</span><span class="more" title="灰色行为不在本线的停站；斜体行为推定途中待避（鼠标悬停该行可看推定依据）。路径与线上位置均为推断结果。">详情...</span></div>`;
  } else {
    html += `<div class="note" style="margin-top:10px;line-height:1.5">点击图上的运行线查看该车次时刻表。虚线水平段为推定待避停车；线头小圈为列车在站间出入本线（右侧标注去向）。</div>
      <div class="foot" style="margin-top:auto"><span>含前两日始发在途车 · 位置为推断结果</span><span class="more" title="站间位置按运动学推算（起停加减速、线路限速，按时刻表校准）；路径与线上位置均为推断结果。">详情...</span></div>`;
  }
  side.classList.toggle('has-sel', !!(LINE && sel));
  side.innerHTML = html;
  const tw = side.querySelector('.tw'), firstOn = tw && tw.querySelector('tbody tr:not(.off):not(.wait)');
  if (tw && firstOn) {
    const hh = tw.querySelector('thead').offsetHeight, wr = tw.getBoundingClientRect(), rr = firstOn.getBoundingClientRect();
    tw.scrollTop = Math.max(0, rr.top - wr.top - hh - 24);
  }
  const u = $('unsel'); if (u) u.onclick = () => { sel = null; wantSel = null; writeHash(); sidePanel(); draw(); };
  const m = $('onmap'); if (m) m.onclick = () => showTrainOnMap(sel.tr);
  side.querySelectorAll('tr[data-stop]').forEach(rowEl => rowEl.onclick = ev => {
    if (!sel) return;
    const tr = sel.tr, i = +rowEl.dataset.stop, wi = rowEl.dataset.wait != null ? +rowEl.dataset.wait : null;
    const tEl = ev.target.closest('[data-t]'), panEl = ev.target.closest('a[data-pan]');
    const ws = wi != null ? ((tr.l[i] && tr.l[i][5]) || []).filter(w => w[2] > w[1] + 0.05) : null;
    const w = ws ? ws[wi] : null, x = tr.s[i];
    const t = tEl ? +tEl.dataset.t : w ? (w[1] ?? w[2]) : (x ? (i > 0 && x[1] != null ? x[1] : x[2]) : null);
    const name = w ? w[3] : (x && x[0]), ll = stopLonLat(tr, i, wi);
    if (t != null && isFinite(t)) {
      mapT = { t: ((t % 1440) + 1440) % 1440, date: curDate };
      if (t < view.t0 || t > view.t1) { const s = (view.t1 - view.t0) / 2; view.t0 = t - s; view.t1 = t + s; }
      draw();
    }
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'railmap-stop', name, ll, t, code: tr.c.split('/')[0], od: tr.od || null, i, wi }, location.origin);
    } else if (panEl && name) {
      const code = tr.c.split('/')[0], tMod = t != null && isFinite(t) ? Math.round(((t % 1440) + 1440) % 1440) : null;
      window.open(`map.html#${curDate ? 'date=' + curDate + '&' : ''}train=${encodeURIComponent(code)}${tr.od ? '&od=' + tr.od : ''}${tMod != null ? '&t=' + tMod : ''}${ll ? `&loc=${ll[1].toFixed(4)},${ll[0].toFixed(4)},10` : '&z=10'}`, 'railmap-map');
    }
  });
}
