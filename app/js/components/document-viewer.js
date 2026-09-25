// Visualisation en modal et impression isolée d'un document (note de
// cadrage, glossaire) - chacun s'imprime seul, sans le reste de la page.
export function ouvrirModaleDocument({ titre, contenuHtml }) {
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
  corps.className = 'modale-document__corps editeur-note__apercu';
  corps.innerHTML = contenuHtml;

  dialog.append(entete, corps);
  dialog.addEventListener('close', () => dialog.remove());
  document.body.appendChild(dialog);
  dialog.showModal();
  if (window.lucide) window.lucide.createIcons();
}

export function imprimerHtml({ titre, contenuHtml }) {
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
  .editeur-note__apercu table { break-inside: avoid; page-break-inside: avoid; }
</style>
</head>
<body><div class="editeur-note__apercu">${contenuHtml}</div></body>
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

export function creerLigneDocument({ titre, contenuHtml }) {
  const ligne = document.createElement('div');
  ligne.className = 'ligne-document';

  const nom = document.createElement('span');
  nom.className = 'ligne-document__titre';
  nom.textContent = titre;

  const boutons = document.createElement('div');
  boutons.className = 'ligne-document__actions';

  const boutonVoir = document.createElement('button');
  boutonVoir.type = 'button';
  boutonVoir.className = 'btn-icone';
  boutonVoir.title = 'Voir';
  boutonVoir.setAttribute('aria-label', `Voir : ${titre}`);
  boutonVoir.innerHTML = '<i data-lucide="eye"></i>';
  boutonVoir.addEventListener('click', () => ouvrirModaleDocument({ titre, contenuHtml }));

  const boutonImprimer = document.createElement('button');
  boutonImprimer.type = 'button';
  boutonImprimer.className = 'btn-icone';
  boutonImprimer.title = 'Imprimer';
  boutonImprimer.setAttribute('aria-label', `Imprimer : ${titre}`);
  boutonImprimer.innerHTML = '<i data-lucide="printer"></i>';
  boutonImprimer.addEventListener('click', () => imprimerHtml({ titre, contenuHtml }));

  boutons.append(boutonVoir, boutonImprimer);
  ligne.append(nom, boutons);
  return ligne;
}
