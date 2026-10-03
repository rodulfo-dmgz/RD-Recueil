// Tri des listes (tableaux) : valeurs absentes en dernier (dans les deux sens),
// nombres comparés comme des nombres, textes sans tenir compte des accents ni de la casse.
const estVide = (v) => v === undefined || v === null || v === '';

export function comparer(a, b) {
  if (estVide(a) || estVide(b)) return estVide(a) === estVide(b) ? 0 : estVide(a) ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'fr', { numeric: true, sensitivity: 'base' });
}

// Copie triée selon valeur(ligne). Ordre stable : à valeur égale, l'ordre d'origine est gardé.
export function trierLignes(lignes, valeur, sens = 'asc') {
  const facteur = sens === 'desc' ? -1 : 1;
  return [...lignes].sort((x, y) => {
    const a = valeur(x);
    const b = valeur(y);
    if (estVide(a) || estVide(b)) return comparer(a, b);
    return facteur * comparer(a, b);
  });
}
