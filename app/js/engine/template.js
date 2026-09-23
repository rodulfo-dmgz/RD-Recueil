// Moteur de gabarit de la note de cadrage - 01_ARCHITECTURE.md section 10.1.
// Rend 04_MODELE_NOTE_DE_CADRAGE.md (partie entre les marqueurs DÉBUT/FIN) en
// remplaçant les variables et en évaluant les blocs avec le même moteur de
// conditions que le questionnaire (engine/conditions.js).

import { evaluerExpression } from './conditions.js';
import { formaterReponse } from './formatage.js';

const MARQUEUR_DEBUT = '<!-- ================= DÉBUT DU GABARIT ================= -->';
const MARQUEUR_FIN = '<!-- ================= FIN DU GABARIT ================= -->';

export function extraireCorpsGabarit(gabaritMarkdown) {
  const debut = gabaritMarkdown.indexOf(MARQUEUR_DEBUT);
  const fin = gabaritMarkdown.indexOf(MARQUEUR_FIN);
  if (debut === -1 || fin === -1) {
    throw new Error('Marqueurs DÉBUT/FIN du gabarit introuvables.');
  }
  return gabaritMarkdown.slice(debut + MARQUEUR_DEBUT.length, fin).trim();
}

function creerContexte(reponseParId) {
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
  return {
    estVisible: () => true, // la visibilité est déjà tranchée par calculerVisibilite en amont
    estRenseigne,
    valeur,
  };
}

function rendreVariable(id, { reponseParId, questionParId, meta }) {
  if (id.startsWith('meta.')) {
    return meta[id.slice(5)] ?? '';
  }
  const question = questionParId.get(id);
  if (!question) return '';
  return formaterReponse(question, reponseParId.get(id));
}

function rendreTableauMarkdown(id, { reponseParId, questionParId }) {
  const question = questionParId.get(id);
  const reponse = reponseParId.get(id);
  const colonnes = question?.colonnes || [];
  if (colonnes.length === 0) return '';
  const lignes = Array.isArray(reponse?.valeur) ? reponse.valeur : [];

  const entete = `| ${colonnes.join(' | ')} |`;
  const separateur = `| ${colonnes.map(() => '---').join(' | ')} |`;
  if (lignes.length === 0) return [entete, separateur].join('\n');
  const corps = lignes.map((ligne) => `| ${colonnes.map((c) => ligne[c] ?? '').join(' | ')} |`);
  return [entete, separateur, ...corps].join('\n');
}

function construireListeNsp(questionnaire, visibilite, reponseParId) {
  const questions = questionnaire.questions.filter(
    (q) => visibilite.questionsVisibles.has(q.id) && reponseParId.get(q.id)?.nsp
  );
  if (questions.length === 0) return '_Aucun point resté en suspens._';
  return questions.map((q) => `- ${q.libelle.replace(/\\\*/g, '')}`).join('\n');
}

function construireGlossaireUtilise(questionnaire, visibilite, glossaireIndex) {
  const idsUtilises = new Set();
  for (const question of questionnaire.questions) {
    if (!visibilite.questionsVisibles.has(question.id)) continue;
    for (const id of question.glossaire || []) idsUtilises.add(id);
  }
  const termes = [...idsUtilises]
    .map((id) => glossaireIndex.get(id))
    .filter(Boolean)
    .sort((a, b) => a.libelle.localeCompare(b.libelle));
  if (termes.length === 0) return '_Aucun terme spécifique utilisé._';
  return termes.map((t) => `**${t.libelle}** — ${t.definition}`).join('\n\n');
}

export function genererNoteCadrage({ gabaritMarkdown, meta, questionnaire, reponses, visibilite, glossaireIndex }) {
  const corps = extraireCorpsGabarit(gabaritMarkdown);
  const reponseParId = new Map(reponses.map((r) => [r.question_id, r]));
  const questionParId = new Map(questionnaire.questions.map((q) => [q.id, q]));
  const ctx = creerContexte(reponseParId);

  // 1) Blocs {{#si CONDITION}} ... {{/si}} (non imbriqués - grammaire de
  //    01_ARCHITECTURE.md section 6.3, identique au questionnaire).
  let resultat = corps.replace(/\{\{#si\s+(.+?)\}\}([\s\S]*?)\{\{\/si\}\}/g, (_m, condition, contenu) =>
    evaluerExpression(condition.trim(), ctx) ? contenu : ''
  );

  // 2) Blocs {{#tableau ID}}.
  resultat = resultat.replace(/\{\{#tableau\s+([A-Za-z0-9.\-]+)\}\}/g, (_m, id) =>
    rendreTableauMarkdown(id, { reponseParId, questionParId })
  );

  // 3) Variables spéciales.
  resultat = resultat.replace(/\{\{liste_nsp\}\}/g, () => construireListeNsp(questionnaire, visibilite, reponseParId));
  resultat = resultat.replace(/\{\{glossaire_utilise\}\}/g, () =>
    construireGlossaireUtilise(questionnaire, visibilite, glossaireIndex)
  );

  // 4) Variables simples {{ID}} ou {{ID ?? "repli"}}.
  resultat = resultat.replace(/\{\{([^#/{}]+?)\}\}/g, (_m, expression) => {
    const [idBrut, repliBrut] = expression.split('??').map((s) => s.trim());
    const valeurRendue = rendreVariable(idBrut, { reponseParId, questionParId, meta });
    if ((valeurRendue === '' || valeurRendue === '—') && repliBrut) {
      return repliBrut.replace(/^"|"$/g, '');
    }
    return valeurRendue;
  });

  return resultat.trim();
}
