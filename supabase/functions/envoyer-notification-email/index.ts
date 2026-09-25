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

// Mise en page en tableaux et styles en ligne : c'est ce qui reste fiable
// d'un client mail à l'autre (Outlook en particulier ignore une bonne part
// du CSS moderne). Sobre à dessein : logo, message, un seul bouton d'action,
// coordonnées - rien de plus.
function construireEmailHtml({ titre, reference, lien }: { titre: string; reference: string; lien: string }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F8FA;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F8FA;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border-radius:12px;border:1px solid #E2E6ED;">
        <tr><td style="padding:32px 32px 20px;text-align:center;">
          <img src="${LOGO_URL}" width="48" height="48" alt="RD Formation" style="display:block;margin:0 auto 10px;border-radius:50%;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#5B6475;">RD Formation</div>
        </td></tr>
        <tr><td style="padding:0 32px;"><hr style="border:none;border-top:1px solid #E2E6ED;margin:0;"></td></tr>
        <tr><td style="padding:28px 32px;">
          <h1 style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:19px;color:#1A1F2B;">${titre}</h1>
          <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#5B6475;">Concernant la demande <strong style="color:#1A1F2B;">${reference}</strong> sur RD Recueil.</p>
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background:#1F4590;">
            <a href="${lien}" style="display:inline-block;padding:12px 22px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#FFFFFF;text-decoration:none;">Consulter la demande</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:0 32px;"><hr style="border:none;border-top:1px solid #E2E6ED;margin:0;"></td></tr>
        <tr><td style="padding:18px 32px 26px;text-align:center;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5B6475;">
            <a href="${SITE_URL}" style="color:#1CA098;text-decoration:none;">${SITE_URL.replace("https://", "")}</a> &middot; ${TELEPHONE}
          </p>
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
    .from("demandes")
    .select("id")
    .eq("reference", reference)
    .maybeSingle();
  if (!demande) {
    return reponseJson({ erreur: "Demande introuvable." }, 404);
  }

  let emails: string[] = [];
  if (VERS_STAFF.has(vers)) {
    const { data } = await clientAdmin.from("profils").select("email").in("role", ["admin", "consultant"]);
    emails = (data || []).map((p) => p.email).filter(Boolean);
  } else {
    const { data } = await clientAdmin
      .from("demande_acces")
      .select("email")
      .eq("demande_id", demande.id)
      .not("user_id", "is", null);
    emails = (data || []).map((a) => a.email).filter(Boolean);
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
