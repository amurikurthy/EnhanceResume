/* EnhanceResume renderer: document JSON -> HTML string.
 * The same code drives the live preview (browser), thumbnails and the PDF (server). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./templates'));
  else root.ERR = factory(root.ERT);
})(typeof self !== 'undefined' ? self : this, function (T) {
  'use strict';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function safeUrl(u) {
    u = String(u || '').trim();
    if (/^(https?:\/\/|mailto:|tel:)/i.test(u)) return u;
    return '';
  }

  /* inline markup: **bold**, *italic*, [text](url) */
  function fmt(text) {
    let s = esc(text);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => {
      const url = safeUrl(u.replace(/&amp;/g, '&'));
      return url ? `<a href="${esc(url)}">${t}</a>` : t;
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    return s;
  }

  /* multi-line text: paragraphs, and lines starting with "- " become bullets */
  function richText(text) {
    const lines = String(text || '').split(/\r?\n/);
    let out = '', list = [], para = [];
    const flushList = () => { if (list.length) { out += '<ul class="rz-bul">' + list.map((l) => `<li>${fmt(l)}</li>`).join('') + '</ul>'; list = []; } };
    const flushPara = () => { if (para.length) { out += `<p class="rz-p">${para.map(fmt).join('<br>')}</p>`; para = []; } };
    for (const line of lines) {
      const m = line.match(/^\s*[-•*]\s+(.*)$/);
      if (m) { flushPara(); list.push(m[1]); } else if (!line.trim()) { flushList(); flushPara(); } else { flushList(); para.push(line); }
    }
    flushList(); flushPara();
    return out;
  }

  /* ---------- icons (24x24 stroke icons) ---------- */
  const P = (d) => `<path d="${d}"/>`;
  const C = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}"/>`;
  const L = (a, b, c, d) => `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}"/>`;
  const PL = (p) => `<polyline points="${p}"/>`;
  const R = (x, y, w, h, rx) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx || 0}"/>`;
  const ICONS = {
    phone: P('M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z'),
    mail: P('M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z') + PL('22,6 12,13 2,6'),
    link: P('M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71') + P('M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'),
    pin: P('M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z') + C(12, 10, 3),
    star: PL('12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2'),
    github: P('M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22'),
    linkedin: P('M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z') + R(2, 9, 4, 12) + C(4, 4, 2),
    globe: C(12, 12, 10) + L(2, 12, 22, 12) + P('M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'),
    calendar: R(3, 4, 18, 18, 2) + L(16, 2, 16, 6) + L(8, 2, 8, 6) + L(3, 10, 21, 10),
    user: P('M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2') + C(12, 7, 4),
    briefcase: R(2, 7, 20, 14, 2) + P('M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16'),
    award: C(12, 8, 7) + PL('8.21 13.89 7 23 12 20 17 23 15.79 13.88'),
    shield: P('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'),
    key: P('M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4'),
    code: PL('16 18 22 12 16 6') + PL('8 6 2 12 8 18'),
    cloud: P('M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z'),
    network: C(18, 5, 3) + C(6, 12, 3) + C(18, 19, 3) + L(8.59, 13.51, 15.42, 17.49) + L(15.41, 6.51, 8.59, 10.49),
    server: R(2, 2, 20, 8, 2) + R(2, 14, 20, 8, 2) + L(6, 6, 6.01, 6) + L(6, 18, 6.01, 18),
    book: P('M4 19.5A2.5 2.5 0 0 1 6.5 17H20') + P('M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'),
    cap: P('M22 10L12 5 2 10l10 5 10-5z') + P('M6 12v5c3 3 9 3 12 0v-5'),
    heart: P('M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'),
    check: PL('20 6 9 17 4 12'),
    terminal: PL('4 17 10 11 4 5') + L(12, 19, 20, 19),
    cpu: R(4, 4, 16, 16, 2) + R(9, 9, 6, 6) + L(9, 1, 9, 4) + L(15, 1, 15, 4) + L(9, 20, 9, 23) + L(15, 20, 15, 23) + L(20, 9, 23, 9) + L(20, 14, 23, 14) + L(1, 9, 4, 9) + L(1, 14, 4, 14),
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/>' + P('M21 12c0 1.66-4 3-9 3s-9-1.34-9-3') + P('M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5'),
    wifi: P('M5 12.55a11 11 0 0 1 14.08 0') + P('M1.42 9a16 16 0 0 1 21.16 0') + P('M8.53 16.11a6 6 0 0 1 6.95 0') + L(12, 20, 12.01, 20),
    lock: R(3, 11, 18, 11, 2) + P('M7 11V7a5 5 0 0 1 10 0v4'),
    flag: P('M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z') + L(4, 22, 4, 15),
    zap: PL('13 2 3 14 12 14 11 22 21 10 12 10 13 2'),
    tool: P('M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z'),
    trend: PL('23 6 13.5 15.5 8.5 10.5 1 18') + PL('17 6 23 6 23 12'),
    layers: PL('12 2 2 7 12 12 22 7 12 2') + PL('2 17 12 22 22 17') + PL('2 12 12 17 22 12'),
    target: C(12, 12, 10) + C(12, 12, 6) + C(12, 12, 2),
    monitor: R(2, 3, 20, 14, 2) + L(8, 21, 16, 21) + L(12, 17, 12, 21),
    users: P('M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2') + C(9, 7, 4) + P('M23 21v-2a4 4 0 0 0-3-3.87') + P('M16 3.13a4 4 0 0 1 0 7.75'),
    thumb: P('M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3'),
    megaphone: PL('11 5 6 9 2 9 2 15 6 15 11 19 11 5') + P('M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07'),
    pen: P('M12 20h9') + P('M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z'),
    smile: C(12, 12, 10) + P('M8 14s1.5 2 4 2 4-2 4-2') + L(9, 9, 9.01, 9) + L(15, 9, 15.01, 9),
    coffee: P('M18 8h1a4 4 0 0 1 0 8h-1') + P('M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z') + L(6, 1, 6, 4) + L(10, 1, 10, 4) + L(14, 1, 14, 4),
    compass: C(12, 12, 10) + PL('16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76'),
    bookmark: P('M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z'),
    home: P('M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z') + PL('9 22 9 12 15 12 15 22'),
    camera: P('M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z') + C(12, 13, 4),
    music: P('M9 18V5l12-2v13') + C(6, 18, 3) + C(18, 16, 3),
    trophy: P('M6 9H4.5a2.5 2.5 0 0 1 0-5H6') + P('M18 9h1.5a2.5 2.5 0 0 0 0-5H18') + P('M4 22h16') + P('M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22') + P('M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22') + P('M18 2H6v7a6 6 0 0 0 12 0V2z'),
    medal: P('M7.21 15L2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15') + P('M11 12L5.12 2.2') + P('M13 12l5.88-9.8') + P('M8 7h8') + C(12, 17, 5),
    badge: P('M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76z'),
    badgecheck: P('M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76z') + P('M9 12l2 2 4-4'),
    shieldcheck: P('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z') + P('M9 12l2 2 4-4'),
    filecheck: P('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z') + PL('14 2 14 8 20 8') + P('M9 15l2 2 4-4'),
    clipboard: R(8, 2, 8, 4, 1) + P('M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2') + P('M9 14l2 2 4-4'),
    lightbulb: P('M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5') + P('M9 18h6') + P('M10 22h4'),
    rocket: P('M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z') + P('M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z') + P('M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0') + P('M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5'),
    crown: P('M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z') + P('M5 20h14'),
    gem: P('M6 3h12l4 6-10 13L2 9z') + P('M11 3L8 9l4 13 4-13-3-6') + P('M2 9h20'),
    router: R(2, 14, 20, 8, 2) + L(6, 18, 6.01, 18) + L(10, 18, 10.01, 18) + P('M15 10v4') + P('M17.84 7.17a4 4 0 0 0-5.66 0') + P('M20.66 4.34a8 8 0 0 0-11.31 0'),
    activity: PL('22 12 18 12 15 21 9 3 6 12 2 12'),
    chart: L(12, 20, 12, 10) + L(18, 20, 18, 4) + L(6, 20, 6, 16),
    package: P('M16.5 9.4L7.55 4.24') + P('M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z') + PL('3.29 7 12 12 20.71 7') + L(12, 22, 12, 12),
    branch: L(6, 3, 6, 15) + C(18, 6, 3) + C(6, 18, 3) + P('M18 9a9 9 0 0 1-9 9'),
    search: C(11, 11, 8) + L(21, 21, 16.65, 16.65),
    flask: P('M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2') + P('M8.5 2h7') + P('M7 16h10'),
    dollar: L(12, 1, 12, 23) + P('M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'),
    harddrive: L(22, 12, 2, 12) + P('M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z') + L(6, 16, 6.01, 16) + L(10, 16, 10.01, 16),
    infinity: P('M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z'),
  };
  /* optional bundled libraries, loaded on demand: Lucide (stroke icons, by name) and Simple Icons (brand logos, 'brand:slug') */
  const LIB = { lucide: null, brands: null };
  const setIconLib = (kind, data) => { LIB[kind] = data; };
  const libs = () => LIB;
  const STROKE = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  function icon(name) {
    if (!name) return '';
    if (ICONS[name]) return `<svg class="ic" viewBox="0 0 24 24" ${STROKE} aria-hidden="true">${ICONS[name]}</svg>`;
    if (name.startsWith('brand:')) {
      const b = LIB.brands && LIB.brands[name.slice(6)];
      return b ? `<svg class="ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${b.p}"/></svg>` : '';
    }
    const l = LIB.lucide && LIB.lucide[name];
    return l ? `<svg class="ic" viewBox="0 0 24 24" ${STROKE} aria-hidden="true">${l.s}</svg>` : '';
  }

  /* ---------- edit mode: fields become contenteditable and carry an id (data-f) ---------- */
  let EDIT = false;
  const fa = (id, mode, ph) => (EDIT ? ` data-f="${esc(id)}" data-m="${mode}" data-ph="${esc(ph || '')}" contenteditable="${mode === 'line' ? 'plaintext-only' : 'true'}" spellcheck="false"` : '');
  const ia = (id) => (EDIT ? ` data-iid="${esc(id)}"` : '');


  /* ---------- subtle corner accents: one piece of fine line art per page (not a tiled texture) ---------- */
  const ACCENTS = ['arcs', 'traces', 'contour', 'nodemap', 'dotfade', 'linefade'];
  function accentArt(type, col, op) { // drawn on a 210x297 page, anchored top-right
    const st = (w) => `fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${op}"`;
    const ring = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" ${st(0.35)}/>`;
    const dot = (x, y, r, o) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}" fill-opacity="${(op * (o == null ? 1 : o)).toFixed(3)}"/>`;
    let b = '';
    if (type === 'arcs') {
      [30, 46, 62, 80, 100, 122].forEach((rad) => { b += `<circle cx="210" cy="0" r="${rad}" ${st(0.35)}/>`; });
      [[210 - 46 * Math.cos(0.5), 46 * Math.sin(0.5)], [210 - 80 * Math.cos(1.0), 80 * Math.sin(1.0)], [210 - 100 * Math.cos(0.25), 100 * Math.sin(0.25)], [210 - 62 * Math.cos(1.2), 62 * Math.sin(1.2)]].forEach(([x, y]) => { b += ring(x.toFixed(1), y.toFixed(1), 1.6); });
      b += `<circle cx="168" cy="44" r="12" ${st(0.3)}/><circle cx="168" cy="44" r="22" ${st(0.3)}/>`;
    } else if (type === 'traces') {
      const paths = ['M210 14H180L166 28V60L174 68H198', 'M210 24H184L172 36V78L182 88', 'M210 34H192L180 46V98L188 106H210', 'M150 0V18L140 28V68L148 76', 'M122 0V10L112 20H98', 'M210 122H198L188 132V152', 'M160 0V8L156 12'];
      paths.forEach((d) => { b += `<path d="${d}" ${st(0.4)}/>`; });
      [[198, 68], [182, 88], [148, 76], [98, 20], [188, 152], [210, 106]].forEach(([x, y]) => { b += ring(x, y, 1.9); });
      [[166, 28], [180, 46], [140, 28], [188, 132]].forEach(([x, y]) => { b += dot(x, y, 0.9); });
    } else if (type === 'contour') {
      const blob = (cx, cy, R, ph) => { let d = ''; for (let i = 0; i <= 72; i++) { const t = (i / 72) * 2 * Math.PI, rr = R * (1 + 0.13 * Math.sin(3 * t + ph) + 0.07 * Math.sin(5 * t + 2 * ph)); d += (i ? 'L' : 'M') + (cx + rr * Math.cos(t)).toFixed(1) + ' ' + (cy + rr * Math.sin(t)).toFixed(1); } return d + 'Z'; };
      [11, 20, 30, 41, 53, 66, 80, 96].forEach((R, i) => { b += `<path d="${blob(196, 20, R, i * 0.6)}" ${st(0.3)}/>`; });
    } else if (type === 'nodemap') {
      const n = [[196, 18], [172, 30], [186, 52], [150, 22], [160, 58], [128, 38], [200, 84], [170, 88]];
      const l = [[0, 1], [0, 2], [1, 2], [1, 3], [1, 4], [2, 4], [3, 5], [4, 5], [2, 6], [4, 7], [6, 7]];
      l.forEach(([i, j]) => { b += `<path d="M${n[i][0]} ${n[i][1]}L${n[j][0]} ${n[j][1]}" ${st(0.3)}/>`; });
      n.forEach(([x, y], i) => { b += i % 3 === 0 ? ring(x, y, 2.4) : dot(x, y, 1.3); });
    } else if (type === 'dotfade') {
      for (let ix = 0; ix < 22; ix++) for (let iy = 0; iy < 18; iy++) {
        const x = 207 - ix * 5.5, y = 4 + iy * 5.5, d = Math.hypot(207 - x, y - 4) / 105, o = Math.max(0, 1 - d);
        if (o > 0.04) b += dot(x.toFixed(1), y.toFixed(1), 0.75, Math.pow(o, 1.4).toFixed(2));
      }
    } else if (type === 'linefade') {
      for (let i = 0; i < 26; i++) {
        const o = Math.max(0.1, 1 - i / 26), c = 14 + i * 5.2;
        b += `<path d="M${210 - c} 0L210 ${c}" fill="none" stroke="${col}" stroke-width="0.3" stroke-opacity="${(op * o).toFixed(3)}"/>`;
      }
    }
    return b;
  }
  const CORNER_T = { tr: '', tl: 'translate(210 0) scale(-1 1)', br: 'translate(0 297) scale(1 -1)', bl: 'translate(210 297) scale(-1 -1)' };

  /* ---------- patterns ---------- */
  function patternLayer(p, ctx) {
    if (!p || p.type === 'none') return null;
    if (ACCENTS.includes(p.type)) {
      const t = CORNER_T[p.corner] || '';
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 297" preserveAspectRatio="xMaxYMin slice"><g${t ? ` transform="${t}"` : ''}>${accentArt(p.type, p.color, p.opacity)}</g></svg>`;
      const uri = "url('data:image/svg+xml," + encodeURIComponent(svg).replace(/'/g, '%27') + "')";
      const flip = p.corner === 'br' || p.corner === 'bl', left = p.corner === 'tl' || p.corner === 'bl';
      const pos = `${left ? 'left' : 'right'} ${flip ? 'bottom' : 'top'}`;
      if (ctx && ctx.pw) return { img: uri, size: `${ctx.pw} ${ctx.ph}`, repeat: 'repeat-y', pos, accent: true };
      const w = Math.round(640 * p.scale);
      return { img: uri, size: `${w}px ${Math.round(w * 297 / 210)}px`, repeat: 'no-repeat', pos, accent: true };
    }
    const col = p.color, op = p.opacity, sc = p.scale;
    const a = `fill-opacity="${op}" stroke-opacity="${op}"`;
    let w = 20, h = 20, body = '', repeat = 'repeat', pos = '0 0';
    switch (p.type) {
      case 'dots': w = h = 18; body = `<circle cx="9" cy="9" r="1.7" fill="${col}" ${a}/>`; break;
      case 'grid': w = h = 22; body = `<path d="M22 0H0V22" fill="none" stroke="${col}" stroke-width="1" ${a}/>`; break;
      case 'lines': w = 8; h = 8; body = `<path d="M0 4H8" stroke="${col}" stroke-width="1" ${a}/>`; break;
      case 'diagonal': w = h = 10; body = `<path d="M-1 11L11 -1M-1 1L1 -1M9 11L11 9" stroke="${col}" stroke-width="1" ${a}/>`; break;
      case 'crosshatch': w = h = 12; body = `<path d="M0 0L12 12M12 0L0 12" stroke="${col}" stroke-width=".8" ${a}/>`; break;
      case 'waves': w = 40; h = 14; body = `<path d="M0 7Q10 0 20 7T40 7" fill="none" stroke="${col}" stroke-width="1.2" ${a}/>`; break;
      case 'zigzag': w = 16; h = 9; body = `<path d="M0 8L8 1L16 8" fill="none" stroke="${col}" stroke-width="1.2" ${a}/>`; break;
      case 'triangles': w = h = 26; body = `<path d="M13 4L22 20H4Z" fill="none" stroke="${col}" stroke-width="1" ${a}/>`; break;
      case 'circuit': { // PCB traces with 45-degree bends and via rings; edges line up so the tile repeats seamlessly
        w = h = 60;
        const st = `fill="none" stroke="${col}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" ${a}`;
        body = `<g ${st}>` +
          '<path d="M0 14H20L32 26V44L44 56V60"/><path d="M44 0V6L52 14H60"/>' +
          '<path d="M0 40H4L8 44V60"/><path d="M8 0V4L12 8H20"/>' +
          '<path d="M60 30H50L46 34H38"/><path d="M0 30H2"/><path d="M24 60V52L30 46"/><path d="M24 0V4"/>' +
          '</g>' +
          `<g fill="none" stroke="${col}" stroke-width="1.2" ${a}>` +
          '<circle cx="0" cy="14" r="2.4"/><circle cx="60" cy="14" r="2.4"/><circle cx="20" cy="8" r="2.4"/><circle cx="38" cy="30" r="2.4"/><circle cx="30" cy="46" r="2.4"/><circle cx="2" cy="30" r="2.4"/>' +
          '</g>' +
          `<g fill="${col}" ${a}><circle cx="32" cy="26" r="1.4"/><circle cx="44" cy="56" r="1.4"/><circle cx="8" cy="44" r="1.4"/><circle cx="52" cy="14" r="1.4"/></g>`;
        break;
      }
      case 'network': { // nodes and links; links run to shared corner nodes so tiles join without seams
        w = h = 90;
        const nodes = [[22, 24], [60, 16], [70, 58], [30, 64], [50, 40]];
        const links = [[[0, 0], [22, 24]], [[22, 24], [60, 16]], [[60, 16], [90, 0]], [[60, 16], [50, 40]], [[22, 24], [50, 40]], [[50, 40], [70, 58]], [[50, 40], [30, 64]], [[30, 64], [0, 90]], [[70, 58], [90, 90]], [[60, 16], [70, 58]], [[22, 24], [30, 64]]];
        body = `<g fill="none" stroke="${col}" stroke-width="1" ${a}>` + links.map(([p, q]) => `<path d="M${p[0]} ${p[1]}L${q[0]} ${q[1]}"/>`).join('') + '</g>' +
          `<g fill="${col}" ${a}>` + nodes.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 2 ? 2.6 : 3.4}"/>`).join('') + [[0, 0], [90, 0], [0, 90], [90, 90]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6"/>`).join('') + '</g>';
        break;
      }
      case 'circles': {
        w = h = 420; repeat = 'no-repeat'; pos = 'right -80px top -80px';
        for (let r = 40; r <= 200; r += 32) body += `<circle cx="210" cy="210" r="${r}" fill="none" stroke="${col}" stroke-width="2" ${a}/>`;
        break;
      }
      default: return null;
    }
    const k = p.type === 'circles' ? sc : sc;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
    const uri = "url('data:image/svg+xml," + encodeURIComponent(svg).replace(/'/g, '%27') + "')";
    return { img: uri, size: `${Math.round(w * k)}px ${Math.round(h * k)}px`, repeat, pos };
  }

  /* ---------- layout maths ---------- */
  function sideHasContent(doc) {
    const s = doc.settings, h = doc.header;
    const photo = s.header.in === 'main' && s.header.photoShape !== 'none' && h.photo;
    const contacts = s.header.in === 'main' && s.header.contactsIn === 'side' && h.contacts.some((c) => c.text);
    return !!photo || contacts;
  }
  function layoutInfo(doc) {
    const s = doc.settings;
    const sideSecs = doc.sections.filter((x) => x.column === 'side' && (EDIT || x.items.length));
    const mainSecs = doc.sections.filter((x) => x.column !== 'side' && (EDIT || x.items.length));
    const twoCol = s.layout !== 'single' && (sideSecs.length > 0 || sideHasContent(doc));
    const [pw, ph] = T.PAGE_MM[s.pageSize] || T.PAGE_MM.A4;
    const cw = pw - s.margins.left - s.margins.right;
    let mainW = cw, sideW = 0;
    if (twoCol) { mainW = (cw - s.columnGap) * (s.columnRatio / 100); sideW = cw - s.columnGap - mainW; }
    return { twoCol, sideSecs, mainSecs, pw, ph, cw, mainW, sideW };
  }

  /* CSS (style attribute value) for the page background layer: colour, pattern, filled sidebar */
  function pageBg(doc, o) {
    const prev = EDIT; EDIT = !!(o && o.edit);
    try { return pageBgInner(doc, o || {}); } finally { EDIT = prev; }
  }
  function pageBgInner(doc, o) {
    const s = doc.settings, li = layoutInfo(doc);
    const imgs = [], sizes = [], reps = [], poss = [];
    if (li.twoCol && s.sidebarFilled) {
      const sb = s.colors.sidebarBg;
      let g;
      if (s.layout === 'side-left') { const x = (s.margins.left + li.sideW + s.columnGap / 2).toFixed(2) + 'mm'; g = `linear-gradient(90deg,${sb} 0,${sb} ${x},transparent ${x})`; }
      else { const x = (s.margins.left + li.mainW + s.columnGap / 2).toFixed(2) + 'mm'; g = `linear-gradient(90deg,transparent 0,transparent ${x},${sb} ${x})`; }
      imgs.push(g); sizes.push('100% 100%'); reps.push('no-repeat'); poss.push('0 0');
    }
    const [pwMM, phMM] = T.PAGE_MM[s.pageSize] || T.PAGE_MM.A4;
    const pl = s.pattern.area === 'page' ? patternLayer(s.pattern, { pw: pwMM + 'mm', ph: o.pageH || phMM + 'mm' }) : null;
    // fine accents sit above the sidebar fill; tiled textures stay underneath it
    if (pl) { const at = pl.accent ? 0 : imgs.length; imgs.splice(at, 0, pl.img); sizes.splice(at, 0, pl.size); reps.splice(at, 0, pl.repeat); poss.splice(at, 0, pl.pos); }
    let css = `background-color:${s.colors.bg};`;
    if (imgs.length) css += `background-image:${imgs.join(',')};background-size:${sizes.join(',')};background-repeat:${reps.join(',')};background-position:${poss.join(',')};`;
    return css;
  }

  /* ---------- pieces ---------- */
  function contactHref(c) {
    if (c.link) return safeUrl(c.link);
    const t = (c.text || '').trim();
    if (c.icon === 'mail' && /@/.test(t)) return 'mailto:' + t;
    if (c.icon === 'phone') return 'tel:' + t.replace(/[^\d+]/g, '');
    if (['link', 'linkedin', 'github', 'globe'].includes(c.icon) && /^(https?:\/\/|www\.|[\w-]+\.[a-z]{2,}(\/|$))/i.test(t)) return safeUrl(/^https?:/i.test(t) ? t : 'https://' + t);
    return '';
  }
  function contactsHtml(doc, vertical) {
    const cs = EDIT ? doc.header.contacts : doc.header.contacts.filter((c) => c.text);
    if (!cs.length) return '';
    const showIcons = doc.settings.contactIcons;
    return `<ul class="rz-contacts${vertical ? ' vert' : ''}" data-edit="header">` + cs.map((c) => {
      const href = EDIT ? '' : contactHref(c);
      const label = EDIT ? `<span${fa('C:' + c.id, 'line', 'Contact')}>${esc(c.text)}</span>` : href ? `<a href="${esc(href)}">${esc(c.text)}</a>` : `<span>${esc(c.text)}</span>`;
      return `<li>${showIcons ? icon(c.icon) : ''}${label}</li>`;
    }).join('') + '</ul>';
  }
  function photoHtml(doc) {
    const s = doc.settings.header;
    if (s.photoShape === 'none' || !doc.header.photo) return '';
    return `<img class="rz-photo ps-${s.photoShape}" src="${esc(doc.header.photo)}" alt="" data-edit="header">`;
  }
  function headerHtml(doc, li, mode) {
    const h = doc.header, s = doc.settings;
    const side = mode === 'main' && li.twoCol; // name block lives in main column, photo+contacts in sidebar
    const pat = s.pattern.area === 'header' ? patternLayer(s.pattern) : null;
    const pstyle = pat ? ` style="background-image:${esc(pat.img)};background-size:${pat.size};background-repeat:${pat.repeat};background-position:${pat.pos}"` : '';
    const contactsInHeader = !(side && s.header.contactsIn === 'side');
    const photo = side ? '' : photoHtml(doc);
    return `<header class="rz-header pp-${s.header.photoPos}" data-edit="header"${pstyle}>` +
      `<div class="rz-hd-text">` +
      (h.name || EDIT ? `<h1 class="rz-name"${fa('H:name', 'line', 'Your name')}>${esc(h.name)}</h1>` : '') +
      (h.title || EDIT ? `<div class="rz-jobtitle"${fa('H:title', 'line', 'Job title')}>${esc(h.title)}</div>` : '') +
      (contactsInHeader ? contactsHtml(doc, false) : '') +
      (h.tagline || EDIT ? `<div class="rz-tagline"${fa('H:tagline', 'rich', 'Tagline')}>${fmt(h.tagline)}</div>` : '') +
      `</div>${photo}</header>`;
  }

  function entryHtml(it, doc, sid) {
    const ds = doc.settings.entries.dateStyle;
    const ic = ds === 'icons';
    const F = (f, mode, ph) => fa(`E:${sid}:${it.id}:${f}`, mode, ph);
    const org = EDIT ? esc(it.org) : it.org ? (safeUrl(it.orgLink) ? `<a href="${esc(safeUrl(it.orgLink))}">${esc(it.org)}</a>` : esc(it.org)) : '';
    const date = it.date || EDIT ? `<span class="rz-e-date">${ic ? icon('calendar') : ''}<span${F('date', 'line', 'Date')}>${esc(it.date)}</span></span>` : '';
    const loc = it.location || EDIT ? `<span class="rz-e-loc">${ic ? icon('pin') : ''}<span${F('location', 'line', 'Location')}>${esc(it.location)}</span></span>` : '';
    const bullets = it.bullets.map((b, i) => [b, i]).filter(([b]) => EDIT || b.trim());
    const mark = it.logo ? `<img class="rz-logo" src="${esc(it.logo)}" alt="">` : it.icon ? `<span class="rz-eicon" data-pick="entry">${icon(it.icon)}</span>` : '';
    return `<div class="rz-entry"${ia(it.id)}>` + mark +
      `<div class="rz-e-body"><div class="rz-e-head">` +
      (it.title || EDIT ? `<div class="rz-e-title"${F('title', 'rich', 'Title')}>${fmt(it.title)}</div>` : '') +
      (org || EDIT ? `<div class="rz-e-org"${F('org', 'line', 'Organization')}>${org}</div>` : '') + date + loc + `</div>` +
      (it.text || EDIT ? `<div class="rz-e-text"${F('text', 'multi', 'Add a description')}>${richText(it.text)}</div>` : '') +
      (EDIT ? `<ul class="rz-bul"${fa(`BL:${sid}:${it.id}`, 'list', '')}>${(it.bullets.length ? it.bullets : ['']).map((b) => `<li data-ph="Describe an achievement">${fmt(b)}</li>`).join('')}</ul>`
        : bullets.length ? `<ul class="rz-bul">${bullets.map(([b]) => `<li>${fmt(b)}</li>`).join('')}</ul>` : '') +
      `</div></div>`;
  }

  function sectionHtml(sec, doc) {
    const type = T.SECTION_TYPES[sec.type] || {};
    const kind = type.kind;
    const sid = sec.id;
    let body = '';
    if (kind === 'text') {
      body = sec.items.map((it) => `<div class="rz-text${sec.type === 'philosophy' ? ' rz-quote' : ''}"${ia(it.id)}${fa(`X:${sid}:${it.id}:text`, 'multi', 'Write something…')}>${richText(it.text)}</div>`).join('');
    } else if (kind === 'entries') body = sec.items.map((it) => entryHtml(it, doc, sid)).join('');
    else if (kind === 'skills') {
      body = sec.items.map((it) => `<div class="rz-sg"${ia(it.id)}>${it.name || EDIT ? `<div class="rz-sg-name"${fa(`G:${sid}:${it.id}:name`, 'line', 'Group')}>${esc(it.name)}</div>` : ''}<div class="rz-tags">${it.tags.map((t, j) => [t, j]).filter(([t]) => EDIT || t.trim()).map(([t, j]) => `<span class="rz-tag"${fa(`T:${sid}:${it.id}:${j}`, 'line', 'Skill')}>${esc(t)}</span>`).join('')}</div></div>`).join('');
    } else if (kind === 'list') {
      body = sec.items.map((it) => `<div class="rz-li"${ia(it.id)}>${it.icon ? `<span data-pick="list">${icon(it.icon)}</span>` : ''}<div><div class="rz-li-t"${fa(`L:${sid}:${it.id}:title`, 'rich', 'Title')}>${fmt(it.title)}</div>${it.sub || EDIT ? `<div class="rz-li-s"${fa(`L:${sid}:${it.id}:sub`, 'rich', 'Details')}>${fmt(it.sub)}</div>` : ''}</div></div>`).join('');
    } else if (kind === 'levels') {
      const st = sec.type === 'expertise' ? 'slider' : doc.settings.levels.style;
      body = sec.items.map((it) => {
        let viz = '';
        const lv = EDIT ? ' data-lv' : '';
        if (st === 'dots') viz = '<span class="rz-dots">' + [1, 2, 3, 4, 5].map((n) => `<i${n <= it.level ? ' class="on"' : ''}${EDIT ? ` data-lv="${n}"` : ''}></i>`).join('') + '</span>';
        else if (st === 'bars') viz = `<span class="rz-bar"${lv}><i style="width:${it.level * 20}%"></i></span>`;
        else if (st === 'slider') viz = `<span class="rz-slider"${lv}><i style="width:${it.level * 20}%"></i><b style="left:${it.level * 20}%"></b></span>`;
        const label = st !== 'text' && (it.label || EDIT) && st !== 'slider' ? `<small${fa(`V:${sid}:${it.id}:label`, 'line', 'Level')}>${esc(it.label)}</small>` : '';
        const wide = st === 'slider' ? ' rz-lv-col' : '';
        return `<div class="rz-lv${wide}"${ia(it.id)}><span class="rz-lv-n"><span${fa(`V:${sid}:${it.id}:name`, 'line', 'Name')}>${esc(it.name)}</span>${label}</span>${st === 'text' ? `<span class="rz-lv-l"${fa(`V:${sid}:${it.id}:label`, 'line', 'Level')}>${esc(it.label)}</span>` : viz}</div>`;
      }).join('');
    }
    const hicon = sec.icon && doc.settings.heading.icons ? `<span class="rz-h-ic" data-pick="section">${icon(sec.icon)}</span>` : '';
    return `<section class="rz-sec k-${kind} t-${esc(sec.type)}" data-sid="${esc(sec.id)}"><h2 class="rz-h">${hicon}<span${fa(`S:${sid}:title`, 'line', 'Section title')}>${esc(sec.title)}</span></h2><div class="rz-body">${body}</div></section>`;
  }

  /* ---------- main entry ---------- */
  function render(doc, o) {
    const prev = EDIT; EDIT = !!(o && o.edit);
    try { return renderInner(doc, o || {}); } finally { EDIT = prev; }
  }
  function renderInner(doc, o) {
    const s = doc.settings, c = s.colors, li = layoutInfo(doc);
    const fonts = Object.fromEntries(T.FONTS.map((f) => [f.name, f.stack]));
    const orgColor = { accent: 'var(--accent)', text: 'var(--text)', muted: 'var(--muted)' }[s.entries.orgColor];
    const titleColor = { accent: 'var(--accent)', text: 'var(--text)', muted: 'var(--muted)' }[s.header.titleColor];
    const vars = {
      '--accent': c.accent, '--text': c.text, '--heading': c.heading, '--muted': c.muted, '--bg': c.bg, '--line': c.line,
      '--chip-bg': c.chipBg, '--chip-border': c.chipBorder, '--header-bg': c.headerBg, '--header-text': c.headerText,
      '--side-bg': c.sidebarBg, '--side-text': c.sideText, '--side-accent': c.sideAccent,
      '--on-accent': T.luminance(c.accent) > 0.5 ? '#111111' : '#ffffff',
      '--font-h': fonts[s.fontHeading], '--font-b': fonts[s.fontBody],
      '--fs': s.fontSize + 'pt', '--lh': s.lineHeight, '--sgap': s.sectionGap + 'mm', '--egap': s.entryGap + 'mm', '--gap': s.columnGap + 'mm',
      '--main-w': li.mainW.toFixed(2) + 'mm', '--side-w': li.sideW.toFixed(2) + 'mm', '--photo': s.header.photoSize + 'mm',
      '--name-size': s.header.nameSize + 'pt', '--title-size': s.header.titleSize + 'pt', '--hsize': s.heading.size + 'pt',
      '--hweight': s.heading.weight, '--hspace': s.heading.spacing + 'em', '--etitle': s.entries.titleSize + 'pt',
      '--org': orgColor, '--title-color': titleColor,
    };
    const style = Object.entries(vars).map(([k, v]) => `${k}:${esc(v)}`).join(';');
    const cls = ['rz', 'lay-' + (li.twoCol ? s.layout : 'single'), 'hs-' + s.heading.style, 'hc-' + s.heading.case, 'sk-' + s.skills.style,
      'bl-' + s.entries.bulletStyle, 'ds-' + s.entries.dateStyle, s.skills.fill ? 'sk-fill' : 'sk-nofill', 'hd-' + s.header.style, 'nc-' + s.header.nameCase, 'lv-' + s.levels.style];
    if (s.entries.dividers) cls.push('div');

    const headerMain = li.twoCol && s.header.in === 'main';
    const secs = (arr) => arr.map((x) => sectionHtml(x, doc)).join('');
    let html = '';
    if (!headerMain && !o.noHeader) html += headerHtml(doc, li, 'top');
    html += '<div class="rz-cols">';
    // in a single column layout the sidebar sections follow the main ones
    const mainList = li.twoCol ? li.mainSecs : li.mainSecs.concat(doc.sections.filter((x) => x.column === 'side' && (EDIT || x.items.length)));
    html += `<div class="rz-main">${headerMain && !o.noHeader ? headerHtml(doc, li, 'main') : ''}${secs(mainList)}</div>`;
    if (li.twoCol) {
      const filled = s.sidebarFilled ? ' filled' : '';
      const sideTop = headerMain ? photoHtml(doc) + (s.header.contactsIn === 'side' ? contactsHtml(doc, true) : '') : '';
      html += `<div class="rz-side${filled}">${sideTop ? `<div class="rz-side-top">${sideTop}</div>` : ''}${secs(li.sideSecs)}</div>`;
    }
    html += '</div>';
    return `<div class="${cls.join(' ')}" style="${style}">${html}</div>`;
  }

  return { render, pageBg, layoutInfo, esc, fmt, icon, ICONS, richText, patternLayer, safeUrl, setIconLib, libs };
});
