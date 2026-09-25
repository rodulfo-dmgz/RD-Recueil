// Rendu Markdown -> HTML assaini - 01_ARCHITECTURE.md section 5.1
// (marked + DOMPurify, chargés en CDN dans index.html).
export function rendreMarkdown(texte) {
  const html = window.marked.parse(texte || '', { breaks: true });
  return window.DOMPurify.sanitize(html);
}

const MARQUEUR_ANNEXE_GLOSSAIRE = '### Annexe';

// Sépare l'annexe glossaire du corps de la note de cadrage, pour un affichage
// en deux cartes distinctes (note, puis glossaire) plutôt qu'un bloc unique.
export function separerAnnexeGlossaire(contenuMd) {
  const index = (contenuMd || '').indexOf(MARQUEUR_ANNEXE_GLOSSAIRE);
  if (index === -1) return { corps: contenuMd || '', annexe: null };
  return {
    corps: contenuMd.slice(0, index).trim(),
    annexe: contenuMd.slice(index).trim(),
  };
}

const SIGNATURE_RD_FORMATION = 'assets/images/signature.png';

// Remplit les cases Date/Signature du tableau de validation (section 16 du
// gabarit) avec les valeurs réelles - restées vides à la génération, car la
// validation client intervient après coup. RD Formation : signature fixe,
// dès l'envoi de la note. Client : uniquement une fois la note validée.
export function injecterValidationDansCorps(corps, note) {
  const dateClient =
    note.statut === 'validee' && note.validee_le ? new Date(note.validee_le).toLocaleDateString('fr-FR') : '';
  const dateRd = note.envoyee_le ? new Date(note.envoyee_le).toLocaleDateString('fr-FR') : '';

  let resultat = corps.replace('| Date : | Date : |', `| Date : ${dateClient} | Date : ${dateRd} |`);

  const signatureClient =
    note.statut === 'validee' && note.signature_image
      ? `![Signature client](${note.signature_image})` +
        (note.signature_credential ? `<br><small>Code : ${note.signature_credential}</small>` : '')
      : '';
  const signatureRd = note.envoyee_le ? `![Signature RD Formation](${SIGNATURE_RD_FORMATION})` : '';

  resultat = resultat.replace(
    '| Signature : | Signature : |',
    `| Signature : ${signatureClient} | Signature : ${signatureRd} |`
  );

  return resultat;
}
