// diagram.html · 总说明、基础工具、全局状态
// 经典脚本（非 module），与其它 diagram/*.js 共享全局作用域，加载顺序见 diagram.html
'use strict';
// 列车运行图（时间–里程图）。数据全在浏览器端算：
//   map_dates.json / map_data_<日期>.json（与地图同一份：几何 geoms、区间 [几何, 发, 到, km, 运行曲线, 推定停车?]、运行曲线 profiles、
//   几何的线路分段 glines）+ map_kelibiao.json（客里表线路：站序与线上里程）。
// 线路参照：客里表该线（某支线）各站，用地图数据里的车站坐标连成折线，站间按官方里程线性插值。
// 列车位置：与地图 state() 同一套推算——区间内 t 时刻的几何里程按运行曲线（时间比例→距离比例）插值；
//   几何上各折点预先投影到该线（只取 glines 里线路名属于该线 OSM 线名的段；离线超过容差的点视为不在线上）。
const $ = id => document.getElementById(id);
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const cv = $('c'), ctx = cv.getContext('2d'), tip = $('tip');
const CLASSES = [['G', '高速 G'], ['D', '动车 D'], ['C', '城际 C'], ['S', '市域 S'], ['Z', '直达 Z'], ['T', '特快 T/N'], ['K', '快速 K/V'], ['O', '其他']];
const clsOf = c => {
  const h = c[0];
  if ('GDCSZK'.includes(h)) return h;
  if (h === 'T' || h === 'N') return 'T';
  if (h === 'V') return 'K';
  return 'O';
};
const fmt = m => { m = Math.round(m); const d = Math.floor(m / 1440); m -= d * 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}${d > 0 ? '⁺' + d : d < 0 ? '⁻' + (-d) : ''}`; };
const fmtH = m => { m = Math.round(m); const d = Math.floor(m / 1440); m -= d * 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}${d ? `<sup class="day">${d > 0 ? '+' + d : d}</sup>` : ''}`; };
const EXT_SVG = '<svg class="ext" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5L8.5 3.5M8.5 3.5H4.5M8.5 3.5V7.5"/></svg>';
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
const tm = (v, f) => `<span class="tm" data-t="${v}" title="跳到这个时刻">${f(v)}</span>`;
const kmTxt = k => k == null ? '' : (Math.round(k * 10) / 10).toString();

let DATES = null, curDate = null, D = null, G = null, KB = null, STN = {};
let lineId = null, zx = 0, LINE = null, TR = [], sel = null, hover = null;
let view = { t0: 0, t1: 1440, k0: 0, k1: 100 }, kmin = 0, kmax = 100;
const PAD = { l: 112, r: 14, t: 14, b: 26 };
let W = 0, H = 0;
