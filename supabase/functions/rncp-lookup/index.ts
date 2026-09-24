// Edge Function rncp-lookup - 01_ARCHITECTURE.md section 6.2 (champ code_rncp).
// Vérifie un code RNCP auprès de l'API officielle France Compétences
// (api.apprentissage.beta.gouv.fr). Cette API exige une clé, stockée
// uniquement comme secret d'Edge Function (RNCP_API_TOKEN) - jamais côté
// client (CLAUDE.md).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const RNCP_RE = /^RNCP\d{3,5}$/;
const API_BASE = "https://api.apprentissage.beta.gouv.fr/api/certification/v1";

const LIBELLES_VOIES_ACCES: Record<string, string> = {
  apprentissage: "Apprentissage",
  experience: "VAE (validation des acquis de l'expérience)",
  candidature_individuelle: "Candidature individuelle",
  contrat_professionnalisation: "Contrat de professionnalisation",
  formation_continue: "Formation continue",
  formation_statut_eleve: "Formation initiale (statut élève/étudiant)",
};

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

// deno-lint-ignore no-explicit-any
function extraireCertification(certification: any, rncp: string) {
  const voiesAccesBrutes = certification.type?.voie_acces?.rncp || {};
  const voiesAcces = Object.entries(voiesAccesBrutes)
    .filter(([, actif]) => actif === true)
    .map(([cle]) => LIBELLES_VOIES_ACCES[cle] || cle);

  return {
    trouve: true,
    rncp: certification.identifiant?.rncp ?? rncp,
    intitule: certification.intitule?.rncp ?? certification.intitule?.cfd?.long ?? null,
    actif:
      !certification.periode_validite?.fin ||
      new Date(certification.periode_validite.fin) > new Date(),
    periodeValidite: {
      debut: certification.periode_validite?.debut ?? null,
      fin: certification.periode_validite?.fin ?? null,
    },
    blocsCompetences: (certification.blocs_competences?.rncp || []).map(
      // deno-lint-ignore no-explicit-any
      (bloc: any) => ({ code: bloc.code, intitule: bloc.intitule })
    ),
    domaines: {
      rome: (certification.domaines?.rome?.rncp || []).map(
        // deno-lint-ignore no-explicit-any
        (d: any) => ({ code: d.code, intitule: d.intitule })
      ),
      nsf: (certification.domaines?.nsf?.rncp || []).map(
        // deno-lint-ignore no-explicit-any
        (d: any) => ({ code: d.code, intitule: d.intitule })
      ),
    },
    conventionCollectives: (certification.convention_collectives?.rncp || []).map(
      // deno-lint-ignore no-explicit-any
      (c: any) => ({ numero: c.numero, intitule: c.intitule })
    ),
    voiesAcces,
    lienOfficiel: `https://www.francecompetences.fr/recherche/rncp/${(certification.identifiant?.rncp ?? rncp).replace(/^RNCP/i, "")}/`,
  };
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

  return reponseJson(extraireCertification(certification, rncp));
});
