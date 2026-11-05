// 发布打包格式的几何解码与下载缓存：map.html 与 diagram.html 共用（格式见 viz/pack.py）
'use strict';
// 发布用的打包格式（viz/pack.py）：几何与线路分段放在各日共用的文件，每日文件只引用全局下标。
//   data.geo     粗糙几何（map_geo_lo.json，lod "lo"）+ 线路分段：首屏用，点少、逐点里程按折线长度比例内插
//   data.geo_hi  精细几何（map_geo.json，lod "hi"）：首屏之后再下载，到了原地替换 G 的各项
// 旧打包（v1）的 map_geo.json 自带全部字段；未打包的文件（本地 data/derived/viz）没有 data.geo，原样使用。
// 每个文件只下载、解码一次。
const GEO_CACHE = new Map();   // url → promise → { G, geo }
function decodeGeo(geo) {
  const f = geo.pts, n = f.length / 2, X = new Float64Array(n), Y = new Float64Array(n);
  for (let i = 0, x = 0, y = 0; i < n; i++) { x += f[2 * i]; y += f[2 * i + 1]; X[i] = x / 1e5; Y[i] = y / 1e5; }
  const G = geo.geoms.map((r, gi) => {
    let m = 0;
    for (let a = 1; a < r.length; a += 2) m += Math.abs(r[a]);
    const km = new Float64Array(m), lon = new Float64Array(m), lat = new Float64Array(m);
    for (let a = 0, j = 0, prev = 0; a < r.length; a += 2) {
      const s = prev + r[a], L = r[a + 1], d = L < 0 ? -1 : 1;
      for (let t = 0; t < Math.abs(L); t++, j++) { const p = s + d * t; lon[j] = X[p]; lat[j] = Y[p]; }
      prev = s + d * (Math.abs(L) - 1);
    }
    if (geo.gkm) { const dk = geo.gkm[gi]; for (let j = 0, k = 0; j < m; j++) { k += dk[j]; km[j] = k / 1e4; } }
    else {                                       // 粗糙几何：首末里程准确，中间按折线长度比例
      const [k0, len] = geo.gk[gi], c = Math.cos(lat[0] * Math.PI / 180);
      for (let j = 1; j < m; j++) km[j] = km[j - 1] + Math.hypot((lon[j] - lon[j - 1]) * c, lat[j] - lat[j - 1]);
      const tot = m > 1 ? km[m - 1] : 0;
      for (let j = 0; j < m; j++) km[j] = (k0 + len * (tot > 0 ? km[j] / tot : m > 1 ? j / (m - 1) : 0)) / 1e4;
    }
    return { km, lon, lat };
  });
  geo.pts = geo.geoms = geo.gkm = geo.gk = null;      // 解码后不再需要，释放
  return { G, geo };
}
// 每日文件切成两片（viz/pack.py split_day）：首片 + 其余，按首片各车的原序号合并，其余片的运行曲线下标顺延
function mergeRest(main, rest) {
  const off = main.profiles.length, a = main.split.a, n = main.trains.length + rest.trains.length;
  for (const t of rest.trains) for (const lg of t.l) if (lg) lg[4] += off;
  const trains = new Array(n), isA = new Uint8Array(n);
  a.forEach((i, k) => { trains[i] = main.trains[k]; isA[i] = 1; });
  for (let i = 0, j = 0; i < n; i++) if (!isA[i]) trains[i] = rest.trains[j++];
  return { ...main, trains, profiles: main.profiles.concat(rest.profiles), split: null };
}
const fetchJson = url => fetch(url).then(r => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
function preloadGeo(url) {
  if (!url) return null;
  if (!GEO_CACHE.has(url)) {
    const promise = fetch(url).then(r => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }).then(decodeGeo);
    promise.catch(() => GEO_CACHE.delete(url));   // 失败了下次重拉；也抑制预拉取期间的未捕获告警
    GEO_CACHE.set(url, promise);
  }
  return GEO_CACHE.get(url);
}
