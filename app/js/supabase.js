import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { lireOrganisation } from './organisation.js';

// L'en-tête x-organisme (organisation choisie) n'est envoyé qu'à l'API de données et aux fonctions RPC :
// ni à l'authentification ni au stockage, qui n'en ont pas l'usage.
function fetchAvecOrganisme(url, options = {}) {
  const organisation = lireOrganisation();
  if (!organisation || !String(url).includes('/rest/v1/')) return fetch(url, options);
  const entetes = new Headers(options.headers);
  entetes.set('x-organisme', organisation);
  return fetch(url, { ...options, headers: entetes });
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { fetch: fetchAvecOrganisme } });
