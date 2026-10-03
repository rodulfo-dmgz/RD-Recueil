// Carte "Facturation" de la vue 360 (CRM, lot D), réservée à l'admin : références
// des factures de la demande (numéro, libellé, montant HT, dates), facturé,
// encaissé et reste à facturer. Les factures sont émises dans Shine ; ici on ne
// garde que leur référence. La carte charge ses données et se redessine après
// chaque changement.
import { listerFactures, enregistrerFacture, supprimerFacture } from '../services/factures.js';
import { obtenirMontantDemande } from '../services/montants.js';
import { afficherToast } from './toast.js';
import { el, icone } from './dashboard-ui.js';
import { bouton, champ } from './champs-crm.js';
import { ouvrirModaleCrm } from './modale-crm.js';
import { cleJour } from '../engine/jalons.js';
import { formaterMontant } from '../engine/finance.js';
import { LIBELLES_FACTURE, estPayee, formaterDateCourte, preparerFacture, syntheseFacturation, validerFacture } from '../engine/facturation.js';

const AUTO = { decimales: 'auto' };

function mini(libelle, valeur, detail) {
  const bloc = el('div', 'db-mini');
  bloc.append(el('span', 'db-mini__valeur', valeur), el('span', 'db-mini__libelle', libelle));
  if (detail) bloc.appendChild(el('span', 'db-mini__detail texte-doux', detail));
  return bloc;
}

function nomFacture(f) {
  return f.numero ? `n° ${f.numero}` : f.libelle || 'sans numéro';
}

function ouvrirModaleFacture({ facture, demandeId, onEnregistre }) {
  const numero = champ('Numéro de facture', 'numero', facture?.numero);
  const libelle = champ('Libellé', 'libelle', facture?.libelle);
  const suggestions = el('datalist');
  suggestions.id = 'libelles-facture';
  LIBELLES_FACTURE.forEach((l) => suggestions.appendChild(Object.assign(document.createElement('option'), { value: l })));
  libelle.input.setAttribute('list', suggestions.id);
  const montant = champ('Montant (€ HT) *', 'montant_ht', facture?.montant_ht ?? '');
  montant.input.inputMode = 'decimal';
  const emission = champ('Date d’émission *', 'date_emission', facture?.date_emission ?? cleJour(new Date()), 'date');
  const paiement = champ('Date de paiement', 'date_paiement', facture?.date_paiement, 'date');
  const groupe = el('div', 'cl-form__groupe');
  groupe.append(numero.wrapper, libelle.wrapper, montant.wrapper, emission.wrapper, paiement.wrapper, suggestions);

  ouvrirModaleCrm({
    titre: facture ? 'Modifier la facture' : 'Nouvelle facture',
    noeuds: [groupe, el('p', 'texte-doux', 'Laissez la date de paiement vide tant que la facture n’est pas réglée.')],
    libelleEnvoi: facture ? 'Enregistrer' : 'Ajouter la facture',
    onEnvoi: async () => {
      const saisie = {
        numero: numero.input.value,
        libelle: libelle.input.value,
        montant_ht: montant.input.value,
        date_emission: emission.input.value,
        date_paiement: paiement.input.value,
      };
      const erreurs = validerFacture(saisie);
      montant.erreur.textContent = erreurs.montant_ht ?? '';
      emission.erreur.textContent = erreurs.date_emission ?? '';
      paiement.erreur.textContent = erreurs.date_paiement ?? '';
      const invalide = [
        [erreurs.montant_ht, montant.input],
        [erreurs.date_emission, emission.input],
        [erreurs.date_paiement, paiement.input],
      ].find(([message]) => message);
      if (invalide) {
        invalide[1].focus();
        return false;
      }
      await enregistrerFacture(demandeId, facture?.id ?? null, preparerFacture(saisie));
      afficherToast(facture ? 'Facture modifiée.' : 'Facture ajoutée.', { type: 'succes' });
      onEnregistre();
    },
  });
}

export function construireCarteFacturation({ demande }) {
  const carte = el('section', 'db-carte');
  carte.appendChild(el('p', 'texte-doux', 'Chargement…'));
  let montant = null;
  let factures = [];

  async function charger() {
    [montant, factures] = await Promise.all([obtenirMontantDemande(demande.id), listerFactures(demande.id)]);
    rendre();
  }

  function recharger() {
    charger().catch((err) => afficherToast(err.message, { type: 'erreur' }));
  }

  async function marquerPayee(f) {
    try {
      await enregistrerFacture(demande.id, f.id, { date_paiement: cleJour(new Date()) });
      afficherToast('Facture marquée comme payée aujourd’hui.', { type: 'succes' });
      recharger();
    } catch (err) {
      afficherToast(err.message, { type: 'erreur' });
    }
  }

  function ligne(f) {
    const li = el('li', 'fi-ligne');
    const corps = el('div', 'fi-ligne__corps');
    corps.appendChild(el('strong', null, [f.libelle, f.numero ? `n° ${f.numero}` : null].filter(Boolean).join(' · ') || 'Facture sans numéro'));
    corps.appendChild(el('p', 'fi-ligne__meta texte-doux', `Émise le ${formaterDateCourte(f.date_emission)}${f.source === 'import' ? ' · importée' : ''}`));

    const payee = estPayee(f);
    const statut = el('span', `cl-badge fi-statut ${payee ? 'fi-statut--verse' : ''}`, payee ? `Payée le ${formaterDateCourte(f.date_paiement)}` : 'À encaisser');

    const actions = el('div', 'fi-ligne__actions');
    if (!payee) {
      const payer = bouton('db-btn db-btn--discret', 'Payée', 'check', () => marquerPayee(f));
      payer.setAttribute('aria-label', `Marquer la facture ${nomFacture(f)} comme payée aujourd’hui`);
      actions.appendChild(payer);
    }
    const modifier = bouton('db-btn db-btn--discret', 'Modifier', 'pencil', () => ouvrirModaleFacture({ facture: f, demandeId: demande.id, onEnregistre: recharger }));
    modifier.setAttribute('aria-label', `Modifier la facture ${nomFacture(f)}`);
    const supprimer = bouton('db-btn db-btn--discret', 'Supprimer', 'trash-2', async () => {
      if (!window.confirm(`Supprimer la référence de la facture ${nomFacture(f)} (${formaterMontant(f.montant_ht, AUTO)}) ? La facture reste dans Shine.`)) return;
      try {
        await supprimerFacture(f.id);
        afficherToast('Facture supprimée.', { type: 'succes' });
        recharger();
      } catch (err) {
        afficherToast(err.message, { type: 'erreur' });
      }
    });
    supprimer.setAttribute('aria-label', `Supprimer la facture ${nomFacture(f)}`);
    actions.append(modifier, supprimer);

    li.append(corps, statut, el('span', 'fi-ligne__montant', formaterMontant(f.montant_ht, AUTO)), actions);
    return li;
  }

  function rendre() {
    carte.innerHTML = '';
    const synthese = syntheseFacturation(montant?.montant_retenu, factures);

    const titre = el('h2', 'db-titre');
    titre.append(icone('receipt'), el('span', null, 'Facturation (HT)'));
    carte.appendChild(titre);

    const minis = el('div', 'db-minis');
    minis.append(
      mini('Facturé', formaterMontant(synthese.facture, AUTO), `${synthese.nombre} facture${synthese.nombre > 1 ? 's' : ''}`),
      mini('Encaissé', formaterMontant(synthese.encaisse, AUTO), `${formaterMontant(synthese.aEncaisser, AUTO)} à encaisser`),
      mini('Reste à facturer', formaterMontant(synthese.resteAFacturer, AUTO), `Sur ${formaterMontant(synthese.montantRetenu, AUTO)} retenus`)
    );
    carte.appendChild(minis);
    if (synthese.depassement > 0) {
      carte.appendChild(
        el('p', 'cl-champ__erreur', `Le facturé dépasse le montant retenu de ${formaterMontant(synthese.depassement, AUTO)} : vérifiez le montant de la demande.`)
      );
    }

    if (factures.length === 0) {
      carte.appendChild(el('p', 'texte-doux', 'Aucune facture saisie pour cette demande.'));
    } else {
      const liste = el('ul', 'fi-liste');
      factures.forEach((f) => liste.appendChild(ligne(f)));
      carte.appendChild(liste);
    }

    carte.appendChild(
      bouton('db-btn db-btn--discret db-btn--lien', 'Ajouter une facture', 'plus', () => ouvrirModaleFacture({ demandeId: demande.id, onEnregistre: recharger }))
    );
    if (window.lucide) window.lucide.createIcons();
  }

  charger().catch((err) => {
    carte.innerHTML = '';
    carte.appendChild(el('p', 'cl-champ__erreur', err.message));
  });
  return carte;
}
