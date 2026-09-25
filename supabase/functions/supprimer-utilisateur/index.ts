// Edge Function supprimer-utilisateur - 01_ARCHITECTURE.md section 4.2 et 8.1.
// Suppression définitive et irréversible d'un compte : nécessite la clé
// service_role (auth.admin.deleteUser), jamais exposée côté navigateur
// (CLAUDE.md), et réservée à l'admin (contrairement à creer-compte, ouvert
// aussi aux consultants).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
  if (req.method !== "POST") {
    return reponseJson({ erreur: "Méthode non autorisée." }, 405);
  }

  const autorisation = req.headers.get("Authorization");
  if (!autorisation) {
    return reponseJson({ erreur: "Non authentifié." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const cleAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const cleServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

  const { data: profilAppelant } = await clientAppelant
    .from("profils")
    .select("role")
    .eq("user_id", appelant.id)
    .maybeSingle();

  if (!profilAppelant || profilAppelant.role !== "admin") {
    return reponseJson({ erreur: "Réservé à un administrateur." }, 403);
  }

  let corps: Record<string, unknown>;
  try {
    corps = await req.json();
  } catch {
    return reponseJson({ erreur: "Corps JSON invalide." }, 400);
  }

  const userId = String(corps.userId || "");
  if (!userId) {
    return reponseJson({ erreur: "userId manquant." }, 400);
  }
  if (userId === appelant.id) {
    return reponseJson({ erreur: "Vous ne pouvez pas supprimer votre propre compte." }, 400);
  }

  const clientAdmin = createClient(supabaseUrl, cleServiceRole);

  const { data: profilCible } = await clientAdmin
    .from("profils")
    .select("user_id, role")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profilCible) {
    return reponseJson({ erreur: "Compte introuvable." }, 404);
  }

  let demandesSupprimees = 0;
  if (profilCible.role === "client") {
    const { data: acces } = await clientAdmin.from("demande_acces").select("demande_id").eq("user_id", userId);
    const idsDemandes = [...new Set((acces || []).map((a) => a.demande_id))];
    if (idsDemandes.length > 0) {
      const { error: erreurSuppressionDemandes, count } = await clientAdmin
        .from("demandes")
        .delete({ count: "exact" })
        .in("id", idsDemandes);
      if (erreurSuppressionDemandes) {
        return reponseJson({ erreur: erreurSuppressionDemandes.message }, 400);
      }
      demandesSupprimees = count || 0;
    }
  }

  const { error: erreurSuppressionCompte } = await clientAdmin.auth.admin.deleteUser(userId);
  if (erreurSuppressionCompte) {
    return reponseJson({ erreur: erreurSuppressionCompte.message }, 400);
  }

  return reponseJson({ demandesSupprimees });
});
