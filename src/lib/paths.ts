// Public assets are stored without a hosting prefix in the CMS.
export function withBase(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//')) return value;
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}${value}`;
}

export function resolveContentPaths<T>(value: T): T {
  if (typeof value === 'string') return withBase(value) as T;
  if (Array.isArray(value)) return value.map(resolveContentPaths) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveContentPaths(item)])) as T;
  }
  return value;
}
