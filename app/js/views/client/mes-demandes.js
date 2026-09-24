import { supabase } from '../../supabase.js';
import { afficherToast } from '../../components/toast.js';
import { chargerQuestionnaire } from '../../services/questionnaire.js';
import { chargerReponses } from '../../services/reponses.js';
import { calculerVisibilite } from '../../engine/conditions.js';
import { calculerProgression } from '../../engine/completion.js';
import { LIBELLES_STATUT, categorieStatut } from '../../engine/statuts.js';

const LIBELLES_TYPE = {
  FOR: 'Formation',
  PON: 'Prestation ponctuelle',
  MOD: 'Conception de module',
  ING: 'Ingénierie',
  CER: 'Démarche certifiante',
  NSP: 'À définir',
};

function formaterDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Progression client (mêmes règles que la page de la demande) - calculée ici
// pour l'afficher directement dans la liste, sans attendre d'ouvrir la
// demande.
async function calculerPourcentage(demande) {
  try {
    const [questionnaire, reponses] = await Promise.all([
      chargerQuestionnaire(demande.questionnaire_id),
      chargerReponses(demande.id),
    ]);
    const visibilite = calculerVisibilite(questionnaire, reponses);
    return calculerProgression(questionnaire, visibilite, reponses).global.pourcentage;
  } catch {
    return null;
  }
}

function carteDemande(demande) {
  const lien = document.createElement('a');
  lien.href = `#/d/${demande.reference}`;
  lien.className = 'demande-carte';

  const entete = document.createElement('div');
  entete.className = 'demande-carte__entete';
  const reference = document.createElement('span');
  reference.className = 'demande-carte__reference';
  reference.textContent = demande.reference;
  const statut = document.createElement('span');
  statut.className = `demande-carte__statut demande-carte__statut--${categorieStatut(demande.statut)}`;
  statut.textContent = LIBELLES_STATUT[demande.statut] || demande.statut;
  entete.append(reference, statut);
  lien.appendChild(entete);

  const typesLibelles = (demande.types || []).map((t) => LIBELLES_TYPE[t] || t).join(', ');
  if (typesLibelles) {
    const type = document.createElement('p');
    type.className = 'demande-carte__type texte-doux';
    type.textContent = typesLibelles;
    lien.appendChild(type);
  }

  if (demande.pourcentage != null) {
    const progression = document.createElement('div');
    progression.className = 'demande-carte__progression';
    progression.innerHTML = `
      <span class="demande-carte__barre"><span style="width:${demande.pourcentage}%"></span></span>
      <span class="demande-carte__pourcentage">${demande.pourcentage}%</span>
    `;
    lien.appendChild(progression);
  }

  const dateMaj = formaterDate(demande.updated_at);
  if (dateMaj) {
    const date = document.createElement('p');
    date.className = 'demande-carte__date texte-doux';
    date.textContent = `Mise à jour le ${dateMaj}`;
    lien.appendChild(date);
  }

  return lien;
}

export async function vueMesDemandes() {
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><h1>Mes demandes</h1><p>Chargement…</p></main>';
  const main = app.querySelector('main');

  const { data, error } = await supabase
    .from('demandes')
    .select('id, reference, statut, types, questionnaire_id, updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    afficherToast(error.message, { type: 'erreur' });
    main.innerHTML = '<h1>Mes demandes</h1><p>Impossible de charger vos demandes.</p>';
    return;
  }

  if (data.length === 0) {
    main.innerHTML = '<h1>Mes demandes</h1><p class="texte-doux">Aucune demande pour le moment.</p>';
    return;
  }

  const demandes = await Promise.all(
    data.map(async (d) => ({ ...d, pourcentage: await calculerPourcentage(d) }))
  );

  main.innerHTML = '<h1>Mes demandes</h1>';
  const liste = document.createElement('div');
  liste.className = 'mes-demandes-liste';
  for (const demande of demandes) {
    liste.appendChild(carteDemande(demande));
  }
  main.appendChild(liste);
}
