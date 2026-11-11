import * as api from './api.js';
import { h, toast, modal, confirmDlg, thumb, downloadBlob, photoDataUrl, logoDataUrl } from './ui.js';
import { topbar } from './dashboard.js';

const T = window.ERT, R = window.ERR;
const MM = 96 / 25.4;

export async function mountEditor(root, id) {
  const rec = await api.get('/api/resumes/' + id);
  let doc = T.normalizeDoc(rec.data);
  let title = rec.title;
  let tab = 'content';
  let zoomMode = 'fit', zoom = 1;
  const collapsed = new Set(); // section/entry ids that are folded
  const S = () => doc.settings;

  /* ---------------- autosave ---------------- */
  let dirty = false, saving = false, again = false, timer = null;
  const statusEl = h('span', { class: 'status' }, 'All changes saved');
  const setStatus = (t) => { statusEl.textContent = t; };
  async function save() {
    clearTimeout(timer); timer = null;
    if (saving) { again = true; return; }
    if (!dirty) return;
    saving = true; dirty = false; setStatus('Saving…');
    try {
      await api.put('/api/resumes/' + id, { title, data: doc });
      setStatus(dirty ? 'Unsaved changes…' : 'All changes saved');
    } catch (e) {
      dirty = true; setStatus('Save failed – retrying…'); timer = setTimeout(save, 4000);
    }
    saving = false;
    if (again) { again = false; save(); }
  }
  function touch() {
    dirty = true; setStatus('Unsaved changes…');
    clearTimeout(timer); timer = setTimeout(save, 800);
    scheduleSnapshot();
    schedulePreview();
  }
  const onKey = (e) => {
    const mod = e.ctrlKey || e.metaKey, key = e.key.toLowerCase();
    if (mod && key === 's') { e.preventDefault(); save(); return; }
    const t = e.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if (previewDoc) return;
    if (mod && !typing && key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    if (mod && !typing && key === 'y') { e.preventDefault(); redo(); }
  };
  const onUnload = (e) => { if (dirty || saving) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('keydown', onKey);
  window.addEventListener('beforeunload', onUnload);

  /* ---------------- tiny icon kit for the editor chrome ---------------- */
  const SVG = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  const ICO = {
    plus: '<path d="M12 5v14M5 12h14"/>', up: '<path d="M18 15l-6-6-6 6"/>', down: '<path d="M6 9l6 6 6-6"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    bold: '<path d="M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z"/>', italic: '<path d="M19 4h-9M14 20H5M15 4L9 20"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    unlink: '<path d="M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71M5.17 11.75l-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71M8 2v3M2 8h3M16 22v-3M22 16h-3"/>',
    undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>', redo: '<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 15-6.7L21 13"/>',
    grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    cols: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/>',
  };
  const ibtn = (name, title, fn, cls = '') => h('button', { type: 'button', class: 'fbtn ' + cls, title, 'aria-label': title, onmousedown: (e) => e.preventDefault(), onclick: fn, html: SVG(ICO[name]) });

  /* icon picker popover */
  let pickerEl = null;
  const closePicker = () => { if (pickerEl) { pickerEl.remove(); pickerEl = null; document.removeEventListener('mousedown', outsidePicker, true); } };
  function outsidePicker(e) { if (pickerEl && !pickerEl.contains(e.target)) closePicker(); }
  function iconPicker(current, onPick, anchor) {
    closePicker();
    pickerEl = h('div', { class: 'icon-pop' }, T.ICON_CHOICES.map((n) => h('button', { type: 'button', class: 'ip' + (n === current ? ' on' : ''), title: n || 'No icon', onmousedown: (e) => e.preventDefault(), onclick: () => { closePicker(); onPick(n); }, html: n ? R.icon(n) : '<span class="none">∅</span>' })));
    document.body.append(pickerEl);
    const r = anchor.getBoundingClientRect(), pw = pickerEl.offsetWidth, ph = pickerEl.offsetHeight;
    pickerEl.style.left = Math.max(8, Math.min(r.left, innerWidth - pw - 8)) + 'px';
    pickerEl.style.top = (r.bottom + ph + 12 > innerHeight ? Math.max(8, r.top - ph - 6) : r.bottom + 6) + 'px';
    setTimeout(() => document.addEventListener('mousedown', outsidePicker, true), 0);
  }
  const iconBtn = (current, onPick, title = 'Choose an icon') => {
    const b = h('button', { type: 'button', class: 'icon-pick', title, html: current ? R.icon(current) : '<span class="plus">+</span>' });
    b.addEventListener('click', () => iconPicker(current, onPick, b));
    return b;
  };

  /* ---------------- undo / redo ---------------- */
  const hist = [JSON.stringify(doc)], histTimes = [Date.now()], histDesc = [];
  let hi = 0, snapTimer = null, undoBtn = null, redoBtn = null;
  function syncUndo() { if (undoBtn) undoBtn.disabled = hi === 0; if (redoBtn) redoBtn.disabled = hi >= hist.length - 1; }
  function snapshot() {
    clearTimeout(snapTimer);
    const j = JSON.stringify(doc);
    if (j === hist[hi]) return;
    hist.length = hi + 1; histTimes.length = hi + 1; histDesc.length = hi + 1; hist.push(j); histTimes.push(Date.now());
    if (hist.length > 100) { hist.shift(); histTimes.shift(); histDesc.shift(); }
    hi = hist.length - 1; syncUndo(); if (histOpen) drawHistory();
  }
  const scheduleSnapshot = () => { clearTimeout(snapTimer); snapTimer = setTimeout(snapshot, 500); };
  function jumpTo(i) {
    doc = JSON.parse(hist[i]); hi = i; syncUndo();
    dirty = true; setStatus('Unsaved changes…'); clearTimeout(timer); timer = setTimeout(save, 800);
    hideFloats(); paintPreview(); drawPanel();
  }
  function undo() { snapshot(); if (hi > 0) jumpTo(hi - 1); }
  function redo() { if (hi < hist.length - 1) jumpTo(hi + 1); }

  /* ---------------- preview ---------------- */
  const pagesEl = h('span', { class: 'pages' });
  const stage = h('div', { class: 'stage' });
  const zoomWrap = h('div', { class: 'zoomwrap' });
  const scaler = h('div', { class: 'scaler' });
  const sheet = h('div', { class: 'sheet sheet-edit' });
  const bgEl = h('div', { class: 'rz-bg' });
  const guides = h('div', { class: 'guides' });
  const content = h('div', { class: 'sheet-content' });
  const floatLayer = h('div', { class: 'float-layer' });
  const itemBar = h('div', { class: 'float-bar item-bar' });
  const selBar = h('div', { class: 'float-bar sel-bar' });
  floatLayer.append(itemBar, selBar);
  sheet.append(bgEl, guides, content);
  scaler.append(sheet); zoomWrap.append(scaler); stage.append(zoomWrap, floatLayer);

  let raf = 0, needRepaint = false, measureT = null, activeEl = null, linkMode = false;
  function schedulePreview() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paintPreview(); }); }

  function paintPreview() {
    hideFloats();
    const d = curDoc(), m = d.settings.margins, [pw] = T.PAGE_MM[d.settings.pageSize], edit = !previewDoc;
    sheet.style.width = pw + 'mm';
    sheet.style.padding = `${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm`;
    sheet.classList.toggle('sheet-edit', edit);
    bgEl.setAttribute('style', R.pageBg(d, { edit, pageH: pageGeom().stride + 'px' }));
    content.innerHTML = R.render(d, { edit });
    needRepaint = false;
    measure();
  }
  /* ----- page-aware layout: the preview mirrors the PDF's pagination (entries and bullets never split across a page) ----- */
  const PAGE_VOID = 28; // px of background shown between two sheets in the preview
  const curDoc = () => previewDoc || doc;
  const pageGeom = () => {
    const m = curDoc().settings.margins, [, ph] = T.PAGE_MM[curDoc().settings.pageSize];
    // between two pages' content there is: bottom margin + visible void between the sheets + next page's top margin
    const cap = (ph - m.top - m.bottom) * MM, gap = (m.top + m.bottom) * MM + PAGE_VOID;
    return { cap, gap, stride: cap + gap };
  };
  const ATOMS = '.rz-entry, .rz-sg, .rz-li, .rz-lv, .rz-text';
  let spacers = [];
  /* groups: [{top,bottom}] in content px with no page pushes applied. Returns the push (px) needed before each group. */
  function planFlow(groups, g) {
    let shift = 0, end = 0;
    const pushes = groups.map((gr) => {
      const t = gr.top + shift, b = gr.bottom + shift, ps = Math.floor((t + 1e-3) / g.stride) * g.stride;
      let push = 0;
      if (t - ps > g.cap + 0.5) push = ps + g.stride - t; // starts inside the margin gap between pages
      else if (b > ps + g.cap + 0.5 && b - t <= g.cap) push = ps + g.stride - t; // would be cut by the page edge
      if (push < 0.5) push = 0;
      shift += push; end = Math.max(end, gr.bottom + shift);
      return push;
    });
    return { pushes, end };
  }
  /* a section's unbreakable groups: heading + first block stay together (break-after: avoid), then each block */
  function sectionGroups(sec, rel) {
    const h2 = sec.querySelector(':scope > .rz-h'), body = sec.querySelector(':scope > .rz-body');
    const atoms = Array.from(body.children).filter((c) => c.matches(ATOMS));
    const first = atoms.shift();
    const out = [{ el: h2, top: rel(h2)[0], bottom: rel(first || h2)[1] }];
    atoms.forEach((a) => { const [t, b] = rel(a); out.push({ el: a, top: t, bottom: b }); });
    return out;
  }
  const relTo = (base) => (el) => { const r = el.getBoundingClientRect(); return [(r.top - base) / zoom, (r.bottom - base) / zoom]; };
  function layoutPages() {
    spacers.forEach((e) => e.remove()); spacers = [];
    const rel = relTo(content.getBoundingClientRect().top), g = pageGeom();
    content.querySelectorAll('.rz-main, .rz-side').forEach((col) => {
      const groups = [];
      col.querySelectorAll(':scope > .rz-sec').forEach((sec) => groups.push(...sectionGroups(sec, rel)));
      const { pushes } = planFlow(groups, g);
      pushes.forEach((p, i) => {
        if (!p) return;
        const el = groups[i].el, sp = h(el.tagName === 'LI' ? 'li' : 'div', { class: 'pg-push', style: { height: p + 'px' } });
        el.before(sp); spacers.push(sp);
      });
    });
  }
  /* geometry with no pushes, for the arrange map */
  function sectionGeoms() {
    spacers.forEach((e) => { e.style.display = 'none'; });
    const rel = relTo(content.getBoundingClientRect().top), out = { secs: new Map() };
    content.querySelectorAll('.rz-sec').forEach((sec) => {
      const [t, b] = rel(sec);
      out.secs.set(sec.dataset.sid, { h: b - t, groups: sectionGroups(sec, rel).map((x) => ({ top: x.top - t, bottom: x.bottom - t })) });
    });
    const size = (sel) => { const e = content.querySelector(sel); return e ? rel(e)[1] - rel(e)[0] : 0; };
    out.header = size('.rz-header'); out.sideTop = size('.rz-side-top');
    const cols = content.querySelector('.rz-cols'); out.colsTop = cols ? rel(cols)[0] : 0;
    spacers.forEach((e) => { e.style.display = ''; });
    return out;
  }
  function measure() {
    const m = curDoc().settings.margins, g = pageGeom();
    applyZoom();
    layoutPages();
    const hh = content.firstChild ? content.firstChild.offsetHeight : 0;
    const pages = Math.max(1, Math.floor((hh - 0.5) / g.stride) + 1);
    sheet.style.minHeight = pages * g.stride - PAGE_VOID + 'px';
    // the void sits exactly between page k's bottom edge and page k+1's top edge, so both pages keep their full margins
    guides.replaceChildren(...Array.from({ length: pages - 1 }, (_, i) => h('div', { class: 'page-band', style: { top: (i + 1) * g.stride - PAGE_VOID + 'px', height: PAGE_VOID + 'px' } }, h('span', null, `Page ${i + 2}`))));
    pagesEl.textContent = pages + (pages === 1 ? ' page' : ' pages');
    pagesEl.classList.toggle('warn', pages > 2);
    applyZoom();
  }
  function applyZoom() {
    const pwPx = T.PAGE_MM[curDoc().settings.pageSize][0] * MM;
    if (zoomMode === 'fit') zoom = Math.min(1.25, Math.max(0.3, (stage.clientWidth - 40) / pwPx));
    scaler.style.transform = `scale(${zoom})`;
    zoomWrap.style.width = pwPx * zoom + 'px';
    zoomWrap.style.height = sheet.offsetHeight * zoom + 'px';
    zoomLabel.textContent = Math.round(zoom * 100) + '%';
  }
  const zoomLabel = h('span', { class: 'zoom-l' });
  const setZoom = (z) => { zoomMode = 'manual'; zoom = Math.min(2, Math.max(0.3, z)); applyZoom(); hideFloats(); };
  const ro = new ResizeObserver(() => { if (zoomMode === 'fit') applyZoom(); });
  ro.observe(stage);

  /* a lightweight change from typing in the preview: keep the DOM (and caret) intact */
  function touchLite() {
    dirty = true; setStatus('Unsaved changes…');
    clearTimeout(timer); timer = setTimeout(save, 800);
    scheduleSnapshot(); needRepaint = true;
    clearTimeout(measureT); measureT = setTimeout(() => { measure(); positionBars(); }, 60);
  }
  /* a structural change: repaint, optionally focus a field afterwards */
  function commit(focusId) {
    dirty = true; setStatus('Unsaved changes…');
    clearTimeout(timer); timer = setTimeout(save, 800);
    snapshot(); paintPreview();
    if (focusId) focusField(focusId);
    softPanel();
  }
  function softPanel() { if (tab === 'content' && !panelBody.contains(document.activeElement)) drawPanel(); }
  function focusField(id) {
    const el = content.querySelector(`[data-f="${id}"]`);
    if (!el) return;
    el.focus({ preventScroll: true });
    const r = document.createRange(); r.selectNodeContents(el.dataset.m === 'list' && el.lastElementChild ? el.lastElementChild : el); r.collapse(false);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  /* ----- reading/writing fields ----- */
  function toMarkup(root, multi) {
    let out = '', prev = '';
    const endNL = (n) => { const have = out.match(/\n*$/)[0].length; if (out && have < n) out += '\n'.repeat(n - have); };
    const walk = (n) => {
      if (n.nodeType === 3) { out += n.nodeValue.replace(/\u00a0/g, ' ').replace(/\u200b/g, ''); return; }
      if (n.nodeType !== 1) return;
      if (n.classList && n.classList.contains('pg-push')) return;
      const t = n.tagName;
      if (t === 'BR') { out += multi ? '\n' : ' '; return; }
      if (t === 'STRONG' || t === 'B') { out += '**'; n.childNodes.forEach(walk); out += '**'; return; }
      if (t === 'EM' || t === 'I') { out += '*'; n.childNodes.forEach(walk); out += '*'; return; }
      if (t === 'A') { const href = n.getAttribute('href') || ''; out += '['; n.childNodes.forEach(walk); out += href ? `](${href})` : ']'; return; }
      if (t === 'UL' || t === 'OL') { endNL(1); n.querySelectorAll(':scope > li').forEach((li) => { out += '- '; li.childNodes.forEach(walk); out += '\n'; }); prev = 'list'; return; }
      if (t === 'P' || t === 'DIV') { endNL(prev === 'list' ? 1 : 2); n.childNodes.forEach(walk); prev = 'p'; return; }
      n.childNodes.forEach(walk);
    };
    root.childNodes.forEach(walk);
    out = out.replace(/\*\*\*\*/g, '');
    return multi ? out.replace(/\n{3,}/g, '\n\n').replace(/(^|\n)(- [^\n]*)\n\n(?=- )/g, '$1$2\n').replace(/\n+$/, '') : out.replace(/\s+/g, ' ').replace(/^\s+/, '');
  }
  function readList(el) {
    const items = Array.from(el.querySelectorAll(':scope > li')).map((li) => toMarkup(li, false));
    if (!items.length) { const t = toMarkup(el, false); return t ? [t] : ['']; }
    return items;
  }
  const readField = (el) => (el.dataset.m === 'list' ? readList(el) : el.dataset.m === 'line' ? el.textContent.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ') : toMarkup(el, el.dataset.m === 'multi'));
  function applyField(id, val) {
    const p = id.split(':'), k = p[0];
    if (k === 'H') { doc.header[p[1]] = val; return; }
    if (k === 'C') { const c = doc.header.contacts.find((x) => x.id === p[1]); if (c) c.text = val; return; }
    const sec = doc.sections.find((x) => x.id === p[1]); if (!sec) return;
    if (k === 'S') { sec.title = val; return; }
    const it = sec.items.find((x) => x.id === p[2]); if (!it) return;
    if (k === 'BL') it.bullets = val.length ? val : ['']; else if (k === 'B') it.bullets[+p[3]] = val; else if (k === 'T') it.tags[+p[3]] = val; else it[p[3]] = val;
  }
  const fieldOf = (n) => { const e = n && (n.nodeType === 1 ? n : n.parentElement); return e && e.closest ? e.closest('[data-f]') : null; };

  /* ----- context actions ----- */
  const KIND_LABEL = { entries: 'Entry', skills: 'Group', list: 'Item', levels: 'Language' };
  const kindOf = (sec) => T.SECTION_TYPES[sec.type].kind;
  const firstField = (sec, it) => ({ entries: `E:${sec.id}:${it.id}:title`, skills: `G:${sec.id}:${it.id}:name`, list: `L:${sec.id}:${it.id}:title`, levels: `V:${sec.id}:${it.id}:name`, text: `X:${sec.id}:${it.id}:text` }[kindOf(sec)]);
  function moveSection(sec, dir) {
    const two = S().layout !== 'single';
    let i = doc.sections.indexOf(sec) + dir;
    while (i >= 0 && i < doc.sections.length && two && (doc.sections[i].column === 'side') !== (sec.column === 'side')) i += dir;
    if (i < 0 || i >= doc.sections.length) return;
    const j = doc.sections.indexOf(sec);
    doc.sections.splice(j, 1); doc.sections.splice(i, 0, sec);
    commit(`S:${sec.id}:title`);
  }
  function moveItem(sec, it, dir) {
    const i = sec.items.indexOf(it), j = i + dir;
    if (j < 0 || j >= sec.items.length) return;
    sec.items.splice(i, 1); sec.items.splice(j, 0, it);
    commit(firstField(sec, it));
  }
  function addSibling(id) {
    const p = id.split(':'), sec = doc.sections.find((x) => x.id === p[1]), it = sec.items.find((x) => x.id === p[2]), i = +p[3];
    const arr = p[0] === 'B' ? it.bullets : it.tags;
    arr.splice(i + 1, 0, '');
    commit(`${p[0]}:${p[1]}:${p[2]}:${i + 1}`);
  }
  function removeSibling(id) {
    const p = id.split(':'), sec = doc.sections.find((x) => x.id === p[1]), it = sec.items.find((x) => x.id === p[2]), i = +p[3];
    const arr = p[0] === 'B' ? it.bullets : it.tags;
    if (arr.length <= 1) return;
    arr.splice(i, 1);
    commit(`${p[0]}:${p[1]}:${p[2]}:${Math.max(0, i - 1)}`);
  }
  function gotoPanel(sid) {
    tab = 'content'; if (sid) collapsed.delete(sid); drawPanel();
    const el = panelBody.querySelector(sid ? `[data-sid="${sid}"]` : '#hdr-card');
    if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1200); }
  }
  function uploadPhoto() {
    const f = h('input', { type: 'file', accept: 'image/*', onchange: async () => {
      if (!f.files[0]) return;
      try { doc.header.photo = await photoDataUrl(f.files[0]); if (S().header.photoShape === 'none') S().header.photoShape = 'circle'; commit(); } catch (ex) { toast(ex.message, 'err'); }
    } });
    f.click();
  }

  /* ----- floating bars ----- */
  function placeBar(bar, rect) {
    const st = stage.getBoundingClientRect();
    bar.style.display = 'flex';
    const bw = bar.offsetWidth, bh = bar.offsetHeight;
    let y = rect.top - st.top + stage.scrollTop - bh - 8;
    if (rect.top - st.top < bh + 14) y = rect.bottom - st.top + stage.scrollTop + 8;
    let x = rect.left - st.left + stage.scrollLeft;
    x = Math.max(stage.scrollLeft + 8, Math.min(x, stage.scrollLeft + stage.clientWidth - bw - 8));
    bar.style.left = x + 'px'; bar.style.top = y + 'px';
  }
  function hideFloats() {
    itemBar.style.display = 'none'; itemBar.style.visibility = ''; selBar.style.display = 'none'; linkMode = false;
    content.querySelectorAll('.is-active').forEach((e) => e.classList.remove('is-active'));
    activeEl = null;
  }
  function positionBars() {
    if (activeEl && activeEl.isConnected && itemBar.style.display !== 'none') placeBar(itemBar, activeEl.getBoundingClientRect());
    if (selBar.style.display !== 'none') onSelection();
  }

  function showItemBar(f) {
    const p = f.dataset.f.split(':'), k = p[0];
    content.querySelectorAll('.is-active').forEach((e) => e.classList.remove('is-active'));
    const btns = [];
    let target = f;
    const sec = doc.sections.find((x) => x.id === p[1]);
    if (k === 'H' || k === 'C') {
      target = f.closest('.rz-header') || f;
      btns.push(ibtn('camera', 'Upload photo', uploadPhoto), ibtn('sliders', 'Edit header in sidebar', () => gotoPanel(null)));
    } else if (k === 'S' && sec) {
      target = f.closest('.rz-h');
      btns.push(ibtn('up', 'Move section up', () => moveSection(sec, -1)), ibtn('down', 'Move section down', () => moveSection(sec, 1)));
      if (S().layout !== 'single') btns.push(ibtn('cols', sec.column === 'side' ? 'Move to main column' : 'Move to sidebar', () => { sec.column = sec.column === 'side' ? 'main' : 'side'; commit(`S:${sec.id}:title`); }));
      const ic = ibtn('star', 'Section icon', () => iconPicker(sec.icon, (v) => { sec.icon = v; commit(`S:${sec.id}:title`); }, ic));
      btns.push(ic, ibtn('trash', 'Delete section', async () => { if (await confirmDlg('Delete section', `Delete the “${sec.title}” section?`)) { doc.sections.splice(doc.sections.indexOf(sec), 1); commit(); hideFloats(); } }, 'danger'), ibtn('sliders', 'Edit in sidebar', () => gotoPanel(sec.id)));
    } else if (sec) {
      const it = sec.items.find((x) => x.id === p[2]); if (!it) return;
      target = f.closest('[data-iid]');
      const kind = kindOf(sec);
      if (KIND_LABEL[kind]) btns.push(h('button', { type: 'button', class: 'fbtn add', onmousedown: (e) => e.preventDefault(), onclick: () => { const n = T.newItem(sec.type); sec.items.splice(sec.items.indexOf(it) + 1, 0, n); commit(firstField(sec, n)); } }, h('span', { html: SVG(ICO.plus) }), KIND_LABEL[kind]));
      if (kind === 'entries') btns.push(ibtn('plus', 'Add bullet point', () => { it.bullets.push(''); commit(`BL:${sec.id}:${it.id}`); }, 'txt'));
      if (kind === 'skills') btns.push(ibtn('plus', 'Add skill', () => { it.tags.push(''); commit(`T:${sec.id}:${it.id}:${it.tags.length - 1}`); }, 'txt'));
      if (KIND_LABEL[kind]) btns.push(ibtn('up', 'Move up', () => moveItem(sec, it, -1)), ibtn('down', 'Move down', () => moveItem(sec, it, 1)), ibtn('copy', 'Duplicate', () => { const c = Object.assign(T.clone(it), { id: T.uid() }); sec.items.splice(sec.items.indexOf(it) + 1, 0, c); commit(firstField(sec, c)); }));
      if (kind === 'entries' || kind === 'list') { const ic = ibtn('star', 'Icon', () => iconPicker(it.icon, (v) => { it.icon = v; commit(f.dataset.f); }, ic)); btns.push(ic); }
      if (KIND_LABEL[kind]) btns.push(ibtn('trash', 'Delete', () => { sec.items.splice(sec.items.indexOf(it), 1); commit(); hideFloats(); }, 'danger'));
      btns.push(ibtn('sliders', 'Edit in sidebar', () => gotoPanel(sec.id)));
    }
    if (!btns.length) { itemBar.style.display = 'none'; return; }
    itemBar.replaceChildren(...btns);
    if (target) target.classList.add('is-active');
    activeEl = target;
    placeBar(itemBar, target.getBoundingClientRect());
  }

  /* selection (formatting) bar */
  const execFmt = (cmd, val) => { document.execCommand(cmd, false, val); const f = fieldOf(getSelection().anchorNode); if (f) { applyField(f.dataset.f, readField(f)); touchLite(); } onSelection(); };
  function normUrl(u) {
    u = u.trim(); if (!u) return '';
    if (!/^(https?:|mailto:|tel:)/i.test(u)) u = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u) ? 'mailto:' + u : 'https://' + u;
    return R.safeUrl(u);
  }
  function onSelection() {
    if (linkMode) return;
    const sel = getSelection();
    const hideSel = () => { selBar.style.display = 'none'; itemBar.style.visibility = ''; };
    if (!sel || !sel.rangeCount || sel.isCollapsed) { hideSel(); return; }
    const f = fieldOf(sel.anchorNode);
    if (!f || !content.contains(f) || f.dataset.m === 'line') { hideSel(); return; }
    itemBar.style.visibility = 'hidden'; // the formatting bar takes over while text is selected
    const st = (c) => { try { return document.queryCommandState(c); } catch { return false; } };
    const boldByDefault = Number(getComputedStyle(f).fontWeight) >= 600; // headings/titles are already bold
    selBar.replaceChildren(
      boldByDefault ? null : ibtn('bold', 'Bold (Ctrl+B)', () => execFmt('bold'), st('bold') ? 'on' : ''), ibtn('italic', 'Italic (Ctrl+I)', () => execFmt('italic'), st('italic') ? 'on' : ''),
      ibtn('link', 'Add link', () => startLink(f), ''), ibtn('unlink', 'Remove link', () => execFmt('unlink')));
    placeBar(selBar, sel.getRangeAt(0).getBoundingClientRect());
  }
  function startLink(f) {
    const sel = getSelection(), saved = sel.getRangeAt(0).cloneRange();
    linkMode = true;
    const inp = h('input', { type: 'text', class: 'link-in', placeholder: 'Paste a link and press Enter' });
    const apply = () => {
      const url = normUrl(inp.value);
      linkMode = false;
      sel.removeAllRanges(); sel.addRange(saved); f.focus();
      if (url) execFmt('createLink', url); else onSelection();
    };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } if (e.key === 'Escape') { linkMode = false; sel.removeAllRanges(); sel.addRange(saved); f.focus(); } });
    selBar.replaceChildren(inp, h('button', { type: 'button', class: 'fbtn add', onclick: apply }, 'Apply'));
    placeBar(selBar, saved.getBoundingClientRect());
    inp.focus();
  }
  document.addEventListener('selectionchange', onSelection);
  try { document.execCommand('styleWithCSS', false, false); document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* optional */ }

  /* ----- events on the editable page ----- */
  content.addEventListener('focusin', (e) => {
    const f = fieldOf(e.target);
    if (f) showItemBar(f); else { itemBar.style.display = 'none'; }
  });
  content.addEventListener('focusout', () => setTimeout(() => {
    const a = document.activeElement;
    if (content.contains(a) || floatLayer.contains(a) || (pickerEl && pickerEl.contains(a))) return;
    hideFloats();
    if (needRepaint) { paintPreview(); softPanel(); }
  }, 0));
  content.addEventListener('input', (e) => {
    const f = fieldOf(e.target); if (!f) return;
    applyField(f.dataset.f, readField(f)); touchLite();
  });
  content.addEventListener('paste', (e) => {
    const f = fieldOf(e.target); if (!f) return;
    e.preventDefault();
    let t = (e.clipboardData || window.clipboardData).getData('text/plain');
    if (f.dataset.m === 'list') { // each pasted line becomes its own bullet
      t.split(/\r?\n/).map((x) => x.replace(/^\s*[-•*]\s+/, '')).filter((x, i, a) => x || a.length === 1).forEach((line, i) => { if (i) document.execCommand('insertParagraph'); document.execCommand('insertText', false, line); });
      return;
    }
    if (f.dataset.m !== 'multi') t = t.replace(/\s*\n\s*/g, ' ');
    document.execCommand('insertText', false, t);
  });
  content.addEventListener('keydown', (e) => {
    const f = fieldOf(e.target); if (!f) return;
    const mod = e.ctrlKey || e.metaKey, key = e.key.toLowerCase();
    if (mod && key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if (mod && (key === 'y' || (key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
    if (e.key === 'Escape') { f.blur(); return; }
    const id = f.dataset.f, k = id[0];
    if (e.key === 'Enter' && f.dataset.m !== 'multi' && f.dataset.m !== 'list') { e.preventDefault(); if (k === 'T') addSibling(id); else f.blur(); return; }
    if (e.key === 'Backspace' && k === 'T' && !f.textContent.length) { e.preventDefault(); removeSibling(id); }
  });
  content.addEventListener('click', (e) => {
    const lv = e.target.closest('[data-lv]');
    const row = e.target.closest('[data-iid]'), secEl = e.target.closest('[data-sid]');
    const sec = secEl && doc.sections.find((x) => x.id === secEl.dataset.sid), it = sec && row && sec.items.find((x) => x.id === row.dataset.iid);
    if (lv && it) {
      let n = Number(lv.dataset.lv);
      if (!n) { const r = lv.getBoundingClientRect(); n = Math.max(0, Math.min(5, Math.round(((e.clientX - r.left) / r.width) * 5))); }
      it.level = it.level === n ? n - 1 : n; commit(); return;
    }
    const pick = e.target.closest('[data-pick]');
    if (pick && sec) {
      const kind = pick.dataset.pick;
      if (kind === 'section') iconPicker(sec.icon, (v) => { sec.icon = v; commit(); }, pick);
      else if (it) iconPicker(it.icon, (v) => { it.icon = v; commit(); }, pick);
      return;
    }
    if (e.target.closest('img.rz-photo')) uploadPhoto();
  });
  stage.addEventListener('mousedown', (e) => { if (e.target === stage || e.target === zoomWrap) { if (document.activeElement && content.contains(document.activeElement)) document.activeElement.blur(); } });

  /* ---------------- generic form controls ---------------- */
  const field = (label, el, cls) => h('label', { class: 'f ' + (cls || '') }, h('span', null, label), el);
  function input(label, get, set, o = {}) {
    const el = h(o.area ? 'textarea' : 'input', { type: o.area ? null : 'text', value: get(), placeholder: o.ph || '', rows: o.rows || 3, maxlength: o.max || 300, class: o.area ? 'auto' : '' });
    el.addEventListener('input', () => { set(el.value); touch(); });
    return field(label, el, o.cls);
  }
  const getPath = (o, p) => p.split('.').reduce((a, k) => a[k], o);
  function setP(path, v) { const ks = path.split('.'); let o = doc.settings; while (ks.length > 1) o = o[ks.shift()]; o[ks[0]] = v; }
  const getP = (path) => getPath(doc.settings, path);

  function seg(label, path, opts, after) { // segmented control; opts: [[value,label],...]
    const wrap = h('div', { class: 'seg' });
    const draw = () => wrap.replaceChildren(...opts.map(([v, l]) => h('button', { type: 'button', class: getP(path) === v ? 'on' : '', onclick: () => { setP(path, v); touch(); draw(); if (after) after(); } }, l)));
    draw();
    return field(label, wrap);
  }
  function range(label, path, min, max, step, unit = '') {
    const out = h('output', null, getP(path) + unit);
    const el = h('input', { type: 'range', min, max, step, value: getP(path) });
    el.addEventListener('input', () => { setP(path, Number(el.value)); out.textContent = el.value + unit; touch(); });
    return field(label, h('div', { class: 'rng' }, el, out));
  }
  function color(label, path) {
    const el = h('input', { type: 'color', value: getP(path) });
    const hex = h('input', { type: 'text', class: 'hex', value: getP(path), maxlength: 7 });
    el.addEventListener('input', () => { setP(path, el.value); hex.value = el.value; touch(); });
    hex.addEventListener('change', () => { if (/^#[0-9a-f]{6}$/i.test(hex.value)) { setP(path, hex.value); el.value = hex.value; touch(); } else hex.value = getP(path); });
    return field(label, h('div', { class: 'clr' }, el, hex));
  }
  function select(label, path, opts) {
    const el = h('select', null, opts.map(([v, l]) => h('option', { value: v, selected: getP(path) === v, style: path.startsWith('font') ? { fontFamily: `'${v}'` } : null }, l)));
    el.addEventListener('change', () => { setP(path, el.value); touch(); });
    return field(label, el);
  }
  function toggle(label, path) {
    const el = h('input', { type: 'checkbox', checked: !!getP(path) });
    el.addEventListener('change', () => { setP(path, el.checked); touch(); });
    return h('label', { class: 'check' }, el, label);
  }
  // open/closed state of collapsible groups survives panel redraws (picking a pattern, color theme, layout... redraws the panel)
  const openState = new Map();
  const remember = (key, d) => { d.addEventListener('toggle', () => openState.set(key, d.open)); return d; };
  const group = (name, open, ...kids) => remember(name, h('details', { class: 'grp', open: openState.has(name) ? openState.get(name) : open }, h('summary', null, name), h('div', { class: 'grp-b' }, kids)));

  /* ---------------- sortable lists (drag & drop) ---------------- */
  // arr is the backing data array; renderRow(i, redraw) builds a draggable row. Rows can move between lists sharing a group.
  function sortList(container, arr, renderRow, o = {}) {
    const redraw = () => container.replaceChildren(...arr.map((_, i) => renderRow(i, redraw)));
    container._arr = arr; container._redraw = redraw; redraw();
    Sortable.create(container, {
      group: o.group, handle: o.handle || '.grip', animation: 150, ghostClass: 'drag-ghost', chosenClass: 'drag-chosen', fallbackOnBody: true, swapThreshold: 0.6,
      onEnd: (e) => {
        const from = e.from._arr, to = e.to._arr;
        if (!from || !to) return;
        const [x] = from.splice(e.oldIndex, 1);
        to.splice(e.newIndex, 0, x);
        setTimeout(() => { e.from._redraw(); if (e.to !== e.from) e.to._redraw(); touch(); }, 0);
      },
    });
    return redraw;
  }
  const grip = () => h('span', { class: 'grip', title: 'Drag to reorder' }, '⋮⋮');
  const xBtn = (fn, title = 'Remove') => h('button', { type: 'button', class: 'icon-btn x', title, onclick: fn }, '×');

  function autosize(ta) {
    const f = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px'; };
    ta.addEventListener('input', f); requestAnimationFrame(f); return ta;
  }

  /* ---------------- content: header card ---------------- */
  function headerCard() {
    const hd = doc.header;
    const photoIn = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' }, onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { hd.photo = await photoDataUrl(f); if (S().header.photoShape === 'none') S().header.photoShape = 'circle'; touch(); drawPanel(); } catch (ex) { toast(ex.message, 'err'); }
    } });
    const contacts = h('div', { class: 'rows' });
    sortList(contacts, hd.contacts, (i, redraw) => {
      const c = hd.contacts[i];
      const ic = h('select', { class: 'ic-sel' }, T.CONTACT_ICONS.map((n) => h('option', { value: n, selected: c.icon === n }, n)));
      ic.addEventListener('change', () => { c.icon = ic.value; touch(); });
      const tx = h('input', { type: 'text', value: c.text, placeholder: 'Text', maxlength: 200 }); tx.addEventListener('input', () => { c.text = tx.value; touch(); });
      const lk = h('input', { type: 'text', value: c.link, placeholder: 'Link (optional)', maxlength: 300 }); lk.addEventListener('input', () => { c.link = lk.value; touch(); });
      return h('div', { class: 'row contact' }, grip(), ic, h('div', { class: 'stack' }, tx, lk), xBtn(() => { hd.contacts.splice(i, 1); redraw(); touch(); }));
    }, { group: 'contacts' });
    return h('div', { class: 'card hdr', id: 'hdr-card' },
      h('div', { class: 'card-h static' }, h('b', null, 'Header & contact')),
      h('div', { class: 'card-body' },
        input('Full name', () => hd.name, (v) => { hd.name = v; }),
        input('Job title', () => hd.title, (v) => { hd.title = v; }),
        input('Tagline (optional)', () => hd.tagline, (v) => { hd.tagline = v; }),
        h('div', { class: 'photo-row' },
          hd.photo ? h('img', { class: 'photo-prev', src: hd.photo }) : h('div', { class: 'photo-prev empty' }, '📷'),
          h('div', null, h('button', { class: 'btn small', onclick: () => photoIn.click() }, hd.photo ? 'Change photo' : 'Upload photo'),
            hd.photo ? h('button', { class: 'btn small danger-t', onclick: () => { hd.photo = ''; touch(); drawPanel(); } }, 'Remove') : null), photoIn),
        h('div', { class: 'f-lbl' }, 'Contact details'), contacts,
        h('button', { class: 'btn small', onclick: () => { if (hd.contacts.length < 10) { hd.contacts.push({ id: T.uid(), icon: 'link', text: '', link: '' }); contacts._redraw(); touch(); } } }, '+ Add contact')));
  }

  /* ---------------- content: section bodies ---------------- */
  function bulletsEditor(it) {
    const box = h('div', { class: 'rows bullets' });
    sortList(box, it.bullets, (i, redraw) => {
      const ta = autosize(h('textarea', { rows: 1, maxlength: 1200, value: it.bullets[i], placeholder: 'Describe an achievement…' }));
      ta.addEventListener('input', () => { it.bullets[i] = ta.value; touch(); });
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); it.bullets.splice(i + 1, 0, ''); redraw(); touch(); box.children[i + 1].querySelector('textarea').focus(); }
        if (e.key === 'Backspace' && !ta.value && it.bullets.length > 1) { e.preventDefault(); it.bullets.splice(i, 1); redraw(); touch(); const p = box.children[Math.max(0, i - 1)]; if (p) p.querySelector('textarea').focus(); }
      });
      return h('div', { class: 'row bullet' }, grip(), ta, xBtn(() => { it.bullets.splice(i, 1); redraw(); touch(); }));
    }, { group: 'bullets' });
    return h('div', null, box, h('button', { class: 'btn small', onclick: () => { it.bullets.push(''); box._redraw(); touch(); box.lastChild.querySelector('textarea').focus(); } }, '+ Bullet'));
  }

  function logoField(it) {
    const f = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' }, onchange: async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try { it.logo = await logoDataUrl(file); touch(); drawPanel(); } catch (ex) { toast(ex.message, 'err'); }
    } });
    return h('div', { class: 'logo-row' }, it.logo ? h('img', { src: it.logo }) : h('span', { class: 'muted' }, 'No logo'),
      h('button', { class: 'btn small', onclick: () => f.click() }, it.logo ? 'Change logo' : 'Add logo / icon'),
      it.logo ? h('button', { class: 'btn small danger-t', onclick: () => { it.logo = ''; touch(); drawPanel(); } }, 'Remove') : null, f);
  }

  function entryRow(sec, arr, i, redraw) {
    const it = arr[i], lbl = T.SECTION_TYPES[sec.type].labels;
    const name = h('span', { class: 'row-title' }, it.title || it.org || 'New entry');
    const upd = () => { name.textContent = it.title || it.org || 'New entry'; };
    const body = h('div', { class: 'card-body' },
      input(lbl.title, () => it.title, (v) => { it.title = v; upd(); }),
      input(lbl.org, () => it.org, (v) => { it.org = v; upd(); }),
      h('div', { class: 'two' },
        input('Date', () => it.date, (v) => { it.date = v; }, { ph: '01/2022 - Present' }),
        input('Location', () => it.location, (v) => { it.location = v; })),
      input('Link (optional)', () => it.orgLink, (v) => { it.orgLink = v; }, { ph: 'https://' }),
      h('div', { class: 'logo-row' }, h('span', { class: 'f-lbl', style: { margin: 0 } }, 'Icon'), iconBtn(it.icon, (v) => { it.icon = v; touch(); drawPanel(); }, 'Icon shown beside this entry'), h('span', { class: 'muted small' }, 'or upload a logo:')),
      logoField(it),
      input('Description (supports **bold**, *italic*, [link](url), "- " bullets)', () => it.text, (v) => { it.text = v; }, { area: true, rows: 2, max: 3000 }),
      h('div', { class: 'f-lbl' }, 'Bullet points'), bulletsEditor(it));
    const isCol = collapsed.has(it.id);
    const row = h('div', { class: 'card entry' + (isCol ? ' folded' : '') },
      h('div', { class: 'card-h' }, grip(), h('button', { class: 'fold', onclick: () => { row.classList.toggle('folded'); row.classList.contains('folded') ? collapsed.add(it.id) : collapsed.delete(it.id); } }, '▾'), name,
        h('button', { class: 'icon-btn', title: 'Duplicate', onclick: () => { arr.splice(i + 1, 0, Object.assign(T.clone(it), { id: T.uid() })); redraw(); touch(); } }, '⧉'),
        xBtn(() => { arr.splice(i, 1); redraw(); touch(); }, 'Delete entry')), body);
    return row;
  }

  function skillGroupRow(arr, i, redraw) {
    const g = arr[i];
    const tags = h('div', { class: 'tags' });
    sortList(tags, g.tags, (j, rd) => {
      const el = h('input', { type: 'text', value: g.tags[j], maxlength: 80, size: Math.max(3, g.tags[j].length + 1) });
      el.addEventListener('input', () => { g.tags[j] = el.value; el.size = Math.max(3, el.value.length + 1); touch(); });
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); g.tags.splice(j + 1, 0, ''); rd(); touch(); tags.children[j + 1].querySelector('input').focus(); } if (e.key === 'Backspace' && !el.value && g.tags.length > 1) { e.preventDefault(); g.tags.splice(j, 1); rd(); touch(); const p = tags.children[Math.max(0, j - 1)]; if (p) p.querySelector('input').focus(); } });
      return h('span', { class: 'tag', title: 'Drag to reorder' }, el, h('button', { class: 'tx', type: 'button', onclick: () => { g.tags.splice(j, 1); rd(); touch(); } }, '×'));
    }, { group: 'tags', handle: '.tag' , filter: 'input' , preventOnFilter: false });
    return h('div', { class: 'card group' },
      h('div', { class: 'card-h static' }, grip(), h('input', { class: 'bare', type: 'text', value: g.name, placeholder: 'Group name', maxlength: 80, oninput: (e) => { g.name = e.target.value; touch(); } }),
        xBtn(() => { arr.splice(i, 1); redraw(); touch(); }, 'Delete group')),
      h('div', { class: 'card-body' }, tags, h('button', { class: 'btn small', onclick: () => { g.tags.push(''); tags._redraw(); touch(); tags.lastChild.querySelector('input').focus(); } }, '+ Item')));
  }

  function listRow(sec, arr, i, redraw) {
    const it = arr[i];
    const ic = iconBtn(it.icon, (v) => { it.icon = v; touch(); redraw(); });
    const t = h('input', { type: 'text', value: it.title, placeholder: 'Title', maxlength: 200 }); t.addEventListener('input', () => { it.title = t.value; touch(); });
    const s = h('input', { type: 'text', value: it.sub, placeholder: 'Subtitle (optional)', maxlength: 200 }); s.addEventListener('input', () => { it.sub = s.value; touch(); });
    return h('div', { class: 'row contact' }, grip(), ic, h('div', { class: 'stack' }, t, s), xBtn(() => { arr.splice(i, 1); redraw(); touch(); }));
  }

  function levelRow(sec, arr, i, redraw) {
    const it = arr[i];
    const n = h('input', { type: 'text', value: it.name, placeholder: 'Language', maxlength: 80 }); n.addEventListener('input', () => { it.name = n.value; touch(); });
    const l = h('input', { type: 'text', value: it.label, placeholder: 'Level label (e.g. Native)', maxlength: 60 }); l.addEventListener('input', () => { it.label = l.value; touch(); });
    const dots = h('div', { class: 'lvl' });
    const dd = () => dots.replaceChildren(...[1, 2, 3, 4, 5].map((k) => h('button', { type: 'button', class: k <= it.level ? 'on' : '', onclick: () => { it.level = it.level === k ? k - 1 : k; touch(); dd(); } })));
    dd();
    return h('div', { class: 'row contact' }, grip(), h('div', { class: 'stack' }, n, l, dots), xBtn(() => { arr.splice(i, 1); redraw(); touch(); }));
  }

  function itemsEditor(sec) {
    const kind = T.SECTION_TYPES[sec.type].kind;
    if (kind === 'text') {
      if (!sec.items.length) sec.items.push(T.newItem(sec.type));
      return input('Text (supports **bold**, *italic*, [link](url) and "- " bullets)', () => sec.items[0].text, (v) => { sec.items[0].text = v; }, { area: true, rows: 5, max: 6000 });
    }
    const box = h('div', { class: 'rows items kind-' + kind });
    const renderers = { entries: entryRow, skills: (s, a, i, r) => skillGroupRow(a, i, r), list: listRow, levels: levelRow };
    const fn = renderers[kind];
    sortList(box, sec.items, (i, redraw) => fn(sec, sec.items, i, redraw), { group: 'items-' + kind });
    const label = { entries: '+ Add entry', skills: '+ Add group', list: '+ Add item', levels: '+ Add language' }[kind];
    return h('div', null, box, h('button', { class: 'btn small primary-o', onclick: () => { sec.items.push(T.newItem(sec.type)); box._redraw(); touch(); } }, label));
  }

  function sectionCard(sec) {
    const isFolded = collapsed.has(sec.id);
    const twoCol = S().layout !== 'single';
    const card = h('div', { class: 'card sec' + (isFolded ? ' folded' : ''), 'data-sid': sec.id },
      h('div', { class: 'card-h' }, grip(),
        h('button', { class: 'fold', onclick: () => { card.classList.toggle('folded'); card.classList.contains('folded') ? collapsed.add(sec.id) : collapsed.delete(sec.id); } }, '▾'),
        iconBtn(sec.icon, (v) => { sec.icon = v; touch(); drawPanel(); }, 'Section heading icon'),
        h('input', { class: 'bare title', type: 'text', value: sec.title, maxlength: 80, oninput: (e) => { sec.title = e.target.value; touch(); } }),
        h('span', { class: 'chip-type' }, T.SECTION_TYPES[sec.type].label),
        twoCol ? h('button', { class: 'icon-btn', title: sec.column === 'side' ? 'Move to main column' : 'Move to sidebar', onclick: () => { sec.column = sec.column === 'side' ? 'main' : 'side'; touch(); drawPanel(); } }, sec.column === 'side' ? '◧' : '◨') : null,
        xBtn(async () => { if (await confirmDlg('Delete section', `Delete the “${sec.title}” section?`)) { doc.sections.splice(doc.sections.indexOf(sec), 1); touch(); drawPanel(); } }, 'Delete section')),
      h('div', { class: 'card-body' }, itemsEditor(sec)));
    return card;
  }

  function contentTab() {
    const wrap = h('div', { class: 'tab-content' }, headerCard());
    const twoCol = S().layout !== 'single';
    const zones = twoCol ? [['main', 'Main column'], ['side', 'Sidebar']] : [['main', 'Sections']];
    const zoneEls = [];
    for (const [key, label] of zones) {
      const z = h('div', { class: 'zone', 'data-col': key });
      const secs = doc.sections.filter((s) => !twoCol || (s.column === 'side' ? 'side' : 'main') === key);
      z.append(...secs.map(sectionCard));
      Sortable.create(z, {
        group: 'sections', handle: '.sec > .card-h > .grip', animation: 150, ghostClass: 'drag-ghost', chosenClass: 'drag-chosen', fallbackOnBody: true, swapThreshold: 0.6,
        draggable: '.sec',
        onEnd: () => { // rebuild flat order from the DOM
          const byId = new Map(doc.sections.map((s) => [s.id, s]));
          const next = [];
          zoneEls.forEach(({ key: k, el }) => el.querySelectorAll(':scope > .sec').forEach((c) => { const s = byId.get(c.dataset.sid); if (s) { if (twoCol) s.column = k; next.push(s); } }));
          doc.sections = next; touch();
        },
      });
      zoneEls.push({ key, el: z });
      wrap.append(h('div', { class: 'zone-wrap' }, h('div', { class: 'zone-h' }, label, twoCol ? h('small', null, ' – drag sections between columns') : h('small', null, ' – drag to reorder')), z));
    }
    wrap.append(h('button', { class: 'btn primary wide add-big', onclick: openGallery }, h('span', { html: SVG(ICO.plus) }), 'Add a section'));
    return wrap;
  }

  /* design tab helpers: layout thumbnails, background tiles, simple sliders */
  function layoutPicker() {
    const opts = [['Single', 'single', 100, 'single'], ['Sidebar right', 'side-right', 70, 'r'], ['Wide right', 'side-right', 56, 'r'], ['Sidebar left', 'side-left', 70, 'l']];
    const wrap = h('div', { class: 'lay-pick' });
    const draw = () => wrap.replaceChildren(...opts.map(([label, layout, ratio, shape]) => {
      const on = S().layout === layout && (layout === 'single' || Math.abs(S().columnRatio - ratio) < 8);
      const main = h('i', { class: 'm', style: { flex: layout === 'single' ? 1 : ratio } }), side = h('i', { class: 's', style: { flex: layout === 'single' ? 0 : 100 - ratio } });
      return h('button', { type: 'button', class: 'lay' + (on ? ' on' : ''), title: label, onclick: () => { S().layout = layout; if (layout !== 'single') S().columnRatio = ratio; touch(); drawPanel(); } },
        h('span', { class: 'lay-prev' }, layout === 'side-left' ? [side, main] : [main, side]), h('small', null, label));
    }));
    draw();
    return wrap;
  }
  function patternGrid() {
    const accents = T.ACCENT_PATTERNS, tiles = T.ENUMS['pattern.type'].filter((t) => t !== 'none' && !accents.includes(t));
    const tile = (t) => {
      const acc = accents.includes(t);
      const layer = t === 'none' ? null : R.patternLayer({ type: t, color: '#64748b', opacity: acc ? 0.9 : 0.7, scale: t === 'circles' ? 0.2 : 0.75, corner: S().pattern.corner });
      const style = !layer ? null : acc ? { backgroundImage: layer.img, backgroundSize: '230% auto', backgroundRepeat: 'no-repeat', backgroundPosition: layer.pos }
        : { backgroundImage: layer.img, backgroundSize: layer.size, backgroundRepeat: layer.repeat, backgroundPosition: t === 'circles' ? 'right -6px top -6px' : layer.pos };
      return h('button', { type: 'button', class: 'pat' + (S().pattern.type === t ? ' on' : ''), title: t,
        onclick: () => {
          S().pattern.type = t;
          if (acc) { S().pattern.area = 'page'; if (S().pattern.opacity > 0.25) S().pattern.opacity = 0.14; if (S().pattern.scale > 1.6) S().pattern.scale = 1; }
          touch(); drawPanel();
        }, style }, t === 'none' ? h('span', { class: 'muted' }, 'None') : null);
    };
    return h('div', null, h('div', { class: 'pat-sub' }, 'None & subtle accents (one per page)'), h('div', { class: 'pat-grid' }, [tile('none'), ...accents.map(tile)]),
      h('div', { class: 'pat-sub' }, 'Full-page textures'), h('div', { class: 'pat-grid' }, tiles.map(tile)));
  }
  function simpleRange(label, get, set, min, max, step, lo, hi) {
    const el = h('input', { type: 'range', min, max, step, value: get() });
    el.addEventListener('input', () => { set(Number(el.value)); touch(); });
    return field(label, h('div', null, h('div', { class: 'rng' }, el), h('div', { class: 'rng-ends' }, h('span', null, lo), h('span', null, hi))));
  }

  /* ---------------- design tab ---------------- */
  function designTab() {
    const s = S();
    const redrawAll = () => drawPanel();
    const swatches = h('div', { class: 'swatches' }, T.PALETTES.map((p) => h('button', { class: 'swatch', title: p.name, style: { background: p.accent }, onclick: () => { doc.settings = T.applyPalette(doc.settings, p.id); touch(); redrawAll(); } })));
    const themeCards = h('div', { class: 'themes' }, T.THEMES.map((t) => h('button', { class: 'theme-card', title: t.name + (t.dark ? ' (dark)' : ' (light)'), onclick: () => { doc.settings = T.applyColorTheme(doc.settings, t.id); touch(); redrawAll(); } },
      h('span', { class: 'tc-prev', style: { background: t.colors.bg, borderColor: t.colors.line } }, h('i', { style: { background: t.colors.accent } }), h('i', { style: { background: t.colors.heading, opacity: .85 } }), h('i', { style: { background: t.colors.muted, width: '60%' } })), h('small', null, t.name))));
    const patTypes = T.ENUMS['pattern.type'].map((t) => [t, t[0].toUpperCase() + t.slice(1)]);
    return h('div', { class: 'tab-content' },
      group('Layout', true,
        h('div', { class: 'f-lbl' }, 'Column layout'), layoutPicker(),
        s.layout !== 'single' ? toggle('Filled sidebar background', 'sidebarFilled') : null,
        s.layout !== 'single' ? range('Main column width', 'columnRatio', 45, 78, 1, '%') : null,
        seg('Page size', 'pageSize', [['A4', 'A4'], ['Letter', 'US Letter']])),
      group('Colors', true, h('div', { class: 'f-lbl' }, 'Accent colors'), swatches, h('div', { class: 'f-lbl' }, 'Light & dark resume themes'), themeCards,
        color('Accent', 'colors.accent'), color('Text', 'colors.text'), color('Headings', 'colors.heading'), color('Muted text', 'colors.muted'), color('Page background', 'colors.bg'),
        s.layout !== 'single' ? color('Sidebar background', 'colors.sidebarBg') : null,
        s.layout !== 'single' && s.sidebarFilled ? [color('Sidebar text', 'colors.sideText'), color('Sidebar accent', 'colors.sideAccent')] : null,
        s.header.style === 'banner' ? [color('Banner background', 'colors.headerBg'), color('Banner text', 'colors.headerText')] : null,
        color('Divider lines', 'colors.line'), color('Chip background', 'colors.chipBg'), color('Chip border', 'colors.chipBorder')),
      group('Fonts & text', false,
        select('Heading font', 'fontHeading', T.FONTS.map((f) => [f.name, f.name])), select('Body font', 'fontBody', T.FONTS.map((f) => [f.name, f.name])),
        range('Font size', 'fontSize', 7.5, 13, 0.1, 'pt'), range('Line height', 'lineHeight', 1.15, 1.9, 0.01)),
      group('Margins & spacing', true,
        simpleRange('Page margins', () => Math.round((s.margins.top + s.margins.bottom + s.margins.left + s.margins.right) / 4), (v) => { s.margins.top = s.margins.bottom = v; s.margins.left = s.margins.right = Math.round(v * 1.1); }, 4, 30, 1, 'narrow', 'wide'),
        simpleRange('Section spacing', () => s.sectionGap, (v) => { s.sectionGap = v; s.entryGap = Math.round(v * 0.5 * 2) / 2; }, 2, 12, 0.5, 'compact', 'more space'),
        remember('adv', h('details', { class: 'adv', open: openState.get('adv') === true }, h('summary', null, 'Fine-tune margins and spacing'),
        range('Top margin', 'margins.top', 0, 35, 1, 'mm'), range('Bottom margin', 'margins.bottom', 0, 35, 1, 'mm'),
        range('Left margin', 'margins.left', 0, 35, 1, 'mm'), range('Right margin', 'margins.right', 0, 35, 1, 'mm'),
        range('Section spacing', 'sectionGap', 1, 14, 0.5, 'mm'), range('Entry spacing', 'entryGap', 0, 8, 0.5, 'mm'),
        s.layout !== 'single' ? range('Column gap', 'columnGap', 3, 18, 1, 'mm') : null))),
      group('Background pattern', false,
        h('div', { class: 'f-lbl' }, 'Backgrounds'), patternGrid(),
        s.pattern.type !== 'none' ? [seg('Apply to', 'pattern.area', [['header', 'Header only'], ['page', 'Whole page']]), T.ACCENT_PATTERNS.includes(s.pattern.type) ? seg('Corner', 'pattern.corner', [['tr', 'Top right'], ['tl', 'Top left'], ['br', 'Bottom right'], ['bl', 'Bottom left']]) : null, color('Pattern color', 'pattern.color'),
          range('Opacity', 'pattern.opacity', 0.02, 0.5, 0.01), range('Scale', 'pattern.scale', 0.5, 3, 0.1)] : null),
      group('Header', false,
        seg('Style', 'header.style', [['left', 'Left'], ['center', 'Centered'], ['banner', 'Banner']], redrawAll),
        s.layout !== 'single' ? seg('Name & title in', 'header.in', [['top', 'Full width'], ['main', 'Main column']], redrawAll) : null,
        s.layout !== 'single' && s.header.in === 'main' ? seg('Contact details in', 'header.contactsIn', [['header', 'Header'], ['side', 'Sidebar']]) : null,
        seg('Name case', 'header.nameCase', [['upper', 'UPPERCASE'], ['title', 'Title Case']]), range('Name size', 'header.nameSize', 16, 44, 1, 'pt'), range('Job title size', 'header.titleSize', 8, 18, 0.5, 'pt'),
        seg('Job title color', 'header.titleColor', [['accent', 'Accent'], ['text', 'Text'], ['muted', 'Muted']]),
        seg('Photo shape', 'header.photoShape', [['circle', 'Circle'], ['rounded', 'Rounded'], ['square', 'Square'], ['none', 'Hidden']]),
        seg('Photo position', 'header.photoPos', [['right', 'Right'], ['left', 'Left']]), range('Photo size', 'header.photoSize', 16, 46, 1, 'mm'), toggle('Show contact icons', 'contactIcons')),
      group('Section headings', false,
        seg('Style', 'heading.style', [['underline', 'Underline'], ['thin', 'Thin line'], ['short', 'Short bar'], ['bar', 'Side bar'], ['box', 'Box'], ['plain', 'Plain']]),
        seg('Case', 'heading.case', [['upper', 'UPPERCASE'], ['title', 'Title Case']]), toggle('Show section icons', 'heading.icons'), range('Size', 'heading.size', 8.5, 16, 0.5, 'pt'),
        range('Weight', 'heading.weight', 400, 800, 100), range('Letter spacing', 'heading.spacing', 0, 0.2, 0.01)),
      group('Entries, skills & lists', false,
        seg('Date & location', 'entries.dateStyle', [['icons', 'With icons'], ['plain', 'Plain'], ['right', 'Right aligned']]),
        seg('Bullets', 'entries.bulletStyle', [['disc', '●'], ['square', '■'], ['dash', '—'], ['arrow', '›'], ['none', 'None']]),
        seg('Company color', 'entries.orgColor', [['accent', 'Accent'], ['text', 'Text'], ['muted', 'Muted']]), range('Entry title size', 'entries.titleSize', 8.5, 14, 0.1, 'pt'),
        toggle('Dashed dividers between entries', 'entries.dividers'),
        seg('Skill style', 'skills.style', [['chips', 'Chips'], ['outline', 'Pills'], ['plain', 'Commas'], ['pipes', 'Pipes']]), toggle('Stretch chips to fill each row', 'skills.fill'),
        seg('Language level', 'levels.style', [['dots', 'Dots'], ['bars', 'Bars'], ['text', 'Text']])));
  }

  /* ---------------- add-section gallery ---------------- */
  function sectionPreview(type) {
    const sec = T.newSection(type); sec.column = 'main';
    const d = { settings: T.clone(doc.settings), header: doc.header, sections: [sec] };
    d.settings.layout = 'single'; d.settings.sidebarFilled = false; d.settings.pattern.type = 'none';
    const inner = `<div class="rz-bg" style="${R.esc(R.pageBg(d))}"></div><div class="pv-pad">${R.render(d, { noHeader: true })}</div>`;
    const inn = h('div', { class: 'sec-pv-in', html: inner });
    const pv = h('div', { class: 'sec-pv', style: { background: doc.settings.colors.bg } }, inn);
    // scale the preview so it always fills the card's width, and let the card grow with the content
    new ResizeObserver(() => {
      const k = pv.clientWidth / inn.offsetWidth;
      if (!isFinite(k) || k <= 0) return;
      inn.style.transform = `scale(${k})`;
      pv.style.height = Math.max(96, Math.min(300, inn.offsetHeight * k)) + 'px';
    }).observe(pv);
    return pv;
  }
  function addSection(type) {
    const sec = T.newSection(type);
    doc.sections.push(sec); collapsed.delete(sec.id);
    commit();
    const el = content.querySelector(`[data-sid="${sec.id}"]`);
    if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1400); }
    toast(`${T.SECTION_TYPES[type].label} added. Click any text on the page to edit it`);
  }
  async function openGallery() {
    const used = new Set(doc.sections.map((s) => s.type));
    const types = Object.keys(T.SECTION_TYPES);
    const fresh = types.filter((t) => !used.has(t) || t === 'custom' || t === 'text');
    const taken = types.filter((t) => used.has(t) && t !== 'custom' && t !== 'text');
    const pick = await modal('Add a new section', (close) => {
      const card = (t, isUsed) => h('button', { class: 'gal-card' + (isUsed ? ' used' : ''), onclick: () => close(t) },
        sectionPreview(t), h('span', { class: 'gal-name' }, T.SECTION_TYPES[t].label), isUsed ? h('span', { class: 'gal-check', html: SVG(ICO.check || '<path d="M20 6L9 17l-5-5"/>') }) : null);
      const usedWrap = h('div', { class: 'gal', style: { display: 'none' } }, taken.map((t) => card(t, true)));
      const toggleBtn = h('button', { class: 'link-btn', onclick: () => { const open = usedWrap.style.display === 'none'; usedWrap.style.display = open ? '' : 'none'; toggleBtn.textContent = open ? 'Hide used sections ⌃' : `Show used sections (${taken.length}) ⌄`; } }, `Show used sections (${taken.length}) ⌄`);
      return h('div', { class: 'gallery' }, h('p', { class: 'muted center' }, 'Click a section to add it. Its previews use your current design.'),
        h('div', { class: 'gal' }, fresh.map((t) => card(t, false))), taken.length ? [h('div', { class: 'center' }, toggleBtn), usedWrap] : null);
    }, [], { wide: true });
    if (pick) addSection(pick);
  }

  /* ---------------- arrange (page layout map) ---------------- */
  function openArrange() {
    hideFloats();
    const s = S(), g = pageGeom(), li = R.layoutInfo(doc), two = s.layout !== 'single';
    const geo = sectionGeoms();
    const D = 400, k = D / (li.cw * MM);
    const sg = s.sectionGap * MM, colGap = s.columnGap * MM * k;
    const mainW = two ? ((li.cw - s.columnGap) * s.columnRatio / 100) : li.cw, sideW = li.cw - s.columnGap - mainW;
    const headerInMain = two && s.header.in === 'main';
    const lockBox = (label, hgt) => h('div', { class: 'ar-box locked', style: { height: Math.max(30, hgt * k) + 'px' } }, h('span', { html: SVG(ICO.lock) }), label);
    const box = (sec) => h('div', { class: 'ar-box', 'data-sid': sec.id }, h('span', { class: 'ar-grip' }, '⋮⋮'), sec.title || T.SECTION_TYPES[sec.type].label);
    const zone = (col, w) => h('div', { class: 'ar-zone', 'data-col': col, style: { width: w * MM * k + 'px' } });
    const zones = [], info = h('div', { class: 'ar-info' }), bands = h('div', { class: 'ar-lines' });
    const pageEl = h('div', { class: 'ar-page', style: { width: D + 'px' } });
    const topBox = !headerInMain ? lockBox('Header', geo.header) : null;
    if (topBox) pageEl.append(topBox);
    const cols = h('div', { class: 'ar-cols', style: { gap: colGap + 'px' } });
    const mainZ = zone('main', mainW); zones.push(mainZ);
    const mainLock = headerInMain ? lockBox('Header', geo.header) : null;
    if (mainLock) mainZ.append(mainLock);
    doc.sections.filter((x) => !two || x.column !== 'side').forEach((x) => mainZ.append(box(x)));
    cols.append(mainZ);
    let sideLock = null;
    if (two) {
      const sideZ = zone('side', sideW); zones.push(sideZ);
      if (headerInMain && geo.sideTop) { sideLock = lockBox('Photo & contact', geo.sideTop); sideZ.append(sideLock); }
      doc.sections.filter((x) => x.column === 'side').forEach((x) => sideZ.append(box(x)));
      cols.append(sideZ);
    }
    pageEl.append(cols, bands);

    /* lay the boxes out exactly like the real page: heights follow the sections and a section that would be cut by a page edge is pushed down */
    function refresh() {
      let end = 0;
      zones.forEach((z, zi) => {
        const lock = z === mainZ ? mainLock : sideLock;
        let y = headerInMain ? (lock ? geo.header + sg : 0) : geo.colsTop;
        if (headerInMain && z !== mainZ) y = lock ? geo.sideTop + sg : 0;
        if (lock) lock.style.marginBottom = sg * k + 'px';
        const boxes = Array.from(z.querySelectorAll(':scope > .ar-box[data-sid]'));
        const groups = [], spans = [];
        boxes.forEach((b) => {
          const gm = geo.secs.get(b.dataset.sid) || { h: 60, groups: [{ top: 0, bottom: 60 }] };
          spans.push([groups.length, gm]);
          gm.groups.forEach((x) => groups.push({ top: y + x.top, bottom: y + x.bottom }));
          y += gm.h + sg;
        });
        const { pushes, end: e } = planFlow(groups, g);
        let idx = 0;
        boxes.forEach((b, i) => {
          const [start, gm] = spans[i], n = gm.groups.length;
          const first = pushes[start], inner = pushes.slice(start + 1, start + n).reduce((a, c) => a + c, 0);
          b.style.marginTop = first * k + 'px'; b.style.marginBottom = Math.max(4, sg * k) + 'px';
          b.style.height = Math.max(30, (gm.h + inner) * k) + 'px';
          idx += n;
        });
        end = Math.max(end, e);
      });
      const pages = Math.max(1, Math.floor((end - 0.5) / g.stride) + 1);
      const total = pages * g.stride - g.gap;
      zones.forEach((z) => { z.style.minHeight = Math.max(80, (total - (headerInMain ? 0 : geo.colsTop)) * k) + 'px'; });
      if (topBox) topBox.style.marginBottom = Math.max(0, geo.colsTop - geo.header) * k + 'px';
      bands.replaceChildren(...Array.from({ length: pages - 1 }, (_, i) => h('div', { class: 'ar-band', style: { top: 10 + ((i + 1) * g.stride - g.gap) * k + 'px', height: Math.max(6, g.gap * k) + 'px' } }, h('span', null, `Page ${i + 2}`))));
      info.textContent = `${pages} ${pages === 1 ? 'page' : 'pages'}`;
    }
    zones.forEach((z) => Sortable.create(z, {
      group: 'arrange', animation: 160, draggable: '.ar-box:not(.locked)', ghostClass: 'drag-ghost', chosenClass: 'drag-chosen', fallbackOnBody: true,
      direction: 'vertical', swapThreshold: 0.5, invertSwap: true, invertedSwapThreshold: 0.4, emptyInsertThreshold: 90,
      onEnd: () => {
        const byId = new Map(doc.sections.map((x) => [x.id, x]));
        const next = [];
        zones.forEach((z2) => z2.querySelectorAll(':scope > .ar-box[data-sid]').forEach((b) => { const x = byId.get(b.dataset.sid); if (x) { if (two) x.column = z2.dataset.col; next.push(x); } }));
        doc.sections = next; refresh();
      },
    }));
    const before = JSON.stringify(doc.sections.map((x) => [x.id, x.column]));
    modal('Hold & drag the boxes to rearrange the sections', h('div', { class: 'arrange' }, info, pageEl,
      h('p', { class: 'muted center small' }, 'Drop a box anywhere in a column. Red bands are page breaks; sections that would be cut are moved to the next page, just like the PDF.'),
      !two ? h('p', { class: 'muted center small' }, 'Tip: choose a two-column layout in Design to also move sections between columns.') : null),
      [{ label: 'Continue editing', value: true, kind: 'primary' }]).then(() => {
      if (JSON.stringify(doc.sections.map((x) => [x.id, x.column])) !== before) commit();
    });
    requestAnimationFrame(refresh);
  }

  /* ---------------- templates tab ---------------- */
  function templatesTab() {
    const grid = h('div', { class: 'tpl-grid in-panel' }, T.TEMPLATES.map((t) => {
      const preview = T.applyTemplate(doc, t.id);
      return h('button', { class: 'tpl' + (S().template === t.id ? ' on' : ''), onclick: async () => {
        if (S().template !== t.id && !(await confirmDlg('Apply template', 'This switches the design (layout, fonts, colors). Your content is kept.', 'Apply'))) return;
        doc = T.applyTemplate(doc, t.id); touch(); drawPanel();
      } }, thumb(preview, 150), h('b', null, t.name), h('small', null, t.desc));
    }));
    return h('div', { class: 'tab-content' }, h('p', { class: 'muted pad' }, 'Previews use your own content. Switching templates keeps your text but resets design options.'), grid);
  }

  /* ---------------- version history drawer ---------------- */
  const SETTING_GROUP = { layout: 'layout', sidebarFilled: 'layout', columnRatio: 'layout', columnGap: 'layout', pageSize: 'page size', margins: 'spacing', sectionGap: 'spacing', entryGap: 'spacing',
    fontHeading: 'fonts', fontBody: 'fonts', fontSize: 'fonts', lineHeight: 'fonts', colors: 'colors', pattern: 'background', header: 'header style', contactIcons: 'header style',
    heading: 'headings', entries: 'entries', skills: 'skills', levels: 'languages', template: 'template' };
  function describe(aJson, bJson) {
    const a = JSON.parse(aJson), b = JSON.parse(bJson), out = [];
    ['name', 'title', 'tagline'].forEach((k) => { if (a.header[k] !== b.header[k]) out.push(`Edited ${k}`); });
    if (a.header.photo !== b.header.photo) out.push(b.header.photo ? 'Changed photo' : 'Removed photo');
    if (JSON.stringify(a.header.contacts) !== JSON.stringify(b.header.contacts)) out.push('Edited contact details');
    const groups = new Set();
    Object.keys(b.settings).forEach((k) => { if (JSON.stringify(a.settings[k]) !== JSON.stringify(b.settings[k])) groups.add(SETTING_GROUP[k] || k); });
    if (groups.size) out.push('Design: ' + [...groups].join(', '));
    const ma = new Map(a.sections.map((x) => [x.id, x]));
    b.sections.forEach((x) => {
      const o = ma.get(x.id);
      if (!o) out.push(`Added “${x.title}”`);
      else if (JSON.stringify(o.items) !== JSON.stringify(x.items)) out.push(`Edited “${x.title}”`);
      else if (o.title !== x.title) out.push(`Renamed “${o.title}”`);
      else if (o.column !== x.column || o.icon !== x.icon) out.push(`Changed “${x.title}”`);
    });
    a.sections.forEach((x) => { if (!b.sections.find((y) => y.id === x.id)) out.push(`Removed “${x.title}”`); });
    const ia = a.sections.map((x) => x.id).filter((i) => b.sections.some((y) => y.id === i)), ib = b.sections.map((x) => x.id).filter((i) => a.sections.some((y) => y.id === i));
    if (ia.join() !== ib.join()) out.push('Reordered sections');
    return out;
  }
  const brief = (list, n = 2) => (list.length ? list.slice(0, n).join(' · ') + (list.length > n ? ` · +${list.length - n} more` : '') : 'No visible changes');
  const ago = (t) => {
    const d = (Date.now() - t) / 1000;
    if (d < 45) return 'just now'; if (d < 3600) return Math.round(d / 60) + ' min ago'; if (d < 86400) return Math.round(d / 3600) + ' h ago';
    return new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };
  const full = (t) => new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

  let previewDoc = null, previewRev = null, revisions = [], histOpen = false;
  const histBody = h('div', { class: 'hist-body' });
  const histPanel = h('aside', { class: 'history' }, h('div', { class: 'hist-h' }, h('b', null, 'Version history'), h('button', { class: 'icon-btn', title: 'Close', onclick: () => toggleHistory(false), html: SVG('<path d="M18 6L6 18M6 6l12 12"/>') })), histBody);
  const histSplit = h('div', { class: 'splitter right', title: 'Drag to resize · double-click to reset' });
  const banner = h('div', { class: 'preview-banner' });

  async function loadRevisions() {
    try { revisions = await api.get(`/api/resumes/${id}/revisions`); } catch { revisions = []; }
    if (histOpen) drawHistory();
  }
  function toggleHistory(open = !histOpen) {
    histOpen = open;
    histPanel.style.display = histSplit.style.display = open ? '' : 'none';
    if (open) { loadRevisions(); drawHistory(); } else exitPreview();
    setTimeout(applyZoom, 30);
  }
  async function askName(title, initial = '') {
    const inp = h('input', { type: 'text', value: initial, maxlength: 80, placeholder: 'e.g. Sent to Acme' });
    const ok = await modal(title, h('label', null, 'Name', inp), [{ label: 'Cancel', value: false }, { label: 'Save', value: true, kind: 'primary' }]);
    return ok ? inp.value.trim() : null;
  }
  async function saveVersion(label) {
    dirty = true; await save();
    while (saving) await new Promise((r) => setTimeout(r, 40));
    try { await api.post(`/api/resumes/${id}/revisions`, { label }); toast('Version saved'); loadRevisions(); } catch (e) { toast(e.message, 'err'); }
  }
  async function previewRevision(rev) {
    try {
      const r = await api.get(`/api/resumes/${id}/revisions/${rev.id}`);
      previewDoc = T.normalizeDoc(r.data); previewRev = rev;
      const changes = describe(JSON.stringify(previewDoc), JSON.stringify(doc));
      banner.replaceChildren(h('div', { class: 'pb-t' }, h('b', null, `Previewing ${rev.label || 'restore point'}`), h('small', null, `${full(rev.created_at)} · to get back to now: ${brief(changes, 3)}`)),
        h('div', { class: 'pb-a' }, h('button', { class: 'btn', onclick: exitPreview }, 'Back to current'), h('button', { class: 'btn primary', onclick: () => restoreRevision(rev) }, 'Restore this version')));
      stage.classList.add('previewing'); panelEl.classList.add('locked');
      hideFloats(); paintPreview(); drawHistory();
      stage.scrollTo({ top: 0 });
    } catch (e) { toast(e.message, 'err'); }
  }
  function exitPreview() {
    if (!previewDoc) return;
    previewDoc = null; previewRev = null; stage.classList.remove('previewing'); panelEl.classList.remove('locked');
    paintPreview(); if (histOpen) drawHistory();
  }
  async function restoreRevision(rev) {
    if (!(await confirmDlg('Restore this version', 'Your current resume is saved as a restore point first, so you can undo this.', 'Restore'))) return;
    try {
      dirty = true; await save(); while (saving) await new Promise((r) => setTimeout(r, 40));
      snapshot();
      const r = await api.post(`/api/resumes/${id}/revisions/${rev.id}/restore`);
      previewDoc = null; previewRev = null; stage.classList.remove('previewing'); panelEl.classList.remove('locked');
      doc = T.normalizeDoc(r.data); dirty = false; setStatus('All changes saved');
      snapshot(); hideFloats(); paintPreview(); drawPanel(); loadRevisions(); toast('Version restored');
    } catch (e) { toast(e.message, 'err'); }
  }
  function drawHistory() {
    const nameIn = h('input', { type: 'text', placeholder: 'Name this version…', maxlength: 80 });
    const doSave = () => { const v = nameIn.value.trim(); nameIn.value = ''; saveVersion(v || 'Saved version'); };
    nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSave(); });
    const revRow = (rev) => h('li', { class: 'rev' + (previewRev && previewRev.id === rev.id ? ' on' : ''), onclick: () => previewRevision(rev) },
      h('span', { class: 'dot' + (rev.auto ? ' auto' : '') }),
      h('div', { class: 'rev-t' }, h('b', null, rev.auto ? (rev.label || 'Automatic restore point') : rev.label), h('small', { title: full(rev.created_at) }, ago(rev.created_at))),
      h('div', { class: 'rev-a' },
        h('button', { class: 'icon-btn', title: 'Restore', onclick: (e) => { e.stopPropagation(); restoreRevision(rev); }, html: SVG(ICO.undo) }),
        h('button', { class: 'icon-btn', title: 'Name this version', onclick: async (e) => { e.stopPropagation(); const n = await askName('Name this version', rev.auto ? '' : rev.label); if (n) { await api.patch(`/api/resumes/${id}/revisions/${rev.id}`, { label: n }); loadRevisions(); } }, html: SVG(ICO.pen || '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>') }),
        h('button', { class: 'icon-btn x', title: 'Delete', onclick: async (e) => { e.stopPropagation(); if (await confirmDlg('Delete version', 'Delete this saved version?')) { await api.del(`/api/resumes/${id}/revisions/${rev.id}`); if (previewRev && previewRev.id === rev.id) exitPreview(); loadRevisions(); } }, html: SVG(ICO.trash) })));
    // this session: undo steps, newest first
    const steps = [];
    for (let i = hist.length - 1; i >= 1; i--) {
      if (!histDesc[i]) histDesc[i] = describe(hist[i - 1], hist[i]);
      steps.push(h('li', { class: 'rev step' + (i === hi && !previewDoc ? ' on' : ''), onclick: () => { exitPreview(); jumpTo(i); drawHistory(); } },
        h('span', { class: 'dot step' }), h('div', { class: 'rev-t' }, h('b', null, brief(histDesc[i], 2)), h('small', { title: full(histTimes[i]) }, ago(histTimes[i])))));
    }
    steps.push(h('li', { class: 'rev step' + (hi === 0 && !previewDoc ? ' on' : ''), onclick: () => { exitPreview(); jumpTo(0); drawHistory(); } }, h('span', { class: 'dot step' }), h('div', { class: 'rev-t' }, h('b', null, 'Opened this resume'), h('small', null, ago(histTimes[0])))));
    histBody.replaceChildren(...[
      h('div', { class: 'hist-save' }, nameIn, h('button', { class: 'btn primary small', onclick: doSave }, 'Save version')),
      h('p', { class: 'muted small' }, 'Versions are kept on the server. A restore point is also saved automatically after you pause editing.'),
      h('h4', null, 'Saved versions'),
      h('ul', { class: 'rev-list' }, h('li', { class: 'rev' + (!previewDoc ? ' on' : ''), onclick: exitPreview }, h('span', { class: 'dot now' }), h('div', { class: 'rev-t' }, h('b', null, 'Current version'), h('small', null, dirty ? 'Unsaved changes…' : 'Up to date'))), revisions.map(revRow)),
      !revisions.length ? h('p', { class: 'muted small' }, 'No saved versions yet.') : [],
      h('h4', null, 'This session'), h('ul', { class: 'rev-list' }, steps)].flat().filter(Boolean));
  }

  /* ---------------- shell ---------------- */
  const panelBody = h('div', { class: 'panel-body' });
  const tabs = h('div', { class: 'tabs' });
  const panelEl = h('aside', { class: 'panel' }, tabs, panelBody);
  const panelSplit = h('div', { class: 'splitter', title: 'Drag to resize · double-click to reset' });
  let lastTab = null;
  function drawPanel() {
    const top = panelBody.scrollTop;
    // only animate when switching tabs; in-place refreshes (picking a theme, layout, pattern...) must not flash
    panelBody.classList.toggle('anim', tab !== lastTab); lastTab = tab;
    tabs.replaceChildren(...[['content', 'Content'], ['design', 'Design'], ['templates', 'Templates']].map(([k, l]) => h('button', { class: tab === k ? 'on' : '', onclick: () => { tab = k; drawPanel(); } }, l)));
    panelBody.replaceChildren(tab === 'content' ? contentTab() : tab === 'design' ? designTab() : templatesTab());
    panelBody.scrollTop = top;
    panelBody.querySelectorAll('textarea.auto').forEach(autosize);
  }

  const titleIn = h('input', { class: 'doc-title', type: 'text', value: title, maxlength: 100, 'aria-label': 'Resume name' });
  titleIn.addEventListener('input', () => { title = titleIn.value || 'Untitled resume'; touch(); });
  const pdfBtn = h('button', { class: 'btn primary', onclick: async () => {
    pdfBtn.disabled = true; pdfBtn.textContent = 'Generating…';
    try {
      dirty = true; await save();
      while (saving) await new Promise((r) => setTimeout(r, 50));
      const blob = await api.pdfBlob(id);
      downloadBlob(blob, (title.replace(/[^\w.\- ]+/g, '').trim().replace(/\s+/g, '_') || 'resume') + '.pdf');
    } catch (e) { toast(e.message, 'err'); }
    pdfBtn.disabled = false; pdfBtn.textContent = 'Download PDF';
  } }, 'Download PDF');

  const bar = topbar(null);
  bar.querySelector('.spacer').before(
    h('a', { class: 'btn ghost', href: '#/' }, '← My resumes'), titleIn, statusEl);
  undoBtn = h('button', { class: 'icon-btn', title: 'Undo (Ctrl+Z)', 'aria-label': 'Undo', onclick: undo, html: SVG(ICO.undo) });
  redoBtn = h('button', { class: 'icon-btn', title: 'Redo (Ctrl+Shift+Z)', 'aria-label': 'Redo', onclick: redo, html: SVG(ICO.redo) });
  syncUndo();
  bar.querySelector('.spacer').after(
    h('div', { class: 'tb-group' }, undoBtn, redoBtn),
    h('button', { class: 'btn', title: 'Add a section', 'aria-label': 'Add a section', onclick: openGallery }, h('span', { html: SVG(ICO.plus) }), h('span', { class: 'lbl' }, 'Section')),
    h('button', { class: 'btn', title: 'Arrange sections', 'aria-label': 'Arrange sections', onclick: openArrange }, h('span', { html: SVG(ICO.grid) }), h('span', { class: 'lbl' }, 'Arrange')),
    h('button', { class: 'btn', title: 'Version history', 'aria-label': 'Version history', onclick: () => toggleHistory() }, h('span', { html: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>') }), h('span', { class: 'lbl' }, 'History')),
    pagesEl, h('div', { class: 'zoom' }, h('button', { class: 'icon-btn', onclick: () => setZoom(zoom - 0.1) }, '−'), zoomLabel,
      h('button', { class: 'icon-btn', onclick: () => setZoom(zoom + 0.1) }, '+'), h('button', { class: 'btn small', onclick: () => { zoomMode = 'fit'; applyZoom(); } }, 'Fit')), pdfBtn);

  root.replaceChildren(h('div', { class: 'editor' }, bar,
    h('div', { class: 'ed-main' }, panelEl, panelSplit, h('div', { class: 'stage-wrap' }, banner, stage), histSplit, histPanel)));
  histPanel.style.display = histSplit.style.display = 'none';
  // resizable side panels (widths are remembered)
  const lsGet = (k, d) => { try { return Number(localStorage.getItem(k)) || d; } catch { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, String(v)); } catch { /* private mode */ } };
  function splitter(handle, el, key, def, min, max, fromRight) {
    el.style.width = lsGet(key, def) + 'px';
    handle.addEventListener('dblclick', () => { el.style.width = def + 'px'; lsSet(key, def); setTimeout(applyZoom, 0); });
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault(); handle.setPointerCapture(e.pointerId); handle.classList.add('drag'); document.body.classList.add('resizing');
      const startX = e.clientX, startW = el.offsetWidth;
      const move = (ev) => { const dx = fromRight ? startX - ev.clientX : ev.clientX - startX; el.style.width = Math.max(min, Math.min(max(), startW + dx)) + 'px'; applyZoom(); positionBars(); };
      const up = () => { handle.releasePointerCapture(e.pointerId); handle.classList.remove('drag'); document.body.classList.remove('resizing'); lsSet(key, el.offsetWidth); handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); };
      handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up);
    });
  }
  splitter(panelSplit, panelEl, 'er-panel-w', 440, 300, () => innerWidth * 0.62, false);
  splitter(histSplit, histPanel, 'er-hist-w', 340, 260, () => innerWidth * 0.5, true);
  drawPanel();
  requestAnimationFrame(paintPreview);

  return async () => {
    document.removeEventListener('selectionchange', onSelection); closePicker();
    window.removeEventListener('keydown', onKey); window.removeEventListener('beforeunload', onUnload);
    ro.disconnect(); dirty = dirty || false;
    clearTimeout(timer);
    if (dirty) { dirty = true; saving = false; await save(); }
  };
}
