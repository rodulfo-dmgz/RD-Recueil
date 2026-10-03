// Montants et pipeline en euros (CRM, lot C). Fonctions pures, sans DOM ni
// Supabase, qui travaillent sur les lignes de la vue v_demandes_montants :
// { demande_id, reference, client_id, statut, archivee, created_at,
//   montant_estime, montant_propose, montant_retenu, source_montant,
//   probabilite, montant_pondere, date_decision }.
// Tout est en HT : RD Formation est en franchise de TVA (art. 293 B du CGI).
import { ETAPES_SUIVI, etapeCourante } from './suivi.js';
import { STATUTS_FINAUX } from './statuts.js';

const nombre = (v) => Number(v) || 0;
const estOuverte = (m) => !STATUTS_FINAUX.has(m.statut) && !m.archivee;

// 4800 -> "4 800 €". decimales : 0 par défaut (indicateurs), 2 pour un devis, ou
// 'auto' (deux décimales seulement si le montant n'est pas un entier).
export function formaterMontant(valeur, { decimales = 0 } = {}) {
  if (valeur == null || Number.isNaN(Number(valeur))) return '-';
  const n = Number(valeur);
  const d = decimales === 'auto' ? (Number.isInteger(n) ? 0 : 2) : decimales;
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
}

const LIBELLES_SOURCE = { proposition: 'Total de la proposition', estimation: 'Estimation', aucun: 'Aucun montant' };

export function libelleSourceMontant(source) {
  return LIBELLES_SOURCE[source] ?? source;
}

// Pipeline des demandes en cours (non archivées, non terminées), réparti selon
// les étapes de suivi : nombre, montant retenu, montant pondéré et nombre de
// demandes sans aucun montant. L'étape "Décision" n'en fait pas partie.
export function agregerPipeline(montants) {
  const etapes = ETAPES_SUIVI.slice(0, -1).map((e) => ({ id: e.id, libelle: e.libelle, nb: 0, montant: 0, pondere: 0, sansMontant: 0 }));
  const total = { nb: 0, montant: 0, pondere: 0, sansMontant: 0 };
  for (const m of montants || []) {
    if (!estOuverte(m)) continue;
    const etape = etapes[etapeCourante(m.statut)];
    if (!etape) continue;
    for (const cible of [etape, total]) {
      cible.nb += 1;
      cible.montant += nombre(m.montant_retenu);
      cible.pondere += nombre(m.montant_pondere);
      if (m.source_montant === 'aucun') cible.sansMontant += 1;
    }
  }
  return { etapes, total };
}

// Demandes en cours qui devraient déjà avoir un montant (l'entretien a eu lieu
// ou est demandé) : sans proposition chiffrée ni estimation.
export function demandesSansMontant(montants) {
  return (montants || []).filter((m) => estOuverte(m) && m.source_montant === 'aucun' && etapeCourante(m.statut) >= 1);
}

function dateDeSigne(m) {
  return new Date(m.date_decision ?? m.created_at);
}

// CA signé (demandes gagnées) d'une année civile, daté par la décision du client.
export function caSigneAnnee(montants, annee) {
  return (montants || []).filter((m) => m.statut === 'gagnee' && dateDeSigne(m).getFullYear() === annee).reduce((somme, m) => somme + nombre(m.montant_retenu), 0);
}

// CA signé des `nbMois` derniers mois (le mois courant compris), du plus ancien
// au plus récent : [{ cle: '2026-10', libelle: 'oct. 2026', montant, nb }].
export function caSigneParMois(montants, maintenant = new Date(), nbMois = 12) {
  const mois = [];
  for (let i = nbMois - 1; i >= 0; i -= 1) {
    const d = new Date(maintenant.getFullYear(), maintenant.getMonth() - i, 1);
    mois.push({
      cle: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      libelle: d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
      montant: 0,
      nb: 0,
    });
  }
  const parCle = new Map(mois.map((m) => [m.cle, m]));
  for (const m of montants || []) {
    if (m.statut !== 'gagnee') continue;
    const d = dateDeSigne(m);
    const cible = parCle.get(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    if (!cible) continue;
    cible.montant += nombre(m.montant_retenu);
    cible.nb += 1;
  }
  return mois;
}

// Indicateurs du tableau de bord : pipeline, pondéré, CA signé (année en cours
// et total), montant moyen d'une demande gagnée, conversion en euros
// (gagné / (gagné + perdu)) et demandes sans montant.
export function kpisFinance(montants, maintenant = new Date()) {
  const { total } = agregerPipeline(montants);
  const gagnees = (montants || []).filter((m) => m.statut === 'gagnee');
  const perdues = (montants || []).filter((m) => m.statut === 'perdue');
  const montantGagne = gagnees.reduce((somme, m) => somme + nombre(m.montant_retenu), 0);
  const montantPerdu = perdues.reduce((somme, m) => somme + nombre(m.montant_retenu), 0);
  return {
    pipeline: total.montant,
    pondere: total.pondere,
    caSigneAnnee: caSigneAnnee(montants, maintenant.getFullYear()),
    caSigneTotal: montantGagne,
    montantMoyenGagne: gagnees.length > 0 ? montantGagne / gagnees.length : null,
    conversion: { gagne: montantGagne, perdu: montantPerdu, taux: montantGagne + montantPerdu > 0 ? montantGagne / (montantGagne + montantPerdu) : null },
    sansMontant: demandesSansMontant(montants).length,
  };
}

// Saisie "4 800,50" ou "4800.5" -> nombre ; vide -> null ; illisible -> NaN.
export function lireNombre(texte) {
  if (texte == null || String(texte).trim() === '') return null;
  return Number(String(texte).replace(/[\s  ]/g, '').replace(',', '.'));
}

// Formulaire "Enjeu commercial" -> ligne de demande_enjeux.
export function preparerEnjeu(valeurs) {
  const montant = lireNombre(valeurs.montant_estime);
  const probabilite = lireNombre(valeurs.probabilite);
  return {
    montant_estime: montant == null || Number.isNaN(montant) ? null : Math.round(montant * 100) / 100,
    probabilite: probabilite == null || Number.isNaN(probabilite) ? null : probabilite,
  };
}

export function validerEnjeu(valeurs) {
  const erreurs = {};
  const montant = lireNombre(valeurs.montant_estime);
  if (montant != null && (Number.isNaN(montant) || montant < 0)) erreurs.montant_estime = 'Montant invalide : un nombre positif ou nul.';
  const probabilite = lireNombre(valeurs.probabilite);
  if (probabilite != null && (!Number.isInteger(probabilite) || probabilite < 0 || probabilite > 100)) {
    erreurs.probabilite = 'La probabilité est un entier de 0 à 100.';
  }
  return erreurs;
}
