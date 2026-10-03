// Création d'un client ou d'un prospect (CRM, lot A). Réservé au staff.
import { enregistrerClient, listerResponsables } from '../../services/clients.js';
import { navigate } from '../../router.js';
import { getProfil } from '../../store.js';
import { afficherToast } from '../../components/toast.js';
import { construireFormulaireClient } from '../../components/formulaire-client.js';
import { el, icone } from '../../components/dashboard-ui.js';

export async function vueClientNouveau() {
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><p>Chargement…</p></main>';

  let responsables = [];
  try {
    responsables = await listerResponsables();
  } catch (err) {
    afficherToast(err.message, { type: 'erreur' });
  }

  const main = el('main', 'db');
  const retour = el('a', 'cl-retour');
  retour.href = '#/clients';
  retour.append(icone('arrow-left'), el('span', null, 'Tous les clients'));
  main.appendChild(retour);
  main.appendChild(el('h1', null, 'Nouveau client ou prospect'));

  const carte = el('section', 'db-carte');
  carte.appendChild(
    construireFormulaireClient({
      // Un contact qui n'a pas encore fait de demande est un prospect.
      valeurs: { statut: 'prospect' },
      responsables,
      avecResponsable: getProfil()?.role === 'admin',
      libelleBouton: 'Créer la fiche',
      onAnnuler: () => navigate('/clients'),
      onEnregistrer: async (champs) => {
        const client = await enregistrerClient(null, champs);
        afficherToast('Fiche créée.', { type: 'succes' });
        navigate(`/clients/${client.id}`);
      },
    })
  );
  main.appendChild(carte);

  app.innerHTML = '';
  app.appendChild(main);
  if (window.lucide) window.lucide.createIcons();
}
