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
  if (typeof v === 'object') return Object.values(v).filter(Boolean).join(', ');
  if (question.type === 'choix_unique') {
    return question.options?.find((o) => o.valeur === v)?.libelle?.replace(/\\\*/g, '') ?? v;
  }
  return String(v);
}
