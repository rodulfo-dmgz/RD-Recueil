// Onglet Activité de la fiche client (CRM, lot B) : tâches ouvertes, échanges
// notés (appels, e-mails, rendez-vous, notes) et historique des étapes des
// demandes. Un échange peut créer la tâche de suivi dans le même geste.
// Réservé au staff : un consultant ne reçoit que ses propres tâches (RLS).
import { listerTaches, creerTache, terminerTache, reporterTache, supprimerTache } from '../../services/taches.js';
import { listerActivites, creerActivite, supprimerActivite } from '../../services/activites.js';
import { listerContacts, enregistrerContact } from '../../services/clients.js';
import { afficherToast } from '../../components/toast.js';
import { el, icone } from '../../components/dashboard-ui.js';
import { bouton, champ, champSelect, zoneTexte, caseACocher } from '../../components/champs-crm.js';
import { construireLigneTache, echeanceApresReport } from '../../components/ligne-tache.js';
import { cleJour } from '../../engine/jalons.js';
import { nomComplet, preparerContact, validerContact } from '../../engine/fiche-client.js';
import {
  TYPES_ACTIVITE,
  TYPES_TACHE,
  ajouterJours,
  classerTaches,
  estOuverte,
  fusionnerHistorique,
  libelleTypeActivite,
  preparerActivite,
  preparerTache,
  validerActivite,
  validerTache,
  versChampDatetime,
} from '../../engine/taches.js';

const ICONES_ACTIVITE = { appel: 'phone', email: 'mail', rendez_vous: 'calendar', note: 'sticky-note', autre: 'circle-dot' };

function formaterDateHeure(date) {
  return new Date(date).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function nomResponsable(profil) {
  return profil?.nom || profil?.email || null;
}

// Champs d'une tâche (titre, type, échéance et, pour l'admin, responsable) :
// partagés par le formulaire de tâche et la tâche de suivi d'un échange.
// `lire()` renvoie la saisie ; `afficherErreurs(erreurs)` les place sous les champs.
function champsTache({ titre, type, echeance, estAdmin, responsables, profilId }) {
  const noeud = el('div', 'cl-form__groupe');
  const champTitre = champ('Titre *', 'tache-titre', titre);
  const champType = champSelect('tache-type', 'Type', TYPES_TACHE, type);
  const champEcheance = champ('Échéance *', 'tache-echeance', echeance, 'date');
  noeud.append(champTitre.wrapper, champType.wrapper, champEcheance.wrapper);

  let champResponsable = null;
  if (estAdmin) {
    champResponsable = champSelect(
      'tache-responsable',
      'Responsable',
      responsables.map((r) => ({ valeur: r.user_id, libelle: nomResponsable(r) })),
      profilId
    );
    noeud.appendChild(champResponsable.wrapper);
  }

  return {
    noeud,
    titre: champTitre,
    lire: () => ({
      titre: champTitre.input.value,
      type: champType.select.value,
      echeance: champEcheance.input.value,
      ...(champResponsable ? { assignee_id: champResponsable.select.value } : {}),
    }),
    afficherErreurs: (erreurs) => {
      champTitre.erreur.textContent = erreurs.titre ?? '';
      champEcheance.erreur.textContent = erreurs.echeance ?? '';
      return erreurs.titre ? champTitre.input : erreurs.echeance ? champEcheance.input : null;
    },
  };
}

const NOUVEAU_CONTACT = '__nouveau__';

// Fenêtre modale d'ajout rapide d'un contact (élément <dialog> natif : focus
// gardé, Échap pour fermer). Le contact est créé tout de suite dans l'onglet
// Contacts, sans rôle ; il devient le principal s'il n'y en a pas encore.
// onCree(contact) est appelé après la création ; onFermee() à chaque fermeture.
function ouvrirModaleContact({ clientId, principalExiste, onCree, onFermee }) {
  const dialog = el('dialog', 'modale-formulaire');
  dialog.setAttribute('aria-labelledby', 'modale-contact-titre');
  // Fermeture unique : par un bouton, le fond, Échap (événement close) ou après la création.
  let termine = false;
  const fermer = () => {
    if (dialog.open) dialog.close();
    if (termine) return;
    termine = true;
    dialog.remove();
    onFermee();
  };
  const formulaire = el('form', 'cl-form');
  formulaire.noValidate = true;
  const titre = el('h2', null, 'Nouveau contact');
  titre.id = 'modale-contact-titre';

  const nom = champ('Nom *', 'nouveau-nom', '');
  const fonction = champ('Fonction', 'nouveau-fonction', '');
  const email = champ('E-mail', 'nouveau-email', '', 'email');
  const telephone = champ('Téléphone', 'nouveau-telephone', '', 'tel');
  const erreurGenerale = el('p', 'cl-champ__erreur');
  erreurGenerale.setAttribute('role', 'alert');
  const actions = el('div', 'modale-formulaire__actions');
  const envoyer = el('button', 'db-btn db-btn--primaire', 'Ajouter le contact');
  envoyer.type = 'submit';
  actions.append(envoyer, bouton('db-btn db-btn--discret', 'Annuler', null, fermer));
  formulaire.append(titre, nom.wrapper, fonction.wrapper, email.wrapper, telephone.wrapper, erreurGenerale, actions);
  dialog.appendChild(formulaire);

  formulaire.addEventListener('submit', async (evenement) => {
    evenement.preventDefault();
    erreurGenerale.textContent = '';
    const saisie = { nom: nom.input.value, fonction: fonction.input.value, email: email.input.value, telephone: telephone.input.value, roles: [], principal: !principalExiste, actif: true };
    const erreurs = validerContact(saisie);
    nom.erreur.textContent = erreurs.nom ?? '';
    email.erreur.textContent = erreurs.email ?? '';
    if (erreurs.nom) return nom.input.focus();
    if (erreurs.email) return email.input.focus();
    envoyer.disabled = true;
    try {
      const contact = await enregistrerContact(clientId, null, preparerContact(saisie));
      onCree(contact);
      fermer();
    } catch (err) {
      erreurGenerale.textContent = err.message;
      envoyer.disabled = false;
    }
  });
  dialog.addEventListener('click', (evenement) => {
    if (evenement.target === dialog) fermer();
  });
  dialog.addEventListener('cancel', fermer); // Échap
  dialog.addEventListener('close', fermer);
  document.body.appendChild(dialog);
  dialog.showModal();
}

// Choix du contact d'un échange ou d'une tâche. "+ Nouveau contact…" ouvre la
// fenêtre d'ajout rapide ; le contact créé est choisi d'office, et une
// fermeture sans création revient au choix précédent.
function selecteurContact({ contacts, clientId, principalExiste }) {
  const choix = champSelect('contact_id', 'Contact', [...contacts, { valeur: NOUVEAU_CONTACT, libelle: '+ Nouveau contact…' }], '', 'Aucun contact en particulier');
  let precedent = '';
  choix.select.addEventListener('change', () => {
    if (choix.select.value !== NOUVEAU_CONTACT) {
      precedent = choix.select.value;
      return;
    }
    let cree = false;
    ouvrirModaleContact({
      clientId,
      principalExiste,
      onCree: (contact) => {
        cree = true;
        const option = new Option(nomComplet(contact) || contact.email, contact.id);
        choix.select.insertBefore(option, choix.select.querySelector(`option[value="${NOUVEAU_CONTACT}"]`));
        choix.select.value = contact.id;
        precedent = contact.id;
        afficherToast('Contact ajouté.', { type: 'succes' });
      },
      onFermee: () => {
        if (!cree) choix.select.value = precedent;
        choix.select.focus();
      },
    });
  });
  return { noeud: choix.wrapper, select: choix.select };
}

function construireFormulaireTache({ contacts, clientId, principalExiste, demandes, responsables, estAdmin, profilId, onEnregistrer, onAnnuler }) {
  const formulaire = el('form', 'cl-form');
  formulaire.noValidate = true;
  formulaire.appendChild(el('h3', 'cl-groupe', 'Nouvelle tâche'));

  const base = champsTache({ titre: '', type: 'appel', echeance: ajouterJours(cleJour(new Date()), 1), estAdmin, responsables, profilId });
  formulaire.appendChild(base.noeud);

  const liens = el('div', 'cl-form__groupe');
  const contact = selecteurContact({ contacts, clientId, principalExiste });
  const demande = champSelect('demande_id', 'Demande', demandes, '', 'Aucune demande en particulier');
  liens.append(contact.noeud, demande.wrapper);
  formulaire.appendChild(liens);
  const description = zoneTexte('Description', 'description', '');
  formulaire.appendChild(description.wrapper);

  const erreurGenerale = el('p', 'cl-champ__erreur');
  erreurGenerale.setAttribute('role', 'alert');
  const actions = el('div', 'cl-form__actions');
  const envoyer = el('button', 'db-btn db-btn--primaire', 'Créer la tâche');
  envoyer.type = 'submit';
  actions.append(envoyer, bouton('db-btn db-btn--discret', 'Annuler', null, onAnnuler));
  formulaire.append(erreurGenerale, actions);

  formulaire.addEventListener('submit', async (evenement) => {
    evenement.preventDefault();
    erreurGenerale.textContent = '';
    const saisie = { ...base.lire(), demande_id: demande.select.value, description: description.zone.value };
    const erreurs = validerTache(saisie);
    const invalide = base.afficherErreurs(erreurs);
    if (invalide) return invalide.focus();
    envoyer.disabled = true;
    try {
      await onEnregistrer(preparerTache({ ...saisie, contact_id: contact.select.value }));
    } catch (err) {
      erreurGenerale.textContent = err.message;
      envoyer.disabled = false;
    }
  });
  return formulaire;
}

function construireFormulaireEchange({ contacts, clientId, principalExiste, demandes, responsables, estAdmin, profilId, onEnregistrer, onAnnuler }) {
  const formulaire = el('form', 'cl-form');
  formulaire.noValidate = true;
  formulaire.appendChild(el('h3', 'cl-groupe', 'Noter un échange'));

  const identite = el('div', 'cl-form__groupe');
  const type = champSelect('type', 'Type', TYPES_ACTIVITE, 'appel');
  const date = champ('Date et heure', 'date_activite', versChampDatetime(), 'datetime-local');
  const objet = champ('Objet *', 'objet', '');
  identite.append(type.wrapper, date.wrapper, objet.wrapper);
  formulaire.appendChild(identite);

  const liens = el('div', 'cl-form__groupe');
  const contact = selecteurContact({ contacts, clientId, principalExiste });
  const demande = champSelect('demande_id', 'Demande', demandes, '', 'Aucune demande en particulier');
  liens.append(contact.noeud, demande.wrapper);
  formulaire.appendChild(liens);
  const description = zoneTexte('Ce qui s’est dit ou décidé', 'description', '', 4);
  formulaire.appendChild(description.wrapper);

  const suivi = caseACocher('Créer une tâche de suivi', 'suivi', false);
  formulaire.appendChild(suivi.wrapper);
  const detailSuivi = champsTache({ titre: '', type: 'relance', echeance: ajouterJours(cleJour(new Date()), 3), estAdmin, responsables, profilId });
  detailSuivi.noeud.hidden = true;
  formulaire.appendChild(detailSuivi.noeud);
  suivi.input.addEventListener('change', () => {
    detailSuivi.noeud.hidden = !suivi.input.checked;
    if (suivi.input.checked && !detailSuivi.titre.input.value.trim() && objet.input.value.trim()) {
      detailSuivi.titre.input.value = `Suivi : ${objet.input.value.trim()}`;
    }
  });

  const erreurGenerale = el('p', 'cl-champ__erreur');
  erreurGenerale.setAttribute('role', 'alert');
  const actions = el('div', 'cl-form__actions');
  const envoyer = el('button', 'db-btn db-btn--primaire', 'Enregistrer l’échange');
  envoyer.type = 'submit';
  actions.append(envoyer, bouton('db-btn db-btn--discret', 'Annuler', null, onAnnuler));
  formulaire.append(erreurGenerale, actions);

  formulaire.addEventListener('submit', async (evenement) => {
    evenement.preventDefault();
    erreurGenerale.textContent = '';
    const saisie = {
      type: type.select.value,
      objet: objet.input.value,
      date_activite: date.input.value,
      demande_id: demande.select.value,
      description: description.zone.value,
    };
    const erreurs = validerActivite(saisie);
    type.erreur.textContent = erreurs.type ?? '';
    objet.erreur.textContent = erreurs.objet ?? '';
    date.erreur.textContent = erreurs.date_activite ?? '';
    if (erreurs.objet) return objet.input.focus();
    if (erreurs.date_activite) return date.input.focus();

    let tache = null;
    if (suivi.input.checked) {
      const saisieTache = { ...detailSuivi.lire(), demande_id: saisie.demande_id };
      const invalide = detailSuivi.afficherErreurs(validerTache(saisieTache));
      if (invalide) return invalide.focus();
      tache = preparerTache(saisieTache);
    }

    envoyer.disabled = true;
    try {
      const contactId = contact.select.value;
      if (tache) tache.contact_id = contactId || null;
      await onEnregistrer(preparerActivite({ ...saisie, contact_id: contactId }), tache);
    } catch (err) {
      erreurGenerale.textContent = err.message;
      envoyer.disabled = false;
    }
  });
  return formulaire;
}

function construireLigneHistorique(element, { peutSupprimer, onSupprimer, activite }) {
  const ligne = el('li', 'cl-historique__ligne');
  const pastille = el('span', 'cl-historique__icone');
  pastille.appendChild(icone(element.genre === 'activite' ? ICONES_ACTIVITE[element.type] || 'circle-dot' : 'flag'));
  const corps = el('div', 'cl-historique__corps');
  const tete = el('p', 'cl-historique__tete');
  tete.append(el('strong', null, element.titre), el('span', 'cl-historique__date texte-doux', formaterDateHeure(element.date)));
  corps.appendChild(tete);
  if (element.detail) corps.appendChild(el('p', 'cl-tache__description', element.detail));

  const meta = [];
  if (element.genre === 'activite') {
    meta.push(libelleTypeActivite(element.type));
    if (activite.contacts) meta.push(nomComplet(activite.contacts));
    const auteur = nomResponsable(activite.auteur_profil);
    if (auteur) meta.push(auteur);
  }
  if (meta.length > 0) corps.appendChild(el('p', 'cl-tache__meta texte-doux', meta.join(' · ')));
  if (element.reference) {
    const lien = el('a', 'cl-historique__lien', element.reference);
    lien.href = `#/demandes/${element.reference}`;
    corps.appendChild(lien);
  } else if (activite?.demandes?.reference) {
    const lien = el('a', 'cl-historique__lien', activite.demandes.reference);
    lien.href = `#/demandes/${activite.demandes.reference}`;
    corps.appendChild(lien);
  }

  ligne.append(pastille, corps);
  if (peutSupprimer) {
    const supprimer = el('button', 'db-btn db-btn--discret cl-historique__supprimer');
    supprimer.type = 'button';
    supprimer.setAttribute('aria-label', `Supprimer l’échange : ${element.titre}`);
    supprimer.appendChild(icone('trash-2'));
    supprimer.addEventListener('click', onSupprimer);
    ligne.appendChild(supprimer);
  }
  return ligne;
}

// jalons : étapes des demandes de ce client (déjà chargées par la fiche).
export function construireOngletActivite({ client, demandes, jalons, responsables, estAdmin, profilId }) {
  const conteneur = el('div', 'cl-contacts');
  let taches = [];
  let activites = [];
  let contacts = [];
  let formulaire = null; // null, 'echange' ou 'tache'

  const optionsContacts = () => contacts.filter((c) => c.actif).map((c) => ({ valeur: c.id, libelle: nomComplet(c) || c.email }));
  const optionsDemandes = () => demandes.map((d) => ({ valeur: d.id, libelle: d.reference }));

  async function recharger() {
    [taches, activites, contacts] = await Promise.all([listerTaches({ clientId: client.id }), listerActivites(client.id), listerContacts(client.id)]);
    rendre();
  }

  function agir(promesse, message) {
    return promesse
      .then(() => {
        if (message) afficherToast(message, { type: 'succes' });
        return recharger();
      })
      .catch((err) => afficherToast(err.message, { type: 'erreur' }));
  }

  function ouvrir(nom) {
    formulaire = nom;
    rendre();
  }

  function rendre() {
    conteneur.innerHTML = '';

    const entete = el('div', 'cl-entete');
    entete.appendChild(el('h2', 'db-titre', 'Activité'));
    const actionsEntete = el('div', 'cl-entete__actions');
    actionsEntete.append(
      bouton('db-btn db-btn--discret', 'Nouvelle tâche', 'list-checks', () => ouvrir('tache')),
      bouton('db-btn db-btn--primaire', 'Noter un échange', 'message-square-plus', () => ouvrir('echange'))
    );
    entete.appendChild(actionsEntete);
    conteneur.appendChild(entete);

    const parametres = { contacts: optionsContacts(), clientId: client.id, principalExiste: contacts.some((c) => c.principal), demandes: optionsDemandes(), responsables, estAdmin, profilId, onAnnuler: () => ouvrir(null) };
    if (formulaire === 'echange') {
      const carte = el('section', 'db-carte');
      carte.appendChild(
        construireFormulaireEchange({
          ...parametres,
          onEnregistrer: async (ligneActivite, ligneTache) => {
            await creerActivite(client.id, ligneActivite);
            if (ligneTache) {
              try {
                await creerTache(client.id, ligneTache);
              } catch (err) {
                afficherToast(`Échange enregistré, mais la tâche n’a pas pu être créée : ${err.message}`, { type: 'erreur', duree: 8000 });
                formulaire = null;
                return recharger();
              }
            }
            afficherToast(ligneTache ? 'Échange et tâche enregistrés.' : 'Échange enregistré.', { type: 'succes' });
            formulaire = null;
            await recharger();
          },
        })
      );
      conteneur.appendChild(carte);
    } else if (formulaire === 'tache') {
      const carte = el('section', 'db-carte');
      carte.appendChild(
        construireFormulaireTache({
          ...parametres,
          onEnregistrer: async (ligne) => {
            await creerTache(client.id, ligne);
            afficherToast('Tâche créée.', { type: 'succes' });
            formulaire = null;
            await recharger();
          },
        })
      );
      conteneur.appendChild(carte);
    }

    const carteTaches = el('section', 'db-carte');
    const titreTaches = el('h3', 'db-titre');
    titreTaches.append(icone('list-checks'), el('span', null, `Tâches ouvertes (${taches.filter(estOuverte).length})`));
    carteTaches.appendChild(titreTaches);
    const groupes = classerTaches(taches);
    const ordonnees = [...groupes.enRetard, ...groupes.aujourdhui, ...groupes.semaine, ...groupes.plusTard];
    if (ordonnees.length === 0) {
      carteTaches.appendChild(el('p', 'db-vide texte-doux', 'Aucune tâche ouverte.'));
    } else {
      const liste = el('ul', 'cl-taches');
      for (const t of ordonnees) {
        liste.appendChild(
          construireLigneTache(t, {
            estAdmin,
            profilId,
            onTerminer: () => agir(terminerTache(t.id), 'Tâche terminée.'),
            onReporter: (jours) => agir(reporterTache(t.id, echeanceApresReport(jours)), 'Échéance reportée.'),
            onSupprimer: () => window.confirm(`Supprimer la tâche « ${t.titre} » ?`) && agir(supprimerTache(t.id), 'Tâche supprimée.'),
          })
        );
      }
      carteTaches.appendChild(liste);
    }
    conteneur.appendChild(carteTaches);

    const carteHistorique = el('section', 'db-carte');
    const titreHistorique = el('h3', 'db-titre');
    titreHistorique.append(icone('history'), el('span', null, 'Historique'));
    carteHistorique.appendChild(titreHistorique);
    const historique = fusionnerHistorique(activites, jalons);
    if (historique.length === 0) {
      carteHistorique.appendChild(el('p', 'db-vide texte-doux', 'Aucun échange ni étape pour le moment.'));
    } else {
      const parId = new Map(activites.map((a) => [a.id, a]));
      const liste = el('ul', 'cl-historique');
      for (const element of historique) {
        const activite = parId.get(element.id);
        liste.appendChild(
          construireLigneHistorique(element, {
            activite,
            peutSupprimer: element.genre === 'activite' && (estAdmin || activite?.auteur === profilId),
            onSupprimer: () => window.confirm(`Supprimer l’échange « ${element.titre} » ?`) && agir(supprimerActivite(element.id), 'Échange supprimé.'),
          })
        );
      }
      carteHistorique.appendChild(liste);
    }
    conteneur.appendChild(carteHistorique);

    if (window.lucide) window.lucide.createIcons();
  }

  conteneur.appendChild(el('p', 'texte-doux', 'Chargement…'));
  recharger().catch((err) => {
    conteneur.innerHTML = '';
    conteneur.appendChild(el('p', 'cl-champ__erreur', err.message));
  });
  return conteneur;
}
