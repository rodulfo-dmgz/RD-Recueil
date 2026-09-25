// Visualisation en modal et impression isolée d'un document (note de
// cadrage, glossaire, récapitulatif, devis...) - chacun s'imprime seul,
// sans le reste de la page.
export function ouvrirModaleDocument({ titre, contenuHtml, classeCorps = 'editeur-note__apercu' }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'modale-document';

  const entete = document.createElement('div');
  entete.className = 'modale-document__entete';
  const h2 = document.createElement('h2');
  h2.textContent = titre;
  const boutonFermer = document.createElement('button');
  boutonFermer.type = 'button';
  boutonFermer.className = 'modale-document__fermer';
  boutonFermer.innerHTML = '<i data-lucide="x"></i>';
  boutonFermer.setAttribute('aria-label', 'Fermer');
  boutonFermer.addEventListener('click', () => dialog.close());
  entete.append(h2, boutonFermer);

  const corps = document.createElement('div');
  corps.className = `modale-document__corps ${classeCorps}`.trim();
  corps.innerHTML = contenuHtml;

  dialog.append(entete, corps);
  dialog.addEventListener('close', () => dialog.remove());
  document.body.appendChild(dialog);
  dialog.showModal();
  if (window.lucide) window.lucide.createIcons();
}

export function imprimerHtml({ titre, contenuHtml, classeCorps = 'editeur-note__apercu' }) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  doc.open();
  doc.write(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${titre}</title>
<link rel="stylesheet" href="css/tokens.css">
<link rel="stylesheet" href="css/components.css">
<style>
  @page { size: A4; margin: 18mm; }
  body { margin: 0; padding: 0; background: var(--surface); }
  .editeur-note__apercu h2 { break-before: page; page-break-before: always; }
  .editeur-note__apercu h1 { break-before: avoid; page-break-before: avoid; }
  .editeur-note__apercu table, .devis-imprimable__table { break-inside: avoid; page-break-inside: avoid; }
</style>
</head>
<body><div class="${classeCorps}">${contenuHtml}</div></body>
</html>`);
  doc.close();

  function nettoyer() {
    iframe.remove();
  }

  iframe.contentWindow.addEventListener('afterprint', nettoyer);
  setTimeout(nettoyer, 60000);

  iframe.onload = () => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  };
}

export function creerLigneDocument({ titre, sousTitre, icone, contenuHtml, classeCorps }) {
  const ligne = document.createElement('div');
  ligne.className = 'ligne ligne-document';

  if (icone) {
    const iconeEl = document.createElement('span');
    iconeEl.className = 'ligne-navigation__icone';
    iconeEl.innerHTML = `<i data-lucide="${icone}"></i>`;
    ligne.appendChild(iconeEl);
  }

  const texte = document.createElement('span');
  texte.className = 'ligne-navigation__texte';
  const nom = document.createElement('span');
  nom.className = 'ligne-navigation__titre';
  nom.textContent = titre;
  texte.appendChild(nom);
  if (sousTitre) {
    const sous = document.createElement('span');
    sous.className = 'ligne-navigation__sous-titre';
    sous.textContent = sousTitre;
    texte.appendChild(sous);
  }
  ligne.appendChild(texte);

  const boutons = document.createElement('div');
  boutons.className = 'ligne-document__actions';

  const boutonVoir = document.createElement('button');
  boutonVoir.type = 'button';
  boutonVoir.className = 'btn-icone';
  boutonVoir.title = 'Voir';
  boutonVoir.setAttribute('aria-label', `Voir : ${titre}`);
  boutonVoir.innerHTML = '<i data-lucide="eye"></i>';
  boutonVoir.addEventListener('click', () => ouvrirModaleDocument({ titre, contenuHtml, classeCorps }));

  const boutonImprimer = document.createElement('button');
  boutonImprimer.type = 'button';
  boutonImprimer.className = 'btn-icone';
  boutonImprimer.title = 'Imprimer';
  boutonImprimer.setAttribute('aria-label', `Imprimer : ${titre}`);
  boutonImprimer.innerHTML = '<i data-lucide="printer"></i>';
  boutonImprimer.addEventListener('click', () => imprimerHtml({ titre, contenuHtml, classeCorps }));

  boutons.append(boutonVoir, boutonImprimer);
  ligne.appendChild(boutons);
  return ligne;
}
