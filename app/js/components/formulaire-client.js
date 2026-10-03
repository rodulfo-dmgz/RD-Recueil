// Formulaire de la fiche client (CRM, lot A) : création et modification.
// Les champs viennent de CHAMPS_FICHE (engine/fiche-client.js) ; le SIRET
// réutilise la saisie avec suggestions SIRENE du questionnaire.
import { el } from './dashboard-ui.js';
import { render as rendreChampSiret } from './fields/siret.js';
import { champSelect } from './champs-crm.js';
import { rechercherEntreprise } from '../services/entreprises.js';
import {
  CHAMPS_FICHE,
  SOURCES_CLIENT,
  STATUTS_CLIENT,
  estVide,
  ficheDepuisSirene,
  preparerFiche,
  validerFiche,
} from '../engine/fiche-client.js';

function champTexte(champ, valeur, erreurs) {
  const libelle = el('label', 'cl-champ');
  libelle.appendChild(el('span', 'cl-champ__libelle', champ.libelle + (champ.obligatoire ? ' *' : '')));
  const input = el('input', 'champ-saisie');
  input.type = champ.type || 'text';
  input.name = champ.cle;
  input.value = valeur ?? '';
  if (champ.obligatoire) input.required = true;
  if (champ.suggestions) {
    const liste = el('datalist');
    liste.id = `suggestions-${champ.cle}`;
    for (const s of champ.suggestions) liste.appendChild(Object.assign(document.createElement('option'), { value: s }));
    input.setAttribute('list', liste.id);
    libelle.appendChild(liste);
  }
  libelle.appendChild(input);
  const erreur = el('span', 'cl-champ__erreur');
  erreur.id = `erreur-${champ.cle}`;
  erreur.setAttribute('role', 'alert');
  erreurs[champ.cle] = { input, erreur };
  libelle.appendChild(erreur);
  return libelle;
}

// valeurs : fiche existante (ou {}), responsables : profils staff.
// onEnregistrer(ligne) reçoit la ligne prête pour la base et peut lancer une
// erreur, affichée sous le formulaire ; onAnnuler : retour sans enregistrer.
// avecResponsable : choix du responsable du client, réservé à l'admin (lot Accès).
export function construireFormulaireClient({ valeurs = {}, responsables = [], avecResponsable = false, onEnregistrer, onAnnuler, libelleBouton = 'Enregistrer' }) {
  const formulaire = el('form', 'cl-form');
  formulaire.noValidate = true;
  const champs = {};
  const groupes = {};

  for (const champ of CHAMPS_FICHE) {
    const groupe = (groupes[champ.groupe] ??= el('fieldset', 'cl-form__groupe'));
    if (groupe.children.length === 0) groupe.appendChild(el('legend', null, champ.groupe));
    if (champ.cle === 'siret') {
      const wrapper = el('div', 'cl-champ');
      wrapper.appendChild(el('span', 'cl-champ__libelle', champ.libelle));
      let siretSaisi = valeurs.siret ?? '';
      wrapper.appendChild(
        rendreChampSiret(null, siretSaisi, {
          onChange: (v) => {
            siretSaisi = v;
          },
          lectureSeule: false,
          onAutoRemplir: async (siret, statut, donneesPreChargees) => {
            const donnees = donneesPreChargees || (await rechercherEntreprise(siret));
            if (!donnees) {
              statut.textContent = 'Aucun établissement trouvé pour ce SIRET.';
              return;
            }
            const propose = ficheDepuisSirene(donnees);
            const remplis = [];
            for (const [cle, valeur] of Object.entries(propose)) {
              if (estVide(champs[cle]?.input.value)) {
                champs[cle].input.value = valeur;
                remplis.push(cle);
              }
            }
            statut.textContent = remplis.length > 0 ? `${remplis.length} champ(s) pré-rempli(s) depuis la base SIRENE.` : 'Rien à pré-remplir : les champs sont déjà renseignés.';
          },
        })
      );
      const erreur = el('span', 'cl-champ__erreur');
      erreur.setAttribute('role', 'alert');
      wrapper.appendChild(erreur);
      champs.siret = {
        input: {
          get value() {
            return siretSaisi;
          },
          focus: () => wrapper.querySelector('input')?.focus(),
        },
        erreur,
      };
      groupe.appendChild(wrapper);
      continue;
    }
    groupe.appendChild(champTexte(champ, valeurs[champ.cle], champs));
  }
  Object.values(groupes).forEach((g) => formulaire.appendChild(g));

  const suivi = el('fieldset', 'cl-form__groupe');
  suivi.appendChild(el('legend', null, 'Suivi'));
  const statut = champSelect('statut', 'Statut', STATUTS_CLIENT, valeurs.statut ?? 'client');
  const source = champSelect('source', 'Source', SOURCES_CLIENT, valeurs.source, 'Non renseignée');
  const responsable = champSelect(
    'responsable_id',
    'Responsable',
    responsables.map((r) => ({ valeur: r.user_id, libelle: r.nom || r.email })),
    valeurs.responsable_id,
    'Non attribué'
  );
  suivi.append(statut.wrapper, source.wrapper);
  if (avecResponsable) suivi.appendChild(responsable.wrapper);
  formulaire.appendChild(suivi);

  const notes = el('label', 'cl-champ cl-champ--pleine');
  notes.appendChild(el('span', 'cl-champ__libelle', 'Notes internes (jamais visibles du client)'));
  const zoneNotes = el('textarea', 'champ-saisie cl-notes');
  zoneNotes.name = 'notes';
  zoneNotes.rows = 4;
  zoneNotes.value = valeurs.notes ?? '';
  notes.appendChild(zoneNotes);
  formulaire.appendChild(notes);

  const erreurGenerale = el('p', 'cl-champ__erreur');
  erreurGenerale.setAttribute('role', 'alert');
  const actions = el('div', 'cl-form__actions');
  const envoyer = el('button', 'db-btn db-btn--primaire', libelleBouton);
  envoyer.type = 'submit';
  actions.appendChild(envoyer);
  if (onAnnuler) {
    const annuler = el('button', 'db-btn db-btn--discret', 'Annuler');
    annuler.type = 'button';
    annuler.addEventListener('click', onAnnuler);
    actions.appendChild(annuler);
  }
  formulaire.append(erreurGenerale, actions);

  formulaire.addEventListener('submit', async (evenement) => {
    evenement.preventDefault();
    erreurGenerale.textContent = '';
    const saisie = { statut: statut.select.value, source: source.select.value, notes: zoneNotes.value };
    if (avecResponsable) saisie.responsable_id = responsable.select.value;
    for (const [cle, { input }] of Object.entries(champs)) saisie[cle] = input.value;

    const erreurs = validerFiche(saisie);
    for (const [cle, { erreur }] of Object.entries(champs)) erreur.textContent = erreurs[cle] ?? '';
    const premiere = Object.keys(erreurs)[0];
    if (premiere) {
      champs[premiere].input.focus();
      return;
    }
    envoyer.disabled = true;
    try {
      await onEnregistrer(preparerFiche(saisie));
    } catch (err) {
      erreurGenerale.textContent = err.message;
      envoyer.disabled = false;
    }
  });
  return formulaire;
}
