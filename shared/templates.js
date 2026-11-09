/* EnhanceResume shared model: defaults, templates, palettes, sanitising.
 * UMD: works in Node (require) and the browser (window.ERT). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./fontlist.json'));
  else root.ERT = factory(root.ER_FONTLIST || []);
})(typeof self !== 'undefined' ? self : this, function (FONTLIST) {
  'use strict';

  const uid = () => Math.random().toString(36).slice(2, 10);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

  function deepMerge(base, patch) {
    const out = clone(base);
    (function walk(t, p) {
      for (const k of Object.keys(p || {})) {
        if (isObj(p[k]) && isObj(t[k])) walk(t[k], p[k]);
        else t[k] = clone(p[k]);
      }
    })(out, patch);
    return out;
  }

  /* ---------- colour helpers ---------- */
  const hex6 = (h) => {
    h = String(h || '#000000').replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return h.slice(0, 6).padEnd(6, '0');
  };
  function mix(a, b, t) { // t = share of b
    a = hex6(a); b = hex6(b);
    let o = '#';
    for (let i = 0; i < 3; i++) {
      const x = parseInt(a.substr(i * 2, 2), 16), y = parseInt(b.substr(i * 2, 2), 16);
      o += Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
    }
    return o;
  }
  const luminance = (h) => {
    h = hex6(h);
    const c = [0, 2, 4].map((i) => {
      const v = parseInt(h.substr(i, 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };

  /* ---------- fonts ---------- */
  const FONTS = FONTLIST.map((f) => ({
    name: f.name, cat: f.cat,
    stack: `'${f.name}', ${f.cat === 'serif' ? 'Georgia, serif' : f.cat === 'mono' ? 'monospace' : 'Helvetica, Arial, sans-serif'}`,
  }));
  const FONT_NAMES = FONTS.map((f) => f.name);

  /* ---------- palettes ---------- */
  const PALETTES = [
    { id: 'azure', name: 'Azure', accent: '#2b8aff' },
    { id: 'navy', name: 'Navy', accent: '#1e4e8c' },
    { id: 'teal', name: 'Teal', accent: '#0d9488' },
    { id: 'emerald', name: 'Emerald', accent: '#059669' },
    { id: 'violet', name: 'Violet', accent: '#7c3aed' },
    { id: 'rose', name: 'Rose', accent: '#e11d48' },
    { id: 'crimson', name: 'Crimson', accent: '#b91c1c' },
    { id: 'burgundy', name: 'Burgundy', accent: '#7b1e3a' },
    { id: 'orange', name: 'Sunset', accent: '#ea580c' },
    { id: 'gold', name: 'Gold', accent: '#b7791f' },
    { id: 'slate', name: 'Slate', accent: '#475569' },
    { id: 'mono', name: 'Mono', accent: '#111111' },
  ];

  /* ---------- full colour themes (light & dark) ---------- */
  const THEMES = [
    { id: 'midnight', name: 'Midnight', dark: true, colors: { accent: '#38bdf8', text: '#e2e8f0', heading: '#ffffff', muted: '#94a3b8', bg: '#0f172a', sidebarBg: '#17223b', sideText: '#e2e8f0', sideAccent: '#7dd3fc', headerBg: '#1e3a5f', headerText: '#ffffff', line: '#2b3a55', chipBg: '#16213a', chipBorder: '#33425f' } },
    { id: 'charcoal', name: 'Charcoal', dark: true, colors: { accent: '#f5b942', text: '#e5e5e7', heading: '#ffffff', muted: '#a1a1a6', bg: '#1c1c1e', sidebarBg: '#262629', sideText: '#e5e5e7', sideAccent: '#f5b942', headerBg: '#2c2c2e', headerText: '#ffffff', line: '#3a3a3d', chipBg: '#262629', chipBorder: '#46464a' } },
    { id: 'forest', name: 'Forest', dark: true, colors: { accent: '#34d399', text: '#dcefe6', heading: '#ffffff', muted: '#8fb3a3', bg: '#0e1a16', sidebarBg: '#14261f', sideText: '#dcefe6', sideAccent: '#6ee7b7', headerBg: '#0f3d2e', headerText: '#ffffff', line: '#25443a', chipBg: '#13241d', chipBorder: '#2d5244' } },
    { id: 'plum', name: 'Plum', dark: true, colors: { accent: '#c084fc', text: '#eadcf5', heading: '#ffffff', muted: '#b39cc9', bg: '#1a1024', sidebarBg: '#251536', sideText: '#eadcf5', sideAccent: '#d8b4fe', headerBg: '#3b1d5a', headerText: '#ffffff', line: '#3a2552', chipBg: '#221330', chipBorder: '#4a2f68' } },
    { id: 'paper', name: 'Paper', dark: false, colors: { accent: '#b45309', text: '#2d2a26', heading: '#1c1917', muted: '#6b645b', bg: '#fbf7ef', sidebarBg: '#f1e9d8', sideText: '#2d2a26', sideAccent: '#b45309', headerBg: '#b45309', headerText: '#ffffff', line: '#ddd2bd', chipBg: '#fffaf0', chipBorder: '#d6c9ad' } },
    { id: 'mist', name: 'Mist', dark: false, colors: { accent: '#4f46e5', text: '#1e293b', heading: '#0f172a', muted: '#64748b', bg: '#f8fafc', sidebarBg: '#e8edf7', sideText: '#1e293b', sideAccent: '#4f46e5', headerBg: '#4f46e5', headerText: '#ffffff', line: '#d5dce8', chipBg: '#ffffff', chipBorder: '#c9d2e3' } },
  ];
  const THEME = (id) => THEMES.find((t) => t.id === id).colors;

  /* ---------- section types ---------- */
  const ICON_CHOICES = ['', 'award', 'shield', 'key', 'code', 'cloud', 'network', 'server', 'book', 'cap', 'briefcase',
    'star', 'check', 'terminal', 'cpu', 'database', 'wifi', 'lock', 'flag', 'zap', 'tool', 'trend', 'layers', 'target', 'heart', 'globe', 'monitor'];
  const CONTACT_ICONS = ['phone', 'mail', 'link', 'linkedin', 'github', 'globe', 'pin', 'star', 'calendar', 'user'];

  const entryLabels = (title, org) => ({ title, org });
  const SECTION_TYPES = {
    summary: { label: 'Summary', kind: 'text', title: 'Summary', column: 'main' },
    experience: { label: 'Experience', kind: 'entries', title: 'Experience', column: 'main', labels: entryLabels('Job title', 'Company') },
    education: { label: 'Education', kind: 'entries', title: 'Education', column: 'main', labels: entryLabels('Degree', 'School') },
    projects: { label: 'Projects', kind: 'entries', title: 'Projects', column: 'main', labels: entryLabels('Project', 'Role / organisation') },
    volunteering: { label: 'Volunteering', kind: 'entries', title: 'Volunteering', column: 'main', labels: entryLabels('Role', 'Organisation') },
    publications: { label: 'Publications', kind: 'entries', title: 'Publications', column: 'main', labels: entryLabels('Title', 'Publisher') },
    skills: { label: 'Skills / Technologies', kind: 'skills', title: 'Technologies', column: 'side' },
    certifications: { label: 'Certifications', kind: 'list', title: 'Certifications', column: 'side' },
    achievements: { label: 'Achievements', kind: 'list', title: 'Achievements', column: 'side' },
    interests: { label: 'Interests', kind: 'list', title: 'Interests', column: 'side' },
    languages: { label: 'Languages', kind: 'levels', title: 'Languages', column: 'side' },
    text: { label: 'Custom text', kind: 'text', title: 'Custom Section', column: 'main' },
  };

  function newItem(type) {
    const kind = (SECTION_TYPES[type] || {}).kind;
    const id = uid();
    switch (kind) {
      case 'entries': return { id, title: '', org: '', orgLink: '', date: '', location: '', logo: '', text: '', bullets: [''] };
      case 'skills': return { id, name: 'Group', tags: ['Skill'] };
      case 'list': return { id, icon: type === 'certifications' ? 'award' : '', title: '', sub: '' };
      case 'levels': return { id, name: '', label: '', level: 4 };
      default: return { id, text: '' };
    }
  }
  function newSection(type) {
    const t = SECTION_TYPES[type] || SECTION_TYPES.text;
    return { id: uid(), type: SECTION_TYPES[type] ? type : 'text', title: t.title, column: t.column, items: [newItem(type)] };
  }

  /* ---------- default settings ---------- */
  function defaultSettings() {
    return {
      template: 'classic',
      layout: 'side-right', // single | side-right | side-left
      sidebarFilled: false,
      columnRatio: 62, // main column width, % of content width
      columnGap: 8, // mm
      pageSize: 'A4',
      margins: { top: 12, right: 13, bottom: 12, left: 13 }, // mm
      fontHeading: 'Inter', fontBody: 'Inter',
      fontSize: 9.4, lineHeight: 1.38, sectionGap: 5.5, entryGap: 2.6,
      colors: {
        accent: '#2b8aff', text: '#1d1d1f', heading: '#000000', muted: '#555555', bg: '#ffffff',
        sidebarBg: '#eef4ff', sideText: '#ffffff', sideAccent: '#9cc9ff',
        headerBg: '#2b8aff', headerText: '#ffffff', line: '#cfcfcf', chipBg: '#ffffff', chipBorder: '#c9c9c9',
      },
      pattern: { type: 'circles', area: 'header', color: '#2b8aff', opacity: 0.14, scale: 1 },
      header: {
        style: 'left', in: 'top', contactsIn: 'header', align: 'left',
        photoShape: 'circle', photoSize: 27, photoPos: 'right',
        nameSize: 26, nameCase: 'upper', titleSize: 11.5, titleColor: 'accent',
      },
      heading: { style: 'underline', case: 'upper', size: 11, weight: 700, spacing: 0.02 },
      entries: { dateStyle: 'icons', dividers: true, bulletStyle: 'disc', orgColor: 'accent', titleSize: 10.2 },
      skills: { style: 'chips' },
      levels: { style: 'dots' },
      contactIcons: true,
    };
  }

  const ENUMS = {
    layout: ['single', 'side-right', 'side-left'], pageSize: ['A4', 'Letter'],
    fontHeading: FONT_NAMES, fontBody: FONT_NAMES,
    'pattern.type': ['none', 'dots', 'grid', 'lines', 'diagonal', 'crosshatch', 'circles', 'waves', 'zigzag', 'triangles'],
    'pattern.area': ['header', 'page'],
    'header.style': ['left', 'center', 'banner'], 'header.in': ['top', 'main'], 'header.contactsIn': ['header', 'side'],
    'header.align': ['left', 'center', 'right'],
    'header.photoShape': ['circle', 'rounded', 'square', 'none'], 'header.photoPos': ['right', 'left'],
    'header.nameCase': ['upper', 'title'], 'header.titleColor': ['accent', 'text', 'muted'],
    'heading.style': ['underline', 'thin', 'short', 'bar', 'box', 'plain'], 'heading.case': ['upper', 'title'],
    'entries.dateStyle': ['icons', 'plain', 'right'], 'entries.bulletStyle': ['disc', 'dash', 'arrow', 'square', 'none'],
    'entries.orgColor': ['accent', 'text', 'muted'],
    'skills.style': ['chips', 'outline', 'plain', 'pipes'], 'levels.style': ['dots', 'bars', 'text'],
  };
  const RANGES = {
    columnRatio: [40, 80], columnGap: [2, 20], 'margins.top': [0, 40], 'margins.right': [0, 40], 'margins.bottom': [0, 40], 'margins.left': [0, 40],
    fontSize: [7, 14], lineHeight: [1.1, 2], sectionGap: [1, 16], entryGap: [0, 10],
    'pattern.opacity': [0, 0.6], 'pattern.scale': [0.4, 3],
    'header.photoSize': [14, 50], 'header.nameSize': [16, 48], 'header.titleSize': [8, 20],
    'heading.size': [8, 20], 'heading.weight': [400, 800], 'heading.spacing': [0, 0.2], 'entries.titleSize': [8, 16],
  };

  const num = (v, [lo, hi], d) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
  const str = (v, max = 400) => (typeof v === 'string' ? v.slice(0, max) : '');
  const HEX = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i;
  const IMG = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
  const img = (v, max) => (typeof v === 'string' && v.length <= max && IMG.test(v) ? v : '');

  function normSettings(src, def, path) {
    const out = {};
    src = isObj(src) ? src : {};
    for (const k of Object.keys(def)) {
      const p = path ? path + '.' + k : k;
      const d = def[k], v = src[k];
      if (isObj(d)) out[k] = normSettings(v, d, p);
      else if (typeof d === 'boolean') out[k] = typeof v === 'boolean' ? v : d;
      else if (typeof d === 'number') out[k] = RANGES[p] ? num(v, RANGES[p], d) : num(v, [-1e6, 1e6], d);
      else if (typeof d === 'string' && HEX.test(d)) out[k] = typeof v === 'string' && HEX.test(v) ? v : d;
      else if (ENUMS[p]) out[k] = ENUMS[p].includes(v) ? v : d;
      else out[k] = typeof v === 'string' ? v.slice(0, 60) : d;
    }
    return out;
  }

  /* ---------- document normalisation (used server side on every save) ---------- */
  const MAX = { sections: 30, items: 40, bullets: 30, tags: 60, contacts: 10 };
  function normItem(kind, type, it) {
    it = isObj(it) ? it : {};
    const id = str(it.id, 20) || uid();
    switch (kind) {
      case 'entries': return {
        id, title: str(it.title, 160), org: str(it.org, 160), orgLink: str(it.orgLink, 300), date: str(it.date, 60),
        location: str(it.location, 80), logo: img(it.logo, 120000), text: str(it.text, 3000),
        bullets: (Array.isArray(it.bullets) ? it.bullets : []).slice(0, MAX.bullets).map((b) => str(b, 1200)),
      };
      case 'skills': return {
        id, name: str(it.name, 80),
        tags: (Array.isArray(it.tags) ? it.tags : []).slice(0, MAX.tags).map((t) => str(t, 80)),
      };
      case 'list': return { id, icon: ICON_CHOICES.includes(it.icon) ? it.icon : '', title: str(it.title, 200), sub: str(it.sub, 200) };
      case 'levels': return { id, name: str(it.name, 80), label: str(it.label, 60), level: Math.round(num(it.level, [0, 5], 3)) };
      default: return { id, text: str(it.text, 6000) };
    }
  }

  function normalizeDoc(doc) {
    doc = isObj(doc) ? doc : {};
    const settings = normSettings(doc.settings, defaultSettings(), '');
    const h = isObj(doc.header) ? doc.header : {};
    const header = {
      name: str(h.name, 120), title: str(h.title, 160), tagline: str(h.tagline, 300), photo: img(h.photo, 600000),
      contacts: (Array.isArray(h.contacts) ? h.contacts : []).slice(0, MAX.contacts).map((c) => ({
        id: str(c && c.id, 20) || uid(), icon: CONTACT_ICONS.includes(c && c.icon) ? c.icon : 'link',
        text: str(c && c.text, 200), link: str(c && c.link, 300),
      })),
    };
    const sections = (Array.isArray(doc.sections) ? doc.sections : []).slice(0, MAX.sections).map((s) => {
      s = isObj(s) ? s : {};
      const type = SECTION_TYPES[s.type] ? s.type : 'text';
      const kind = SECTION_TYPES[type].kind;
      return {
        id: str(s.id, 20) || uid(), type, title: str(s.title, 80), column: s.column === 'side' ? 'side' : 'main',
        items: (Array.isArray(s.items) ? s.items : []).slice(0, MAX.items).map((it) => normItem(kind, type, it)),
      };
    });
    return { v: 1, settings, header, sections };
  }

  /* ---------- templates ---------- */
  const TEMPLATES = [
    { id: 'classic', name: 'Classic Duo', desc: 'Two columns, bold rules, skill chips.', side: ['skills', 'certifications', 'languages', 'achievements', 'interests'], patch: {} },
    {
      id: 'modern', name: 'Modern Sidebar', desc: 'Filled sidebar with contact and skills.', side: ['skills', 'certifications', 'languages', 'achievements', 'interests', 'education'],
      patch: {
        layout: 'side-left', sidebarFilled: true, columnRatio: 67, fontHeading: 'Montserrat', fontBody: 'Open Sans', fontSize: 9.2,
        colors: { accent: '#1f6feb', heading: '#14213d', sidebarBg: '#1f2a44', sideText: '#ffffff', sideAccent: '#8ec5ff', chipBorder: '#c3cde0', line: '#d5dbe6' },
        pattern: { type: 'dots', area: 'page', color: '#1f6feb', opacity: 0.05, scale: 1 },
        header: { in: 'main', contactsIn: 'side', photoShape: 'circle', photoSize: 34, nameCase: 'title', nameSize: 27 },
        heading: { style: 'short', case: 'upper', size: 10.5 }, entries: { dividers: false, dateStyle: 'plain' }, skills: { style: 'outline' },
      },
    },
    {
      id: 'executive', name: 'Executive Serif', desc: 'Single column, centered, refined serif.', side: [],
      patch: {
        layout: 'single', fontHeading: 'Playfair Display', fontBody: 'Lora', fontSize: 9.6, lineHeight: 1.42,
        colors: { accent: '#7b1e3a', heading: '#2a2a2a', muted: '#555555', line: '#bdbdbd' },
        pattern: { type: 'none' },
        header: { style: 'center', align: 'center', photoShape: 'circle', photoSize: 26, nameCase: 'title', nameSize: 30, titleSize: 12 },
        heading: { style: 'thin', case: 'upper', size: 10.5, weight: 700, spacing: 0.12 },
        entries: { dividers: false, dateStyle: 'right', bulletStyle: 'disc', orgColor: 'accent' }, skills: { style: 'pipes' },
      },
    },
    {
      id: 'banner', name: 'Bold Banner', desc: 'Color header banner with dot texture.', side: ['skills', 'certifications', 'languages', 'achievements', 'interests'],
      patch: {
        layout: 'side-right', columnRatio: 64, fontHeading: 'Poppins', fontBody: 'Source Sans 3', fontSize: 9.6,
        colors: { accent: '#0f766e', headerBg: '#0f766e', headerText: '#ffffff', heading: '#0b3b38' },
        pattern: { type: 'dots', area: 'header', color: '#ffffff', opacity: 0.22, scale: 1 },
        header: { style: 'banner', photoShape: 'rounded', photoSize: 30, nameCase: 'upper', nameSize: 25 },
        heading: { style: 'bar', case: 'upper', size: 10.5 }, entries: { dividers: true, dateStyle: 'icons' }, skills: { style: 'chips' },
      },
    },
    {
      id: 'minimal', name: 'Minimal Plain', desc: 'Pure typography, ATS friendly.', side: [],
      patch: {
        layout: 'single', fontHeading: 'IBM Plex Sans', fontBody: 'IBM Plex Sans', fontSize: 9.4,
        colors: { accent: '#111111', heading: '#111111', muted: '#5a5a5a', line: '#d4d4d4' },
        pattern: { type: 'none' },
        header: { style: 'left', photoShape: 'none', nameCase: 'title', nameSize: 24, titleColor: 'muted' },
        heading: { style: 'plain', case: 'upper', size: 9.6, spacing: 0.14 }, entries: { dividers: false, dateStyle: 'right', bulletStyle: 'dash', orgColor: 'text' },
        skills: { style: 'plain' }, contactIcons: false,
      },
    },
    {
      id: 'compact', name: 'Compact Pro', desc: 'Dense two-column for long careers.', side: ['skills', 'certifications', 'languages', 'achievements', 'interests', 'education'],
      patch: {
        layout: 'side-left', sidebarFilled: true, columnRatio: 70, columnGap: 6, fontHeading: 'Source Sans 3', fontBody: 'Source Sans 3', fontSize: 9, lineHeight: 1.3, sectionGap: 4.5,
        margins: { top: 10, right: 10, bottom: 10, left: 10 },
        colors: { accent: '#334155', heading: '#0f172a', sidebarBg: '#eef1f5', sideText: '#1e293b', sideAccent: '#334155', line: '#d3d9e2' },
        pattern: { type: 'none' },
        header: { in: 'main', contactsIn: 'side', photoShape: 'rounded', photoSize: 30, nameCase: 'upper', nameSize: 23 },
        heading: { style: 'underline', case: 'upper', size: 10 }, entries: { dividers: false, dateStyle: 'plain' }, skills: { style: 'chips' },
      },
    },
    {
      id: 'creative', name: 'Creative Teal', desc: 'Deep teal sidebar with subtle texture.', side: ['skills', 'certifications', 'languages', 'achievements', 'interests'],
      patch: {
        layout: 'side-left', sidebarFilled: true, columnRatio: 66, fontHeading: 'Raleway', fontBody: 'Lato', fontSize: 9.5,
        colors: { accent: '#0d9488', heading: '#0f3d3e', sidebarBg: '#0f3d3e', sideText: '#e6fffb', sideAccent: '#5eead4', line: '#cfe3e1' },
        pattern: { type: 'diagonal', area: 'page', color: '#0d9488', opacity: 0.07, scale: 1 },
        header: { in: 'main', contactsIn: 'side', photoShape: 'rounded', photoSize: 36, nameCase: 'title', nameSize: 28 },
        heading: { style: 'underline', case: 'upper', size: 10.5, weight: 800 }, entries: { dividers: false, dateStyle: 'icons' }, skills: { style: 'outline' }, levels: { style: 'bars' },
      },
    },
    {
      id: 'elegant', name: 'Elegant Rose', desc: 'Soft single column with a photo.', side: [],
      patch: {
        layout: 'single', fontHeading: 'Playfair Display', fontBody: 'Nunito', fontSize: 9.6,
        colors: { accent: '#be185d', heading: '#4a044e', muted: '#6b5b6e', line: '#f0cfe0', chipBorder: '#f0b8d2', chipBg: '#fff5fa' },
        pattern: { type: 'circles', area: 'page', color: '#be185d', opacity: 0.08, scale: 1.3 },
        header: { style: 'left', photoShape: 'circle', photoPos: 'left', photoSize: 28, nameCase: 'title', nameSize: 28 },
        heading: { style: 'short', case: 'title', size: 12.5 }, entries: { dividers: false, dateStyle: 'icons' }, skills: { style: 'outline' },
      },
    },
    {
      id: 'midnight', name: 'Midnight Dark', desc: 'Dark mode resume with a filled sidebar.', side: ['skills', 'certifications', 'languages', 'achievements', 'interests', 'education'],
      patch: {
        layout: 'side-left', sidebarFilled: true, columnRatio: 67, fontHeading: 'Space Grotesk', fontBody: 'Inter', fontSize: 9.2,
        colors: THEME('midnight'),
        pattern: { type: 'grid', area: 'page', color: '#38bdf8', opacity: 0.06, scale: 1 },
        header: { in: 'main', contactsIn: 'side', photoShape: 'circle', photoSize: 34, nameCase: 'title', nameSize: 28 },
        heading: { style: 'short', case: 'upper', size: 10.5 }, entries: { dividers: false, dateStyle: 'plain' }, skills: { style: 'outline' },
      },
    },
    {
      id: 'noir', name: 'Charcoal Gold', desc: 'Dark single page with a gold accent.', side: ['skills', 'certifications', 'languages', 'achievements', 'interests'],
      patch: {
        layout: 'side-right', columnRatio: 64, fontHeading: 'Playfair Display', fontBody: 'Lato', fontSize: 9.5,
        colors: THEME('charcoal'),
        pattern: { type: 'circles', area: 'header', color: '#f5b942', opacity: 0.14, scale: 1 },
        header: { style: 'left', photoShape: 'rounded', photoSize: 28, nameCase: 'title', nameSize: 28, titleColor: 'accent' },
        heading: { style: 'thin', case: 'upper', size: 10.5, weight: 700, spacing: 0.1 }, entries: { dividers: true, dateStyle: 'icons' }, skills: { style: 'chips' },
      },
    },
  ];

  function applyTemplate(doc, id) {
    const t = TEMPLATES.find((x) => x.id === id) || TEMPLATES[0];
    const keep = { pageSize: doc.settings.pageSize };
    const settings = deepMerge(defaultSettings(), t.patch);
    settings.template = t.id;
    Object.assign(settings, keep);
    const next = clone(doc);
    next.settings = settings;
    if (settings.layout !== 'single') {
      next.sections.forEach((s) => { s.column = t.side.includes(s.type) ? 'side' : 'main'; });
    }
    return next;
  }

  function applyPalette(settings, paletteId) {
    const p = PALETTES.find((x) => x.id === paletteId);
    if (!p) return settings;
    const s = clone(settings);
    s.colors.accent = p.accent;
    s.colors.headerBg = p.accent;
    s.pattern.color = s.header.style === 'banner' ? '#ffffff' : p.accent;
    s.colors.sideAccent = s.sidebarFilled && luminance(s.colors.sidebarBg) < 0.4 ? mix(p.accent, '#ffffff', 0.55) : p.accent;
    if (s.sidebarFilled) {
      const dark = luminance(s.colors.sidebarBg) < 0.4;
      s.colors.sidebarBg = dark ? mix(p.accent, '#000000', 0.62) : mix(p.accent, '#ffffff', 0.92);
    }
    return s;
  }

  function applyColorTheme(settings, id) {
    const t = THEMES.find((x) => x.id === id);
    if (!t) return settings;
    const s = clone(settings);
    Object.assign(s.colors, t.colors);
    s.pattern.color = s.header.style === 'banner' ? '#ffffff' : t.colors.accent;
    return s;
  }

  /* ---------- sample content ---------- */
  function sampleDoc(templateId) {
    const mk = (type, items, title) => { const s = newSection(type); s.items = items.map((i) => Object.assign(newItem(type), i)); if (title) s.title = title; return s; };
    const base = {
      v: 1, settings: defaultSettings(),
      header: {
        name: 'Alex Rivera', title: 'Senior Product Designer', tagline: 'Design systems | Accessibility | Data-informed craft', photo: '',
        contacts: [
          { id: uid(), icon: 'phone', text: '555-010-2030', link: '' },
          { id: uid(), icon: 'mail', text: 'alex.rivera@example.com', link: '' },
          { id: uid(), icon: 'linkedin', text: 'linkedin.com/in/alexrivera', link: 'https://linkedin.com/in/alexrivera' },
          { id: uid(), icon: 'pin', text: 'Chicago, IL', link: '' },
        ],
      },
      sections: [
        mk('summary', [{ text: 'Product designer with **9 years** of experience shipping accessible, scalable interfaces for B2B platforms. Comfortable owning discovery through delivery and mentoring teams of designers.' }]),
        mk('experience', [
          {
            title: 'Senior Product Designer', org: 'Northwind Labs', orgLink: '', date: '03/2021 - Present', location: 'Chicago, IL',
            text: 'Lead designer for the analytics platform used by 40K+ monthly active users.',
            bullets: ['Built and maintained a design system of 120+ components adopted by 6 product teams, cutting UI build time by 35%', 'Ran 60+ moderated usability studies; redesigned onboarding and lifted activation from 41% to 63%', 'Partnered with engineering on WCAG 2.2 AA conformance across the web application', 'Mentored 4 designers and introduced a weekly critique ritual'],
          },
          {
            title: 'Product Designer', org: 'Brightside Health', orgLink: '', date: '06/2017 - 02/2021', location: 'Milwaukee, WI',
            text: 'Designed patient and clinician experiences for a telehealth startup.',
            bullets: ['Shipped a scheduling flow that reduced no-shows by 22%', 'Created a prototype library used in 100+ stakeholder demos', 'Worked closely with compliance to keep designs HIPAA friendly'],
          },
        ]),
        mk('education', [{ title: 'BFA in Interaction Design', org: 'School of the Art Institute', date: '09/2013 - 05/2017', location: 'Chicago, IL', text: 'Minor in Computer Science', bullets: ['Human-Computer Interaction | Typography | Prototyping'] }]),
        mk('skills', [
          { name: 'Design', tags: ['Figma', 'Design Systems', 'Prototyping', 'User Research'] },
          { name: 'Front-end', tags: ['HTML', 'CSS', 'React', 'Storybook'] },
          { name: 'Process', tags: ['Agile', 'Workshops', 'Roadmapping'] },
        ]),
        mk('certifications', [
          { icon: 'award', title: 'NN/g UX Certification', sub: '' },
          { icon: 'shield', title: 'IAAP Web Accessibility Specialist', sub: '' },
          { icon: 'cloud', title: 'AWS Certified Cloud Practitioner', sub: '' },
        ]),
        mk('languages', [{ name: 'English', label: 'Native', level: 5 }, { name: 'Spanish', label: 'Professional', level: 4 }]),
      ],
    };
    return templateId ? applyTemplate(base, templateId) : base;
  }

  function blankDoc(templateId) {
    const d = sampleDoc(templateId);
    d.header = { name: 'Your Name', title: 'Your Title', tagline: '', photo: '', contacts: [{ id: uid(), icon: 'mail', text: 'you@example.com', link: '' }, { id: uid(), icon: 'phone', text: '555-000-0000', link: '' }] };
    d.sections = ['summary', 'experience', 'education', 'skills'].map((t) => {
      const s = newSection(t); if (t === 'skills') s.items = [Object.assign(newItem('skills'), { name: 'Group', tags: ['Skill', 'Skill'] })]; return s;
    });
    return templateId ? applyTemplate(d, templateId) : d;
  }

  const PAGE_MM = { A4: [210, 297], Letter: [215.9, 279.4] };

  return {
    FONTS, PALETTES, THEMES, TEMPLATES, SECTION_TYPES, ICON_CHOICES, CONTACT_ICONS, PAGE_MM, ENUMS,
    defaultSettings, normalizeDoc, newSection, newItem, applyTemplate, applyPalette, applyColorTheme, sampleDoc, blankDoc,
    deepMerge, clone, uid, mix, luminance,
  };
});
