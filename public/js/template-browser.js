import { h, thumb } from './ui.js';

const T = window.ERT;
// remembered between openings (new-resume dialog and the editor's Templates tab)
const active = { tone: null, vibe: null, style: null, color: null };
const LABELS = { tone: 'Tone', vibe: 'Vibe', style: 'Look & feel', color: 'Color' };

/* a filterable gallery of templates: tone (light/dark), vibe (masculine/feminine/neutral), look & feel and colour family */
export function templateBrowser({ sampleFor, getCurrent, onPick, width = 150 }) {
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
        thumb(sampleFor(t), width), h('b', null, t.name), h('small', null, t.desc),
        h('span', { class: 'tpl-tags' }, [t.info.tone === 'dark' ? 'Dark' : 'Light', t.info.vibe[0].toUpperCase() + t.info.vibe.slice(1), t.info.style[0].toUpperCase() + t.info.style.slice(1)].map((x) => h('i', null, x)))));
    }
    return cache.get(t.id);
  }
  function drawFilters() {
    filters.replaceChildren(...Object.keys(LABELS).map((facet) => {
      const have = present(facet);
      const chips = T.TEMPLATE_FACETS[facet].filter(([v]) => have.has(v)).map(([v, label]) => {
        const on = active[facet] === v;
        const style = facet === 'color' ? { '--dot': T.COLOR_FAMILIES[v] } : null;
        return h('button', { type: 'button', class: 'chip' + (on ? ' on' : '') + (facet === 'color' ? ' dotted' : ''), style, title: label,
          onclick: () => { active[facet] = on ? null : v; drawFilters(); drawGrid(); } }, facet === 'color' ? [h('span', { class: 'dot' }), label] : label);
      });
      return h('div', { class: 'tb-row' }, h('span', { class: 'tb-lbl' }, LABELS[facet]),
        h('button', { type: 'button', class: 'chip' + (!active[facet] ? ' on' : ''), onclick: () => { active[facet] = null; drawFilters(); drawGrid(); } }, 'All'), chips);
    }));
  }
  function drawGrid() {
    const list = T.TEMPLATES.filter(matches);
    grid.replaceChildren(...list.map(card));
    const any = Object.values(active).some(Boolean);
    count.replaceChildren(`${list.length} of ${T.TEMPLATES.length} templates`, ' ', any ? h('a', { href: '#', onclick: (e) => { e.preventDefault(); Object.keys(active).forEach((k) => { active[k] = null; }); drawFilters(); drawGrid(); } }, 'Clear filters') : '');
    if (!list.length) grid.append(h('p', { class: 'muted pad' }, 'No templates match every filter. Try removing one.'));
    refresh();
  }
  function refresh() { const cur = getCurrent(); grid.querySelectorAll('.tpl').forEach((b) => b.classList.toggle('on', b.dataset.id === cur)); }
  drawFilters(); drawGrid();
  root.refresh = refresh;
  return root;
}
