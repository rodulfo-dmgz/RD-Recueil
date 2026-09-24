// Rendu Markdown -> HTML assaini - 01_ARCHITECTURE.md section 5.1
// (marked + DOMPurify, chargés en CDN dans index.html).
export function rendreMarkdown(texte) {
  const html = window.marked.parse(texte || '', { breaks: true });
  return window.DOMPurify.sanitize(html);
}

const MARQUEUR_ANNEXE_GLOSSAIRE = '### Annexe';

// Sépare l'annexe glossaire du corps de la note de cadrage, pour un affichage
// en deux cartes distinctes (note, puis glossaire) plutôt qu'un bloc unique.
export function separerAnnexeGlossaire(contenuMd) {
  const index = (contenuMd || '').indexOf(MARQUEUR_ANNEXE_GLOSSAIRE);
  if (index === -1) return { corps: contenuMd || '', annexe: null };
  return {
    corps: contenuMd.slice(0, index).trim(),
    annexe: contenuMd.slice(index).trim(),
  };
}
