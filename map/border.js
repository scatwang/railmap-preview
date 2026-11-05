// map.html · 视口外框线路方向标记（docs/11 §5.3）与非客运站拾取
// 经典脚本（非 module），与其它 map/*.js 共享全局作用域，加载顺序见 map.html
// ===== 视口外框线路方向标记（docs/11 §5.3） =====
// 在 z ≥ 9（或选中客里表线路时 z ≥ 6）下，沿穿过地图外框的铁路切线方向标注“线名 终点方向 ▸”
let borderMetaCache = null, borderCrossCache = { key: '', items: [] }, borderShown = [];
function buildBorderMeta(rails) {
  if (!KB || !ST.length || !rails || !rails.length) return null;
  if (borderMetaCache && borderMetaCache.kb === KB && borderMetaCache.st === STBY && borderMetaCache.aux === AUX && borderMetaCache.rails === rails) {
    return borderMetaCache;
  }
  const cleanNm = s => String(s || '').replace(/（境）|\(境\)|\s+/g, '');
  const stCoord = nm => {
    const s = STBY[nm]; if (s) return [s.lon, s.lat];
    const a = AUXBY && AUXBY[nm]; if (a) return [a.lon, a.lat];
    return null;
  };
  const resolveKbEnd = (zxSts, isEnd, lineLen, lnName) => {
    if (!zxSts || !zxSts.length) return null;
    const ord = isEnd ? zxSts.slice().reverse() : zxSts;
    const raw0 = cleanNm(ord[0][0]), km0 = ord[0][1], flag0 = ord[0][3] || 0;
    const isHsr = /高速|高铁|客专|城际/.test(lnName || '');
    let innerPt = null, innerKm = null, otherPt = null;
    for (const s of ord) {
      const c = stCoord(cleanNm(s[0]));
      if (c) {
        if (!innerPt) { innerPt = c; innerKm = s[1]; }
        else { otherPt = c; break; }
      }
    }
    if (!innerPt) return null;
    const tryUpgradeHub = (stObj) => {
      if ((lineLen || 0) >= 80 && stObj.n < 50 && otherPt) {
        const vx = (stObj.lon - otherPt[0]) * 95, vy = (stObj.lat - otherPt[1]) * 111;
        let bestH = null, bestN = Math.max(150, stObj.n * 4);
        for (const s of ST) {
          if (s.n < bestN) continue;
          const dx = (s.lon - stObj.lon) * 95, dy = (s.lat - stObj.lat) * 111, dkm = Math.hypot(dx, dy);
          if (dkm <= 30 && dx * vx + dy * vy >= -5) { bestN = s.n; bestH = s; }
        }
        if (bestH) return { name: bestH.name, lon: bestH.lon, lat: bestH.lat };
      }
      return { name: stObj.name, lon: stObj.lon, lat: stObj.lat };
    };
    if (!(flag0 & 2) && !raw0.endsWith('所')) {
      if (STBY[raw0] && STBY[raw0].n >= 5) return tryUpgradeHub(STBY[raw0]);
      if (raw0.length >= 3 && '东西南北'.includes(raw0.slice(-1))) {
        const b = STBY[raw0.slice(0, -1)];
        if (b && b.n >= 5) return tryUpgradeHub(b);
      }
      if (raw0.length >= 2) {
        let bestS = null;
        for (const s of ST) if (s.name.startsWith(raw0) && s.n >= 5 && (!bestS || s.n > bestS.n)) bestS = s;
        if (bestS) return { name: raw0, lon: bestS.lon, lat: bestS.lat };
      }
    }
    if (raw0.endsWith('所') && raw0.length >= 3) {
      for (const cut of [1, 2]) {
        if (raw0.length > cut + 1 && STBY[raw0.slice(0, -cut)]) {
          const b = STBY[raw0.slice(0, -cut)];
          return { name: b.name, lon: b.lon, lat: b.lat };
        }
      }
    }
    let refPt = stCoord(raw0) || innerPt;
    if (!stCoord(raw0) && innerPt && otherPt && km0 != null && innerKm != null && Math.abs(km0 - innerKm) > 2) {
      const gapKm = Math.min(60, Math.abs(km0 - innerKm));
      const dx = (innerPt[0] - otherPt[0]) * 95, dy = (innerPt[1] - otherPt[1]) * 111;
      const dl = Math.hypot(dx, dy) || 1;
      refPt = [innerPt[0] + (dx / dl) * gapKm / 95, innerPt[1] + (dy / dl) * gapKm / 111];
    }
    let bestHub = null, bestSc = -1e9;
    for (const s of ST) {
      if (s.n < 10) continue;
      const dkm = Math.hypot((s.lon - refPt[0]) * 95, (s.lat - refPt[1]) * 111);
      if (dkm <= 28) {
        const baseBonus = (!isHsr && !'东西南北'.includes(s.name.slice(-1))) ? 260 : 0;
        const sc = s.n + baseBonus - dkm * 4;
        if (sc > bestSc) { bestSc = sc; bestHub = s; }
      }
    }
    if (bestHub) return { name: bestHub.name, lon: bestHub.lon, lat: bestHub.lat };
    for (let i = 1; i < ord.length; i++) {
      if (km0 != null && ord[i][1] != null && Math.abs(ord[i][1] - km0) > 65) break;
      const sn = cleanNm(ord[i][0]);
      if (STBY[sn] && STBY[sn].n >= 3) return { name: sn, lon: STBY[sn].lon, lat: STBY[sn].lat };
    }
    for (const s of ord) {
      const sn = cleanNm(s[0]);
      if (STBY[sn]) return { name: sn, lon: STBY[sn].lon, lat: STBY[sn].lat };
    }
    return { name: raw0, lon: innerPt[0], lat: innerPt[1] };
  };

  const metaByLid = {};
  for (const [lid, ln] of Object.entries(KB.lines)) {
    if (!ln.st || !ln.st.length) continue;
    let zx0 = ln.st.filter(s => s[2] === 0);
    if (zx0.length < 2) zx0 = ln.st;
    const end0 = resolveKbEnd(zx0, false, ln.len, ln.n);
    const end1 = resolveKbEnd(zx0, true, ln.len, ln.n);
    if (!end0 || !end1) continue;
    const chain = [];
    for (const [nm, km] of zx0) {
      const c = stCoord(cleanNm(nm));
      if (c) chain.push([c[0], c[1], km ?? chain.length]);
    }
    const cleanLineName = ln.n.replace(/([一-龥]{2,}(?:高速线|高铁|客专线|客专|城际线|城际|铁路|线))[一-龥]{2,4}段$/, '$1');
    metaByLid[lid] = { lid, name: ln.n, cleanName: cleanLineName, len: ln.len || 0, end0, end1, chain };
  }

  const SKIP_RE = /联络|疏解|动车|外绕|货线|环线|专用|渡线/;
  const metaByNi = new Array(KB.rail_names.length).fill(null);
  for (let ni = 0; ni < KB.rail_names.length; ni++) {
    const osmNm = KB.rail_names[ni];
    if (!osmNm || SKIP_RE.test(osmNm)) continue;
    const baseOsm = osmNm.replace(/(?:高速线|高铁|客专线|客专|城际线|城际|铁路|线)$/, '');
    const lst = [];
    for (const [lid, ln] of Object.entries(KB.lines)) {
      const m = metaByLid[lid];
      if (!m || !ln.osm || !ln.osm.length || SKIP_RE.test(ln.n) || m.len < 15) continue;
      if (ln.osm[0] === osmNm || (ln.osm.includes(osmNm) && baseOsm.length >= 2 && ln.n.startsWith(baseOsm))) {
        lst.push(m);
      }
    }
    if (!lst.length) continue;
    const maxL = Math.max(...lst.map(m => m.len));
    let filtered = lst.filter(m => m.len >= maxL * 0.15 || (baseOsm.length >= 2 && m.name.startsWith(baseOsm)));
    if (!filtered.length) filtered = lst;
    filtered.sort((a, b) => b.len - a.len);
    const cands = [];
    let totLen = 0;
    for (const m of filtered) { totLen += m.len; cands.push(m.end0, m.end1); }
    let bestA = filtered[0].end0, bestB = filtered[0].end1, bestD = -1;
    for (let i = 0; i < cands.length; i++) {
      for (let j = i + 1; j < cands.length; j++) {
        const a = cands[i], b = cands[j];
        if (a.name === b.name) continue;
        const d = Math.hypot((a.lon - b.lon) * 0.85, a.lat - b.lat);
        if (d > bestD) { bestD = d; bestA = a; bestB = b; }
      }
    }
    metaByNi[ni] = {
      ni, osmNm, totLen, segments: filtered,
      corridorEnd0: bestA, corridorEnd1: bestB,
      topLid: filtered[0].lid,
      dispName: filtered.length > 1 ? filtered[0].cleanName : filtered[0].name,
    };
  }

  const borderRails = rails.filter(r => r.ni >= 0 && r.pts.length >= 4 && metaByNi[r.ni]);
  borderMetaCache = { kb: KB, st: STBY, aux: AUX, rails, metaByLid, metaByNi, borderRails };
  borderCrossCache.key = '';
  return borderMetaCache;
}

function getBorderCrossings(s, z, bx0, by0, bx1, by1) {
  const rails = railsAt(z);
  const bm = buildBorderMeta(rails);
  if (!bm) return [];
  const c = map.getCenter();
  const key = `${c.lat.toFixed(6)}|${c.lng.toFixed(6)}|${z.toFixed(2)}|${s.x}|${s.y}|${bx1}|${selLine || ''}|${rails.length}`;
  if (borderCrossCache.key === key) return borderCrossCache.items;

  const tl = map.containerPointToLatLng([bx0, by0]);
  const br = map.containerPointToLatLng([bx1, by1]);
  const W = tl.lng, N = tl.lat, E = br.lng, S = br.lat;
  const origin = map.getPixelOrigin(), topLeft = map.containerPointToLayerPoint([0, 0]);
  const projX = lon => map.project([0, lon], z).x - origin.x - topLeft.x;
  const projY = lat => map.project([lat, 0], z).y - origin.y - topLeft.y;
  const unprojLon = x => map.unproject([x + origin.x + topLeft.x, 0], z).lng;
  const unprojLat = y => map.unproject([0, y + origin.y + topLeft.y], z).lat;

  const hl = selLine ? lineHighlight(selLine) : null;
  const minLen = selLine ? 0 : z <= 7 ? 240 : z === 8 ? 110 : z === 9 ? 40 : 18;
  const srcRails = selLine ? rails : bm.borderRails;
  const rawCrossings = [];

  // 求框内点 (x0, y0) → 框外点 (x1, y1) 与矩形 [bx0, by0, bx1, by1] 边界的交点
  const clipExit = (x0, y0, x1, y1) => {
    const dx = x1 - x0, dy = y1 - y0;
    let bestT = 2, edge = -1;
    if (dx > 1e-6 && x1 > bx1) { const t = (bx1 - x0) / dx, y = y0 + t * dy; if (t >= 0 && t <= 1 && y >= by0 && y <= by1 && t < bestT) { bestT = t; edge = 1; } }
    if (dx < -1e-6 && x1 < bx0) { const t = (bx0 - x0) / dx, y = y0 + t * dy; if (t >= 0 && t <= 1 && y >= by0 && y <= by1 && t < bestT) { bestT = t; edge = 3; } }
    if (dy > 1e-6 && y1 > by1) { const t = (by1 - y0) / dy, x = x0 + t * dx; if (t >= 0 && t <= 1 && x >= bx0 && x <= bx1 && t < bestT) { bestT = t; edge = 2; } }
    if (dy < -1e-6 && y1 < by0) { const t = (by0 - y0) / dy, x = x0 + t * dx; if (t >= 0 && t <= 1 && x >= bx0 && x <= bx1 && t < bestT) { bestT = t; edge = 0; } }
    if (edge < 0) return null;
    return { ex: x0 + bestT * dx, ey: y0 + bestT * dy, t: bestT, edge };
  };

  for (const r of srcRails) {
    let segMeta = null, niMeta = null;
    if (selLine) {
      if (!hl || !hl.names.has(r.ni)) continue;
      const bb = r.bbox;
      if (bb[2] < hl.bbox[0] || bb[0] > hl.bbox[2] || bb[3] < hl.bbox[1] || bb[1] > hl.bbox[3]) continue;
      segMeta = bm.metaByLid[selLine];
      if (!segMeta) continue;
    } else {
      if (r.cls > 2 && z < 10) continue;
      niMeta = bm.metaByNi[r.ni];
      if (!niMeta || niMeta.totLen < minLen) continue;
    }
    const bb = r.bbox;
    if (bb[2] < W || bb[0] > E || bb[3] < S || bb[1] > N) continue;
    if (bb[0] > W && bb[2] < E && bb[1] > S && bb[3] < N) continue;

    const p = r.pts, nPts = p.length >> 1;
    let prevX = projX(p[0]), prevY = projY(p[1]);
    let prevIn = prevX >= bx0 && prevX <= bx1 && prevY >= by0 && prevY <= by1;

    for (let i = 1; i < nPts; i++) {
      const curX = projX(p[2 * i]), curY = projY(p[2 * i + 1]);
      const curIn = curX >= bx0 && curX <= bx1 && curY >= by0 && curY <= by1;
      if (prevIn !== curIn) {
        const inIdx = prevIn ? i - 1 : i, outIdx = prevIn ? i : i - 1;
        const step = prevIn ? 1 : -1;
        const xIn = prevIn ? prevX : curX, yIn = prevIn ? prevY : curY;
        const xOut = prevIn ? curX : prevX, yOut = prevIn ? curY : prevY;
        const hit = clipExit(xIn, yIn, xOut, yOut);
        if (hit) {
          // 沿折线向框内、框外各取约 38 px 弦长以获得平滑稳定的切线方向
          let axIn = xIn, ayIn = yIn, lonIn = p[2 * inIdx], latIn = p[2 * inIdx + 1];
          for (let k = inIdx - step; k >= 0 && k < nPts; k -= step) {
            const kx = projX(p[2 * k]), ky = projY(p[2 * k + 1]);
            axIn = kx; ayIn = ky; lonIn = p[2 * k]; latIn = p[2 * k + 1];
            if (Math.hypot(kx - hit.ex, ky - hit.ey) >= 38) break;
          }
          let axOut = xOut, ayOut = yOut, lonOut = p[2 * outIdx], latOut = p[2 * outIdx + 1];
          for (let k = outIdx + step; k >= 0 && k < nPts; k += step) {
            const kx = projX(p[2 * k]), ky = projY(p[2 * k + 1]);
            axOut = kx; ayOut = ky; lonOut = p[2 * k]; latOut = p[2 * k + 1];
            if (Math.hypot(kx - hit.ex, ky - hit.ey) >= 38) break;
          }
          const vx = axOut - axIn, vy = ayOut - ayIn, vLen = Math.hypot(vx, vy);
          if (vLen >= 2) {
            const ux = vx / vLen, uy = vy / vLen;
            // 验证切线确实指向所穿过的边框外侧
            const outNormOk = (hit.edge === 0 && uy < -0.12) || (hit.edge === 2 && uy > 0.12)
                           || (hit.edge === 3 && ux < -0.12) || (hit.edge === 1 && ux > 0.12);
            if (outNormOk) {
              const lonE = unprojLon(hit.ex), latE = unprojLat(hit.ey);
              const cosLat = Math.cos(latE * Math.PI / 180) || 0.8;
              const gvx = (lonOut - lonIn) * cosLat, gvy = latOut - latIn;
              // 匹配当前交点所在的客里表分段并判定上/下行终点方向
              let activeSeg = segMeta;
              if (!activeSeg && niMeta) {
                activeSeg = niMeta.segments[0];
                if (niMeta.segments.length > 1) {
                  let bestSegD = Infinity;
                  for (const sm of niMeta.segments) {
                    for (const pt of sm.chain) {
                      const d = Math.hypot((pt[0] - lonE) * cosLat, pt[1] - latE);
                      if (d < bestSegD) { bestSegD = d; activeSeg = sm; }
                    }
                  }
                }
              }
              if (activeSeg) {
                const ch = activeSeg.chain;
                let sx = (activeSeg.end1.lon - activeSeg.end0.lon) * cosLat, sy = activeSeg.end1.lat - activeSeg.end0.lat;
                if (ch.length >= 2) {
                  let bestK = 0, bestKD = Infinity;
                  for (let k = 0; k < ch.length - 1; k++) {
                    const mx = (ch[k][0] + ch[k + 1][0]) * 0.5, my = (ch[k][1] + ch[k + 1][1]) * 0.5;
                    const d = Math.hypot((mx - lonE) * cosLat, my - latE);
                    if (d < bestKD) { bestKD = d; bestK = k; }
                  }
                  const k0 = Math.max(0, bestK), k1 = Math.min(ch.length - 1, bestK + 1);
                  const dsx = (ch[k1][0] - ch[k0][0]) * cosLat, dsy = ch[k1][1] - ch[k0][1];
                  if (Math.hypot(dsx, dsy) > 1e-4) { sx = dsx; sy = dsy; }
                }
                const towardsEnd1 = (gvx * sx + gvy * sy) >= 0;
                let targetEnd = towardsEnd1 ? activeSeg.end1 : activeSeg.end0;
                let otherEnd = towardsEnd1 ? activeSeg.end0 : activeSeg.end1;
                if (!selLine && niMeta && niMeta.segments.length > 1) {
                  const segDx = (activeSeg.end1.lon - activeSeg.end0.lon) * cosLat, segDy = activeSeg.end1.lat - activeSeg.end0.lat;
                  const corDx = (niMeta.corridorEnd1.lon - niMeta.corridorEnd0.lon) * cosLat, corDy = niMeta.corridorEnd1.lat - niMeta.corridorEnd0.lat;
                  const samePolarity = (segDx * corDx + segDy * corDy) >= 0;
                  const pickCor1 = towardsEnd1 ? samePolarity : !samePolarity;
                  targetEnd = pickCor1 ? niMeta.corridorEnd1 : niMeta.corridorEnd0;
                  otherEnd = pickCor1 ? niMeta.corridorEnd0 : niMeta.corridorEnd1;
                }
                const lineName = selLine ? activeSeg.name : (niMeta.segments.length > 1 ? niMeta.dispName : activeSeg.cleanName);
                // 若该方向终点站本身已在当前地图视野内（或距出框点 < 3.5 km），不标出框方向
                const endInView = targetEnd.lon >= W && targetEnd.lon <= E && targetEnd.lat >= S && targetEnd.lat <= N;
                const distToEndKm = Math.hypot((targetEnd.lon - lonE) * cosLat * 111, (targetEnd.lat - latE) * 111);
                if (!endInView && distToEndKm >= 3.5) {
                  rawCrossings.push({
                    ex: hit.ex, ey: hit.ey, ux, uy, edge: hit.edge,
                    cls: r.cls, single: r.single || 0, ni: r.ni,
                    lid: activeSeg.lid,
                    lineName,
                    dirName: targetEnd.name,
                    fromName: otherEnd.name,
                    totLen: selLine ? activeSeg.len : niMeta.totLen,
                    distToEndKm,
                  });
                }
              }
            }
          }
        }
      }
      prevX = curX; prevY = curY; prevIn = curIn;
    }
  }

  // 同线路 + 同方向在相近位置（85 px 内）的多股道交点聚类合并；若同一方向沿边框进出多次，只取离该终点最近的一处出框交点
  const groups = new Map();
  for (const c of rawCrossings) {
    const gk = c.lineName + '|' + c.dirName;
    let list = groups.get(gk); if (!list) groups.set(gk, list = []);
    const near = list.find(m => Math.hypot(m.ex - c.ex, m.ey - c.ey) < 85);
    if (!near) {
      list.push({ ...c, wSum: c.single ? 0.6 : 1, exSum: c.ex * (c.single ? 0.6 : 1), eySum: c.ey * (c.single ? 0.6 : 1), uxSum: c.ux * (c.single ? 0.6 : 1), uySum: c.uy * (c.single ? 0.6 : 1) });
    } else {
      const w = c.single ? 0.6 : 1;
      near.wSum += w; near.exSum += c.ex * w; near.eySum += c.ey * w;
      near.uxSum += c.ux * w; near.uySum += c.uy * w;
      near.ex = near.exSum / near.wSum; near.ey = near.eySum / near.wSum;
      const ul = Math.hypot(near.uxSum, near.uySum) || 1;
      near.ux = near.uxSum / ul; near.uy = near.uySum / ul;
      if (c.cls < near.cls) near.cls = c.cls;
      if (!c.single) near.single = 0;
      if (c.distToEndKm < near.distToEndKm) near.distToEndKm = c.distToEndKm;
    }
  }
  const merged = [];
  for (const list of groups.values()) {
    list.sort((a, b) => a.distToEndKm - b.distToEndKm);
    merged.push(list[0]);
  }
  borderCrossCache = { key, items: merged };
  return merged;
}

function drawBorderLines(ctx, s) {
  borderShown = [];
  const z = map.getZoom();
  if (!KB || z < 8) return;

  const bx0 = 0, by0 = 0, bx1 = s.x, by1 = s.y;
  const mr = map.getContainer().getBoundingClientRect();

  const items = getBorderCrossings(s, z, bx0, by0, bx1, by1);
  if (!items.length) return;

  // 若选中了车次，识别该车次走过的底图线名集合以高亮对应出框方向
  let focusNis = null;
  if (sel && D && D.glines && D.line_names && KB) {
    focusNis = new Set();
    const rnMap = KB._rnIdx || (KB._rnIdx = new Map(KB.rail_names.map((n, i) => [n, i])));
    for (const leg of sel.l) if (leg && D.glines[leg[0]]) {
      for (const seg of D.glines[leg[0]]) if (seg[1] >= 0) {
        const ni = rnMap.get(D.line_names[seg[1]]);
        if (ni != null) focusNis.add(ni);
      }
    }
  }

  // UI 控件禁区：
  // - blockBoxes（大浮层：#panel、#legend、#hist、左上缩放按钮）：出框交点若被其遮挡则直接隐藏，不往地图中间退
  // - edgeBars（右下角薄边栏：比例尺、版权栏）：出框交点落在其中时，顺着轨道往框内微退到薄栏上沿
  const blockBoxes = [[0, 0, 50, 90]], edgeBars = [];
  for (const el of [$('panel'), $('drawer'), $('legend'), $('legbtn'), $('hist'), ...document.querySelectorAll('.leaflet-control-zoom')]) {
    if (el && el.offsetParent !== null) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        blockBoxes.push([r.left - mr.left - 4, r.top - mr.top - 4, r.right - mr.left + 4, r.bottom - mr.top + 4]);
      }
    }
  }
  for (const el of document.querySelectorAll('.leaflet-control-scale, .leaflet-control-attribution')) {
    if (el && el.offsetParent !== null) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        edgeBars.push([r.left - mr.left - 3, r.top - mr.top - 3, r.right - mr.left + 3, r.bottom - mr.top + 3]);
      }
    }
  }
  const uiBoxes = [...blockBoxes, ...edgeBars];
  const inBlockBox = (x, y) => blockBoxes.some(b => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]);
  const inEdgeBar = (x, y) => edgeBars.some(b => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]);
  const hitAny = boxes => boxes.some(b =>
    uiBoxes.some(q => b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1]) ||
    stLabelBoxes.some(q => b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1])
  );

  // 优先级排序：选中线路/选中车次经过 > 线路等级 (cls 0→3) > 线路总长
  const sorted = items.slice().sort((a, b) => {
    const fa = (selLine && a.lid === selLine) || (focusNis && focusNis.has(a.ni)) ? 1 : 0;
    const fb = (selLine && b.lid === selLine) || (focusNis && focusNis.has(b.ni)) ? 1 : 0;
    return (fb - fa) || (a.cls - b.cls) || (b.totLen - a.totLen);
  });

  const bg = css('--bg'), fg = css('--fg'), mu = css('--muted'), selC = css('--sel'), hlC = css('--hl');
  const clsColors = [css('--r0'), css('--r1'), css('--r2'), mu];
  const fs = z >= 10 ? 11.5 : 11;
  const fontLine = `600 ${fs}px system-ui, -apple-system, "PingFang SC", sans-serif`;
  const fontDir = `500 ${fs}px system-ui, -apple-system, "PingFang SC", sans-serif`;

  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  for (const item of sorted) {
    const { ex, ey, ux, uy, edge } = item;
    // 避开视口四角 18 px 与大浮层遮挡区
    if ((ex < bx0 + 18 || ex > bx1 - 18) && (ey < by0 + 18 || ey > by1 - 18)) continue;
    if (inBlockBox(ex, ey)) continue;

    // 若出框交点落在右下角版权栏或比例尺薄条内，顺着轨道往框内退到薄条上沿外侧
    let ax = ex, ay = ey;
    if (inEdgeBar(ax, ay)) {
      let escaped = false;
      for (let d = 3; d <= 90; d += 3) {
        const tx0 = ex - ux * d, ty0 = ey - uy * d;
        if (tx0 < bx0 + 2 || tx0 > bx1 - 2 || ty0 < by0 + 2 || ty0 > by1 - 2) continue;
        if (!inEdgeBar(tx0, ty0) && !inBlockBox(tx0, ty0)) {
          ax = ex - ux * (d + 4);
          ay = ey - uy * (d + 4);
          escaped = true;
          break;
        }
      }
      if (!escaped) continue;
    }

    const isFocus = (selLine && item.lid === selLine) || (focusNis && focusNis.has(item.ni));
    const dim = (sel && focusNis && !focusNis.has(item.ni)) || (selSt && !selLine && focus);
    const lineColor = selLine && item.lid === selLine ? hlC : (sel && isFocus ? selC : clsColors[Math.min(3, item.cls)]);
    const dirColor = isFocus ? fg : mu;

    const lineTxt = item.lineName;
    const dirTxt = ' ' + dn(item.dirName) + '方向';
    ctx.font = fontLine; const wLine = ctx.measureText(lineTxt).width;
    ctx.font = fontDir;  const wDir = ctx.measureText(dirTxt).width;
    const arrowW = 10;
    const totalW = wLine + wDir + arrowW;
    const halfW = totalW / 2, halfH = fs / 2 + 1.5;

    // 顺轨旋转角 ang ∈ (-π/2, π/2]，保证字头始终朝上；outSign = +1 表示向右出框（箭头在右端 ▸），-1 表示向左出框（箭头在左端 ◂）
    const outSign = ux >= -0.02 ? 1 : -1;
    const ang = outSign > 0 ? Math.atan2(uy, ux) : Math.atan2(-uy, -ux);
    const tx = Math.cos(ang), ty = Math.sin(ang);
    const nx = -ty, ny = tx; // 旋转坐标系 +Y 法线（屏幕偏下方）

    // 边框内法线：用于判断轨道哪一侧更远离边框，以及擦边出框时往框内推入
    const enx = edge === 3 ? 1 : edge === 1 ? -1 : 0;
    const eny = edge === 0 ? 1 : edge === 2 ? -1 : 0;
    // 优先选择法线朝向框内开阔侧（与边框内法线同向）或屏幕上方侧
    const sidePref = (nx * enx + ny * eny) > 0.15 ? 1 : -1;
    const sideCands = [sidePref, -sidePref];
    const normOffsets = [7.5, 18.5];
    const alongShifts = [0, 22, 44];

    let chosen = null;
    for (const alongAdd of alongShifts) {
      for (const normDist of normOffsets) {
        for (const side of sideCands) {
          const dAlong = halfW + 7 + alongAdd;
          const dNorm = side * normDist;
          let cx = ax - ux * dAlong + nx * dNorm;
          let cy = ay - uy * dAlong + ny * dNorm;

          // 检查旋转矩形四角是否超出安全视口 [bx0+5, by0+5, bx1-5, by1-5] 或压到右下角版权/比例尺条，若超出则往框内微推
          let pushX = 0, pushY = 0;
          for (const sx of [-halfW, halfW]) {
            for (const sy of [-halfH, halfH]) {
              const px = cx + tx * sx + nx * sy;
              const py = cy + ty * sx + ny * sy;
              if (px < bx0 + 5) pushX = Math.max(pushX, (bx0 + 5) - px);
              if (px > bx1 - 5) pushX = Math.min(pushX, (bx1 - 5) - px);
              if (py < by0 + 5) pushY = Math.max(pushY, (by0 + 5) - py);
              let limY = by1 - 5;
              for (const ub of uiBoxes) {
                if (ub[1] > by1 - 65 && px >= ub[0] && px <= ub[2]) limY = Math.min(limY, ub[1] - 2);
              }
              if (py > limY) pushY = Math.min(pushY, limY - py);
            }
          }
          cx += pushX; cy += pushY;

          // 沿顺轨文字中心线生成一串小包围盒（避免 45° 斜文字用单个大矩形造成虚碰撞）
          const nSeg = Math.max(3, Math.ceil(totalW / 13));
          const segBoxes = [];
          for (let k = 0; k < nSeg; k++) {
            const u = (k / (nSeg - 1) - 0.5) * (totalW - 6);
            const sx = cx + tx * u, sy = cy + ty * u;
            segBoxes.push([sx - halfH, sy - halfH, sx + halfH, sy + halfH]);
          }
          if (!hitAny(segBoxes)) {
            chosen = { cx, cy, segBoxes };
            break;
          }
        }
        if (chosen) break;
      }
      if (chosen) break;
    }
    if (!chosen) continue;

    for (const b of chosen.segBoxes) stLabelBoxes.push(b);

    ctx.save();
    ctx.globalAlpha = dim ? 0.45 : 0.96;

    // 1. 在外框交点内侧轨道上画一枚顺轨短刻度与出框小标记
    const tickInX = ax - ux * 3.5, tickInY = ay - uy * 3.5;
    const tnx = -uy, tny = ux;
    ctx.beginPath();
    ctx.moveTo(tickInX - tnx * 4, tickInY - tny * 4);
    ctx.lineTo(tickInX + tnx * 4, tickInY + tny * 4);
    ctx.lineWidth = 3.2; ctx.strokeStyle = bg; ctx.stroke();
    ctx.lineWidth = 1.8; ctx.strokeStyle = lineColor; ctx.stroke();

    // 2. 顺轨倾斜文字 + 指向框外的三角方向矢
    ctx.translate(chosen.cx, chosen.cy);
    ctx.rotate(ang);
    ctx.textAlign = 'left';

    const drawArrow = (tipX, dir) => {
      // dir = +1 指向 +X (▸)，dir = -1 指向 -X (◂)
      const base = tipX - dir * 6.5;
      ctx.beginPath();
      ctx.moveTo(tipX, 0);
      ctx.lineTo(base, -3.5);
      ctx.lineTo(base + dir * 1.4, 0);
      ctx.lineTo(base, 3.5);
      ctx.closePath();
      ctx.lineWidth = 3; ctx.strokeStyle = bg; ctx.stroke();
      ctx.fillStyle = lineColor; ctx.fill();
    };

    let textStartX;
    if (outSign > 0) {
      // 向右半屏出框：文字在左，箭头在最右端指向框外 (京广线 广州方向 ▸)
      textStartX = -halfW;
      drawArrow(halfW - 1, 1);
    } else {
      // 向左半屏出框：箭头在最左端指向框外，文字在右 (◂ 京广线 广州方向)
      drawArrow(-halfW + 1, -1);
      textStartX = -halfW + arrowW;
    }

    ctx.font = fontLine;
    ctx.lineWidth = 3.5; ctx.strokeStyle = bg;
    ctx.strokeText(lineTxt, textStartX, 0);
    ctx.fillStyle = lineColor;
    ctx.fillText(lineTxt, textStartX, 0);

    ctx.font = fontDir;
    ctx.lineWidth = 3.5; ctx.strokeStyle = bg;
    ctx.strokeText(dirTxt, textStartX + wLine, 0);
    ctx.fillStyle = dirColor;
    ctx.fillText(dirTxt, textStartX + wLine, 0);

    ctx.restore();

    borderShown.push({
      item, cx: chosen.cx, cy: chosen.cy, tx, ty, nx, ny, halfW: halfW + 3, halfH: halfH + 2
    });
  }
  ctx.restore();
}

function pickBorderLine(e) {
  if (!borderShown.length) return null;
  const p = map.mouseEventToContainerPoint(e.originalEvent);
  for (const b of borderShown) {
    const dx = p.x - b.cx, dy = p.y - b.cy;
    const lx = dx * b.tx + dy * b.ty, ly = dx * b.nx + dy * b.ny;
    const sl = isTouch() ? 6 : 0;
    if (Math.abs(lx) <= b.halfW + sl && Math.abs(ly) <= b.halfH + sl) return b.item;
  }
  return null;
}
function pickAux(e) {
  const p = map.mouseEventToContainerPoint(e.originalEvent); let best = null, bd = Infinity;
  for (const x of auxShown) {
    const d = Math.hypot(x.p.x - p.x, x.p.y - p.y), b = x.box;
    if (b && p.x >= b[0] && p.x <= b[2] && p.y >= b[1] && p.y <= b[3]) return x;
    if (d < x.hr + (isTouch() ? 6 : 0) && d < bd) { bd = d; best = x; }
  }
  return best;
}
function showAuxTip(x) {
  const t = $('auxtip');
  if (!x) { t.style.display = 'none'; return; }
  const ln = x.a.lines.map(id => KB && KB.lines[id] ? KB.lines[id].n : '').filter(Boolean).join('、');
  const swTxt = x.a.sw === 1 ? 'OSM 有站线道岔' : x.a.sw === 0 ? 'OSM 未见站线道岔（可能未画，待核）' : '';
  t.innerHTML = `<b>${dn(x.a.name)}</b>　${AUX_NAME[x.a.kind]}${ln ? `<br><span class="note">${ln}</span>` : ''}${swTxt ? `<br><span class="note">${swTxt}</span>` : ''}`;
  t.style.display = 'block'; t.style.left = Math.round(x.p.x + 10) + 'px'; t.style.top = Math.round(x.p.y + 10) + 'px';
}
