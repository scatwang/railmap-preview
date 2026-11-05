// map.html · 基础工具：DOM 简写、触屏判断、列车涂装、车型标签、时刻格式、图标与客里表限制符号
// 经典脚本（非 module），与其它 map/*.js 共享全局作用域，加载顺序见 map.html
const $ = id => document.getElementById(id);
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
// 触屏：记下最近一次指针类型（触摸时放大点选半径、不显示悬停提示）；手机窄屏时面板是底部抽屉
let lastPtr = 'mouse';
addEventListener('pointerdown', e => { lastPtr = e.pointerType || 'mouse'; }, true);
addEventListener('pointermove', e => { if (e.pointerType === 'mouse') lastPtr = 'mouse'; }, true);
const isTouch = () => lastPtr === 'touch' || lastPtr === 'pen';
const MQ_SHEET = matchMedia('(max-width: 640px)');
const isSheet = () => MQ_SHEET.matches;
// 列车外观（涂装）：动车组尖头，按车型速度档上色——350 档灰、250 档白、CR200J（160 档）绿；
// 复兴号下半个车身（贴线路的一半）换成金色。普速圆头，按车次分三种绿。
// 车型数据（可选字段）：tr.tier = 车型速度档 350/250/160，tr.fx = 是否复兴号，tr.m = 车型名。
// 没有车型数据时按车次首字母（多车次取第一个）兜底：G 当 350 档，D/C 当 250 档。
const LIVERIES = ['S', 'W', 'J', 'ZT', 'K', 'O'];
const EMU = new Set(['S', 'W', 'J']);
const liveryOf = tr => {
  if (tr.tier) return tr.tier >= 300 ? 'S' : tr.tier >= 200 ? 'W' : 'J';
  const h = tr.c[0];
  // S 字头（市域/市郊）大多是动车组，没有车型数据时按 250 档画；
  // 北京 S2 是 160 档内燃动车组（同 manual/train_class_rules.csv），按 160 档动车组画
  if (/^S2\d\d$/.test(tr.c.split('/')[0])) return 'J';
  return h === 'G' ? 'S' : h === 'D' || h === 'C' || h === 'S' ? 'W' : h === 'Z' || h === 'T' || h === 'N' ? 'ZT' : h === 'K' || h === 'V' ? 'K' : 'O';
};
const kindColor = tr => css('--t' + tr.lv);
async function expandGeo(data) {
  if (!data.geo) return data;
  const { G, geo } = await preloadGeo(data.geo);
  Object.assign(data, { _G: G, glines: geo.glines, gmember: geo.gmember, line_names: geo.line_names,
                        member_sets: geo.member_sets, profiles: data.profiles || geo.profiles,
                        profile_scale: data.profile_scale ?? geo.profile_scale });
  return data;
}
// 精细几何到了：原地替换粗糙几何数组的各项（这个数组对象被各日数据共用，换日期不用再换），重算站轴、重画
function upgradeGeo() {
  const url = D && D.geo_hi, target = D && D._G;
  if (!url || !target || target.hi === url || target.hiPending === url) return;
  target.hiPending = url;
  preloadGeo(url).then(({ G: H }) => {
    if (H.length !== target.length) return;
    for (let i = 0; i < H.length; i++) target[i] = H[i];
    target.hi = url;
    if (G === target && STBY) { stationAxes(STBY); hlCache.clear(); if (railLayer.c) railLayer.redraw(); draw(); }
  }).catch(() => { target.hiPending = null; });
}

// 车型行内容：CR400BF-Z · 复兴号 / CR200J · 复兴号 · 动集 + 48×16 半个车头侧面图标；悬停看 train_style 原值（12306 按天车型）
const emuTag = (tr, link = false) => {
  if (!tr.m && !tr.dw) return '';
  const tipTxt = `${tr.m ? '12306 当天车型 ' + (tr.ts || tr.m) : ''}${tr.dw ? (tr.m ? '；' : '') + '动卧：车型配置有卧铺车厢' : ''}`;
  const txt = `<span class="note" title="${tipTxt}">${[tr.m, tr.fx && '复兴号', tr.dj && '动集', tr.dw && '动卧'].filter(Boolean).join(' · ')}</span>`;
  const svg = tr.m && typeof emuHalfSvg === 'function' ? emuHalfSvg(tr.m, 16) : '';
  if (!svg) return txt;
  const ico = link
    ? `<a class="emu-ico" href="emu.html#half&${encodeURIComponent(resolveEmuModel(tr.m) || tr.m)}" target="_blank" title="${tipTxt} · 点击查看侧面涂装图鉴">${svg}</a>`
    : `<span class="emu-ico">${svg}</span>`;
  return txt + ico;
};
// 普速示意机车行（数据 tr.lc，见 docs/15-普速机车示意.md）：有 12306 真实车型（tr.m）的走 emuTag 不写推定，机车推定才显示本行。
const LOCO_GRADE_TXT = { Z: '直特Z', T: '特快T', K: '快速K' };
const locoTag = (tr, st) => {
  if (!tr.lc || tr.m) return '';
  const runs = Array.isArray(tr.lc) ? tr.lc : [[0, tr.lc]];
  const li = st ? (st.li ?? st.i ?? 0) : 0;
  let k = 0;
  runs.forEach(([i], j) => { if (i <= li) k = j; });
  const v = runs[k][1], p = v.indexOf(':'), tc = v.slice(0, p), model = v.slice(p + 1);
  const icoKey = typeof locoForTrain === 'function' ? locoForTrain(tr, runs[k][0]) : model;
  const g = typeof trainGrade === 'function' ? trainGrade(tr) : '';
  const gradeTxt = LOCO_GRADE_TXT[g] || tr.cls || '普快';
  const svg = typeof emuHalfSvg === 'function' ? emuHalfSvg(icoKey, 16) : '';
  return `<div class="emu-row">${svg ? `<span class="emu-ico">${svg}</span>` : ''}`
    + `<span class="note">${model}&ensp;${tc === 'D' ? '内燃' : '电力'}，${gradeTxt} <span style="white-space:nowrap">（机车图标非真实情况，仅供参考）</span></span></div>`;
};
const fmt = m => { m = Math.floor(m); const d = Math.floor(m / 1440); m -= d * 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}${d > 0 ? '⁺' + d : d < 0 ? '⁻' + (-d) : ''}`; };
const fmtH = m => { m = Math.floor(m); const d = Math.floor(m / 1440); m -= d * 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}${d ? `<sup class="day">${d > 0 ? '+' + d : d}</sup>` : ''}`; };
const CAM_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>';
const EYE_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const EXT_SVG = '<svg class="ext" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5L8.5 3.5M8.5 3.5H4.5M8.5 3.5V7.5"/></svg>';
// 火车Wiki 客里表营业办理限制符号释义（原样取自 kelibiao.com stationlimitationexplaination.php）
const KB_LIM = {
  '×': '不办理行包业务：不办理行李和包裹业务的车站',
  '◎': '不办理包裹业务：不办理包裹业务的车站',
  '※': '仅办理旅客乘降：仅办理旅客乘降业务的营业处所，可能是车站、线路所或乘降所',
  '△': '不办理客运业务：不办理客运业务的处所，可能是车站或线路所',
  '□': '办理客运业务(未公布)：未经公布却办理客运相关业务的营业处所，可能是乘降所、无轨站、代售点或车站',
  '▲': '纪念：未经公布的铁路处所，一般作为纪念用途',
  'G': '办理高铁快运业务：办理高铁快运(速递)业务的车站',
  'Y': '支持中铁银通卡进出闸：支持中铁银通卡刷卡乘车的车站',
  'E': '支持铁路E卡通进出闸：支持铁路E卡通扫码乘车的车站',
  'I': '办理国际联运：办理铁路合作组织国际旅客联运的车站',
  'L': '办理轮渡业务：办理国铁轮渡客运业务的车站(港口)',
  '轮': '办理轮渡业务：办理国铁轮渡客运业务的车站(港口)',
  '■': '彩蛋：彩蛋《我是一个粉刷匠》',
};
const kbLimHtml = s => s ? `<span class="kb-lim">${[...s].map(c => `<span title="${KB_LIM[c] || c}">${c}</span>`).join('')}</span>` : '';
