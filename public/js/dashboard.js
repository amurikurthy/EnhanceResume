import * as api from './api.js';
import { h, toast, modal, confirmDlg, thumb, downloadBlob, themeButton } from './ui.js';
import { state, logout } from './app.js';
import { ensureIconsFor } from './icons.js';

const T = window.ERT;

export function topbar(extra) {
  return h('header', { class: 'topbar' },
    h('a', { class: 'logo', href: '#/' }, h('span', { class: 'logo-mark' }), 'EnhanceResume'),
    h('div', { class: 'spacer' }), extra, state.user.isAdmin ? h('a', { class: 'btn ghost', href: '#/admin' }, 'Admin') : null,
    themeButton(), h('div', { class: 'user' }, h('span', { class: 'avatar' }, (state.user.name || '?')[0].toUpperCase()), h('span', { class: 'uname' }, state.user.name),
      h('button', { class: 'btn ghost', onclick: logout }, 'Sign out')));
}

async function newResumeDialog() {
  let tpl = 'classic', blank = false;
  const titleIn = h('input', { type: 'text', value: 'My resume', maxlength: 100 });
  const grid = h('div', { class: 'tpl-grid' });
  const draw = () => grid.replaceChildren(...T.TEMPLATES.map((t) => h('button', { class: 'tpl' + (t.id === tpl ? ' on' : ''), onclick: () => { tpl = t.id; draw(); } },
    thumb(T.sampleDoc(t.id), 150), h('b', null, t.name), h('small', null, t.desc))));
  draw();
  const body = h('div', null,
    h('label', null, 'Resume name', titleIn),
    h('div', { class: 'field-lbl' }, 'Choose a template (you can change it any time)'), grid,
    h('label', { class: 'check' }, h('input', { type: 'checkbox', onchange: (e) => { blank = e.target.checked; } }), 'Start with a blank resume instead of sample content'));
  const ok = await modal('New resume', body, [{ label: 'Cancel', value: false }, { label: 'Create resume', value: true, kind: 'primary' }]);
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
        h('a', { class: 'thumb-link', href: '#/edit/' + r.id }, thumb(r.data, 220)),
        h('div', { class: 'card-meta' },
          h('a', { class: 'rtitle', href: '#/edit/' + r.id }, r.title),
          h('small', null, 'Edited ' + new Date(r.updated_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) + ' · ' + (T.TEMPLATES.find((t) => t.id === r.data.settings.template) || {}).name)),
        h('div', { class: 'card-actions' },
          h('a', { class: 'btn small', href: '#/edit/' + r.id }, 'Edit'),
          h('button', { class: 'btn small', onclick: async () => { try { const c = await api.post(`/api/resumes/${r.id}/duplicate`); list.unshift(c); draw(); toast('Duplicated'); } catch (e) { toast(e.message, 'err'); } } }, 'Duplicate'),
          h('button', { class: 'btn small', onclick: () => downloadBlob(new Blob([JSON.stringify({ title: r.title, data: r.data }, null, 1)], { type: 'application/json' }), r.title.replace(/\W+/g, '_') + '.json') }, 'Export'),
          h('button', { class: 'btn small danger-t', onclick: async () => { if (await confirmDlg('Delete resume', `Delete “${r.title}”? This cannot be undone.`)) { try { await api.del('/api/resumes/' + r.id); list.splice(list.indexOf(r), 1); draw(); } catch (e) { toast(e.message, 'err'); } } } }, 'Delete')))));
  };
  draw();
  root.replaceChildren(
    topbar(h('button', { class: 'btn', onclick: () => fileIn.click() }, 'Import JSON')),
    h('main', { class: 'dash' }, h('h1', null, 'My resumes'), h('p', { class: 'muted' }, 'Everything here is private to your account.'), grid, fileIn));
}
