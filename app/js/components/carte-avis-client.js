// Carte "Votre avis nous intéresse" de l'espace client (CRM, lot F) : les avis de
// satisfaction que RD Formation demande et auxquels le client n'a pas encore
// répondu. Une note de 1 à 5 et un commentaire facultatif.
import { repondreAvis } from '../services/satisfactions.js';
import { afficherToast } from './toast.js';
import { el, icone } from './dashboard-ui.js';
import { etoiles, libelleMoment, preparerReponse, validerReponse } from '../engine/satisfactions.js';

function formulaire(avis, onEnvoye) {
  const form = el('form', 'cl-form sa-form');
  form.noValidate = true;
  form.appendChild(el('h3', 'cl-groupe', `Demande ${avis.demandes?.reference ?? ''} : avis ${libelleMoment(avis.moment).toLowerCase()}`));

  const note = el('fieldset', 'sa-note');
  note.appendChild(el('legend', null, 'Votre note *'));
  const nom = `note-${avis.id}`;
  for (let n = 1; n <= 5; n += 1) {
    const libelle = el('label', 'sa-note__choix');
    const radio = el('input');
    radio.type = 'radio';
    radio.name = nom;
    radio.value = String(n);
    libelle.append(radio, el('span', null, `${n}`), el('small', null, etoiles(n)));
    note.appendChild(libelle);
  }
  const erreur = el('span', 'cl-champ__erreur');
  erreur.setAttribute('role', 'alert');
  note.appendChild(erreur);

  const comm = el('label', 'cl-champ cl-champ--pleine');
  comm.appendChild(el('span', 'cl-champ__libelle', 'Un commentaire ? (facultatif)'));
  const zone = el('textarea', 'champ-saisie cl-notes');
  zone.rows = 3;
  comm.appendChild(zone);

  const erreurGenerale = el('p', 'cl-champ__erreur');
  erreurGenerale.setAttribute('role', 'alert');
  const envoyer = el('button', 'db-btn db-btn--primaire', 'Envoyer mon avis');
  envoyer.type = 'submit';
  form.append(note, comm, erreurGenerale, envoyer);

  form.addEventListener('submit', async (evenement) => {
    evenement.preventDefault();
    erreurGenerale.textContent = '';
    const choisie = form.querySelector(`input[name="${nom}"]:checked`);
    const saisie = { note: choisie?.value ?? '', commentaire: zone.value };
    const erreurs = validerReponse(saisie);
    erreur.textContent = erreurs.note ?? '';
    if (erreurs.note) return;
    envoyer.disabled = true;
    try {
      const { note: n, commentaire } = preparerReponse(saisie);
      await repondreAvis(avis.id, n, commentaire);
      afficherToast('Merci pour votre avis !', { type: 'succes' });
      onEnvoye();
    } catch (err) {
      erreurGenerale.textContent = err.message;
      envoyer.disabled = false;
    }
  });
  return form;
}

// avisAttendus : lignes de `satisfactions` en attente de réponse. Retourne null
// quand il n'y en a pas (rien à afficher).
export function construireCarteAvisClient(avisAttendus = [], { onEnvoye = () => {} } = {}) {
  if (avisAttendus.length === 0) return null;
  const carte = el('section', 'db-carte db-carte--alerte');
  const titre = el('h2', 'db-titre');
  titre.append(icone('smile'), el('span', null, 'Votre avis nous intéresse'));
  carte.appendChild(titre);
  carte.appendChild(el('p', 'texte-doux', 'Votre retour nous aide à améliorer nos accompagnements. Cela prend une minute.'));
  for (const a of avisAttendus) carte.appendChild(formulaire(a, () => onEnvoye(a)));
  return carte;
}
