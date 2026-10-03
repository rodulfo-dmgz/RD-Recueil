// Page "Réclamations" (CRM, lot F) : toutes les réclamations des clients visibles
// (l'admin voit tout, un consultant celles de ses clients).
import { listerClientsDetail, listerResponsables } from '../../services/clients.js';
import { afficherToast } from '../../components/toast.js';
import { construireListeReclamations } from '../../components/liste-reclamations.js';
import { el } from '../../components/dashboard-ui.js';

export async function vueReclamations() {
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><p>Chargement…</p></main>';
  let clients = [];
  let responsables = [];
  try {
    [clients, responsables] = await Promise.all([listerClientsDetail(), listerResponsables()]);
  } catch (err) {
    afficherToast(err.message, { type: 'erreur' });
    app.innerHTML = '<main class="conteneur"><h1>Impossible de charger les réclamations</h1></main>';
    return;
  }
  const main = el('main', 'db');
  main.appendChild(el('h1', null, 'Réclamations'));
  main.appendChild(
    el('p', 'texte-doux', 'Chaque réclamation reçue est enregistrée, suivie jusqu’à sa clôture et close par une action corrective (preuve pour l’indicateur 31 de Qualiopi).')
  );
  const carte = el('section', 'db-carte');
  carte.appendChild(construireListeReclamations({ clients, responsables, avecFiltres: true }));
  main.appendChild(carte);
  app.innerHTML = '';
  app.appendChild(main);
  if (window.lucide) window.lucide.createIcons();
}
