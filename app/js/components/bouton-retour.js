// Lien de retour stylé (icône + texte), utilisé en haut des pages secondaires.
export function creerBoutonRetour(href, texte) {
  const lien = document.createElement('a');
  lien.href = href;
  lien.className = 'bouton-retour';
  lien.innerHTML = `<i data-lucide="arrow-left"></i><span>${texte}</span>`;
  return lien;
}
