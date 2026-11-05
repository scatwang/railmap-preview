/**
 * hub_boards.js - Standalone UI rendering and update logic for HUD boards,
 * locomotive icons, achievement toasts, and micro time-space diagram.
 *
 * Chinese Railway Hub HUD System (CR-HUD)
 */

(function (global) {
  'use strict';

  // =========================================================================
  // 1. Crisp Side-Profile Locomotive SVG Generators (viewBox 0 0 96 32)
  // =========================================================================

  /**
   * Classic Red & Cream/White HXD3D Electric Locomotive + 25T Coach Nose
   */
  function hxd3dSvg(w, h) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 96 32">`
      + `<!-- Cowcatcher & Coupler -->`
      + `<path d="M2.5,27 L10,27 L8,24.5 L3.5,24.5 Z" fill="#334155"/>`
      + `<rect x="0.5" y="24" width="2.5" height="1.8" fill="#1e293b"/>`
      + `<!-- Locomotive Body (Classic Red #b91c1c) -->`
      + `<path d="M3.5,24.5 L5.5,19.5 L14,9 L24,5.5 L60,5.5 L60,26.5 L6,26.5 Z" fill="#b91c1c"/>`
      + `<!-- Roof Equipment Box -->`
      + `<rect x="23" y="4.2" width="37" height="1.8" rx="0.5" fill="#e2e8f0"/>`
      + `<!-- Cream / White Lightning Speed Ribbon (#fef2f2) -->`
      + `<path d="M5.5,19.5 L14,14 L32,14 L28,17 L12,17 L8,22 Z" fill="#fef2f2"/>`
      + `<rect x="18" y="21" width="42" height="1.8" fill="#fef2f2"/>`
      + `<!-- Cab Windshield & Frame -->`
      + `<path d="M11,10.2 L17,6.8 L22,6.8 L18,11.2 Z" fill="#0f172a" stroke="#475569" stroke-width="0.5"/>`
      + `<rect x="24" y="8" width="5.5" height="4.2" rx="0.6" fill="#1e293b"/>`
      + `<!-- Body Side Louvers -->`
      + `<rect x="34" y="9" width="10" height="4" rx="0.4" fill="#7f1d1d"/>`
      + `<line x1="34" y1="10.3" x2="44" y2="10.3" stroke="#b91c1c" stroke-width="0.6"/>`
      + `<line x1="34" y1="11.7" x2="44" y2="11.7" stroke="#b91c1c" stroke-width="0.6"/>`
      + `<rect x="47" y="9" width="10" height="4" rx="0.4" fill="#7f1d1d"/>`
      + `<line x1="47" y1="10.3" x2="57" y2="10.3" stroke="#b91c1c" stroke-width="0.6"/>`
      + `<line x1="47" y1="11.7" x2="57" y2="11.7" stroke="#b91c1c" stroke-width="0.6"/>`
      + `<!-- Headlights -->`
      + `<circle cx="5" cy="20.5" r="1.1" fill="#fef08a"/>`
      + `<circle cx="15.5" cy="8" r="0.9" fill="#fef08a"/>`
      + `<!-- Pantograph -->`
      + `<line x1="45" y1="3.5" x2="38" y2="1.6" stroke="#475569" stroke-width="0.9"/>`
      + `<line x1="38" y1="1.6" x2="48" y2="0.8" stroke="#475569" stroke-width="0.8"/>`
      + `<line x1="44" y1="0.6" x2="51" y2="0.6" stroke="#1e293b" stroke-width="1.1"/>`
      + `<!-- Front Bogie (3 Axles) -->`
      + `<rect x="10" y="26.5" width="26" height="1.8" rx="0.4" fill="#1e293b"/>`
      + `<circle cx="14" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="14" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<circle cx="23" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="23" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<circle cx="32" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="32" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<rect x="38" y="26.8" width="18" height="2.2" rx="0.4" fill="#1e293b"/>`
      + `<!-- Coupler & Gangway -->`
      + `<rect x="60" y="24" width="3" height="2.2" fill="#0f172a"/>`
      + `<rect x="60.5" y="10" width="2" height="14" fill="#334155"/>`
      + `<!-- 25T Coach Nose -->`
      + `<path d="M62.5,8 C63,5.5 65,4.5 68,4.5 L94.8,4.5 L94.8,26.5 L63,26.5 Z" fill="#f8fafc"/>`
      + `<rect x="63" y="10" width="31.8" height="6.5" fill="#1e40af"/>`
      + `<rect x="67" y="11" width="7" height="4.5" rx="0.5" fill="#e2e8f0"/>`
      + `<rect x="77" y="11" width="9.5" height="4.5" rx="0.5" fill="#e2e8f0"/>`
      + `<rect x="89.5" y="11" width="5.3" height="4.5" rx="0.5" fill="#e2e8f0"/>`
      + `<rect x="63" y="24" width="31.8" height="2.5" fill="#94a3b8"/>`
      + `<rect x="71" y="26.8" width="18" height="1.6" rx="0.4" fill="#1e293b"/>`
      + `<circle cx="75" cy="28.8" r="2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="75" cy="28.8" r="0.6" fill="#94a3b8"/>`
      + `<circle cx="85" cy="28.8" r="2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="85" cy="28.8" r="0.6" fill="#94a3b8"/>`
      + `<line x1="94.8" y1="4.5" x2="94.8" y2="26.5" stroke="#1e293b" stroke-width="1.2"/>`
      + `</svg>`;
  }

  /**
   * Blue & White HXD1D Streamlined Electric Locomotive + 25G Coach Nose
   */
  function hxd1dSvg(w, h) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 96 32">`
      + `<!-- Cowcatcher & Coupler -->`
      + `<path d="M2.5,27 L10,27 L8,24.5 L3.5,24.5 Z" fill="#334155"/>`
      + `<rect x="0.5" y="24" width="2.5" height="1.8" fill="#1e293b"/>`
      + `<!-- Locomotive Streamlined Blue Body (#1d4ed8) -->`
      + `<path d="M3.5,24.5 L5.5,18 L15,8 L25,5.2 L60,5.2 L60,26.5 L6,26.5 Z" fill="#1d4ed8"/>`
      + `<!-- Sweeping White Roof & Upper Hood (#eff6ff) -->`
      + `<path d="M15,8 L25,5.2 L60,5.2 L60,9.5 L30,9.5 L18,13 L8,19 L3.5,24.5 L5.5,18 Z" fill="#eff6ff"/>`
      + `<rect x="18" y="21" width="42" height="1.6" fill="#eff6ff"/>`
      + `<!-- Aerodynamic Cab Windshield -->`
      + `<path d="M12,9.8 L18,6.8 L23,6.8 L19,11 Z" fill="#0f172a" stroke="#60a5fa" stroke-width="0.5"/>`
      + `<rect x="25" y="8" width="5.5" height="4.2" rx="0.6" fill="#1e293b"/>`
      + `<!-- Body Side Louvers -->`
      + `<rect x="35" y="11" width="10" height="4" rx="0.4" fill="#1e3a8a"/>`
      + `<rect x="48" y="11" width="10" height="4" rx="0.4" fill="#1e3a8a"/>`
      + `<!-- Headlights -->`
      + `<circle cx="4.8" cy="20" r="1.1" fill="#fef08a"/>`
      + `<circle cx="16" cy="7.5" r="0.9" fill="#fef08a"/>`
      + `<!-- Pantograph -->`
      + `<line x1="45" y1="3.5" x2="38" y2="1.6" stroke="#475569" stroke-width="0.9"/>`
      + `<line x1="38" y1="1.6" x2="48" y2="0.8" stroke="#475569" stroke-width="0.8"/>`
      + `<line x1="44" y1="0.6" x2="51" y2="0.6" stroke="#1e293b" stroke-width="1.1"/>`
      + `<!-- Bogie (3 Axles) -->`
      + `<rect x="10" y="26.5" width="26" height="1.8" rx="0.4" fill="#1e293b"/>`
      + `<circle cx="14" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="14" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<circle cx="23" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="23" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<circle cx="32" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="32" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<rect x="38" y="26.8" width="18" height="2.2" rx="0.4" fill="#1e293b"/>`
      + `<!-- Coupler & Gangway -->`
      + `<rect x="60" y="24" width="3" height="2.2" fill="#0f172a"/>`
      + `<rect x="60.5" y="10" width="2" height="14" fill="#334155"/>`
      + `<!-- 25G Coach Nose (Classic Red/Cream Livery) -->`
      + `<path d="M62.5,8 C63,5.5 65,4.5 68,4.5 L94.8,4.5 L94.8,26.5 L63,26.5 Z" fill="#b91c1c"/>`
      + `<rect x="63" y="10" width="31.8" height="6.5" fill="#fef3c7"/>`
      + `<rect x="63" y="17.5" width="31.8" height="1.4" fill="#eab308"/>`
      + `<rect x="67" y="11" width="7" height="4.5" rx="0.5" fill="#1e293b"/>`
      + `<rect x="77" y="11" width="9.5" height="4.5" rx="0.5" fill="#1e293b"/>`
      + `<rect x="89.5" y="11" width="5.3" height="4.5" rx="0.5" fill="#1e293b"/>`
      + `<rect x="63" y="24" width="31.8" height="2.5" fill="#7f1d1d"/>`
      + `<rect x="71" y="26.8" width="18" height="1.6" rx="0.4" fill="#1e293b"/>`
      + `<circle cx="75" cy="28.8" r="2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="75" cy="28.8" r="0.6" fill="#94a3b8"/>`
      + `<circle cx="85" cy="28.8" r="2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="85" cy="28.8" r="0.6" fill="#94a3b8"/>`
      + `<line x1="94.8" y1="4.5" x2="94.8" y2="26.5" stroke="#1e293b" stroke-width="1.2"/>`
      + `</svg>`;
  }

  /**
   * NDJ3 "Great Wall (和谐长城号)" Streamlined White & Blue Diesel Power Car + Coach Nose
   */
  function ndj3Svg(w, h) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 96 32">`
      + `<!-- Cowcatcher & Coupler -->`
      + `<path d="M2.5,27 L10,27 L8,24.5 L3.5,24.5 Z" fill="#334155"/>`
      + `<rect x="0.5" y="24" width="2.5" height="1.8" fill="#1e293b"/>`
      + `<!-- Streamlined Diesel Power Car Body (#ffffff) -->`
      + `<path d="M2.5,22.5 C4,18 9,12 18,8 C23,5.8 28,5.2 36,5.2 L60,5.2 L60,26.5 L6,26.5 Z" fill="#ffffff"/>`
      + `<!-- Blue Flowing Waves (Suburban S2 Line Branding) -->`
      + `<path d="M5,22.5 C9,17 18,13 28,11 L60,11 L60,14.5 L30,14.5 C20,14.5 12,18 7,24 Z" fill="#0284c7"/>`
      + `<path d="M9,24.5 C16,21 24,19.5 35,19.5 L60,19.5 L60,21.5 L35,21.5 C24,21.5 16,23 10,25.5 Z" fill="#1e40af"/>`
      + `<!-- Windshield -->`
      + `<path d="M12,11.5 C15,9.5 19,8.2 24,8.2 L25,8.2 L23,12.5 C18,12.5 14,13.2 12,14 Z" fill="#0f172a" stroke="#38bdf8" stroke-width="0.5"/>`
      + `<rect x="27" y="8.8" width="6" height="4" rx="0.6" fill="#1e293b"/>`
      + `<!-- Diesel Cooling Louver Slits -->`
      + `<rect x="42" y="7.5" width="14" height="4.5" rx="0.5" fill="#cbd5e1"/>`
      + `<line x1="45" y1="7.5" x2="45" y2="12" stroke="#64748b" stroke-width="0.6"/>`
      + `<line x1="49" y1="7.5" x2="49" y2="12" stroke="#64748b" stroke-width="0.6"/>`
      + `<line x1="53" y1="7.5" x2="53" y2="12" stroke="#64748b" stroke-width="0.6"/>`
      + `<!-- Headlight -->`
      + `<circle cx="4" cy="21.5" r="1.1" fill="#fef08a"/>`
      + `<!-- Bogie (3 Axles) -->`
      + `<rect x="10" y="26.5" width="26" height="1.8" rx="0.4" fill="#1e293b"/>`
      + `<circle cx="14" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="14" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<circle cx="23" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="23" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<circle cx="32" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="32" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<rect x="38" y="26.8" width="18" height="2.2" rx="0.4" fill="#1e293b"/>`
      + `<!-- Coupler & Gangway -->`
      + `<rect x="60" y="24" width="3" height="2.2" fill="#0f172a"/>`
      + `<rect x="60.5" y="10" width="2" height="14" fill="#334155"/>`
      + `<!-- S2 Trailer Coach Nose -->`
      + `<path d="M62.5,8 C63,5.5 65,4.5 68,4.5 L94.8,4.5 L94.8,26.5 L63,26.5 Z" fill="#ffffff"/>`
      + `<rect x="63" y="11" width="31.8" height="3.5" fill="#0284c7"/>`
      + `<rect x="63" y="19.5" width="31.8" height="2" fill="#1e40af"/>`
      + `<rect x="67" y="11" width="7" height="4.5" rx="0.5" fill="#1e293b"/>`
      + `<rect x="77" y="11" width="9.5" height="4.5" rx="0.5" fill="#1e293b"/>`
      + `<rect x="89.5" y="11" width="5.3" height="4.5" rx="0.5" fill="#1e293b"/>`
      + `<rect x="63" y="24" width="31.8" height="2.5" fill="#cbd5e1"/>`
      + `<rect x="71" y="26.8" width="18" height="1.6" rx="0.4" fill="#1e293b"/>`
      + `<circle cx="75" cy="28.8" r="2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="75" cy="28.8" r="0.6" fill="#94a3b8"/>`
      + `<circle cx="85" cy="28.8" r="2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="85" cy="28.8" r="0.6" fill="#94a3b8"/>`
      + `<line x1="94.8" y1="4.5" x2="94.8" y2="26.5" stroke="#1e293b" stroke-width="1.2"/>`
      + `</svg>`;
  }

  /**
   * Classic DF4D / DF11G Green Diesel Locomotive + 25G/25T Dark Green Coach Livery
   */
  function convGreenSvg(w, h) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 96 32">`
      + `<!-- Red Cowcatcher & Coupler -->`
      + `<path d="M2.5,27 L10,27 L8,24.5 L3.5,24.5 Z" fill="#b91c1c"/>`
      + `<rect x="0.5" y="24" width="2.5" height="1.8" fill="#1e293b"/>`
      + `<!-- Locomotive Green Body (#15803d) -->`
      + `<path d="M3.5,24.5 L6,16 L12,8 L24,5.5 L60,5.5 L60,26.5 L6,26.5 Z" fill="#15803d"/>`
      + `<!-- Classic Bold Yellow Waist Stripe (#eab308) -->`
      + `<rect x="14" y="19" width="46" height="2" fill="#eab308"/>`
      + `<!-- Cab Overhang Visor & Front Windows -->`
      + `<rect x="13" y="5.5" width="12" height="1.2" fill="#14532d"/>`
      + `<rect x="13.5" y="7.2" width="4.5" height="4" rx="0.4" fill="#0f172a" stroke="#14532d" stroke-width="0.4"/>`
      + `<rect x="18.8" y="7.2" width="4.5" height="4" rx="0.4" fill="#0f172a" stroke="#14532d" stroke-width="0.4"/>`
      + `<rect x="25.5" y="7.5" width="5.5" height="4" rx="0.4" fill="#1e293b"/>`
      + `<!-- Circular Side Diesel Inspection Port -->`
      + `<circle cx="38" cy="12" r="2.2" fill="#14532d" stroke="#eab308" stroke-width="0.6"/>`
      + `<rect x="44" y="9.5" width="12" height="4.5" rx="0.4" fill="#14532d"/>`
      + `<!-- Roof Exhaust Stack -->`
      + `<rect x="35" y="4" width="7" height="1.6" rx="0.3" fill="#334155"/>`
      + `<!-- Headlight -->`
      + `<circle cx="5" cy="18" r="1.2" fill="#fef08a"/>`
      + `<!-- Heavy Diesel 3-Axle Bogie -->`
      + `<rect x="10" y="26.5" width="26" height="1.8" rx="0.4" fill="#1e293b"/>`
      + `<circle cx="14" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="14" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<circle cx="23" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="23" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<circle cx="32" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="32" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<rect x="38" y="26.8" width="18" height="2.2" rx="0.4" fill="#1e293b"/>`
      + `<!-- Coupler & Gangway -->`
      + `<rect x="60" y="24" width="3" height="2.2" fill="#0f172a"/>`
      + `<rect x="60.5" y="10" width="2" height="14" fill="#334155"/>`
      + `<!-- 25G/25T Classic Dark Green Coach Nose (#1d5a3a + #eab308) -->`
      + `<path d="M62.5,8 C63,5.5 65,4.5 68,4.5 L94.8,4.5 L94.8,26.5 L63,26.5 Z" fill="#1d5a3a"/>`
      + `<rect x="62.5" y="7" width="32.3" height="0.9" fill="#eab308"/>`
      + `<rect x="62.5" y="16.5" width="32.3" height="1.8" fill="#eab308"/>`
      + `<rect x="67" y="9.5" width="7" height="5.5" rx="0.5" fill="#0f172a"/>`
      + `<rect x="77" y="9.5" width="9.5" height="5.5" rx="0.5" fill="#0f172a"/>`
      + `<rect x="89.5" y="9.5" width="5.3" height="5.5" rx="0.5" fill="#0f172a"/>`
      + `<rect x="63" y="24" width="31.8" height="2.5" fill="#14532d"/>`
      + `<rect x="71" y="26.8" width="18" height="1.6" rx="0.4" fill="#1e293b"/>`
      + `<circle cx="75" cy="28.8" r="2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="75" cy="28.8" r="0.6" fill="#94a3b8"/>`
      + `<circle cx="85" cy="28.8" r="2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="85" cy="28.8" r="0.6" fill="#94a3b8"/>`
      + `<line x1="94.8" y1="4.5" x2="94.8" y2="26.5" stroke="#1e293b" stroke-width="1.2"/>`
      + `</svg>`;
  }

  // =========================================================================
  // 2. Public API: locoHalfSvg
  // =========================================================================

  /**
   * Renders side-profile half SVG for an EMU train or conventional locomotive.
   * @param {Object|string} modelOrTrain - Train object (tr) or model name string
   * @param {number} [h=16] - Rendered height in pixels
   * @returns {string} SVG HTML markup
   */
  function locoHalfSvg(modelOrTrain, h = 16) {
    let m = '';
    let code = '';
    if (typeof modelOrTrain === 'string') {
      m = modelOrTrain.trim();
      code = modelOrTrain.trim();
    } else if (modelOrTrain && typeof modelOrTrain === 'object') {
      m = (modelOrTrain.m || modelOrTrain.ts || modelOrTrain.model || '').trim();
      code = (modelOrTrain.c || modelOrTrain.code || modelOrTrain.train_no || '').split('/')[0].trim();
    }

    // 1. Try emuHalfSvg if available in global scope or window (supports all 42 EMU + Conventional models in emu_icons.js)
    const emuFn = (typeof emuHalfSvg === 'function')
      ? emuHalfSvg
      : (typeof window !== 'undefined' && typeof window.emuHalfSvg === 'function' ? window.emuHalfSvg : null);

    if (emuFn) {
      if (m) {
        const svg = emuFn(m, h);
        if (svg) return svg;
      }
      if (typeof window !== 'undefined' && typeof window.resolveHubMarkerModel === 'function' && typeof modelOrTrain === 'object') {
        const key = window.resolveHubMarkerModel(modelOrTrain);
        const svg = emuFn(key, h);
        if (svg) return svg;
      }
    }

    // If EMU train without specific model match, try prefix fallback
    if (emuFn && !m && (/^[GCD]/i.test(code))) {
      const fallbackM = code.startsWith('G') ? 'CR400AF' : code.startsWith('C') ? 'CRH6A' : 'CRH2A';
      const svg = emuFn(fallbackM, h);
      if (svg) return svg;
    }

    // 2. Conventional locomotive rendering (aspect ratio 3:1 -> 72x24)
    const scale = h / 24;
    const w = Math.round(72 * scale);

    // S2 ("和谐长城号" NDJ3)
    if (/^S2\d\d/i.test(code) || /^S2/i.test(code) || /^NDJ3/i.test(m)) {
      return ndj3Svg(w, h);
    }

    // K or HXD1D (Blue & White)
    if (/^K/i.test(code) || /^HXD1D/i.test(m) || /^HXD1/i.test(m)) {
      return hxd1dSvg(w, h);
    }

    // Z / T or HXD3D / SS9G (Classic Red & Cream)
    if (/^[ZT]/i.test(code) || /^(HXD3D|SS9G|SS8|SS9|HXD3C|HXD3)/i.test(m)) {
      return hxd3dSvg(w, h);
    }

    // Default: classic DF4D/DF11G + 25G/25T dark green livery
    return convGreenSvg(w, h);
  }

  // =========================================================================
  // 3. Public API: formatRollingStock & trainBadgeInfo
  // =========================================================================

  /**
   * Formats rolling stock description for boards.
   * @param {Object|string} tr - Train object
   * @returns {string} Clean string for 车型 / 牵引·车底
   */
  function formatRollingStock(tr) {
    if (!tr) return 'HXD3C / 25G';

    if (typeof tr === 'string') {
      const s = tr.trim();
      if (/^S2\d\d/i.test(s)) return 'NDJ3 (和谐长城号)';
      if (/^Z/i.test(s)) return 'HXD3D / 25T DC600V';
      if (/^[TN]/i.test(s)) return 'HXD1D / 25K';
      if (/^[KV]/i.test(s)) return 'HXD3C / 25G DC600V';
      if (/^Y/i.test(s)) return 'DF11G / 25G 旅游';
      if (/^[GCD]/i.test(s)) return 'CR400AF';
      return s || 'HXD3C / 25G';
    }

    // If 12306 active model exists
    if (tr.ts && typeof tr.ts === 'string' && tr.ts.trim()) {
      return tr.ts.trim();
    }
    if (tr.m && typeof tr.m === 'string' && tr.m.trim()) {
      return tr.m.trim();
    }

    // Conventional train prefix inference
    const code = (tr.c || tr.code || tr.train_no || '').split('/')[0].trim().toUpperCase();
    if (/^S2\d\d/i.test(code)) return 'NDJ3 (和谐长城号)';
    if (/^Z/i.test(code)) return 'HXD3D / 25T DC600V';
    if (/^[TN]/i.test(code)) return 'HXD1D / 25K';
    if (/^[KV]/i.test(code)) return 'HXD3C / 25G DC600V';
    if (/^Y/i.test(code)) return 'DF11G / 25G 旅游';
    if (/^G/i.test(code)) return 'CR400AF';
    if (/^C/i.test(code)) return 'CRH6A';
    if (/^D/i.test(code)) return 'CRH2A';
    return 'HXD3C / 25G';
  }

  /**
   * Returns pill badge label, background and text color for train class.
   * @param {Object|string} tr - Train object or train code
   * @returns {{ label: string, bg: string, fg: string }}
   */
  function trainBadgeInfo(tr) {
    const code = (typeof tr === 'string' ? tr : (tr?.c || tr?.code || '')).split('/')[0].trim().toUpperCase();
    const c0 = code[0];
    if (c0 === 'G') return { label: '高速', bg: '#2563eb', fg: '#ffffff' };
    if (c0 === 'C') return { label: '城际', bg: '#0891b2', fg: '#ffffff' };
    if (c0 === 'D') return { label: '动车', bg: '#0d9488', fg: '#ffffff' };
    if (c0 === 'S') return { label: '市域', bg: '#b45309', fg: '#ffffff' };
    if (c0 === 'Z') return { label: '直特', bg: '#7c2d12', fg: '#ffffff' };
    return { label: '普速', bg: '#991b1b', fg: '#ffffff' };
  }

  // =========================================================================
  // 4. Utility Helpers
  // =========================================================================

  /** Formats minute offset (0..1440) as HH:MM */
  function formatTime(t) {
    if (t == null || isNaN(t)) return '--:--';
    const mins = Math.floor(t) % 1440;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /** Normalizes station configuration entry */
  function normSt(item) {
    if (!item) return { name: '', en: '' };
    if (typeof item === 'string') return { name: item.trim(), en: '' };
    return { name: (item.name || '').trim(), en: (item.en || '').trim() };
  }

  /** Calculates great-circle distance between two lat/lon coordinates in km */
  function geoDistKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
            + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.15; // 1.15 track tortuosity
  }

  // =========================================================================
  // 5. Achievement Toast Notification System
  // =========================================================================

  /**
   * Displays an achievement / event toast message on the screen.
   * @param {string|Object} titleOrOpts - Toast title or options object
   * @param {string} [subtitle] - Subtitle description
   * @param {string} [iconSvg] - Optional custom SVG icon markup
   * @param {number} [duration=4500] - Duration in ms before auto-dismiss
   */
  function showHubToast(titleOrOpts, subtitle = '', iconSvg = '', duration = 4500) {
    if (typeof document === 'undefined') return;

    let title = titleOrOpts;
    if (typeof titleOrOpts === 'object' && titleOrOpts !== null) {
      title = titleOrOpts.title || '系统提示';
      subtitle = titleOrOpts.subtitle || titleOrOpts.desc || '';
      iconSvg = titleOrOpts.icon || '';
      duration = titleOrOpts.duration || 4500;
    }

    let container = document.getElementById('hub-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'hub-toast-container';
      container.setAttribute('style',
        'position:fixed;top:20px;right:20px;z-index:999999;display:flex;flex-direction:column;gap:10px;pointer-events:none;max-width:380px;');
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'hub-toast-item';
    toast.setAttribute('style',
      'pointer-events:auto;background:rgba(15,23,42,0.95);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);'
      + 'border:1px solid rgba(56,189,248,0.4);box-shadow:0 12px 30px rgba(0,0,0,0.55),0 0 16px rgba(56,189,248,0.25);'
      + 'border-radius:10px;padding:12px 16px;display:flex;align-items:center;gap:12px;color:#f8fafc;'
      + 'font-family:system-ui,-apple-system,sans-serif;transform:translateX(50px);opacity:0;'
      + 'transition:transform 0.35s cubic-bezier(0.16,1,0.3,1),opacity 0.3s ease;');

    const defaultTrophyIcon = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`
      + `<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>`
      + `<path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.45 1-1 1H8c-.55 0-1 .45-1 1v1h10v-1c0-.55-.45-1-1-1h-1c-.55 0-1-.45-1-1v-2.34"/>`
      + `<path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`;

    const iconHtml = iconSvg || defaultTrophyIcon;

    toast.innerHTML = `<div style="flex-shrink:0;display:flex;align-items:center;">${iconHtml}</div>`
      + `<div style="flex:1;min-width:0;">`
      + `<div style="font-size:13px;font-weight:700;color:#38bdf8;letter-spacing:0.2px;line-height:1.3;">${title}</div>`
      + `${subtitle ? `<div style="font-size:11.5px;color:#cbd5e1;margin-top:2px;line-height:1.35;">${subtitle}</div>` : ''}`
      + `</div>`;

    container.appendChild(toast);

    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
      });
    } else {
      toast.style.transform = 'translateX(0)';
      toast.style.opacity = '1';
    }

    setTimeout(() => {
      toast.style.transform = 'translateX(50px)';
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 350);
    }, duration);
  }

  // =========================================================================
  // 6. HubBoards Controller Implementation
  // =========================================================================

  const HubBoards = {
    _config: null,
    _stby: null,
    _data: null,

    // Precomputed event collections
    _arrivals: {},      // stName -> sorted array of arrivals [ev, ...]
    _departures: {},    // stName -> sorted array of departures [ev, ...]
    _minorEvents: {},   // stName -> sorted array of all events [ev, ...]

    // Corridor section precomputation for micro diagram
    _diagramSectionStations: [],
    _diagramSectionTrains: [],

    // Throttling state
    _lastArrivalMinute: -1,
    _lastArrivalContainer: null,
    _lastDepMinute: -1,
    _lastDepCycle: -1,
    _lastDepContainer: null,
    _lastMinorMinute: -1,
    _lastMinorContainer: null,

    /**
     * Initializes the controller, precomputing sorted arrivals, departures,
     * minor station events, and micro diagram corridor section.
     */
    init(hubConfig, STBY, D) {
      this._config = hubConfig || {};
      this._stby = STBY || {};
      this._data = D || {};

      this._arrivals = {};
      this._departures = {};
      this._minorEvents = {};
      this._diagramSectionStations = [];
      this._diagramSectionTrains = [];

      this.invalidate();

      const trains = (D && D.trains) || [];

      // 1. Process all station events
      for (let tIdx = 0; tIdx < trains.length; tIdx++) {
        const tr = trains[tIdx];
        const stops = tr.s || [];
        const n = stops.length;
        if (n === 0) continue;

        const origin = stops[0][0];
        const dest = stops[n - 1][0];

        for (let i = 0; i < n; i++) {
          const [stName, arrVal, depVal] = stops[i];
          const beg = (i === 0);
          const end = (i === n - 1);
          const a = (arrVal != null && arrVal !== '') ? Number(arrVal) : null;
          const d = (depVal != null && depVal !== '') ? Number(depVal) : null;

          // Arrival: a != null && !beg
          if (a != null && !beg) {
            if (!this._arrivals[stName]) this._arrivals[stName] = [];
            this._arrivals[stName].push({
              tr, a, d, beg, end, origin, dest, stName, stopIdx: i
            });
          }

          // Departure: d != null && !end
          if (d != null && !end) {
            if (!this._departures[stName]) this._departures[stName] = [];
            this._departures[stName].push({
              tr, a, d, beg, end, origin, dest, stName, stopIdx: i
            });
          }

          // Minor station events (all passenger stops)
          if (a != null || d != null) {
            if (!this._minorEvents[stName]) this._minorEvents[stName] = [];
            const time = (d != null && !end) ? d : (a != null ? a : d);
            this._minorEvents[stName].push({
              tr, a, d, beg, end, origin, dest, stName, time
            });
          }
        }
      }

      // Sort arrivals by arrival time ascending
      for (const stName in this._arrivals) {
        this._arrivals[stName].sort((x, y) => x.a - y.a);
      }

      // Sort departures by departure time ascending
      for (const stName in this._departures) {
        this._departures[stName].sort((x, y) => x.d - y.d);
      }

      // Sort minor events by time ascending
      for (const stName in this._minorEvents) {
        this._minorEvents[stName].sort((x, y) => x.time - y.time);
      }

      // 2. Precompute corridor section for micro diagram
      this._initDiagramSection();

      return this;
    },

    /**
     * Resets throttling caches so subsequent update calls re-render immediately.
     */
    invalidate() {
      this._lastArrivalMinute = -1;
      this._lastArrivalContainer = null;
      this._lastDepMinute = -1;
      this._lastDepCycle = -1;
      this._lastDepContainer = null;
      this._lastMinorMinute = -1;
      this._lastMinorContainer = null;
    },

    /**
     * Prepares diagram section stations and indexes train trajectories.
     * @private
     */
    _initDiagramSection() {
      const section = this._config.diagramSection;
      if (!section) return;

      let stList = [];
      let kmList = [];

      if (Array.isArray(section)) {
        stList = section.map(s => normSt(s).name);
      } else if (typeof section === 'object' && section !== null) {
        if (Array.isArray(section.stations)) {
          stList = section.stations.map(s => normSt(s).name);
        }
        if (Array.isArray(section.km)) {
          kmList = section.km.slice();
        }
      }

      if (stList.length < 2) return;

      // Compute physical distance if km array not explicitly provided
      if (kmList.length !== stList.length) {
        kmList = [0];
        let cum = 0;
        for (let i = 1; i < stList.length; i++) {
          const sPrev = this._stby[stList[i - 1]];
          const sCur = this._stby[stList[i]];
          if (sPrev && sCur && sPrev.lat != null && sCur.lat != null) {
            cum += Math.max(1, Math.round(geoDistKm(sPrev.lat, sPrev.lon, sCur.lat, sCur.lon)));
          } else {
            cum += 50; // reasonable fallback spacing
          }
          kmList.push(cum);
        }
      }

      this._diagramSectionStations = stList.map((name, i) => ({
        name,
        km: kmList[i]
      }));

      const stMap = new Map();
      this._diagramSectionStations.forEach((s) => stMap.set(s.name, s.km));

      // Index trains traversing two or more stations in the corridor
      const trains = (this._data && this._data.trains) || [];
      const sectionTrains = [];

      for (let tIdx = 0; tIdx < trains.length; tIdx++) {
        const tr = trains[tIdx];
        const stops = tr.s || [];
        const pts = [];

        for (let i = 0; i < stops.length; i++) {
          const [name, aVal, dVal] = stops[i];
          if (stMap.has(name)) {
            const km = stMap.get(name);
            const a = (aVal != null && aVal !== '') ? Number(aVal) : null;
            const d = (dVal != null && dVal !== '') ? Number(dVal) : null;
            if (a != null && d != null && a !== d) {
              pts.push({ name, km, t: a });
              pts.push({ name, km, t: d });
            } else if (d != null) {
              pts.push({ name, km, t: d });
            } else if (a != null) {
              pts.push({ name, km, t: a });
            }
          }
        }

        if (pts.length >= 2) {
          const minT = Math.min(...pts.map(p => p.t));
          const maxT = Math.max(...pts.map(p => p.t));
          sectionTrains.push({ tr, points: pts, minT, maxT });
        }
      }

      this._diagramSectionTrains = sectionTrains;
    },

    /**
     * Updates Arrival Board (Left HUD) for hubConfig.arrivalBoardStations.
     * Shows station header with arrivals progress and dark LED table.
     * Throttled to Math.floor(T).
     * @param {HTMLElement|string} containerEl - Board container element or ID
     * @param {number} T - Current simulation time in minutes from midnight (0..1440)
     * @param {boolean} [force=false] - Force update bypassing throttle
     */
    updateArrivalBoard(containerEl, T, force = false) {
      const el = typeof containerEl === 'string' ? document.getElementById(containerEl) : containerEl;
      if (!el) return;

      const curMinute = Math.floor(T);
      if (!force && this._lastArrivalMinute === curMinute && this._lastArrivalContainer === el && el.innerHTML) {
        return;
      }
      this._lastArrivalMinute = curMinute;
      this._lastArrivalContainer = el;

      const stations = (this._config && this._config.arrivalBoardStations) || [];
      const enMap = (this._config && this._config.enName) || {};
      let html = '';

      for (let sIdx = 0; sIdx < stations.length; sIdx++) {
        const stObj = normSt(stations[sIdx]);
        const stName = stObj.name;
        const stEn = stObj.en || enMap[stName] || '';
        const list = this._arrivals[stName] || [];
        const total = list.length;
        const arrived = list.filter(ev => ev.a <= T).length;
        const pct = total > 0 ? Math.min(100, Math.round((arrived / total) * 100)) : 0;

        // Upcoming arrivals in [T - 1, 1440], up to 3
        const upcoming = list.filter(ev => ev.a >= T - 1 && ev.a <= 1440).slice(0, 3);

        let rowsHtml = '';
        if (upcoming.length === 0) {
          rowsHtml = `<tr class="hub-empty-row"><td colspan="4" class="hub-empty-cell">本日到达已结束</td></tr>`;
        } else {
          rowsHtml = upcoming.map(ev => {
            const code = ev.tr.c.split('/')[0];
            const badge = trainBadgeInfo(ev.tr);
            const stock = formatRollingStock(ev.tr);
            const svg = locoHalfSvg(ev.tr, 14);
            return `<tr class="hub-table-row">`
              + `<td class="hub-col-time">${formatTime(ev.a)}</td>`
              + `<td class="hub-col-code"><span class="hub-code-txt" style="color:${badge.bg};">${code}</span></td>`
              + `<td class="hub-col-origin" title="${ev.origin}">${ev.origin}</td>`
              + `<td class="hub-col-stock">`
              + `<span class="hub-stock-name" title="${stock}">${stock}</span>`
              + `<span class="hub-stock-ico">${svg}</span>`
              + `</td>`
              + `</tr>`;
          }).join('');
        }

        html += `<div class="hub-board-card" data-station="${stName}">`
          + `<div class="hub-card-header">`
          + `<div class="hub-header-title-box">`
          + `<span class="hub-station-name">${stName}</span>`
          + `${stEn ? `<span class="hub-station-en">${stEn}</span>` : ''}`
          + `<span class="hub-pill-tag">到达 · 含经停</span>`
          + `</div>`
          + `<div class="hub-header-stat-box">`
          + `<span class="hub-stat-num">${arrived} / ${total}</span><span class="hub-stat-unit"> 列</span>`
          + `</div>`
          + `</div>`
          + `<div class="hub-progress-track">`
          + `<div class="hub-progress-bar" style="width:${pct}%;"></div>`
          + `</div>`
          + `<table class="hub-led-table">`
          + `<thead>`
          + `<tr>`
          + `<th style="width:16%;">时刻</th>`
          + `<th style="width:20%;">车次</th>`
          + `<th style="width:22%;">始发站</th>`
          + `<th style="width:42%;">车型 / 牵引·车底</th>`
          + `</tr>`
          + `</thead>`
          + `<tbody>${rowsHtml}</tbody>`
          + `</table>`
          + `</div>`;
      }

      el.innerHTML = html;
    },

    /**
     * Updates Departure Board (Right HUD) for hubConfig.departureBoardStations.
     * Shows header (station, English name, page indicator • p/P cycling every 4s)
     * and dark LED table.
     * Throttled to Math.floor(T) and pageCycle.
     * @param {HTMLElement|string} containerEl - Board container element or ID
     * @param {number} T - Current simulation time in minutes from midnight (0..1440)
     * @param {number} [nowMs=Date.now()] - Wall-clock timestamp for page cycling
     * @param {boolean} [force=false] - Force update bypassing throttle
     */
    updateDepartureBoard(containerEl, T, nowMs = Date.now(), force = false) {
      const el = typeof containerEl === 'string' ? document.getElementById(containerEl) : containerEl;
      if (!el) return;

      const curMinute = Math.floor(T);
      const pageCycle = Math.floor(nowMs / 4000);

      if (!force && this._lastDepMinute === curMinute && this._lastDepCycle === pageCycle && this._lastDepContainer === el && el.innerHTML) {
        return;
      }
      this._lastDepMinute = curMinute;
      this._lastDepCycle = pageCycle;
      this._lastDepContainer = el;

      const stations = (this._config && this._config.departureBoardStations) || [];
      const enMap = (this._config && this._config.enName) || {};
      let html = '';

      for (let sIdx = 0; sIdx < stations.length; sIdx++) {
        const stObj = normSt(stations[sIdx]);
        const stName = stObj.name;
        const stEn = stObj.en || enMap[stName] || (this._stby[stName] && this._stby[stName].code) || '';
        const list = this._departures[stName] || [];

        // Departures remaining today
        const remainingToday = list.filter(ev => ev.d >= T - 1 && ev.d <= 1440);
        // Departures in next 45 minutes
        const in45m = list.filter(ev => ev.d >= T - 1 && ev.d <= T + 45);

        const pool = in45m.length > 0 ? in45m : remainingToday;
        const pageSize = 3;
        const totalPages = Math.max(1, Math.ceil(pool.length / pageSize));
        const curPage = (pageCycle % totalPages) + 1;
        const pageIndicator = `• ${curPage}/${totalPages}`;

        const slice = pool.slice((curPage - 1) * pageSize, curPage * pageSize);

        let rowsHtml = '';
        if (pool.length === 0) {
          rowsHtml = `<tr class="hub-empty-row"><td colspan="5" class="hub-empty-cell">本日发车已结束</td></tr>`;
        } else {
          rowsHtml = slice.map(ev => {
            const code = ev.tr.c.split('/')[0];
            const badge = trainBadgeInfo(ev.tr);
            const stock = formatRollingStock(ev.tr);
            const svg = locoHalfSvg(ev.tr, 14);
            return `<tr class="hub-table-row">`
              + `<td class="hub-col-badge"><span class="hub-badge-pill" style="background:${badge.bg};color:${badge.fg};">${badge.label}</span></td>`
              + `<td class="hub-col-code"><span class="hub-code-txt" style="color:${badge.bg};font-weight:700;">${code}</span></td>`
              + `<td class="hub-col-time">${formatTime(ev.d)}</td>`
              + `<td class="hub-col-dest" title="${ev.dest}">${ev.dest}</td>`
              + `<td class="hub-col-stock">`
              + `<span class="hub-stock-name" title="${stock}">${stock}</span>`
              + `<span class="hub-stock-ico">${svg}</span>`
              + `</td>`
              + `</tr>`;
          }).join('');
        }

        html += `<div class="hub-board-card" data-station="${stName}">`
          + `<div class="hub-card-header">`
          + `<div class="hub-header-title-box">`
          + `<span class="hub-station-name">${stName}</span>`
          + `${stEn ? `<span class="hub-station-en">${stEn}</span>` : ''}`
          + `</div>`
          + `<div class="hub-header-stat-box">`
          + `<span class="hub-page-tag">${pageIndicator}</span>`
          + `</div>`
          + `</div>`
          + `<table class="hub-led-table">`
          + `<thead>`
          + `<tr>`
          + `<th style="width:14%;">种别</th>`
          + `<th style="width:18%;">车次</th>`
          + `<th style="width:16%;">时刻</th>`
          + `<th style="width:18%;">开往</th>`
          + `<th style="width:34%;">车型 / 牵引·车底</th>`
          + `</tr>`
          + `</thead>`
          + `<tbody>${rowsHtml}</tbody>`
          + `</table>`
          + `</div>`;
      }

      el.innerHTML = html;
    },

    /**
     * Updates Minor Stations Cards (Bottom row of 7 station cards).
     * Shows station name, next train time, train code (colored), destination,
     * model string + mini side-profile SVG, and today's completed stops progress.
     * Throttled to Math.floor(T).
     * @param {HTMLElement|string} containerEl - Container element or ID
     * @param {number} T - Current simulation time in minutes from midnight (0..1440)
     * @param {boolean} [force=false] - Force update bypassing throttle
     */
    updateMinorCards(containerEl, T, force = false) {
      const el = typeof containerEl === 'string' ? document.getElementById(containerEl) : containerEl;
      if (!el) return;

      const curMinute = Math.floor(T);
      if (!force && this._lastMinorMinute === curMinute && this._lastMinorContainer === el && el.innerHTML) {
        return;
      }
      this._lastMinorMinute = curMinute;
      this._lastMinorContainer = el;

      const stations = (this._config && this._config.minorStations) || [];
      let cardsHtml = '';

      for (let sIdx = 0; sIdx < stations.length; sIdx++) {
        const stName = normSt(stations[sIdx]).name;
        const list = this._minorEvents[stName] || [];
        const total = list.length;
        const completed = list.filter(ev => ev.time <= T).length;
        const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

        const nextEv = list.find(ev => ev.time >= T - 0.5);

        let timeStr = '已结束';
        let codeStr = '--';
        let badgeColor = '#64748b';
        let destStr = '今日无后续';
        let stockStr = '';
        let svgHtml = '';

        if (nextEv) {
          timeStr = formatTime(nextEv.time);
          codeStr = nextEv.tr.c.split('/')[0];
          const badge = trainBadgeInfo(nextEv.tr);
          badgeColor = badge.bg;
          destStr = `→ ${nextEv.dest}`;
          stockStr = formatRollingStock(nextEv.tr);
          svgHtml = locoHalfSvg(nextEv.tr, 14);
        }

        cardsHtml += `<div class="hub-minor-card" data-station="${stName}">`
          + `<div class="hub-minor-top">`
          + `<span class="hub-minor-station">${stName}</span>`
          + `<span class="hub-minor-time">${timeStr}</span>`
          + `</div>`
          + `<div class="hub-minor-mid">`
          + `<span class="hub-minor-code" style="color:${badgeColor};">${codeStr}</span>`
          + `<span class="hub-minor-dest" title="${destStr}">${destStr}</span>`
          + `</div>`
          + `<div class="hub-minor-stock-row">`
          + `<span class="hub-minor-stock-txt" title="${stockStr}">${stockStr}</span>`
          + `<span class="hub-minor-stock-svg">${svgHtml}</span>`
          + `</div>`
          + `<div class="hub-minor-track">`
          + `<div class="hub-minor-bar" style="width:${pct}%;"></div>`
          + `</div>`
          + `</div>`;
      }

      el.innerHTML = `<div class="hub-minor-grid">${cardsHtml}</div>`;
    },

    /**
     * Draws real-time scrolling 40-minute window [T - 10, T + 30]
     * time-space corridor diagram on canvas.
     * @param {HTMLCanvasElement|string} canvasEl - Canvas element or ID
     * @param {number} T - Current simulation time in minutes from midnight (0..1440)
     */
    drawMicroDiagram(canvasEl, T) {
      const canvas = typeof canvasEl === 'string' ? document.getElementById(canvasEl) : canvasEl;
      if (!canvas) return;

      const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
      const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { width: canvas.width || 480, height: canvas.height || 180 };
      const w = Math.round(rect.width || canvas.width || 480);
      const h = Math.round(rect.height || canvas.height || 180);

      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Sizing margins
      const padT = 20, padB = 22, padL = 58, padR = 16;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;

      // Clear Canvas Background
      ctx.fillStyle = '#080c14';
      ctx.fillRect(0, 0, w, h);

      // Section title
      const secTitle = (this._config && this._config.diagramSection && (this._config.diagramSection.title || this._config.diagramSection.name)) || '走廊断面';
      ctx.fillStyle = '#64748b';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(secTitle, padL + plotW, padT - 6);

      const stations = this._diagramSectionStations;
      if (!stations || stations.length < 2) {
        ctx.fillStyle = '#64748b';
        ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('无有效断面配置', w / 2, h / 2);
        ctx.restore();
        return;
      }

      const t0 = T - 10;
      const t1 = T + 30;
      const kMin = stations[0].km;
      const kMax = stations[stations.length - 1].km;
      const kSpan = (kMax - kMin) || 1;

      const xForTime = tm => padL + ((tm - t0) / 40) * plotW;
      const yForKm = km => padT + ((km - kMin) / kSpan) * plotH;

      // 1. Past Time Shading [t0, T]
      const nowX = xForTime(T);
      if (nowX > padL) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
        ctx.fillRect(padL, padT, Math.min(plotW, nowX - padL), plotH);
      }

      // 2. Vertical Time Grid Lines (every 5 & 10 mins)
      const startM = Math.ceil(t0 / 5) * 5;
      for (let tm = startM; tm <= t1; tm += 5) {
        const gx = xForTime(tm);
        const is10 = (tm % 10 === 0);
        ctx.strokeStyle = is10 ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(gx, padT);
        ctx.lineTo(gx, padT + plotH);
        ctx.stroke();

        if (is10) {
          ctx.fillStyle = 'rgba(148, 163, 184, 0.75)';
          ctx.font = '9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(formatTime(tm), gx, padT + plotH + 13);
        }
      }

      // 3. Station Horizontal Grid Lines & Labels
      for (let sIdx = 0; sIdx < stations.length; sIdx++) {
        const st = stations[sIdx];
        const gy = yForKm(st.km);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padL, gy);
        ctx.lineTo(padL + plotW, gy);
        ctx.stroke();

        ctx.fillStyle = '#cbd5e1';
        ctx.font = '10.5px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(st.name, padL - 8, gy);
      }

      // 4. Train Lines Traversing Corridor Section
      const trains = this._diagramSectionTrains;
      for (let tIdx = 0; tIdx < trains.length; tIdx++) {
        const tEntry = trains[tIdx];
        if (tEntry.maxT < t0 - 2 || tEntry.minT > t1 + 2) continue;

        const pts = tEntry.points;
        const badge = trainBadgeInfo(tEntry.tr);
        ctx.strokeStyle = badge.bg || '#38bdf8';
        ctx.lineWidth = /^[GCD]/.test(tEntry.tr.c) ? 1.8 : 1.4;

        ctx.beginPath();
        let started = false;
        let midP1 = null, midP2 = null;

        for (let i = 0; i < pts.length; i++) {
          const px = xForTime(pts[i].t);
          const py = yForKm(pts[i].km);
          if (!started) {
            ctx.moveTo(px, py);
            started = true;
          } else {
            ctx.lineTo(px, py);
            // Pick a segment inside the visible window for train label
            if (pts[i - 1].t < t1 && pts[i].t > t0 && !midP1) {
              midP1 = pts[i - 1];
              midP2 = pts[i];
            }
          }
        }
        ctx.stroke();

        // Train Code Label on Line
        if (midP1 && midP2 && Math.abs(midP2.km - midP1.km) > 2) {
          const segMidT = Math.max(t0 + 2, Math.min(t1 - 2, (midP1.t + midP2.t) / 2));
          const segRatio = (segMidT - midP1.t) / ((midP2.t - midP1.t) || 1);
          const segMidKm = midP1.km + segRatio * (midP2.km - midP1.km);
          const lx = xForTime(segMidT);
          const ly = yForKm(segMidKm);

          const angle = Math.atan2(yForKm(midP2.km) - yForKm(midP1.km), xForTime(midP2.t) - xForTime(midP1.t));

          ctx.save();
          ctx.translate(lx, ly);
          ctx.rotate(angle);
          ctx.fillStyle = '#090d16';
          ctx.fillRect(-13, -7, 26, 11);
          ctx.fillStyle = badge.bg || '#38bdf8';
          ctx.font = 'bold 8.5px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(tEntry.tr.c.split('/')[0], 0, -1);
          ctx.restore();
        }
      }

      // 5. Current Time "NOW" Indicator Line
      if (nowX >= padL && nowX <= padL + plotW) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3.5, 2.5]);
        ctx.beginPath();
        ctx.moveTo(nowX, padT - 3);
        ctx.lineTo(nowX, padT + plotH + 3);
        ctx.stroke();
        ctx.setLineDash([]);

        // "NOW" Tag Pill
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('NOW ' + formatTime(T), nowX, padT - 6);
      }

      ctx.restore();
    },

    showToast: showHubToast
  };

  // =========================================================================
  // 7. Inject Scoped Dark Theme CSS
  // =========================================================================
  if (typeof document !== 'undefined' && !document.getElementById('hub-boards-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'hub-boards-styles';
    styleEl.textContent = `
      .hub-board-card {
        background: rgba(13, 19, 33, 0.85);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        padding: 10px 12px;
        margin-bottom: 10px;
        color: #f1f5f9;
        font-family: system-ui, -apple-system, sans-serif;
      }
      .hub-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
      }
      .hub-header-title-box {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .hub-station-name {
        font-size: 14px;
        font-weight: 700;
        color: #f8fafc;
        letter-spacing: 0.3px;
      }
      .hub-station-en {
        font-size: 10.5px;
        color: #94a3b8;
        font-family: monospace;
        letter-spacing: 0.5px;
      }
      .hub-pill-tag {
        font-size: 10px;
        background: rgba(56, 189, 248, 0.15);
        color: #38bdf8;
        border: 1px solid rgba(56, 189, 248, 0.3);
        padding: 1px 6px;
        border-radius: 9999px;
      }
      .hub-header-stat-box {
        font-family: monospace;
        font-size: 11px;
        color: #94a3b8;
      }
      .hub-stat-num {
        color: #38bdf8;
        font-weight: 700;
      }
      .hub-page-tag {
        font-family: monospace;
        font-size: 11px;
        color: #fbbf24;
        background: rgba(251, 191, 36, 0.12);
        padding: 2px 6px;
        border-radius: 4px;
        border: 1px solid rgba(251, 191, 36, 0.25);
      }
      .hub-progress-track {
        height: 3px;
        background: rgba(255, 255, 255, 0.08);
        border-radius: 2px;
        overflow: hidden;
        margin-bottom: 8px;
      }
      .hub-progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #0284c7, #38bdf8);
        transition: width 0.4s ease;
      }
      .hub-led-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11.5px;
      }
      .hub-led-table th {
        text-align: left;
        color: #64748b;
        font-size: 10px;
        font-weight: 500;
        padding: 3px 4px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      }
      .hub-table-row {
        border-bottom: 1px solid rgba(255, 255, 255, 0.03);
      }
      .hub-table-row:last-child {
        border-bottom: none;
      }
      .hub-table-row td {
        padding: 5px 4px;
        vertical-align: middle;
      }
      .hub-col-time {
        font-family: monospace;
        color: #38bdf8;
        font-weight: 600;
      }
      .hub-col-code {
        font-family: monospace;
        font-weight: 700;
      }
      .hub-badge-pill {
        display: inline-block;
        font-size: 9.5px;
        padding: 1px 5px;
        border-radius: 3px;
        font-weight: 600;
      }
      .hub-col-stock {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
      }
      .hub-stock-name {
        color: #cbd5e1;
        font-size: 11px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 130px;
      }
      .hub-stock-ico {
        flex-shrink: 0;
        display: flex;
        align-items: center;
      }
      .hub-empty-cell {
        text-align: center;
        color: #64748b;
        padding: 12px 4px;
        font-style: italic;
        font-size: 11px;
      }
      .hub-minor-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
        gap: 8px;
        width: 100%;
      }
      .hub-minor-card {
        background: rgba(13, 19, 33, 0.85);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 6px;
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        color: #f1f5f9;
        font-family: system-ui, -apple-system, sans-serif;
      }
      .hub-minor-top {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
      }
      .hub-minor-station {
        font-size: 12px;
        font-weight: 700;
        color: #f8fafc;
      }
      .hub-minor-time {
        font-family: monospace;
        font-size: 11px;
        color: #38bdf8;
        font-weight: 600;
      }
      .hub-minor-mid {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .hub-minor-code {
        font-family: monospace;
        font-weight: 700;
        font-size: 11px;
      }
      .hub-minor-dest {
        color: #94a3b8;
        font-size: 10.5px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .hub-minor-stock-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 4px;
        margin-top: 2px;
      }
      .hub-minor-stock-txt {
        font-size: 9.5px;
        color: #64748b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 70px;
      }
      .hub-minor-stock-svg {
        flex-shrink: 0;
        display: flex;
        align-items: center;
      }
      .hub-minor-track {
        height: 2px;
        background: rgba(255, 255, 255, 0.06);
        border-radius: 1px;
        overflow: hidden;
        margin-top: 4px;
      }
      .hub-minor-bar {
        height: 100%;
        background: #38bdf8;
        transition: width 0.4s ease;
      }
    `;
    document.head.appendChild(styleEl);
  }

  // =========================================================================
  // 8. Global & Module Exports
  // =========================================================================

  global.locoHalfSvg = locoHalfSvg;
  global.formatRollingStock = formatRollingStock;
  global.trainBadgeInfo = trainBadgeInfo;
  global.showHubToast = showHubToast;
  global.HubToast = { show: showHubToast };
  global.HubBoards = HubBoards;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      locoHalfSvg,
      formatRollingStock,
      trainBadgeInfo,
      showHubToast,
      HubToast: { show: showHubToast },
      HubBoards
    };
  }

})(typeof window !== 'undefined' ? window : globalThis);
