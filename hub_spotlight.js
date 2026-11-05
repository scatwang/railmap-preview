/**
 * hub_spotlight.js - Spotlight Train Feature Card + Upgraded Corridor Time-Space Diagram
 * Component C + D for Chinese Railway Hub HUD System (CR-HUD)
 *
 * Implements:
 * 1. window.fullTrainSideSvg(tr, height = 34): Full 140x32 EMU or 150x32 Locomotive + 25T/25G Coach
 * 2. HubSpotlight.getCurrentSpotlight(T, nowMs, stateFn): Smart rotation & narrative train selector
 * 3. HubSpotlight.pinTrain(tr) / unpinTrain() / isPinned(): Interactive map train selection
 * 4. HubSpotlight.updateCard(containerEl, T, nowMs, stateFn, theme): Sleek ~135px right-sidebar card
 * 5. HubSpotlight.drawCorridorDiagram(canvasEl, T, spotlightTr, theme): Upgraded 50min [T-12, T+38] diagram
 * 6. HubSpotlight.drawMapHighlight(ctx, map, spotlightTr, st, nowMs, theme): Pulsing target reticle
 */

(function (global) {
  'use strict';

  // =========================================================================
  // 1. Full-size Side-Profile Train SVG Generators (Locomotive + Passenger Coach)
  // =========================================================================

  /**
   * Generates a complete 150x32 SVG of HXD3D Electric Locomotive coupled to a 25T Coach.
   * ViewBox 0 0 150 32.
   */
  function convHxd3dSvg(w, h) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 150 32">`
      + `<!-- Front Coupler & Cowcatcher -->`
      + `<rect x="0.5" y="24" width="2.5" height="1.8" fill="#1e293b"/>`
      + `<path d="M2.5,27 L9,27 L7.5,24.5 L3.5,24.5 Z" fill="#334155"/>`
      + `<!-- Locomotive Body (Classic Red #dc2626) -->`
      + `<path d="M3.5,24.5 L5.5,19.5 L13,8.5 L22,5.5 L69,5.5 L69,26.5 L5.5,26.5 Z" fill="#dc2626"/>`
      + `<!-- Roof equipment -->`
      + `<rect x="21" y="4.2" width="46" height="1.8" rx="0.4" fill="#e2e8f0"/>`
      + `<!-- Cream / White Lightning Speed Ribbon -->`
      + `<path d="M5.5,19.5 L13,13.5 L32,13.5 L28,16.5 L12,16.5 L7.5,22 Z" fill="#fef2f2"/>`
      + `<rect x="16" y="21" width="52" height="1.8" fill="#fef2f2"/>`
      + `<!-- Cab Windshield & Frame -->`
      + `<path d="M11,9.8 L16.5,6.6 L21,6.6 L17.5,10.8 Z" fill="#0f172a" stroke="#475569" stroke-width="0.5"/>`
      + `<rect x="22.5" y="7.6" width="5" height="4" rx="0.5" fill="#1e293b"/>`
      + `<!-- Side Louvers -->`
      + `<rect x="31" y="8.5" width="10" height="4" rx="0.4" fill="#991b1b"/>`
      + `<line x1="31" y1="9.8" x2="41" y2="9.8" stroke="#dc2626" stroke-width="0.6"/>`
      + `<line x1="31" y1="11.2" x2="41" y2="11.2" stroke="#dc2626" stroke-width="0.6"/>`
      + `<rect x="44" y="8.5" width="10" height="4" rx="0.4" fill="#991b1b"/>`
      + `<line x1="44" y1="9.8" x2="54" y2="9.8" stroke="#dc2626" stroke-width="0.6"/>`
      + `<line x1="44" y1="11.2" x2="54" y2="11.2" stroke="#dc2626" stroke-width="0.6"/>`
      + `<!-- Headlight -->`
      + `<circle cx="5" cy="20.5" r="1.1" fill="#fef08a"/>`
      + `<!-- Pantograph -->`
      + `<line x1="54" y1="3.8" x2="47" y2="1.6" stroke="#475569" stroke-width="0.9"/>`
      + `<line x1="47" y1="1.6" x2="57" y2="0.8" stroke="#475569" stroke-width="0.8"/>`
      + `<line x1="53" y1="0.6" x2="60" y2="0.6" stroke="#1e293b" stroke-width="1.1"/>`
      + `<!-- Front Bogie (3 Axles) -->`
      + `<rect x="9" y="26.5" width="25" height="1.8" rx="0.4" fill="#1e293b"/>`
      + `<circle cx="13" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="13" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<circle cx="21.5" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="21.5" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<circle cx="30" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="30" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<!-- Rear Bogie (3 Axles) -->`
      + `<rect x="42" y="26.5" width="25" height="1.8" rx="0.4" fill="#1e293b"/>`
      + `<circle cx="46" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="46" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<circle cx="54.5" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="54.5" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<circle cx="63" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="63" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<!-- Underframe Tank -->`
      + `<rect x="34.5" y="26.8" width="7" height="2.2" rx="0.4" fill="#0f172a"/>`
      + `<!-- Coupler & Gangway between Loco and Coach -->`
      + `<rect x="69" y="24.2" width="4" height="2.2" fill="#0f172a"/>`
      + `<rect x="69.5" y="9.5" width="2.5" height="14.5" fill="#334155"/>`
      + `<!-- 25T Passenger Coach (White Body #f8fafc) -->`
      + `<path d="M72,8 C72.5,5.5 74.5,4.6 77.5,4.6 L148.5,4.6 L148.5,26.5 L72,26.5 Z" fill="#f8fafc"/>`
      + `<!-- Blue Window Band #1e40af -->`
      + `<rect x="72" y="9.8" width="76.5" height="6.5" fill="#1e40af"/>`
      + `<!-- Coach Windows -->`
      + `<rect x="76" y="10.8" width="6" height="4.5" rx="0.6" fill="#e2e8f0" stroke="#0f172a" stroke-width="0.4"/>`
      + `<rect x="86" y="10.8" width="8.5" height="4.5" rx="0.6" fill="#e2e8f0" stroke="#0f172a" stroke-width="0.4"/>`
      + `<rect x="98" y="10.8" width="8.5" height="4.5" rx="0.6" fill="#e2e8f0" stroke="#0f172a" stroke-width="0.4"/>`
      + `<rect x="110" y="10.8" width="8.5" height="4.5" rx="0.6" fill="#e2e8f0" stroke="#0f172a" stroke-width="0.4"/>`
      + `<rect x="122" y="10.8" width="8.5" height="4.5" rx="0.6" fill="#e2e8f0" stroke="#0f172a" stroke-width="0.4"/>`
      + `<rect x="134" y="10.8" width="8.5" height="4.5" rx="0.6" fill="#e2e8f0" stroke="#0f172a" stroke-width="0.4"/>`
      + `<rect x="144.5" y="10.8" width="3.5" height="4.5" rx="0.4" fill="#e2e8f0" stroke="#0f172a" stroke-width="0.4"/>`
      + `<!-- Coach Skirt -->`
      + `<rect x="72" y="24" width="76.5" height="2.5" fill="#94a3b8"/>`
      + `<!-- Coach Bogie 1 -->`
      + `<rect x="80" y="26.8" width="18" height="1.6" rx="0.4" fill="#1e293b"/>`
      + `<circle cx="84" cy="28.8" r="2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="84" cy="28.8" r="0.6" fill="#94a3b8"/>`
      + `<circle cx="94" cy="28.8" r="2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="94" cy="28.8" r="0.6" fill="#94a3b8"/>`
      + `<!-- Coach Bogie 2 -->`
      + `<rect x="126" y="26.8" width="18" height="1.6" rx="0.4" fill="#1e293b"/>`
      + `<circle cx="130" cy="28.8" r="2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="130" cy="28.8" r="0.6" fill="#94a3b8"/>`
      + `<circle cx="140" cy="28.8" r="2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="140" cy="28.8" r="0.6" fill="#94a3b8"/>`
      + `<!-- Rear End Line & Tail Marker -->`
      + `<line x1="148.5" y1="4.6" x2="148.5" y2="26.5" stroke="#1e293b" stroke-width="1.1"/>`
      + `<circle cx="147.2" cy="22" r="0.8" fill="#ef4444"/>`
      + `<!-- Outer Loco Outline -->`
      + `<path d="M3.5,24.5 L5.5,19.5 L13,8.5 L22,5.5 L69,5.5 L69,26.5 L5.5,26.5 Z" fill="none" stroke="#1e293b" stroke-width="1"/>`
      + `</svg>`;
  }

  /**
   * Generates a complete 150x32 SVG of HXD1D Streamlined Blue Electric Locomotive coupled to a 25T Coach.
   */
  function convHxd1dSvg(w, h) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 150 32">`
      + `<!-- Coupler & Cowcatcher -->`
      + `<rect x="0.5" y="24" width="2.5" height="1.8" fill="#1e293b"/>`
      + `<path d="M2.5,27 L9,27 L7.5,24.5 L3.5,24.5 Z" fill="#334155"/>`
      + `<!-- Locomotive Cobalt Blue Body (#1d4ed8) -->`
      + `<path d="M3.5,24.5 L5,18 L12,8 L20,5.5 L69,5.5 L69,26.5 L5.5,26.5 Z" fill="#1d4ed8"/>`
      + `<!-- Sky Blue Flowing Ribbon (#38bdf8) -->`
      + `<path d="M5,18 L12,12 L32,12 L28,15 L11,15 L6.5,21.5 Z" fill="#38bdf8"/>`
      + `<rect x="16" y="19" width="52" height="2" fill="#ffffff"/>`
      + `<rect x="16" y="21.5" width="52" height="1.5" fill="#38bdf8"/>`
      + `<!-- Cab Windshield & Pillars -->`
      + `<path d="M10,9.5 L15.5,6.5 L20,6.5 L16.5,10.5 Z" fill="#0f172a" stroke="#475569" stroke-width="0.5"/>`
      + `<rect x="22" y="7.5" width="5" height="4" rx="0.5" fill="#1e293b"/>`
      + `<!-- Side Louvers -->`
      + `<rect x="32" y="8.5" width="12" height="4" rx="0.4" fill="#1e3a8a"/>`
      + `<rect x="48" y="8.5" width="12" height="4" rx="0.4" fill="#1e3a8a"/>`
      + `<!-- Headlight -->`
      + `<circle cx="4.8" cy="19.5" r="1.1" fill="#fef08a"/>`
      + `<!-- Dual Pantographs -->`
      + `<line x1="28" y1="3.8" x2="23" y2="1.5" stroke="#475569" stroke-width="0.8"/>`
      + `<line x1="23" y1="1.5" x2="31" y2="0.8" stroke="#475569" stroke-width="0.7"/>`
      + `<line x1="58" y1="3.8" x2="52" y2="1.5" stroke="#475569" stroke-width="0.8"/>`
      + `<line x1="52" y1="1.5" x2="60" y2="0.8" stroke="#475569" stroke-width="0.7"/>`
      + `<!-- 3-Axle Bogies -->`
      + `<rect x="9" y="26.5" width="25" height="1.8" rx="0.4" fill="#1e293b"/>`
      + `<circle cx="13" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="13" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<circle cx="21.5" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="21.5" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<circle cx="30" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="30" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<rect x="42" y="26.5" width="25" height="1.8" rx="0.4" fill="#1e293b"/>`
      + `<circle cx="46" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="46" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<circle cx="54.5" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="54.5" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<circle cx="63" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="63" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<!-- Coupler & Gangway -->`
      + `<rect x="69" y="24.2" width="4" height="2.2" fill="#0f172a"/>`
      + `<rect x="69.5" y="9.5" width="2.5" height="14.5" fill="#334155"/>`
      + `<!-- 25T Coach -->`
      + `<path d="M72,8 C72.5,5.5 74.5,4.6 77.5,4.6 L148.5,4.6 L148.5,26.5 L72,26.5 Z" fill="#f8fafc"/>`
      + `<rect x="72" y="9.8" width="76.5" height="6.5" fill="#1e40af"/>`
      + `<rect x="76" y="10.8" width="6" height="4.5" rx="0.6" fill="#e2e8f0" stroke="#0f172a" stroke-width="0.4"/>`
      + `<rect x="86" y="10.8" width="8.5" height="4.5" rx="0.6" fill="#e2e8f0" stroke="#0f172a" stroke-width="0.4"/>`
      + `<rect x="98" y="10.8" width="8.5" height="4.5" rx="0.6" fill="#e2e8f0" stroke="#0f172a" stroke-width="0.4"/>`
      + `<rect x="110" y="10.8" width="8.5" height="4.5" rx="0.6" fill="#e2e8f0" stroke="#0f172a" stroke-width="0.4"/>`
      + `<rect x="122" y="10.8" width="8.5" height="4.5" rx="0.6" fill="#e2e8f0" stroke="#0f172a" stroke-width="0.4"/>`
      + `<rect x="134" y="10.8" width="8.5" height="4.5" rx="0.6" fill="#e2e8f0" stroke="#0f172a" stroke-width="0.4"/>`
      + `<rect x="144.5" y="10.8" width="3.5" height="4.5" rx="0.4" fill="#e2e8f0" stroke="#0f172a" stroke-width="0.4"/>`
      + `<rect x="72" y="24" width="76.5" height="2.5" fill="#94a3b8"/>`
      + `<rect x="80" y="26.8" width="18" height="1.6" rx="0.4" fill="#1e293b"/>`
      + `<circle cx="84" cy="28.8" r="2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="84" cy="28.8" r="0.6" fill="#94a3b8"/>`
      + `<circle cx="94" cy="28.8" r="2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="94" cy="28.8" r="0.6" fill="#94a3b8"/>`
      + `<rect x="126" y="26.8" width="18" height="1.6" rx="0.4" fill="#1e293b"/>`
      + `<circle cx="130" cy="28.8" r="2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="130" cy="28.8" r="0.6" fill="#94a3b8"/>`
      + `<circle cx="140" cy="28.8" r="2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="140" cy="28.8" r="0.6" fill="#94a3b8"/>`
      + `<line x1="148.5" y1="4.6" x2="148.5" y2="26.5" stroke="#1e293b" stroke-width="1.1"/>`
      + `<circle cx="147.2" cy="22" r="0.8" fill="#ef4444"/>`
      + `<path d="M3.5,24.5 L5,18 L12,8 L20,5.5 L69,5.5 L69,26.5 L5.5,26.5 Z" fill="none" stroke="#1e293b" stroke-width="1"/>`
      + `</svg>`;
  }

  /**
   * Generates a complete 150x32 SVG of NDJ3 "Harmony Great Wall" Diesel DMU (Power Car + Trailer).
   */
  function convNdj3Svg(w, h) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 150 32">`
      + `<!-- Front Coupler -->`
      + `<rect x="0.5" y="24" width="2.5" height="1.8" fill="#1e293b"/>`
      + `<!-- Power Car White Body -->`
      + `<path d="M2.5,24.5 L6,18 L16,7.5 L26,5 L69,5 L69,26.5 L4,26.5 Z" fill="#ffffff"/>`
      + `<!-- Ocean Blue Wave Ribbon #0284c7 -->`
      + `<path d="M4.5,21.5 L14,14 L32,14 L28,18 L12,18 L6.5,23.5 Z" fill="#0284c7"/>`
      + `<rect x="16" y="21" width="53" height="2" fill="#0284c7"/>`
      + `<rect x="20" y="23" width="49" height="1.2" fill="#1e40af"/>`
      + `<!-- Cab Windshield -->`
      + `<path d="M12,8.8 L18,6.2 L24,6.2 L19,10.2 Z" fill="#0f172a" stroke="#475569" stroke-width="0.5"/>`
      + `<rect x="26" y="7.5" width="6" height="4" rx="0.5" fill="#1e293b"/>`
      + `<!-- Roof Exhaust Stack -->`
      + `<rect x="42" y="3.8" width="12" height="1.6" rx="0.4" fill="#334155"/>`
      + `<!-- Headlight -->`
      + `<circle cx="4.8" cy="20" r="1.1" fill="#fef08a"/>`
      + `<!-- Bogies -->`
      + `<rect x="11" y="26.5" width="22" height="1.8" rx="0.4" fill="#1e293b"/>`
      + `<circle cx="15" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="15" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<circle cx="27" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="27" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<rect x="45" y="26.5" width="22" height="1.8" rx="0.4" fill="#1e293b"/>`
      + `<circle cx="49" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="49" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<circle cx="61" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="61" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<!-- Coupler & Gangway -->`
      + `<rect x="69" y="24.2" width="4" height="2.2" fill="#0f172a"/>`
      + `<rect x="69.5" y="9" width="2.5" height="15" fill="#334155"/>`
      + `<!-- Coach Body White -->`
      + `<path d="M72,7.5 C72.5,5.2 74.5,4.5 77.5,4.5 L148.5,4.5 L148.5,26.5 L72,26.5 Z" fill="#ffffff"/>`
      + `<!-- Ocean Blue Window Band -->`
      + `<rect x="72" y="9" width="76.5" height="6.5" fill="#0284c7"/>`
      + `<rect x="72" y="21" width="76.5" height="2" fill="#0284c7"/>`
      + `<rect x="72" y="23" width="76.5" height="1.2" fill="#1e40af"/>`
      + `<!-- Windows -->`
      + `<rect x="76" y="9.8" width="7" height="4.8" rx="0.6" fill="#0f172a"/>`
      + `<rect x="87" y="9.8" width="9.5" height="4.8" rx="0.6" fill="#0f172a"/>`
      + `<rect x="100" y="9.8" width="9.5" height="4.8" rx="0.6" fill="#0f172a"/>`
      + `<rect x="113" y="9.8" width="9.5" height="4.8" rx="0.6" fill="#0f172a"/>`
      + `<rect x="126" y="9.8" width="9.5" height="4.8" rx="0.6" fill="#0f172a"/>`
      + `<rect x="139" y="9.8" width="7" height="4.8" rx="0.6" fill="#0f172a"/>`
      + `<!-- Coach Bogie 1 -->`
      + `<rect x="80" y="26.8" width="18" height="1.6" rx="0.4" fill="#1e293b"/>`
      + `<circle cx="84" cy="28.8" r="2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="84" cy="28.8" r="0.6" fill="#94a3b8"/>`
      + `<circle cx="94" cy="28.8" r="2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="94" cy="28.8" r="0.6" fill="#94a3b8"/>`
      + `<!-- Coach Bogie 2 -->`
      + `<rect x="126" y="26.8" width="18" height="1.6" rx="0.4" fill="#1e293b"/>`
      + `<circle cx="130" cy="28.8" r="2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="130" cy="28.8" r="0.6" fill="#94a3b8"/>`
      + `<circle cx="140" cy="28.8" r="2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="140" cy="28.8" r="0.6" fill="#94a3b8"/>`
      + `<!-- Outlines -->`
      + `<path d="M2.5,24.5 L6,18 L16,7.5 L26,5 L69,5 L69,26.5 L4,26.5 Z" fill="none" stroke="#1e293b" stroke-width="1"/>`
      + `<line x1="148.5" y1="4.5" x2="148.5" y2="26.5" stroke="#1e293b" stroke-width="1.1"/>`
      + `</svg>`;
  }

  /**
   * Generates a complete 150x32 SVG of DF4D / DF11G Classic Green Diesel Locomotive coupled to a 25G Coach.
   */
  function convGreenSvg(w, h) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 150 32">`
      + `<!-- Cowcatcher Red & Coupler -->`
      + `<rect x="0.5" y="24" width="2.5" height="1.8" fill="#1e293b"/>`
      + `<path d="M2.5,27 L9,27 L7.5,24.5 L3.5,24.5 Z" fill="#b91c1c"/>`
      + `<!-- Locomotive Green Body (#15803d) -->`
      + `<path d="M3.5,24.5 L5.5,16 L11,7.5 L22,5 L69,5 L69,26.5 L5.5,26.5 Z" fill="#15803d"/>`
      + `<!-- Bold Yellow Waist Stripe (#facc15) -->`
      + `<rect x="12" y="18.5" width="57" height="2" fill="#facc15"/>`
      + `<!-- Cab Visor & Windshield -->`
      + `<rect x="11" y="5" width="12" height="1.2" fill="#14532d"/>`
      + `<rect x="11.5" y="6.6" width="4.5" height="4" rx="0.4" fill="#0f172a" stroke="#14532d" stroke-width="0.4"/>`
      + `<rect x="16.8" y="6.6" width="4.5" height="4" rx="0.4" fill="#0f172a" stroke="#14532d" stroke-width="0.4"/>`
      + `<rect x="23.5" y="7" width="5.5" height="4" rx="0.4" fill="#1e293b"/>`
      + `<!-- Circular Side Diesel Inspection Port -->`
      + `<circle cx="36" cy="11.5" r="2.2" fill="#14532d" stroke="#facc15" stroke-width="0.6"/>`
      + `<rect x="42" y="9" width="12" height="4.5" rx="0.4" fill="#14532d"/>`
      + `<!-- Roof Exhaust Stack -->`
      + `<rect x="33" y="3.6" width="7" height="1.6" rx="0.3" fill="#334155"/>`
      + `<!-- Headlight -->`
      + `<circle cx="4.8" cy="17.5" r="1.1" fill="#fef08a"/>`
      + `<!-- Heavy 3-Axle Diesel Bogies -->`
      + `<rect x="9" y="26.5" width="25" height="1.8" rx="0.4" fill="#1e293b"/>`
      + `<circle cx="13" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="13" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<circle cx="21.5" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="21.5" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<circle cx="30" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="30" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<rect x="42" y="26.5" width="25" height="1.8" rx="0.4" fill="#1e293b"/>`
      + `<circle cx="46" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="46" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<circle cx="54.5" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="54.5" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<circle cx="63" cy="28.8" r="2.2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="63" cy="28.8" r="0.7" fill="#94a3b8"/>`
      + `<!-- Coupler & Gangway -->`
      + `<rect x="69" y="24.2" width="4" height="2.2" fill="#0f172a"/>`
      + `<rect x="69.5" y="9.5" width="2.5" height="14.5" fill="#334155"/>`
      + `<!-- 25G Classic Dark Green Coach (#1d5a3a) -->`
      + `<path d="M72,7.5 C72.5,5.2 74.5,4.5 77.5,4.5 L148.5,4.5 L148.5,26.5 L72,26.5 Z" fill="#1d5a3a"/>`
      + `<rect x="72" y="6.8" width="76.5" height="0.9" fill="#facc15"/>`
      + `<rect x="72" y="16.5" width="76.5" height="1.8" fill="#facc15"/>`
      + `<!-- Windows -->`
      + `<rect x="76" y="9.5" width="6.5" height="5.2" rx="0.5" fill="#0f172a"/>`
      + `<rect x="87" y="9.5" width="8.5" height="5.2" rx="0.5" fill="#0f172a"/>`
      + `<rect x="99" y="9.5" width="8.5" height="5.2" rx="0.5" fill="#0f172a"/>`
      + `<rect x="111" y="9.5" width="8.5" height="5.2" rx="0.5" fill="#0f172a"/>`
      + `<rect x="123" y="9.5" width="8.5" height="5.2" rx="0.5" fill="#0f172a"/>`
      + `<rect x="135" y="9.5" width="8.5" height="5.2" rx="0.5" fill="#0f172a"/>`
      + `<rect x="145" y="9.5" width="3" height="5.2" rx="0.4" fill="#0f172a"/>`
      + `<rect x="72" y="24" width="76.5" height="2.5" fill="#14532d"/>`
      + `<rect x="80" y="26.8" width="18" height="1.6" rx="0.4" fill="#1e293b"/>`
      + `<circle cx="84" cy="28.8" r="2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="84" cy="28.8" r="0.6" fill="#94a3b8"/>`
      + `<circle cx="94" cy="28.8" r="2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="94" cy="28.8" r="0.6" fill="#94a3b8"/>`
      + `<rect x="126" y="26.8" width="18" height="1.6" rx="0.4" fill="#1e293b"/>`
      + `<circle cx="130" cy="28.8" r="2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="130" cy="28.8" r="0.6" fill="#94a3b8"/>`
      + `<circle cx="140" cy="28.8" r="2" fill="#334155" stroke="#0f172a" stroke-width="0.5"/><circle cx="140" cy="28.8" r="0.6" fill="#94a3b8"/>`
      + `<line x1="148.5" y1="4.5" x2="148.5" y2="26.5" stroke="#1e293b" stroke-width="1.1"/>`
      + `<circle cx="147.2" cy="22" r="0.8" fill="#ef4444"/>`
      + `<path d="M3.5,24.5 L5.5,16 L11,7.5 L22,5 L69,5 L69,26.5 L5.5,26.5 Z" fill="none" stroke="#1e293b" stroke-width="1"/>`
      + `</svg>`;
  }

  /**
   * Renders full-size side profile SVG (140x32 for EMU, 150x32 for conventional train).
   * @param {Object|string} tr - Train object or train model/code string
   * @param {number} [height=34] - Render height in pixels
   * @returns {string} SVG HTML string
   */
  function fullTrainSideSvg(tr, height = 34) {
    let m = '';
    let code = '';
    if (typeof tr === 'string') {
      m = tr.trim();
      code = tr.trim();
    } else if (tr && typeof tr === 'object') {
      m = (tr.m || tr.ts || tr.model || '').trim();
      code = (tr.c || tr.code || tr.train_no || '').split('/')[0].trim().toUpperCase();
    }

    const isConv = /^[ZTKYS0-9]/i.test(code)
      || /^(HXD|DF|SS|NDJ3|25T|25G|25K|YZ25)/i.test(m);

    // 1. Try EMU SVG if not explicitly conventional
    const emuFn = (typeof global.emuSvg === 'function')
      ? global.emuSvg
      : (typeof window !== 'undefined' && typeof window.emuSvg === 'function' ? window.emuSvg : null);

    if (!isConv && emuFn) {
      let resolvedKey = null;
      if (typeof global.resolveEmuModel === 'function') {
        resolvedKey = global.resolveEmuModel(m);
      } else if (typeof window !== 'undefined' && typeof window.resolveEmuModel === 'function') {
        resolvedKey = window.resolveEmuModel(m);
      }
      if (resolvedKey && !/^(HXD|DF|SS|YZ25)/.test(resolvedKey)) {
        const svg = emuFn(resolvedKey, height / 32, false);
        if (svg) return svg;
      }
      // If code starts with G, C, D, try fallback EMU models
      if (/^[GCD]/i.test(code)) {
        const fallbackM = code.startsWith('G') ? 'CR400AF' : code.startsWith('C') ? 'CRH6A' : 'CRH2A';
        const svg = emuFn(fallbackM, height / 32, false);
        if (svg) return svg;
      }
    }

    // 2. Conventional Train Rendering (150x32 aspect ratio)
    const scale = height / 32;
    const w = Math.round(150 * scale);
    const h = Math.round(height);

    // S2 line / NDJ3
    if (/^S2/i.test(code) || /NDJ3/i.test(m)) {
      return convNdj3Svg(w, h);
    }

    // T train / HXD3D / SS9 / SS8
    if (/^T/i.test(code) || /^(HXD3D|SS9|SS8|HXD3C|HXD3)/i.test(m)) {
      return convHxd3dSvg(w, h);
    }

    // Z train / HXD1D
    if (/^Z/i.test(code) || /^HXD1D/i.test(m) || /^HXD1/i.test(m)) {
      return convHxd1dSvg(w, h);
    }

    // Default / K train / DF4D / DF11G
    return convGreenSvg(w, h);
  }

  // =========================================================================
  // 2. Rolling Stock Descriptive Badge Text
  // =========================================================================

  function getModelBadgeText(tr) {
    if (!tr) return 'HXD3C + 25G · 普速旅客列车';
    const m = (typeof tr === 'string' ? tr : (tr.m || tr.ts || tr.model || '')).trim().toUpperCase();
    const code = (typeof tr === 'string' ? tr : (tr.c || tr.code || '')).split('/')[0].trim().toUpperCase();

    if (m.includes('CR400AF-Z') || m.includes('CR400AF-AZ')) return 'CR400AF-Z · 复兴号智能动车组';
    if (m.includes('CR400BF-Z') || m.includes('CR400BF-GZ') || m.includes('CR400BF-AZ')) return 'CR400BF-Z · 复兴号智能动车组';
    if (m.includes('CR400AF-C')) return 'CR400AF-C · 复兴号京雄智能动车组';
    if (m.includes('CR400BF-C')) return 'CR400BF-C · 复兴号京张智能动车组';
    if (m.includes('CR400AF')) return 'CR400AF · 复兴号高速动车组';
    if (m.includes('CR400BF')) return 'CR400BF · 复兴号金凤凰高速动车组';
    if (m.includes('CR300AF')) return 'CR300AF · 复兴号蓝暖男动车组';
    if (m.includes('CR300BF')) return 'CR300BF · 复兴号海空蓝动车组';
    if (m.includes('CRH380A')) return 'CRH380A · 和谐号高速动车组';
    if (m.includes('CRH380B')) return 'CRH380B · 和谐号高速动车组';
    if (m.includes('CRH6A')) return 'CRH6A · 广珠/京津城际动车组';
    if (m.includes('CRH6F')) return 'CRH6F · 市域动车组';
    if (m.includes('CR200J')) return 'CR200J · 复兴号动力集中动车组 (绿巨人)';
    if (/^S2/i.test(code) || m.includes('NDJ3')) return 'NDJ3 · 和谐长城号内燃动车组';
    if (/^Z/i.test(code) || m.includes('HXD1D')) return 'HXD1D + 25T · 准高速交流电力机车';
    if (/^T/i.test(code) || m.includes('HXD3D')) return 'HXD3D + 25T · 交流客运电力机车';
    if (m.includes('DF11G')) return 'DF11G + 25T · 跨局客运内燃机车 (大猪头)';
    if (/^K/i.test(code) || m.includes('DF4D')) return 'DF4D + 25G · 经典客运内燃机车';
    if (m.includes('HXD3C')) return 'HXD3C + 25G · 客货通用电力机车';
    if (code.startsWith('G')) return 'CR400AF · 复兴号高速动车组';
    if (code.startsWith('C')) return 'CRH6A · 城际动车组';
    if (code.startsWith('D')) return 'CRH2A · 动车组列车';
    return 'HXD3D + 25T · 普速旅客列车';
  }

  function formatTime(t) {
    if (t == null || isNaN(t)) return '--:--';
    const mins = (Math.floor(t) % 1440 + 1440) % 1440;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // =========================================================================
  // 3. Spotlight Train Selector & Pinning State Machine
  // =========================================================================

  let _pinnedTrain = null;
  let _currentSpotlight = null; // { tr, st, reason, lastPickMs, isIconic }
  let _lastEvaluatedT = -1;

  const ICONIC_CODES = new Set(['G1', 'G2', 'C2001', 'C2002', 'G301', 'G302', 'S101', 'S201', 'Z16', 'Z15', 'D1', 'T109']);

  /**
   * Evaluates a short narrative tag for a train based on its code, line traversal, and speed.
   */
  function computeReason(tr, st) {
    if (!tr) return '枢纽当班列车';
    const code = (tr.c || '').split('/')[0].trim().toUpperCase();
    const stops = tr.s || [];
    const stopNames = stops.map(s => s[0]);
    const speed = (st && st.kmh) ? Math.round(st.kmh) : 0;

    // 1. S2 line / Suburban
    if (code.startsWith('S2') || (tr.m && tr.m.includes('NDJ3'))) {
      return 'S2线长城号';
    }

    // 2. Beijing Underground Diameter Line (has both 北京 and 北京西)
    if (stopNames.includes('北京') && stopNames.includes('北京西')) {
      return '北京地下直径线穿城';
    }

    // 3. Iconic G1 / G2 / High-speed benchmark
    if (code === 'G1' || code === 'G2') {
      return '京沪350标杆';
    }
    if (code.startsWith('G') && speed >= 290) {
      return '京沪350标杆';
    }

    // 4. Beijing-Guangzhou High-speed outbound
    if (code === 'G301' || code === 'G67' || code === 'G79') {
      return '京广高速出京';
    }
    const dest = stopNames[stopNames.length - 1] || '';
    if (code.startsWith('G') && /广州|武汉|长沙|石家庄|深圳|香港/.test(dest)) {
      return '京广高速出京';
    }

    // 5. Intercity Beijing-Tianjin
    if (code.startsWith('C')) {
      if (code === 'C2001' || code === 'C2002') return '京津城际首发';
      return '京津城际公交化';
    }

    // 6. Direct Express Z / T
    if (code === 'Z16' || code === 'Z15') {
      return '进京直达特快';
    }
    if (code.startsWith('Z')) {
      return '进京直达特快';
    }
    if (code.startsWith('T')) {
      return '经典特快列车';
    }

    // 7. S1 line
    if (code.startsWith('S1') || code.startsWith('S')) {
      return '市域通勤看点';
    }

    // 8. Cross-line EMU
    if (stops.length >= 2 && !/北京|天津|上海/.test(stops[0][0]) && !/北京|天津|上海/.test(dest)) {
      return '枢纽跨线动车';
    }

    // 9. High-speed general
    if (code.startsWith('G')) {
      return '高速列车飞驰';
    }
    if (code.startsWith('D')) {
      return '动车组列车';
    }
    return '枢纽当班列车';
  }

  /**
   * Tests if a coordinate [lat, lon] is within the hub bbox (with margin).
   */
  function isInsideBbox(pos, bbox) {
    if (!pos || !Array.isArray(pos) || pos.length < 2) return false;
    const bb = bbox || (global.HUB && global.HUB.bbox) || [115.4, 38.6, 118.2, 40.8];
    const lat = pos[0], lon = pos[1];
    return lon >= (bb[0] - 0.05) && lon <= (bb[2] + 0.05)
      && lat >= (bb[1] - 0.05) && lat <= (bb[3] + 0.05);
  }

  /**
   * Returns current spotlight train, rotating every 8s unless pinned or holding iconic train.
   * @param {number} T - Current time in minutes
   * @param {number} nowMs - Performance/wall clock timestamp
   * @param {Function} [stateFn] - Function(tr, T) returning train kinematics state
   * @returns {{ tr: Object, st: Object, reason: string, pinned: boolean }|null}
   */
  function getCurrentSpotlight(T, nowMs = Date.now(), stateFn) {
    const fn = stateFn || global.state || (typeof window !== 'undefined' ? window.state : null);
    if (!fn) return null;

    const hub = global.HUB || (typeof window !== 'undefined' ? window.HUB : null);
    const bbox = hub ? hub.bbox : null;

    // 1. Pinned train manually selected by user
    if (_pinnedTrain) {
      const st = fn(_pinnedTrain, T);
      if (st) {
        return {
          tr: _pinnedTrain,
          st,
          reason: computeReason(_pinnedTrain, st),
          pinned: true
        };
      }
      // If trip ended, auto-unpin
      _pinnedTrain = null;
    }

    // 2. Check if current spotlight can be retained
    if (_currentSpotlight && _currentSpotlight.tr) {
      const st = fn(_currentSpotlight.tr, T);
      const stillActive = st && isInsideBbox(st.pos, bbox);

      if (stillActive) {
        const timeSincePick = nowMs - _currentSpotlight.lastPickMs;

        // Iconic trains departing or traversing key junctions get extended hold (up to 24s)
        if (_currentSpotlight.isIconic) {
          const isDeparting = st.kmh < 60 || !st.moving;
          const isJunction = _currentSpotlight.reason === '北京地下直径线穿城';
          if ((isDeparting || isJunction) && timeSincePick < 24000) {
            _currentSpotlight.st = st;
            return _currentSpotlight;
          }
        }

        // Standard 8-second rotation cycle
        if (timeSincePick < 8000) {
          _currentSpotlight.st = st;
          return _currentSpotlight;
        }
      }
    }

    // 3. Search and score candidate trains inside hub bbox
    const data = global.D || (typeof window !== 'undefined' ? window.D : null);
    const trains = (data && data.trains) || global.G || [];
    if (!trains || trains.length === 0) return null;

    let bestTr = null;
    let bestSt = null;
    let bestScore = -999999;
    let bestIsIconic = false;

    const prevCode = _currentSpotlight && _currentSpotlight.tr ? _currentSpotlight.tr.c : '';

    for (let i = 0; i < trains.length; i++) {
      const tr = trains[i];
      const st = fn(tr, T);
      if (!st || !isInsideBbox(st.pos, bbox)) continue;

      const code = (tr.c || '').split('/')[0].trim().toUpperCase();
      let score = 0;

      // Iconic train bonus
      const isIconic = ICONIC_CODES.has(code);
      if (isIconic) {
        score += 150;
      }

      // Beijing underground diameter line traversal
      const stops = tr.s || [];
      const sNames = stops.map(s => s[0]);
      if (sNames.includes('北京') && sNames.includes('北京西')) {
        score += 90;
      }

      // Speed bonuses
      const speed = st.kmh || 0;
      if (speed >= 300) score += 60;
      else if (speed >= 250) score += 40;
      else if (speed >= 160) score += 20;

      // Moving trains preferred
      if (st.moving) score += 30;

      // Outbound departure within 3 minutes
      if (!st.moving && stops[0] && stops[0][2] != null && Math.abs(T - stops[0][2]) < 3.5) {
        score += 50;
      }

      // Penalty for repeating the exact previous train
      if (code === prevCode) {
        score -= 80;
      }

      // Pseudo-random jitter to ensure variety every cycle
      const hashVal = ((code.charCodeAt(0) || 0) * 17 + (code.charCodeAt(code.length - 1) || 0) * 31) % 50;
      score += hashVal;

      if (score > bestScore) {
        bestScore = score;
        bestTr = tr;
        bestSt = st;
        bestIsIconic = isIconic;
      }
    }

    if (!bestTr) return null;

    const reason = computeReason(bestTr, bestSt);
    _currentSpotlight = {
      tr: bestTr,
      st: bestSt,
      reason,
      lastPickMs: nowMs,
      isIconic: bestIsIconic,
      pinned: false
    };

    return _currentSpotlight;
  }

  function pinTrain(tr) {
    _pinnedTrain = tr || null;
    if (_pinnedTrain) {
      _currentSpotlight = null;
    }
  }

  function unpinTrain() {
    _pinnedTrain = null;
  }

  function isPinned() {
    return !!_pinnedTrain;
  }

  // =========================================================================
  // 4. Spotlight Card UI Component
  // =========================================================================

  const SPOTLIGHT_CSS = `
    .sp-card {
      width: 100%;
      height: 135px;
      box-sizing: border-box;
      padding: 7px 10px 6px 10px;
      background: rgba(15, 23, 42, 0.90);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 6px;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.28);
      user-select: none;
    }
    .sp-top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 22px;
      line-height: 22px;
    }
    .sp-top-left {
      display: flex;
      align-items: center;
      gap: 7px;
      overflow: hidden;
      white-space: nowrap;
    }
    .sp-tag-pill {
      background: rgba(234, 179, 8, 0.16);
      border: 1px solid rgba(250, 204, 21, 0.45);
      color: #facc15;
      font-size: 10px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 10px;
      letter-spacing: 0.2px;
      flex-shrink: 0;
    }
    .sp-tag-pill.pinned {
      background: rgba(236, 72, 153, 0.18);
      border-color: rgba(236, 72, 153, 0.55);
      color: #f472b6;
    }
    .sp-train-code {
      font-family: "JetBrains Mono", Menlo, Consolas, monospace;
      font-size: 15px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: 0.5px;
    }
    .sp-od-route {
      font-size: 11px;
      color: #94a3b8;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sp-od-route b {
      color: #cbd5e1;
      font-weight: 600;
    }
    .sp-arr {
      color: #64748b;
      margin: 0 2px;
    }
    .sp-speed-tag {
      display: flex;
      align-items: center;
      gap: 4px;
      font-family: "JetBrains Mono", Menlo, monospace;
      font-size: 11.5px;
      font-weight: 700;
      padding: 1px 7px;
      border-radius: 5px;
      flex-shrink: 0;
    }
    .sp-speed-tag.moving {
      background: rgba(56, 189, 248, 0.14);
      border: 1px solid rgba(56, 189, 248, 0.35);
      color: #38bdf8;
    }
    .sp-speed-tag.stopped {
      background: rgba(251, 146, 60, 0.14);
      border: 1px solid rgba(251, 146, 60, 0.35);
      color: #fb923c;
    }
    .sp-pulse-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #38bdf8;
      box-shadow: 0 0 6px #38bdf8;
    }
    .sp-stop-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #fb923c;
    }
    .sp-showcase {
      position: relative;
      height: 58px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      margin: 1px 0;
    }
    .sp-track-bg {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
    .sp-train-svg-wrap {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: -2px;
      filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.45));
    }
    .sp-model-badge {
      position: absolute;
      right: 6px;
      bottom: 2px;
      z-index: 3;
      font-size: 9.5px;
      font-weight: 600;
      color: #94a3b8;
      background: rgba(15, 23, 42, 0.85);
      padding: 1px 6px;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      white-space: nowrap;
    }
    .sp-timeline {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 22px;
      font-size: 10.5px;
      color: #94a3b8;
    }
    .sp-node {
      display: flex;
      align-items: baseline;
      gap: 3px;
      white-space: nowrap;
    }
    .sp-node b {
      color: #e2e8f0;
      font-weight: 600;
    }
    .sp-node small {
      color: #64748b;
      font-size: 9px;
      font-family: monospace;
    }
    .sp-node.active b {
      color: #38bdf8;
    }
    .sp-progress-bar-wrap {
      flex: 1;
      height: 3px;
      background: rgba(255, 255, 255, 0.10);
      border-radius: 2px;
      margin: 0 8px;
      position: relative;
    }
    .sp-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #2563eb, #38bdf8);
      border-radius: 2px;
      position: absolute;
      left: 0;
      top: 0;
    }
    .sp-progress-thumb {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #facc15;
      box-shadow: 0 0 6px #facc15;
      position: absolute;
      top: -2px;
      transform: translateX(-50%);
    }
    .sp-empty-text {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #64748b;
      font-size: 12px;
    }
  `;

  function ensureStyles() {
    if (typeof document === 'undefined') return;
    if (!document.getElementById('hub-spotlight-css')) {
      const st = document.createElement('style');
      st.id = 'hub-spotlight-css';
      st.textContent = SPOTLIGHT_CSS;
      document.head.appendChild(st);
    }
  }

  /**
   * Updates Spotlight Feature Card UI into container element.
   * @param {HTMLElement|string} containerEl - Container element or ID
   * @param {number} T - Current simulation time in minutes
   * @param {number} nowMs - Performance/wall clock ms
   * @param {Function} [stateFn] - Function(tr, T) returning train kinematics
   * @param {Object} [theme] - Theme object
   */
  function updateCard(containerEl, T, nowMs = Date.now(), stateFn, theme) {
    if (typeof document === 'undefined') return;
    ensureStyles();

    const el = typeof containerEl === 'string' ? document.getElementById(containerEl) : containerEl;
    if (!el) return;

    const spotlight = getCurrentSpotlight(T, nowMs, stateFn);
    if (!spotlight || !spotlight.tr) {
      el.innerHTML = `
        <div class="sp-card">
          <div class="sp-empty-text">★ 枢纽调度监视中 · 等待列车进场</div>
        </div>
      `;
      return;
    }

    const { tr, st, reason, pinned } = spotlight;
    const stops = tr.s || [];
    const nStops = stops.length;
    const origName = stops[0] ? stops[0][0] : '始发';
    const destName = stops[nStops - 1] ? stops[nStops - 1][0] : '终到';
    const code = (tr.c || '').split('/')[0].trim();

    // Speed status
    const speed = (st && st.kmh) ? Math.round(st.kmh) : 0;
    let speedHtml = '';
    if (st && st.moving && speed > 0) {
      speedHtml = `<span class="sp-speed-tag moving"><span class="sp-pulse-dot"></span>${speed} km/h</span>`;
    } else {
      const curStopName = (st && stops[st.i]) ? stops[st.i][0] : (stops[0] ? stops[0][0] : '站内');
      speedHtml = `<span class="sp-speed-tag stopped"><span class="sp-stop-dot"></span>停靠 ${curStopName}</span>`;
    }

    // Timeline calculations
    const startT = stops[0] ? (stops[0][2] ?? stops[0][1] ?? 0) : 0;
    const endT = stops[nStops - 1] ? (stops[nStops - 1][1] ?? stops[nStops - 1][2] ?? 1440) : 1440;
    const span = Math.max(1, endT - startT);
    const progressPct = Math.max(0, Math.min(100, Math.round(((T - startT) / span) * 100)));

    let prevIdx = 0, nextIdx = nStops - 1;
    if (st) {
      if (st.moving) {
        prevIdx = Math.max(0, st.li != null ? st.li : 0);
        nextIdx = Math.min(nStops - 1, prevIdx + 1);
      } else {
        prevIdx = Math.max(0, (st.i != null ? st.i : 0) - 1);
        nextIdx = Math.min(nStops - 1, (st.i != null ? st.i : 0) + 1);
      }
    }
    const prevSt = stops[prevIdx] || stops[0];
    const nextSt = stops[nextIdx] || stops[nStops - 1];
    const prevTime = formatTime(prevSt ? (prevSt[2] ?? prevSt[1]) : startT);
    const nextTime = formatTime(nextSt ? (nextSt[1] ?? nextSt[2]) : endT);

    const modelBadge = getModelBadgeText(tr);
    const trainSvg = fullTrainSideSvg(tr, 36);

    const tagClass = pinned ? 'sp-tag-pill pinned' : 'sp-tag-pill';
    const tagText = pinned ? `★ 锁定追踪 · ${code}` : `★ 当班看点 · ${reason}`;

    el.innerHTML = `
      <div class="sp-card">
        <!-- 1. Top Bar -->
        <div class="sp-top-bar">
          <div class="sp-top-left">
            <span class="${tagClass}" title="${pinned ? '点击地图其它位置可解除锁定' : '自动聚焦精彩车次'}">${tagText}</span>
            <span class="sp-train-code">${code}</span>
            <span class="sp-od-route"><b>${origName}</b><span class="sp-arr">→</span><b>${destName}</b></span>
          </div>
          ${speedHtml}
        </div>

        <!-- 2. Center Showcase: Track Bed + Catenary Wire + Full Train Profile -->
        <div class="sp-showcase">
          <svg class="sp-track-bg" viewBox="0 0 420 58" preserveAspectRatio="none">
            <!-- Overhead Contact System (接触网) -->
            <path d="M0,8 Q210,14 420,8" fill="none" stroke="rgba(100,116,139,0.4)" stroke-width="0.8"/>
            <line x1="0" y1="12" x2="420" y2="12" stroke="rgba(148,163,184,0.55)" stroke-width="0.9"/>
            <line x1="40" y1="9" x2="40" y2="12" stroke="rgba(100,116,139,0.4)" stroke-width="0.6"/>
            <line x1="110" y1="11" x2="110" y2="12" stroke="rgba(100,116,139,0.4)" stroke-width="0.6"/>
            <line x1="180" y1="13.5" x2="180" y2="12" stroke="rgba(100,116,139,0.4)" stroke-width="0.6"/>
            <line x1="250" y1="13.5" x2="250" y2="12" stroke="rgba(100,116,139,0.4)" stroke-width="0.6"/>
            <line x1="320" y1="11" x2="320" y2="12" stroke="rgba(100,116,139,0.4)" stroke-width="0.6"/>
            <line x1="390" y1="9" x2="390" y2="12" stroke="rgba(100,116,139,0.4)" stroke-width="0.6"/>
            <!-- Catenary Pole Mast Bracket at right -->
            <line x1="406" y1="2" x2="406" y2="48" stroke="#475569" stroke-width="2.2"/>
            <line x1="406" y1="7" x2="385" y2="12" stroke="#64748b" stroke-width="1.2"/>
            <!-- Ballast Slab Track Bed (无砟道床) -->
            <rect x="0" y="46" width="420" height="12" fill="rgba(30,41,59,0.7)"/>
            <!-- Track Ties (轨枕) -->
            ${Array.from({ length: 30 }).map((_, i) => `<rect x="${i * 14 + 4}" y="47" width="7" height="3" fill="#334155" opacity="0.6"/>`).join('')}
            <!-- Steel Rails (双钢轨) -->
            <line x1="0" y1="46" x2="420" y2="46" stroke="#94a3b8" stroke-width="1.2"/>
            <line x1="0" y1="48" x2="420" y2="48" stroke="#cbd5e1" stroke-width="0.8"/>
          </svg>
          <div class="sp-train-svg-wrap">
            ${trainSvg}
          </div>
          <span class="sp-model-badge">${modelBadge}</span>
        </div>

        <!-- 3. Bottom Mini Stop-Timeline -->
        <div class="sp-timeline">
          <span class="sp-node">
            <b>${prevSt ? prevSt[0] : origName}</b>
            <small>${prevTime}</small>
          </span>
          <div class="sp-progress-bar-wrap">
            <div class="sp-progress-fill" style="width: ${progressPct}%"></div>
            <div class="sp-progress-thumb" style="left: ${progressPct}%"></div>
          </div>
          <span class="sp-node ${st && st.moving ? 'active' : ''}">
            <b>${nextSt ? nextSt[0] : destName}</b>
            <small>${nextTime}</small>
          </span>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // 5. Upgraded Corridor Time-Space Diagram (运行图, 50min Window [T-12, T+38])
  // =========================================================================

  let _diagramHubId = null;
  let _diagramStations = []; // [{ name, km }, ...]
  let _diagramTrains = [];   // [{ tr, points: [{t, km, st, type}], minT, maxT }, ...]

  /** Haversine formula for distance in km */
  function haversineDist(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
      + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
      * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * Initializes or rebuilds corridor section stations and trajectories.
   */
  function initCorridorSection(hubConfig, STBY, D) {
    const hub = hubConfig || global.HUB || (typeof window !== 'undefined' ? window.HUB : null);
    const data = D || global.D || (typeof window !== 'undefined' ? window.D : null);
    const stby = STBY || global.STBY || (typeof window !== 'undefined' ? window.STBY : {});

    const sec = (hub && hub.diagramSection) || {
      title: '京津城际·京沪走廊断面',
      stations: ['北京南', '亦庄', '廊坊', '武清', '天津西', '天津', '天津南', '滨海']
    };

    const stList = Array.isArray(sec.stations) ? sec.stations.slice() : [];
    if (stList.length < 2) return;

    let kmList = [];
    if (Array.isArray(sec.km) && sec.km.length === stList.length) {
      kmList = sec.km.slice();
    } else {
      // Known standard railway km fallback for Beijing-Tianjin corridor
      const bjTjKm = {
        '北京南': 0, '亦庄': 21, '廊坊': 60, '武清': 98,
        '天津西': 118, '天津': 120, '天津南': 131, '滨海': 165
      };
      const shKm = {
        '昆山南': 0, '安亭北': 22, '上海虹桥': 50,
        '上海松江': 78, '金山北': 105, '嘉善南': 122
      };

      kmList = [0];
      let cum = 0;
      for (let i = 1; i < stList.length; i++) {
        const s0 = stList[i - 1], s1 = stList[i];
        if (bjTjKm[s0] != null && bjTjKm[s1] != null && bjTjKm[s1] >= bjTjKm[s0]) {
          cum = bjTjKm[s1];
        } else if (shKm[s0] != null && shKm[s1] != null && shKm[s1] >= shKm[s0]) {
          cum = shKm[s1];
        } else {
          const p0 = stby[s0], p1 = stby[s1];
          if (p0 && p1 && p0.lat && p1.lat) {
            cum += Math.round(haversineDist(p0.lat, p0.lon, p1.lat, p1.lon));
          } else {
            cum += 22;
          }
        }
        kmList.push(cum);
      }
    }

    _diagramStations = stList.map((name, i) => ({ name, km: kmList[i] }));
    const stMap = new Map();
    _diagramStations.forEach(s => stMap.set(s.name, s.km));

    // Precompute train trajectories traversing the corridor
    const trains = (data && data.trains) || [];
    const secTrains = [];

    for (let tIdx = 0; tIdx < trains.length; tIdx++) {
      const tr = trains[tIdx];
      const stops = tr.s || [];
      const pts = [];

      // 1. Stops matching corridor stations
      for (let i = 0; i < stops.length; i++) {
        const [stName, arrT, depT] = stops[i];
        if (stMap.has(stName)) {
          const km = stMap.get(stName);
          const a = (arrT != null) ? arrT : depT;
          const d = (depT != null) ? depT : arrT;
          if (a != null) pts.push({ t: a, km, st: stName, type: 'stop' });
          if (d != null && d !== a) pts.push({ t: d, km, st: stName, type: 'dep' });
        }
      }

      // 2. Pass-through calibration points from leg[5]
      const legs = tr.l || [];
      for (let li = 0; li < legs.length; li++) {
        const leg = legs[li];
        if (leg && leg.length > 5 && Array.isArray(leg[5])) {
          const ws = leg[5];
          for (let wi = 0; wi < ws.length; wi++) {
            const w = ws[wi];
            const wName = w[3];
            if (wName && stMap.has(wName)) {
              const km = stMap.get(wName);
              const wa = (w[1] != null) ? w[1] : w[2];
              const wd = (w[2] != null) ? w[2] : w[1];
              if (wa != null) pts.push({ t: wa, km, st: wName, type: 'pass' });
              if (wd != null && wd !== wa) pts.push({ t: wd, km, st: wName, type: 'pass_dep' });
            }
          }
        }
      }

      // 3. Interpolation for direct Jinghu trains starting/ending at Beijing South
      if (stops.length >= 2 && stMap.has('北京南') && stMap.has('天津南')) {
        const kmTianjinNan = stMap.get('天津南');
        const leg0 = legs[0];
        if (stops[0][0] === '北京南' && leg0 && leg0[3] > 140) {
          if (!pts.some(p => p.st === '天津南')) {
            const tPass = leg0[1] + (kmTianjinNan / leg0[3]) * (leg0[2] - leg0[1]);
            pts.push({ t: tPass, km: kmTianjinNan, st: '天津南', type: 'interpolated' });
          }
        }
        const legLast = legs[legs.length - 1];
        if (stops[stops.length - 1][0] === '北京南' && legLast && legLast[3] > 140) {
          if (!pts.some(p => p.st === '天津南')) {
            const tPass = legLast[2] - (kmTianjinNan / legLast[3]) * (legLast[2] - legLast[1]);
            pts.push({ t: tPass, km: kmTianjinNan, st: '天津南', type: 'interpolated' });
          }
        }
      }

      // Sort points chronologically
      pts.sort((a, b) => a.t - b.t);

      if (pts.length >= 2) {
        const minT = pts[0].t;
        const maxT = pts[pts.length - 1].t;
        secTrains.push({ tr, points: pts, minT, maxT });
      }
    }

    _diagramTrains = secTrains;
    _diagramHubId = (hub && hub.id) || 'hub';
  }

  /**
   * Returns line color for train class.
   */
  function getDiagramLineColor(tr) {
    const code = (tr.c || '').split('/')[0].trim().toUpperCase();
    const c0 = code[0];
    if (c0 === 'G') return '#3b82f6'; // Blue
    if (c0 === 'C') return '#06b6d4'; // Cyan
    if (c0 === 'D') return '#14b8a6'; // Teal
    if (c0 === 'S') return '#f59e0b'; // Amber
    if (c0 === 'Z' || c0 === 'T') return '#ef4444'; // Red
    return '#10b981'; // Green
  }

  /**
   * Draws the upgraded Corridor Time-Space Diagram (运行图) onto canvasEl.
   * Rolling window: [T - 12, T + 38] minutes (50-minute span).
   * @param {HTMLCanvasElement|string} canvasEl - Target canvas or ID
   * @param {number} T - Current time in minutes from midnight
   * @param {Object} [spotlightTr] - Current spotlight train object to highlight
   * @param {Object} [theme] - Theme styling
   */
  function drawCorridorDiagram(canvasEl, T, spotlightTr, theme) {
    if (typeof document === 'undefined') return;
    const canvas = typeof canvasEl === 'string' ? document.getElementById(canvasEl) : canvasEl;
    if (!canvas) return;

    const hub = global.HUB || (typeof window !== 'undefined' ? window.HUB : null);
    if (!_diagramStations.length || (_diagramHubId && hub && _diagramHubId !== hub.id)) {
      initCorridorSection(hub, global.STBY, global.D);
    }

    const dpr = global.devicePixelRatio || 1;
    const w = canvas.clientWidth || canvas.width || 420;
    const h = canvas.clientHeight || canvas.height || 280;

    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }

    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);

    // Padding & Plot dimensions
    const padL = 52;
    const padR = 24;
    const padT = 24;
    const padB = 22;
    const plotW = Math.max(10, w - padL - padR);
    const plotH = Math.max(10, h - padT - padB);

    // Background fill
    ctx.fillStyle = '#0b1120';
    ctx.fillRect(0, 0, w, h);

    const stations = _diagramStations;
    if (!stations || stations.length < 2) {
      ctx.fillStyle = '#64748b';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('无走廊断面配置', w / 2, h / 2);
      ctx.restore();
      return;
    }

    // 50-minute rolling window [T - 12, T + 38]
    const t0 = T - 12;
    const t1 = T + 38;
    const kMin = stations[0].km;
    const kMax = stations[stations.length - 1].km;
    const kSpan = (kMax - kMin) || 1;

    const xForTime = tm => padL + ((tm - t0) / 50) * plotW;
    const yForKm = km => padT + ((km - kMin) / kSpan) * plotH;

    // Header Title
    const secTitle = (hub && hub.diagramSection && hub.diagramSection.title) || '京津城际·京沪走廊实时运行图';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 10.5px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(secTitle, padL, padT - 8);

    ctx.fillStyle = '#64748b';
    ctx.font = '9.5px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('50min 窗口 · [T-12, T+38]', padL + plotW, padT - 8);

    // 1. Past Time Shading [t0, T]
    const nowX = xForTime(T);
    if (nowX > padL) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.48)';
      ctx.fillRect(padL, padT, Math.min(plotW, nowX - padL), plotH);
    }

    // 2. Vertical Time Grid Lines (10-minute intervals, 5-minute ticks)
    const startM = Math.ceil(t0 / 5) * 5;
    for (let tm = startM; tm <= t1; tm += 5) {
      const gx = xForTime(tm);
      if (gx < padL || gx > padL + plotW) continue;
      const is10 = (tm % 10 === 0);

      ctx.strokeStyle = is10 ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gx, padT);
      ctx.lineTo(gx, padT + plotH);
      ctx.stroke();

      if (is10) {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(formatTime(tm), gx, padT + plotH + 13);
      }
    }

    // 3. Horizontal Station Grid Lines & Station Names
    for (let sIdx = 0; sIdx < stations.length; sIdx++) {
      const st = stations[sIdx];
      const gy = yForKm(st.km);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, gy);
      ctx.lineTo(padL + plotW, gy);
      ctx.stroke();

      // Station Name
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '10px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(st.name, padL - 6, gy);

      // Station Km
      ctx.fillStyle = '#475569';
      ctx.font = '8px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${Math.round(st.km)}k`, padL + plotW + 3, gy);
    }

    // 4. Train Trajectories
    const secTrains = _diagramTrains;
    let spotlightEntry = null;

    // First pass: regular trains
    for (let tIdx = 0; tIdx < secTrains.length; tIdx++) {
      const entry = secTrains[tIdx];
      if (entry.maxT < t0 - 2 || entry.minT > t1 + 2) continue;

      // Check if this train is the spotlight train
      if (spotlightTr && (entry.tr === spotlightTr || entry.tr.c === spotlightTr.c)) {
        spotlightEntry = entry;
        continue;
      }

      const pts = entry.points;
      const lineColor = getDiagramLineColor(entry.tr);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = /^[GC]/.test(entry.tr.c) ? 1.6 : 1.3;

      ctx.beginPath();
      let started = false;
      let labelP1 = null, labelP2 = null;

      for (let i = 0; i < pts.length; i++) {
        const px = xForTime(pts[i].t);
        const py = yForKm(pts[i].km);
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);
          if (!labelP1 && pts[i - 1].t < t1 && pts[i].t > t0 && Math.abs(pts[i].km - pts[i - 1].km) > 15) {
            labelP1 = pts[i - 1];
            labelP2 = pts[i];
          }
        }
      }
      ctx.stroke();

      // Train code label on regular lines
      if (labelP1 && labelP2) {
        const segMidT = Math.max(t0 + 2, Math.min(t1 - 2, (labelP1.t + labelP2.t) / 2));
        const segRatio = (segMidT - labelP1.t) / ((labelP2.t - labelP1.t) || 1);
        const segMidKm = labelP1.km + segRatio * (labelP2.km - labelP1.km);
        const lx = xForTime(segMidT);
        const ly = yForKm(segMidKm);

        const angle = Math.atan2(yForKm(labelP2.km) - yForKm(labelP1.km), xForTime(labelP2.t) - xForTime(labelP1.t));

        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(angle);
        ctx.fillStyle = '#090d16';
        ctx.fillRect(-12, -6, 24, 10);
        ctx.fillStyle = lineColor;
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(entry.tr.c.split('/')[0], 0, -1);
        ctx.restore();
      }
    }

    // Second pass: dramatic highlight for spotlight train
    if (spotlightEntry) {
      const pts = spotlightEntry.points;

      // 1. Outer halo glow
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.35)';
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const px = xForTime(pts[i].t);
        const py = yForKm(pts[i].km);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.stroke();

      // 2. Core golden line with shadow
      ctx.save();
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 8;
      ctx.lineWidth = 2.8;
      ctx.strokeStyle = '#facc15';
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const px = xForTime(pts[i].t);
        const py = yForKm(pts[i].km);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();

      // 3. Position marker at current time T
      if (spotlightEntry.minT <= T && spotlightEntry.maxT >= T) {
        let curKm = null;
        for (let i = 1; i < pts.length; i++) {
          if (pts[i - 1].t <= T && pts[i].t >= T) {
            const dt = (pts[i].t - pts[i - 1].t) || 1;
            const r = (T - pts[i - 1].t) / dt;
            curKm = pts[i - 1].km + r * (pts[i].km - pts[i - 1].km);
            break;
          }
        }
        if (curKm != null) {
          const sx = xForTime(T);
          const sy = yForKm(curKm);
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Highlight Train Code Tag
          ctx.save();
          ctx.fillStyle = '#facc15';
          ctx.fillRect(sx + 7, sy - 8, 38, 14);
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 9.5px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(spotlightEntry.tr.c.split('/')[0], sx + 26, sy - 1);
          ctx.restore();
        }
      }
    }

    // 5. "NOW" Vertical Cursor Indicator Line at T
    if (nowX >= padL && nowX <= padL + plotW) {
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 3]);
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 6;

      ctx.beginPath();
      ctx.moveTo(nowX, padT - 4);
      ctx.lineTo(nowX, padT + plotH + 4);
      ctx.stroke();
      ctx.restore();

      // "NOW" Pill Tag
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(nowX - 22, padT - 18, 44, 13);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8.5px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`NOW ${formatTime(T)}`, nowX, padT - 11.5);
    }

    ctx.restore();
  }

  // =========================================================================
  // 6. Map Highlight Target Reticle for Spotlight Train
  // =========================================================================

  /**
   * Resolves map pixel coordinates for a [lat, lon] pair.
   */
  function getMapPx(map, ll) {
    if (!map || !ll) return null;
    if (typeof global.toPx === 'function') {
      return global.toPx(map, ll);
    }
    if (typeof map.latLngToLayerPoint === 'function') {
      const lp = map.latLngToLayerPoint(ll);
      const tl = map.containerPointToLayerPoint ? map.containerPointToLayerPoint([0, 0]) : { x: 0, y: 0 };
      return { x: lp.x - tl.x, y: lp.y - tl.y };
    }
    return null;
  }

  /**
   * Draws a rotating and pulsing golden target reticle on the map canvas around spotlight train.
   * @param {CanvasRenderingContext2D} ctx - Main map canvas overlay context
   * @param {Object} map - Leaflet map instance
   * @param {Object} spotlightTr - Current spotlight train object
   * @param {Object} st - Kinematics state of spotlight train (st.pos)
   * @param {number} nowMs - Performance/wall clock ms
   * @param {Object} [theme] - Theme object
   */
  function drawMapHighlight(ctx, map, spotlightTr, st, nowMs = Date.now(), theme) {
    if (!ctx || !map || !spotlightTr || !st || !st.pos) return;
    const pt = getMapPx(map, st.pos);
    if (!pt) return;

    const s = map.getSize ? map.getSize() : { x: 2000, y: 2000 };
    if (pt.x < -40 || pt.y < -40 || pt.x > s.x + 40 || pt.y > s.y + 40) return;

    ctx.save();
    const tSec = nowMs / 1000;
    const pulse = (Math.sin(tSec * 4) + 1) * 0.5; // 0..1
    const rot = tSec * 1.5;

    // 1. Outer radar expanding wave
    const waveProgress = (tSec * 18) % 24;
    const rWave = 12 + waveProgress;
    const waveAlpha = Math.max(0, 1 - waveProgress / 24);
    ctx.strokeStyle = `rgba(250, 204, 21, ${waveAlpha * 0.6})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, rWave, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Inner glowing core ring
    const rCore = 14 + pulse * 2.5;
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, rCore, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 3. Rotating 4 HUD corner brackets
    ctx.save();
    ctx.translate(pt.x, pt.y);
    ctx.rotate(rot);
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.5;
    const rB = 18;
    const bLen = 5;
    for (let k = 0; k < 4; k++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(rB - bLen, -rB);
      ctx.lineTo(rB, -rB);
      ctx.lineTo(rB, -rB + bLen);
      ctx.stroke();
    }
    ctx.restore();

    // 4. Floating glassmorphic target name pill above train
    const code = (spotlightTr.c || '').split('/')[0].trim();
    const kmh = Math.round(st.kmh || 0);
    const pillTxt = `★ ${code} · ${kmh} km/h`;

    ctx.font = 'bold 10px "JetBrains Mono", Menlo, monospace';
    const txtW = ctx.measureText(pillTxt).width;
    const pillW = txtW + 14;
    const pillH = 18;
    const pillX = pt.x - pillW / 2;
    const pillY = pt.y - 28;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(pillX, pillY, pillW, pillH, 4);
    } else {
      ctx.rect(pillX, pillY, pillW, pillH);
    }
    ctx.fill();

    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = '#facc15';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pillTxt, pt.x, pillY + pillH / 2);

    ctx.restore();
  }

  // =========================================================================
  // 7. Map Click Auto-Wireup Helper
  // =========================================================================

  /**
   * Attaches click listener on map to select/pin closest train within 30px.
   */
  function attachMapClick(map, getTrainsFn, stateFn, getTFn) {
    if (!map || typeof map.on !== 'function') return;

    map.on('click', (e) => {
      const fn = stateFn || global.state || (typeof window !== 'undefined' ? window.state : null);
      if (!fn) return;

      const T = typeof getTFn === 'function' ? getTFn() : (global.T != null ? global.T : 360);
      const trains = typeof getTrainsFn === 'function' ? getTrainsFn() : ((global.D && global.D.trains) || []);
      const clickPt = e.containerPoint;
      if (!clickPt) return;

      let closestTr = null;
      let minDist = 30; // 30px click threshold

      for (let i = 0; i < trains.length; i++) {
        const tr = trains[i];
        const st = fn(tr, T);
        if (!st || !st.pos) continue;

        const pt = getMapPx(map, st.pos);
        if (!pt) continue;

        const dx = pt.x - clickPt.x;
        const dy = pt.y - clickPt.y;
        const d = Math.hypot(dx, dy);

        if (d < minDist) {
          minDist = d;
          closestTr = tr;
        }
      }

      if (closestTr) {
        pinTrain(closestTr);
      } else {
        // If clicked far away empty space, unpin
        unpinTrain();
      }

      if (typeof global.drawAll === 'function') {
        global.drawAll();
      }
    });
  }

  // =========================================================================
  // 8. Public Module Interface
  // =========================================================================

  const HubSpotlight = {
    // Component C: Train Feature Card & Spotlight Engine
    getCurrentSpotlight,
    pinTrain,
    unpinTrain,
    isPinned,
    updateCard,

    // Component D: Upgraded Corridor Time-Space Diagram
    init: initCorridorSection,
    drawCorridorDiagram,
    drawMapHighlight,
    attachMapClick,

    // Profile renderers
    fullTrainSideSvg,
    getModelBadgeText
  };

  // Export to global and window
  global.HubSpotlight = HubSpotlight;
  global.fullTrainSideSvg = fullTrainSideSvg;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      HubSpotlight,
      fullTrainSideSvg
    };
  }

})(typeof window !== 'undefined' ? window : globalThis);
