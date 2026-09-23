// Glossaire à l'exécution - 01_ARCHITECTURE.md section 9.

export function indexerGlossaire(termes) {
  return new Map(termes.map((t) => [t.id, t]));
}

// Repère chaque "mot\*" et le transforme en déclencheur d'infobulle, en associant
// dans l'ordre d'apparition les identifiants de la colonne glossaire de la
// question. `curseur` est un objet { i } partagé entre l'appel sur le libellé
// puis sur chaque libellé d'option, pour conserver l'ordre global.
export function rendreTexteAvecGlossaire(texte, idsGlossaire, curseur) {
  return texte.replace(/(\S+)\\\*/g, (correspondance, mot) => {
    const id = idsGlossaire[curseur.i];
    curseur.i += 1;
    if (!id) return mot;
    return `<button type="button" class="gl-term" data-gl="${id}" aria-describedby="gl-${id}">${mot}<sup>*</sup></button>`;
  });
}

// Identifiants du glossaire liés à la question mais absents du texte affiché
// ("Voir aussi", section 9.5) : ceux qui restent après avoir consommé le
// curseur sur le libellé et les options.
export function idsGlossaireRestants(idsGlossaire, curseur) {
  return idsGlossaire.slice(curseur.i);
}
