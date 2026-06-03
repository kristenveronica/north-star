/* ============================================================
   router.js — Tiny hash-based SPA router.
   Routes register a render(container, params) function.
   ============================================================ */

const routes = [];
let _container = null;
let _activeRouteId = null;
let _currentParams = {};

export function registerRoute(pattern, handler, opts = {}) {
  // pattern like "/children/:id"
  const tokens = pattern.split("/").filter(Boolean);
  routes.push({ pattern, tokens, handler, opts });
}

export function mountRouter(container) {
  _container = container;
  window.addEventListener("hashchange", resolve);
  resolve();
}

export function navigate(path) {
  if (location.hash === "#" + path) {
    resolve(); // force re-render
  } else {
    location.hash = path;
  }
}

export function currentPath() {
  return location.hash.replace(/^#/, "") || "/";
}

export function getParams() {
  return _currentParams;
}

function resolve() {
  const path = currentPath();
  const segments = path.split("?")[0].split("/").filter(Boolean);
  const query = parseQuery(path.split("?")[1] || "");

  for (const r of routes) {
    const params = matchRoute(r.tokens, segments);
    if (params) {
      _currentParams = { ...params, ...query };
      _activeRouteId = r.pattern;
      _container.innerHTML = "";
      r.handler(_container, _currentParams);
      window.scrollTo({ top: 0, behavior: "instant" });
      window.dispatchEvent(new CustomEvent("route:changed", { detail: { path, pattern: r.pattern } }));
      return;
    }
  }

  // not found
  _container.innerHTML = `<div class="empty"><div class="emoji">🌿</div><h3>Page not found</h3><p class="text-muted">Try the sidebar.</p></div>`;
}

function matchRoute(tokens, segments) {
  if (tokens.length !== segments.length) return null;
  const params = {};
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const s = segments[i];
    if (t.startsWith(":")) params[t.slice(1)] = decodeURIComponent(s);
    else if (t !== s) return null;
  }
  return params;
}

function parseQuery(qs) {
  const out = {};
  if (!qs) return out;
  qs.split("&").forEach(pair => {
    const [k, v] = pair.split("=");
    if (k) out[decodeURIComponent(k)] = decodeURIComponent(v || "");
  });
  return out;
}

export function activePattern() {
  return _activeRouteId;
}
