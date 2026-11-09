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
  };
  const icon = (name) => (ICONS[name] ? `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>` : '');

  /* ---------- patterns ---------- */
  function patternLayer(p) {
    if (!p || p.type === 'none') return null;
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
    const sideSecs = doc.sections.filter((x) => x.column === 'side' && x.items.length);
    const mainSecs = doc.sections.filter((x) => x.column !== 'side' && x.items.length);
    const twoCol = s.layout !== 'single' && (sideSecs.length > 0 || sideHasContent(doc));
    const [pw, ph] = T.PAGE_MM[s.pageSize] || T.PAGE_MM.A4;
    const cw = pw - s.margins.left - s.margins.right;
    let mainW = cw, sideW = 0;
    if (twoCol) { mainW = (cw - s.columnGap) * (s.columnRatio / 100); sideW = cw - s.columnGap - mainW; }
    return { twoCol, sideSecs, mainSecs, pw, ph, cw, mainW, sideW };
  }

  /* CSS (style attribute value) for the page background layer: colour, pattern, filled sidebar */
  function pageBg(doc) {
    const s = doc.settings, li = layoutInfo(doc);
    const imgs = [], sizes = [], reps = [], poss = [];
    if (li.twoCol && s.sidebarFilled) {
      const sb = s.colors.sidebarBg;
      let g;
      if (s.layout === 'side-left') { const x = (s.margins.left + li.sideW + s.columnGap / 2).toFixed(2) + 'mm'; g = `linear-gradient(90deg,${sb} 0,${sb} ${x},transparent ${x})`; }
      else { const x = (s.margins.left + li.mainW + s.columnGap / 2).toFixed(2) + 'mm'; g = `linear-gradient(90deg,transparent 0,transparent ${x},${sb} ${x})`; }
      imgs.push(g); sizes.push('100% 100%'); reps.push('no-repeat'); poss.push('0 0');
    }
    const pl = s.pattern.area === 'page' ? patternLayer(s.pattern) : null;
    if (pl) { imgs.push(pl.img); sizes.push(pl.size); reps.push(pl.repeat); poss.push(pl.pos); }
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
    const cs = doc.header.contacts.filter((c) => c.text);
    if (!cs.length) return '';
    const showIcons = doc.settings.contactIcons;
    return `<ul class="rz-contacts${vertical ? ' vert' : ''}" data-edit="header">` + cs.map((c) => {
      const href = contactHref(c);
      const label = href ? `<a href="${esc(href)}">${esc(c.text)}</a>` : `<span>${esc(c.text)}</span>`;
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
      (h.name ? `<h1 class="rz-name">${esc(h.name)}</h1>` : '') +
      (h.title ? `<div class="rz-jobtitle">${esc(h.title)}</div>` : '') +
      (contactsInHeader ? contactsHtml(doc, false) : '') +
      (h.tagline ? `<div class="rz-tagline">${fmt(h.tagline)}</div>` : '') +
      `</div>${photo}</header>`;
  }

  function entryHtml(it, doc) {
    const ds = doc.settings.entries.dateStyle;
    const ic = ds === 'icons';
    const org = it.org ? (safeUrl(it.orgLink) ? `<a href="${esc(safeUrl(it.orgLink))}">${esc(it.org)}</a>` : esc(it.org)) : '';
    const date = it.date ? `<span class="rz-e-date">${ic ? icon('calendar') : ''}${esc(it.date)}</span>` : '';
    const loc = it.location ? `<span class="rz-e-loc">${ic ? icon('pin') : ''}${esc(it.location)}</span>` : '';
    const bullets = it.bullets.filter((b) => b.trim());
    return `<div class="rz-entry">` +
      (it.logo ? `<img class="rz-logo" src="${esc(it.logo)}" alt="">` : '') +
      `<div class="rz-e-body"><div class="rz-e-head">` +
      (it.title ? `<div class="rz-e-title">${fmt(it.title)}</div>` : '') +
      (org ? `<div class="rz-e-org">${org}</div>` : '') + date + loc + `</div>` +
      (it.text ? `<div class="rz-e-text">${richText(it.text)}</div>` : '') +
      (bullets.length ? `<ul class="rz-bul">${bullets.map((b) => `<li>${fmt(b)}</li>`).join('')}</ul>` : '') +
      `</div></div>`;
  }

  function sectionHtml(sec, doc) {
    const kind = (T.SECTION_TYPES[sec.type] || {}).kind;
    let body = '';
    if (kind === 'text') body = sec.items.map((it) => `<div class="rz-text">${richText(it.text)}</div>`).join('');
    else if (kind === 'entries') body = sec.items.map((it) => entryHtml(it, doc)).join('');
    else if (kind === 'skills') {
      body = sec.items.map((it) => `<div class="rz-sg">${it.name ? `<div class="rz-sg-name">${esc(it.name)}</div>` : ''}<div class="rz-tags">${it.tags.filter((t) => t.trim()).map((t) => `<span class="rz-tag">${esc(t)}</span>`).join('')}</div></div>`).join('');
    } else if (kind === 'list') {
      body = sec.items.map((it) => `<div class="rz-li">${it.icon ? icon(it.icon) : ''}<div><div class="rz-li-t">${fmt(it.title)}</div>${it.sub ? `<div class="rz-li-s">${fmt(it.sub)}</div>` : ''}</div></div>`).join('');
    } else if (kind === 'levels') {
      const st = doc.settings.levels.style;
      body = sec.items.map((it) => {
        let viz = '';
        if (st === 'dots') viz = '<span class="rz-dots">' + [1, 2, 3, 4, 5].map((n) => `<i${n <= it.level ? ' class="on"' : ''}></i>`).join('') + '</span>';
        else if (st === 'bars') viz = `<span class="rz-bar"><i style="width:${it.level * 20}%"></i></span>`;
        return `<div class="rz-lv"><span class="rz-lv-n">${esc(it.name)}${st !== 'text' && it.label ? `<small>${esc(it.label)}</small>` : ''}</span>${st === 'text' ? `<span class="rz-lv-l">${esc(it.label)}</span>` : viz}</div>`;
      }).join('');
    }
    return `<section class="rz-sec k-${kind}" data-sid="${esc(sec.id)}"><h2 class="rz-h"><span>${esc(sec.title)}</span></h2><div class="rz-body">${body}</div></section>`;
  }

  /* ---------- main entry ---------- */
  function render(doc) {
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
      'bl-' + s.entries.bulletStyle, 'ds-' + s.entries.dateStyle, 'hd-' + s.header.style, 'nc-' + s.header.nameCase, 'lv-' + s.levels.style];
    if (s.entries.dividers) cls.push('div');

    const headerMain = li.twoCol && s.header.in === 'main';
    const secs = (arr) => arr.map((x) => sectionHtml(x, doc)).join('');
    let html = '';
    if (!headerMain) html += headerHtml(doc, li, 'top');
    html += '<div class="rz-cols">';
    // in a single column layout the sidebar sections follow the main ones
    const mainList = li.twoCol ? li.mainSecs : li.mainSecs.concat(doc.sections.filter((x) => x.column === 'side' && x.items.length));
    html += `<div class="rz-main">${headerMain ? headerHtml(doc, li, 'main') : ''}${secs(mainList)}</div>`;
    if (li.twoCol) {
      const filled = s.sidebarFilled ? ' filled' : '';
      const sideTop = headerMain ? photoHtml(doc) + (s.header.contactsIn === 'side' ? contactsHtml(doc, true) : '') : '';
      html += `<div class="rz-side${filled}">${sideTop ? `<div class="rz-side-top">${sideTop}</div>` : ''}${secs(li.sideSecs)}</div>`;
    }
    html += '</div>';
    return `<div class="${cls.join(' ')}" style="${style}">${html}</div>`;
  }

  return { render, pageBg, layoutInfo, esc, fmt, icon, ICONS, richText };
});
