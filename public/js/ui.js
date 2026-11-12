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
    const prevFocus = document.activeElement;
    const onKey = (e) => { // Escape closes the top-most dialog only
      if (e.key !== 'Escape') return;
      const all = document.querySelectorAll('.overlay'); if (all[all.length - 1] !== ov) return;
      e.preventDefault(); e.stopPropagation(); close(null);
    };
    const close = (v) => { document.removeEventListener('keydown', onKey, true); ov.remove(); try { if (prevFocus && prevFocus.isConnected && prevFocus.focus) prevFocus.focus({ preventScroll: true }); } catch { /* ignore */ } resolve(v === undefined ? null : v); };
    const ov = h('div', { class: 'overlay', onmousedown: (e) => { if (e.target === ov) close(null); } },
      h('div', { class: 'modal' + (opts.wide ? ' wide' : '') },
        h('div', { class: 'modal-h' }, h('h3', null, title), h('button', { class: 'icon-btn', onclick: () => close(null), 'aria-label': 'Close' }, '×')),
        h('div', { class: 'modal-b' }, typeof body === 'function' ? body(close) : body),
        actions.length ? h('div', { class: 'modal-f' }, actions.map((a) => h('button', { class: 'btn ' + (a.kind || ''), onclick: () => close(a.value) }, a.label))) : null));
    document.body.append(ov); document.addEventListener('keydown', onKey, true);
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
  const T = window.ERT, R = window.ERR;
  doc = T.resolveProfile(doc);
  const s = doc.settings, m = s.margins;
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

/* ---------- context menu ---------- */
let ctxEl = null, ctxCleanup = null;
export function closeCtx() {
  if (ctxEl) { ctxEl.remove(); ctxEl = null; }
  if (ctxCleanup) { ctxCleanup(); ctxCleanup = null; }
}
/* items: { label, run, icon (svg inner), kbd, disabled, danger } | { header } | '-' */
export function ctxMenu(items, x, y) {
  closeCtx();
  const list = items.filter(Boolean).filter((it, i, a) => !(it === '-' && (i === 0 || a[i - 1] === '-' || i === a.length - 1)));
  const menu = h('div', { class: 'ctx-menu', role: 'menu' });
  list.forEach((it) => {
    if (it === '-') menu.append(h('div', { class: 'ctx-sep', role: 'separator' }));
    else if (it.header) menu.append(h('div', { class: 'ctx-h' }, it.header));
    else menu.append(h('button', { type: 'button', role: 'menuitem', class: 'ctx-item' + (it.danger ? ' danger' : ''), disabled: !!it.disabled,
      onmousedown: (e) => e.preventDefault(), // keep the text selection in the page
      onclick: () => { closeCtx(); if (it.run) it.run(); } },
    h('span', { class: 'ctx-ic', html: it.icon ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${it.icon}</svg>` : '' }),
    h('span', { class: 'ctx-l' }, it.label), it.kbd ? h('kbd', null, it.kbd) : null));
  });
  if (!menu.children.length) return;
  const anchor = document.elementFromPoint(x, y); // what the menu was opened on (taken before the menu covers it)
  document.body.append(menu); ctxEl = menu;
  const r = menu.getBoundingClientRect();
  menu.style.left = Math.max(6, Math.min(x, innerWidth - r.width - 6)) + 'px';
  menu.style.top = Math.max(6, Math.min(y, innerHeight - r.height - 6)) + 'px';
  const buttons = () => Array.from(menu.querySelectorAll('.ctx-item:not(:disabled)'));
  const onDown = (e) => { if (!menu.contains(e.target)) closeCtx(); };
  const onKey = (e) => {
    const b = buttons(), i = b.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); closeCtx(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); (b[i + 1] || b[0]).focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); (b[i - 1] || b[b.length - 1]).focus(); }
  };
  document.addEventListener('mousedown', onDown, true);
  document.addEventListener('keydown', onKey, true);
  const opened = Date.now();
  // only scrolling of whatever the menu was opened on closes it; the sidebar following your click (a smooth scroll) must not
  const onScroll = (e) => { const t = e.target; if (Date.now() - opened > 250 && (t === document || !anchor || (t.contains && t.contains(anchor)))) closeCtx(); };
  window.addEventListener('blur', closeCtx); window.addEventListener('resize', closeCtx); document.addEventListener('scroll', onScroll, true);
  ctxCleanup = () => { document.removeEventListener('mousedown', onDown, true); document.removeEventListener('keydown', onKey, true); window.removeEventListener('blur', closeCtx); window.removeEventListener('resize', closeCtx); document.removeEventListener('scroll', onScroll, true); };
}

/* ---------- photo cropper: drag to position, zoom with the slider or mouse wheel, outputs a square JPEG ---------- */
export async function cropPhoto(source, { size = 480, shape = 'circle', title = 'Crop your photo', png = false } = {}) {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  const img = new Image();
  try { await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('Could not read that image')); img.src = url; }); }
  catch (e) { toast(e.message, 'err'); return null; }
  finally { if (typeof source !== 'string') setTimeout(() => URL.revokeObjectURL(url), 1000); }

  const V = 300, iw = img.naturalWidth, ih = img.naturalHeight, base = Math.max(V / iw, V / ih);
  let z = 1, x = 0, y = 0;
  const s = () => base * z;
  const clamp = () => { x = Math.min(0, Math.max(V - iw * s(), x)); y = Math.min(0, Math.max(V - ih * s(), y)); };
  x = (V - iw * s()) / 2; y = (V - ih * s()) / 2;

  const el = h('img', { src: img.src, alt: '', draggable: 'false', class: 'crop-img' });
  const guide = h('div', { class: 'crop-guide' + (shape === 'circle' ? ' round' : '') });
  const view = h('div', { class: 'crop-view', style: { width: V + 'px', height: V + 'px' } }, el, guide);
  const slider = h('input', { type: 'range', min: 1, max: 4, step: 0.01, value: 1, 'aria-label': 'Zoom' });
  const paint = () => { clamp(); Object.assign(el.style, { width: iw * s() + 'px', height: ih * s() + 'px', left: x + 'px', top: y + 'px' }); };
  const setZoom = (nz) => { const cx = (V / 2 - x) / s(), cy = (V / 2 - y) / s(); z = Math.min(4, Math.max(1, nz)); x = V / 2 - cx * s(); y = V / 2 - cy * s(); slider.value = z; paint(); };
  slider.addEventListener('input', () => setZoom(Number(slider.value)));
  view.addEventListener('wheel', (e) => { e.preventDefault(); setZoom(z * (e.deltaY < 0 ? 1.08 : 1 / 1.08)); }, { passive: false });
  view.addEventListener('pointerdown', (e) => {
    e.preventDefault(); view.setPointerCapture(e.pointerId); view.classList.add('drag');
    const sx = e.clientX, sy = e.clientY, ox = x, oy = y;
    const move = (ev) => { x = ox + ev.clientX - sx; y = oy + ev.clientY - sy; paint(); };
    const up = () => { view.classList.remove('drag'); view.removeEventListener('pointermove', move); view.removeEventListener('pointerup', up); };
    view.addEventListener('pointermove', move); view.addEventListener('pointerup', up);
  });
  paint();

  return modal(title, (close) => h('div', { class: 'crop' },
    view,
    h('label', { class: 'crop-zoom' }, h('span', null, '−'), slider, h('span', null, '+')),
    h('p', { class: 'muted small center' }, 'Drag the photo to position it, use the slider or scroll wheel to zoom.'),
    h('div', { class: 'pf-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => close(null) }, 'Cancel'),
      h('button', { type: 'button', class: 'btn primary', onclick: () => {
        const c = document.createElement('canvas'); c.width = c.height = size;
        const ctx = c.getContext('2d'); if (!png) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, size, size); }
        ctx.drawImage(img, -x / s(), -y / s(), V / s(), V / s(), 0, 0, size, size);
        close(png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.88));
      } }, png ? 'Use this image' : 'Use this photo'))), []);
}
