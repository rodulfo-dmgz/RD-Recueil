// Grille tarifaire RD Formation - portée depuis le simulateur de devis
// (Simulateur de devis/js/simulateur.js et grille-tarifaire.html). Sert à
// pré-remplir les lignes d'une proposition commerciale à partir du type de
// prestation, sans dupliquer la logique de calcul.
export const TYPES_PRESTATION = {
  service: { libelle: 'Prestation ponctuelle / conseil', conception: 2, animation: 3, suivi: 0.5, tauxHoraire: 70 },
  module: { libelle: 'Conception de module', conception: 4, animation: 7, suivi: 1, tauxHoraire: 60 },
  formation: { libelle: 'Formation complète', conception: 10, animation: 21, suivi: 2, tauxHoraire: 55 },
  elearning: { libelle: 'Conception e-learning', conception: 16, animation: 0, suivi: 2, tauxHoraire: 65 },
};

// Correspondance entre les familles de prestation de RD Recueil (TC-0.01)
// et les types du simulateur, pour ne présélectionner qu'une suggestion de
// départ - le consultant reste libre de choisir un autre type.
export const CORRESPONDANCE_TYPE_DEMANDE = {
  FOR: 'formation',
  PON: 'service',
  MOD: 'module',
  ING: 'module',
  CER: 'formation',
};

export const NIVEAUX_EXPERTISE = [
  { coefficient: 1, description: 'Le sujet est déjà bien rodé : peu de recherche, supports existants à adapter.' },
  {
    coefficient: 1.25,
    description: "Le sujet demande une préparation technique réelle ou s'adresse à un public expérimenté.",
  },
  { coefficient: 1.5, description: 'Expertise rare ou sur-mesure poussé.' },
];

// Reproduit le calcul de coûts de simulateur.js (recompute()) : conception
// et animation au taux effectif, suivi à 80% de ce taux, frais annexes de
// déplacement/hébergement en une seule ligne si renseignés.
export function calculerLignesTarif({
  type,
  coefficient = 1,
  tauxHoraire,
  km = 0,
  tarifKm = 0,
  nuitees = 0,
  forfaitNuitee = 0,
}) {
  const preset = TYPES_PRESTATION[type];
  if (!preset) throw new Error(`Type de prestation inconnu : ${type}`);

  const taux = tauxHoraire ?? preset.tauxHoraire;
  const tauxEffectif = taux * coefficient;
  const lignes = [];

  if (preset.conception > 0) {
    lignes.push({
      designation: `Ingénierie et conception (${preset.conception} h)`,
      quantite: preset.conception,
      prix_unitaire: tauxEffectif,
    });
  }
  if (preset.animation > 0) {
    lignes.push({
      designation: `Animation (${preset.animation} h)`,
      quantite: preset.animation,
      prix_unitaire: tauxEffectif,
    });
  }
  if (preset.suivi > 0) {
    lignes.push({
      designation: `Suivi et évaluation (${preset.suivi} h)`,
      quantite: preset.suivi,
      prix_unitaire: tauxEffectif * 0.8,
    });
  }

  const fraisAnnexes = km * tarifKm + nuitees * forfaitNuitee;
  if (fraisAnnexes > 0) {
    lignes.push({ designation: 'Frais annexes (déplacement, hébergement)', quantite: 1, prix_unitaire: fraisAnnexes });
  }

  return lignes;
}
