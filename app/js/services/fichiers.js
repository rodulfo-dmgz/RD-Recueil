import { supabase } from '../supabase.js';
import { validerFichierDepot } from '../engine/validation.js';

// Chemin de stockage : {reference}/{question_id}/{horodatage}-{nom} dans le
// bucket 'demandes' - cf. politiques RLS de storage.objects (0003_rls.sql).
export async function televerserFichier({ demandeId, reference, questionId, fichier }) {
  const erreur = validerFichierDepot({ nom: fichier.name, taille: fichier.size });
  if (erreur) throw new Error(erreur);

  const chemin = `${reference}/${questionId}/${Date.now()}-${fichier.name}`;

  const { error: erreurDepot } = await supabase.storage.from('demandes').upload(chemin, fichier);
  if (erreurDepot) throw erreurDepot;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { error: erreurTable } = await supabase.from('fichiers').insert({
    demande_id: demandeId,
    question_id: questionId,
    chemin,
    nom: fichier.name,
    taille: fichier.size,
    mime: fichier.type,
    depose_par: session?.user?.id,
  });
  if (erreurTable) throw erreurTable;

  return chemin;
}

export async function listerFichiers(demandeId) {
  const { data, error } = await supabase
    .from('fichiers')
    .select('*')
    .eq('demande_id', demandeId)
    .order('created_at');
  if (error) throw error;
  return data;
}
