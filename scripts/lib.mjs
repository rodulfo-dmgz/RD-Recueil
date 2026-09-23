// Fonctions partagées entre les scripts de parsing et de contrôle.

export function slug(text) {
  return text
    .replace(/\\\*/g, '')
    .replace(/\*/g, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Grammaire des conditions (01_ARCHITECTURE.md section 6.3) :
// condition := '-' | expression
// expression := terme (('ET' | 'OU') terme)*
// terme := ID operateur valeur | ID 'est renseigné'
export function parseCondition(condition) {
  if (condition == null || condition === '-') return [];
  return condition.split(/\s+(?:ET|OU)\s+/).map(parseConditionTerm);
}

export function parseConditionTerm(term) {
  const renseigne = term.match(/^(.+?)\s+est renseigné$/);
  if (renseigne) {
    return { id: renseigne[1].trim(), operator: 'est renseigné', value: null };
  }
  const op = term.match(/^(\S+)\s+(!=|=|ne contient pas|contient)\s+(.+)$/);
  if (op) {
    return { id: op[1], operator: op[2], value: op[3].trim() };
  }
  throw new Error(`Terme de condition invalide : "${term}"`);
}
