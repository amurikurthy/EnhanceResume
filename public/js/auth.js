import * as api from './api.js';
import { h, themeButton } from './ui.js';
import { state } from './app.js';

export function mountAuth(root, done) {
  let mode = 'login';
  const draw = () => {
    const err = h('div', { class: 'form-err' });
    const email = h('input', { type: 'email', autocomplete: 'email', required: true, placeholder: 'you@example.com' });
    const pass = h('input', { type: 'password', autocomplete: mode === 'login' ? 'current-password' : 'new-password', required: true, minlength: 8, placeholder: mode === 'login' ? 'Password' : 'At least 8 characters' });
    const name = h('input', { type: 'text', autocomplete: 'name', placeholder: 'Your name' });
    const form = h('form', { class: 'auth-card', onsubmit: async (e) => {
      e.preventDefault(); err.textContent = '';
      try {
        const r = await api.post(mode === 'login' ? '/api/auth/login' : '/api/auth/register', { email: email.value, password: pass.value, name: name.value });
        state.user = r.user; done();
      } catch (ex) { err.textContent = ex.message; }
    } },
      h('div', { class: 'logo big' }, h('span', { class: 'logo-mark' }), 'EnhanceResume'),
      h('h1', null, mode === 'login' ? 'Welcome back' : 'Create your account'),
      h('p', { class: 'muted' }, 'Build beautiful, ATS-friendly resumes with drag & drop.'),
      mode === 'register' ? h('label', null, 'Name', name) : null,
      h('label', null, 'Email', email), h('label', null, 'Password', pass), err,
      h('button', { class: 'btn primary wide', type: 'submit' }, mode === 'login' ? 'Sign in' : 'Create account'),
      state.registration ? h('p', { class: 'switch' }, mode === 'login' ? 'New here? ' : 'Have an account? ',
        h('a', { href: '#', onclick: (e) => { e.preventDefault(); mode = mode === 'login' ? 'register' : 'login'; draw(); } }, mode === 'login' ? 'Create an account' : 'Sign in')) : null);
    root.replaceChildren(h('div', { class: 'auth-wrap' }, themeButton(), form));
    email.focus();
  };
  draw();
}
