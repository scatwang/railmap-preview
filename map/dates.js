// map.html · 日期清单与按日加载、首屏初始化（最后加载）
// 经典脚本（非 module），与其它 map/*.js 共享全局作用域，加载顺序见 map.html
// ===== 日期：map_dates.json 清单 + 每天一个 map_data_<日期>.json =====
// 清单取不到时回退到单文件 map_data.json（不显示日期选择）
let DATES = null, curDate = null, switching = false, loadSeq = 0, firstInit = true, dateLoadErr = null;
const dateEntry = d => DATES && DATES.dates.find(x => x.date === d);
const selectable = () => DATES ? DATES.dates.filter(x => x.selectable && x.file) : [];
const nextDay = d => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString().slice(0, 10); };
const WD = '日一二三四五六';
const dateLabel = d => `${d.slice(5)} 周${WD[new Date(d + 'T00:00:00Z').getUTCDay()]}`;
const DICO_CHECK = '<svg viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="7.5" fill="currentColor" fill-opacity="0.16" stroke="currentColor" stroke-width="1.5"/><path d="M5.3 9.3l2.4 2.4 5-5.1" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const DICO_BANG = '<svg viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="7.5" fill="currentColor" fill-opacity="0.16" stroke="currentColor" stroke-width="1.5"/><path d="M9 5.2v4.6M9 12.6h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const fmtN = v => v == null ? '—' : Number(v).toLocaleString('zh-CN');
const pctStr = (a, b, dp = 1) => b > 0 && a != null ? `${(a / b * 100).toFixed(dp)}%` : '—';

function computeLiveMetrics() {
  if (!D || !D.trains || D.split) return null;
  if (D._liveMetrics && (D._liveMetricsKb || !KB)) return D._liveMetrics;
  const glines = D.glines || [], gmember = D.gmember || [], lnames = D.line_names || [];
  const geomAba = new Uint8Array(glines.length), geomKb = new Uint8Array(glines.length);
  let kbSet = null;
  if (KB && KB.lines) {
    kbSet = new Set();
    for (const ln of Object.values(KB.lines)) for (const nm of (ln.osm || [])) kbSet.add(nm);
  }
  const kbLids = kbSet ? new Set(lnames.map((nm, i) => kbSet.has(nm) ? i : -1).filter(i => i >= 0)) : null;
  for (let gi = 0; gi < glines.length; gi++) {
    const gl = glines[gi] || [], seen = new Set();
    let prev = -1, aba = 0, hasKb = 0;
    for (let k = 0; k < gl.length; k++) {
      const lid = gl[k][1];
      if (lid >= 0) {
        if (lid !== prev) { if (seen.has(lid)) aba = 1; seen.add(lid); prev = lid; }
        if (kbLids && kbLids.has(lid)) hasKb = 1;
      }
    }
    if (aba) geomAba[gi] = 1;
    const gm = gmember[gi];
    if (!hasKb && gm) for (let k = 0; k < gm.length; k++) if (gm[k][1] >= 0) { hasKb = 1; break; }
    if (hasKb) geomKb[gi] = 1;
  }
  let trains = 0, overnight = 0, emu_trains = 0, emu_with_model = 0, loco_inferred = 0;
  let legs = 0, waits_total = 0, waits_trains = 0, waits_overtake = 0, waits_cross = 0, waits_tech = 0, pass_calibrated = 0;
  let aba_legs = 0, kb_legs = 0, kb_trains = 0;
  for (const t of D.trains) {
    if (t.od) { overnight++; continue; }
    trains++;
    const h = (t.c || '')[0];
    if ((t.tier && t.tier >= 160) || h === 'G' || h === 'D' || h === 'C' || h === 'S') emu_trains++;
    if (t.m) emu_with_model++;
    else if (t.lc) loco_inferred++;
    let hasW = false, allKb = true, hasLeg = false;
    for (const lg of (t.l || [])) {
      if (!lg) continue;
      hasLeg = true; legs++;
      const gi = lg[0];
      if (geomAba[gi]) aba_legs++;
      if (geomKb[gi]) kb_legs++; else allKb = false;
      if (lg[5]) for (const w of lg[5]) {
        const r = w[4] || '';
        if (r === '通过校准') pass_calibrated++;
        else {
          waits_total++; hasW = true;
          if (r.startsWith('待避')) waits_overtake++;
          else if (r.startsWith('会车')) waits_cross++;
          else if (r.startsWith('技术停车')) waits_tech++;
        }
      }
    }
    if (hasW) waits_trains++;
    if (hasLeg && allKb) kb_trains++;
  }
  D._liveMetrics = {
    trains, overnight, stations: (D.stations || []).length, legs,
    emu_trains, emu_with_model, loco_inferred,
    waits_total, waits_trains, waits_overtake, waits_cross, waits_tech, pass_calibrated,
    aba_legs, ...(kbSet ? { kb_trains, kb_legs } : {}),
    ...(D.sgl ? { single_legs: Object.keys(D.sgl).length } : {}),
  };
  D._liveMetricsKb = !!kbSet;
  return D._liveMetrics;
}

function renderDateBox() {
  if (!DATES) { $('datebox').style.display = 'none'; return; }
  $('datebox').style.display = '';
  const sel_ = $('date');
  sel_.innerHTML = DATES.dates.map(x => {
    const ok = x.selectable && x.file;
    const txt = `${dateLabel(x.date)}${ok ? (x.trains != null ? ` · ${x.trains} 趟` : '') : `（${x.reason || '无数据'}）`}`;
    return `<option value="${x.date}"${ok ? '' : ' disabled'} title="${ok ? '' : (x.reason || '无数据')}">${txt}</option>`;
  }).join('');
  sel_.value = curDate || '';
  const ss = selectable(), i = ss.findIndex(x => x.date === curDate);
  $('dprev').disabled = i <= 0; $('dnext').disabled = i < 0 || i >= ss.length - 1;
  renderDateInfo();
}

function renderDateInfo() {
  const e = (curDate && dateEntry(curDate)) || {};
  const m = { ...(e.metrics || {}), ...(computeLiveMetrics() || {}) };
  const n = m.trains ?? e.trains ?? (D && D.trains ? D.trains.filter(t => !t.od).length : null);
  const partial = (e.list_status || (D && D.list_status)) === 'partial';
  const failedN = e.list_failed || 0;
  const miss = e.missing_schedules ?? (D && D.missing && D.missing.no_schedule) ?? 0;
  const noPath = e.no_path ?? (D && D.missing && D.missing.no_path) ?? 0;
  const prevInf = !!(e.prev_inferred ?? (D && D.prev_inferred));

  const issues = [];
  if (dateLoadErr) issues.push({ lv: 'err', text: dateLoadErr });
  if (e.selectable === false) issues.push({ lv: 'err', text: e.reason || '该日期不可用' });
  if (partial || failedN > 0) {
    issues.push({
      lv: failedN >= 5 ? 'err' : 'warn',
      text: `车次列表不完整${failedN ? ` · ${failedN} 个车次搜索前缀失败` : ''}`,
    });
  }
  if (miss > 0) {
    issues.push({
      lv: (e.missing_ratio >= 0.05 || miss >= 100) ? 'err' : 'warn',
      text: `缺停站时刻表 ${fmtN(miss)} 趟${e.missing_ratio != null ? `（${(e.missing_ratio * 100).toFixed(1)}%）` : ''}`,
    });
  }
  if (noPath > 0) {
    issues.push({ lv: noPath >= 20 ? 'err' : 'warn', text: `${fmtN(noPath)} 趟车无法定位路径，未绘制` });
  }
  if (prevInf) {
    issues.push({ lv: 'warn', text: '凌晨跨夜在途车为推定（沿用当天开行名单）' });
  }
  if (m.emu_trains > 0 && m.emu_with_model != null) {
    const emuCov = m.emu_with_model / m.emu_trains;
    if (emuCov < 0.5) issues.push({ lv: 'err', text: `动车组实际编组/车型数据缺失（覆盖率 ${(emuCov * 100).toFixed(1)}%）` });
    else if (emuCov < 0.85) issues.push({ lv: 'warn', text: `部分动车组缺少实际编组/车型数据（覆盖率 ${(emuCov * 100).toFixed(1)}%）` });
  }
  for (const x of e.notes || []) {
    if (x.includes('车次搜索前缀失败') || x.includes('无法定位路径')) continue;
    issues.push({ lv: 'warn', text: x });
  }

  const lv = issues.some(x => x.lv === 'err') ? 'err' : issues.length > 0 ? 'warn' : 'ok';
  const el = $('dinfo');
  el.className = lv;
  el.innerHTML = lv === 'err' ? DICO_BANG : DICO_CHECK;
  el.removeAttribute('title');

  const dtStr = curDate ? `${curDate} 周${WD[new Date(curDate + 'T00:00:00Z').getUTCDay()]}` : (D && D.date) || '当期数据';
  const badgeTxt = lv === 'ok' ? '✓ 数据正常' : lv === 'warn' ? '✓ 轻微问题' : '! 存在异常';
  const issueBox = issues.length
    ? `<div class="dp-issues ${lv}">${issues.map(x => `<div>• ${x.text}</div>`).join('')}</div>`
    : `<div class="dp-issues ok"><div>✓ 车次列表、停站时刻表与跨夜在途车均完整</div></div>`;

  const rows1 = [];
  if (n != null) {
    rows1.push(`<div class="dp-row"><span class="dp-k">开行车次</span><span class="dp-v">${fmtN(n)} 趟${m.overnight != null ? ` <span class="dp-sub">（+跨夜 ${fmtN(m.overnight)} 趟 · ${fmtN(m.stations)} 站）</span>` : ''}</span></div>`);
  }
  if (m.emu_with_model != null && n != null) {
    rows1.push(`<div class="dp-row"><span class="dp-k">实际编组/车型</span><span class="dp-v">${fmtN(m.emu_with_model)} / ${fmtN(n)} 趟 <span class="dp-sub">（动车组 ${pctStr(m.emu_with_model, m.emu_trains)}）</span></span></div>`);
  }
  if (m.loco_inferred != null) {
    rows1.push(`<div class="dp-row"><span class="dp-k">普速推断机车</span><span class="dp-v">${fmtN(m.loco_inferred)} 趟 <span class="dp-sub">（按电气化与等级）</span></span></div>`);
  }

  const rows2 = [];
  if (m.waits_total != null) {
    rows2.push(`<div class="dp-row"><span class="dp-k">推导途中停车</span><span class="dp-v">${fmtN(m.waits_total)} 次 <span class="dp-sub">（涉及 ${fmtN(m.waits_trains)} 趟列车）</span></span></div>`);
    rows2.push(`<div class="dp-row"><span class="dp-k">停车原因分布</span><span class="dp-v"><span class="dp-sub">待避</span> ${fmtN(m.waits_overtake)} · <span class="dp-sub">会车</span> ${fmtN(m.waits_cross)} · <span class="dp-sub">技术停</span> ${fmtN(m.waits_tech)}</span></div>`);
  }
  if (m.pass_calibrated != null) {
    rows2.push(`<div class="dp-row"><span class="dp-k">通过时刻校准</span><span class="dp-v">${fmtN(m.pass_calibrated)} 次 <span class="dp-sub">（越行时间窗约束）</span></span></div>`);
  }

  const rows3 = [];
  if (m.kb_trains != null && n != null) {
    rows3.push(`<div class="dp-row"><span class="dp-k">客里表线路覆盖</span><span class="dp-v">${fmtN(m.kb_trains)} / ${fmtN(n)} 趟 <span class="dp-sub">（${pctStr(m.kb_trains, n)} · 区间 ${pctStr(m.kb_legs, m.legs)}）</span></span></div>`);
  }
  if (m.kb_rerouted != null && m.legs != null) {
    rows3.push(`<div class="dp-row"><span class="dp-k">客里表事后纠偏</span><span class="dp-v">${fmtN(m.kb_rerouted)} / ${fmtN(m.legs)} 段 <span class="dp-sub">（初算一致 ${pctStr(m.legs - m.kb_rerouted, m.legs)}）</span></span></div>`);
  }
  if (m.aba_legs != null && m.legs != null) {
    rows3.push(`<div class="dp-row"><span class="dp-k">离线上线跳线 (A→B→A)</span><span class="dp-v">${fmtN(m.aba_legs)} / ${fmtN(m.legs)} 段 <span class="dp-sub">（${pctStr(m.aba_legs, m.legs, 2)}）</span></span></div>`);
  }
  if (m.sharp_turn_legs != null && m.legs != null) {
    rows3.push(`<div class="dp-row"><span class="dp-k">区间内 ≥135° 折返</span><span class="dp-v">${fmtN(m.sharp_turn_legs)} / ${fmtN(m.legs)} 段 <span class="dp-sub">（${pctStr(m.sharp_turn_legs, m.legs, 2)}）</span></span></div>`);
  }
  if (m.single_legs != null) {
    rows3.push(`<div class="dp-row"><span class="dp-k">单线运行区间</span><span class="dp-v">${fmtN(m.single_legs)} 段${m.single_conflicts != null ? ` <span class="dp-sub">（残余冲突 ${fmtN(m.single_conflicts)} 处）</span>` : ''}</span></div>`);
  }

  $('dpop').innerHTML = `<div class="dp-hd"><span class="dp-dt">${dtStr}</span><span class="dp-badge ${lv}">${badgeTxt}</span></div>`
    + issueBox
    + (rows1.length ? `<div class="dp-sec">列车与编组</div>${rows1.join('')}` : '')
    + (rows2.length ? `<div class="dp-sec">运行图推导</div>${rows2.join('')}` : '')
    + (rows3.length ? `<div class="dp-sec">寻路与路网质量指标</div>${rows3.join('')}` : '');
}

let dpopTimer = null;
function showDpop() {
  clearTimeout(dpopTimer);
  const pop = $('dpop'), r = $('dinfo').getBoundingClientRect();
  if (!r.width && !r.height) return;
  pop.classList.add('open');
  const pw = pop.offsetWidth || 308;
  const left = Math.max(8, Math.min(r.left + r.width / 2 - 36, innerWidth - pw - 8));
  pop.style.left = left + 'px';
  pop.style.bottom = (innerHeight - r.top + 8) + 'px';
}
function hideDpop(delay = 120) {
  clearTimeout(dpopTimer);
  dpopTimer = setTimeout(() => $('dpop').classList.remove('open'), delay);
}
$('dinfo').addEventListener('mouseenter', () => { if (!isTouch()) showDpop(); });
$('dinfo').addEventListener('mouseleave', () => { if (!isTouch()) hideDpop(120); });
$('dinfo').addEventListener('focus', () => { if (!isTouch()) showDpop(); });   // 触屏：只认点按开合（聚焦 + click 会先开后关）
$('dinfo').addEventListener('blur', () => { if (!isTouch()) hideDpop(120); });
$('dinfo').addEventListener('click', e => {
  e.stopPropagation();
  if ($('dpop').classList.contains('open')) $('dpop').classList.remove('open'); else showDpop();
});
$('dpop').addEventListener('mouseenter', () => clearTimeout(dpopTimer));
$('dpop').addEventListener('mouseleave', () => { if (!isTouch()) hideDpop(120); });
document.addEventListener('pointerdown', e => {
  if ($('dpop').classList.contains('open') && !e.target.closest('#dpop, #dinfo')) $('dpop').classList.remove('open');
});
$('date').onchange = e => { e.target.blur(); loadDate(e.target.value); };
const stepDate = k => { const ss = selectable(), i = ss.findIndex(x => x.date === curDate), j = i + k;
  if (i >= 0 && j >= 0 && j < ss.length) loadDate(ss[j].date); };
$('dprev').onclick = () => stepDate(-1);
$('dnext').onclick = () => stepDate(1);

// 加载某日数据：保留时刻 T 与视野；选中的车次按车次号在新数据里重找，车站/线路照旧
// partialT：首次加载时给出初始时刻；落在首片时段内就先用首片画首屏，其余片到了再整份重新初始化（选中按车次接续）
async function loadDate(date, partialT = null) {
  const e = dateEntry(date);
  if (!e || !e.selectable || !e.file) return false;
  if (date === curDate && D) return true;
  const seq = ++loadSeq;
  dateLoadErr = null;
  switching = true; $('dloading').style.display = ''; $('date').disabled = true;
  try {
    let data = await expandGeo(await fetchJson(e.file));
    if (seq !== loadSeq) return false;              // 期间又切了别的日期
    const sp = data.split;
    if (sp) {
      const restP = fetchJson(sp.rest);
      restP.catch(() => {});
      if (partialT != null && partialT >= sp.t[0] && partialT <= sp.t[1]) {
        curDate = date;
        initData(data);
        restP.then(rest => {
          if (seq !== loadSeq) return;
          initData(mergeRest(data, rest));
          if (!switching) $('dloading').style.display = 'none';
        }).catch(() => { if (seq === loadSeq) { dateLoadErr = `${date} 其余车次加载失败`; renderDateInfo(); } });
        return true;
      }
      data = mergeRest(data, await restP);
      if (seq !== loadSeq) return false;
    }
    curDate = date;
    initData(data);
    return true;
  } catch (err) {
    if (seq === loadSeq) { dateLoadErr = `${date} 加载失败`; renderDateInfo(); }
    return false;
  } finally {
    if (seq === loadSeq) {
      switching = false; $('date').disabled = false; renderDateBox();
      if (!D || !D.split) $('dloading').style.display = 'none';   // 首片先画的，其余片到了再藏
      if (hashReady) { saveView(); writeHash(true); }
    }
  }
}

// 用一份 map_data 初始化（首次与切换日期共用）；清掉与旧数据绑定的状态
// contRoll：播放跨过 24:00 自动切到下一天（时间连续）。此时选中/跟随的列车按（车次，始发日期）在新数据里接续；
// 手动换日期时时刻不连续，按车次重找（优先该时刻在跑的那列）
let contRoll = false;
function initData(data) {
  const selCode = sel ? sel.c.split('/')[0] : null, selOd = sel && D ? runOd(sel) : null,
        selStName = selSt ? selSt.name : null, wasFollow = follow, sameDate = D && data.date === D.date;
  D = data;
  G = D._G || D.geoms.map(g => ({
    km: Float64Array.from(g, p => p[0]),
    lon: Float64Array.from(g, p => p[1]),
    lat: Float64Array.from(g, p => p[2]),
    ele: g[0] && g[0].length > 3 ? Int16Array.from(g, p => p[3]) : null,
  }));
  const byName = {};
  ST = (D.stations || []).map(([name, lon, lat, n, code, ele]) => (byName[name] = { name, lon, lat, lon0: lon, lat0: lat, n, code, ele: ele ?? null, ev: [] }));
  ST.sort((a, b) => a.n - b.n);      // 大站后画，压在上面
  for (const tr of D.trains) tr.lv = liveryOf(tr);
  window.LOCO_DEFAULTS = D.loco_defaults || null;     // 普速示意机车：缺图标时的等级默认机型（emu_icons.js locoForTrain）
  const fxRow = document.querySelector('#legend [data-fx]'); if (fxRow) fxRow.hidden = !D.trains.some(t => t.fx);
  // beg / end：始发、终到站。数据里终到站的“发”也填了时刻（= 到），始发站可能填了“到”，按站序判断
  for (const tr of D.trains) {
    tr.s.forEach(([name, a, d], i) => { if (byName[name]) byName[name].ev.push({ tr, a, d, beg: i === 0, end: i === tr.s.length - 1 }); });
    for (const leg of tr.l) if (leg && leg[5]) for (const w of leg[5])
      if (w[4] && w[4].startsWith('技术停车') && byName[w[3]]) byName[w[3]].ev.push({ tr, a: w[1], d: w[2], wait: w[4], why: w[5] });
  }
  stationAxes(byName);
  STBY = byName;
  cityBases();
  hlCache.clear();                   // 线路高亮范围按车站位置算，车站随数据变
  hover = null; active = []; stShown = []; stLabelBoxes = []; if (!sameDate && !contRoll) { labMem.clear(); stopPushMem.clear(); }
  focus = focusSel = focusSt = null;
  // 跨日接续：新数据里没有这列（午夜前已到站）就取消选中，不跳到别的车
  sel = selCode ? (contRoll ? runsOf(selCode).find(tr => runOd(tr) === selOd) || null : findRun(selCode)) : null;
  selSt = selStName ? STBY[selStName] || null : null;
  follow = wasFollow && !!sel; followTr = follow ? sel : null;
  if (!sel && !selSt && !selLine) $('panel').style.display = 'none';
  document.title = `列车位置地图 · ${curDate || D.date}`;
  if (DATES) renderDateInfo();
  if (firstInit) { firstInit = false; firstSetup(); }
  else { if (railLayer.c) railLayer.redraw(); draw(); }
  setTimeout(upgradeGeo, 0);         // 首屏画完再下载精细几何，不和首屏抢带宽
}

// 加载顺序（首屏优先）：map_dates.json → 粗糙路网（到了立刻画、撤掉遮罩）→ 粗糙几何 + 当日首片 → 画列车后再拉客里表、
// 其余车次、精细几何；精细路网放大过 RAILS_LO_MAXZ 才拉
let kbPromise = null, railsPromise = null;
function startRailsFetch() {
  if (railsPromise) return railsPromise;
  railsPromise = fetch((DATES && (DATES.rails_lo || DATES.rails)) || 'map_rails.json', { priority: 'high' })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(rj => {
      const { rails, aux, lo } = parseRails(rj);
      RAILS_LO = rails;
      if (!lo) { RAILS_HI = rails; AUX = aux; AUXBY = Object.fromEntries(AUX.map(a => [a.name, a])); }       // 只有一版（本地未打包）
      railLayer.addTo(map);
      // 路网画布放在列车画布下面（列车画布可能还没加）
      if (overlay.c && overlay.c.parentNode) map.getPanes().overlayPane.insertBefore(railLayer.c, overlay.c);
      const ld = $('loading');
      if (ld && !D) { ld.classList.add('mini'); ld.textContent = '加载列车数据…'; }
    });
  railsPromise.catch(() => {});
  return railsPromise;
}
function startSharedFetches() {
  startRailsFetch();
  if (!kbPromise) kbPromise = fetch((DATES && DATES.kelibiao) || 'map_kelibiao.json').then(r => r.ok ? r.json() : null).catch(() => null);
}

// 只做一次：图例、客里表、路网底图、时刻恢复、动画
function firstSetup() {
  drawLegend();
  startSharedFetches();
  kbPromise.then(kb => {
    if (!kb) return;
    KB = kb; KBST = {};
    for (const [lid, ln] of Object.entries(KB.lines)) {
      const byZx = {};
      for (const [, km, zx] of ln.st) if (km != null) {
        const b = byZx[zx] || (byZx[zx] = { k0: km, k1: km });
        if (km < b.k0) b.k0 = km;
        if (km > b.k1) b.k1 = km;
      }
      for (const [name, km, zx, flag, lim, ju, code] of ln.st) {
        const b = byZx[zx];
        const d0 = km != null && b ? Math.round(Math.abs(km - b.k0) * 10) / 10 : null;
        const d1 = km != null && b ? Math.round(Math.abs(b.k1 - km) * 10) / 10 : null;
        (KBST[name] ||= []).push({ lid, km, d0, d1, zx, flag, lim: lim || '', ju: ju || '', code: code || '' });
      }
    }
    for (const v of Object.values(KBST)) v.sort((a, b) => (b.flag & 1) - (a.flag & 1) || KB.lines[a.lid].n.localeCompare(KB.lines[b.lid].n, 'zh'));
    if (DATES) renderDateInfo();
    if (pendingHash) { pendingHash = false; readHash(); } else draw();
  }).catch(() => {});
  overlay.addTo(map);                // 路网画布若已在，列车画布追加在它后面，正好压在上面
  $('loading').remove();
  setT(saved && okNum(saved.t) && saved.t >= 0 && saved.t <= 1440 ? saved.t : 480); readHash(); requestAnimationFrame(tick);
}

(async () => {
  try {
    const r = await fetch('map_dates.json', { cache: 'no-cache' });
    if (r.ok) { const m = await r.json(); if (m && Array.isArray(m.dates) && m.dates.some(x => x.selectable && x.file)) DATES = m; }
  } catch (e) {}
  // 先只拉粗糙路网（约 0.2 MB），到了（或失败）再拉列车数据，不和它抢带宽
  await Promise.race([startRailsFetch().catch(() => {}), new Promise(r => setTimeout(r, 4000))]);
  if (DATES && DATES.geo) preloadGeo(DATES.geo);
  if (!DATES) {                      // 回退：单文件
    const data = await expandGeo(await (await fetch('map_data.json')).json());
    curDate = null; initData(data); return;
  }
  // 起始日期：锚点 > 本机记忆 > 清单默认 > 最后一个可选日期
  const ok = d => d && dateEntry(d) && dateEntry(d).selectable && dateEntry(d).file;
  const ss = selectable();
  const start = [parseHash().date, saved && saved.date, DATES.default].find(ok) || ss[ss.length - 1].date;
  renderDateBox();
  // 初始时刻（同 firstSetup + readHash）；锚点指定了车次/车站/线路时要整天数据才找得到，不用首片
  const h0 = parseHash();
  const t0 = h0.kind || h0.unresolved ? null
    : h0.time ?? (saved && okNum(saved.t) && saved.t >= 0 && saved.t <= 1440 ? saved.t : 480);
  if (!(await loadDate(start, t0))) $('loading').textContent = `${start} 数据加载失败`;
})();
