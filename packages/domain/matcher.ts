export interface Selector {
  origin: string; path: string; query_equals: Record<string, string>;
  ignored_query_names: string[]; other_query_policy: 'reject';
  duplicate_query_policy: 'reject'; fragment_policy: 'ignore_anchor' | 'reject';
}
export interface SelectedPage { page_key: string; selector: Selector; enabled?: boolean; approval_state?: string }
export function parseAddress(input: string): URL | null {
  if (typeof input!=='string' || input.length > 8192 || /[\u0000-\u0020\u007f\\]|%(?![\da-f]{2})/i.test(input)) return null;
  try {
    const u = new URL(input);
    if (u.username || u.password || u.search.length > 2049 || !['https:', 'http:'].includes(u.protocol)) return null;
    const rawPath=input.split(/[?#]/)[0].replace(/^https?:\/\/[^/]+/, '');
    if (/%2f|%5c|%00|%2e/i.test(rawPath) || /(?:^|\/)\.{1,2}(?:\/|$)/.test(rawPath)) return null;
    for(const pair of u.search.slice(1).split('&'))for(const part of pair.split('='))if(/[\u0000-\u001f\u007f]/.test(decodeURIComponent(part)))return null;
    const entries = [...u.searchParams];
    if (entries.length > 32 || new Set(entries.map(([k]) => k)).size !== entries.length) return null;
    if(entries.some(([key])=>['__proto__','constructor','prototype'].includes(key)))return null;
    if (u.protocol === 'http:' && !['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname)) return null;
    return u;
  } catch { return null; }
}
export function matchesSelector(address: string, s: Selector): boolean {
  const u = parseAddress(address);
  if (!u || u.origin !== s.origin || u.pathname !== s.path) return false;
  if (u.hash && (s.fragment_policy === 'reject' || /^#(?:\/|!)/.test(u.hash))) return false;
  const expected = Object.entries(s.query_equals);
  if (expected.length > 8 || expected.some(([k,v]) => u.searchParams.get(k) !== v || s.ignored_query_names.includes(k))) return false;
  return [...u.searchParams.keys()].every(k => Object.hasOwn(s.query_equals,k) || s.ignored_query_names.includes(k));
}
export function matchPage<T extends SelectedPage>(address: string, pages: readonly T[]): T | null {
  const matched = pages.filter(p => p.enabled !== false && (!p.approval_state || p.approval_state === 'approved') && matchesSelector(address, p.selector));
  return matched.length === 1 ? matched[0] : null;
}
export function selectorURL(s: Selector): string {
  const u = new URL(s.path, s.origin);
  for (const [k,v] of Object.entries(s.query_equals)) u.searchParams.set(k,v);
  return u.toString();
}
export function selectorsOverlap(a: Selector, b: Selector): boolean {
  if (a.origin !== b.origin || a.path !== b.path) return false;
  const combined = { ...a.query_equals, ...b.query_equals };
  if (Object.keys(a.query_equals).some(k => Object.hasOwn(b.query_equals,k) && a.query_equals[k] !== b.query_equals[k])) return false;
  return Object.keys(combined).every(k => (Object.hasOwn(a.query_equals,k) || a.ignored_query_names.includes(k)) && (Object.hasOwn(b.query_equals,k) || b.ignored_query_names.includes(k)));
}
export const codePattern = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,63}$/;
