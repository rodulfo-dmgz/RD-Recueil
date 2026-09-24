// Recherche d'entreprise par SIRET - API publique gratuite recherche-
// entreprises.api.gouv.fr (data.gouv.fr, base SIRENE de l'INSEE), sans clé.
const API_BASE = 'https://recherche-entreprises.api.gouv.fr/search';

function extraireEtablissement(resultat, etablissement) {
  const rue = [etablissement.numero_voie, etablissement.type_voie, etablissement.libelle_voie].filter(Boolean).join(' ');
  const adresse =
    rue || etablissement.libelle_commune
      ? { rue, cp: etablissement.code_postal || '', ville: etablissement.libelle_commune || '' }
      : null;
  return {
    siret: etablissement.siret,
    raisonSociale: resultat.nom_raison_sociale || resultat.nom_complet || null,
    codeNaf: resultat.activite_principale || null,
    adresse,
    estSiege: Boolean(etablissement.est_siege),
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
