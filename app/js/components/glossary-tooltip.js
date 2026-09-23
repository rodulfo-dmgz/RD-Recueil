// Infobulle de glossaire - 01_ARCHITECTURE.md section 9.
// Déclenchée au survol, au focus clavier ou au toucher ; fermable par Échap.

let indexGlossaire = null;
let popover = null;

export function initGlossaryTooltip(index) {
  indexGlossaire = index;
  if (popover) return;

  popover = document.createElement('div');
  popover.className = 'gl-popover';
  popover.hidden = true;
  popover.setAttribute('role', 'tooltip');
  document.body.appendChild(popover);

  document.addEventListener('click', (evt) => {
    const bouton = evt.target.closest('.gl-term');
    if (bouton) {
      evt.preventDefault();
      afficher(bouton);
      return;
    }
    if (!popover.contains(evt.target)) masquer();
  });

  document.addEventListener('focusin', (evt) => {
    const bouton = evt.target.closest('.gl-term');
    if (bouton) afficher(bouton);
  });

  document.addEventListener('keydown', (evt) => {
    if (evt.key === 'Escape') masquer();
  });
}

function afficher(bouton) {
  if (!popover || !indexGlossaire) return;
  const id = bouton.dataset.gl;
  const terme = indexGlossaire.get(id);
  if (!terme) return;

  popover.innerHTML = '';
  const titre = document.createElement('strong');
  titre.textContent = terme.libelle;
  const definition = document.createElement('p');
  definition.textContent = terme.definition;
  const exemple = document.createElement('p');
  exemple.className = 'gl-popover__exemple';
  exemple.textContent = terme.exemple;
  const lien = document.createElement('a');
  lien.href = '#/glossaire';
  lien.textContent = 'Voir dans le glossaire';
  popover.append(titre, definition, exemple, lien);

  popover.id = `gl-${id}`;
  popover.hidden = false;

  const rect = bouton.getBoundingClientRect();
  popover.style.top = `${window.scrollY + rect.bottom + 6}px`;
  popover.style.left = `${window.scrollX + rect.left}px`;
}

function masquer() {
  if (popover) popover.hidden = true;
}
