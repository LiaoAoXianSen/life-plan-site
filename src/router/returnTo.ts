import type { RouteLocationNormalizedLoaded, RouteLocationRaw, Router } from 'vue-router';

function queryValue(value: unknown) {
  return String(Array.isArray(value) ? value[0] || '' : value || '');
}

export function currentReturnTo(route: RouteLocationNormalizedLoaded) {
  const value = queryValue(route.query.returnTo);
  return /^\/(?![\\/])/.test(value) ? value : '';
}

export function withReturnTo(route: RouteLocationNormalizedLoaded, target: { path: string; query?: Record<string, unknown> }): RouteLocationRaw {
  return {
    path: target.path,
    query: { ...target.query, returnTo: route.fullPath },
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
