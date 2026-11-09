import * as api from './api.js';
import { h, toast, confirmDlg, thumb, downloadBlob, photoDataUrl, logoDataUrl } from './ui.js';
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
    schedulePreview();
  }
  const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); } };
  const onUnload = (e) => { if (dirty || saving) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('keydown', onKey);
  window.addEventListener('beforeunload', onUnload);

  /* ---------------- preview ---------------- */
  const pagesEl = h('span', { class: 'pages' });
  const stage = h('div', { class: 'stage' });
  const zoomWrap = h('div', { class: 'zoomwrap' });
  const scaler = h('div', { class: 'scaler' });
  const sheet = h('div', { class: 'sheet' });
  const bgEl = h('div', { class: 'rz-bg' });
  const guides = h('div', { class: 'guides' });
  const content = h('div', { class: 'sheet-content' });
  sheet.append(bgEl, guides, content);
  scaler.append(sheet); zoomWrap.append(scaler); stage.append(zoomWrap);

  let raf = 0;
  function schedulePreview() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paintPreview(); }); }

  function paintPreview() {
    const s = S(), m = s.margins, [pw, ph] = T.PAGE_MM[s.pageSize];
    sheet.style.width = pw + 'mm';
    sheet.style.padding = `${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm`;
    bgEl.setAttribute('style', R.pageBg(doc));
    content.innerHTML = R.render(doc);
    const cap = (ph - m.top - m.bottom) * MM;
    const hh = content.firstChild ? content.firstChild.offsetHeight : 0;
    const pages = Math.max(1, Math.ceil((hh - 2) / cap));
    sheet.style.minHeight = (m.top + m.bottom) * MM + pages * cap + 'px';
    guides.replaceChildren(...Array.from({ length: pages - 1 }, (_, i) => h('div', { class: 'guide', style: { top: m.top * MM + (i + 1) * cap + 'px' } }, h('span', null, `Page ${i + 2} starts (approx.)`))));
    pagesEl.textContent = pages + (pages === 1 ? ' page' : ' pages');
    pagesEl.classList.toggle('warn', pages > 2);
    applyZoom();
  }
  function applyZoom() {
    const pwPx = T.PAGE_MM[S().pageSize][0] * MM;
    if (zoomMode === 'fit') zoom = Math.min(1.25, Math.max(0.3, (stage.clientWidth - 40) / pwPx));
    scaler.style.transform = `scale(${zoom})`;
    zoomWrap.style.width = pwPx * zoom + 'px';
    zoomWrap.style.height = sheet.offsetHeight * zoom + 'px';
    zoomLabel.textContent = Math.round(zoom * 100) + '%';
  }
  const zoomLabel = h('span', { class: 'zoom-l' });
  const setZoom = (z) => { zoomMode = 'manual'; zoom = Math.min(2, Math.max(0.3, z)); applyZoom(); };
  const ro = new ResizeObserver(() => { if (zoomMode === 'fit') applyZoom(); });
  ro.observe(stage);

  content.addEventListener('click', (e) => {
    const sec = e.target.closest('[data-sid]');
    const target = sec ? '[data-sid="' + sec.dataset.sid + '"]' : e.target.closest('[data-edit="header"]') ? '#hdr-card' : null;
    if (!target) return;
    tab = 'content'; collapsed.delete(sec && sec.dataset.sid); drawPanel();
    const el = panelBody.querySelector(target);
    if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1200); }
  });

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
  const group = (name, open, ...kids) => h('details', { class: 'grp', open }, h('summary', null, name), h('div', { class: 'grp-b' }, kids));

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
    const ic = h('select', { class: 'ic-sel' }, T.ICON_CHOICES.map((n) => h('option', { value: n, selected: it.icon === n }, n || '(none)')));
    ic.addEventListener('change', () => { it.icon = ic.value; touch(); });
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
    // add-section palette
    const types = Object.entries(T.SECTION_TYPES);
    wrap.append(h('div', { class: 'add-sec' }, h('div', { class: 'zone-h' }, 'Add a section'),
      h('div', { class: 'add-grid' }, types.map(([k, t]) => h('button', { class: 'btn small', onclick: () => {
        const s = T.newSection(k);
        if (twoCol && s.column === 'side') s.column = 'side';
        doc.sections.push(s); collapsed.delete(s.id); touch(); drawPanel();
        setTimeout(() => { const el = panelBody.querySelector(`[data-sid="${s.id}"]`); if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('flash'); } }, 30);
      } }, '+ ' + t.label)))));
    return wrap;
  }

  /* ---------------- design tab ---------------- */
  function designTab() {
    const s = S();
    const redrawAll = () => drawPanel();
    const swatches = h('div', { class: 'swatches' }, T.PALETTES.map((p) => h('button', { class: 'swatch', title: p.name, style: { background: p.accent }, onclick: () => { doc.settings = T.applyPalette(doc.settings, p.id); touch(); redrawAll(); } })));
    const patTypes = T.ENUMS['pattern.type'].map((t) => [t, t[0].toUpperCase() + t.slice(1)]);
    return h('div', { class: 'tab-content' },
      group('Layout', true,
        seg('Columns', 'layout', [['single', 'Single'], ['side-right', 'Sidebar right'], ['side-left', 'Sidebar left']], redrawAll),
        s.layout !== 'single' ? toggle('Filled sidebar background', 'sidebarFilled') : null,
        s.layout !== 'single' ? range('Main column width', 'columnRatio', 45, 78, 1, '%') : null,
        seg('Page size', 'pageSize', [['A4', 'A4'], ['Letter', 'US Letter']])),
      group('Colors', true, h('div', { class: 'f-lbl' }, 'Color themes'), swatches,
        color('Accent', 'colors.accent'), color('Text', 'colors.text'), color('Headings', 'colors.heading'), color('Muted text', 'colors.muted'), color('Page background', 'colors.bg'),
        s.layout !== 'single' ? color('Sidebar background', 'colors.sidebarBg') : null,
        s.layout !== 'single' && s.sidebarFilled ? [color('Sidebar text', 'colors.sideText'), color('Sidebar accent', 'colors.sideAccent')] : null,
        s.header.style === 'banner' ? [color('Banner background', 'colors.headerBg'), color('Banner text', 'colors.headerText')] : null,
        color('Divider lines', 'colors.line'), color('Chip background', 'colors.chipBg'), color('Chip border', 'colors.chipBorder')),
      group('Fonts & text', false,
        select('Heading font', 'fontHeading', T.FONTS.map((f) => [f.name, f.name])), select('Body font', 'fontBody', T.FONTS.map((f) => [f.name, f.name])),
        range('Font size', 'fontSize', 7.5, 13, 0.1, 'pt'), range('Line height', 'lineHeight', 1.15, 1.9, 0.01)),
      group('Margins & spacing', false,
        range('Top margin', 'margins.top', 0, 35, 1, 'mm'), range('Bottom margin', 'margins.bottom', 0, 35, 1, 'mm'),
        range('Left margin', 'margins.left', 0, 35, 1, 'mm'), range('Right margin', 'margins.right', 0, 35, 1, 'mm'),
        range('Section spacing', 'sectionGap', 1, 14, 0.5, 'mm'), range('Entry spacing', 'entryGap', 0, 8, 0.5, 'mm'),
        s.layout !== 'single' ? range('Column gap', 'columnGap', 3, 18, 1, 'mm') : null),
      group('Background pattern', false,
        seg('Pattern', 'pattern.type', patTypes.slice(0, 5), redrawAll), seg('', 'pattern.type', patTypes.slice(5), redrawAll),
        s.pattern.type !== 'none' ? [seg('Apply to', 'pattern.area', [['header', 'Header only'], ['page', 'Whole page']]), color('Pattern color', 'pattern.color'),
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
        seg('Case', 'heading.case', [['upper', 'UPPERCASE'], ['title', 'Title Case']]), range('Size', 'heading.size', 8.5, 16, 0.5, 'pt'),
        range('Weight', 'heading.weight', 400, 800, 100), range('Letter spacing', 'heading.spacing', 0, 0.2, 0.01)),
      group('Entries, skills & lists', false,
        seg('Date & location', 'entries.dateStyle', [['icons', 'With icons'], ['plain', 'Plain'], ['right', 'Right aligned']]),
        seg('Bullets', 'entries.bulletStyle', [['disc', '●'], ['square', '■'], ['dash', '—'], ['arrow', '›'], ['none', 'None']]),
        seg('Company color', 'entries.orgColor', [['accent', 'Accent'], ['text', 'Text'], ['muted', 'Muted']]), range('Entry title size', 'entries.titleSize', 8.5, 14, 0.1, 'pt'),
        toggle('Dashed dividers between entries', 'entries.dividers'),
        seg('Skill style', 'skills.style', [['chips', 'Chips'], ['outline', 'Pills'], ['plain', 'Commas'], ['pipes', 'Pipes']]),
        seg('Language level', 'levels.style', [['dots', 'Dots'], ['bars', 'Bars'], ['text', 'Text']])));
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

  /* ---------------- shell ---------------- */
  const panelBody = h('div', { class: 'panel-body' });
  const tabs = h('div', { class: 'tabs' });
  function drawPanel() {
    const top = panelBody.scrollTop;
    tabs.replaceChildren(...[['content', 'Content'], ['design', 'Design'], ['templates', 'Templates']].map(([k, l]) => h('button', { class: tab === k ? 'on' : '', onclick: () => { tab = k; drawPanel(); } }, l)));
    panelBody.replaceChildren(tab === 'content' ? contentTab() : tab === 'design' ? designTab() : templatesTab());
    panelBody.scrollTop = top;
    panelBody.querySelectorAll('textarea.auto').forEach(autosize);
    schedulePreview();
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
  bar.querySelector('.spacer').after(
    pagesEl, h('div', { class: 'zoom' }, h('button', { class: 'icon-btn', onclick: () => setZoom(zoom - 0.1) }, '−'), zoomLabel,
      h('button', { class: 'icon-btn', onclick: () => setZoom(zoom + 0.1) }, '+'), h('button', { class: 'btn small', onclick: () => { zoomMode = 'fit'; applyZoom(); } }, 'Fit')), pdfBtn);

  root.replaceChildren(h('div', { class: 'editor' }, bar,
    h('div', { class: 'ed-main' }, h('aside', { class: 'panel' }, tabs, panelBody), stage)));
  drawPanel();
  requestAnimationFrame(paintPreview);

  return async () => {
    window.removeEventListener('keydown', onKey); window.removeEventListener('beforeunload', onUnload);
    ro.disconnect(); dirty = dirty || false;
    clearTimeout(timer);
    if (dirty) { dirty = true; saving = false; await save(); }
  };
}
