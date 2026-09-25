import { supabase } from '../supabase.js';
import { validerFichierDepot } from '../engine/validation.js';
import { slug } from '../engine/conditions.js';

// Chemin de stockage : {client}/{reference}/{question_id}/{horodatage}-{nom}
// dans le bucket 'demandes' - le dossier client regroupe visuellement les
// fichiers de toutes ses demandes dans Supabase Storage. C'est la référence
// (2e segment) qui reste la clé d'accès RLS (0003_rls.sql, migration 0027) :
// un client renommé plus tard garde l'accès à ses anciens fichiers, seul le
// libellé du dossier devient incohérent avec le nom courant.
export async function televerserFichier({ demandeId, reference, questionId, fichier }) {
  const erreur = validerFichierDepot({ nom: fichier.name, taille: fichier.size });
  if (erreur) throw new Error(erreur);

  const { data: demande } = await supabase
    .from('demandes')
    .select('clients(raison_sociale)')
    .eq('id', demandeId)
    .maybeSingle();
  const dossierClient = slug(demande?.clients?.raison_sociale || '') || 'client';

  const chemin = `${dossierClient}/${reference}/${questionId}/${Date.now()}-${fichier.name}`;

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
