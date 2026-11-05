// map.html · 车次 / 车站面板、当前所在线路、点击拾取
// 经典脚本（非 module），与其它 map/*.js 共享全局作用域，加载顺序见 map.html
// 同一车次可能有多列在途（D、D−1、D−2 日始发的不同车底）：优先当前时刻在跑的，
// 其次最近要发车的，再次当日始发的
// 一列车的身份是（车次，始发日期）：tr.od 为前一两天始发的日期，当日始发的没有 od
const dataDate = () => D.date || curDate;     // 用数据自带日期：切日期时 curDate 先变，旧数据的 od 仍要按旧日期算
const runOd = tr => tr.od || dataDate();
const runsOf = code => D.trains.filter(t => t.c.split('/').includes(code));
// 该列车时刻相对其始发日的平移（分钟）：时刻表按始发日显示，次日写 ⁺1
const runShift = tr => tr.od ? Math.round((Date.parse(dataDate()) - Date.parse(tr.od)) / 864e5) * 1440 : 0;
const runT0 = tr => tr.s[0][2] ?? tr.s[0][1], runT1 = tr => { const z = tr.s[tr.s.length - 1]; return z[1] ?? z[2]; };
const runStatus = tr => T < runT0(tr) - TERMINAL_DWELL ? '未发车' : T > runT1(tr) + TERMINAL_DWELL ? '已到达' : '运行中';
function findRun(code, od) {
  const runs = runsOf(code);
  if (od) { const r = runs.find(tr => runOd(tr) === od); if (r) return r; }
  const t0 = tr => tr.s[0][2] ?? tr.s[0][1], t1 = tr => { const z = tr.s[tr.s.length - 1]; return z[1] ?? z[2]; };
  return runs.find(tr => t0(tr) <= T && T <= t1(tr) + TERMINAL_DWELL)
    || runs.filter(tr => t0(tr) > T).sort((a, b) => t0(a) - t0(b))[0]
    || runs.find(tr => !tr.od) || runs[0] || null;
}

// 车站面板：当天（0:00–24:00）全部到发，含前一两天始发、当天在此到发的车。
// 行多（大站上千行），按“车站 + 日期 + 整分钟”缓存，同一分钟内不重绘；保留滚动位置，新打开时滚到当前时刻
let stPanelKey = null;
const evDep = e => e.end ? e.a ?? e.d : e.d ?? e.a;
function stationPanel() {
  const st = selSt, key = st.name + '|' + dataDate() + '|' + Math.floor(T) + '|' + (kbSubOpen ? 1 : 0);
  if (key === stPanelKey) return;
  const fresh = !stPanelKey || stPanelKey.split('|')[0] !== st.name || stPanelKey.split('|')[1] !== dataDate();
  stPanelKey = key;
  const rows = st.ev.filter(e => (e.d ?? e.a) >= 0 && (e.a ?? e.d) < 1440)
    .sort((x, y) => evDep(x) - evDep(y) || x.tr.c.localeCompare(y.tr.c));   // 按发车时刻；终到的车按到达时刻排在其中
  const pn = $('panel'), tw0 = pn.querySelector('.tw'), top = tw0 ? tw0.scrollTop : 0;
  pn.style.display = 'flex';
  const kl = KBST[st.name] || [];
  const code = st.code || (kl.find(r => r.code) || {}).code || '';
  const ju = (kl.find(r => r.ju) || {}).ju || '';
  const lim = [...new Set(kl.flatMap(r => [...(r.lim || '')]))].join('');
  const tags = [];
  if (code) tags.push(`<span class="tag" title="车站电报略号 ${code}">${code}</span>`);
  if (ju) tags.push(`<span class="tag" title="所属铁路局集团公司">${ju}</span>`);
  if (st.ele != null) tags.push(`<span class="tag" title="车站海拔">${st.ele} m</span>`);
  if (lim) tags.push(`<span class="tag kb-lim" title="客里表营业办理限制">${[...lim].map(c => `<span title="${KB_LIM[c] || c}">${c}</span>`).join('')}</span>`);
  const kbSum = !kbSubOpen && kl.length ? `<span class="kb-sum">· ${kl.map(r => KB.lines[r.lid].n).join('、')}</span>` : '';
  const linesHtml = kl.length ? `<button type="button" class="kb-bar${kbSubOpen ? ' open' : ''}" data-kb-toggle="1" title="${kbSubOpen ? '收起客里表所属线路' : '展开客里表所属线路'}"><span class="kb-l">${CHEV_R_SVG}<span>客里表线路</span>${kbSum}</span><span class="kb-cnt">${kl.length} 条</span></button>${kbSubOpen ? `<table class="kb-sub"><thead><tr><th>客里表线路</th><th class="num" title="距该线起始站里程 (km)">自首站</th><th class="num" title="距该线终点站里程 (km)">自末站</th></tr></thead><tbody>
    ${kl.map(r => `<tr><td><a data-line="${r.lid}"${r.flag & 1 ? ' class="jsz" title="该站为此线接算站"' : ''}>${KB.lines[r.lid].n}${r.zx ? `（支${r.zx}）` : ''}</a>${r.flag & 2 ? '<span class="kb-Post" title="线路所">*</span>' : ''}</td><td class="num">${r.d0 ?? (r.km != null ? Math.round(r.km * 10) / 10 : '')}</td><td class="num">${r.d1 ?? ''}</td></tr>`).join('')}</tbody></table>` : ''}` : '';
  pn.innerHTML = `<span class="x" id="close">✕</span><h3>${dn(st.name)}${tags.join('')}</h3>
    ${linesHtml}
    <div class="note" style="margin-top:2px">当天到发 ${rows.length} 趟</div>
    <div class="tw"><table><thead><tr><th>车次</th><th class="num">到</th><th class="num">发</th><th>始发 → 终到</th></tr></thead><tbody>
    ${rows.map((e, idx) => { const S = e.tr.s, past = (e.d ?? e.a) < T, cur = (e.a ?? e.d) <= T && T <= (e.d ?? e.a);
      return `<tr class="${cur ? 'cur' : past ? 'past' : ''}" data-i="${idx}"><td><a href="#">${e.tr.c.split('/')[0]}</a>${e.tr.od ? `<span class="tag" title="${e.tr.od} 始发">${e.tr.od.slice(5)}</span>` : ''}${e.wait ? `<span class="tag" title="${(e.why || e.wait).replace(/"/g, '&quot;')}">${e.wait.startsWith('技术停车') ? '技术停车' : e.wait}</span>` : ''}</td>
        <td class="num">${e.a != null && !e.beg ? tm(e.a, fmtH) : '<span class="note">始发</span>'}</td><td class="num">${e.d != null && !e.end ? tm(e.d, fmtH) : '<span class="note">终到</span>'}</td>
        <td class="main" title="${S[0][0]} → ${S[S.length - 1][0]}">${S[0][0]} → ${S[S.length - 1][0]}</td></tr>`; }).join('')}</tbody></table></div>
    ${rows.length ? '' : '<div class="note" style="margin-top:6px">当天没有到发列车</div>'}
    <div class="foot"><span>含前两日始发、当日途经的车</span><span class="more" title="点击车次可在地图上高亮追踪该列车；点击时刻可跳转到该时刻；点击客里表线路可查看整条线路车站与里程表（红下划线表示该站为该线接算站）。">详情...</span></div>`;
  // 当前时刻所在行（第一趟还没开走的车）：新打开时滚到表格中央；之后时刻变化时保持原滚动位置，
  // 这一行跑出可见范围（表头以下）才重新滚到中央，手动滚动看别的时段不会被一直拽回来，除非时刻在走
  const tw = pn.querySelector('.tw'), r = tw.querySelector('tr[data-i]:not(.past)');
  tw.scrollTop = fresh ? 0 : top;
  if (r) {
    const hh = tw.querySelector('thead').offsetHeight, wr = tw.getBoundingClientRect(), rr = r.getBoundingClientRect();
    if (fresh || rr.top < wr.top + hh || rr.bottom > wr.bottom)
      tw.scrollTop += rr.top - wr.top - hh - (tw.clientHeight - hh - rr.height) / 2;
  }
  $('close').onclick = () => { selSt = null; $('panel').style.display = 'none'; draw(); };
  for (const tr of $('panel').querySelectorAll('tr[data-i]')) tr.onclick = ev => { ev.preventDefault();
    if (ev.target.closest('[data-t]')) return;              // 点的是时刻：只跳时间（pointerdown 里已处理）
    sel = rows[+tr.dataset.i].tr; selSt = null; draw(); };   // 直接取该行那一列（不按车次号查，避免选到另一天始发的同车次）
}

// 当前所在线路（map.py 输出的 glines：每条几何的 [起点里程比例, 线路名下标, 主要限速]；共线段按当前区间两端车站归属修正）
function lineAt(tr, st) {
  const leg = st && tr.l[st.li], segs = leg && D.glines && D.glines[leg[0]];
  if (!segs || !segs.length) return null;
  const f = leg[3] > 0 ? st.km / leg[3] : 0;
  let g = segs[0];
  for (const x of segs) if (x[0] <= f + 1e-6) g = x; else break;
  let name = g[1] >= 0 ? D.line_names[g[1]] : null, lid = null;
  const gm = D.gmember && D.gmember[leg[0]];
  if (KB && gm && gm.length && D.member_sets) {
    let m = gm[0];
    for (const x of gm) if (x[0] <= f + 1e-6) m = x; else break;
    const mids = m && m[1] >= 0 ? D.member_sets[m[1]] : null;
    if (mids && mids.length) {
      const li = st.li ?? st.i, a = tr.s[li] && tr.s[li][0], b = tr.s[li + 1] && tr.s[li + 1][0];
      const baseLid = name ? kbLineFor(name, tr, st) : null;
      const baseSt = baseLid && KB.lines[baseLid] ? (KB.lines[baseLid]._stSet ||= new Set(KB.lines[baseLid].st.map(x => x[0]))) : null;
      const baseHits = baseSt ? (baseSt.has(a) ? 1 : 0) + (baseSt.has(b) ? 1 : 0) : 0;
      for (const id of mids) {
        const ln = KB.lines[id]; if (!ln) continue;
        const stSet = ln._stSet || (ln._stSet = new Set(ln.st.map(x => x[0])));
        const hits = (stSet.has(a) ? 1 : 0) + (stSet.has(b) ? 1 : 0);
        if (hits > baseHits && hits >= 2) { lid = String(id); name = ln.osm[0] || ln.n; break; }
      }
      if (!lid && !baseLid) {
        for (const id of mids) {
          const ln = KB.lines[id]; if (!ln) continue;
          const stSet = ln._stSet || (ln._stSet = new Set(ln.st.map(x => x[0])));
          if (stSet.has(a) || stSet.has(b) || mids.length === 1) { lid = String(id); if (!name) name = ln.osm[0] || ln.n; break; }
        }
      }
    }
  }
  return { name, kmh: g[2], lid };
}

function describe(tr, st) {
  const S = tr.s, sh = runShift(tr), f = v => fmtH(v + sh);
  const curEle = showTrEle ? (st.ele ?? (st.moving ? null : (STBY[S[st.i][0]] && STBY[S[st.i][0]].ele))) : null;
  const eleStr = curEle != null ? ` · 海拔 ${curEle} m` : '';
  if (!st.moving) return `停 <b>${S[st.i][0]}</b>${eleStr}，${f(S[st.i][2] ?? S[st.i][1])} 开`;
  const w = ((tr.l[st.i] && tr.l[st.i][5]) || []).find(w => w[2] > w[1] + 0.05 && w[1] <= T && T <= w[2]);   // 途中停车推定
  if (w) return `停 <b>${w[3]}</b>（${w[4] && w[4].startsWith('技术停车') ? w[4] : w[4] + '，推定'}）${eleStr}，${f(w[2])} 开`;
  return `${S[st.i][0]} → ${S[st.i + 1][0]} · <b>${Math.round(st.kmh / 5) * 5} km/h</b>${eleStr} · ${f(S[st.i + 1][1])} 到`;
}
function trainSpan(tr) {
  let km = 0;
  for (const l of tr.l) if (l && l[3] > 0) km += l[3];
  const dt = Math.round(runT1(tr) - runT0(tr)), h = Math.floor(dt / 60), m = dt % 60;
  const dur = dt > 0 ? (h ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m`) : '';
  return [km > 0 ? `${Math.round(km)} km` : '', dur].filter(Boolean).join(' · ');
}
// 同车次各始发日的列车（当前数据里在途或当日始发的），按始发日排；多列并存时显示双行 Tab 切换栏
let panelRuns = [];
const odLabel = d => `${d.slice(5)} 周${'日一二三四五六'[new Date(d + 'T00:00:00Z').getUTCDay()]}`;
function runsHtml(tr) {
  panelRuns = runsOf(tr.c.split('/')[0]).sort((a, b) => runOd(a).localeCompare(runOd(b)));
  if (panelRuns.length <= 1) return '';
  return `<div class="runs">${panelRuns.map((r, i) =>
    `<a class="tab${r === tr ? ' cur' : ''}" data-run="${i}" title="${runOd(r)} 始发车底${r.inf ? '（开行为推定）' : ''}"><span class="t-d">${odLabel(runOd(r))}</span><span class="t-s">${runStatus(r)}${r.inf ? '?' : ''}</span></a>`).join('')}</div>`;
}

let trPanelId = '', trPanelT = -1;
function panel() {
  const st = state(sel, T), S = sel.s;
  const id = sel.c + '|' + runOd(sel) + '|' + dataDate();
  const fresh = id !== trPanelId, tMoved = T !== trPanelT;
  trPanelId = id; trPanelT = T;
  const pn = $('panel'), tw0 = !fresh && pn.querySelector('.tw'), top = tw0 ? tw0.scrollTop : 0;
  pn.style.display = 'flex';
  const sh = runShift(sel), f = v => fmtH(v + sh);
  const runsBar = runsHtml(sel), span = trainSpan(sel);
  const inWait = st && st.moving && ((sel.l[st.i] && sel.l[st.i][5]) || []).some(w => w[2] > w[1] + 0.05 && w[1] <= T && T <= w[2]);
  const ln = lineAt(sel, st), lid = ln && (ln.lid || (ln.name ? kbLineFor(ln.name, sel, st) : null));
  const emu = emuTag(sel, true);
  pn.innerHTML = `<span class="x" id="close">✕</span><h3><span class="kd" style="background:${kindColor(sel)}"></span>${sel.c}${panelRuns.length <= 1 && sel.od ? ` <span class="tag" title="${sel.od} 始发${sel.inf ? '（开行为推定）' : ''}">${sel.od.slice(5)} 始发</span>` : ''}</h3>
    <div class="od-row"><span class="od">${S[0][0]} → ${S[S.length - 1][0]}${span ? `<span class="note">${span}</span>` : ''}</span><span style="display:inline-flex;gap:4px"><a class="cam${showTrEle ? ' on' : ''}" data-tr-ele="1" title="${showTrEle ? '隐藏停站海拔' : '显示停站海拔'}" style="width:auto;padding:0 5px;font-size:11px">海拔</a><a class="cam${!dimOthers ? ' on' : ''}" data-dim="1" title="${dimOthers ? '显示其他列车原色（其他车叠在本车高亮线路之上）' : '正在显示其他列车原色，点击恢复他车置灰（本车高亮线路在上）'}">${EYE_SVG}</a><a class="cam${follow ? ' on' : ''}" data-follow="1" title="${follow ? '正在跟随，再点一次或拖动地图可退出' : '视角跟随该列车'}">${CAM_SVG}</a></span></div>
    ${emu ? `<div class="emu-row">${emu}</div>` : ''}
    ${locoTag(sel, st)}
    ${runsBar}
    <div class="stat"><div>${st ? describe(sel, st) : '<span class="note">当前时刻不在运行</span>'}</div>${ln && ln.name ? `<div class="note">当前线路：${lid ? `<a data-line="${lid}" title="查看客里表：${KB.lines[lid].n}">${ln.name}${EXT_SVG}</a>` : ln.name}${ln.kmh ? ` <span class="tag" title="线路限速 ${ln.kmh} km/h">${ln.kmh}</span>` : ''}</div>` : ''}</div>
    <div class="tw"><table><thead><tr><th>车站</th><th class="num">到</th><th class="num">发</th><th class="num">停</th></tr></thead><tbody>${S.map((x, i) => {
      const beg = i === 0, end = i === S.length - 1;
      const past = (x[2] ?? x[1]) < T, cur = st && !st.moving && st.i === i, next = st && st.moving && !inWait && st.i + 1 === i;
      const dw = !beg && !end && x[1] != null && x[2] != null ? Math.round(x[2] - x[1]) : 0;
      const dwTxt = beg ? '<span class="note">始发</span>' : end ? '<span class="note">终到</span>' : dw > 0 ? dw + "'" : '';
      // 本站到下一站的区间走单线（map.py 每日数据 sgl["起站|止站"] = [单线 km, 说明, 来源]）
      const sgi = !end && D.sgl && D.sgl[x[0] + '|' + S[i + 1][0]];
      const sgTag = sgi ? `<span class="sg" title="${(sgi[1] + '（' + sgSrcTxt(sgi[2]) + '）').replace(/"/g, '&quot;')}">单</span>` : '';
      const stObj = STBY[x[0]];
      const eleTag = showTrEle && stObj && stObj.ele != null ? `<span class="note" style="margin-left:3px;font-size:10.5px" title="车站海拔 ${stObj.ele} m">${stObj.ele}m</span>` : '';
      const stopT = !beg && x[1] != null ? x[1] : x[2];
      const canFocus = stopT != null || stopLatLng(sel, i) != null;
      const row = `<tr class="${cur ? 'cur' : next ? 'next' : past ? 'past' : ''}"${canFocus ? ` data-stop="${i}"` : ''}><td class="main">${canFocus ? `<a data-pan="${x[0]}" title="跳到${x[0]}${beg ? '发车' : '停车'}时刻并定位地图${stObj && stObj.ele != null ? `（海拔 ${stObj.ele} m）` : ''}">${dn(x[0])}</a>` : dn(x[0])}${eleTag}${sgTag}</td><td class="num">${!beg && x[1] != null ? tm(x[1], f) : ''}</td><td class="num">${!end && x[2] != null ? tm(x[2], f) : ''}</td><td class="num">${dwTxt}</td></tr>`;
      // 该站之后区间里的途中停车推定（timetable.waits）：区间记录第 6 项 [[s 比例, 进站, 出站, 站名, 原因, 推定依据], ...]
      const ws = ((sel.l[i] && sel.l[i][5]) || []).filter(w => w[2] > w[1] + 0.05);
      return row + ws.map((w, wi) => { const wc = w[1] <= T && T <= w[2], wp = w[2] < T, wdw = Math.max(1, Math.round(w[2] - w[1]));
        const why = (w[5] || '推断：图定时分比正常运行多出的时间按途中停车处理').replace(/"/g, '&quot;');
        const wstObj = STBY[w[3]];
        const wEleTag = showTrEle && wstObj && wstObj.ele != null ? `<span class="note" style="margin-left:3px;font-size:10.5px" title="车站海拔 ${wstObj.ele} m">${wstObj.ele}m</span>` : '';
        const wSt = w[3] ? `<a data-pan="${w[3]}" title="跳到${w[3]}停车时刻并定位地图${wstObj && wstObj.ele != null ? `（海拔 ${wstObj.ele} m）` : ''}">${dn(w[3])}</a>` : dn(w[3]);
        return `<tr class="wait${wc ? ' cur' : wp ? ' past' : ''}" data-stop="${i}" data-wait="${wi}" title="${why}"><td class="main">↳ ${wSt}${wEleTag} <span class="note">${w[4]}</span></td><td class="num">${tm(w[1], f)}</td><td class="num">${tm(w[2], f)}</td><td class="num">${wdw}'</td></tr>`; }).join(''); }).join('')}</tbody></table></div>
    <div class="foot"><span>↳ 斜体为推定途中停车（悬停该行看详情） · <span class="sg" style="margin-left:0">单</span>该站之后的区间含单线</span><span class="more" title="站间位置按运动学推算（起停加减速、线路限速、运营速度）；图定时分比正常运行（按时刻表校准）多出的部分，推定为途中停车（斜体行：待避、会车或技术停车）；路径与位置均为推断结果。">详情...</span></div>`;
  const tw = pn.querySelector('.tw'), r = tw && tw.querySelector('tr.cur, tr.next');
  if (tw) {
    tw.scrollTop = fresh ? 0 : top;
    if (r && (fresh || tMoved)) {
      const hh = tw.querySelector('thead').offsetHeight, wr = tw.getBoundingClientRect(), rr = r.getBoundingClientRect();
      if (fresh || rr.top < wr.top + hh || rr.bottom > wr.bottom)
        tw.scrollTop += rr.top - wr.top - hh - (tw.clientHeight - hh - rr.height) / 2;
    }
  }
  $('close').onclick = () => { sel = null; $('panel').style.display = 'none'; draw(); };
}

function pick(e) {
  const p = map.mouseEventToContainerPoint(e.originalEvent);
  // 叠放顺序只看选中与停站推挤层序（slot 小的在上面），不随 hover 变，免得悬停重排后在两车交界处来回抖动
  const ord = active.slice().sort((a, b) => (b.tr === sel) - (a.tr === sel) || (a.slot ?? 0) - (b.slot ?? 0));
  for (const a of ord) if (a.hit && a.hit(p, 0)) return a;
  const tch = isTouch();                     // 手指点按：放宽点选半径
  let best = null, bd = tch ? 22 : 10;
  for (const a of ord) { const d = Math.hypot(a.p.x - p.x, a.p.y - p.y); if (d < bd) { bd = d; best = a; } }
  if (best) return best;
  for (const a of ord) if (a.hit && a.hit(p, tch ? 9 : 3)) return a;
  return null;
}
map.on('mousemove', e => {
  if (isTouch()) { $('tip').style.display = 'none'; return; }   // 触屏点按会合成 mousemove：不显示悬停提示，免得提示框留在屏幕上
  const a = pick(e); const h = a && a.tr;
  if (h !== hover) { hover = h; draw(); }
  let pst = null, pbl = null;
  if (a) {
    const tip = $('tip'); tip.style.display = 'block';
    tip.style.left = (e.originalEvent.clientX + 12) + 'px'; tip.style.top = (e.originalEvent.clientY + 12) + 'px';
    tip.innerHTML = `<span class="kd" style="background:${kindColor(a.tr)}"></span><b>${a.tr.c}</b><div class="note">${a.tr.s[0][0]} → ${a.tr.s[a.tr.s.length - 1][0]}</div>`;
  } else if ((pst = pickStation(e))) {
    const tip = $('tip'); tip.style.display = 'block';
    tip.style.left = (e.originalEvent.clientX + 12) + 'px'; tip.style.top = (e.originalEvent.clientY + 12) + 'px';
    const kl = KBST[pst.name] || [];
    const code = pst.code || (kl.find(r => r.code) || {}).code || '';
    const ju = (kl.find(r => r.ju) || {}).ju || '';
    const meta = [code && `-${code}`, ju].filter(Boolean).join(' · ');
    tip.innerHTML = `<b>${dn(pst.name)}</b>${meta ? ` <span class="note">${meta}</span>` : ''} · <span class="note">停靠 ${pst.n} 趟</span>`;
  } else if ((pbl = pickBorderLine(e))) {
    const tip = $('tip'); tip.style.display = 'block';
    tip.style.left = (e.originalEvent.clientX + 12) + 'px'; tip.style.top = (e.originalEvent.clientY + 12) + 'px';
    const span = pbl.fromName ? `${dn(pbl.fromName)} ↔ ${dn(pbl.dirName)}` : `${dn(pbl.dirName)}方向`;
    tip.innerHTML = `<b>${pbl.lineName} · ${dn(pbl.dirName)}方向</b><div class="note">${span}${pbl.lid ? ' · 点击查看线路' : ''}</div>`;
  } else {
    $('tip').style.display = 'none';
  }
  map.getContainer().style.cursor = a || pst || (pbl && pbl.lid) ? 'pointer' : '';
});
