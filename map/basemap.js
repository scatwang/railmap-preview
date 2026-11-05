// map.html · Leaflet 地图、视野记忆、矢量底图（BASE_TILES 在 map.html 里，发布时 pack 整行替换）
// 经典脚本（非 module），与其它 map/*.js 共享全局作用域，加载顺序见 map.html
// 刷新后恢复上次的视野和时刻（只存在本机浏览器）
const VIEW_KEY = 'railmap.view';
let saved = null;
try { saved = JSON.parse(localStorage.getItem(VIEW_KEY)); } catch (e) {}
const okNum = v => typeof v === 'number' && isFinite(v);
const map = L.map('map', { preferCanvas: true, zoomControl: true })
  .setView(saved && okNum(saved.lat) && okNum(saved.lon) && okNum(saved.z) ? [saved.lat, saved.lon] : [33.5, 113],
           saved && okNum(saved.z) ? saved.z : 5);
let saveTimer = null;
function saveView() {                 // 节流：最多每秒写一次
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; const c = map.getCenter();
    try { localStorage.setItem(VIEW_KEY, JSON.stringify({ lat: +c.lat.toFixed(5), lon: +c.lng.toFixed(5), z: map.getZoom(), t: +T.toFixed(2),
                                                         ...(curDate ? { date: curDate } : {}) })); } catch (e) {} }, 1000);
}
map.on('moveend', () => { saveView(); if (!(playing && follow)) writeHash(true); });
// 底图：OpenFreeMap 矢量瓦片（OpenMapTiles 结构）+ 自定义极简样式。
// 只画陆地（背景）、山体阴影、水体、河流、城市建成区；国界、道路、地名一律不画。
// 山体阴影用 AWS 公开的 Terrarium 高程瓦片（Mapzen Terrain Tiles），z12 以上放大复用。颜色取 CSS 变量，随深浅主题切换。
// 瓦片地址集中在这一行，发布时 `python -m railmap.viz.pack --tiles 配置.json` 会整行替换（换国内镜像 / 自托管用）。
// omt：TileJSON 地址，或含 {z}/{x}/{y} 的瓦片模板；dem：Terrarium 编码的瓦片模板；attr：底图版权说明（HTML）。
let baseOpacity = 1;
try { const v = localStorage.getItem('railmap.baseOpacity2'); if (v !== null) baseOpacity = +v; } catch (e) {}
const baseStyle = () => ({
  version: 8,
  sources: {
    omt: { type: 'vector', ...(BASE_TILES.omt.includes('{z}') ? { tiles: [BASE_TILES.omt], maxzoom: 14 } : { url: BASE_TILES.omt }) },
    dem: { type: 'raster-dem', encoding: 'terrarium', tileSize: 256, maxzoom: 12, tiles: [BASE_TILES.dem] },
  },
  layers: [
    { id: 'land', type: 'background', paint: { 'background-color': css('--bLand') } },
    { id: 'hills', type: 'hillshade', source: 'dem',
      paint: { 'hillshade-exaggeration': +css('--bShadeK'), 'hillshade-shadow-color': css('--bShade'),
               'hillshade-highlight-color': css('--bLit'), 'hillshade-accent-color': css('--bShade'),
               'hillshade-illumination-direction': 315 } },
    { id: 'urban', type: 'fill', source: 'omt', 'source-layer': 'landuse', minzoom: 8,
      filter: ['in', ['get', 'class'], ['literal', ['residential', 'commercial', 'industrial', 'retail']]],
      paint: { 'fill-color': css('--bUrban') } },
    { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': css('--bWater') } },
    { id: 'river', type: 'line', source: 'omt', 'source-layer': 'waterway', minzoom: 7,   // 更小时太密，易与普速线混
      filter: ['in', ['get', 'class'], ['literal', ['river', 'canal']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': css('--bRiver'),
               'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 6, 0.5, 10, 1.2, 14, 3] } },
  ],
});
// 插件不会把瓦片源自带的版权信息带进 Leaflet，手动写
const base = L.maplibreGL({ style: baseStyle(), interactive: false,   // 插件只认 attributionControl.customAttribution
  attributionControl: { customAttribution: BASE_TILES.attr } }).addTo(map);
map.attributionControl.addAttribution('时刻 <a href="https://www.12306.cn">12306</a> · 里程 <a href="https://kelibiao.com/">火车wiki</a>');
map.attributionControl.addAttribution('列车位置为推断结果，非官方信息');
L.control.scale({ position: 'bottomright', metric: true, imperial: false, maxWidth: 120 }).addTo(map);
const setBaseOpacity = v => { base.getContainer().style.opacity = v; };
setBaseOpacity(baseOpacity);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => base.getMaplibreMap().setStyle(baseStyle()));
