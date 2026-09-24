// Recherche d'entreprise par SIRET - API publique gratuite recherche-
// entreprises.api.gouv.fr (data.gouv.fr, base SIRENE de l'INSEE), sans clé.
const API_BASE = 'https://recherche-entreprises.api.gouv.fr/search';

// Codes "catégorie juridique" INSEE -> options de TC-1.02. Couvre les cas
// courants (sociétés commerciales, association) ; le reste retombe sur
// "autre" plutôt que de risquer un mauvais mapping.
function mapperFormeJuridique(code) {
  if (!code) return null;
  if (code.startsWith('1')) return 'entreprise-individuelle';
  if (code === '5498') return 'eurl';
  if (code === '5499') return 'sarl';
  if (code === '5415' || code === '5720') return 'sasu';
  if (code === '5410' || code === '5710') return 'sas';
  if (['5310', '5370', '5385'].includes(code)) return 'sa';
  if (code.startsWith('92') || code.startsWith('93')) return 'association';
  return 'autre';
}

// Sections NAF rév. 2 (INSEE, A à U) -> texte libre pour TC-1.05. L'API ne
// fournit jamais le libellé fin du code NAF (ex. "70.22Z"), seulement cette
// lettre de section ; embarquer les ~732 libellés fins serait disproportionné
// pour ce seul champ.
const SECTIONS_NAF = {
  A: 'Agriculture, sylviculture et pêche',
  B: 'Industries extractives',
  C: 'Industrie manufacturière',
  D: "Production et distribution d'électricité, de gaz, de vapeur et d'air conditionné",
  E: "Production et distribution d'eau, assainissement, gestion des déchets et dépollution",
  F: 'Construction',
  G: "Commerce, réparation d'automobiles et de motocycles",
  H: 'Transports et entreposage',
  I: 'Hébergement et restauration',
  J: 'Information et communication',
  K: "Activités financières et d'assurance",
  L: 'Activités immobilières',
  M: 'Activités spécialisées, scientifiques et techniques',
  N: 'Activités de services administratifs et de soutien',
  O: 'Administration publique',
  P: 'Enseignement',
  Q: 'Santé humaine et action sociale',
  R: 'Arts, spectacles et activités récréatives',
  S: 'Autres activités de services',
  T: 'Activités des ménages en tant qu\'employeurs',
  U: 'Activités extra-territoriales',
};

// Tranches d'effectif INSEE -> options de TC-1.08.
const TRANCHES_EFFECTIF = {
  '00': 'moins-de-11-salaries',
  '01': 'moins-de-11-salaries',
  '02': 'moins-de-11-salaries',
  '03': 'moins-de-11-salaries',
  11: '11-a-49',
  12: '11-a-49',
  21: '50-a-249',
  22: '50-a-249',
  31: '50-a-249',
  32: '250-a-999',
  41: '250-a-999',
  42: '1-000-et-plus',
  51: '1-000-et-plus',
  52: '1-000-et-plus',
  53: '1-000-et-plus',
};

function extraireEtablissement(resultat, etablissement) {
  const rue = [etablissement.numero_voie, etablissement.type_voie, etablissement.libelle_voie].filter(Boolean).join(' ');
  const adresse =
    rue || etablissement.libelle_commune
      ? { rue, cp: etablissement.code_postal || '', ville: etablissement.libelle_commune || '' }
      : null;
  const complements = resultat.complements || {};
  const idcc = complements.liste_idcc?.[0];
  return {
    siret: etablissement.siret,
    raisonSociale: resultat.nom_raison_sociale || resultat.nom_complet || null,
    codeNaf: resultat.activite_principale || null,
    secteurActivite: SECTIONS_NAF[resultat.section_activite_principale] || null,
    adresse,
    estSiege: Boolean(etablissement.est_siege),
    formeJuridique: mapperFormeJuridique(resultat.nature_juridique),
    effectif: TRANCHES_EFFECTIF[etablissement.tranche_effectif_salarie || resultat.tranche_effectif_salarie] || null,
    conventionCollective: idcc ? `IDCC ${idcc}` : null,
    estOrganismeFormation: complements.est_organisme_formation ? 'oui' : complements.est_organisme_formation === false ? 'non' : null,
    estQualiopi: complements.est_qualiopi === true ? 'oui' : complements.est_qualiopi === false ? 'non' : null,
    nda: complements.liste_id_organisme_formation?.[0] || null,
  };
}

export async function rechercherEntreprise(siret) {
  const reponse = await fetch(`${API_BASE}?q=${encodeURIComponent(siret)}&per_page=1`);
  if (!reponse.ok) throw new Error('Recherche entreprise indisponible pour le moment.');
  const donnees = await reponse.json();
  const resultat = donnees.results?.find((r) => r.siege?.siret === siret) || donnees.results?.[0];
  if (!resultat) return null;
  const etablissement =
    resultat.siege?.siret === siret
      ? resultat.siege
      : resultat.matching_etablissements?.find((e) => e.siret === siret) || resultat.siege;
  if (!etablissement) return null;
  return extraireEtablissement(resultat, etablissement);
}

// Saisie semi-automatique : à partir du SIREN complet (9 chiffres), liste
// les établissements correspondants (siège + établissements secondaires)
// pour sélection directe - en dessous de 9 chiffres l'API cherche du texte
// libre partout (codes postaux compris) et n'est pas pertinente.
const MAX_SUGGESTIONS = 10;

export async function rechercherEtablissements(prefixe) {
  const reponse = await fetch(`${API_BASE}?q=${encodeURIComponent(prefixe)}&per_page=${MAX_SUGGESTIONS}`);
  if (!reponse.ok) throw new Error('Recherche entreprise indisponible pour le moment.');
  const donnees = await reponse.json();
  const suggestions = [];
  for (const resultat of donnees.results || []) {
    const vus = new Set();
    for (const etab of [resultat.siege, ...(resultat.matching_etablissements || [])]) {
      if (!etab?.siret || vus.has(etab.siret)) continue;
      vus.add(etab.siret);
      suggestions.push(extraireEtablissement(resultat, etab));
      if (suggestions.length >= MAX_SUGGESTIONS) break;
    }
    if (suggestions.length >= MAX_SUGGESTIONS) break;
  }
  return suggestions;
}
