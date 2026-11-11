import * as api from './api.js';
import { h, toast, modal, confirmDlg } from './ui.js';
import { topbar } from './dashboard.js';

const fmt = (t) => (t ? new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '–');

export async function mountAdmin(root) {
  const main = h('main', { class: 'admin' });
  root.replaceChildren(topbar(h('a', { class: 'btn ghost', href: '#/' }, '← My resumes')), main);

  async function draw() {
    const { users, config } = await api.get('/api/admin/users');
    const act = async (fn, okMsg) => { try { await fn(); if (okMsg) toast(okMsg); await draw(); } catch (e) { toast(e.message, 'err'); } };

    const newEmail = h('input', { type: 'email', placeholder: 'user@example.com' });
    const newName = h('input', { type: 'text', placeholder: 'Name (optional)' });
    const newPass = h('input', { type: 'password', placeholder: 'Temporary password (8+ chars)' });
    const newAdmin = h('input', { type: 'checkbox' });
    const create = () => act(() => api.post('/api/admin/users', { email: newEmail.value, name: newName.value, password: newPass.value, isAdmin: newAdmin.checked }), 'User created');

    const resetPw = async (u) => {
      const pw = h('input', { type: 'password', placeholder: 'New password (8+ chars)' });
      const ok = await modal('Reset password for ' + u.email, h('label', null, 'New password', pw), [{ label: 'Cancel', value: false }, { label: 'Set password', value: true, kind: 'primary' }]);
      if (ok) act(() => api.post(`/api/admin/users/${u.id}/password`, { password: pw.value }), 'Password updated');
    };

    main.replaceChildren(
      h('div', null, h('h1', null, 'Administration'), h('p', { class: 'muted' }, 'Manage accounts. Administrators cannot read other users’ resumes.')),
      h('section', { class: 'panel-card' }, h('h3', null, 'Configuration (set via environment variables)'),
        h('div', { class: 'kv' },
          h('span', { class: 'pill ' + (config.registration ? 'ok' : 'off') }, 'Self sign-up: ' + (config.registration ? 'on' : 'off')),
          h('span', { class: 'pill ' + (config.sso ? 'ok' : 'off') }, 'SSO (OIDC): ' + (config.sso ? 'enabled' : 'not configured')),
          config.sso ? h('span', { class: 'pill' }, 'Password sign-in: ' + (config.passwordLoginDisabled ? 'disabled' : 'enabled')) : null,
          config.ssoAdminGroup ? h('span', { class: 'pill' }, 'SSO admin group: ' + config.ssoAdminGroup) : null,
          config.envAdmin ? h('span', { class: 'pill' }, 'Environment admin: ' + config.envAdmin) : null)),
      h('section', { class: 'panel-card' }, h('h3', null, 'Add a user'),
        h('div', { class: 'inline-form' }, h('label', null, 'Email', newEmail), h('label', null, 'Name', newName), h('label', null, 'Password', newPass),
          h('label', { class: 'check' }, newAdmin, 'Administrator'), h('button', { class: 'btn primary', onclick: create }, 'Create user'))),
      h('section', { class: 'panel-card' }, h('h3', null, `Users (${users.length})`),
        h('div', { class: 'table-wrap' }, h('table', { class: 'users' },
          h('thead', null, h('tr', null, ['User', 'Sign-in', 'Resumes', 'Created', 'Last login', ''].map((t) => h('th', null, t)))),
          h('tbody', null, users.map((u) => h('tr', { class: u.disabled ? 'dim' : '' },
            h('td', null, h('b', null, u.name), h('br'), h('small', { class: 'muted' }, u.email)),
            h('td', null, u.isAdmin ? h('span', { class: 'pill ok' }, 'Admin') : null, ' ', u.sso ? h('span', { class: 'pill' }, 'SSO') : null, ' ', u.disabled ? h('span', { class: 'pill bad' }, 'Disabled') : null, u.locked ? h('span', { class: 'pill' }, 'from env') : null),
            h('td', null, String(u.resumes)), h('td', null, fmt(u.createdAt)), h('td', null, fmt(u.lastLogin)),
            h('td', null, h('div', { class: 'actions' },
              !u.locked ? [
                h('button', { class: 'btn small', onclick: () => act(() => patch(u.id, { isAdmin: !u.isAdmin })) }, u.isAdmin ? 'Remove admin' : 'Make admin'),
                h('button', { class: 'btn small', onclick: () => act(() => patch(u.id, { disabled: !u.disabled })) }, u.disabled ? 'Enable' : 'Disable'),
                !u.sso ? h('button', { class: 'btn small', onclick: () => resetPw(u) }, 'Reset password') : null,
                h('button', { class: 'btn small danger-t', onclick: async () => { if (await confirmDlg('Delete user', `Delete ${u.email} and all of their resumes? This cannot be undone.`)) act(() => api.del('/api/admin/users/' + u.id), 'User deleted'); } }, 'Delete'),
              ] : null)))))))));
  }
  await draw();
}

const patch = (id, body) => api.patch('/api/admin/users/' + id, body);
