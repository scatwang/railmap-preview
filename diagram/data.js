// diagram.html · 日期清单、按日加载（geo 解码见 shared/geo_pack.js）
// 经典脚本（非 module），与其它 diagram/*.js 共享全局作用域，加载顺序见 diagram.html
'use strict';
// ===== 日期 =====
const dateEntry = d => DATES && DATES.dates.find(x => x.date === d);
const selectable = () => (DATES ? DATES.dates.filter(x => x.selectable && x.file) : []);
function renderDates() {
  const s = $('date');
  s.innerHTML = (DATES ? DATES.dates : []).map(e => {
    const wd = '日一二三四五六'[new Date(e.date + 'T00:00:00Z').getUTCDay()];
    return `<option value="${e.date}"${e.selectable ? '' : ' disabled'}>${e.date.slice(5)} 周${wd}${e.selectable ? '' : `（${e.reason || '不可选'}）`}</option>`;
  }).join('');
  s.value = curDate || '';
  const ss = selectable(), i = ss.findIndex(x => x.date === curDate);
  $('dprev').disabled = i <= 0; $('dnext').disabled = i < 0 || i >= ss.length - 1;
}
// 运行图要精细几何（按坐标把几何点投到线路上），粗糙版只取线路分段等字段
async function expandGeo(data) {
  if (!data.geo) return data;
  const [lo, hi] = await Promise.all([preloadGeo(data.geo), data.geo_hi ? preloadGeo(data.geo_hi) : null]);
  const geo = lo.geo;
  Object.assign(data, { _G: (hi || lo).G, glines: geo.glines, gmember: geo.gmember, line_names: geo.line_names,
                        member_sets: geo.member_sets, profiles: data.profiles || geo.profiles,
                        profile_scale: data.profile_scale ?? geo.profile_scale });
  return data;
}
async function loadDate(date) {
  const e = dateEntry(date);
  const file = e ? e.file : 'map_data.json';
  $('loading').style.display = ''; $('loading').textContent = `加载 ${date || ''} 数据…`;
  const r = await fetch(file);
  if (!r.ok) { $('loading').textContent = `${date} 加载失败（${r.status}）`; return false; }
  try {
    let data = await r.json();
    const restP = data.split ? fetchJson(data.split.rest) : null;   // 运行图要整天数据：其余片与几何并行下载
    if (restP) restP.catch(() => {});
    data = await expandGeo(data);
    D = restP ? mergeRest(data, await restP) : data;
  }
  catch (err) { $('loading').textContent = `${date} 加载失败（${err.message}）`; return false; }
  curDate = D.date || date;
  G = D._G || D.geoms.map(g => ({
    km: Float64Array.from(g, p => p[0]),
    lon: Float64Array.from(g, p => p[1]),
    lat: Float64Array.from(g, p => p[2]),
    ele: g[0] && g[0].length > 3 ? Int16Array.from(g, p => p[3]) : null,
  }));
  STN = {};
  for (const [name, lon, lat, n, code, ele] of D.stations || []) STN[name] = { ll: [lon, lat], ele: ele ?? null };
  $('loading').style.display = 'none';
  renderDates();
  return true;
}
