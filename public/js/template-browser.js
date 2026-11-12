import { h, thumb } from './ui.js';

const T = window.ERT;
// remembered between openings (new-resume dialog and the editor's Templates tab)
const active = { tone: null, vibe: null, style: null, color: null };
const LABELS = { tone: 'Tone', vibe: 'Vibe', style: 'Look & feel', color: 'Color' };

/* a filterable gallery of templates: tone (light/dark), vibe (masculine/feminine/neutral), look & feel and colour family */
export function templateBrowser({ sampleFor, getCurrent, onPick, getMarks, width = 150 }) {
  const cache = new Map(); // template id -> button (thumbnails are rendered once per browser)
  const grid = h('div', { class: 'tpl-grid' });
  const filters = h('div', { class: 'tb-filters' });
  const count = h('span', { class: 'muted small' });
  const root = h('div', { class: 'tb' }, filters, h('div', { class: 'tb-meta' }, count), grid);

  const present = (facet) => new Set(T.TEMPLATES.map((t) => t.info[facet]));
  const matches = (t) => Object.keys(active).every((k) => !active[k] || t.info[k] === active[k]);

  function card(t) {
    if (!cache.has(t.id)) {
      cache.set(t.id, h('button', { type: 'button', class: 'tpl', 'data-id': t.id, onclick: () => { onPick(t); refresh(); } },
        h('span', { class: 'tpl-marks' }),
        thumb(sampleFor(t), width), h('b', null, t.name), h('small', null, t.desc),
        h('span', { class: 'tpl-tags' }, [t.info.tone === 'dark' ? 'Dark' : 'Light', t.info.vibe[0].toUpperCase() + t.info.vibe.slice(1), t.info.style[0].toUpperCase() + t.info.style.slice(1)].map((x) => h('i', null, x)))));
    }
    return cache.get(t.id);
  }
  /* compact toolbar: three dropdowns + a row of colour dots (instead of rows of text chips) */
  function drawFilters() {
    const select = (facet, any) => {
      const have = present(facet);
      const el = h('select', { class: 'tb-sel' + (active[facet] ? ' on' : ''), 'aria-label': LABELS[facet] },
        h('option', { value: '' }, any), T.TEMPLATE_FACETS[facet].filter(([v]) => have.has(v)).map(([v, l]) => h('option', { value: v, selected: active[facet] === v }, l)));
      el.addEventListener('change', () => { active[facet] = el.value || null; drawFilters(); drawGrid(); });
      return el;
    };
    const have = present('color');
    const dots = h('div', { class: 'tb-dots', role: 'group', 'aria-label': 'Color' }, Object.keys(T.COLOR_FAMILIES).filter((k) => have.has(k)).map((k) =>
      h('button', { type: 'button', class: 'tb-dot' + (active.color === k ? ' on' : ''), title: k[0].toUpperCase() + k.slice(1), 'aria-label': k, 'aria-pressed': active.color === k ? 'true' : 'false',
        style: { background: T.COLOR_FAMILIES[k] }, onclick: () => { active.color = active.color === k ? null : k; drawFilters(); drawGrid(); } })));
    filters.replaceChildren(h('div', { class: 'tb-selects' }, select('tone', 'Any tone'), select('vibe', 'Any vibe'), select('style', 'Any look')), h('div', { class: 'tb-colors' }, h('span', { class: 'tb-lbl' }, 'Color'), dots));
  }
  function drawGrid() {
    const list = T.TEMPLATES.filter(matches);
    grid.replaceChildren(...list.map(card));
    const any = Object.values(active).some(Boolean);
    count.replaceChildren(`${list.length} of ${T.TEMPLATES.length} templates`, ' ', any ? h('a', { href: '#', onclick: (e) => { e.preventDefault(); Object.keys(active).forEach((k) => { active[k] = null; }); drawFilters(); drawGrid(); } }, 'Clear filters') : '');
    if (!list.length) grid.append(h('p', { class: 'muted pad' }, 'No templates match every filter. Try removing one.'));
    refresh();
  }
  function refresh() {
    const cur = getCurrent();
    grid.querySelectorAll('.tpl').forEach((b) => {
      const m = getMarks ? getMarks(T.TEMPLATES.find((x) => x.id === b.dataset.id)) : {};
      b.classList.toggle('on', b.dataset.id === cur);
      b.classList.toggle('picked', !!(m.layout || m.colors));
      b.querySelector('.tpl-marks').replaceChildren(...[m.layout && 'Layout', m.colors && 'Colors'].filter(Boolean).map((x) => h('em', null, x)));
    });
  }
  drawFilters(); drawGrid();
  root.refresh = refresh;
  return root;
}
