import * as api from './api.js';
import { h, toast, modal, photoDataUrl } from './ui.js';
import { state } from './app.js';

const FIELDS = [['headline', 'Headline / job title', 'e.g. Network Infrastructure Engineer'], ['phone', 'Phone', '555-010-2030'], ['location', 'Location', 'Chicago, IL'],
  ['linkedin', 'LinkedIn', 'linkedin.com/in/you'], ['website', 'Website', 'example.com'], ['github', 'GitHub', 'github.com/you']];

export const initials = (u) => ((u && u.name) || '?').trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
export const firstName = (u) => ((u && u.name) || '').trim().split(/\s+/)[0] || 'Account';
export function avatar(u, size = 28) {
  return u && u.photo ? h('img', { class: 'avatar img', src: u.photo, alt: '', style: { width: size + 'px', height: size + 'px' } })
    : h('span', { class: 'avatar', style: { width: size + 'px', height: size + 'px' } }, initials(u));
}

/* signed-in user's profile: photo + details used for new resumes (photo stays linked unless a resume overrides it) */
export async function openProfile() {
  const u = state.user;
  let photo = u.photo || '';
  const name = h('input', { type: 'text', value: u.name, maxlength: 100 });
  const inputs = Object.fromEntries(FIELDS.map(([k, , ph]) => [k, h('input', { type: 'text', value: (u.profile || {})[k] || '', placeholder: ph, maxlength: 200 })]));
  const photoBox = h('div', { class: 'pf-photo' });
  const err = h('div', { class: 'form-err' });
  const drawPhoto = () => {
    const file = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' }, onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { photo = await photoDataUrl(f, 400); drawPhoto(); } catch (ex) { err.textContent = ex.message; }
    } });
    photoBox.replaceChildren(
      photo ? h('img', { src: photo, alt: '' }) : h('div', { class: 'pf-empty' }, initials({ name: name.value || u.name })),
      h('div', { class: 'pf-photo-a' }, h('button', { type: 'button', class: 'btn small', onclick: () => file.click() }, photo ? 'Change photo' : 'Upload photo'),
        photo ? h('button', { type: 'button', class: 'btn small danger-t', onclick: () => { photo = ''; drawPhoto(); } }, 'Remove') : null,
        h('small', { class: 'muted' }, 'Used on new resumes. You can override it per resume.')), file);
  };
  drawPhoto();

  const pw = { cur: h('input', { type: 'password', autocomplete: 'current-password' }), next: h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'At least 8 characters' }), msg: h('div', { class: 'form-err' }) };
  const pwBox = h('details', { class: 'grp pf-pw' }, h('summary', null, u.hasPassword ? 'Change password' : 'Set a password'),
    h('div', { class: 'grp-b' }, u.hasPassword ? h('label', null, 'Current password', pw.cur) : null, h('label', null, 'New password', pw.next), pw.msg,
      h('button', { type: 'button', class: 'btn small', onclick: async () => {
        pw.msg.textContent = '';
        try { await api.post('/api/profile/password', { current: pw.cur.value, password: pw.next.value }); pw.cur.value = pw.next.value = ''; toast('Password updated. Other devices were signed out'); } catch (e) { pw.msg.textContent = e.message; }
      } }, 'Update password')));

  await modal('Your profile', (close) => h('div', { class: 'pf' },
    photoBox,
    h('label', null, 'Name', name),
    h('label', null, 'Email', h('input', { type: 'text', value: u.email, disabled: true })),
    h('div', { class: 'pf-grid' }, FIELDS.map(([k, label]) => h('label', null, label, inputs[k]))),
    h('p', { class: 'muted small' }, 'These details fill in new resumes automatically. Existing resumes keep their own contact details.'),
    pwBox, err,
    h('div', { class: 'pf-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => close(false) }, 'Cancel'),
      h('button', { type: 'button', class: 'btn primary', onclick: async () => {
        err.textContent = '';
        try {
          const r = await api.put('/api/profile', { name: name.value, photo, profile: Object.fromEntries(Object.entries(inputs).map(([k, el]) => [k, el.value])) });
          state.user = r.user; window.dispatchEvent(new CustomEvent('er-profile')); toast('Profile saved'); close(true);
        } catch (e) { err.textContent = e.message; }
      } }, 'Save profile'))), []);
}
