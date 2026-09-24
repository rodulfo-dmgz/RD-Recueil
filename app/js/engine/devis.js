// Calcul du total d'un devis (proposition commerciale) - fonction pure.
export function calculerTotalLigne(ligne) {
  return (Number(ligne.quantite) || 0) * (Number(ligne.prix_unitaire) || 0);
}

export function calculerTotalDevis(lignes) {
  return lignes.reduce((somme, ligne) => somme + calculerTotalLigne(ligne), 0);
}
