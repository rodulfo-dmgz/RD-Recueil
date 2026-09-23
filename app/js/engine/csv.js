// Génération CSV pure - Lot 5 (exports). Séparateur point-virgule (convention
// Excel FR, la virgule étant le séparateur décimal).
export function genererCsv(lignes, colonnes) {
  const echapper = (valeur) => {
    const texte = valeur == null ? '' : String(valeur);
    if (/["\n;]/.test(texte)) {
      return '"' + texte.replace(/"/g, '""') + '"';
    }
    return texte;
  };

  const entete = colonnes.map((c) => echapper(c.libelle)).join(';');
  const corps = lignes.map((ligne) => colonnes.map((c) => echapper(c.valeur(ligne))).join(';'));
  return [entete, ...corps].join('\r\n');
}
