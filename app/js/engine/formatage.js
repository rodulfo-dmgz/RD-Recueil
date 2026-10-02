// Formatage lisible d'une réponse pour l'affichage (récap client, vue 360 et
// mode entretien consultant). Fonction pure, partagée entre les trois vues.
export function formaterReponse(question, reponse) {
  if (!reponse) return '—';
  if (reponse.nsp) return 'Je ne sais pas / à définir ensemble';

  const v = reponse.valeur;
  if (v == null || v === '') return '—';

  if (Array.isArray(v)) {
    if (v.length === 0) return '—';
    if (typeof v[0] === 'object') return `${v.length} ligne(s)`;
    return v
      .map((val) => question.options?.find((o) => o.valeur === val)?.libelle?.replace(/\\\*/g, '') ?? val)
      .join(', ');
  }
  if (typeof v === 'object') {
    // code_rncp : { texte, source, detail } - seul le texte saisi/choisi est
    // lisible ici, la fiche complète (detail) est affichée à part par les
    // vues qui la supportent (lecture-demande.js, recap.js).
    if (question.type === 'code_rncp') return v.texte || '—';
    return Object.values(v).filter(Boolean).join(', ');
  }
  if (question.type === 'choix_unique') {
    return question.options?.find((o) => o.valeur === v)?.libelle?.replace(/\\\*/g, '') ?? v;
  }
  return String(v);
}

// Texte brut -> HTML sûr (à placer dans un innerHTML).
export function echapperHtml(texte) {
  return String(texte ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
