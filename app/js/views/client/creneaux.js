// Choix d'un créneau d'entretien côté client.
import { obtenirDemandeParReference } from '../../services/demandes.js';
import { listerCreneaux, choisirCreneau } from '../../services/creneaux.js';
import { afficherToast } from '../../components/toast.js';
import { creerBoutonRetour } from '../../components/bouton-retour.js';
import { navigate } from '../../router.js';

function formaterCreneau(creneau) {
  const options = { dateStyle: 'full', timeStyle: 'short' };
  const debut = new Date(creneau.debut).toLocaleString('fr-FR', options);
  const fin = new Date(creneau.fin).toLocaleTimeString('fr-FR', { timeStyle: 'short' });
  return `${debut} – ${fin}`;
}

export async function vueCreneauxClient(reference) {
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

  main.appendChild(creerBoutonRetour(`#/d/${demande.reference}`, 'Retour à la demande'));

  const titre = document.createElement('h1');
  titre.textContent = "Rendez-vous d'entretien";
  main.appendChild(titre);

  const confirme = creneaux.find((c) => c.choisi);

  if (creneaux.length === 0) {
    const p = document.createElement('p');
    p.textContent = 'Aucun créneau proposé pour le moment.';
    main.appendChild(p);
  } else if (confirme) {
    const p = document.createElement('p');
    p.textContent = `Entretien confirmé : ${formaterCreneau(confirme)}.`;
    main.appendChild(p);
  } else {
    const p = document.createElement('p');
    p.textContent = 'Choisissez le créneau qui vous convient :';
    main.appendChild(p);

    const liste = document.createElement('div');
    liste.className = 'mes-demandes-liste';
    for (const creneau of creneaux) {
      const carte = document.createElement('div');
      carte.className = 'carte relance-ligne';
      const texte = document.createElement('span');
      texte.textContent = formaterCreneau(creneau);
      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.className = 'btn btn--primaire';
      bouton.textContent = 'Choisir ce créneau';
      bouton.addEventListener('click', async () => {
        if (!window.confirm('Confirmer ce créneau pour l’entretien ?')) return;
        bouton.disabled = true;
        try {
          await choisirCreneau(creneau.id);
          afficherToast('Créneau confirmé. Merci !', { type: 'succes' });
          navigate(`/d/${demande.reference}`);
        } catch (err) {
          afficherToast(err.message, { type: 'erreur' });
          bouton.disabled = false;
        }
      });
      carte.append(texte, bouton);
      liste.appendChild(carte);
    }
    main.appendChild(liste);
  }

  app.appendChild(main);
  if (window.lucide) window.lucide.createIcons();
}
