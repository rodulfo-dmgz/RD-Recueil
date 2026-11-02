// Edge Function envoyer-notification-email - 01_ARCHITECTURE.md section 16.
// Envoie l'e-mail associé à une étape franchie (soumission, note de
// cadrage, proposition, entretien). Séparée de la notification interne
// (déjà créée par le trigger fn_notifier_evenement sur evenements) : garde
// la clé du fournisseur d'e-mail (Resend) hors de la base, comme
// service_role pour creer-compte (CLAUDE.md).
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

// Même liste que fn_notifier_evenement (0023_notifications.sql) : les
// transitions absentes ne génèrent ni notification interne ni e-mail.
const TITRES: Record<string, string> = {
  soumise: "Nouvelles réponses soumises",
  cadrage_envoye: "Note de cadrage envoyée",
  cadrage_a_revoir: "Modification demandée sur la note de cadrage",
  cadrage_valide: "Note de cadrage validée",
  proposition_envoyee: "Proposition commerciale envoyée",
  gagnee: "Proposition acceptée",
  perdue: "Proposition refusée",
  entretien_planifie: "Entretien planifié",
};
const VERS_STAFF = new Set(["soumise", "cadrage_a_revoir", "cadrage_valide", "gagnee", "perdue", "entretien_planifie"]);

const LOGO_URL = "https://www.rd-formation.com/assets/img/RDLOGO.png";
const SITE_URL = "https://www.rd-formation.com";
const TELEPHONE = "07 66 62 60 19";

// Même gabarit (bandeau bleu, carte blanche, bouton centré dans sa propre
// table) que celui de l'e-mail d'accès (creer-compte/mail.ts), pour une
// identité visuelle cohérente entre les deux e-mails. Tableaux et styles en
// ligne : ce qui reste fiable d'un client mail à l'autre (Outlook en
// particulier ignore une bonne part du CSS moderne).
function construireEmailHtml({ titre, reference, lien }: { titre: string; reference: string; lien: string }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titre}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#26364a;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f7fb;padding:40px 15px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(31,69,144,0.08);">

        <tr><td align="center" style="padding:35px 30px 25px;">
          <a href="${SITE_URL}" target="_blank" style="text-decoration:none;">
            <img src="${LOGO_URL}" alt="RD Formation" width="130" style="display:block;max-width:130px;height:auto;border:0;">
          </a>
        </td></tr>

        <tr><td style="background-color:#1f4590;padding:25px 35px;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;line-height:30px;font-weight:700;">${titre}</h1>
        </td></tr>

        <tr><td style="padding:35px;text-align:center;">
          <p style="margin:0 0 28px;font-size:15px;line-height:25px;color:#526274;">Concernant la demande <strong style="color:#1f4590;">${reference}</strong> sur RD Recueil.</p>

          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td align="center">
              <a href="${lien}" target="_blank" style="display:inline-block;background-color:#1ba098;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 28px;border-radius:9px;">Consulter la demande</a>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="background-color:#f8fafc;padding:22px 35px;text-align:center;border-top:1px solid #edf1f6;">
          <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;">RD Formation, Montpellier</p>
          <p style="margin:0;font-size:12px;"><a href="${SITE_URL}" target="_blank" style="color:#1f4590;text-decoration:none;">www.rd-formation.com</a> &middot; ${TELEPHONE}</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
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

  // Client "appelant" : porte le JWT du demandeur, soumis au RLS. Sert à
  // vérifier qui appelle et s'il a accès à la demande (lot Accès).
  const clientAppelant = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
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

  const reference = String(corps.reference || "");
  const vers = String(corps.vers || "");
  const titre = TITRES[vers];
  if (!reference || !titre) {
    // Transition non notifiable : succès silencieux, rien à envoyer.
    return reponseJson({ envoyes: 0 });
  }

  const resendCle = Deno.env.get("RESEND_API_KEY");
  if (!resendCle) {
    return reponseJson({ erreur: "RESEND_API_KEY non configurée." }, 500);
  }

  const appUrl = Deno.env.get("APP_URL") || "https://rodulfo-dmgz.github.io/RD-Recueil";
  const clientAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: demande } = await clientAdmin
    .from("crm_demandes")
    .select("id, consultant_id, organisation_id")
    .eq("reference", reference)
    .maybeSingle();
  if (!demande) {
    return reponseJson({ erreur: "Demande introuvable." }, 404);
  }

  // Accès à la demande : personnel concerné (admin, consultant de la demande)
  // ou compte client invité. Même réponse qu'une demande inexistante.
  const { data: aAcces } = await clientAppelant.rpc("crm_acces_demande", { p_demande_id: demande.id });
  if (!aAcces) {
    return reponseJson({ erreur: "Demande introuvable." }, 404);
  }

  // Anti-abus : l'e-mail n'a de sens que juste après la transition qui l'a
  // déclenchée (l'application l'appelle aussitôt après l'action).
  const depuis = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: evenement } = await clientAdmin
    .from("crm_evenements")
    .select("id")
    .eq("demande_id", demande.id)
    .eq("type", "statut")
    .eq("vers", vers)
    .gte("created_at", depuis)
    .limit(1);
  if (!evenement || evenement.length === 0) {
    return reponseJson({ envoyes: 0 });
  }

  let emails: string[] = [];
  if (VERS_STAFF.has(vers)) {
    // L'administrateur et le consultant de la demande seulement : personnes du noyau (crm_destinataires_staff).
    const { data: ids } = await clientAdmin.rpc("crm_destinataires_staff", {
      p_org: demande.organisation_id,
      p_consultant: demande.consultant_id,
    });
    const { data: personnes } = await clientAdmin.from("app_personnes").select("email").in("id", ids || []);
    emails = (personnes || []).map((p) => p.email).filter(Boolean);
  } else {
    // Clients invités sur la demande qui ont un compte : adresse de l'invitation retrouvée dans app_personnes,
    // avec le droit crm_client dans l'organisation de la demande.
    const { data: acces } = await clientAdmin.from("crm_demande_acces").select("email").eq("demande_id", demande.id);
    const invites = (acces || []).map((a) => String(a.email).toLowerCase());
    const { data: personnes } = await clientAdmin.from("app_personnes").select("id, email").in("email", invites);
    const { data: droits } = await clientAdmin
      .from("app_droits")
      .select("personne_id")
      .eq("organisation_id", demande.organisation_id)
      .eq("role_code", "crm_client")
      .in("personne_id", (personnes || []).map((p) => p.id));
    const clients = new Set((droits || []).map((d) => d.personne_id));
    emails = (personnes || []).filter((p) => clients.has(p.id)).map((p) => p.email).filter(Boolean);
  }

  const chemin = VERS_STAFF.has(vers) ? `demandes/${reference}` : `d/${reference}`;
  const lien = `${appUrl}/#/${chemin}`;

  let envoyes = 0;
  const erreurs: string[] = [];
  for (const email of emails) {
    const reponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendCle}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "RD Formation <notifications@mail.rd-formation.com>",
        to: email,
        subject: `${titre} - ${reference}`,
        html: construireEmailHtml({ titre, reference, lien }),
      }),
    });
    if (reponse.ok) {
      envoyes += 1;
    } else {
      erreurs.push(await reponse.text());
    }
  }

  return reponseJson({ envoyes, erreurs: erreurs.length ? erreurs : undefined });
});
