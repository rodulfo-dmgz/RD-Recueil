// Gabarit de l'e-mail d'accès envoyé à la création d'un compte (client,
// consultant ou admin) - 01_ARCHITECTURE.md section 8.1 / section 16.
// Mise en page en tableaux et styles en ligne (compatibilité Outlook).

interface EmailAccesData {
  prenom: string | null;
  email: string;
  password: string;
  lienConnexion: string;
}

const LOGO_URL = "https://www.rd-formation.com/assets/img/RDLOGO.png";
const SITE_URL = "https://www.rd-formation.com";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function genererEmailAcces({ prenom, email, password, lienConnexion }: EmailAccesData): string {
  const salutation = prenom ? `Bonjour <strong>${escapeHtml(prenom)}</strong>,` : "Bonjour,";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vos accès RD Recueil</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#26364a;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f7fb;padding:40px 15px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(31,69,144,0.08);">

        <tr><td align="center" style="padding:35px 30px 25px;">
          <a href="${SITE_URL}" target="_blank" style="text-decoration:none;">
            <img src="${LOGO_URL}" alt="RD Formation" width="150" style="display:block;max-width:150px;height:auto;border:0;">
          </a>
        </td></tr>

        <tr><td style="background-color:#1f4590;padding:25px 35px;">
          <h1 style="margin:0;color:#ffffff;font-size:24px;line-height:32px;font-weight:700;">Votre compte est prêt</h1>
          <p style="margin:8px 0 0;color:#dfe8f8;font-size:15px;line-height:24px;">Vous pouvez maintenant accéder à votre espace RD Recueil.</p>
        </td></tr>

        <tr><td style="padding:35px;">
          <p style="margin:0 0 18px;font-size:16px;line-height:26px;">${salutation}</p>
          <p style="margin:0 0 25px;font-size:15px;line-height:25px;color:#526274;">Votre compte RD Recueil vient d'être créé. Vous trouverez ci-dessous vos identifiants pour vous connecter à votre espace.</p>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f6f8fc;border:1px solid #e4e9f2;border-radius:12px;">
            <tr><td style="padding:20px 22px 10px;">
              <p style="margin:0 0 6px;color:#718096;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Adresse e-mail</p>
              <p style="margin:0;font-size:16px;font-weight:600;color:#1f4590;word-break:break-all;">${escapeHtml(email)}</p>
            </td></tr>
            <tr><td style="padding:10px 22px 20px;">
              <p style="margin:0 0 6px;color:#718096;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Mot de passe temporaire</p>
              <p style="margin:0;font-size:16px;font-weight:600;color:#1f4590;font-family:monospace;word-break:break-all;">${escapeHtml(password)}</p>
            </td></tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
            <tr><td style="background-color:#fff8e6;border:1px solid #f4dfaa;border-radius:10px;padding:14px 16px;">
              <p style="margin:0;font-size:13px;line-height:21px;color:#755b18;"><strong>Important :</strong> ce mot de passe est temporaire. Il devra être modifié dès votre première connexion.</p>
            </td></tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:30px;">
            <tr><td align="center">
              <a href="${lienConnexion}" target="_blank" style="display:inline-block;background-color:#1ba098;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 28px;border-radius:9px;">Accéder à mon espace</a>
            </td></tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:30px;">
            <tr><td style="border-left:4px solid #1ba098;padding:5px 15px;">
              <p style="margin:0;font-size:13px;line-height:21px;color:#64748b;">Pour votre sécurité, ne communiquez jamais vos identifiants à une autre personne.</p>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="background-color:#f8fafc;padding:22px 35px;text-align:center;border-top:1px solid #edf1f6;">
          <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;">RD Formation, Montpellier</p>
          <p style="margin:0;font-size:12px;"><a href="${SITE_URL}" target="_blank" style="color:#1f4590;text-decoration:none;">www.rd-formation.com</a> &middot; 07 66 62 60 19</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
