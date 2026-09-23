// Barre de progression globale + pastilles par section - 01_ARCHITECTURE.md
// section 6.6 et 12.2.
export function rendreProgression({ global, parSection }, sections) {
  const conteneur = document.createElement('div');
  conteneur.className = 'progression';

  const barre = document.createElement('div');
  barre.className = 'progression__barre';
  const remplissage = document.createElement('div');
  remplissage.className = 'progression__remplissage';
  remplissage.style.width = `${global.pourcentage}%`;
  barre.appendChild(remplissage);

  const texte = document.createElement('p');
  texte.className = 'progression__texte texte-doux';
  texte.textContent = `${global.pourcentage}% complété (${global.renseignees}/${global.total})`;

  conteneur.append(barre, texte);

  if (sections && parSection) {
    const pastilles = document.createElement('ul');
    pastilles.className = 'progression__pastilles';
    for (const section of sections) {
      const info = parSection.get(section.id);
      if (!info) continue;
      const li = document.createElement('li');
      li.className = 'progression__pastille' + (info.pourcentage === 100 ? ' progression__pastille--complete' : '');
      li.textContent = section.titre;
      pastilles.appendChild(li);
    }
    conteneur.appendChild(pastilles);
  }

  return conteneur;
}
