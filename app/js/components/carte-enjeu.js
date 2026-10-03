// Carte "Enjeu commercial" de la vue 360 (CRM, lot C) : montant retenu et sa
// source, probabilité, montant pondéré, avec l'estimation et la probabilité de
// la demande modifiables. Tout en HT (franchise de TVA). Réservé au staff ; la
// carte charge ses propres données et se redessine après chaque enregistrement.
import { obtenirMontantDemande, obtenirEnjeu, enregistrerEnjeu } from '../services/montants.js';
import { afficherToast } from './toast.js';
import { el, icone, mini } from './dashboard-ui.js';
import { champ } from './champs-crm.js';
import { STATUTS_FINAUX } from '../engine/statuts.js';
import { etapeCourante } from '../engine/suivi.js';
import { formaterMontant, libelleSourceMontant, preparerEnjeu, validerEnjeu } from '../engine/finance.js';

const AUTO = { decimales: 'auto' };

export function construireCarteEnjeu({ demande }) {
  const carte = el('section', 'db-carte');
  carte.appendChild(el('p', 'texte-doux', 'Chargement…'));
  let montant = null;
  let enjeu = null;

  async function charger() {
    [montant, enjeu] = await Promise.all([obtenirMontantDemande(demande.id), obtenirEnjeu(demande.id)]);
    rendre();
  }

  function rendre() {
    carte.innerHTML = '';
    const termine = STATUTS_FINAUX.has(demande.statut);
    const source = montant?.source_montant ?? 'aucun';

    const titre = el('h2', 'db-titre');
    titre.append(icone('euro'), el('span', null, 'Enjeu commercial (HT)'));
    carte.appendChild(titre);

    const minis = el('div', 'db-minis');
    minis.append(
      mini('Montant retenu', formaterMontant(montant?.montant_retenu, AUTO), libelleSourceMontant(source)),
      mini('Probabilité', `${montant?.probabilite ?? 0} %`, termine ? 'Fixée par le statut' : enjeu?.probabilite != null ? 'Saisie pour cette demande' : 'Par défaut du statut'),
      mini('Montant pondéré', formaterMontant(montant?.montant_pondere, AUTO))
    );
    carte.appendChild(minis);

    if (source === 'aucun' && !termine && etapeCourante(demande.statut) >= 1) {
      carte.appendChild(el('p', 'cl-champ__erreur', 'Aucun montant : saisissez une estimation ou chiffrez la proposition.'));
    }

    const formulaire = el('form', 'cl-form');
    formulaire.noValidate = true;
    const groupe = el('div', 'cl-form__groupe');
    const estime = champ('Montant estimé (€ HT)', 'montant_estime', enjeu?.montant_estime ?? '');
    estime.input.inputMode = 'decimal';
    const proba = champ('Probabilité (%)', 'probabilite', enjeu?.probabilite ?? '');
    proba.input.inputMode = 'numeric';
    proba.input.placeholder = 'Celle du statut';
    proba.input.disabled = termine;
    groupe.append(estime.wrapper, proba.wrapper);
    formulaire.appendChild(groupe);
    formulaire.appendChild(
      el(
        'p',
        'texte-doux',
        'L’estimation sert tant que la proposition n’est pas chiffrée. Laissez la probabilité vide pour utiliser celle du statut.'
      )
    );

    const erreurGenerale = el('p', 'cl-champ__erreur');
    erreurGenerale.setAttribute('role', 'alert');
    const actions = el('div', 'cl-form__actions');
    const envoyer = el('button', 'db-btn db-btn--primaire', 'Enregistrer');
    envoyer.type = 'submit';
    actions.appendChild(envoyer);
    formulaire.append(erreurGenerale, actions);

    formulaire.addEventListener('submit', async (evenement) => {
      evenement.preventDefault();
      erreurGenerale.textContent = '';
      const saisieFormulaire = { montant_estime: estime.input.value, probabilite: proba.input.value };
      const erreurs = validerEnjeu(saisieFormulaire);
      estime.erreur.textContent = erreurs.montant_estime ?? '';
      proba.erreur.textContent = erreurs.probabilite ?? '';
      if (erreurs.montant_estime) return estime.input.focus();
      if (erreurs.probabilite) return proba.input.focus();
      envoyer.disabled = true;
      try {
        await enregistrerEnjeu(demande.id, preparerEnjeu(saisieFormulaire));
        afficherToast('Enjeu enregistré.', { type: 'succes' });
        await charger();
      } catch (err) {
        erreurGenerale.textContent = err.message;
        envoyer.disabled = false;
      }
    });
    carte.appendChild(formulaire);
    if (window.lucide) window.lucide.createIcons();
  }

  charger().catch((err) => {
    carte.innerHTML = '';
    carte.appendChild(el('p', 'cl-champ__erreur', err.message));
  });
  return carte;
}
