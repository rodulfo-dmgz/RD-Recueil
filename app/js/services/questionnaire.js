import { supabase } from '../supabase.js';

function normaliserQuestion(row) {
  const options = row.options;
  const colonnes = options && !Array.isArray(options) ? options.colonnes : undefined;
  return {
    id: row.id,
    section: row.section_id,
    ordre: row.ordre,
    libelle: row.libelle,
    type: row.type,
    options: Array.isArray(options) ? options : [],
    ...(colonnes ? { colonnes } : {}),
    obligatoire: row.obligatoire,
    rempli_par: row.rempli_par,
    condition: row.condition,
    glossaire: row.glossaire || [],
    nsp_autorise: row.nsp_autorise,
  };
}

export async function chargerQuestionnaire(questionnaireId) {
  const [{ data: sections, error: erreurSections }, { data: questions, error: erreurQuestions }] = await Promise.all([
    supabase.from('sections').select('*').eq('questionnaire_id', questionnaireId).order('ordre'),
    supabase.from('questions').select('*').eq('questionnaire_id', questionnaireId).order('ordre'),
  ]);
  if (erreurSections) throw erreurSections;
  if (erreurQuestions) throw erreurQuestions;

  return {
    sections,
    questions: questions.map(normaliserQuestion),
  };
}

export async function chargerGlossaire(questionnaireId) {
  const { data, error } = await supabase.from('glossaire').select('*').eq('questionnaire_id', questionnaireId);
  if (error) throw error;
  return data;
}

export async function obtenirVersionPublieeCourante() {
  const { data, error } = await supabase
    .from('questionnaires')
    .select('id')
    .eq('statut', 'publie')
    .order('publie_le', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}
