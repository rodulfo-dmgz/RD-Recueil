// Edge Function creer-compte - 01_ARCHITECTURE.md section 8.1.
// Seul moyen de créer un compte (client, consultant ou admin) : nécessite la
// clé service_role, jamais exposée côté navigateur (CLAUDE.md).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES_VALIDES = ["client", "consultant", "admin"];

function genererMotDePasseTemporaire(): string {
  const octets = new Uint8Array(18);
  crypto.getRandomValues(octets);
  return btoa(String.fromCharCode(...octets)).replace(/[+/=]/g, "").slice(0, 16);
}

function reponseJson(corps: unknown, statut = 200) {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
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

  // Client "appelant" : porte le JWT du demandeur, soumis au RLS - sert
  // uniquement à vérifier qui appelle et avec quel rôle.
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

  if (!profilAppelant || !["admin", "consultant"].includes(profilAppelant.role)) {
    return reponseJson({ erreur: "Rôle insuffisant." }, 403);
  }

  let corps: Record<string, unknown>;
  try {
    corps = await req.json();
  } catch {
    return reponseJson({ erreur: "Corps JSON invalide." }, 400);
  }

  const email = String(corps.email || "").trim().toLowerCase();
  const role = String(corps.role || "client");
  const nom = corps.nom ? String(corps.nom) : null;
  const demandeId = corps.demandeId ? String(corps.demandeId) : null;
  const droit = corps.droit ? String(corps.droit) : "editeur";

  if (!email || !EMAIL_RE.test(email)) {
    return reponseJson({ erreur: "E-mail invalide." }, 400);
  }
  if (!ROLES_VALIDES.includes(role)) {
    return reponseJson({ erreur: "Rôle invalide." }, 400);
  }
  if ((role === "consultant" || role === "admin") && profilAppelant.role !== "admin") {
    return reponseJson({ erreur: "Seul un administrateur peut créer ce type de compte." }, 403);
  }

  // Client "admin" : service_role, contourne le RLS - jamais exposé au navigateur.
  const clientAdmin = createClient(supabaseUrl, cleServiceRole);

  if (role === "client" && demandeId) {
    const { error: erreurAcces } = await clientAdmin
      .from("demande_acces")
      .upsert({ demande_id: demandeId, email, droit }, { onConflict: "demande_id,email" });
    if (erreurAcces) {
      return reponseJson({ erreur: erreurAcces.message }, 400);
    }
  }

  const motDePasseTemporaire = genererMotDePasseTemporaire();

  const { data: nouvelUtilisateur, error: erreurCreation } = await clientAdmin.auth.admin.createUser({
    email,
    password: motDePasseTemporaire,
    email_confirm: true,
  });

  if (erreurCreation) {
    // Compte déjà existant (ex. client déjà titulaire d'un accès sur une
    // autre demande) : pas de nouveau mot de passe à communiquer, l'accès à
    // cette demande a déjà été accordé ci-dessus via demande_acces.
    const dejaExistant =
      erreurCreation.message?.toLowerCase().includes("already") ||
      erreurCreation.message?.toLowerCase().includes("registered") ||
      (erreurCreation as { code?: string }).code === "email_exists";

    if (dejaExistant) {
      const { data: profilExistant } = await clientAdmin
        .from("profils")
        .select("user_id, role")
        .eq("email", email)
        .maybeSingle();

      return reponseJson({
        email,
        compteExistant: true,
        role: profilExistant?.role ?? null,
        userId: profilExistant?.user_id ?? null,
      });
    }

    return reponseJson({ erreur: erreurCreation.message || "Échec de la création du compte." }, 400);
  }

  if (!nouvelUtilisateur?.user) {
    return reponseJson({ erreur: "Échec de la création du compte." }, 400);
  }

  // Upsert plutôt qu'un simple insert : le trigger fn_gerer_nouvel_utilisateur
  // a pu déjà créer la ligne profils (role client rattaché via demande_acces).
  const { error: erreurProfil } = await clientAdmin.from("profils").upsert(
    { user_id: nouvelUtilisateur.user.id, role, nom, email, doit_changer_mot_de_passe: true },
    { onConflict: "user_id" }
  );
  if (erreurProfil) {
    return reponseJson({ erreur: erreurProfil.message }, 400);
  }

  return reponseJson({ email, motDePasseTemporaire, userId: nouvelUtilisateur.user.id, compteExistant: false });
});
