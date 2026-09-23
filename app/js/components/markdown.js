// Rendu Markdown -> HTML assaini - 01_ARCHITECTURE.md section 5.1
// (marked + DOMPurify, chargés en CDN dans index.html).
export function rendreMarkdown(texte) {
  const html = window.marked.parse(texte || '');
  return window.DOMPurify.sanitize(html);
}
