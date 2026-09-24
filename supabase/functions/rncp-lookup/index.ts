// Edge Function rncp-lookup - 01_ARCHITECTURE.md section 6.2 (champ code_rncp).
// Vérifie un code RNCP auprès de l'API officielle France Compétences
// (api.apprentissage.beta.gouv.fr). Cette API exige une clé, stockée
// uniquement comme secret d'Edge Function (RNCP_API_TOKEN) - jamais côté
// client (CLAUDE.md).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const RNCP_RE = /^RNCP\d{3,5}$/;
const API_BASE = "https://api.apprentissage.beta.gouv.fr/api/certification/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function reponseJson(corps: unknown, statut = 200) {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return reponseJson({ erreur: "Méthode non autorisée." }, 405);
  }

  const autorisation = req.headers.get("Authorization");
  if (!autorisation) {
    return reponseJson({ erreur: "Non authentifié." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const cleAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const clientAppelant = createClient(supabaseUrl, cleAnon, {
    global: { headers: { Authorization: autorisation } },
  });
  const {
    data: { user: appelant },
    error: erreurUtilisateur,
  } = await clientAppelant.auth.getUser();
  if (erreurUtilisateur || !appelant) {
    return reponseJson({ erreur: "Non authentifié." }, 401);
  }

  const rncp = (new URL(req.url).searchParams.get("rncp") || "").trim().toUpperCase();
  if (!RNCP_RE.test(rncp)) {
    return reponseJson({ erreur: "Code RNCP invalide." }, 400);
  }

  const jetonApi = Deno.env.get("RNCP_API_TOKEN");
  if (!jetonApi) {
    return reponseJson({ erreur: "Vérification RNCP indisponible (clé API non configurée)." }, 503);
  }

  const reponseApi = await fetch(`${API_BASE}?identifiant.rncp=${encodeURIComponent(rncp)}`, {
    headers: { Authorization: `Bearer ${jetonApi}` },
  });
  if (!reponseApi.ok) {
    return reponseJson({ erreur: "Service France Compétences indisponible." }, 502);
  }

  const resultats = await reponseApi.json();
  const certification = Array.isArray(resultats) ? resultats[0] : null;
  if (!certification) {
    return reponseJson({ trouve: false });
  }

  return reponseJson({
    trouve: true,
    rncp: certification.identifiant?.rncp ?? rncp,
    intitule: certification.intitule?.rncp ?? certification.intitule?.cfd?.long ?? null,
    actif:
      !certification.periode_validite?.fin ||
      new Date(certification.periode_validite.fin) > new Date(),
  });
});
