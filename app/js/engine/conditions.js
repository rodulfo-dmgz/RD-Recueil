// Évaluation de la grammaire des conditions - 01_ARCHITECTURE.md section 6.3 et 6.4.
//
// condition   := '-' | expression
// expression  := terme (('ET' | 'OU') terme)*   -- ET est prioritaire sur OU
// terme       := ID operateur valeur | ID 'est renseigné'
// operateur   := '=' | '!=' | 'contient' | 'ne contient pas'

export function slug(texte) {
  return texte
    .replace(/\\\*/g, '')
    .replace(/\*/g, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function correspond(valeurCondition, valeurStockee) {
  if (valeurStockee == null) return false;
  return valeurCondition === valeurStockee || slug(valeurCondition) === slug(valeurStockee);
}

function evaluerTerme(terme, ctx) {
  const renseigne = terme.match(/^(.+?)\s+est renseigné$/);
  if (renseigne) {
    const id = renseigne[1].trim();
    return ctx.estVisible(id) && ctx.estRenseigne(id);
  }

  const match = terme.match(/^(\S+)\s+(!=|=|ne contient pas|contient)\s+(.+)$/);
  if (!match) {
    throw new Error(`Terme de condition invalide : "${terme}"`);
  }
  const [, id, operateur, valeurBrute] = match;

  if (!ctx.estVisible(id)) return false; // propagation : source masquée -> masqué

  const valeurActuelle = ctx.valeur(id);

  if (operateur === 'contient') {
    return Array.isArray(valeurActuelle) && valeurActuelle.some((v) => correspond(valeurBrute, v));
  }
  if (operateur === 'ne contient pas') {
    return !(Array.isArray(valeurActuelle) && valeurActuelle.some((v) => correspond(valeurBrute, v)));
  }
  if (operateur === '=') {
    return correspond(valeurBrute, valeurActuelle);
  }
  // '!='
  return !correspond(valeurBrute, valeurActuelle);
}

export function evaluerExpression(condition, ctx) {
  if (condition == null || condition === '-') return true;
  const groupesOu = condition.split(/\s+OU\s+/);
  return groupesOu.some((groupe) =>
    groupe.split(/\s+ET\s+/).every((terme) => evaluerTerme(terme.trim(), ctx))
  );
}

function creerAccesseurs(reponses) {
  const reponseParId = new Map(reponses.map((r) => [r.question_id, r]));

  function estRenseigne(id) {
    const r = reponseParId.get(id);
    if (!r) return false;
    if (r.nsp) return true;
    const v = r.valeur;
    if (v == null || v === '') return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  }

  function valeur(id) {
    const r = reponseParId.get(id);
    if (!r || r.nsp) return undefined;
    return r.valeur;
  }

  return { estRenseigne, valeur };
}

// Calcule, dans l'ordre du document (chaque section puis ses questions, avant
// de passer à la section suivante), les sections et questions visibles. Une
// section n'est traitée qu'après que toutes les questions des sections
// précédentes ont été résolues, condition nécessaire puisque TC-0.01 (tronc
// commun) doit être visible avant que V-FOR (qui la référence) soit évalué.
// L'ordre du document garantit aussi qu'une condition ne référence jamais un
// ID pas encore résolu (vérifié par scripts/check-coherence.mjs).
export function calculerVisibilite({ sections, questions }, reponses) {
  const { estRenseigne, valeur } = creerAccesseurs(reponses);

  const sectionsVisibles = new Set();
  const questionsVisibles = new Set();

  const ctx = {
    estVisible: (id) => questionsVisibles.has(id),
    estRenseigne,
    valeur,
  };

  const questionsParSection = new Map();
  for (const question of questions) {
    if (!questionsParSection.has(question.section)) questionsParSection.set(question.section, []);
    questionsParSection.get(question.section).push(question);
  }
  for (const liste of questionsParSection.values()) {
    liste.sort((a, b) => a.ordre - b.ordre);
  }

  const sectionsTriees = [...sections].sort((a, b) => a.ordre - b.ordre);
  for (const section of sectionsTriees) {
    if (!evaluerExpression(section.condition, ctx)) continue;
    sectionsVisibles.add(section.id);
    for (const question of questionsParSection.get(section.id) || []) {
      if (evaluerExpression(question.condition, ctx)) {
        questionsVisibles.add(question.id);
      }
    }
  }

  return { sectionsVisibles, questionsVisibles };
}
