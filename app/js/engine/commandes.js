// Menu de commandes (Ctrl+K) : filtrage des commandes (pages, actions) par mots
// tapés, sans accents ni casse. Fonctions pures.
import { normaliserMots } from './texte.js';

// commandes : [{ id, libelle, mots? }] ; mots : synonymes qui retrouvent aussi la commande.
// Tous les mots tapés doivent se retrouver (au début d'un mot de préférence).
// Résultat : les commandes dont un mot commence par le terme d'abord, l'ordre d'origine sinon.
export function filtrerCommandes(commandes, terme = '') {
  const mots = normaliserMots(terme).split(' ').filter(Boolean);
  if (mots.length === 0) return [...commandes];
  const trouvees = [];
  for (const commande of commandes) {
    const texte = normaliserMots(`${commande.libelle} ${commande.mots ?? ''}`);
    if (!mots.every((m) => texte.includes(m))) continue;
    const debuts = texte.split(' ');
    const score = mots.every((m) => debuts.some((d) => d.startsWith(m))) ? 0 : 1;
    trouvees.push({ commande, score, index: trouvees.length });
  }
  return trouvees.sort((a, b) => a.score - b.score || a.index - b.index).map((t) => t.commande);
}
