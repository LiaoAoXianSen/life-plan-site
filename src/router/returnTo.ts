import type { RouteLocationNormalizedLoaded, RouteLocationRaw, Router } from 'vue-router';

function queryValue(value: unknown) {
  return String(Array.isArray(value) ? value[0] || '' : value || '');
}

export function currentReturnTo(route: RouteLocationNormalizedLoaded) {
  const value = queryValue(route.query.returnTo);
  return /^\/(?![\\/])/.test(value) ? value : '';
}

export function withReturnTo(route: RouteLocationNormalizedLoaded, target: { path: string; query?: Record<string, unknown> }): RouteLocationRaw {
  const returnTo = currentReturnTo(route);
  return {
    path: target.path,
    query: { ...target.query, returnTo: returnTo || route.fullPath },
    // Once an overlay chain has a source, subsequent overlays are one transient
    // history slot. Replacing that slot lets closing the chain remove every
    // intermediate overlay from Back while the first open remains navigable.
    replace: Boolean(returnTo),
  };
}

export function closeRouteOverlay(router: Router, route: RouteLocationNormalizedLoaded, keys: string[]) {
  const returnTo = currentReturnTo(route);
  if (returnTo) {
    void router.replace(returnTo);
    return;
  }
  const query = { ...route.query };
  keys.forEach(key => delete query[key]);
  delete query.returnTo;
  void router.replace({ path: route.path, query });
}
