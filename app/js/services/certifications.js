import { appelerEdgeFunction } from './edge-functions.js';

const RNCP_RE = /^RNCP\d{3,5}$/i;

export function estCodeRncp(valeur) {
  return RNCP_RE.test((valeur || '').trim());
}

// Vérifie un code RNCP auprès de France Compétences via l'Edge Function
// rncp-lookup (la clé API n'existe que côté serveur, cf. CLAUDE.md).
export async function verifierCodeRncp(code) {
  return appelerEdgeFunction('rncp-lookup', {
    params: { rncp: code.trim().toUpperCase() },
    messageErreur: 'Échec de la vérification du code RNCP.',
  }); // { trouve, rncp?, intitule?, actif?, periodeValidite?, blocsCompetences?, domaines?, voiesAcces?, lienOfficiel? }
}

// Recherche libre dans Certif Info (intercariforef.org) via l'Edge Function
// certifinfo-lookup - référentiel plus large que le seul RNCP (couvre aussi
// des formations non enregistrées à France Compétences).
export async function rechercherCertifInfo(intitule) {
  const resultat = await appelerEdgeFunction('certifinfo-lookup', {
    params: { action: 'recherche', intitule },
    messageErreur: 'Échec de la recherche Certif Info.',
  });
  return resultat.suggestions; // [{ certifinfoCode, intitule, niveauEuropeen, rncpCode, rsCode }]
}

// Détail d'une certification Certif Info par son code (choisie dans les
// suggestions de rechercherCertifInfo).
export async function obtenirCertifInfo(certifinfoCode) {
  return appelerEdgeFunction('certifinfo-lookup', {
    params: { action: 'certification', id: certifinfoCode },
    messageErreur: 'Échec de la vérification Certif Info.',
  }); // { trouve, certifinfoCode?, intitule?, niveauEuropeen?, actif?, rncp?, rs?, rome?, nsf?, certificateurs?, accessibilite?, objectif?, programme?, admission?, poursuite?, debouches? }
}
