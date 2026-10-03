// Financements et références de factures (CRM, lot D). Fonctions pures, sans
// accès à la base. Tout est en HT (franchise de TVA).
//
// Les factures sont émises dans Shine : on ne garde que leur référence. Une
// facture est "payée" quand sa date de paiement est renseignée.

import { lireNombre } from './finance.js';

export const TYPES_FINANCEMENT = [
  { valeur: 'opco', libelle: 'OPCO' },
  { valeur: 'cpf', libelle: 'CPF' },
  { valeur: 'france_travail', libelle: 'France Travail' },
  { valeur: 'region', libelle: 'Région' },
  { valeur: 'entreprise', libelle: 'Entreprise' },
  { valeur: 'autre', libelle: 'Autre' },
];

export const STATUTS_FINANCEMENT = [
  { valeur: 'en_attente', libelle: 'En attente' },
  { valeur: 'accorde', libelle: 'Accordé' },
  { valeur: 'refuse', libelle: 'Refusé' },
  { valeur: 'verse', libelle: 'Versé' },
];

// Un financement compte dans le reste à charge dès qu'il est accordé.
const STATUTS_ACQUIS = new Set(['accorde', 'verse']);

const centimes = (v) => Math.round((Number(v) || 0) * 100) / 100;
const somme = (lignes, cle) => centimes(lignes.reduce((total, l) => total + centimes(l[cle]), 0));
const texte = (v) => {
  const t = String(v ?? '').trim();
  return t === '' ? null : t;
};
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function libelleTypeFinancement(valeur) {
  return TYPES_FINANCEMENT.find((t) => t.valeur === valeur)?.libelle ?? valeur ?? '';
}

export function libelleStatutFinancement(valeur) {
  return STATUTS_FINANCEMENT.find((s) => s.valeur === valeur)?.libelle ?? valeur ?? '';
}

// ─── Formulaires ────────────────────────────────────────────────────────────

// Formulaire "Financement" -> ligne de la table `financements` (sans demande_id).
export function preparerFinancement(valeurs) {
  const montant = lireNombre(valeurs.montant);
  return {
    type: valeurs.type,
    organisme: texte(valeurs.organisme),
    reference_dossier: texte(valeurs.reference_dossier),
    montant: montant == null || Number.isNaN(montant) ? null : centimes(montant),
    statut: valeurs.statut || 'en_attente',
    note: texte(valeurs.note),
  };
}

export function validerFinancement(valeurs) {
  const erreurs = {};
  if (!TYPES_FINANCEMENT.some((t) => t.valeur === valeurs.type)) erreurs.type = 'Choisissez un type de financement.';
  const montant = lireNombre(valeurs.montant);
  if (montant == null || Number.isNaN(montant) || montant < 0) erreurs.montant = 'Montant invalide : un nombre positif ou nul.';
  if (valeurs.statut && !STATUTS_FINANCEMENT.some((s) => s.valeur === valeurs.statut)) erreurs.statut = 'Statut inconnu.';
  return erreurs;
}

// Formulaire "Facture" -> ligne de la table `factures` (sans demande_id).
export function preparerFacture(valeurs) {
  const montant = lireNombre(valeurs.montant_ht);
  return {
    numero: texte(valeurs.numero),
    libelle: texte(valeurs.libelle),
    montant_ht: montant == null || Number.isNaN(montant) ? null : centimes(montant),
    date_emission: texte(valeurs.date_emission),
    date_paiement: texte(valeurs.date_paiement),
  };
}

export function validerFacture(valeurs) {
  const erreurs = {};
  const montant = lireNombre(valeurs.montant_ht);
  if (montant == null || Number.isNaN(montant) || montant < 0) erreurs.montant_ht = 'Montant invalide : un nombre positif ou nul.';
  const emission = texte(valeurs.date_emission);
  const paiement = texte(valeurs.date_paiement);
  if (!emission || !DATE_ISO.test(emission)) erreurs.date_emission = "Indiquez la date d'émission.";
  if (paiement && !DATE_ISO.test(paiement)) erreurs.date_paiement = 'Date de paiement invalide.';
  else if (paiement && emission && DATE_ISO.test(emission) && paiement < emission) {
    erreurs.date_paiement = "Le paiement ne peut pas précéder l'émission.";
  }
  return erreurs;
}

// ─── Calculs ────────────────────────────────────────────────────────────────

// montantRetenu : montant de la demande (v_demandes_montants.montant_retenu).
// finance : accordé ou versé ; enAttente : pas encore décidé ; refusé : ignoré
// du reste à charge. Le reste à charge ne devient jamais négatif.
export function syntheseFinancements(montantRetenu, financements = []) {
  const retenu = centimes(montantRetenu);
  const finance = somme(financements.filter((f) => STATUTS_ACQUIS.has(f.statut)), 'montant');
  const enAttente = somme(financements.filter((f) => f.statut === 'en_attente'), 'montant');
  const refuse = somme(financements.filter((f) => f.statut === 'refuse'), 'montant');
  return {
    montantRetenu: retenu,
    finance,
    enAttente,
    refuse,
    resteACharge: centimes(Math.max(0, retenu - finance)),
    surfinance: centimes(Math.max(0, finance - retenu)),
  };
}

export function estPayee(facture) {
  return Boolean(facture.date_paiement);
}

// facture : total des références saisies ; encaisse : celles qui ont une date
// de paiement ; aEncaisser : le reste. resteAFacturer : ce qui n'est pas encore
// couvert par une facture ; depassement : facturé au-delà du montant retenu.
export function syntheseFacturation(montantRetenu, factures = []) {
  const retenu = centimes(montantRetenu);
  const facture = somme(factures, 'montant_ht');
  const encaisse = somme(factures.filter(estPayee), 'montant_ht');
  return {
    montantRetenu: retenu,
    nombre: factures.length,
    facture,
    encaisse,
    aEncaisser: centimes(facture - encaisse),
    resteAFacturer: centimes(Math.max(0, retenu - facture)),
    depassement: centimes(Math.max(0, facture - retenu)),
  };
}

// Libellés proposés à la saisie d'une facture (le champ reste libre).
export const LIBELLES_FACTURE = ['Acompte 50 %', 'Solde', 'Facture unique'];

export { formaterDateCourte } from './dates.js';

// ─── Tableau de bord (admin) ────────────────────────────────────────────────

const anneeDe = (cle) => Number(String(cle ?? '').slice(0, 4));

// Indicateurs sur toutes les factures. Facturé : daté par l'émission ;
// encaissé : daté par le paiement ; à encaisser : toutes les factures non
// payées, quelle que soit leur date.
export function kpisFacturation(factures = [], maintenant = new Date()) {
  const annee = maintenant.getFullYear();
  const payees = factures.filter(estPayee);
  return {
    annee,
    factureAnnee: somme(factures.filter((f) => anneeDe(f.date_emission) === annee), 'montant_ht'),
    encaisseAnnee: somme(payees.filter((f) => anneeDe(f.date_paiement) === annee), 'montant_ht'),
    aEncaisser: somme(factures.filter((f) => !estPayee(f)), 'montant_ht'),
    nbAEncaisser: factures.filter((f) => !estPayee(f)).length,
  };
}

// Facturé et encaissé des `nbMois` derniers mois (le mois courant compris), du
// plus ancien au plus récent : [{ cle: '2026-10', libelle, facture, encaisse }].
export function facturationParMois(factures = [], maintenant = new Date(), nbMois = 12) {
  const mois = [];
  for (let i = nbMois - 1; i >= 0; i -= 1) {
    const d = new Date(maintenant.getFullYear(), maintenant.getMonth() - i, 1);
    mois.push({
      cle: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      libelle: d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
      facture: 0,
      encaisse: 0,
    });
  }
  const parCle = new Map(mois.map((m) => [m.cle, m]));
  for (const f of factures) {
    const emission = parCle.get(String(f.date_emission ?? '').slice(0, 7));
    if (emission) emission.facture = centimes(emission.facture + centimes(f.montant_ht));
    const paiement = estPayee(f) ? parCle.get(String(f.date_paiement).slice(0, 7)) : null;
    if (paiement) paiement.encaisse = centimes(paiement.encaisse + centimes(f.montant_ht));
  }
  return mois;
}

// Reste à facturer sur les demandes gagnées : pour chacune, montant retenu moins
// ce qui est déjà facturé (jamais négatif). montants : lignes de
// v_demandes_montants ; factures : lignes de la table `factures`.
export function resteAFacturerGagnees(montants = [], factures = []) {
  const factureParDemande = new Map();
  for (const f of factures) factureParDemande.set(f.demande_id, centimes((factureParDemande.get(f.demande_id) ?? 0) + centimes(f.montant_ht)));
  const gagnees = montants.filter((m) => m.statut === 'gagnee');
  const reste = gagnees.reduce((total, m) => total + Math.max(0, centimes(m.montant_retenu) - (factureParDemande.get(m.demande_id) ?? 0)), 0);
  return {
    montant: centimes(reste),
    nbDemandes: gagnees.filter((m) => centimes(m.montant_retenu) - (factureParDemande.get(m.demande_id) ?? 0) > 0).length,
  };
}
