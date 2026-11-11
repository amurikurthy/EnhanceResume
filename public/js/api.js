async function call(method, url, body) {
  const res = await fetch(url, {
    method, credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'EnhanceResume' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401 && !url.startsWith('/api/auth/')) { location.hash = '#/login'; throw new Error('Session expired'); }
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) throw new Error((data && data.error) || 'Request failed (' + res.status + ')');
  return data;
}
export const get = (u) => call('GET', u);
export const post = (u, b) => call('POST', u, b || {});
export const put = (u, b) => call('PUT', u, b);
export const patch = (u, b) => call('PATCH', u, b);
export const del = (u) => call('DELETE', u);

export async function pdfBlob(id) {
  const res = await fetch(`/api/resumes/${id}/pdf`, { credentials: 'same-origin', headers: { 'X-Requested-With': 'EnhanceResume' } });
  if (!res.ok) throw new Error('PDF generation failed');
  return res.blob();
}
