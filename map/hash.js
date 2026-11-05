// map.html · 全局状态、车站 / 线路查找、URL 锚点读写
// 经典脚本（非 module），与其它 map/*.js 共享全局作用域，加载顺序见 map.html
let D, G = [], T = 480, playing = false, sel = null, hover = null, selSt = null;
let focus = null, focusSel = null, focusSt = null;   // 选中车次 / 车站时的“关注”车次集合（选中客里表线路时不叠加车站可达范围）
function setFocus() {
  const st = selLine ? null : selSt;
  focusSel = sel; focusSt = st;
  focus = sel ? new Set([sel]) : st ? new Set(st.ev.map(e => e.tr)) : null;
  if (railLayer.c) railLayer.redraw();
}
// URL 锚点记录日期、高亮对象（车次、车站、线路）、时刻、视口坐标与分屏状态
// 支持直观中文（如 #station=北京南、#line=京沪高速线、#train=G1）与简写（如 #北京南、#京沪高速线、#G1）
// 默认今天不带 date=，历史/未来日期才带 date=YYYY-MM-DD
let STBY = {};
let KB = null, KBST = {}, selLine = null, pendingHash = false;
const hlCache = new Map();

// 境外车站：国名只加在显示层，数据里的站名不变（国别按站点坐标是否在中国境外判定，名单取自 docs/09-国际列车.md 与数据里实际出现的境外站）
const FOREIGN = { 同登: '越南', 磨丁: '老挝', 孟赛: '老挝', 琅勃拉邦: '老挝', 万荣: '老挝', 万象: '老挝', 新义州青年: '朝鲜', 扎门乌德: '蒙古', 后贝加尔斯克: '俄罗斯' };
const dn = name => (FOREIGN[name] || '') + name;

function findLineId(v, allowNumericId = true) {
  if (!KB || !v) return null;
  try { v = decodeURIComponent(String(v)).trim(); } catch (e) { v = String(v).trim(); }
  if (allowNumericId && KB.lines[v]) return v;
  for (const [id, ln] of Object.entries(KB.lines)) {
    if (ln.n === v) return id;
  }
  const vNorm = v.replace(/线$/, '');
  for (const [id, ln] of Object.entries(KB.lines)) {
    if (ln.n.replace(/线$/, '') === vNorm || ln.n === v + '线' || ln.n + '线' === v) return id;
  }
  const ALIAS = {
    '京沪高铁': '京沪高速线',
    '京广高铁': '京广高铁',
    '京包客专': '京包客专线',
    '石太客专': '石太客专线',
    '兰新客专': '兰新客专线',
    '成渝高铁': '成渝客专',
  };
  if (ALIAS[v]) {
    for (const [id, ln] of Object.entries(KB.lines)) {
      if (ln.n === ALIAS[v]) return id;
    }
  }
  if (vNorm.length >= 2) {
    for (const [id, ln] of Object.entries(KB.lines)) {
      if (ln.n.includes(vNorm)) return id;
    }
  }
  return null;
}

function findStation(v) {
  if (!v || !STBY) return null;
  try { v = decodeURIComponent(String(v)).trim(); } catch (e) { v = String(v).trim(); }
  if (STBY[v]) return STBY[v];
  const noZhan = v.replace(/站$/, '');
  if (STBY[noZhan]) return STBY[noZhan];
  for (const [name, country] of Object.entries(FOREIGN)) {
    if (v === country + name || v === name) return STBY[name] || null;
  }
  return null;
}

function isLikelyTrainCode(v) {
  if (!v) return false;
  try { v = decodeURIComponent(String(v)).trim().toUpperCase(); } catch (e) { v = String(v).trim().toUpperCase(); }
  if (D && D.trains && runsOf(v).length > 0) return true;
  return /^[A-Z0-9\/]+$/.test(v) && (/[A-Z]/.test(v) || /^\d{3,5}$/.test(v));
}

const hashOf = () => {
  const parts = [];

  // 直接写入名称，不带 line=/station=/train= 前缀
  if (sel) {
    parts.push(sel.c.split('/')[0]);
    if (sel.od) parts.push('od=' + sel.od);
  } else if (selLine && KB && KB.lines[selLine]) {
    parts.push(KB.lines[selLine].n);
  } else if (selSt) {
    parts.push(selSt.name);
  }

  if (okNum(T)) {
    parts.push('time=' + fmtH(T));
  }

  const c = map.getCenter(), z = map.getZoom(), dp = z >= 13 ? 5 : 4;
  parts.push(`@${+c.lat.toFixed(dp)},${+c.lng.toFixed(dp)},${z}z`);

  if (splitOn) parts.push('split=1');
  if (!mkOn) parts.push('mk=0');   // 涂装默认开启，关闭时才写入 hash
  if (!dimOthers) parts.push('dim=0');   // 他车置灰默认开启，关闭时才写入 hash

  const isDefaultDate = !curDate || (DATES && curDate === DATES.default);
  if (DATES && curDate && !isDefaultDate) parts.push('date=' + curDate);

  return parts.join('&');
};

const parseHash = () => {
  let raw = '';
  try { raw = decodeURIComponent(location.hash.slice(1)); } catch (e) { raw = location.hash.slice(1); }
  if (!raw) return {};
  const out = {};

  const viewMatch = raw.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,(\d+(?:\.\d+)?))?z?/);
  if (viewMatch) {
    out.view = { lat: +viewMatch[1], lon: +viewMatch[2], z: viewMatch[3] ? +viewMatch[3] : null };
  }

  const pairs = raw.split('&');
  for (const part of pairs) {
    if (!part) continue;
    const eq = part.indexOf('=');
    if (eq < 0) {
      if (part.startsWith('@')) continue;
      const token = part.trim();
      if (!token) continue;
      const st = findStation(token);
      if (st) {
        out.kind = 'station'; out.v = st.name;
        continue;
      }
      if (D && D.trains && runsOf(token).length > 0) {
        out.kind = 'train'; out.v = token;
        continue;
      }
      const lid = findLineId(token, false);
      if (lid) {
        out.kind = 'line'; out.v = lid;
        continue;
      }
      if (isLikelyTrainCode(token)) {
        out.kind = 'train'; out.v = token;
        continue;
      }
      out.unresolved = token;
      continue;
    }
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();

    if (key === 'date' || key === 'd') out.date = val;
    else if (key === 'od') out.od = val;
    else if (key === 'train' || key === 'tr' || key === 'c') { out.kind = 'train'; out.v = val; }
    else if (key === 'station' || key === 'st') { out.kind = 'station'; out.v = val; }
    else if (key === 'line' || key === 'ln') { out.kind = 'line'; out.v = findLineId(val, true) || val; }
    else if (key === 'time' || key === 't') {
      if (val.includes(':')) {
        const [hh, mm] = val.split(':').map(Number);
        if (!isNaN(hh) && !isNaN(mm)) out.time = Math.max(0, Math.min(1440, hh * 60 + mm));
      } else {
        const num = Number(val);
        if (!isNaN(num) && num >= 0 && num <= 1440) out.time = num;
      }
    } else if (key === 'split' || key === 'diagram' || key === 'dg') {
      out.split = val === '1' || val === 'true';
    } else if (key === 'mk' || key === 'marker') {
      out.mk = val === '1' || val === '2' || val === 'true';
    } else if (key === 'dim') {
      out.dim = val !== '0' && val !== 'false';
    } else if (key === 'z' || key === 'zoom') {
      const z = Number(val);
      if (!isNaN(z)) out.view = Object.assign(out.view || {}, { z });
    } else if (key === 'loc') {
      const p = val.split(',').map(Number);
      if (p.length >= 2 && !isNaN(p[0]) && !isNaN(p[1])) {
        out.view = Object.assign(out.view || {}, { lat: p[0], lon: p[1], z: p[2] && !isNaN(p[2]) ? p[2] : null });
      }
    }
  }

  return out;
};

let hashReady = false;
let readingHash = false;
let lastHashObjKey = null;
let hashTimer = null;
let lastHashWrite = 0;

function flushHash() {
  if (hashTimer) { clearTimeout(hashTimer); hashTimer = null; }
  lastHashWrite = performance.now();
  const h = hashOf();
  let cur = '';
  try { cur = decodeURIComponent(location.hash.slice(1)); } catch (e) { cur = location.hash.slice(1); }
  if (h !== cur && h !== location.hash.slice(1)) {
    try { history.replaceState(null, '', h ? '#' + h : location.pathname + location.search); } catch (e) {}
  }
}

function writeHash(forceImmediate = false) {
  if (!hashReady || switching || readingHash) return;
  const currentObjKey = (sel ? 't:' + sel.c + (sel.od || '') : selLine ? 'l:' + selLine : selSt ? 's:' + selSt.name : '') + '|' + (splitOn ? '1' : '0') + '|' + (mkOn ? '1' : '0') + '|' + (dimOthers ? '1' : '0');
  const objChanged = currentObjKey !== lastHashObjKey;
  lastHashObjKey = currentObjKey;

  const now = performance.now();
  if (objChanged) {
    flushHash();
    return;
  }
  if (forceImmediate) {
    // 地图 moveend / 暂停 / 切换开关：立即写入，仅做 80ms 最小间隔保护防止滚轮连续缩放触发浏览器 replaceState 限流
    const elapsed = now - lastHashWrite;
    if (elapsed >= 80) flushHash();
    else if (!hashTimer) hashTimer = setTimeout(flushHash, 80 - elapsed);
    return;
  }

  // 时间轴拖动或动画播放中：用节流（不重置已有定时器），避免标签滑行动画或播放状态把 URL 更新无限推迟
  if (hashTimer) return;
  const interval = playing ? 1500 : 200;
  const wait = Math.max(0, interval - (now - lastHashWrite));
  if (wait === 0 && !playing) flushHash();
  else hashTimer = setTimeout(flushHash, wait || interval);
}

function readHash() {
  if (!D) return;
  const h = parseHash();

  const targetDate = h.date || (hashReady && DATES ? DATES.default : null);
  if (targetDate && targetDate !== curDate && DATES && dateEntry(targetDate) && dateEntry(targetDate).selectable) {
    loadDate(targetDate).then(ok => { if (ok) readHash(); });
    return;
  }

  if (h.unresolved && !h.kind) {
    if (!KB) { pendingHash = true; return; }
    const lid = findLineId(h.unresolved, false);
    if (lid) {
      h.kind = 'line'; h.v = lid;
    } else if (isLikelyTrainCode(h.unresolved)) {
      h.kind = 'train'; h.v = h.unresolved;
    }
  }

  let tr = null, st = null, ln = null;
  if (h.kind === 'train') {
    tr = findRun(h.v, h.od);
  } else if (h.kind === 'station') {
    st = findStation(h.v);
  } else if (h.kind === 'line') {
    if (!KB) { pendingHash = true; return; }
    ln = findLineId(h.v);
  }

  readingHash = true;
  try {
    if (h.time != null && okNum(h.time) && Math.abs(T - h.time) > 0.01) {
      setT(h.time);
    }
    if (h.split !== undefined && h.split !== splitOn) {
      setSplit(h.split);
    }
    if (h.mk !== undefined && h.mk !== mkOn) {
      setMk(h.mk);
    }
    if (h.dim !== undefined && h.dim !== dimOthers) {
      setDim(h.dim);
    }

    const hasExplicitView = !!(h.view && h.view.lat != null && h.view.lon != null);
    let viewChanged = false;
    if (h.view) {
      const curZ = map.getZoom();
      const targetZ = h.view.z != null ? h.view.z : curZ;
      if (hasExplicitView) {
        map.setView([h.view.lat, h.view.lon], targetZ);
        viewChanged = true;
      } else if (h.view.z != null && h.view.z !== curZ) {
        map.setZoom(h.view.z);
        viewChanged = true;
      }
    }

    const sameObj = tr === sel && st === selSt && ln === selLine;
    sel = tr || null; selSt = st || null; setLine(ln);

    if (!sameObj) {
      if (ln && !hasExplicitView) {
        const hl = lineHighlight(ln);
        if (hl) map.fitBounds([[hl.bbox[1], hl.bbox[0]], [hl.bbox[3], hl.bbox[2]]], fitPad(30));
      }
      if (!sel && !selSt) $('panel').style.display = 'none';
      if (sel) {
        const s0 = sel.s[0][2];
        if (s0 != null && (T < s0 || T > sel.s[sel.s.length - 1][1]) && h.time == null) {
          setT(s0 + 1);
        }
      }
      if ((sel || selSt) && !hasExplicitView) {
        const curSt = sel ? state(sel, T) : null;
        const c = sel ? (curSt && curSt.pos) : [selSt.lat, selSt.lon];
        if (c && !map.getBounds().contains(c)) {
          map.setView(c, Math.max(map.getZoom(), 9));
        }
      }
    }
    if (!sameObj || viewChanged) draw();
  } finally {
    readingHash = false;
    hashReady = true;
  }
  writeHash(true);
}
addEventListener('hashchange', readHash);
