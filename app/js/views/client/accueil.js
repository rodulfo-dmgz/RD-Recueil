import { obtenirDemandeParReference } from '../../services/demandes.js';
import { chargerQuestionnaire, chargerGlossaire } from '../../services/questionnaire.js';
import { chargerReponses } from '../../services/reponses.js';
import { initialiserDemande, getEtatDemande } from '../../store.js';
import { indexerGlossaire } from '../../engine/glossary.js';
import { initGlossaryTooltip } from '../../components/glossary-tooltip.js';
import { rendreProgression } from '../../components/progress.js';
import { afficherToast } from '../../components/toast.js';

export async function vueAccueilDemande(reference) {
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><p>Chargement…</p></main>';

  try {
    const demande = await obtenirDemandeParReference(reference);
    if (!demande) {
      app.innerHTML = '<main class="conteneur"><h1>Demande introuvable</h1></main>';
      return;
    }

    const [questionnaire, glossaireTermes, reponses] = await Promise.all([
      chargerQuestionnaire(demande.questionnaire_id),
      chargerGlossaire(demande.questionnaire_id),
      chargerReponses(demande.id),
    ]);

    const glossaireIndex = indexerGlossaire(glossaireTermes);
    initialiserDemande({ demande, questionnaire, glossaireIndex, reponses });
    initGlossaryTooltip(glossaireIndex);

    rendre(reference);
  } catch (err) {
    afficherToast(err.message, { type: 'erreur' });
    app.innerHTML = '<main class="conteneur"><h1>Impossible de charger la demande</h1></main>';
  }
}

function rendre(reference) {
  const app = document.getElementById('app');
  const etat = getEtatDemande();
  app.innerHTML = '';

  const main = document.createElement('main');
  main.className = 'conteneur';

  const titre = document.createElement('h1');
  titre.textContent = `Demande ${etat.demande.reference}`;
  main.appendChild(titre);

  const sectionsVisibles = etat.questionnaire.sections
    .filter((s) => etat.visibilite.sectionsVisibles.has(s.id) && s.partie !== 3)
    .sort((a, b) => a.ordre - b.ordre);

  main.appendChild(rendreProgression(etat.progression, sectionsVisibles));

  const listeSections = document.createElement('ul');
  listeSections.className = 'liste-demandes';
  for (const section of sectionsVisibles) {
    const li = document.createElement('li');
    const lien = document.createElement('a');
    lien.href = `#/d/${reference}/s/${section.id}`;
    const info = etat.progression.parSection.get(section.id);
    lien.textContent = `${section.titre}${info ? ` — ${info.pourcentage}%` : ''}`;
    li.appendChild(lien);
    listeSections.appendChild(li);
  }
  main.appendChild(listeSections);

  const actions = document.createElement('div');
  actions.className = 'accueil-demande__actions';

  const premiereIncomplete =
    sectionsVisibles.find((s) => (etat.progression.parSection.get(s.id)?.pourcentage ?? 100) < 100) ||
    sectionsVisibles[0];

  const boutonReprendre = document.createElement('a');
  boutonReprendre.className = 'btn btn--primaire';
  boutonReprendre.href = premiereIncomplete ? `#/d/${reference}/s/${premiereIncomplete.id}` : `#/d/${reference}/recap`;
  boutonReprendre.textContent = 'Reprendre la saisie';

  const lienRecap = document.createElement('a');
  lienRecap.className = 'btn btn--secondaire';
  lienRecap.href = `#/d/${reference}/recap`;
  lienRecap.textContent = 'Voir le récapitulatif';

  actions.append(boutonReprendre, lienRecap);

  const STATUTS_AVEC_CADRAGE = new Set(['cadrage_envoye', 'cadrage_a_revoir', 'cadrage_valide', 'proposition_envoyee']);
  if (STATUTS_AVEC_CADRAGE.has(etat.demande.statut)) {
    const lienCadrage = document.createElement('a');
    lienCadrage.className = 'btn btn--secondaire';
    lienCadrage.href = `#/d/${reference}/cadrage`;
    lienCadrage.textContent = 'Note de cadrage';
    actions.appendChild(lienCadrage);
  }

  main.appendChild(actions);

  app.appendChild(main);
}
