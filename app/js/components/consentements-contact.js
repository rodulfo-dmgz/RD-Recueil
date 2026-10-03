// Bloc "Consentements" d'une carte de contact (CRM, lot F) : un consentement par
// type (e-mail commercial, téléphone, lettre d'information) avec son état et un
// bouton pour le renseigner ou le modifier dans une fenêtre.
import { enregistrerConsentement } from '../services/consentements.js';
import { afficherToast } from './toast.js';
import { el } from './dashboard-ui.js';
import { bouton, champ, champSelect, zoneTexte } from './champs-crm.js';
import { ouvrirModaleCrm } from './modale-crm.js';
import { cleJour } from '../engine/jalons.js';
import { formaterDateCourte as formaterDate } from '../engine/dates.js';
import {
  SOURCES_CONSENTEMENT,
  STATUTS_CONSENTEMENT,
  TYPES_CONSENTEMENT,
  etatConsentement,
  libelleEtatConsentement,
  libelleTypeConsentement,
  preparerConsentement,
  validerConsentement,
} from '../engine/consentements.js';

function detailEtat(c, etat) {
  if (!c) return '';
  if (etat === 'retire') return ` le ${formaterDate(c.date_retrait)}`;
  if (etat === 'expire') return ` depuis le ${formaterDate(c.date_expiration)}`;
  const morceaux = [`le ${formaterDate(c.date_consentement)}`];
  if (c.source) morceaux.push(c.source);
  if (c.date_expiration) morceaux.push(`jusqu’au ${formaterDate(c.date_expiration)}`);
  return ` ${morceaux.join(' · ')}`;
}

function ouvrirModale({ contact, type, existant, onEnregistre }) {
  const statut = champSelect('statut', 'Statut *', STATUTS_CONSENTEMENT, existant?.statut ?? 'accorde');
  const date = champ('Date *', 'date_consentement', existant?.date_consentement ?? cleJour(new Date()), 'date');
  const source = champ('Comment il a été obtenu *', 'source', existant?.source);
  const suggestions = el('datalist');
  suggestions.id = 'sources-consentement';
  SOURCES_CONSENTEMENT.forEach((s) => suggestions.appendChild(Object.assign(document.createElement('option'), { value: s })));
  source.input.setAttribute('list', suggestions.id);
  const expiration = champ('Expire le', 'date_expiration', existant?.date_expiration, 'date');
  const preuve = zoneTexte('Preuve', 'preuve', existant?.preuve, 3);
  const groupe = el('div', 'cl-form__groupe');
  groupe.append(statut.wrapper, date.wrapper, source.wrapper, expiration.wrapper, suggestions);

  ouvrirModaleCrm({
    titre: `Consentement : ${libelleTypeConsentement(type)}`,
    noeuds: [
      el('p', 'texte-doux', 'Contact : ' + ([contact.prenom, contact.nom].filter(Boolean).join(' ') || contact.email)),
      groupe,
      preuve.wrapper,
      el('p', 'texte-doux', 'La preuve est un texte libre (par exemple « case cochée sur le formulaire du 3 octobre », référence d’un e-mail). La source n’est exigée que pour un consentement accordé.'),
    ],
    libelleEnvoi: 'Enregistrer',
    onEnvoi: async () => {
      const saisie = {
        statut: statut.select.value,
        date_consentement: date.input.value,
        source: source.input.value,
        preuve: preuve.zone.value,
        date_expiration: expiration.input.value,
      };
      const erreurs = validerConsentement(saisie);
      statut.erreur.textContent = erreurs.statut ?? '';
      date.erreur.textContent = erreurs.date_consentement ?? '';
      source.erreur.textContent = erreurs.source ?? '';
      expiration.erreur.textContent = erreurs.date_expiration ?? '';
      const invalide = [
        [erreurs.statut, statut.select],
        [erreurs.date_consentement, date.input],
        [erreurs.source, source.input],
        [erreurs.date_expiration, expiration.input],
      ].find(([message]) => message);
      if (invalide) {
        invalide[1].focus();
        return false;
      }
      await enregistrerConsentement(contact.id, type, preparerConsentement(saisie));
      afficherToast('Consentement enregistré.', { type: 'succes' });
      onEnregistre();
    },
  });
}

// consentements : ceux du contact (lignes de la table) ; onChange : rechargement.
export function construireBlocConsentements({ contact, consentements = [], onChange }) {
  const bloc = el('div', 'cs-bloc');
  bloc.appendChild(el('p', 'cs-bloc__titre', 'Consentements'));
  const liste = el('ul', 'cs-liste');
  for (const { valeur: type, libelle } of TYPES_CONSENTEMENT) {
    const existant = consentements.find((c) => c.type === type);
    const etat = etatConsentement(existant);
    const ligne = el('li', 'cs-ligne');
    const texte = el('span', 'cs-ligne__texte');
    texte.append(el('strong', null, libelle), el('span', `cl-badge cs-etat cs-etat--${etat}`, libelleEtatConsentement(etat)));
    const detail = detailEtat(existant, etat);
    if (detail) texte.appendChild(el('small', 'texte-doux', detail.trim()));
    ligne.appendChild(texte);
    const action = bouton('db-btn db-btn--discret', existant ? 'Modifier' : 'Renseigner', existant ? 'pencil' : 'plus', () =>
      ouvrirModale({ contact, type, existant, onEnregistre: onChange })
    );
    action.setAttribute('aria-label', `${existant ? 'Modifier' : 'Renseigner'} le consentement ${libelle.toLowerCase()} de ${[contact.prenom, contact.nom].filter(Boolean).join(' ') || contact.email}`);
    ligne.appendChild(action);
    liste.appendChild(ligne);
  }
  bloc.appendChild(liste);
  return bloc;
}
