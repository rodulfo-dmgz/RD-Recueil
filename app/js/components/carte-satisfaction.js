// Carte "Satisfaction" de la vue 360 d'une demande (personnel, CRM lot F) : un
// avis à chaud et un avis à froid. On demande l'avis (le client est prévenu dans
// son espace), on saisit une réponse reçue autrement, ou on la marque sans réponse.
import { listerSatisfactions, demanderAvis, enregistrerAvisRecu, marquerSansReponse } from '../services/satisfactions.js';
import { afficherToast } from './toast.js';
import { el, icone } from './dashboard-ui.js';
import { bouton, champSelect, zoneTexte } from './champs-crm.js';
import { ouvrirModaleCrm } from './modale-crm.js';
import { MOMENTS_SATISFACTION, avisParMoment, etoiles, libelleMoment, preparerReponse, validerReponse } from '../engine/satisfactions.js';

function formaterDate(cle) {
  return cle ? `${cle.slice(8, 10)}/${cle.slice(5, 7)}/${cle.slice(0, 4)}` : '';
}

function ouvrirSaisie({ demande, moment, onEnregistre }) {
  const note = champSelect('note', 'Note *', [1, 2, 3, 4, 5].map((n) => ({ valeur: String(n), libelle: `${n} / 5  ${etoiles(n)}` })), '', 'Choisir une note…');
  const commentaire = zoneTexte('Commentaire', 'commentaire', '', 4);
  ouvrirModaleCrm({
    titre: `Avis ${libelleMoment(moment).toLowerCase()} sur ${demande.reference}`,
    noeuds: [el('p', 'texte-doux', 'Réponse reçue autrement que dans l’application (téléphone, papier, e-mail).'), note.wrapper, commentaire.wrapper],
    libelleEnvoi: 'Enregistrer l’avis',
    onEnvoi: async () => {
      const saisie = { note: note.select.value, commentaire: commentaire.zone.value };
      const erreurs = validerReponse(saisie);
      note.erreur.textContent = erreurs.note ?? '';
      if (erreurs.note) {
        note.select.focus();
        return false;
      }
      await enregistrerAvisRecu(demande.id, moment, preparerReponse(saisie));
      afficherToast('Avis enregistré.', { type: 'succes' });
      onEnregistre();
    },
  });
}

export function construireCarteSatisfaction({ demande }) {
  const carte = el('section', 'db-carte');
  carte.appendChild(el('p', 'texte-doux', 'Chargement…'));
  let avis = [];

  async function charger() {
    avis = await listerSatisfactions({ demandeId: demande.id });
    rendre();
  }
  function recharger() {
    charger().catch((err) => afficherToast(err.message, { type: 'erreur' }));
  }
  async function agir(promesse, message) {
    try {
      await promesse;
      if (message) afficherToast(message, { type: 'succes' });
      recharger();
    } catch (err) {
      afficherToast(err.message, { type: 'erreur' });
    }
  }

  function ligne(moment, a) {
    const li = el('li', 'sa-ligne');
    const texte = el('div', 'sa-ligne__texte');
    texte.appendChild(el('strong', null, `Avis ${libelleMoment(moment.valeur).toLowerCase()}`));
    texte.appendChild(el('span', 'texte-doux', ` (${moment.detail})`));
    const corps = el('p', 'sa-ligne__etat');
    const actions = el('div', 'sa-ligne__actions');
    if (!a) {
      corps.textContent = 'Pas encore demandé.';
      actions.append(
        bouton('db-btn db-btn--discret', 'Demander l’avis', 'send', () => agir(demanderAvis(demande.id, moment.valeur), 'Avis demandé : le client est prévenu dans son espace.')),
        bouton('db-btn db-btn--discret', 'Saisir un avis reçu', 'pencil', () => ouvrirSaisie({ demande, moment: moment.valeur, onEnregistre: recharger }))
      );
    } else if (a.statut === 'demandee') {
      corps.textContent = `Demandé le ${formaterDate(a.date_envoi)} : en attente de réponse.`;
      actions.append(
        bouton('db-btn db-btn--discret', 'Saisir la réponse', 'pencil', () => ouvrirSaisie({ demande, moment: moment.valeur, onEnregistre: recharger })),
        bouton('db-btn db-btn--discret', 'Sans réponse', 'x', () => agir(marquerSansReponse(a.id), 'Avis marqué sans réponse.'))
      );
    } else if (a.statut === 'recue') {
      corps.textContent = `${etoiles(a.note)} ${a.note} / 5, reçu le ${formaterDate(a.date_reponse)} ${a.origine === 'client' ? '(répondu par le client)' : '(saisi par l’équipe)'}`;
    } else {
      corps.textContent = `Sans réponse (demandé le ${formaterDate(a.date_envoi)}).`;
      actions.appendChild(bouton('db-btn db-btn--discret', 'Saisir un avis reçu', 'pencil', () => ouvrirSaisie({ demande, moment: moment.valeur, onEnregistre: recharger })));
    }
    li.append(texte, corps);
    if (a?.statut === 'recue' && a.commentaire) li.appendChild(el('p', 'sa-ligne__commentaire texte-doux', `« ${a.commentaire} »`));
    if (actions.children.length > 0) li.appendChild(actions);
    return li;
  }

  function rendre() {
    carte.innerHTML = '';
    const titre = el('h2', 'db-titre');
    titre.append(icone('smile'), el('span', null, 'Satisfaction'));
    carte.appendChild(titre);
    const parMoment = avisParMoment(avis);
    const liste = el('ul', 'sa-liste');
    for (const m of MOMENTS_SATISFACTION) liste.appendChild(ligne(m, parMoment[m.valeur]));
    carte.appendChild(liste);
    if (window.lucide) window.lucide.createIcons();
  }

  charger().catch((err) => {
    carte.innerHTML = '';
    carte.appendChild(el('p', 'cl-champ__erreur', err.message));
  });
  return carte;
}
