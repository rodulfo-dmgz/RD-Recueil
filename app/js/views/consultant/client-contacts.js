// Onglet Contacts de la fiche client (CRM, lot A) : cartes, ajout et
// modification, contact principal, import des interlocuteurs d'une demande.
import {
  listerContacts,
  enregistrerContact,
  definirContactPrincipal,
  supprimerContact,
  importerContacts,
  emailsAvecCompte,
} from '../../services/clients.js';
import { afficherToast } from '../../components/toast.js';
import { el, icone } from '../../components/dashboard-ui.js';
import {
  ROLES_CONTACT,
  extraireFicheClient,
  libelleRole,
  nomComplet,
  planImportContacts,
  preparerContact,
  validerContact,
} from '../../engine/fiche-client.js';

function bouton(classe, texte, nomIcone, action) {
  const b = el('button', classe);
  b.type = 'button';
  if (nomIcone) b.appendChild(icone(nomIcone));
  b.appendChild(el('span', null, texte));
  b.addEventListener('click', action);
  return b;
}

function champ(libelle, nom, valeur, type = 'text') {
  const wrapper = el('label', 'cl-champ');
  wrapper.appendChild(el('span', 'cl-champ__libelle', libelle));
  const input = el('input', 'champ-saisie');
  input.type = type;
  input.name = nom;
  input.value = valeur ?? '';
  const erreur = el('span', 'cl-champ__erreur');
  erreur.setAttribute('role', 'alert');
  wrapper.append(input, erreur);
  return { wrapper, input, erreur };
}

function caseACocher(libelle, nom, cochee, valeur) {
  const wrapper = el('label', 'cl-case');
  const input = el('input');
  input.type = 'checkbox';
  input.name = nom;
  if (valeur != null) input.value = valeur;
  input.checked = Boolean(cochee);
  wrapper.append(input, el('span', null, libelle));
  return { wrapper, input };
}

function construireFormulaire(contact, { onEnregistrer, onAnnuler }) {
  const formulaire = el('form', 'cl-form cl-form--contact');
  formulaire.noValidate = true;

  const identite = el('fieldset', 'cl-form__groupe');
  identite.appendChild(el('legend', null, contact ? 'Modifier le contact' : 'Nouveau contact'));
  const prenom = champ('Prénom', 'prenom', contact?.prenom);
  const nom = champ('Nom *', 'nom', contact?.nom);
  const fonction = champ('Fonction', 'fonction', contact?.fonction);
  const email = champ('E-mail', 'email', contact?.email, 'email');
  const telephone = champ('Téléphone', 'telephone', contact?.telephone, 'tel');
  identite.append(prenom.wrapper, nom.wrapper, fonction.wrapper, email.wrapper, telephone.wrapper);
  formulaire.appendChild(identite);

  const roles = el('fieldset', 'cl-form__roles');
  roles.appendChild(el('legend', null, 'Rôles'));
  const casesRoles = ROLES_CONTACT.map((r) => caseACocher(r.libelle, 'roles', contact?.roles?.includes(r.valeur), r.valeur));
  casesRoles.forEach((c) => roles.appendChild(c.wrapper));
  formulaire.appendChild(roles);

  const options = el('div', 'cl-form__roles');
  const principal = caseACocher('Contact principal', 'principal', contact?.principal);
  const actif = caseACocher('Contact actif', 'actif', contact ? contact.actif : true);
  options.append(principal.wrapper, actif.wrapper);
  formulaire.appendChild(options);

  const notes = el('label', 'cl-champ cl-champ--pleine');
  notes.appendChild(el('span', 'cl-champ__libelle', 'Notes'));
  const zoneNotes = el('textarea', 'champ-saisie cl-notes');
  zoneNotes.rows = 3;
  zoneNotes.value = contact?.notes ?? '';
  notes.appendChild(zoneNotes);
  formulaire.appendChild(notes);

  const erreurGenerale = el('p', 'cl-champ__erreur');
  erreurGenerale.setAttribute('role', 'alert');
  const actions = el('div', 'cl-form__actions');
  const envoyer = el('button', 'db-btn db-btn--primaire', contact ? 'Enregistrer' : 'Ajouter le contact');
  envoyer.type = 'submit';
  const annuler = bouton('db-btn db-btn--discret', 'Annuler', null, onAnnuler);
  actions.append(envoyer, annuler);
  formulaire.append(erreurGenerale, actions);

  formulaire.addEventListener('submit', async (evenement) => {
    evenement.preventDefault();
    erreurGenerale.textContent = '';
    const saisie = {
      prenom: prenom.input.value,
      nom: nom.input.value,
      fonction: fonction.input.value,
      email: email.input.value,
      telephone: telephone.input.value,
      roles: casesRoles.filter((c) => c.input.checked).map((c) => c.input.value),
      principal: principal.input.checked,
      actif: actif.input.checked,
      notes: zoneNotes.value,
    };
    const erreurs = validerContact(saisie);
    nom.erreur.textContent = erreurs.nom ?? '';
    email.erreur.textContent = erreurs.email ?? '';
    if (erreurs.nom) return nom.input.focus();
    if (erreurs.email) return email.input.focus();
    envoyer.disabled = true;
    try {
      await onEnregistrer(preparerContact(saisie));
    } catch (err) {
      erreurGenerale.textContent = err.message;
      envoyer.disabled = false;
    }
  });
  return formulaire;
}

function construireCarte(contact, { avecCompte, onModifier, onPrincipal, onSupprimer }) {
  const carte = el('article', `db-carte cl-contact${contact.actif ? '' : ' cl-contact--inactif'}`);

  const tete = el('div', 'cl-contact__tete');
  tete.appendChild(el('h3', 'cl-contact__nom', nomComplet(contact) || contact.email));
  const badges = el('div', 'cl-contact__badges');
  if (contact.principal) badges.appendChild(el('span', 'cl-badge cl-badge--principal', 'Principal'));
  if (avecCompte) badges.appendChild(el('span', 'cl-badge cl-badge--compte', 'Compte actif'));
  if (!contact.actif) badges.appendChild(el('span', 'cl-badge', 'Inactif'));
  tete.appendChild(badges);
  carte.appendChild(tete);

  if (contact.fonction) carte.appendChild(el('p', 'cl-contact__fonction texte-doux', contact.fonction));

  const coordonnees = el('p', 'cl-contact__coordonnees');
  if (contact.email) {
    const lien = el('a', null, contact.email);
    lien.href = `mailto:${contact.email}`;
    coordonnees.appendChild(lien);
  }
  if (contact.telephone) {
    const lien = el('a', null, contact.telephone);
    lien.href = `tel:${contact.telephone.replace(/\s/g, '')}`;
    coordonnees.appendChild(lien);
  }
  if (coordonnees.children.length > 0) carte.appendChild(coordonnees);

  if (contact.roles?.length > 0) {
    const roles = el('ul', 'cl-contact__roles');
    for (const r of contact.roles) roles.appendChild(el('li', 'cl-role', libelleRole(r)));
    carte.appendChild(roles);
  }
  if (contact.notes) carte.appendChild(el('p', 'cl-notes-lecture texte-doux', contact.notes));

  const actions = el('div', 'cl-contact__actions');
  actions.appendChild(bouton('db-btn db-btn--discret', 'Modifier', 'pencil', onModifier));
  if (!contact.principal && contact.actif) actions.appendChild(bouton('db-btn db-btn--discret', 'Définir comme principal', 'star', onPrincipal));
  actions.appendChild(bouton('db-btn db-btn--discret', 'Supprimer', 'trash-2', onSupprimer));
  carte.appendChild(actions);
  return carte;
}

function construireImport(contacts, importation, onImporter) {
  if (!importation) return null;
  const extraction = extraireFicheClient(importation.reponses, importation.questions);
  const plan = planImportContacts(contacts, extraction.contacts);
  if (plan.aCreer.length === 0 && plan.aEnrichir.length === 0) return null;

  const bandeau = el('section', 'db-carte cl-import');
  const titre = el('h2', 'db-titre');
  titre.append(icone('download'), el('span', null, `La demande ${importation.demande.reference} cite des interlocuteurs`));
  bandeau.appendChild(titre);
  const liste = el('ul', 'cl-import__liste');
  for (const c of plan.aCreer) {
    const ligne = el('li');
    ligne.append(el('strong', null, `${c.nom} : `), `à créer (${c.roles.map(libelleRole).join(', ')})`);
    liste.appendChild(ligne);
  }
  for (const m of plan.aEnrichir) {
    const existant = contacts.find((c) => c.id === m.id);
    const ligne = el('li');
    ligne.append(el('strong', null, `${nomComplet(existant)} : `), 'à compléter (rôles ou coordonnées manquants)');
    liste.appendChild(ligne);
  }
  bandeau.appendChild(liste);
  bandeau.appendChild(bouton('db-btn db-btn--primaire', 'Importer les interlocuteurs', 'download', () => onImporter(plan)));
  return bandeau;
}

// `importation` : résultat de lireImportDisponible (ou null).
export function construireOngletContacts({ client, importation }) {
  const conteneur = el('div', 'cl-contacts');
  let contacts = [];
  let avecCompte = new Set();
  let formulaire = null; // null, 'nouveau' ou l'identifiant du contact en modification

  async function recharger() {
    contacts = await listerContacts(client.id);
    avecCompte = await emailsAvecCompte(contacts.map((c) => c.email)).catch(() => new Set());
    rendre();
  }

  function signaler(err) {
    afficherToast(err.message, { type: 'erreur' });
  }

  function rendre() {
    conteneur.innerHTML = '';

    const entete = el('div', 'cl-entete');
    entete.appendChild(el('h2', 'db-titre', `Contacts (${contacts.length})`));
    entete.appendChild(
      bouton('db-btn db-btn--primaire', 'Ajouter un contact', 'user-plus', () => {
        formulaire = 'nouveau';
        rendre();
      })
    );
    conteneur.appendChild(entete);

    const banniere = construireImport(contacts, importation, async (plan) => {
      try {
        await importerContacts(client.id, plan);
        afficherToast('Interlocuteurs importés.', { type: 'succes' });
        await recharger();
      } catch (err) {
        signaler(err);
      }
    });
    if (banniere) conteneur.appendChild(banniere);

    if (formulaire) {
      const modifie = formulaire === 'nouveau' ? null : contacts.find((c) => c.id === formulaire);
      const carte = el('section', 'db-carte');
      carte.appendChild(
        construireFormulaire(modifie, {
          onAnnuler: () => {
            formulaire = null;
            rendre();
          },
          onEnregistrer: async (ligne) => {
            await enregistrerContact(client.id, modifie?.id ?? null, ligne);
            afficherToast(modifie ? 'Contact enregistré.' : 'Contact ajouté.', { type: 'succes' });
            formulaire = null;
            await recharger();
          },
        })
      );
      conteneur.appendChild(carte);
    }

    if (contacts.length === 0 && !formulaire) {
      conteneur.appendChild(el('p', 'db-vide texte-doux', 'Aucun contact pour le moment.'));
    }
    const grille = el('div', 'cl-contacts__grille');
    for (const contact of contacts) {
      grille.appendChild(
        construireCarte(contact, {
          avecCompte: contact.email && avecCompte.has(contact.email.toLowerCase()),
          onModifier: () => {
            formulaire = contact.id;
            rendre();
          },
          onPrincipal: () => definirContactPrincipal(client.id, contact.id).then(recharger).catch(signaler),
          onSupprimer: () => {
            if (!window.confirm(`Supprimer le contact ${nomComplet(contact) || contact.email} ?`)) return;
            supprimerContact(contact.id).then(recharger).catch(signaler);
          },
        })
      );
    }
    conteneur.appendChild(grille);
    if (window.lucide) window.lucide.createIcons();
  }

  conteneur.appendChild(el('p', 'texte-doux', 'Chargement…'));
  recharger().catch((err) => {
    conteneur.innerHTML = '';
    conteneur.appendChild(el('p', 'cl-champ__erreur', err.message));
  });
  return conteneur;
}
