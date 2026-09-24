// Capture d'une signature électronique simple (tracé sur <canvas>) -
// 01_ARCHITECTURE.md section 7 (notes_cadrage.signature_image).
export function ouvrirModaleSignature({ onValider }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'modale-signature';

  const titre = document.createElement('h2');
  titre.textContent = 'Signature électronique';

  const consigne = document.createElement('p');
  consigne.className = 'texte-doux';
  consigne.textContent = 'Dessinez votre signature ci-dessous avec la souris, le doigt ou un stylet.';

  const canvas = document.createElement('canvas');
  canvas.className = 'modale-signature__canvas';
  canvas.width = 480;
  canvas.height = 180;

  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#1F4590';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';

  let dessine = false;
  let enCours = false;

  function position(evt) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (evt.clientX - rect.left) * (canvas.width / rect.width),
      y: (evt.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  canvas.addEventListener('pointerdown', (evt) => {
    enCours = true;
    dessine = true;
    boutonValider.disabled = false;
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

  const actions = document.createElement('div');
  actions.className = 'modale-signature__actions';

  const boutonEffacer = document.createElement('button');
  boutonEffacer.type = 'button';
  boutonEffacer.className = 'btn btn--secondaire';
  boutonEffacer.textContent = 'Effacer';
  boutonEffacer.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    dessine = false;
    boutonValider.disabled = true;
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
    if (!dessine) return;
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
  dialog.append(titre, consigne, canvas, actions);
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
