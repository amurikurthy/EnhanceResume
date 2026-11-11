/* loads the bundled icon libraries on demand (they are big, so only when a resume or the picker needs them) */
const R = window.ERR;
let lucideP = null, brandsP = null;
const get = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error('Could not load icons'); return r.json(); });
export const loadLucide = () => (lucideP = lucideP || get('/icons/lucide.json').then((d) => { R.setIconLib('lucide', d); return d; }));
export const loadBrands = () => (brandsP = brandsP || get('/icons/brands.json').then((d) => { R.setIconLib('brands', d); return d; }));
/* make sure every icon used by these documents can be drawn */
export async function ensureIconsFor(docs) {
  const j = JSON.stringify(docs);
  const jobs = [];
  if (/"icon":"brand:/.test(j)) jobs.push(loadBrands());
  if ([...j.matchAll(/"icon":"([a-z0-9-]+)"/g)].some((m) => !R.ICONS[m[1]])) jobs.push(loadLucide());
  await Promise.all(jobs).catch(() => {});
}
