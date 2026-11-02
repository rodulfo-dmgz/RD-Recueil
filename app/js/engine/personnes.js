// Rattachement des noms de personnes aux lignes chargées (CRM sur le noyau de l'ERP).
// Il n'y a plus de table de profils à joindre : les noms viennent de crm_rpc_personnes, puis sont
// rattachés ici, sous la forme { nom, email } que les écrans utilisaient déjà. Fonctions pures.

// Identifiants distincts et non vides.
export function identifiantsDistincts(identifiants) {
  return [...new Set((identifiants ?? []).filter(Boolean))];
}

// lignes de crm_rpc_personnes -> Map identifiant -> { nom, email }.
export function indexerPersonnes(lignes) {
  return new Map((lignes ?? []).map((p) => [p.user_id, { nom: p.nom, email: p.email }]));
}

// Pose sur chaque ligne, à la clé `cible`, la personne désignée par la colonne `colonne` (null si inconnue).
// Retourne les mêmes lignes (modifiées en place).
export function rattacherPersonne(lignes, colonne, cible, index) {
  for (const ligne of lignes ?? []) ligne[cible] = index.get(ligne[colonne]) ?? null;
  return lignes;
}

// Choisit l'organisation parmi celles où la personne a un rôle du CRM : la mémorisée si elle existe encore,
// sinon la première. Sans rôle du CRM (aucune ligne), aucun profil.
export function choisirLigneProfil(lignes, organisationMemorisee) {
  if (!lignes || lignes.length === 0) return null;
  return lignes.find((l) => l.organisation_id === organisationMemorisee) ?? lignes[0];
}
