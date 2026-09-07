// Prefixes an absolute site-internal path with Astro's configured base
// (import.meta.env.BASE_URL), so links keep working when the site is built
// under a subpath (e.g. the /v2-preview/ preview deploy) as well as at root.
//
// import.meta.env.BASE_URL always ends in "/" (Astro guarantees this), so
// stripping the leading "/" from `path` before concatenating avoids a
// doubled slash at the join point.
export function withBase(path) {
  return import.meta.env.BASE_URL + path.replace(/^\//, '');
}
