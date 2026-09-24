// Suivi du rendez-vous d'entretien - la réservation se fait sur l'agenda
// réel du consultant via le widget Cal.com intégré côté client
// (rdformation/30min), cette page n'affiche que le résultat.
import { obtenirDemandeParReference } from '../../services/demandes.js';
import { listerCreneaux } from '../../services/creneaux.js';
import { afficherToast } from '../../components/toast.js';
import { creerBoutonRetour } from '../../components/bouton-retour.js';

const LIEN_CALCOM = 'rdformation/30min';

function formaterCreneau(creneau) {
  const options = { dateStyle: 'full', timeStyle: 'short' };
  const debut = new Date(creneau.debut).toLocaleString('fr-FR', options);
  const fin = new Date(creneau.fin).toLocaleTimeString('fr-FR', { timeStyle: 'short' });
  return `${debut} – ${fin}`;
}

export async function vueCreneaux(reference) {
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><p>Chargement…</p></main>';

  try {
    const demande = await obtenirDemandeParReference(reference);
    if (!demande) {
      app.innerHTML = '<main class="conteneur"><h1>Demande introuvable</h1></main>';
      return;
    }
    const creneaux = await listerCreneaux(demande.id);
    rendre(demande, creneaux);
  } catch (err) {
    afficherToast(err.message, { type: 'erreur' });
    app.innerHTML = '<main class="conteneur"><h1>Impossible de charger les créneaux</h1></main>';
  }
}

function rendre(demande, creneaux) {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const main = document.createElement('main');
  main.className = 'conteneur';

  main.appendChild(creerBoutonRetour(`#/demandes/${demande.reference}`, 'Retour à la demande'));

  const titre = document.createElement('h1');
  titre.textContent = `Entretien — ${demande.reference}`;
  main.appendChild(titre);

  const confirme = creneaux.find((c) => c.choisi);

  const bloc = document.createElement('div');
  bloc.className = 'carte confirmation-creneau' + (confirme ? '' : ' confirmation-creneau--attente');

  const icone = document.createElement('span');
  icone.className = 'confirmation-creneau__icone';
  icone.innerHTML = `<i data-lucide="${confirme ? 'calendar-check' : 'calendar-clock'}"></i>`;
  bloc.appendChild(icone);

  const titreBloc = document.createElement('p');
  titreBloc.className = 'confirmation-creneau__titre';
  titreBloc.textContent = confirme ? 'Rendez-vous confirmé par le client' : 'En attente de réservation';
  bloc.appendChild(titreBloc);

  const detail = document.createElement('p');
  detail.className = confirme ? 'confirmation-creneau__date' : 'texte-doux';
  detail.textContent = confirme
    ? formaterCreneau(confirme)
    : `Déjà ajouté à votre agenda dès que le client réserve sur cal.com/${LIEN_CALCOM}.`;
  bloc.appendChild(detail);

  main.appendChild(bloc);

  app.appendChild(main);
  if (window.lucide) window.lucide.createIcons();
}
