import * as api from './api.js';
import { h, toast, modal, confirmDlg, thumb, downloadBlob, themeButton } from './ui.js';
import { state, logout } from './app.js';
import { ensureIconsFor } from './icons.js';
import { templateBrowser } from './template-browser.js';
import { openProfile, avatar, firstName } from './profile.js';

const T = window.ERT;

const ICON = {
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
};
/* compact icon button with a tooltip, so a card's actions fit on one row at any width */
const act = (label, icon, onclick, cls = '') => h('button', { type: 'button', class: 'icon-act ' + cls, title: label, 'aria-label': label, onclick,
  html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg>` });


export function topbar(extra) {
  return h('header', { class: 'topbar' },
    h('a', { class: 'logo', href: '#/' }, h('span', { class: 'logo-mark' }), 'EnhanceResume'),
    h('div', { class: 'spacer' }), extra, state.user.isAdmin ? h('a', { class: 'btn ghost', href: '#/admin' }, 'Admin') : null,
    themeButton(), userChip(), h('button', { class: 'btn ghost', onclick: logout }, 'Sign out'));
}
function userChip() {
  const chip = h('button', { type: 'button', class: 'user', title: 'Edit your profile and photo', 'aria-label': 'Edit your profile', onclick: openProfile });
  const draw = () => chip.replaceChildren(avatar(state.user), h('span', { class: 'uname', title: state.user.name }, firstName(state.user)));
  draw(); window.addEventListener('er-profile', () => { if (chip.isConnected) draw(); });
  return chip;
}

async function newResumeDialog() {
  let tpl = 'classic', blank = false;
  const titleIn = h('input', { type: 'text', value: 'My resume', maxlength: 100 });
  const browser = templateBrowser({ sampleFor: (t) => T.sampleDoc(t.id), getCurrent: () => tpl, onPick: (t) => { tpl = t.id; }, width: 150 });
  const body = h('div', null,
    h('label', null, 'Resume name', titleIn),
    h('div', { class: 'field-lbl' }, 'Choose a template (you can change it any time)'), browser,
    h('label', { class: 'check' }, h('input', { type: 'checkbox', onchange: (e) => { blank = e.target.checked; } }), 'Start with a blank resume instead of sample content'));
  const ok = await modal('New resume', body, [{ label: 'Cancel', value: false }, { label: 'Create resume', value: true, kind: 'primary' }], { wide: true });
  if (!ok) return null;
  return api.post('/api/resumes', { title: titleIn.value, template: tpl, blank });
}

export async function mountDashboard(root) {
  const list = await api.get('/api/resumes');
  await ensureIconsFor(list.map((r) => r.data));
  const grid = h('div', { class: 'cards' });
  const fileIn = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' }, onchange: async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      const r = await api.post('/api/resumes', { title: j.title || f.name.replace(/\.json$/i, ''), data: j.data || j });
      location.hash = '#/edit/' + r.id;
    } catch (ex) { toast('Import failed: ' + ex.message, 'err'); }
  } });

  const draw = () => {
    grid.replaceChildren(
      h('button', { class: 'card new', onclick: async () => { const r = await newResumeDialog().catch((e) => { toast(e.message, 'err'); }); if (r) location.hash = '#/edit/' + r.id; } },
        h('span', { class: 'plus' }, '+'), 'New resume'),
      ...list.map((r) => h('div', { class: 'card resume' },
        h('a', { class: 'thumb-link', href: '#/edit/' + r.id }, thumb(r.data, 300)),
        h('div', { class: 'card-meta' },
          h('a', { class: 'rtitle', href: '#/edit/' + r.id, title: r.title }, r.title),
          h('div', { class: 'rmeta' }, h('span', { class: 'when', title: new Date(r.updated_at).toLocaleString() }, 'Edited ' + new Date(r.updated_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })),
            h('span', { class: 'sep' }, '·'), h('span', { class: 'tplname' }, (T.TEMPLATES.find((t) => t.id === r.data.settings.template) || {}).name))),
        h('div', { class: 'card-actions' },
          h('a', { class: 'btn small edit', href: '#/edit/' + r.id }, 'Edit'),
          h('span', { class: 'sp' }),
          act('Duplicate', ICON.copy, async () => { try { const c = await api.post(`/api/resumes/${r.id}/duplicate`); list.unshift(c); draw(); toast('Duplicated'); } catch (e) { toast(e.message, 'err'); } }),
          act('Export as JSON', ICON.download, () => downloadBlob(new Blob([JSON.stringify({ title: r.title, data: r.data }, null, 1)], { type: 'application/json' }), (r.title.replace(/[^\w-]+/g, '_').slice(0, 60) || 'resume') + '.json')),
          act('Delete', ICON.trash, async () => { if (await confirmDlg('Delete resume', `Delete “${r.title}”? This cannot be undone.`)) { try { await api.del('/api/resumes/' + r.id); list.splice(list.indexOf(r), 1); draw(); } catch (e) { toast(e.message, 'err'); } } }, 'danger')))));
  };
  draw();
  root.replaceChildren(
    topbar(h('button', { class: 'btn', onclick: () => fileIn.click() }, 'Import JSON')),
    h('main', { class: 'dash' }, h('h1', null, 'My resumes'), h('p', { class: 'muted' }, 'Everything here is private to your account.'), grid, fileIn));
}
