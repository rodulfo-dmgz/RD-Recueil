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

  let corps: Record<string, unknown>;
  try {
    corps = await req.json();
  } catch {
    return reponseJson({ erreur: "Corps JSON invalide." }, 400);
  }

  // Profil de l'appelant (une ligne par organisation où il a un rôle du CRM).
  const { data: profilsAppelant } = await clientAppelant.rpc("crm_rpc_mon_profil");
  const organisationDemandee = corps.organisationId ? String(corps.organisationId) : null;
  const candidats = (profilsAppelant || []).filter(
    (p: { organisation_id: string }) => !organisationDemandee || p.organisation_id === organisationDemandee
  );
  if (candidats.length > 1) {
    return reponseJson({ erreur: "Plusieurs organisations possibles : précisez organisationId." }, 400);
  }
  const profilAppelant = candidats[0] as { role: string; organisation_id: string; user_id: string } | undefined;
  if (!profilAppelant || profilAppelant.role !== "admin") {
    return reponseJson({ erreur: "Réservé à un administrateur." }, 403);
  }
  const organisationId = profilAppelant.organisation_id;

  const userId = String(corps.userId || "");
  if (!userId) {
    return reponseJson({ erreur: "userId manquant." }, 400);
  }
  if (userId === profilAppelant.user_id) {
    return reponseJson({ erreur: "Vous ne pouvez pas supprimer votre propre compte." }, 400);
  }

  const clientAdmin = createClient(supabaseUrl, cleServiceRole);

  // La cible doit être un compte du CRM de CETTE organisation (liste réservée à l'administrateur, soumise à la
  // sécurité par ligne) : le client service_role ci-dessous ne doit jamais toucher une autre organisation.
  const { data: comptes } = await clientAppelant.rpc("crm_rpc_comptes");
  const cible = (comptes || []).find((c: { user_id: string }) => c.user_id === userId) as { user_id: string; email: string } | undefined;
  if (!cible) {
    return reponseJson({ erreur: "Compte introuvable." }, 404);
  }

  // Sur le noyau de l'ERP, le compte appartient à la personne et peut servir à d'autres modules : on retire
  // l'accès au CRM (droits crm_ et invitations aux demandes), sans supprimer le compte, la personne ni les
  // demandes. L'effacement définitif relève du noyau (droit à l'effacement, documents signés conservés).
  const { error: erreurDroits } = await clientAdmin
    .from("app_droits")
    .delete()
    .eq("organisation_id", organisationId)
    .eq("personne_id", userId)
    .like("role_code", "crm\\_%");
  if (erreurDroits) {
    return reponseJson({ erreur: erreurDroits.message }, 400);
  }
  const { error: erreurAcces, count } = await clientAdmin
    .from("crm_demande_acces")
    .delete({ count: "exact" })
    .eq("organisation_id", organisationId)
    .or("user_id.eq." + userId + ",email.eq." + cible.email.toLowerCase());
  if (erreurAcces) {
    return reponseJson({ erreur: erreurAcces.message }, 400);
  }

  return reponseJson({ demandesSupprimees: 0, accesRetires: count || 0 });
});
