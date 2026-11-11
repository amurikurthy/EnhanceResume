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
    { id: 'slate', vibe: 'neutral', style: 'modern', name: 'Slate', accent: '#475569' },
    { id: 'mono', name: 'Mono', accent: '#111111' },
  ];

  /* ---------- full colour themes (light & dark) ---------- */
  const THEMES = [
    { id: 'midnight', vibe: 'masculine', style: 'modern', name: 'Midnight', dark: true, colors: { accent: '#38bdf8', text: '#e2e8f0', heading: '#ffffff', muted: '#94a3b8', bg: '#0f172a', sidebarBg: '#17223b', sideText: '#e2e8f0', sideAccent: '#7dd3fc', headerBg: '#1e3a5f', headerText: '#ffffff', line: '#2b3a55', chipBg: '#16213a', chipBorder: '#33425f' } },
    { id: 'charcoal', name: 'Charcoal', dark: true, colors: { accent: '#f5b942', text: '#e5e5e7', heading: '#ffffff', muted: '#a1a1a6', bg: '#1c1c1e', sidebarBg: '#262629', sideText: '#e5e5e7', sideAccent: '#f5b942', headerBg: '#2c2c2e', headerText: '#ffffff', line: '#3a3a3d', chipBg: '#262629', chipBorder: '#46464a' } },
    { id: 'forest', name: 'Forest', dark: true, colors: { accent: '#34d399', text: '#dcefe6', heading: '#ffffff', muted: '#8fb3a3', bg: '#0e1a16', sidebarBg: '#14261f', sideText: '#dcefe6', sideAccent: '#6ee7b7', headerBg: '#0f3d2e', headerText: '#ffffff', line: '#25443a', chipBg: '#13241d', chipBorder: '#2d5244' } },
    { id: 'plum', name: 'Plum', dark: true, colors: { accent: '#c084fc', text: '#eadcf5', heading: '#ffffff', muted: '#b39cc9', bg: '#1a1024', sidebarBg: '#251536', sideText: '#eadcf5', sideAccent: '#d8b4fe', headerBg: '#3b1d5a', headerText: '#ffffff', line: '#3a2552', chipBg: '#221330', chipBorder: '#4a2f68' } },
    { id: 'paper', name: 'Paper', dark: false, colors: { accent: '#b45309', text: '#2d2a26', heading: '#1c1917', muted: '#6b645b', bg: '#fbf7ef', sidebarBg: '#f1e9d8', sideText: '#2d2a26', sideAccent: '#b45309', headerBg: '#b45309', headerText: '#ffffff', line: '#ddd2bd', chipBg: '#fffaf0', chipBorder: '#d6c9ad' } },
    { id: 'mist', name: 'Mist', dark: false, colors: { accent: '#4f46e5', text: '#1e293b', heading: '#0f172a', muted: '#64748b', bg: '#f8fafc', sidebarBg: '#e8edf7', sideText: '#1e293b', sideAccent: '#4f46e5', headerBg: '#4f46e5', headerText: '#ffffff', line: '#d5dce8', chipBg: '#ffffff', chipBorder: '#c9d2e3' } },
  ];
  const THEME = (id) => THEMES.find((t) => t.id === id).colors;

  /* ---------- section types ---------- */
  const ICON_CHOICES = ['', 'award', 'shield', 'key', 'code', 'cloud', 'network', 'server', 'book', 'cap', 'briefcase',
    'star', 'check', 'terminal', 'cpu', 'database', 'wifi', 'lock', 'flag', 'zap', 'tool', 'trend', 'layers', 'target', 'heart', 'globe', 'monitor',
    'users', 'thumb', 'megaphone', 'pen', 'smile', 'coffee', 'compass', 'bookmark', 'home', 'camera', 'music', 'linkedin', 'github', 'mail', 'phone', 'pin', 'calendar', 'user',
    'trophy', 'medal', 'badge', 'badgecheck', 'shieldcheck', 'filecheck', 'clipboard', 'lightbulb', 'rocket', 'crown', 'gem', 'router', 'activity', 'chart', 'package', 'branch', 'search', 'flask', 'dollar', 'harddrive', 'infinity'];
  const CONTACT_ICONS = ['phone', 'mail', 'link', 'linkedin', 'github', 'globe', 'pin', 'star', 'calendar', 'user'];

  const entryLabels = (title, org) => ({ title, org });
  const SECTION_TYPES = {
    summary: { label: 'Summary', kind: 'text', title: 'Summary', column: 'main' },
    custom: { label: 'Custom', kind: 'entries', title: 'Custom Section', column: 'main', labels: entryLabels('Title', 'Subtitle') },
    languages: { label: 'Languages', kind: 'levels', title: 'Languages', column: 'side' },
    training: { label: 'Training / Courses', kind: 'entries', title: 'Training / Courses', column: 'main', labels: entryLabels('Course', 'Provider') },
    projects: { label: 'Projects', kind: 'entries', title: 'Projects', column: 'main', labels: entryLabels('Project', 'Role / organisation') },
    achievements: { label: 'Key Achievements', kind: 'list', title: 'Key Achievements', column: 'side' },
    volunteering: { label: 'Volunteering', kind: 'entries', title: 'Volunteering', column: 'main', labels: entryLabels('Role', 'Organisation') },
    expertise: { label: 'Industry Expertise', kind: 'levels', title: 'Industry Expertise', column: 'side' },
    interests: { label: 'Interests', kind: 'list', title: 'Interests', column: 'side' },
    findOnline: { label: 'Find me online', kind: 'list', title: 'Find Me Online', column: 'side' },
    certifications: { label: 'Certifications', kind: 'list', title: 'Certifications', column: 'side' },
    awards: { label: 'Awards', kind: 'list', title: 'Awards', column: 'side' },
    references: { label: 'References', kind: 'list', title: 'References', column: 'main' },
    philosophy: { label: 'My Life Philosophy', kind: 'text', title: 'My Life Philosophy', column: 'main' },
    publications: { label: 'Publications', kind: 'entries', title: 'Publications', column: 'main', labels: entryLabels('Title', 'Publisher') },
    additionalExperience: { label: 'Additional Experience', kind: 'entries', title: 'Additional Experience', column: 'main', labels: entryLabels('Job title', 'Company') },
    additionalSkills: { label: 'Additional Skills', kind: 'skills', title: 'Additional Skills', column: 'side' },
    additionalPublications: { label: 'Additional Publications', kind: 'entries', title: 'Additional Publications', column: 'main', labels: entryLabels('Title', 'Publisher') },
    strengths: { label: 'Strengths', kind: 'list', title: 'Strengths', column: 'side' },
    experience: { label: 'Experience', kind: 'entries', title: 'Experience', column: 'main', labels: entryLabels('Job title', 'Company') },
    education: { label: 'Education', kind: 'entries', title: 'Education', column: 'main', labels: entryLabels('Degree', 'School') },
    skills: { label: 'Skills / Technologies', kind: 'skills', title: 'Technologies', column: 'side' },
    text: { label: 'Custom text', kind: 'text', title: 'Custom Text', column: 'main' },
  };

  /* realistic starter content, used by the "add section" gallery and when a section is added */
  const E = (o) => Object.assign({ title: '', org: '', orgLink: '', date: '', location: '', logo: '', icon: '', text: '', bullets: [] }, o);
  const SAMPLES = {
    summary: () => [{ text: 'Motivated professional with a record of delivering measurable results. Quick to learn, comfortable owning projects end to end.' }],
    custom: () => [E({ title: 'Inspired & Challenged', icon: 'star', date: '10/2014 - 06/2015', text: 'More than 1 million children to love science, nature and engineering through #ScienceForAll' }), E({ title: 'Another highlight', icon: 'zap', date: '2016', text: 'Describe what you did and why it mattered.' })],
    languages: () => [{ name: 'English', label: 'Proficient', level: 5 }, { name: 'Spanish', label: 'Advanced', level: 3 }],
    training: () => [E({ title: 'Creative Writing', text: 'An intensive 4 week course for developing creative writing skills' }), E({ title: 'Introduction to Photoshop', text: 'Basics of web design using the Adobe Photoshop application' })],
    projects: () => [E({ title: 'Tesla Model S for Kids', date: '11/2015 - 04/2016', bullets: ['Collaboration between Radio Flyer and Tesla to design a kid-friendly Model S car', 'Shot the demo video and photography for the website'] })],
    achievements: () => [{ icon: 'zap', title: 'Inspired & Challenged', sub: 'More than 1 million children to love science, nature and engineering' }, { icon: 'megaphone', title: 'Developed Strong Brand', sub: 'Identity across all channels and touch points' }],
    volunteering: () => [E({ title: 'Executive Member', org: 'AIESEC', date: '09/2014 - Present', text: 'An international non-governmental not-for-profit organization run by youth, providing leadership development and global internships.' })],
    expertise: () => [{ name: 'Leadership', label: '', level: 4 }, { name: 'Management', label: '', level: 3 }],
    interests: () => [{ icon: 'heart', title: 'TEDxBoston', sub: 'Recruited all speakers in last 3 years, attracted 70% of sponsors' }, { icon: 'coffee', title: 'My espresso', sub: 'Got certified after Blue Bottle’s barista 3-month training' }],
    findOnline: () => [{ icon: 'linkedin', title: 'LinkedIn', sub: 'username' }, { icon: 'github', title: 'GitHub', sub: 'username' }],
    certifications: () => [{ icon: 'award', title: 'Google Analytics Individual Qualification', sub: 'Google' }, { icon: 'award', title: 'Contextual Marketing', sub: 'HubSpot Academy' }],
    awards: () => [{ icon: 'award', title: 'Dean’s List', sub: 'Cornell School of Engineering' }, { icon: 'globe', title: 'Valedictorian', sub: 'South Boston High School' }],
    references: () => [{ icon: '', title: 'Thomas Brown', sub: 'thomas.brown@example.com · 1-503-254-1000' }, { icon: '', title: 'John Silver', sub: 'jj.silva@example.com · 1-503-254-2000' }],
    philosophy: () => [{ text: '*First they ignore you, then they laugh at you, then they fight you, then you win.*\n— Mahatma Gandhi' }],
    publications: () => [E({ title: 'Dublin 101', org: 'Dublin Globe', orgLink: '', date: '2023', text: 'An intro to the startup ecosystem of Dublin' })],
    additionalExperience: () => [E({ title: 'Deputy Finance Director', org: 'City of New York', date: '2013 - 2014', location: 'New York, NY', bullets: ['Oversaw financial analysis of 70 buildings under the mayor’s economic plan', 'Anchored 6-person team with origination of $3 billion in municipal bonds'] })],
    additionalSkills: () => [{ name: 'Frontend', tags: ['ReactJS', 'MongoDB', 'Redis', 'TypeScript', 'Webpack', 'Node.js'] }],
    additionalPublications: () => [E({ title: 'Dublin 101', org: 'Dublin Globe', date: '2023', text: 'An intro to the startup ecosystem of Dublin' })],
    strengths: () => [{ icon: 'trend', title: 'Go-getter', sub: '20+ recognitions have taught me that with persistence, one can achieve anything.' }],
    experience: () => [E({ title: 'Job Title', org: 'Company', date: '01/2021 - Present', location: 'City, ST', bullets: ['Achievement with measurable impact', 'Another responsibility or result'] })],
    education: () => [E({ title: 'Degree', org: 'University', date: '2015 - 2019', location: 'City, ST' })],
    skills: () => [{ name: 'Frontend', tags: ['React', 'TypeScript', 'CSS'] }, { name: 'Backend', tags: ['Node.js', 'SQL'] }],
    text: () => [{ text: 'Write anything here. Use **bold**, *italic*, links, or start lines with "- " for bullets.' }],
  };

  function newItem(type) {
    const kind = (SECTION_TYPES[type] || {}).kind;
    const id = uid();
    switch (kind) {
      case 'entries': return { id, title: '', org: '', orgLink: '', date: '', location: '', logo: '', icon: '', text: '', bullets: [''] };
      case 'skills': return { id, name: 'Group', tags: ['Skill'] };
      case 'list': return { id, icon: type === 'certifications' ? 'award' : '', title: '', sub: '' };
      case 'levels': return { id, name: '', label: '', level: 4 };
      default: return { id, text: '' };
    }
  }
  /* a new section; with blank:true it starts empty, otherwise with editable sample content */
  function newSection(type, o = {}) {
    const real = SECTION_TYPES[type] ? type : 'text';
    const t = SECTION_TYPES[real];
    const items = !o.blank && SAMPLES[real] ? SAMPLES[real]().map((x) => Object.assign(newItem(real), clone(x), { id: uid() })) : [newItem(real)];
    if (t.kind === 'entries') items.forEach((it) => { if (!Array.isArray(it.bullets)) it.bullets = []; });
    return { id: uid(), type: real, title: t.title, icon: '', column: t.column, items };
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
      pattern: { type: 'circles', area: 'header', color: '#2b8aff', opacity: 0.14, scale: 1, corner: 'tr' },
      header: {
        style: 'left', in: 'top', contactsIn: 'header', align: 'left',
        photoShape: 'circle', photoSize: 27, photoPos: 'right',
        nameSize: 26, nameCase: 'upper', titleSize: 11.5, titleColor: 'accent',
      },
      heading: { style: 'underline', case: 'upper', size: 11, weight: 700, spacing: 0.02, icons: true },
      entries: { dateStyle: 'icons', dividers: true, bulletStyle: 'disc', orgColor: 'accent', titleSize: 10.2 },
      skills: { style: 'chips', fill: true },
      levels: { style: 'dots' },
      contactIcons: true,
    };
  }

  const ENUMS = {
    layout: ['single', 'side-right', 'side-left'], pageSize: ['A4', 'Letter'],
    fontHeading: FONT_NAMES, fontBody: FONT_NAMES,
    'pattern.type': ['none', 'dots', 'grid', 'lines', 'diagonal', 'crosshatch', 'circles', 'waves', 'zigzag', 'triangles', 'circuit', 'network', 'arcs', 'traces', 'contour', 'nodemap', 'dotfade', 'linefade', 'floral', 'blossoms', 'swirl', 'scallop', 'wash', 'lace', 'blueprint', 'hex', 'chevrons', 'angular', 'compass', 'ridge', 'henna'],
    'pattern.corner': ['tr', 'tl', 'br', 'bl'],
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

  const iconOk = (v) => (typeof v === 'string' && (v === '' || /^(brand:)?[a-z0-9][a-z0-9-]{0,60}$/.test(v)) ? v : '');
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
        location: str(it.location, 80), logo: img(it.logo, 120000), icon: iconOk(it.icon), text: str(it.text, 3000),
        bullets: (Array.isArray(it.bullets) ? it.bullets : []).slice(0, MAX.bullets).map((b) => str(b, 1200)),
      };
      case 'skills': return {
        id, name: str(it.name, 80),
        tags: (Array.isArray(it.tags) ? it.tags : []).slice(0, MAX.tags).map((t) => str(t, 80)),
      };
      case 'list': return { id, icon: iconOk(it.icon), title: str(it.title, 200), sub: str(it.sub, 200) };
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
      photoMode: ['profile', 'custom', 'none'].includes(h.photoMode) ? h.photoMode : (img(h.photo, 600000) ? 'custom' : 'profile'),
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
        id: str(s.id, 20) || uid(), type, title: str(s.title, 80), icon: iconOk(s.icon), column: s.column === 'side' ? 'side' : 'main',
        items: (Array.isArray(s.items) ? s.items : []).slice(0, MAX.items).map((it) => normItem(kind, type, it)),
      };
    });
    return { v: 1, settings, header, sections };
  }

  /* ---------- templates ---------- */
  const TEMPLATES = [
    { id: 'classic', vibe: 'neutral', style: 'classic', name: 'Classic Duo', desc: 'Two columns, bold rules, skill chips.', side: ['skills', 'certifications', 'languages', 'achievements', 'interests'], patch: {} },
    {
      id: 'modern', vibe: 'masculine', style: 'modern', name: 'Modern Sidebar', desc: 'Filled sidebar with contact and skills.', side: ['skills', 'certifications', 'languages', 'achievements', 'interests', 'education'],
      patch: {
        layout: 'side-left', sidebarFilled: true, columnRatio: 67, fontHeading: 'Montserrat', fontBody: 'Open Sans', fontSize: 9.2,
        colors: { accent: '#1f6feb', heading: '#14213d', sidebarBg: '#1f2a44', sideText: '#ffffff', sideAccent: '#8ec5ff', chipBorder: '#c3cde0', line: '#d5dbe6' },
        pattern: { type: 'dots', area: 'page', color: '#1f6feb', opacity: 0.05, scale: 1 },
        header: { in: 'main', contactsIn: 'side', photoShape: 'circle', photoSize: 34, nameCase: 'title', nameSize: 27 },
        heading: { style: 'short', case: 'upper', size: 10.5 }, entries: { dividers: false, dateStyle: 'plain' }, skills: { style: 'outline' },
      },
    },
    {
      id: 'executive', vibe: 'neutral', style: 'classic', name: 'Executive Serif', desc: 'Single column, centered, refined serif.', side: [],
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
      id: 'banner', vibe: 'neutral', style: 'bold', name: 'Bold Banner', desc: 'Color header banner with dot texture.', side: ['skills', 'certifications', 'languages', 'achievements', 'interests'],
      patch: {
        layout: 'side-right', columnRatio: 64, fontHeading: 'Poppins', fontBody: 'Source Sans 3', fontSize: 9.6,
        colors: { accent: '#0f766e', headerBg: '#0f766e', headerText: '#ffffff', heading: '#0b3b38' },
        pattern: { type: 'dots', area: 'header', color: '#ffffff', opacity: 0.22, scale: 1 },
        header: { style: 'banner', photoShape: 'rounded', photoSize: 30, nameCase: 'upper', nameSize: 25 },
        heading: { style: 'bar', case: 'upper', size: 10.5 }, entries: { dividers: true, dateStyle: 'icons' }, skills: { style: 'chips' },
      },
    },
    {
      id: 'minimal', vibe: 'neutral', style: 'minimal', name: 'Minimal Plain', desc: 'Pure typography, ATS friendly.', side: [],
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
      id: 'compact', vibe: 'neutral', style: 'modern', name: 'Compact Pro', desc: 'Dense two-column for long careers.', side: ['skills', 'certifications', 'languages', 'achievements', 'interests', 'education'],
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
      id: 'creative', vibe: 'neutral', style: 'creative', name: 'Creative Teal', desc: 'Deep teal sidebar with subtle texture.', side: ['skills', 'certifications', 'languages', 'achievements', 'interests'],
      patch: {
        layout: 'side-left', sidebarFilled: true, columnRatio: 66, fontHeading: 'Raleway', fontBody: 'Lato', fontSize: 9.5,
        colors: { accent: '#0d9488', heading: '#0f3d3e', sidebarBg: '#0f3d3e', sideText: '#e6fffb', sideAccent: '#5eead4', line: '#cfe3e1' },
        pattern: { type: 'diagonal', area: 'page', color: '#0d9488', opacity: 0.07, scale: 1 },
        header: { in: 'main', contactsIn: 'side', photoShape: 'rounded', photoSize: 36, nameCase: 'title', nameSize: 28 },
        heading: { style: 'underline', case: 'upper', size: 10.5, weight: 800 }, entries: { dividers: false, dateStyle: 'icons' }, skills: { style: 'outline' }, levels: { style: 'bars' },
      },
    },
    {
      id: 'elegant', vibe: 'feminine', style: 'elegant', name: 'Elegant Rose', desc: 'Soft single column with a photo.', side: [],
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
      id: 'noir', vibe: 'masculine', style: 'elegant', name: 'Charcoal Gold', desc: 'Dark single page with a gold accent.', side: ['skills', 'certifications', 'languages', 'achievements', 'interests'],
      patch: {
        layout: 'side-right', columnRatio: 64, fontHeading: 'Playfair Display', fontBody: 'Lato', fontSize: 9.5,
        colors: THEME('charcoal'),
        pattern: { type: 'circles', area: 'header', color: '#f5b942', opacity: 0.14, scale: 1 },
        header: { style: 'left', photoShape: 'rounded', photoSize: 28, nameCase: 'title', nameSize: 28, titleColor: 'accent' },
        heading: { style: 'thin', case: 'upper', size: 10.5, weight: 700, spacing: 0.1 }, entries: { dividers: true, dateStyle: 'icons' }, skills: { style: 'chips' },
      },
    },
    {
      id: 'circuit', vibe: 'masculine', style: 'creative', name: 'Circuit Board', desc: 'Dark and monospaced with PCB traces.', side: ['skills', 'certifications', 'languages', 'achievements', 'interests', 'education', 'additionalSkills'],
      patch: {
        layout: 'side-left', sidebarFilled: true, columnRatio: 68, fontHeading: 'IBM Plex Mono', fontBody: 'IBM Plex Sans', fontSize: 9.2,
        colors: Object.assign({}, THEME('forest'), { accent: '#22d3a0', sideAccent: '#22d3a0', bg: '#0b1511', sidebarBg: '#10201a' }),
        pattern: { type: 'circuit', area: 'page', color: '#22d3a0', opacity: 0.1, scale: 1 },
        header: { in: 'main', contactsIn: 'side', photoShape: 'rounded', photoSize: 32, nameCase: 'upper', nameSize: 23 },
        heading: { style: 'bar', case: 'upper', size: 10, weight: 700 }, entries: { dividers: false, dateStyle: 'plain', bulletStyle: 'arrow' }, skills: { style: 'chips' },
      },
    },
    {
      id: 'netops', vibe: 'masculine', style: 'modern', name: 'Network Ops', desc: 'Clean two-column with a network-map header.', side: ['skills', 'certifications', 'languages', 'achievements', 'interests', 'additionalSkills'],
      patch: {
        layout: 'side-right', columnRatio: 65, fontHeading: 'Manrope', fontBody: 'Inter', fontSize: 9.3,
        colors: { accent: '#0e7490', heading: '#0b2f3a', headerBg: '#0e7490', chipBorder: '#b9d6de' },
        pattern: { type: 'network', area: 'header', color: '#0e7490', opacity: 0.22, scale: 1.2 },
        header: { style: 'left', photoShape: 'circle', photoSize: 28, nameCase: 'title', nameSize: 27 },
        heading: { style: 'underline', case: 'upper', size: 10.5, weight: 800 }, entries: { dividers: true, dateStyle: 'icons' }, skills: { style: 'chips' },
      },
    },
    {
      id: 'academic', vibe: 'neutral', style: 'classic', name: 'Academic CV', desc: 'Traditional single column serif.', side: [],
      patch: {
        layout: 'single', fontHeading: 'EB Garamond', fontBody: 'EB Garamond', fontSize: 10.4, lineHeight: 1.36,
        colors: { accent: '#1f3a5f', heading: '#111111', muted: '#555555', line: '#c9c9c9' },
        pattern: { type: 'none' },
        header: { style: 'center', align: 'center', photoShape: 'none', nameCase: 'title', nameSize: 28, titleSize: 12, titleColor: 'muted' },
        heading: { style: 'thin', case: 'upper', size: 11.5, weight: 600, spacing: 0.1 }, entries: { dividers: false, dateStyle: 'right', bulletStyle: 'disc', orgColor: 'text' }, skills: { style: 'plain' }, contactIcons: false,
      },
    },
    {
      id: 'sunset', vibe: 'neutral', style: 'bold', name: 'Sunset Bold', desc: 'Warm banner with boxed headings.', side: ['skills', 'certifications', 'languages', 'achievements', 'interests', 'additionalSkills'],
      patch: {
        layout: 'side-right', columnRatio: 64, fontHeading: 'Poppins', fontBody: 'Nunito', fontSize: 9.6,
        colors: { accent: '#ea580c', headerBg: '#ea580c', headerText: '#ffffff', heading: '#431407', chipBorder: '#f6c9ad', chipBg: '#fff7f2' },
        pattern: { type: 'waves', area: 'header', color: '#ffffff', opacity: 0.3, scale: 1 },
        header: { style: 'banner', photoShape: 'circle', photoSize: 30, nameCase: 'upper', nameSize: 25 },
        heading: { style: 'box', case: 'upper', size: 10, weight: 700 }, entries: { dividers: false, dateStyle: 'icons' }, skills: { style: 'chips' },
      },
    },
    {
      id: 'slate', name: 'Slate Modern', desc: 'Narrow left column, calm slate tones.', side: ['skills', 'certifications', 'languages', 'achievements', 'interests', 'additionalSkills'],
      patch: {
        layout: 'side-left', columnRatio: 70, columnGap: 7, fontHeading: 'Manrope', fontBody: 'Manrope', fontSize: 9.2,
        colors: { accent: '#475569', heading: '#0f172a', muted: '#64748b', line: '#d5dbe4', chipBorder: '#cbd5e1' },
        pattern: { type: 'none' },
        header: { style: 'left', photoShape: 'rounded', photoSize: 26, nameCase: 'title', nameSize: 26 },
        heading: { style: 'short', case: 'upper', size: 10, weight: 800, spacing: 0.06 }, entries: { dividers: false, dateStyle: 'plain' }, skills: { style: 'outline' },
      },
    },
    {
      id: 'forestdark', vibe: 'masculine', style: 'classic', name: 'Forest Dark', desc: 'Dark single column with a serif touch.', side: [],
      patch: {
        layout: 'single', fontHeading: 'Lora', fontBody: 'Source Sans 3', fontSize: 9.8,
        colors: THEME('forest'),
        pattern: { type: 'network', area: 'header', color: '#34d399', opacity: 0.16, scale: 1.3 },
        header: { style: 'left', photoShape: 'circle', photoSize: 28, nameCase: 'title', nameSize: 28 },
        heading: { style: 'thin', case: 'upper', size: 10.5, weight: 700, spacing: 0.1 }, entries: { dividers: false, dateStyle: 'right', bulletStyle: 'dash' }, skills: { style: 'pipes' },
      },
    },
    {
      id: 'plumpro', vibe: 'feminine', style: 'bold', name: 'Plum Pro', desc: 'Dark plum with a banner header.', side: ['skills', 'certifications', 'languages', 'achievements', 'interests', 'additionalSkills'],
      patch: {
        layout: 'side-right', columnRatio: 64, fontHeading: 'Raleway', fontBody: 'Lato', fontSize: 9.5,
        colors: THEME('plum'),
        pattern: { type: 'zigzag', area: 'header', color: '#d8b4fe', opacity: 0.25, scale: 1 },
        header: { style: 'banner', photoShape: 'rounded', photoSize: 30, nameCase: 'upper', nameSize: 24 },
        heading: { style: 'bar', case: 'upper', size: 10.5, weight: 800 }, entries: { dividers: true, dateStyle: 'icons' }, skills: { style: 'chips' },
      },
    },
    {
      id: 'ink', vibe: 'neutral', style: 'elegant', name: 'Ink & Paper', desc: 'Warm paper tones, centered and elegant.', side: [],
      patch: {
        layout: 'single', fontHeading: 'Playfair Display', fontBody: 'Lora', fontSize: 9.7, lineHeight: 1.42,
        colors: THEME('paper'),
        pattern: { type: 'none' },
        header: { style: 'center', align: 'center', photoShape: 'circle', photoSize: 26, nameCase: 'title', nameSize: 30, titleSize: 12 },
        heading: { style: 'short', case: 'upper', size: 10.5, weight: 700, spacing: 0.12 }, entries: { dividers: false, dateStyle: 'right' }, skills: { style: 'pipes' },
      },
    },
    {
      id: 'blush', vibe: 'feminine', style: 'elegant', name: 'Blush', desc: 'Soft rose with a botanical sprig.', side: [],
      patch: {
        layout: 'single', fontHeading: 'Playfair Display', fontBody: 'Nunito', fontSize: 9.6,
        colors: { accent: '#d1587f', heading: '#4a2a35', text: '#3b2b30', muted: '#7d6068', bg: '#fffafb', line: '#f2d3dc', chipBg: '#fff2f5', chipBorder: '#f0bfcd' },
        pattern: { type: 'floral', area: 'page', color: '#d1587f', opacity: 0.2, scale: 1, corner: 'tr' },
        header: { style: 'left', photoShape: 'circle', photoPos: 'left', photoSize: 28, nameCase: 'title', nameSize: 29 },
        heading: { style: 'short', case: 'upper', size: 10.5, weight: 700, spacing: 0.1 }, entries: { dividers: false, dateStyle: 'icons' }, skills: { style: 'outline' },
      },
    },
    {
      id: 'lavender', vibe: 'feminine', style: 'modern', name: 'Lavender', desc: 'Soft violet sidebar with a gentle swirl.', side: ['skills', 'certifications', 'languages', 'achievements', 'interests', 'additionalSkills'],
      patch: {
        layout: 'side-left', sidebarFilled: true, columnRatio: 67, fontHeading: 'Raleway', fontBody: 'Nunito', fontSize: 9.5,
        colors: { accent: '#7c3aed', heading: '#2e1f5e', sidebarBg: '#efe9fb', sideText: '#3b2a63', sideAccent: '#7c3aed', line: '#ddd3f3', chipBorder: '#cbb9ee', chipBg: '#ffffff' },
        pattern: { type: 'swirl', area: 'page', color: '#7c3aed', opacity: 0.16, scale: 1, corner: 'tr' },
        header: { in: 'main', contactsIn: 'side', photoShape: 'circle', photoSize: 34, nameCase: 'title', nameSize: 28 },
        heading: { style: 'short', case: 'upper', size: 10.5, weight: 800 }, entries: { dividers: false, dateStyle: 'icons' }, skills: { style: 'outline' },
      },
    },
    {
      id: 'rosegold', vibe: 'feminine', style: 'elegant', name: 'Rose Gold', desc: 'Dark and warm with delicate lace.', side: ['skills', 'certifications', 'languages', 'achievements', 'interests', 'additionalSkills'],
      patch: {
        layout: 'side-right', columnRatio: 64, fontHeading: 'Playfair Display', fontBody: 'Lato', fontSize: 9.5,
        colors: { accent: '#e8a0a8', heading: '#ffffff', text: '#f1e3e3', muted: '#bfa3a6', bg: '#1d1416', sidebarBg: '#291b1e', sideText: '#f1e3e3', sideAccent: '#e8a0a8', headerBg: '#3a2327', headerText: '#ffffff', line: '#43292e', chipBg: '#251a1d', chipBorder: '#5a3a40' },
        pattern: { type: 'lace', area: 'page', color: '#e8a0a8', opacity: 0.22, scale: 1, corner: 'tr' },
        header: { style: 'left', photoShape: 'circle', photoSize: 28, nameCase: 'title', nameSize: 28 },
        heading: { style: 'thin', case: 'upper', size: 10.5, weight: 700, spacing: 0.12 }, entries: { dividers: true, dateStyle: 'icons' }, skills: { style: 'chips' },
      },
    },
    {
      id: 'botanical', vibe: 'feminine', style: 'classic', name: 'Botanical', desc: 'Fresh greens with scattered blossoms.', side: [],
      patch: {
        layout: 'single', fontHeading: 'Lora', fontBody: 'Source Sans 3', fontSize: 9.8,
        colors: { accent: '#3f7d5a', heading: '#1f3d2e', text: '#26332b', muted: '#62756a', bg: '#fbfdf9', line: '#d5e5d9', chipBg: '#f1f8f3', chipBorder: '#bcd7c4' },
        pattern: { type: 'blossoms', area: 'page', color: '#3f7d5a', opacity: 0.18, scale: 1, corner: 'tr' },
        header: { style: 'left', photoShape: 'rounded', photoSize: 28, nameCase: 'title', nameSize: 28 },
        heading: { style: 'thin', case: 'upper', size: 10.5, weight: 700, spacing: 0.1 }, entries: { dividers: false, dateStyle: 'right' }, skills: { style: 'outline' },
      },
    },
    {
      id: 'peony', vibe: 'feminine', style: 'bold', name: 'Peony', desc: 'Rose banner with a watercolor wash.', side: ['skills', 'certifications', 'languages', 'achievements', 'interests', 'additionalSkills'],
      patch: {
        layout: 'side-right', columnRatio: 64, fontHeading: 'Poppins', fontBody: 'Nunito', fontSize: 9.5,
        colors: { accent: '#be185d', headerBg: '#be185d', headerText: '#ffffff', heading: '#4a0d2a', bg: '#fffcfd', chipBorder: '#f4bcd2', chipBg: '#fff2f7', line: '#f6d3e1' },
        pattern: { type: 'wash', area: 'page', color: '#be185d', opacity: 0.12, scale: 1, corner: 'tr' },
        header: { style: 'banner', photoShape: 'circle', photoSize: 30, nameCase: 'upper', nameSize: 25 },
        heading: { style: 'bar', case: 'upper', size: 10, weight: 800 }, entries: { dividers: true, dateStyle: 'icons' }, skills: { style: 'chips' },
      },
    },
    {
      id: 'blueprint', vibe: 'masculine', style: 'modern', name: 'Blueprint', desc: 'Navy sidebar with a drafting-table accent.', side: ['skills', 'certifications', 'languages', 'achievements', 'interests', 'additionalSkills', 'education'],
      patch: {
        layout: 'side-left', sidebarFilled: true, columnRatio: 68, fontHeading: 'IBM Plex Sans', fontBody: 'IBM Plex Sans', fontSize: 9.3,
        colors: { accent: '#1e4e8c', heading: '#0b2447', sidebarBg: '#0b2447', sideText: '#e7eefb', sideAccent: '#7db2ff', line: '#d4dcea', chipBorder: '#b8c6dd' },
        pattern: { type: 'blueprint', area: 'page', color: '#1e4e8c', opacity: 0.2, scale: 1, corner: 'tr' },
        header: { in: 'main', contactsIn: 'side', photoShape: 'square', photoSize: 32, nameCase: 'upper', nameSize: 24 },
        heading: { style: 'underline', case: 'upper', size: 10, weight: 700 }, entries: { dividers: false, dateStyle: 'plain', bulletStyle: 'square' }, skills: { style: 'chips' },
      },
    },
    {
      id: 'steel', vibe: 'masculine', style: 'minimal', name: 'Steel', desc: 'Cool gray, single column, hex accent.', side: [],
      patch: {
        layout: 'single', fontHeading: 'Space Grotesk', fontBody: 'Inter', fontSize: 9.4,
        colors: { accent: '#475569', heading: '#0f172a', muted: '#64748b', line: '#cbd5e1', chipBorder: '#cbd5e1', chipBg: '#f8fafc', bg: '#ffffff' },
        pattern: { type: 'hex', area: 'page', color: '#475569', opacity: 0.16, scale: 1, corner: 'tr' },
        header: { style: 'left', photoShape: 'square', photoSize: 26, nameCase: 'upper', nameSize: 25, titleColor: 'muted' },
        heading: { style: 'bar', case: 'upper', size: 10, weight: 700 }, entries: { dividers: false, dateStyle: 'right', bulletStyle: 'square' }, skills: { style: 'chips' }, contactIcons: false,
      },
    },
    {
      id: 'ember', vibe: 'masculine', style: 'bold', name: 'Ember', desc: 'Black with an orange chevron accent.', side: ['skills', 'certifications', 'languages', 'achievements', 'interests', 'additionalSkills'],
      patch: {
        layout: 'side-right', columnRatio: 65, fontHeading: 'Space Grotesk', fontBody: 'Inter', fontSize: 9.4,
        colors: { accent: '#f97316', heading: '#ffffff', text: '#e8e8e8', muted: '#a3a3a3', bg: '#121212', sidebarBg: '#1b1b1b', sideText: '#e8e8e8', sideAccent: '#fb923c', headerBg: '#1b1b1b', headerText: '#ffffff', line: '#2e2e2e', chipBg: '#1b1b1b', chipBorder: '#3d3d3d' },
        pattern: { type: 'chevrons', area: 'page', color: '#f97316', opacity: 0.26, scale: 1, corner: 'tr' },
        header: { style: 'left', photoShape: 'square', photoSize: 28, nameCase: 'upper', nameSize: 26 },
        heading: { style: 'underline', case: 'upper', size: 10.5, weight: 800 }, entries: { dividers: true, dateStyle: 'plain', bulletStyle: 'arrow' }, skills: { style: 'chips' },
      },
    },
    {
      id: 'ranger', vibe: 'masculine', style: 'classic', name: 'Ranger', desc: 'Deep green with mountain ridgelines.', side: [],
      patch: {
        layout: 'single', fontHeading: 'Merriweather', fontBody: 'Source Sans 3', fontSize: 9.7,
        colors: { accent: '#a3b18a', heading: '#ffffff', text: '#e4ebdf', muted: '#9fb09a', bg: '#101a14', sidebarBg: '#16241b', sideText: '#e4ebdf', sideAccent: '#a3b18a', headerBg: '#1b2e22', headerText: '#ffffff', line: '#26382c', chipBg: '#16241b', chipBorder: '#35503f' },
        pattern: { type: 'ridge', area: 'page', color: '#a3b18a', opacity: 0.3, scale: 1, corner: 'tr' },
        header: { style: 'left', photoShape: 'rounded', photoSize: 28, nameCase: 'title', nameSize: 28 },
        heading: { style: 'thin', case: 'upper', size: 10.5, weight: 700, spacing: 0.1 }, entries: { dividers: false, dateStyle: 'right', bulletStyle: 'dash' }, skills: { style: 'pipes' },
      },
    },
    {
      id: 'carbon', vibe: 'masculine', style: 'minimal', name: 'Carbon', desc: 'Monochrome dark, dense and quiet.', side: ['skills', 'certifications', 'languages', 'achievements', 'interests', 'additionalSkills', 'education'],
      patch: {
        layout: 'side-left', sidebarFilled: true, columnRatio: 70, columnGap: 6, fontHeading: 'Inter', fontBody: 'Inter', fontSize: 9, lineHeight: 1.3, sectionGap: 4.5,
        margins: { top: 10, right: 10, bottom: 10, left: 10 },
        colors: { accent: '#e5e5e5', heading: '#ffffff', text: '#d4d4d4', muted: '#8a8a8a', bg: '#0a0a0a', sidebarBg: '#171717', sideText: '#d4d4d4', sideAccent: '#ffffff', line: '#2a2a2a', chipBg: '#171717', chipBorder: '#3a3a3a' },
        pattern: { type: 'compass', area: 'page', color: '#ffffff', opacity: 0.1, scale: 1, corner: 'tr' },
        header: { in: 'main', contactsIn: 'side', photoShape: 'square', photoSize: 30, nameCase: 'upper', nameSize: 22 },
        heading: { style: 'plain', case: 'upper', size: 9.6, weight: 700, spacing: 0.14 }, entries: { dividers: false, dateStyle: 'plain', bulletStyle: 'dash' }, skills: { style: 'outline' },
      },
    },
    {
      id: 'mint', vibe: 'neutral', style: 'creative', name: 'Soft Mint', desc: 'Airy teal pastel with a gentle wash.', side: ['skills', 'certifications', 'languages', 'achievements', 'interests', 'additionalSkills'],
      patch: {
        layout: 'side-right', columnRatio: 64, fontHeading: 'DM Sans', fontBody: 'DM Sans', fontSize: 9.5,
        colors: { accent: '#0d9488', heading: '#0b3d3a', bg: '#f7fcfb', line: '#cfe8e4', chipBg: '#ffffff', chipBorder: '#b5dcd6', headerBg: '#0d9488' },
        pattern: { type: 'wash', area: 'page', color: '#14b8a6', opacity: 0.14, scale: 1, corner: 'tr' },
        header: { style: 'left', photoShape: 'rounded', photoSize: 28, nameCase: 'title', nameSize: 27 },
        heading: { style: 'short', case: 'upper', size: 10.5, weight: 700 }, entries: { dividers: true, dateStyle: 'icons' }, skills: { style: 'outline' },
      },
    },
    {
      id: 'mehndi', vibe: 'feminine', style: 'creative', name: 'Mehndi', desc: 'Magenta henna flourish, light and warm.', side: ['skills', 'certifications', 'languages', 'achievements', 'interests', 'additionalSkills'],
      patch: {
        layout: 'side-right', columnRatio: 64, fontHeading: 'Playfair Display', fontBody: 'Nunito', fontSize: 9.5,
        colors: { accent: '#c2185b', heading: '#4a1030', text: '#3a2630', muted: '#7d6370', bg: '#fffcfd', line: '#f3cfdd', chipBg: '#fff3f8', chipBorder: '#efb4cb', headerBg: '#c2185b' },
        pattern: { type: 'henna', area: 'page', color: '#c2185b', opacity: 0.32, scale: 0.85, corner: 'tr' },
        header: { style: 'left', photoShape: 'circle', photoSize: 27, nameCase: 'title', nameSize: 27 },
        heading: { style: 'short', case: 'upper', size: 10.5, weight: 700, spacing: 0.1 }, entries: { dividers: true, dateStyle: 'icons' }, skills: { style: 'outline' },
      },
    },
  ];


  /* ---------- template categories (tone and colour family are derived from the design itself) ---------- */
  function hueFamily(hex) {
    const h6 = hex6(hex), r = parseInt(h6.substr(0, 2), 16) / 255, g = parseInt(h6.substr(2, 2), 16) / 255, b = parseInt(h6.substr(4, 2), 16) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (d < 0.08 || l > 0.93 || l < 0.07) return 'mono';
    const sat = d / (1 - Math.abs(2 * l - 1));
    if (sat < 0.16) return 'mono';
    let hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hh = (hh * 60 + 360) % 360;
    if (hh < 15 || hh >= 345) return 'red'; if (hh < 45) return 'orange'; if (hh < 68) return 'gold'; if (hh < 165) return 'green';
    if (hh < 200) return 'teal'; if (hh < 262) return 'blue'; if (hh < 298) return 'purple'; return 'pink';
  }
  const COLOR_FAMILIES = { blue: '#2b6cb0', teal: '#0d9488', green: '#3f7d5a', red: '#c0392b', pink: '#d1587f', purple: '#7c3aed', orange: '#ea580c', gold: '#b7791f', mono: '#475569' };
  const TEMPLATE_FACETS = {
    tone: [['light', 'Light'], ['dark', 'Dark']],
    vibe: [['masculine', 'Masculine'], ['feminine', 'Feminine'], ['neutral', 'Neutral']],
    style: [['classic', 'Classic'], ['modern', 'Modern'], ['minimal', 'Minimal'], ['bold', 'Bold'], ['elegant', 'Elegant'], ['creative', 'Creative']],
    color: Object.keys(COLOR_FAMILIES).map((k) => [k, k[0].toUpperCase() + k.slice(1)]),
  };
  function templateInfo(t) {
    const st = deepMerge(defaultSettings(), t.patch);
    return { tone: luminance(st.colors.bg) < 0.25 ? 'dark' : 'light', vibe: t.vibe || 'neutral', style: t.style || 'classic', color: hueFamily(st.colors.accent) };
  }
  TEMPLATES.forEach((t) => { t.info = templateInfo(t); });

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


  /* Apply part of a template: 'all', 'layout' (layout, fonts, spacing, header/heading styles; keeps your colours)
   * or 'colors' (colours and background pattern; keeps your layout). */
  const COLOR_KEYS = ['colors', 'pattern'];
  function applyTemplateParts(doc, id, parts) {
    if (!parts || parts === 'all') return applyTemplate(doc, id);
    const t = TEMPLATES.find((x) => x.id === id) || TEMPLATES[0];
    const src = deepMerge(defaultSettings(), t.patch), next = clone(doc), cur = next.settings;
    if (parts === 'layout') {
      Object.keys(src).forEach((k) => { if (!COLOR_KEYS.includes(k) && k !== 'pageSize') cur[k] = clone(src[k]); });
      cur.template = t.id;
      if (cur.layout !== 'single') next.sections.forEach((s) => { s.column = t.side.includes(s.type) ? 'side' : 'main'; });
      return next;
    }
    // colours: take the palette and background, then make sure the borrowed colours work with the current layout
    const explicit = (t.patch && t.patch.colors) || {};
    cur.colors = Object.assign({}, cur.colors, clone(src.colors));
    cur.pattern = clone(src.pattern);
    const c = cur.colors, dark = luminance(c.bg) < 0.25;
    if (!explicit.headerBg) { c.headerBg = c.accent; c.headerText = luminance(c.accent) > 0.6 ? '#111111' : '#ffffff'; }
    if (!explicit.sidebarBg) { // the source had no filled sidebar: derive one that reads well
      c.sidebarBg = dark ? mix(c.bg, '#ffffff', 0.07) : cur.sidebarFilled ? mix(c.accent, '#000000', 0.6) : mix(c.accent, '#ffffff', 0.92);
      c.sideText = dark || cur.sidebarFilled ? (dark ? c.text : '#ffffff') : c.text;
      c.sideAccent = dark || cur.sidebarFilled ? mix(c.accent, '#ffffff', dark ? 0 : 0.55) : c.accent;
    } else if (!explicit.sideText) { c.sideText = luminance(c.sidebarBg) < 0.4 ? '#ffffff' : c.text; }
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
    const mk = (type, items, title) => { const s = newSection(type, { blank: true }); s.items = items.map((i) => Object.assign(newItem(type), i)); if (title) s.title = title; return s; };
    const base = {
      v: 1, settings: defaultSettings(),
      header: {
        name: 'Alex Rivera', title: 'Senior Product Designer', tagline: 'Design systems | Accessibility | Data-informed craft', photo: '', photoMode: 'profile',
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
    d.header = { name: 'Your Name', title: 'Your Title', tagline: '', photo: '', photoMode: 'profile', contacts: [{ id: uid(), icon: 'mail', text: 'you@example.com', link: '' }, { id: uid(), icon: 'phone', text: '555-000-0000', link: '' }] };
    d.sections = ['summary', 'experience', 'education', 'skills'].map((t) => {
      const s = newSection(t, { blank: true }); if (t === 'skills') s.items = [Object.assign(newItem('skills'), { name: 'Group', tags: ['Skill', 'Skill'] })]; return s;
    });
    return templateId ? applyTemplate(d, templateId) : d;
  }

  /* The account's profile photo is linked into resumes (photoMode 'profile') unless a resume overrides it. */
  let PROFILE = null;
  const setProfile = (u) => { PROFILE = u || null; };
  function resolveProfile(doc, u) {
    const who = u === undefined ? PROFILE : u, h = doc.header;
    if (h.photoMode === 'profile') return who && who.photo ? Object.assign({}, doc, { header: Object.assign({}, h, { photo: who.photo }) }) : Object.assign({}, doc, { header: Object.assign({}, h, { photo: '' }) });
    if (h.photoMode === 'none') return Object.assign({}, doc, { header: Object.assign({}, h, { photo: '' }) });
    return doc;
  }

  const PAGE_MM = { A4: [210, 297], Letter: [215.9, 279.4] };

  return {
    FONTS, PALETTES, THEMES, TEMPLATES, SECTION_TYPES, SAMPLES, ICON_CHOICES, CONTACT_ICONS, PAGE_MM, ENUMS,
    TEMPLATE_FACETS, COLOR_FAMILIES, templateInfo,
    setProfile, resolveProfile, defaultSettings, normalizeDoc, newSection, newItem, applyTemplate, applyPalette, applyColorTheme, sampleDoc, blankDoc,
    ACCENT_GROUPS: [['Soft & floral', ['henna', 'floral', 'blossoms', 'swirl', 'scallop', 'wash', 'lace']], ['Bold & technical', ['blueprint', 'hex', 'chevrons', 'angular', 'compass', 'ridge']], ['Neutral', ['arcs', 'traces', 'contour', 'nodemap', 'dotfade', 'linefade']]],
    ACCENT_PATTERNS: ['arcs', 'traces', 'contour', 'nodemap', 'dotfade', 'linefade', 'floral', 'blossoms', 'swirl', 'scallop', 'wash', 'lace', 'blueprint', 'hex', 'chevrons', 'angular', 'compass', 'ridge', 'henna'],
    applyTemplateParts, deepMerge, clone, uid, mix, luminance,
  };
});
