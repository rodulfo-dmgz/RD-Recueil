import { supabase } from '../supabase.js';

// Le client lit v_reponses_client (annotation_consultant masquée) -
// 01_ARCHITECTURE.md section 8.2.
export async function chargerReponses(demandeId) {
  const { data, error } = await supabase.from('v_reponses_client').select('*').eq('demande_id', demandeId);
  if (error) throw error;
  return data;
}

export async function enregistrerReponse(demandeId, questionId, { valeur, nsp }) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { error } = await supabase
    .from('reponses')
    .upsert(
      { demande_id: demandeId, question_id: questionId, valeur, nsp, saisi_par: session?.user?.id },
      { onConflict: 'demande_id,question_id' }
    );
  if (error) throw error;
}

// Vue consultant (vue 360, mode entretien) : lit la table complète, y compris
// annotation_consultant - réservé au staff par le RLS (0003_rls.sql).
export async function chargerReponsesStaff(demandeId) {
  const { data, error } = await supabase.from('reponses').select('*').eq('demande_id', demandeId);
  if (error) throw error;
  return data;
}

export async function enregistrerAnnotation(demandeId, questionId, annotationConsultant) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const { error } = await supabase.from('reponses').upsert(
    {
      demande_id: demandeId,
      question_id: questionId,
      annotation_consultant: annotationConsultant,
      saisi_par: session?.user?.id,
    },
    { onConflict: 'demande_id,question_id' }
  );
  if (error) throw error;
}
