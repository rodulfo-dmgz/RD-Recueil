// Edge Function certifinfo-lookup - 01_ARCHITECTURE.md section 6.2 (champ
// code_rncp). Complète la vérification RNCP (rncp-lookup) par une recherche
// dans Certif Info (intercariforef.org), un référentiel plus large qui
// couvre aussi des formations non enregistrées à France Compétences.
// Clé API stockée uniquement comme secret d'Edge Function
// (CERTIFINFO_API_TOKEN), jamais côté client (CLAUDE.md).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const API_BASE = "https://api-certifinfo.intercariforef.org";

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
function extraireSuggestion(c: any) {
  return {
    certifinfoCode: c.certifinfo_code,
    intitule: c.certifinfo_intitule,
    niveauEuropeen: c.niveau_europeen_code ?? null,
    rncpCode: c.rncp_code ?? null,
    rsCode: c.rs_code?.[0] ?? null,
  };
}

// deno-lint-ignore no-explicit-any
function extraireDetail(c: any) {
  return {
    trouve: true,
    certifinfoCode: c.certifinfo_code,
    intitule: c.certifinfo_intitule,
    niveauEuropeen: c.niveau_europeen_libelle ?? null,
    actif: c.etat_libelle ?? null,
    rncp: (c.rncp || []).map((r: any) => ({ code: r.code, libelle: r.libelle, actif: r.actif })),
    rs: (c.rs || []).map((r: any) => ({ code: r.code, libelle: r.libelle, actif: r.actif })),
    rome: (c.rome || []).map((r: any) => ({ code: r.code, libelle: r.libelle })),
    nsf: (c.nsf || []).map((n: any) => ({ code: n.code, libelle: n.libelle })),
    certificateurs: (c.certificateurs || []).map((v: any) => v.libelle).filter(Boolean),
    accessibilite: {
      formationInitiale: Boolean(c.acc_fi),
      apprentissage: Boolean(c.acc_ca),
      formationContinue: Boolean(c.acc_fc),
      contratPro: Boolean(c.acc_cp),
      vae: Boolean(c.acc_vae),
      individuelle: Boolean(c.acc_ind),
    },
    objectif: c.objectif || null,
    programme: c.programme || null,
    admission: c.admission || null,
    poursuite: c.poursuite || null,
    debouches: c.debouches || null,
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

  const jetonApi = Deno.env.get("CERTIFINFO_API_TOKEN");
  if (!jetonApi) {
    return reponseJson({ erreur: "Recherche Certif Info indisponible (clé API non configurée)." }, 503);
  }

  const parametres = new URL(req.url).searchParams;
  const action = parametres.get("action");

  if (action === "recherche") {
    const intitule = (parametres.get("intitule") || "").trim();
    if (intitule.length < 3) {
      return reponseJson({ erreur: "Intitulé trop court (3 caractères minimum)." }, 400);
    }
    const reponseApi = await fetch(
      `${API_BASE}/recherche?intitule=${encodeURIComponent(intitule)}&page_size=10`,
      { headers: { "token-connexion": jetonApi } }
    );
    if (!reponseApi.ok) {
      return reponseJson({ erreur: "Service Certif Info indisponible." }, 502);
    }
    const resultats = await reponseApi.json();
    return reponseJson({ suggestions: (resultats.data || []).map(extraireSuggestion) });
  }

  if (action === "certification") {
    const id = (parametres.get("id") || "").trim();
    if (!id) {
      return reponseJson({ erreur: "Code Certif Info manquant." }, 400);
    }
    const reponseApi = await fetch(`${API_BASE}/certification?id=${encodeURIComponent(id)}`, {
      headers: { "token-connexion": jetonApi },
    });
    if (reponseApi.status === 404) {
      return reponseJson({ trouve: false });
    }
    if (!reponseApi.ok) {
      return reponseJson({ erreur: "Service Certif Info indisponible." }, 502);
    }
    const certification = await reponseApi.json();
    return reponseJson(extraireDetail(certification));
  }

  return reponseJson({ erreur: "Action invalide (attendu : recherche ou certification)." }, 400);
});
