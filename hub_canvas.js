/**
 * /Users/scat/Projects/railmap/src/railmap/viz/hub_canvas.js
 * 
 * Standalone high-density map canvas rendering module for Hub Theater (hub.html).
 * Handles:
 *  1. window.drawSpeedTail()       - Kinetic comet speed tails along actual track geometry
 *  2. window.drawHubTrainIcon()    - Streamlined directional capsules / head badges + headlights
 *  3. window.drawHubTrainLabels()  - 2D radial collision avoidance + anti-jitter memory + leader lines
 *  4. window.drawHubAchievements() - Floating map callout cards with leader lines and fade/slide animations
 */

(function (global) {
  'use strict';

  // ===== CONFIGURATION & MODES =====
  // 'marker' (default: 24x12 车型涂装极简色块 Marker from emu_icons.js) | 'capsule' | 'head'
  global.HUB_ICON_MODE = global.HUB_ICON_MODE || 'marker';

  function resolveHubMarkerModel(tr) {
    if (!tr) return 'CR400AF';
    if (tr._hubMk) return tr._hubMk;
    if (tr.m && typeof global.resolveEmuModel === 'function') {
      const k = global.resolveEmuModel(tr.m);
      if (k) return (tr._hubMk = k);
    }
    if (tr.dj) return (tr._hubMk = 'CR200J1');
    const code = (tr.c || '').split('/')[0];
    const c0 = code[0] || '';
    const num = parseInt(code.replace(/\D+/g, ''), 10) || 0;
    if (tr.fx) return (tr._hubMk = (num % 2 === 0 ? 'CR400BF' : 'CR400AF'));
    if (c0 === 'G') return (tr._hubMk = (num % 2 === 0 ? 'CRH380B' : 'CRH380A'));
    if (c0 === 'D') return (tr._hubMk = (num % 2 === 0 ? 'CRH2A' : 'CRH5A'));
    if (c0 === 'C' || c0 === 'S') {
      if (/^S2\d\d$/.test(code)) return (tr._hubMk = 'DF11G');
      return (tr._hubMk = (c0 === 'C' ? 'CRH3C' : 'CRH6A'));
    }
    if (c0 === 'Z') return (tr._hubMk = (num % 3 === 0 ? 'DF11G' : 'HXD3D'));
    if (c0 === 'T') return (tr._hubMk = (num % 3 === 0 ? 'SS9G' : 'HXD1D'));
    if (c0 === 'K') return (tr._hubMk = (num % 3 === 0 ? 'DF4D' : num % 2 === 0 ? 'HXD3C' : 'HXD3D'));
    return (tr._hubMk = (num % 2 === 0 ? 'DF4B' : 'DF4D'));
  }
  global.resolveHubMarkerModel = resolveHubMarkerModel;

  const TRAIN_FONT_CONDENSED = 'bold 11.5px "DIN Alternate", "Bahnschrift", ui-monospace, system-ui, sans-serif';
  const BADGE_FONT = 'bold 10px "DIN Alternate", "Bahnschrift", ui-monospace, system-ui, sans-serif';
  const TOAST_FONT_TAG = 'bold 10px system-ui, -apple-system, sans-serif';
  const TOAST_FONT_TITLE = 'bold 12px system-ui, -apple-system, sans-serif';
  const TOAST_FONT_DESC = '11px system-ui, -apple-system, sans-serif';

  // Livery & class colors
  const EMU_SET = new Set(['S', 'W', 'J']);

  const COLOR_PALETTES = {
    light: {
      bg: '#ffffff',
      fg: '#1e293b',
      muted: '#64748b',
      line: '#cbd5e1',
      sel: '#e6007e',
      gold: '#d4a017',
      goldBg: '#fef3c7',
      goldBorder: '#f59e0b',
      leaderLine: 'rgba(100, 116, 139, 0.75)',
      pillBg: 'rgba(255, 255, 255, 0.94)',
      pillBorder: 'rgba(15, 23, 42, 0.16)',
      edge: '#475569',
      // Class colors
      classG: '#1d4ed8',
      classCD: '#0e7490',
      classS: '#b45309',
      classZT: '#991b1b',
      classK: '#15803d',
      // Livery bodies
      tS: '#94a3b8',
      tW: '#f8fafc',
      tJ: '#16a34a',
      tZT: '#65a30d',
      tK: '#15803d',
      tO: '#047857'
    },
    dark: {
      bg: '#0f172a',
      fg: '#f8fafc',
      muted: '#94a3b8',
      line: '#334155',
      sel: '#ff4fc0',
      gold: '#f0c040',
      goldBg: 'rgba(120, 53, 15, 0.28)',
      goldBorder: '#fbbf24',
      leaderLine: 'rgba(148, 163, 184, 0.65)',
      pillBg: 'rgba(15, 23, 42, 0.90)',
      pillBorder: 'rgba(255, 255, 255, 0.22)',
      edge: '#0f172a',
      // Class neon colors
      classG: '#60a5fa',
      classCD: '#22d3ee',
      classS: '#fbbf24',
      classZT: '#f87171',
      classK: '#4ade80',
      // Livery bodies
      tS: '#94a3b8',
      tW: '#d6d1c4',
      tJ: '#3fb57a',
      tZT: '#a3b36a',
      tK: '#58b05b',
      tO: '#2f7d52'
    }
  };

  function getThemeColors(theme) {
    if (theme && COLOR_PALETTES[theme]) return COLOR_PALETTES[theme];
    if (typeof document !== 'undefined' && document.documentElement) {
      if (document.documentElement.classList.contains('dark') ||
          (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        return COLOR_PALETTES.dark;
      }
    }
    return COLOR_PALETTES.light;
  }

  // Parse color string to [r, g, b]
  function parseRgb(colorStr, fallback) {
    if (!colorStr) return fallback || [30, 64, 175];
    if (colorStr.startsWith('#')) {
      let c = colorStr.slice(1);
      if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
      const num = parseInt(c, 16);
      if (!isNaN(num)) return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    }
    const m = colorStr.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (m) return [+m[1], +m[2], +m[3]];
    return fallback || [30, 64, 175];
  }

  // Geographic interpolation helper: km along g
  function getGeomPos(g, km) {
    if (typeof global.geomPos === 'function') return global.geomPos(g, km);
    if (!g || !g.km || !g.km.length) return [0, 0];
    const k = g.km;
    let lo = 0, hi = k.length - 1;
    if (km <= k[0]) return [g.lat[0], g.lon[0]];
    if (km >= k[hi]) return [g.lat[hi], g.lon[hi]];
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (k[mid] <= km) lo = mid; else hi = mid;
    }
    const u = (km - k[lo]) / (k[hi] - k[lo] || 1);
    return [g.lat[lo] + u * (g.lat[hi] - g.lat[lo]), g.lon[lo] + u * (g.lon[hi] - g.lon[lo])];
  }

  // Project [lat, lon] to pixel coordinates {x, y} on canvas
  function projectToPx(map, latLng) {
    if (!map) return { x: 0, y: 0 };
    if (typeof map.latLngToContainerPoint === 'function') {
      if (typeof map.project === 'function' && typeof map.getPixelOrigin === 'function' && typeof map.containerPointToLayerPoint === 'function') {
        try {
          const q = map.project(latLng, map.getZoom());
          const o = map.getPixelOrigin();
          const tl = map.containerPointToLayerPoint([0, 0]);
          return { x: q.x - o.x - tl.x, y: q.y - o.y - tl.y };
        } catch (e) {
          return map.latLngToContainerPoint(latLng);
        }
      }
      return map.latLngToContainerPoint(latLng);
    }
    if (typeof map.projectPoint === 'function') return map.projectPoint(latLng);
    return { x: latLng[1] || 0, y: latLng[0] || 0 };
  }

  // Compute direction angle (screen radians) from back to ahead
  function getAngle(back, ahead, map) {
    if (back && ahead) {
      if (typeof back.x === 'number' && typeof ahead.x === 'number') {
        const dx = ahead.x - back.x, dy = ahead.y - back.y;
        if (dx !== 0 || dy !== 0) return Math.atan2(dy, dx);
      }
      if (Array.isArray(back) && Array.isArray(ahead)) {
        if (map && typeof map.project === 'function') {
          const z = map.getZoom ? map.getZoom() : 10;
          const b = map.project(back, z), a = map.project(ahead, z);
          if (a.x !== b.x || a.y !== b.y) return Math.atan2(a.y - b.y, a.x - b.x);
        }
        const latRad = ((back[0] + ahead[0]) / 2) * Math.PI / 180;
        const dx = (ahead[1] - back[1]) * Math.cos(latRad);
        const dy = -(ahead[0] - back[0]); // screen y is downward
        if (dx !== 0 || dy !== 0) return Math.atan2(dy, dx);
      }
    }
    return -Math.PI / 2; // Default facing upward (North)
  }

  // Helper to draw rounded rectangle
  function roundRect(ctx, x, y, w, h, r) {
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.closePath();
      return;
    }
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    if (typeof ctx.arcTo === 'function') {
      ctx.arcTo(x + w, y, x + w, y + radius, radius);
      ctx.lineTo(x + w, y + h - radius);
      ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
      ctx.lineTo(x + radius, y + h);
      ctx.arcTo(x, y + h, x, y + h - radius, radius);
      ctx.lineTo(x, y + radius);
      ctx.arcTo(x, y, x + radius, y, radius);
    } else {
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  // Train classification color picker
  function getClassColor(code, themeColors) {
    const h = (code || '').trim()[0];
    if (h === 'G') return themeColors.classG;
    if (h === 'C' || h === 'D') return themeColors.classCD;
    if (h === 'S') return themeColors.classS;
    if (h === 'Z' || h === 'T') return themeColors.classZT;
    return themeColors.classK;
  }

  // Livery base color picker
  function getLiveryColor(tr, themeColors) {
    if (!tr) return themeColors.tO;
    const lv = tr.lv;
    if (lv && themeColors['t' + lv]) return themeColors['t' + lv];
    const h = (tr.c || '')[0];
    if (tr.tier && tr.tier >= 300) return themeColors.tS;
    if (tr.tier && tr.tier >= 200) return themeColors.tW;
    if (h === 'G') return themeColors.tS;
    if (h === 'D' || h === 'C') return themeColors.tW;
    if (h === 'Z' || h === 'T') return themeColors.tZT;
    if (h === 'K') return themeColors.tK;
    return themeColors.tO;
  }

  // =========================================================================
  // 1. window.drawSpeedTail(ctx, map, tr, st, leg, color, isInset)
  // =========================================================================
  /**
   * Draws a sleek "comet speed trail" behind moving trains along their actual track geometry G[leg[0]]
   * 
   * @param {CanvasRenderingContext2D} ctx - Target 2D canvas context
   * @param {Object} map - Map instance with projection methods
   * @param {Object} tr - Train metadata
   * @param {Object} st - Train kinematics state { pos, kmh, km, moving, ... }
   * @param {Array} leg - Current leg [gi, t0, t1, legKm, ...]
   * @param {string} color - Desired color (hex or rgb/rgba)
   * @param {boolean} isInset - Whether rendering inside high-zoom inset viewport
   */
  function drawSpeedTail(ctx, map, tr, st, leg, color, isInset) {
    if (!ctx || !map || !st || !leg) return;
    if (st.moving === false) return;

    const kmh = st.kmh || 0;
    if (kmh < 4) return; // Negligible or zero speed, skip trail

    // Lookup track geometry
    const gi = leg[0];
    const G = global.G || (map && map.G) || null;
    const g = (G && G[gi]) || (tr && tr._g) || null;
    if (!g || !g.km || g.km.length < 2) return;

    // Trail distance calculation:
    // Scale with speed, capped at 4.5km on main map, or shorter on high-zoom inset
    const baseTailKm = Math.min(4.5, Math.max(0.4, kmh / 80));
    const tailKm = isInset ? Math.min(0.9, Math.max(0.12, baseTailKm * 0.22)) : baseTailKm;

    const curKm = typeof st.km === 'number' ? st.km : leg[3];
    const k0 = g.km[0];
    const kN = g.km[g.km.length - 1];

    const tailStartKm = Math.max(k0, curKm - tailKm);
    const tailEndKm = Math.min(kN, curKm);
    if (tailEndKm <= tailStartKm) return;

    // Sample 6-8 points backwards along track geometry
    const SAMPLES = isInset ? 6 : 8;
    const pts = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const u = i / SAMPLES;
      const k = tailStartKm + u * (tailEndKm - tailStartKm);
      const ll = getGeomPos(g, k);
      const pt = projectToPx(map, ll);
      pts.push(pt);
    }

    if (pts.length < 2) return;

    const rgb = parseRgb(color, [59, 130, 246]);
    const maxAlpha = 0.65;
    const minWidth = isInset ? 1.4 : 0.9;
    const maxWidth = isInset ? 5.2 : 3.8;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw tapered segments with progressive opacity
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      if (Math.abs(p1.x - p2.x) < 0.1 && Math.abs(p1.y - p2.y) < 0.1) continue;

      const t = (i + 1) / SAMPLES; // 0 (tail tip) -> 1.0 (train rear)
      const alpha = Math.pow(t, 1.4) * maxAlpha;
      const width = minWidth + (maxWidth - minWidth) * t;

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineWidth = width;
      ctx.strokeStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha.toFixed(3)})`;
      ctx.stroke();
    }

    // High-speed glow slipstream for trains cruising at >= 220 km/h
    if (kmh >= 220 && pts.length >= 4) {
      ctx.beginPath();
      const pStart = pts[Math.floor(pts.length * 0.45)];
      ctx.moveTo(pStart.x, pStart.y);
      for (let j = Math.floor(pts.length * 0.45) + 1; j < pts.length; j++) {
        ctx.lineTo(pts[j].x, pts[j].y);
      }
      ctx.lineWidth = maxWidth * 1.8;
      ctx.strokeStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.18)`;
      ctx.stroke();
    }

    ctx.restore();
  }

  // =========================================================================
  // 2. window.drawHubTrainIcon(ctx, p, back, ahead, tr, isSel, isInset, theme)
  // =========================================================================
  /**
   * Draws the train nose/capsule oriented along back -> ahead
   * Returns clean anchor { x, y } & bounding box [minX, minY, maxX, maxY] for labeling.
   * Supports 'capsule' and 'head' modes.
   */
  function drawHubTrainIcon(ctx, p, back, ahead, tr, isSel, isInset, theme, st, mapObj) {
    if (!ctx || !p) return null;

    const themeColors = getThemeColors(theme);
    const mode = global.HUB_ICON_MODE || 'marker';
    const ang = getAngle(back, ahead, mapObj);

    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const lx = sin;   // Left-hand normal (screen y downward)
    const ly = -cos;

    const emu = EMU_SET.has(tr.lv) || (tr.tier && tr.tier >= 160) || ['G', 'C', 'D'].includes((tr.c || '')[0]);
    const isFx = !!tr.fx;
    const code = (tr.c || '').split('/')[0];

    // ----- MODE: 'marker' (Default: New 24x12 Livery Marker from emu_icons.js MARKER_LIB) -----
    if (mode === 'marker' && typeof global.getMarker2D === 'function') {
      const m = global.getMarker2D(resolveHubMarkerModel(tr));
      if (m) {
        const z = (mapObj && typeof mapObj.getZoom === 'function') ? mapObj.getZoom() : (isInset ? 12.6 : 9.4);
        const baseR = z >= 16 ? 36 : z >= 15 ? 30 : z >= 14 ? 24 : z >= 13 ? 19.5 : z >= 12 ? 15.8 : z >= 11 ? 12.6 : z >= 10 ? 10.2 : z >= 9 ? 8.5 : 6.8;
        const r = isSel ? baseR * 1.22 + 1.5 : baseR;
        const w = r * 1.05;
        const len = w * (22 / 8);
        const tx = p.x - cos * len * 0.3;
        const ty = p.y - sin * len * 0.3;
        const sx = len / 22;
        const sy = w / 8;

        ctx.save();
        ctx.transform(
          -sx * cos, -sx * sin,
          -sy * lx, -sy * ly,
          tx + 23 * sx * cos + 10.5 * sy * lx,
          ty + 23 * sx * sin + 10.5 * sy * ly
        );
        const invS = 1 / Math.sqrt(sx * sy);
        if (isSel) {
          ctx.lineJoin = 'round';
          ctx.lineWidth = 3.2 * invS;
          ctx.strokeStyle = themeColors.sel;
          ctx.stroke(m.bodyPath);
        }
        ctx.fillStyle = m.baseFill;
        ctx.fill(m.bodyPath);
        if (z >= 6) {
          ctx.save();
          ctx.clip(m.bodyPath);
          for (const [p2d, col] of m.layers) {
            ctx.fillStyle = col;
            ctx.fill(p2d);
          }
          ctx.restore();
        }
        ctx.lineJoin = 'round';
        ctx.lineWidth = (isSel ? 0.95 : z >= 9 ? 0.75 : 0.58) * invS;
        ctx.strokeStyle = theme === 'dark' ? '#1e293b' : '#525c68';
        ctx.stroke(m.bodyPath);
        ctx.restore();

        const P = (u, v) => [tx + cos * u + lx * v, ty + sin * u + ly * v];
        const midX = tx + cos * len * 0.5;
        const midY = ty + sin * len * 0.5;
        const anchor = {
          x: midX + lx * (w + 4.5),
          y: midY + ly * (w + 4.5)
        };
        const corners = [P(0, 0), P(0, w), P(len, 0), P(len, w)];
        const xs = corners.map(pt => pt[0]);
        const ys = corners.map(pt => pt[1]);
        return {
          anchor,
          box: [Math.min(...xs) - 2, Math.min(...ys) - 2, Math.max(...xs) + 2, Math.max(...ys) + 2],
          ang
        };
      }
    }

    // ----- MODE: 'head' (Compact badge with mini nose + code pill) -----
    if (mode === 'head') {
      const h = isInset ? 18 : 15;
      const fs = isInset ? 11 : 9.5;
      ctx.save();
      ctx.font = `bold ${fs}px "DIN Alternate", "Bahnschrift", ui-monospace, sans-serif`;
      const tw = ctx.measureText(code).width;
      const w = Math.max(34, tw + 22);

      const bx = p.x - w / 2;
      const by = p.y - h / 2;

      // Outer pill
      ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1.5;
      roundRect(ctx, bx, by, w, h, h / 2);
      ctx.fillStyle = isSel ? themeColors.sel : (theme === 'dark' ? '#1e293b' : '#ffffff');
      ctx.fill();
      ctx.shadowColor = 'transparent';

      ctx.lineWidth = isSel ? 1.8 : 1.0;
      ctx.strokeStyle = isSel ? '#ffffff' : (theme === 'dark' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)');
      ctx.stroke();

      // Mini locomotive nose glyph on left
      const iconX = bx + 4;
      const iconY = by + (h - 8) / 2;
      ctx.beginPath();
      if (emu) {
        ctx.moveTo(iconX, iconY + 8);
        ctx.lineTo(iconX + 9, iconY + 8);
        ctx.lineTo(iconX + 6, iconY);
        ctx.lineTo(iconX, iconY);
      } else {
        ctx.moveTo(iconX, iconY + 8);
        ctx.lineTo(iconX + 8, iconY + 8);
        ctx.arcTo(iconX + 8, iconY, iconX + 4, iconY, 4);
        ctx.lineTo(iconX, iconY);
      }
      ctx.closePath();
      ctx.fillStyle = isSel ? '#ffffff' : (isFx ? themeColors.gold : getClassColor(code, themeColors));
      ctx.fill();

      // Train code text
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isSel ? '#ffffff' : (theme === 'dark' ? '#f8fafc' : '#0f172a');
      ctx.fillText(code, bx + 16, by + h / 2);
      ctx.restore();

      const box = [bx - 2, by - 2, bx + w + 2, by + h + 2];
      return {
        anchor: { x: p.x, y: by - 6 },
        box: box,
        ang: ang
      };
    }

    // ----- MODE: 'capsule' (Default signature railmap half-profile) -----
    // Chinese Railways left-hand running: half-profile cut along centerline, outer curve on left
    const baseSize = isInset ? 11.5 : (isSel ? 8.6 : 7.0);
    const kShape = emu ? 1.14 : 1.0;
    const w = baseSize * 0.9 * kShape;
    const len = baseSize * 2.1 * kShape;
    const nose = len * (emu ? 0.65 : 0.46);

    // Anchor on centerline: 35% from train rear
    const ANCHOR_RATIO = 0.35;
    const tx = p.x - cos * len * ANCHOR_RATIO;
    const ty = p.y - sin * len * ANCHOR_RATIO;

    const P = (u, v) => [tx + cos * u + lx * v, ty + sin * u + ly * v];

    ctx.save();

    // Trace capsule body
    ctx.beginPath();
    ctx.moveTo(...P(0, 0));             // Rear on track
    ctx.lineTo(...P(0, w));             // Rear left corner
    ctx.lineTo(...P(len - nose, w));    // Shoulder

    if (emu) {
      ctx.lineTo(...P(len, 0));         // Sharp bullet nose tip on track
    } else {
      // Conventional rounded nose: quarter ellipse
      const [ex, ey] = P(len - nose, 0);
      ctx.ellipse(ex, ey, nose, w, ang, -Math.PI / 2, 0);
    }
    ctx.closePath();

    // Body styling
    const bodyColor = isSel ? themeColors.sel : getLiveryColor(tr, themeColors);
    ctx.fillStyle = bodyColor;
    ctx.fill();

    ctx.lineWidth = isSel ? 2.6 : (isInset ? 1.3 : 1.0);
    ctx.strokeStyle = isSel ? '#ffffff' : (emu ? themeColors.edge : (theme === 'dark' ? '#0f172a' : '#ffffff'));
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Fuxing gold stripe (lower ~45% of height along track)
    if (isFx && !isSel) {
      const fk = 0.46;
      ctx.beginPath();
      ctx.moveTo(...P(0, 0));
      ctx.lineTo(...P(len, 0));
      if (emu) {
        ctx.lineTo(...P(len - nose * fk, w * fk));
      } else {
        const [ex, ey] = P(len - nose, 0);
        ctx.ellipse(ex, ey, nose, w, ang, 0, -Math.asin(fk), true);
      }
      ctx.lineTo(...P(0, w * fk));
      ctx.closePath();
      ctx.fillStyle = themeColors.gold;
      ctx.fill();
    }

    // Glowing headlight dot at the nose tip
    const noseTip = P(len, 0);
    const stObj = st || tr.st || tr._st || null;
    const isMoving = stObj ? (stObj.moving !== false && (stObj.kmh == null || stObj.kmh > 1)) : (tr.moving !== false);
    if (isMoving) {
      const hlRadius = isInset ? 4.2 : 3.0;
      const grad = ctx.createRadialGradient(noseTip[0], noseTip[1], 0.4, noseTip[0], noseTip[1], hlRadius);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.35, 'rgba(254, 240, 138, 0.88)');
      grad.addColorStop(1, 'rgba(250, 204, 21, 0)');

      ctx.beginPath();
      ctx.arc(noseTip[0], noseTip[1], hlRadius, 0, 2 * Math.PI);
      ctx.fillStyle = grad;
      ctx.fill();

      // Sharp central bulb
      ctx.beginPath();
      ctx.arc(noseTip[0], noseTip[1], isInset ? 1.4 : 1.0, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }

    ctx.restore();

    // Calculate anchor (outside left midpoint) and bounding box
    const midX = tx + cos * len * 0.5;
    const midY = ty + sin * len * 0.5;
    const anchor = {
      x: midX + lx * (w + 5),
      y: midY + ly * (w + 5)
    };

    const corners = [P(0, 0), P(0, w), P(len, 0), P(len, w)];
    const xs = corners.map(pt => pt[0]);
    const ys = corners.map(pt => pt[1]);
    const box = [
      Math.min(...xs) - 2,
      Math.min(...ys) - 2,
      Math.max(...xs) + 2,
      Math.max(...ys) + 2
    ];

    return {
      anchor: anchor,
      box: box,
      ang: ang
    };
  }

  // =========================================================================
  // 3. window.drawHubTrainLabels(ctx, items, occupiedBoxes, theme)
  // =========================================================================
  // Frame-to-frame memory (isolated per canvas viewport) to prevent label jitter in dense throat areas
  const labelMemory = new Map();
  const canvasMemoryMap = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  global.HUB_LABEL_MEMORY = labelMemory;

  const RETURN_DELAY_MS = 800; // Continuous clear time required before returning to default slot 0
  const HOLD_DELAY_MS = 500;   // Minimum dwell time on a candidate slot before voluntary return
  const SHOW_DELAY_MS = 180;   // Continuous free time required before a recently-hidden label reappears
  const GRACE_MS = 1800;       // Retain memory across brief occlusions
  const DAMP_TAU_MS = 85;      // Smooth exponential damping time constant for offset transitions

  function getViewportMemory(ctx) {
    if (!ctx || !ctx.canvas || !canvasMemoryMap) return labelMemory;
    let mem = canvasMemoryMap.get(ctx.canvas);
    if (!mem) {
      mem = new Map();
      canvasMemoryMap.set(ctx.canvas, mem);
    }
    return mem;
  }

  /**
   * Smart label placement with 2D radial/vertical collision avoidance + multi-stage anti-jitter memory
   * Prevents overlap and flickering in high-density throats (Beijing South, Liucun, Tianjin West).
   * 
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Array} items - Array of { tr, p, st, pri, anchor, iconBox }
   * @param {Array} occupiedBoxes - Array of [minX, minY, maxX, maxY]
   * @param {string} theme - 'light' | 'dark'
   */
  function drawHubTrainLabels(ctx, items, occupiedBoxes, theme) {
    if (!ctx || !items || !items.length) return;

    const themeColors = getThemeColors(theme);
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const vpMem = getViewportMemory(ctx);
    const placed = (occupiedBoxes || []).slice();

    // Expire stale memory entries beyond grace period
    for (const [k, v] of vpMem.entries()) {
      if (now - v.lastSeenMs > GRACE_MS) vpMem.delete(k);
    }

    // Collision tester with configurable margin (ignoring the train's own iconBox)
    const collides = (b, margin, selfBox) => placed.some(q => (
      q !== selfBox &&
      b[0] < q[2] + margin && b[2] > q[0] - margin &&
      b[1] < q[3] + margin && b[3] > q[1] - margin
    ));

    ctx.save();
    ctx.font = TRAIN_FONT_CONDENSED;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    const getTrKey = tr => (tr.c || '') + (tr.od ? '@' + tr.od : '');

    // Sort by:
    //  1. Explicit priority (selected first, then G -> C/D -> others)
    //  2. Currently visible labels before hidden/new ones
    //  3. Smaller candIndex first (undisplaced slot 0 claims its spot before displaced labels test slot 0)
    //  4. Seniority (earlier bornMs first)
    const sorted = items.slice().sort((a, b) => {
      const priA = a.pri != null ? a.pri : 2;
      const priB = b.pri != null ? b.pri : 2;
      if (priA !== priB) return priA - priB;
      const mA = vpMem.get(getTrKey(a.tr));
      const mB = vpMem.get(getTrKey(b.tr));
      const visA = mA && mA.visible ? 1 : 0;
      const visB = mB && mB.visible ? 1 : 0;
      if (visA !== visB) return visB - visA;
      const idxA = mA && mA.candIndex != null ? mA.candIndex : 999;
      const idxB = mB && mB.candIndex != null ? mB.candIndex : 999;
      if (idxA !== idxB) return idxA - idxB;
      const bornA = mA ? mA.bornMs : Infinity;
      const bornB = mB ? mB.bornMs : Infinity;
      return bornA - bornB;
    });

    // 14 concentric radial candidates (dx, dy) relative to stable train center p
    const CANDIDATES = [
      { dx: 20, dy: -10 },  // 0: Upper right (preferred flank)
      { dx: -20, dy: -10 }, // 1: Upper left
      { dx: 20, dy: 11 },   // 2: Lower right
      { dx: -20, dy: 11 },  // 3: Lower left
      { dx: 0, dy: -16 },   // 4: Direct above
      { dx: 0, dy: 16 },    // 5: Direct below
      { dx: 28, dy: 0 },    // 6: Flank right
      { dx: -28, dy: 0 },   // 7: Flank left
      { dx: 30, dy: -16 },  // 8: Extended upper right
      { dx: -30, dy: -16 }, // 9: Extended upper left
      { dx: 30, dy: 17 },   // 10: Extended lower right
      { dx: -30, dy: 17 },  // 11: Extended lower left
      { dx: 0, dy: -28 },   // 12: Far above
      { dx: 0, dy: 28 }     // 13: Far below
    ];

    const KEEP_MARGIN = 0.0;   // Forgiving margin when holding current slot
    const PLACE_MARGIN = 1.5;  // Standard margin when picking a new slot
    const RETURN_MARGIN = 3.0; // Stricter clearance required before returning to slot 0

    for (const item of sorted) {
      const tr = item.tr;
      const code = (tr.c || '').split('/')[0];
      if (!code) continue;

      const p = item.p;
      const selfBox = item.iconBox || null;
      const isSel = item.pri === 0;

      const m = ctx.measureText(code);
      const tw = m.width;
      const pw = tw + 9;
      const ph = 15;
      const hw = pw / 2;
      const hh = ph / 2;

      const getBox = (dx, dy) => [
        p.x + dx - hw,
        p.y + dy - hh,
        p.x + dx + hw,
        p.y + dy + hh
      ];

      const trKey = getTrKey(tr);
      let oldMem = vpMem.get(trKey);
      // Reset memory if viewport camera jumped (e.g. inset preset switch)
      if (oldMem && oldMem.lastPx != null && Math.hypot(p.x - oldMem.lastPx, p.y - oldMem.lastPy) > 90) {
        vpMem.delete(trKey);
        oldMem = null;
      }

      let chosenCand = null;
      let chosenIdx = -1;
      let freeSince = null;
      let slotSinceMs = oldMem ? oldMem.slotSinceMs : now;

      // 1. Try holding previous frame's candidate with forgiving KEEP_MARGIN
      if (oldMem && oldMem.visible && oldMem.cand) {
        const oldBox = getBox(oldMem.cand.dx, oldMem.cand.dy);
        if (!collides(oldBox, KEEP_MARGIN, selfBox)) {
          chosenCand = oldMem.cand;
          chosenIdx = oldMem.candIndex;
          // Only consider returning to candidate 0 after holding current slot >= HOLD_DELAY_MS
          // and candidate 0 remaining clear with wide RETURN_MARGIN for >= RETURN_DELAY_MS
          if (chosenIdx !== 0 && (now - slotSinceMs >= HOLD_DELAY_MS) &&
              !collides(getBox(CANDIDATES[0].dx, CANDIDATES[0].dy), RETURN_MARGIN, selfBox)) {
            freeSince = oldMem.freeSince || now;
            if (now - freeSince >= RETURN_DELAY_MS) {
              chosenCand = CANDIDATES[0];
              chosenIdx = 0;
              freeSince = null;
              slotSinceMs = now;
            }
          }
        }
      }

      // 2. If no valid memory position, search candidates (preferring proximity to previous offset)
      if (!chosenCand) {
        const order = CANDIDATES.map((c, idx) => ({ c, idx }));
        if (oldMem && oldMem.cand) {
          const refDx = oldMem.renderDx != null ? oldMem.renderDx : oldMem.cand.dx;
          const refDy = oldMem.renderDy != null ? oldMem.renderDy : oldMem.cand.dy;
          order.sort((a, b) => (
            (a.idx * 4 + Math.hypot(a.c.dx - refDx, a.c.dy - refDy) * 0.65) -
            (b.idx * 4 + Math.hypot(b.c.dx - refDx, b.c.dy - refDy) * 0.65)
          ));
        }
        for (let k = 0; k < order.length; k++) {
          const { c, idx } = order[k];
          if (!collides(getBox(c.dx, c.dy), PLACE_MARGIN, selfBox)) {
            chosenCand = c;
            chosenIdx = idx;
            break;
          }
        }
        if (chosenCand && (!oldMem || chosenIdx !== oldMem.candIndex)) {
          slotSinceMs = now;
        }
      }

      // 3. If still colliding in ultra-dense cluster:
      if (!chosenCand) {
        if (isSel) {
          chosenCand = oldMem && oldMem.cand ? oldMem.cand : CANDIDATES[0];
          chosenIdx = oldMem && oldMem.candIndex != null ? oldMem.candIndex : 0;
        } else {
          if (oldMem) {
            oldMem.visible = false;
            oldMem.showSinceMs = null;
            oldMem.freeSince = null;
            oldMem.lastSeenMs = now;
            oldMem.lastPx = p.x;
            oldMem.lastPy = p.y;
          }
          continue;
        }
      }

      // 4. Show-debounce for labels that were recently hidden due to collision
      if (!isSel && oldMem && !oldMem.visible) {
        const showSinceMs = oldMem.showSinceMs || now;
        if (now - showSinceMs < SHOW_DELAY_MS) {
          oldMem.showSinceMs = showSinceMs;
          oldMem.cand = chosenCand;
          oldMem.candIndex = chosenIdx;
          oldMem.lastSeenMs = now;
          oldMem.lastPx = p.x;
          oldMem.lastPy = p.y;
          continue;
        }
      }

      // 5. Exponential damping of relative offset (renderDx, renderDy)
      const dt = oldMem && oldMem.visible && oldMem.lastSeenMs != null ? Math.max(0, now - oldMem.lastSeenMs) : 999;
      const alpha = (oldMem && oldMem.visible && oldMem.renderDx != null && dt <= 250)
        ? (1 - Math.exp(-Math.max(1, dt) / DAMP_TAU_MS))
        : 1;
      let renderDx = alpha < 1 ? oldMem.renderDx + (chosenCand.dx - oldMem.renderDx) * alpha : chosenCand.dx;
      let renderDy = alpha < 1 ? oldMem.renderDy + (chosenCand.dy - oldMem.renderDy) * alpha : chosenCand.dy;
      if (Math.hypot(chosenCand.dx - renderDx, chosenCand.dy - renderDy) < 0.2) {
        renderDx = chosenCand.dx;
        renderDy = chosenCand.dy;
      }

      // Record union of target box and rendered box to prevent collisions during smooth glide
      const targetBox = getBox(chosenCand.dx, chosenCand.dy);
      const renderBox = getBox(renderDx, renderDy);
      const unionBox = [
        Math.min(targetBox[0], renderBox[0]),
        Math.min(targetBox[1], renderBox[1]),
        Math.max(targetBox[2], renderBox[2]),
        Math.max(targetBox[3], renderBox[3])
      ];
      placed.push(unionBox);
      if (Array.isArray(occupiedBoxes)) occupiedBoxes.push(unionBox);

      const memEntry = {
        cand: chosenCand,
        candIndex: chosenIdx >= 0 ? chosenIdx : 0,
        renderDx,
        renderDy,
        visible: true,
        bornMs: oldMem ? oldMem.bornMs : now,
        slotSinceMs,
        freeSince,
        showSinceMs: null,
        lastSeenMs: now,
        lastPx: p.x,
        lastPy: p.y
      };
      vpMem.set(trKey, memEntry);
      labelMemory.set(trKey, memEntry);

      const labelCenterX = p.x + renderDx;
      const labelCenterY = p.y + renderDy;

      // Draw crisp 0.9px leader line when displaced > 10px from train body
      const dist = Math.hypot(labelCenterX - p.x, labelCenterY - p.y);
      if (dist > 10) {
        // Find nearest point on label pill edge to train
        const targetX = Math.max(labelCenterX - hw, Math.min(labelCenterX + hw, p.x));
        const targetY = Math.max(labelCenterY - hh, Math.min(labelCenterY + hh, p.y));

        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(targetX, targetY);
        ctx.lineWidth = 0.9;
        ctx.strokeStyle = isSel ? themeColors.sel : themeColors.leaderLine;
        ctx.stroke();

        // Small crisp anchor dot at train body
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.2, 0, 2 * Math.PI);
        ctx.fillStyle = isSel ? themeColors.sel : themeColors.leaderLine;
        ctx.fill();
      }

      // Render subtle halo / pill background
      const pillX = labelCenterX - hw;
      const pillY = labelCenterY - hh;

      ctx.shadowColor = 'rgba(0, 0, 0, 0.14)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetY = 1;

      roundRect(ctx, pillX, pillY, pw, ph, 3.5);
      ctx.fillStyle = isSel ? themeColors.sel : themeColors.pillBg;
      ctx.fill();

      ctx.shadowColor = 'transparent';

      ctx.lineWidth = isSel ? 1.5 : 0.8;
      ctx.strokeStyle = isSel ? '#ffffff' : themeColors.pillBorder;
      ctx.stroke();

      // Render train code text with class coloring
      const textColor = isSel ? '#ffffff' : getClassColor(code, themeColors);
      ctx.fillStyle = textColor;
      ctx.fillText(code, labelCenterX, labelCenterY + 0.5);
    }

    ctx.restore();
  }

  // =========================================================================
  // 4. window.drawHubAchievements(ctx, map, activeToasts, nowMs, theme)
  // =========================================================================
  /**
   * Renders floating "★ 成就达成 / 枢纽看点" callout cards directly on the map canvas
   * with a leader line pointing to the station/junction coordinates [lat, lon],
   * gold/amber accent border, and smooth fade-in / slide-up animation.
   * 
   * @param {CanvasRenderingContext2D} ctx - Map canvas context
   * @param {Object} map - Map instance with project methods
   * @param {Array} activeToasts - Active milestone toast objects
   * @param {number} nowMs - Current simulation/wall timestamp in ms
   * @param {string} theme - 'light' | 'dark'
   */
  function drawHubAchievements(ctx, map, activeToasts, nowMs, theme) {
    if (!ctx || !map || !activeToasts || !activeToasts.length) return;

    const themeColors = getThemeColors(theme);
    const now = nowMs || Date.now();

    ctx.save();

    for (const toast of activeToasts) {
      const startMs = toast.startMs || toast.t || 0;
      const duration = toast.duration || 6500;
      const elapsed = now - startMs;
      if (elapsed < 0 || elapsed > duration) continue;

      // Coordinate projection
      const coords = toast.ll || toast.pos || toast.coords;
      if (!coords || !Array.isArray(coords)) continue;

      const pStation = projectToPx(map, coords);

      // Skip if completely outside view
      const s = map.getSize ? map.getSize() : { x: ctx.canvas.width, y: ctx.canvas.height };
      if (pStation.x < -120 || pStation.y < -120 || pStation.x > s.x + 120 || pStation.y > s.y + 120) continue;

      // Animation lifecycle:
      // 0 - 450ms: Fade in & slide up 12px
      // 450ms - (duration - 450ms): Fully visible
      // (duration - 450ms) - duration: Fade out
      let alpha = 1.0;
      let slideY = 0;

      const FADE_TIME = 450;
      if (elapsed < FADE_TIME) {
        const u = elapsed / FADE_TIME;
        const ease = 1 - Math.pow(1 - u, 3); // Cubic ease out
        alpha = ease;
        slideY = (1 - ease) * 12;
      } else if (elapsed > duration - FADE_TIME) {
        const u = (duration - elapsed) / FADE_TIME;
        alpha = Math.max(0, u);
      }

      // Card geometry
      const cardW = 208;
      const cardH = 54;
      const isRightSide = pStation.x < s.x - cardW - 60;
      const cardX = isRightSide ? pStation.x + 36 : pStation.x - cardW - 36;
      const cardY = pStation.y - 48 - slideY;

      ctx.globalAlpha = alpha;

      // 1. Draw glowing beacon & pulsating wave at station coordinate
      const pulseT = (now % 1600) / 1600;
      const waveR = 4 + pulseT * 12;
      const waveAlpha = (1 - pulseT) * 0.7 * alpha;

      ctx.beginPath();
      ctx.arc(pStation.x, pStation.y, waveR, 0, 2 * Math.PI);
      ctx.strokeStyle = `rgba(245, 158, 11, ${waveAlpha.toFixed(3)})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // Station golden center point
      ctx.beginPath();
      ctx.arc(pStation.x, pStation.y, 3.5, 0, 2 * Math.PI);
      ctx.fillStyle = themeColors.goldBorder;
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // 2. Draw leader line from station to card corner
      const anchorCardX = isRightSide ? cardX : cardX + cardW;
      const anchorCardY = cardY + cardH * 0.7;

      ctx.beginPath();
      ctx.moveTo(pStation.x, pStation.y);
      ctx.lineTo(isRightSide ? cardX - 10 : cardX + cardW + 10, anchorCardY);
      ctx.lineTo(anchorCardX, anchorCardY);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = themeColors.goldBorder;
      ctx.stroke();

      // 3. Card Container: rounded card with gold/amber border & drop shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;

      roundRect(ctx, cardX, cardY, cardW, cardH, 6.5);
      ctx.fillStyle = theme === 'dark' ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)';
      ctx.fill();

      ctx.shadowColor = 'transparent';

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = themeColors.goldBorder;
      ctx.stroke();

      // Left golden accent bar
      ctx.save();
      roundRect(ctx, cardX, cardY, cardW, cardH, 6.5);
      ctx.clip();
      ctx.fillStyle = themeColors.goldBorder;
      ctx.fillRect(cardX, cardY, 4.5, cardH);
      ctx.restore();

      // 4. Content Typography
      const padLeft = cardX + 12;

      // Header Tag ("★ 成就达成" / "★ 枢纽看点")
      const tagText = toast.title || '★ 枢纽看点';
      ctx.font = TOAST_FONT_TAG;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = themeColors.goldBorder;
      ctx.fillText(tagText, padLeft, cardY + 7);

      // Main Title ("北京南站 · 最忙一小时")
      const titleText = toast.name || toast.station || '京津枢纽亮点';
      ctx.font = TOAST_FONT_TITLE;
      ctx.fillStyle = theme === 'dark' ? '#f8fafc' : '#0f172a';
      ctx.fillText(titleText, padLeft, cardY + 20);

      // Description ("滑动60分钟到发58列，创今日峰值")
      const descText = toast.desc || toast.text || '';
      if (descText) {
        ctx.font = TOAST_FONT_DESC;
        ctx.fillStyle = themeColors.muted;
        ctx.fillText(descText, padLeft, cardY + 36);
      }
    }

    ctx.restore();
  }

  // =========================================================================
  // EXPORTS
  // =========================================================================
  global.drawSpeedTail = drawSpeedTail;
  global.drawHubTrainIcon = drawHubTrainIcon;
  global.drawHubTrainLabels = drawHubTrainLabels;
  global.drawHubAchievements = drawHubAchievements;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      drawSpeedTail,
      drawHubTrainIcon,
      drawHubTrainLabels,
      drawHubAchievements,
      labelMemory,
      getGeomPos,
      projectToPx,
      getAngle
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
