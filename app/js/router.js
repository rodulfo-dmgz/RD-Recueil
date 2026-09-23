// Routeur SPA par hash (#/…), compatible GitHub Pages sans configuration serveur.

const routes = [];
let routeNonTrouvee = null;

export function route(pattern, handler) {
  const keys = [];
  const source = pattern.replace(/:[^/]+/g, (m) => {
    keys.push(m.slice(1));
    return '([^/]+)';
  });
  routes.push({ regex: new RegExp(`^${source}$`), keys, handler });
}

export function notFound(handler) {
  routeNonTrouvee = handler;
}

export function navigate(chemin) {
  location.hash = chemin;
}

function cheminActuel() {
  return location.hash.slice(1) || '/';
}

async function resoudre() {
  const chemin = cheminActuel();
  // Supabase dépose access_token/refresh_token dans location.hash après un lien
  // magique (#access_token=…). Ce n'est pas une route : on laisse auth.js gérer
  // la connexion, qui renaviguera vers une route propre une fois la session prête.
  if (!chemin.startsWith('/')) return;
  for (const r of routes) {
    const match = chemin.match(r.regex);
    if (match) {
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(match[i + 1])]));
      await r.handler(params);
      return;
    }
  }
  if (routeNonTrouvee) await routeNonTrouvee();
}

export function startRouter() {
  window.addEventListener('hashchange', resoudre);
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', resoudre);
  } else {
    resoudre();
  }
}
