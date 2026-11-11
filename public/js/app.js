import * as api from './api.js';
import { h } from './ui.js';
import { mountAuth } from './auth.js';
import { mountDashboard } from './dashboard.js';
import { mountEditor } from './editor.js';
import { mountAdmin } from './admin.js';

const app = document.getElementById('app');
let cleanup = null;
let user = null;

export const state = { get user() { return user; }, set user(u) { user = u; window.ERT.setProfile(u); }, registration: true, passwordLogin: true, oidc: null };

async function route() {
  if (cleanup) { try { await cleanup(); } catch (e) { console.error(e); } cleanup = null; }
  app.replaceChildren();
  if (!user) {
    const me = await api.get('/api/auth/me').catch(() => ({ user: null }));
    state.user = me.user; state.registration = me.registration !== false; state.passwordLogin = me.passwordLogin !== false; state.oidc = me.oidc || null;
  }
  const hash = location.hash || '#/';
  if (!user) {
    if (hash !== '#/login') { location.hash = '#/login'; return; }
    cleanup = mountAuth(app, () => { location.hash = '#/'; });
    return;
  }
  if (hash === '#/login') { location.hash = '#/'; return; }
  const m = hash.match(/^#\/edit\/([\w-]+)$/);
  try {
    if (hash === '#/admin' && user.isAdmin) cleanup = await mountAdmin(app);
    else if (m) cleanup = await mountEditor(app, m[1]);
    else cleanup = await mountDashboard(app);
  } catch (e) {
    console.error(e);
    app.replaceChildren(h('div', { class: 'center-msg' }, h('p', null, e.message), h('a', { class: 'btn', href: '#/' }, 'Back to my resumes')));
  }
}

export async function logout() {
  await api.post('/api/auth/logout').catch(() => {});
  state.user = null; location.hash = '#/login'; route();
}

window.addEventListener('hashchange', route);
route();
