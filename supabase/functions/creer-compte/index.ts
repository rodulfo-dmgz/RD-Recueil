// Edge Function creer-compte - 01_ARCHITECTURE.md section 8.1.
// Seul moyen de créer un compte (client, consultant ou admin) : nécessite la
// clé service_role, jamais exposée côté navigateur (CLAUDE.md).
// Sur le noyau de l'ERP : le compte est rattaché à une PERSONNE (app_personnes), membre de l'organisation
// (app_membres) avec le droit crm_consultant ou crm_client (app_droits) ; un administrateur est
// administrateur d'organisation (app_membres.est_admin). Le rôle de l'appelant vient de crm_rpc_mon_profil.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { genererEmailAcces } from "./mail.ts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES_VALIDES = ["client", "consultant", "admin"];

// Membre actif de l'organisation + droit du module (administrateur : administrateur d'organisation).
// Retourne un message d'erreur, ou null si tout est en place. Idempotent.
async function rattacherPersonne(
  clientAdmin: ReturnType<typeof createClient>,
  organisationId: string,
  personneId: string,
  role: string
): Promise<string | null> {
  // Un membre déjà présent (même suspendu) n'est pas modifié, sauf pour devenir administrateur.
  const { error: erreurMembre } = await clientAdmin
    .from("app_membres")
    .upsert(
      role === "admin"
        ? { organisation_id: organisationId, personne_id: personneId, statut: "actif", est_admin: true }
        : { organisation_id: organisationId, personne_id: personneId, statut: "actif" },
      role === "admin" ? { onConflict: "organisation_id,personne_id" } : { onConflict: "organisation_id,personne_id", ignoreDuplicates: true }
    );
  if (erreurMembre) return erreurMembre.message;
  if (role !== "admin") {
    const { error: erreurDroit } = await clientAdmin
      .from("app_droits")
      .upsert(
        { organisation_id: organisationId, personne_id: personneId, role_code: "crm_" + role },
        { onConflict: "organisation_id,personne_id,role_code", ignoreDuplicates: true }
      );
    if (erreurDroit) return erreurDroit.message;
  }
  return null;
}

function genererMotDePasseTemporaire(): string {
  const octets = new Uint8Array(18);
  crypto.getRandomValues(octets);
  return btoa(String.fromCharCode(...octets)).replace(/[+/=]/g, "").slice(0, 16);
}

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

  let corps: Record<string, unknown>;
  try {
    corps = await req.json();
  } catch {
    return reponseJson({ erreur: "Corps JSON invalide." }, 400);
  }

  // Profil de l'appelant : une ligne par organisation où il a un rôle du CRM ; l'organisation est précisée
  // par le corps de la requête quand il en a plusieurs.
  const { data: profilsAppelant } = await clientAppelant.rpc("crm_rpc_mon_profil");
  const organisationDemandee = corps.organisationId ? String(corps.organisationId) : null;
  const candidats = (profilsAppelant || []).filter(
    (p: { organisation_id: string }) => !organisationDemandee || p.organisation_id === organisationDemandee
  );
  if (candidats.length > 1) {
    return reponseJson({ erreur: "Plusieurs organisations possibles : précisez organisationId." }, 400);
  }
  const profilAppelant = candidats[0] as { role: string; organisation_id: string; user_id: string } | undefined;
  if (!profilAppelant || !["admin", "consultant"].includes(profilAppelant.role)) {
    return reponseJson({ erreur: "Rôle insuffisant." }, 403);
  }
  const organisationId = profilAppelant.organisation_id;

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

  // La demande doit être visible par l'appelant (sécurité par ligne) : le client service_role ci-dessous
  // contourne cette sécurité, il ne doit jamais toucher une demande d'une autre organisation.
  if (role === "client" && demandeId) {
    const { data: demandeVisible } = await clientAppelant.from("crm_demandes").select("id").eq("id", demandeId).maybeSingle();
    if (!demandeVisible) {
      return reponseJson({ erreur: "Demande introuvable." }, 404);
    }
  }

  if (role === "client" && demandeId) {
    const { error: erreurAcces } = await clientAdmin
      .from("crm_demande_acces")
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
      // Compte déjà existant : on lui donne le droit demandé dans cette organisation, sans nouveau mot de passe.
      const { data: personneExistante } = await clientAdmin.from("app_personnes").select("id").eq("email", email).maybeSingle();
      if (!personneExistante) {
        return reponseJson({ erreur: "Ce compte existe sans fiche personne : invitez-le depuis l'ERP." }, 409);
      }
      const erreurRattachement = await rattacherPersonne(clientAdmin, organisationId, personneExistante.id, role);
      if (erreurRattachement) {
        return reponseJson({ erreur: erreurRattachement }, 400);
      }
      if (role === "client" && demandeId) {
        await clientAdmin.from("crm_demande_acces").update({ user_id: personneExistante.id }).eq("demande_id", demandeId).eq("email", email);
      }
      return reponseJson({ email, compteExistant: true, role, userId: personneExistante.id });
    }

    return reponseJson({ erreur: erreurCreation.message || "Échec de la création du compte." }, 400);
  }

  if (!nouvelUtilisateur?.user) {
    return reponseJson({ erreur: "Échec de la création du compte." }, 400);
  }

  // Fiche personne (identité du noyau), rattachée au compte d'authentification.
  // Une fiche existante (créée dans l'ERP) est conservée : on lui rattache seulement le compte, sans toucher à son nom.
  let { data: personne } = await clientAdmin.from("app_personnes").select("id, auth_user_id").eq("email", email).maybeSingle();
  if (personne) {
    if (!personne.auth_user_id) {
      await clientAdmin.from("app_personnes").update({ auth_user_id: nouvelUtilisateur.user.id }).eq("id", personne.id);
    }
  } else {
    const { data: creee, error: errPersonne } = await clientAdmin
      .from("app_personnes")
      .insert({ auth_user_id: nouvelUtilisateur.user.id, email, nom: nom || email.split("@")[0] })
      .select("id, auth_user_id")
      .single();
    if (errPersonne || !creee) {
      return reponseJson({ erreur: errPersonne?.message || "Échec de la création de la fiche personne." }, 400);
    }
    personne = creee;
  }
  const erreurRattachement = await rattacherPersonne(clientAdmin, organisationId, personne.id, role);
  if (erreurRattachement) {
    return reponseJson({ erreur: erreurRattachement }, 400);
  }
  if (role === "client" && demandeId) {
    await clientAdmin.from("crm_demande_acces").update({ user_id: personne.id }).eq("demande_id", demandeId).eq("email", email);
  }

  // Envoi de l'e-mail d'accès - best-effort : un souci du côté de Resend ne
  // doit jamais empêcher la création du compte, qui a déjà réussi à ce
  // stade (même logique que envoyer-notification-email : la fiabilité des
  // e-mails transactionnels a déjà été un point de friction sur ce projet,
  // 01_ARCHITECTURE.md section 8.1).
  const resendCle = Deno.env.get("RESEND_API_KEY");
  if (resendCle) {
    try {
      const appUrl = Deno.env.get("APP_URL") || "https://rodulfo-dmgz.github.io/RD-Recueil";
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendCle}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "RD Formation <notifications@mail.rd-formation.com>",
          to: email,
          subject: "Votre compte RD Recueil est prêt",
          html: genererEmailAcces({
            prenom: nom,
            email,
            password: motDePasseTemporaire,
            lienConnexion: `${appUrl}/#/connexion`,
          }),
        }),
      });
    } catch {
      // silencieux : la création du compte reste un succès.
    }
  }

  return reponseJson({ email, motDePasseTemporaire, userId: personne.id, compteExistant: false });
});
