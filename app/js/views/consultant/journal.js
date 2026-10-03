// Journal d'audit (admin, CRM lot F) : qui a créé, modifié ou supprimé quoi dans
// le CRM. Le journal est en ajout seul ; il ne note pas les consultations.
import { listerResponsables } from '../../services/clients.js';
import { creerBoutonRetour } from '../../components/bouton-retour.js';
import { construireListeJournal } from '../../components/liste-journal.js';
import { el } from '../../components/dashboard-ui.js';

export async function vueJournal() {
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><p>Chargement…</p></main>';

  let comptes = [];
  try {
    comptes = await listerResponsables();
  } catch {
    // sans la liste des comptes, le filtre "Compte" est simplement vide.
  }
  const noms = Object.fromEntries(comptes.map((c) => [c.user_id, c.nom || c.email]));

  const main = el('main', 'db');
  main.appendChild(creerBoutonRetour('#/indicateurs', 'Indicateurs'));
  main.appendChild(el('h1', null, 'Journal d’audit'));
  main.appendChild(
    el(
      'p',
      'texte-doux',
      'Créations, modifications et suppressions des clients, contacts, demandes, tâches, échanges, financements, factures et enjeux, avec le compte à l’origine du changement et les valeurs avant et après. Les consultations de fiches ne sont pas notées. Le journal ne peut être ni modifié ni effacé depuis l’application.'
    )
  );
  const carte = el('section', 'db-carte');
  carte.appendChild(construireListeJournal({ noms, comptes }));
  main.appendChild(carte);

  app.innerHTML = '';
  app.appendChild(main);
  if (window.lucide) window.lucide.createIcons();
}
