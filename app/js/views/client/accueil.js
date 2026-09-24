import { obtenirDemandeParReference } from '../../services/demandes.js';
import { chargerQuestionnaire, chargerGlossaire } from '../../services/questionnaire.js';
import { chargerReponses } from '../../services/reponses.js';
import { initialiserDemande, getEtatDemande } from '../../store.js';
import { indexerGlossaire } from '../../engine/glossary.js';
import { initGlossaryTooltip } from '../../components/glossary-tooltip.js';
import { rendreProgression } from '../../components/progress.js';
import { afficherToast } from '../../components/toast.js';

// Icône Lucide par section (identifiants stables - 02_MODELE_RECUEIL_BESOINS.md).
const ICONES_SECTION = {
  'TC-0': 'clipboard-list',
  'TC-1': 'building-2',
  'TC-2': 'users',
  'TC-3': 'message-square-text',
  'TC-4': 'search',
  'TC-5': 'user-check',
  'TC-6': 'target',
  'TC-7': 'layers',
  'TC-8': 'settings-2',
  'TC-9': 'clipboard-check',
  'TC-10': 'euro',
  'TC-11': 'scale',
  'TC-12': 'compass',
  'TC-13': 'send',
  'V-FOR': 'graduation-cap',
  'V-PON': 'briefcase',
  'V-MOD': 'package',
  'V-ING': 'route',
  'V-CER': 'award',
};

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
  titre.className = 'accueil-demande__titre';
  titre.textContent = `Demande ${etat.demande.reference}`;
  main.appendChild(titre);

  const sectionsVisibles = etat.questionnaire.sections
    .filter((s) => etat.visibilite.sectionsVisibles.has(s.id) && s.partie !== 3)
    .sort((a, b) => a.ordre - b.ordre);

  // La progression par section est déjà visible, en plus détaillé, sur
  // chaque carte ci-dessous (icône, barre, pourcentage) : les pastilles ne
  // sont pas redemandées ici pour éviter d'afficher deux fois la même
  // information juste avant la grille.
  main.appendChild(rendreProgression(etat.progression));

  const grilleSections = document.createElement('div');
  grilleSections.className = 'section-grille';
  for (const section of sectionsVisibles) {
    const info = etat.progression.parSection.get(section.id);
    const pourcentage = info ? info.pourcentage : 0;
    const complete = pourcentage === 100;

    const carte = document.createElement('a');
    carte.href = `#/d/${reference}/s/${section.id}`;
    carte.className = 'section-carte' + (complete ? ' section-carte--complete' : '');

    carte.innerHTML = `
      <div class="section-carte__haut">
        <span class="section-carte__icone"><i data-lucide="${ICONES_SECTION[section.id] || 'file-text'}"></i></span>
        <span class="section-carte__titre">${section.titre}</span>
      </div>
      <div class="section-carte__bas">
        <span class="section-carte__barre"><span style="width:${pourcentage}%"></span></span>
        <span class="section-carte__pourcentage">${pourcentage}%</span>
      </div>
    `;
    grilleSections.appendChild(carte);
  }
  main.appendChild(grilleSections);

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

  const STATUTS_AVEC_PROPOSITION = new Set(['proposition_envoyee', 'gagnee', 'perdue']);
  if (STATUTS_AVEC_PROPOSITION.has(etat.demande.statut)) {
    const lienProposition = document.createElement('a');
    lienProposition.className = 'btn btn--secondaire';
    lienProposition.href = `#/d/${reference}/proposition`;
    lienProposition.textContent = 'Proposition';
    actions.appendChild(lienProposition);
  }

  main.appendChild(actions);

  app.appendChild(main);
  if (window.lucide) window.lucide.createIcons();
}
