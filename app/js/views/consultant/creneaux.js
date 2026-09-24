// Proposition de créneaux d'entretien - le client en choisit un dans son
// espace, ce qui confirme le rendez-vous et fait passer la demande à
// entretien_planifie.
import { obtenirDemandeParReference } from '../../services/demandes.js';
import { listerCreneaux, proposerCreneau, retirerCreneau } from '../../services/creneaux.js';
import { afficherToast } from '../../components/toast.js';
import { creerBoutonRetour } from '../../components/bouton-retour.js';

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
  titre.textContent = `Planification de l'entretien — ${demande.reference}`;
  main.appendChild(titre);

  const confirme = creneaux.find((c) => c.choisi);

  const liste = document.createElement('ul');
  liste.className = 'liste-demandes';
  if (creneaux.length === 0) {
    liste.innerHTML = '<li class="texte-doux">Aucun créneau proposé pour le moment.</li>';
  }
  for (const creneau of creneaux) {
    const li = document.createElement('li');
    li.className = 'relance-ligne';
    const texte = document.createElement('span');
    texte.textContent = formaterCreneau(creneau) + (creneau.choisi ? ' — confirmé par le client' : '');
    li.appendChild(texte);
    if (!confirme) {
      const boutonRetirer = document.createElement('button');
      boutonRetirer.type = 'button';
      boutonRetirer.className = 'btn btn--secondaire';
      boutonRetirer.textContent = 'Retirer';
      boutonRetirer.addEventListener('click', async () => {
        boutonRetirer.disabled = true;
        try {
          await retirerCreneau(creneau.id);
          vueCreneaux(demande.reference);
        } catch (err) {
          afficherToast(err.message, { type: 'erreur' });
          boutonRetirer.disabled = false;
        }
      });
      li.appendChild(boutonRetirer);
    }
    liste.appendChild(li);
  }
  main.appendChild(liste);

  if (!confirme) {
    main.appendChild(rendreFormulaire(demande));
  } else {
    const info = document.createElement('p');
    info.className = 'texte-doux';
    info.textContent = 'Le client a confirmé ce créneau : la demande est passée à "Entretien planifié".';
    main.appendChild(info);
  }

  app.appendChild(main);
  if (window.lucide) window.lucide.createIcons();
}

function rendreFormulaire(demande) {
  const form = document.createElement('form');
  form.className = 'carte';
  const h2 = document.createElement('h2');
  h2.textContent = 'Proposer un créneau';
  form.appendChild(h2);

  const inputDebut = document.createElement('input');
  inputDebut.type = 'datetime-local';
  inputDebut.className = 'champ-saisie';
  inputDebut.required = true;

  const inputFin = document.createElement('input');
  inputFin.type = 'datetime-local';
  inputFin.className = 'champ-saisie';
  inputFin.required = true;

  const bouton = document.createElement('button');
  bouton.type = 'submit';
  bouton.className = 'btn btn--primaire';
  bouton.textContent = 'Ajouter ce créneau';

  form.append(inputDebut, inputFin, bouton);

  form.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    if (new Date(inputFin.value) <= new Date(inputDebut.value)) {
      afficherToast('L’heure de fin doit être après l’heure de début.', { type: 'erreur' });
      return;
    }
    bouton.disabled = true;
    try {
      await proposerCreneau(demande.id, {
        debut: new Date(inputDebut.value).toISOString(),
        fin: new Date(inputFin.value).toISOString(),
      });
      vueCreneaux(demande.reference);
    } catch (err) {
      afficherToast(err.message, { type: 'erreur' });
      bouton.disabled = false;
    }
  });

  return form;
}
