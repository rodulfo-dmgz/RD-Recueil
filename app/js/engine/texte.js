// Comparaison de textes sans accents ni casse, commune à la recherche, aux
// doublons et aux clients dormants (CRM, lot E). Fonctions pures.

// "Société Générale " -> "societe generale".
export function normaliserTexte(valeur) {
  return String(valeur ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// Mêmes règles, avec tout ce qui n'est pas une lettre ou un chiffre remplacé par
// une espace : "Sté ABC-Formation (SAS)" -> "ste abc formation sas".
export function normaliserMots(valeur) {
  return normaliserTexte(valeur)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// "Marie Dupont" -> "MD" (première lettre du premier et du dernier mot).
export function initiales(nom) {
  const mots = String(nom ?? '').trim().split(/\s+/).filter(Boolean);
  return ((mots[0]?.[0] ?? '') + (mots.length > 1 ? mots.at(-1)[0] : '')).toUpperCase();
}

// Chiffres seuls d'un numéro de téléphone ou d'un SIRET.
export function chiffres(valeur) {
  return String(valeur ?? '').replace(/\D/g, '');
}
