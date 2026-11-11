export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.append(c.nodeType ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  return el;
}

export function toast(msg, kind = '') {
  const t = h('div', { class: 'toast ' + kind }, msg);
  document.getElementById('toasts').append(t);
  setTimeout(() => t.remove(), 3500);
}

export function modal(title, body, actions = [], opts = {}) {
  return new Promise((resolve) => {
    const close = (v) => { ov.remove(); resolve(v === undefined ? null : v); };
    const ov = h('div', { class: 'overlay', onmousedown: (e) => { if (e.target === ov) close(null); } },
      h('div', { class: 'modal' + (opts.wide ? ' wide' : '') },
        h('div', { class: 'modal-h' }, h('h3', null, title), h('button', { class: 'icon-btn', onclick: () => close(null), 'aria-label': 'Close' }, '×')),
        h('div', { class: 'modal-b' }, typeof body === 'function' ? body(close) : body),
        actions.length ? h('div', { class: 'modal-f' }, actions.map((a) => h('button', { class: 'btn ' + (a.kind || ''), onclick: () => close(a.value) }, a.label))) : null));
    document.body.append(ov);
    const f = ov.querySelector('input,textarea'); if (f) f.focus();
  });
}

export const confirmDlg = async (title, text, okLabel = 'Delete') =>
  (await modal(title, h('p', null, text), [{ label: 'Cancel', value: false }, { label: okLabel, value: true, kind: 'danger' }])) === true;

export function downloadBlob(blob, name) {
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* A4 page sheet used by preview + thumbnails */
export function sheetHtml(doc) {
  const T = window.ERT, R = window.ERR, s = doc.settings, m = s.margins;
  const [pw, ph] = T.PAGE_MM[s.pageSize];
  return `<div class="sheet" style="width:${pw}mm;min-height:${ph}mm;padding:${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm"><div class="rz-bg" style="${R.esc(R.pageBg(doc))}"></div>${R.render(doc)}</div>`;
}

export function thumb(doc, width = 210) {
  const T = window.ERT, [pw, ph] = T.PAGE_MM[doc.settings.pageSize];
  const pxW = pw * 96 / 25.4, pxH = ph * 96 / 25.4, z = width / pxW;
  const box = h('div', { class: 'thumb', style: { width: width + 'px', height: Math.round(pxH * z) + 'px' } });
  const inner = h('div', { class: 'thumb-in', html: sheetHtml(doc), style: { transform: `scale(${z})`, width: pxW + 'px', height: pxH + 'px' } });
  box.append(inner);
  return box;
}

export function fileToImage(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Could not read image')); };
    img.src = url;
  });
}

/* square-crop photo -> jpeg data URL */
export async function photoDataUrl(file, size = 480) {
  const img = await fileToImage(file);
  const s = Math.min(img.width, img.height);
  const c = document.createElement('canvas'); c.width = c.height = size;
  c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
  return c.toDataURL('image/jpeg', 0.85);
}

/* logo: keep aspect, max side px, png to keep transparency */
export async function logoDataUrl(file) {
  const img = await fileToImage(file);
  for (const max of [200, 128, 80]) {
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const out = c.toDataURL('image/png');
    if (out.length < 110000) return out;
  }
  throw new Error('Image too large');
}

export function themeButton() {
  const btn = h('button', { class: 'icon-btn theme-btn', title: 'Toggle dark mode', 'aria-label': 'Toggle dark mode' });
  const draw = () => { btn.textContent = document.documentElement.dataset.theme === 'dark' ? '☀' : '☾'; };
  btn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('er-theme', next); } catch { /* private mode */ }
    draw();
  });
  draw();
  return btn;
}
