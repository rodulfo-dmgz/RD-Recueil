// Capture d'une signature électronique simple (tracé ou nom tapé, rendu sur
// <canvas>) - 01_ARCHITECTURE.md section 7 (notes_cadrage.signature_image).
export function ouvrirModaleSignature({ onValider }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'modale-signature';

  const titre = document.createElement('h2');
  titre.textContent = 'Signature électronique';

  const onglets = document.createElement('div');
  onglets.className = 'modale-signature__onglets';
  const ongletDessiner = document.createElement('button');
  ongletDessiner.type = 'button';
  ongletDessiner.className = 'modale-signature__onglet modale-signature__onglet--actif';
  ongletDessiner.textContent = 'Dessiner';
  const ongletEcrire = document.createElement('button');
  ongletEcrire.type = 'button';
  ongletEcrire.className = 'modale-signature__onglet';
  ongletEcrire.textContent = 'Écrire mon nom';
  onglets.append(ongletDessiner, ongletEcrire);

  const consigneDessiner = document.createElement('p');
  consigneDessiner.className = 'texte-doux';
  consigneDessiner.textContent = 'Dessinez votre signature ci-dessous avec la souris, le doigt ou un stylet.';

  const champNom = document.createElement('input');
  champNom.type = 'text';
  champNom.className = 'champ-saisie modale-signature__champ-nom';
  champNom.placeholder = 'Tapez votre nom';
  champNom.hidden = true;

  const canvas = document.createElement('canvas');
  canvas.className = 'modale-signature__canvas';
  canvas.width = 480;
  canvas.height = 180;

  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#1F4590';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';

  let mode = 'dessiner';
  let dessine = false;
  let enCours = false;

  function effacerCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function redessinerNom() {
    effacerCanvas();
    const nom = champNom.value.trim();
    if (!nom) return;
    ctx.font = 'italic 600 42px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillStyle = '#1F4590';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(nom, canvas.width / 2, canvas.height / 2, canvas.width - 40);
  }

  function contenuPresent() {
    return mode === 'dessiner' ? dessine : champNom.value.trim().length > 0;
  }

  function majBoutonValider() {
    boutonValider.disabled = !contenuPresent();
  }

  function position(evt) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (evt.clientX - rect.left) * (canvas.width / rect.width),
      y: (evt.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  canvas.addEventListener('pointerdown', (evt) => {
    if (mode !== 'dessiner') return;
    enCours = true;
    dessine = true;
    majBoutonValider();
    const { x, y } = position(evt);
    ctx.beginPath();
    ctx.moveTo(x, y);
    canvas.setPointerCapture(evt.pointerId);
  });
  canvas.addEventListener('pointermove', (evt) => {
    if (!enCours) return;
    const { x, y } = position(evt);
    ctx.lineTo(x, y);
    ctx.stroke();
  });
  canvas.addEventListener('pointerup', () => { enCours = false; });
  canvas.addEventListener('pointerleave', () => { enCours = false; });

  champNom.addEventListener('input', () => {
    redessinerNom();
    majBoutonValider();
  });

  function activerOnglet(nouveauMode) {
    mode = nouveauMode;
    effacerCanvas();
    dessine = false;
    champNom.value = '';
    ongletDessiner.classList.toggle('modale-signature__onglet--actif', mode === 'dessiner');
    ongletEcrire.classList.toggle('modale-signature__onglet--actif', mode === 'ecrire');
    consigneDessiner.hidden = mode !== 'dessiner';
    champNom.hidden = mode !== 'ecrire';
    canvas.style.cursor = mode === 'dessiner' ? 'crosshair' : 'default';
    majBoutonValider();
    if (mode === 'ecrire') champNom.focus();
  }

  ongletDessiner.addEventListener('click', () => activerOnglet('dessiner'));
  ongletEcrire.addEventListener('click', () => activerOnglet('ecrire'));

  const actions = document.createElement('div');
  actions.className = 'modale-signature__actions';

  const boutonEffacer = document.createElement('button');
  boutonEffacer.type = 'button';
  boutonEffacer.className = 'btn btn--secondaire';
  boutonEffacer.textContent = 'Effacer';
  boutonEffacer.addEventListener('click', () => {
    effacerCanvas();
    dessine = false;
    champNom.value = '';
    majBoutonValider();
  });

  const boutonAnnuler = document.createElement('button');
  boutonAnnuler.type = 'button';
  boutonAnnuler.className = 'btn btn--secondaire';
  boutonAnnuler.textContent = 'Annuler';
  boutonAnnuler.addEventListener('click', () => dialog.close());

  const boutonValider = document.createElement('button');
  boutonValider.type = 'button';
  boutonValider.className = 'btn btn--primaire';
  boutonValider.textContent = 'Valider et signer';
  boutonValider.disabled = true;
  boutonValider.addEventListener('click', async () => {
    if (!contenuPresent()) return;
    boutonValider.disabled = true;
    boutonEffacer.disabled = true;
    const succes = await onValider(canvas.toDataURL('image/png'));
    if (succes) {
      dialog.close();
    } else {
      boutonValider.disabled = false;
      boutonEffacer.disabled = false;
    }
  });

  actions.append(boutonEffacer, boutonAnnuler, boutonValider);
  dialog.append(titre, onglets, consigneDessiner, champNom, canvas, actions);
  dialog.addEventListener('close', () => dialog.remove());
  document.body.appendChild(dialog);
  dialog.showModal();
}

export function rendreApercuSignature(signatureImage) {
  const bloc = document.createElement('div');
  bloc.className = 'signature-apercu';
  const legende = document.createElement('p');
  legende.className = 'texte-doux';
  legende.textContent = 'Signature';
  const image = document.createElement('img');
  image.className = 'signature-apercu__image';
  image.src = signatureImage;
  image.alt = 'Signature manuscrite du client';
  bloc.append(legende, image);
  return bloc;
}
