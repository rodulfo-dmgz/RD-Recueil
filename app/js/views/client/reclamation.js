// "Signaler un problème" (espace client, CRM lot F) : le client dépose une
// réclamation sur l'une de ses demandes et suit son traitement. Il ne voit ni la
// gravité ni le responsable, seulement l'état (reçue, en cours, traitée) et, une fois
// traitée, la réponse apportée.
import { listerMesDemandes } from '../../services/demandes.js';
import { deposerReclamation, listerMesReclamations } from '../../services/reclamations.js';
import { getClientApercuId } from '../../store.js';
import { afficherToast } from '../../components/toast.js';
import { creerBoutonRetour } from '../../components/bouton-retour.js';
import { el, icone } from '../../components/dashboard-ui.js';
import { champ, champSelect, zoneTexte } from '../../components/champs-crm.js';
import { LONGUEUR_MAX_DESCRIPTION, LONGUEUR_MAX_OBJET, libelleEtatClient, preparerDepot, validerDepot } from '../../engine/reclamations.js';

// État montré au client -> style du badge (mêmes couleurs que côté équipe).
const STYLE_ETAT = { recue: 'ouverte', en_cours: 'en_cours', traitee: 'cloturee' };

function formaterDate(cle) {
  return cle ? `${cle.slice(8, 10)}/${cle.slice(5, 7)}/${cle.slice(0, 4)}` : '';
}

function construireFormulaire({ demandes, reference, onEnvoye }) {
  const form = el('form', 'cl-form');
  form.noValidate = true;
  const choix = champSelect(
    'demande_id',
    'Demande concernée *',
    demandes.map((d) => ({ valeur: d.id, libelle: d.reference })),
    demandes.find((d) => d.reference === reference)?.id ?? (demandes.length === 1 ? demandes[0].id : ''),
    'Choisir une demande…'
  );
  const objet = champ('Objet *', 'objet', '');
  objet.input.maxLength = LONGUEUR_MAX_OBJET;
  const description = zoneTexte('Description', 'description', '', 5);
  description.zone.maxLength = LONGUEUR_MAX_DESCRIPTION;
  const erreurGenerale = el('p', 'cl-champ__erreur');
  erreurGenerale.setAttribute('role', 'alert');
  const envoyer = el('button', 'db-btn db-btn--primaire', 'Envoyer ma réclamation');
  envoyer.type = 'submit';
  form.append(choix.wrapper, objet.wrapper, description.wrapper, erreurGenerale, envoyer);

  form.addEventListener('submit', async (evenement) => {
    evenement.preventDefault();
    erreurGenerale.textContent = '';
    const saisie = { demande_id: choix.select.value, objet: objet.input.value, description: description.zone.value };
    const erreurs = validerDepot(saisie);
    choix.erreur.textContent = erreurs.demande_id ?? '';
    objet.erreur.textContent = erreurs.objet ?? '';
    erreurGenerale.textContent = erreurs.description ?? '';
    if (erreurs.demande_id) return choix.select.focus();
    if (erreurs.objet) return objet.input.focus();
    if (erreurs.description) return undefined;
    envoyer.disabled = true;
    try {
      const { demande_id, objet: o, description: d } = preparerDepot(saisie);
      await deposerReclamation(demande_id, o, d);
      afficherToast('Votre réclamation a été envoyée. Nous vous répondons rapidement.', { type: 'succes' });
      await onEnvoye();
    } catch (err) {
      erreurGenerale.textContent = err.message;
      envoyer.disabled = false;
    }
    return undefined;
  });
  return form;
}

function construireSuivi(mesReclamations) {
  const suivi = el('section', 'db-carte');
  const titre = el('h2', 'db-titre');
  titre.append(icone('list-checks'), el('span', null, 'Mes réclamations'));
  suivi.appendChild(titre);
  const liste = el('ul', 'rc-liste');
  for (const r of mesReclamations) {
    const li = el('li', 'rc-ligne');
    const tete = el('div', 'rc-ligne__tete');
    tete.append(el('span', `cl-badge rc-statut rc-statut--${STYLE_ETAT[r.etat] ?? 'ouverte'}`, libelleEtatClient(r.etat)), el('time', 'texte-doux', `Envoyée le ${formaterDate(r.date_reception)}`));
    li.appendChild(tete);
    const intitule = el('p', 'rc-ligne__objet');
    intitule.append(el('strong', null, r.objet), el('span', 'texte-doux', ` · ${r.reference}`));
    li.appendChild(intitule);
    if (r.description) li.appendChild(el('p', 'rc-ligne__texte texte-doux', r.description));
    if (r.etat === 'traitee') {
      li.appendChild(el('p', 'rc-ligne__texte', r.reponse ? `Réponse : ${r.reponse}` : 'Réclamation traitée.'));
      if (r.date_cloture) li.appendChild(el('p', 'texte-doux rc-ligne__suivi', `Traitée le ${formaterDate(r.date_cloture)}`));
    }
    liste.appendChild(li);
  }
  suivi.appendChild(liste);
  return suivi;
}

// reference : demande présélectionnée (lien "Signaler un problème" d'une demande).
export async function vueReclamationClient(reference) {
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><p>Chargement…</p></main>';

  let demandes;
  let mesReclamations = [];
  try {
    demandes = await listerMesDemandes({ userId: getClientApercuId() });
    // En aperçu client (admin), la liste serait celle de tous : on ne l'affiche pas.
    if (!getClientApercuId()) mesReclamations = await listerMesReclamations().catch(() => []);
  } catch (err) {
    afficherToast(err.message, { type: 'erreur' });
    app.innerHTML = '<main class="conteneur"><h1>Impossible de charger cette page</h1></main>';
    return;
  }

  const main = el('main', 'db');
  main.appendChild(creerBoutonRetour('#/accueil', 'Retour au tableau de bord'));
  main.appendChild(el('h1', null, 'Signaler un problème'));

  const carte = el('section', 'db-carte');
  const titre = el('h2', 'db-titre');
  titre.append(icone('message-square-warning'), el('span', null, 'Votre réclamation'));
  carte.appendChild(titre);
  if (demandes.length === 0) {
    carte.appendChild(el('p', 'texte-doux', 'Vous n’avez aucune demande en cours : contactez-nous directement pour toute réclamation.'));
  } else {
    carte.appendChild(el('p', 'texte-doux', 'Vous n’êtes pas satisfait d’une prestation, d’un échange ou d’un document ? Dites-le nous : votre consultant est prévenu et vous répond.'));
    carte.appendChild(construireFormulaire({ demandes, reference, onEnvoye: () => vueReclamationClient(reference) }));
  }
  main.appendChild(carte);
  if (mesReclamations.length > 0) main.appendChild(construireSuivi(mesReclamations));

  app.innerHTML = '';
  app.appendChild(main);
  if (window.lucide) window.lucide.createIcons();
}
