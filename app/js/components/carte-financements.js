// Carte "Financements" de la vue 360 (CRM, lot D) : financements de la demande
// (OPCO, région...), montant financé, en attente et reste à charge du client.
// Tout en HT. La carte charge ses propres données et se redessine après chaque
// changement ; le reste à charge part du montant retenu de la demande.
import { listerFinancements, enregistrerFinancement, supprimerFinancement } from '../services/financements.js';
import { obtenirMontantDemande } from '../services/montants.js';
import { afficherToast } from './toast.js';
import { el, icone, mini } from './dashboard-ui.js';
import { bouton, champ, champSelect, zoneTexte } from './champs-crm.js';
import { ouvrirModaleCrm } from './modale-crm.js';
import { formaterMontant } from '../engine/finance.js';
import {
  STATUTS_FINANCEMENT,
  TYPES_FINANCEMENT,
  libelleStatutFinancement,
  libelleTypeFinancement,
  preparerFinancement,
  syntheseFinancements,
  validerFinancement,
} from '../engine/facturation.js';

const AUTO = { decimales: 'auto' };

function ouvrirModaleFinancement({ financement, onEnregistre, demandeId }) {
  const type = champSelect('type', 'Type *', TYPES_FINANCEMENT, financement?.type ?? 'opco');
  const organisme = champ('Organisme', 'organisme', financement?.organisme);
  const dossier = champ('Référence du dossier', 'reference_dossier', financement?.reference_dossier);
  const montant = champ('Montant (€ HT) *', 'montant', financement?.montant ?? '');
  montant.input.inputMode = 'decimal';
  const statut = champSelect('statut', 'Statut', STATUTS_FINANCEMENT, financement?.statut ?? 'en_attente');
  const note = zoneTexte('Note', 'note', financement?.note, 2);
  const groupe = el('div', 'cl-form__groupe');
  groupe.append(type.wrapper, organisme.wrapper, dossier.wrapper, montant.wrapper, statut.wrapper);

  ouvrirModaleCrm({
    titre: financement ? 'Modifier le financement' : 'Nouveau financement',
    noeuds: [groupe, note.wrapper],
    libelleEnvoi: financement ? 'Enregistrer' : 'Ajouter le financement',
    onEnvoi: async () => {
      const saisie = {
        type: type.select.value,
        organisme: organisme.input.value,
        reference_dossier: dossier.input.value,
        montant: montant.input.value,
        statut: statut.select.value,
        note: note.zone.value,
      };
      const erreurs = validerFinancement(saisie);
      type.erreur.textContent = erreurs.type ?? '';
      montant.erreur.textContent = erreurs.montant ?? '';
      statut.erreur.textContent = erreurs.statut ?? '';
      const invalide = [
        [erreurs.type, type.select],
        [erreurs.montant, montant.input],
        [erreurs.statut, statut.select],
      ].find(([message]) => message);
      if (invalide) {
        invalide[1].focus();
        return false;
      }
      await enregistrerFinancement(demandeId, financement?.id ?? null, preparerFinancement(saisie));
      afficherToast(financement ? 'Financement modifié.' : 'Financement ajouté.', { type: 'succes' });
      onEnregistre();
    },
  });
}

export function construireCarteFinancements({ demande }) {
  const carte = el('section', 'db-carte');
  carte.appendChild(el('p', 'texte-doux', 'Chargement…'));
  let montant = null;
  let financements = [];

  async function charger() {
    [montant, financements] = await Promise.all([obtenirMontantDemande(demande.id), listerFinancements(demande.id)]);
    rendre();
  }

  function recharger() {
    charger().catch((err) => afficherToast(err.message, { type: 'erreur' }));
  }

  function ligne(f) {
    const li = el('li', 'fi-ligne');
    const corps = el('div', 'fi-ligne__corps');
    corps.appendChild(el('strong', null, [libelleTypeFinancement(f.type), f.organisme].filter(Boolean).join(' · ')));
    const meta = [f.reference_dossier ? `Dossier ${f.reference_dossier}` : null, f.note].filter(Boolean).join(' · ');
    if (meta) corps.appendChild(el('p', 'fi-ligne__meta texte-doux', meta));
    const actions = el('div', 'fi-ligne__actions');
    const modifier = bouton('db-btn db-btn--discret', 'Modifier', 'pencil', () =>
      ouvrirModaleFinancement({ financement: f, demandeId: demande.id, onEnregistre: recharger })
    );
    modifier.setAttribute('aria-label', `Modifier le financement ${libelleTypeFinancement(f.type)}`);
    const supprimer = bouton('db-btn db-btn--discret', 'Supprimer', 'trash-2', async () => {
      if (!window.confirm(`Supprimer le financement ${libelleTypeFinancement(f.type)} de ${formaterMontant(f.montant, AUTO)} ?`)) return;
      try {
        await supprimerFinancement(f.id);
        afficherToast('Financement supprimé.', { type: 'succes' });
        recharger();
      } catch (err) {
        afficherToast(err.message, { type: 'erreur' });
      }
    });
    supprimer.setAttribute('aria-label', `Supprimer le financement ${libelleTypeFinancement(f.type)}`);
    actions.append(modifier, supprimer);
    li.append(corps, el('span', `cl-badge fi-statut fi-statut--${f.statut}`, libelleStatutFinancement(f.statut)), el('span', 'fi-ligne__montant', formaterMontant(f.montant, AUTO)), actions);
    return li;
  }

  function rendre() {
    carte.innerHTML = '';
    const synthese = syntheseFinancements(montant?.montant_retenu, financements);

    const titre = el('h2', 'db-titre');
    titre.append(icone('landmark'), el('span', null, 'Financements (HT)'));
    carte.appendChild(titre);

    const minis = el('div', 'db-minis');
    minis.append(
      mini('Financé', formaterMontant(synthese.finance, AUTO), 'Accordé ou versé'),
      mini('En attente', formaterMontant(synthese.enAttente, AUTO), 'Pas encore décidé'),
      mini('Reste à charge', formaterMontant(synthese.resteACharge, AUTO), `Sur ${formaterMontant(synthese.montantRetenu, AUTO)} retenus`)
    );
    carte.appendChild(minis);
    if (synthese.surfinance > 0) {
      carte.appendChild(el('p', 'cl-champ__erreur', `Les financements dépassent le montant retenu de ${formaterMontant(synthese.surfinance, AUTO)}.`));
    }

    if (financements.length === 0) {
      carte.appendChild(el('p', 'texte-doux', 'Aucun financement saisi : le client règle la totalité.'));
    } else {
      const liste = el('ul', 'fi-liste');
      financements.forEach((f) => liste.appendChild(ligne(f)));
      carte.appendChild(liste);
    }

    carte.appendChild(
      bouton('db-btn db-btn--discret db-btn--lien', 'Ajouter un financement', 'plus', () =>
        ouvrirModaleFinancement({ demandeId: demande.id, onEnregistre: recharger })
      )
    );
    if (window.lucide) window.lucide.createIcons();
  }

  charger().catch((err) => {
    carte.innerHTML = '';
    carte.appendChild(el('p', 'cl-champ__erreur', err.message));
  });
  return carte;
}
