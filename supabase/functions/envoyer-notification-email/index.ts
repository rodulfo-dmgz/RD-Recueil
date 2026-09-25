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
  for (const email of emails) {
    const reponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendCle}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "RD Recueil <onboarding@resend.dev>",
        to: email,
        subject: `${titre} - ${reference}`,
        html: `<p>${titre} pour la demande <strong>${reference}</strong>.</p><p><a href="${lien}">Consulter sur RD Recueil</a></p>`,
      }),
    });
    if (reponse.ok) envoyes += 1;
  }

  return reponseJson({ envoyes });
});
