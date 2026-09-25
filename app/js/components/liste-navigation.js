// Liste de navigation (documents, actions liées à une demande) - une carte,
// une ligne par destination : icône, titre, sous-titre optionnel, chevron.
export function creerLigneNavigation({ href, icone, titre, sousTitre }) {
  const ligne = document.createElement('a');
  ligne.href = href;
  ligne.className = 'ligne ligne-navigation';
  ligne.innerHTML = `
    <span class="ligne-navigation__icone"><i data-lucide="${icone}"></i></span>
    <span class="ligne-navigation__texte">
      <span class="ligne-navigation__titre">${titre}</span>
      ${sousTitre ? `<span class="ligne-navigation__sous-titre">${sousTitre}</span>` : ''}
    </span>
    <i class="ligne-navigation__chevron" data-lucide="chevron-right"></i>
  `;
  return ligne;
}

// Carte contenant des lignes déjà construites, quel qu'en soit le type
// (navigation, document voir/imprimer...) - permet de les mélanger dans une
// même liste avec un séparateur cohérent (cf. .ligne + .ligne en CSS).
export function creerCarteListe(elements) {
  const carte = document.createElement('div');
  carte.className = 'carte liste-navigation';
  for (const el of elements) carte.appendChild(el);
  return carte;
}
