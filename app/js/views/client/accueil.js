import { obtenirDemandeParReference } from '../../services/demandes.js';
import { chargerQuestionnaire, chargerGlossaire } from '../../services/questionnaire.js';
import { chargerReponses } from '../../services/reponses.js';
import { listerVersions } from '../../services/notes-cadrage.js';
import { obtenirProposition, listerLignes } from '../../services/propositions.js';
import { initialiserDemande, getEtatDemande } from '../../store.js';
import { indexerGlossaire } from '../../engine/glossary.js';
import { initGlossaryTooltip } from '../../components/glossary-tooltip.js';
import { rendreProgression } from '../../components/progress.js';
import { creerLigneNavigation, creerCarteListe } from '../../components/liste-navigation.js';
import { creerLigneDocument } from '../../components/document-viewer.js';
import { rendreMarkdown, separerAnnexeGlossaire, injecterValidationDansCorps } from '../../components/markdown.js';
import { construireDevisImprimable } from '../../components/devis-imprimable.js';
import { afficherToast } from '../../components/toast.js';
import { STATUTS_MODIFIABLES_CLIENT, LIBELLES_STATUT, categorieStatut } from '../../engine/statuts.js';

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

// Charge une demande, son questionnaire et ses réponses, puis hydrate le
// store (store.js) - utilisé par toutes les vues d'une demande (accueil,
// section, récapitulatif) pour fonctionner même sur un rechargement direct
// d'une URL profonde (F5 sur #/d/:ref/s/:section), où le store est encore
// vide puisque le passage par vueAccueilDemande n'a pas eu lieu.
// Retourne null si la référence est introuvable.
export async function chargerEtatDemande(reference) {
  const demande = await obtenirDemandeParReference(reference);
  if (!demande) return null;

  const [questionnaire, glossaireTermes, reponses] = await Promise.all([
    chargerQuestionnaire(demande.questionnaire_id),
    chargerGlossaire(demande.questionnaire_id),
    chargerReponses(demande.id),
  ]);

  const glossaireIndex = indexerGlossaire(glossaireTermes);
  initialiserDemande({ demande, questionnaire, glossaireIndex, reponses });
  initGlossaryTooltip(glossaireIndex);
  return getEtatDemande();
}

export async function vueAccueilDemande(reference) {
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><p>Chargement…</p></main>';

  try {
    const etat = await chargerEtatDemande(reference);
    if (!etat) {
      app.innerHTML = '<main class="conteneur"><h1>Demande introuvable</h1></main>';
      return;
    }

    const [versionsNote, proposition] = await Promise.all([
      listerVersions(etat.demande.id),
      obtenirProposition(etat.demande.id),
    ]);
    const noteEnvoyee = (versionsNote[0]?.statut === 'brouillon' ? null : versionsNote[0]) ?? null;
    const lignesProposition = proposition ? await listerLignes(proposition.id) : [];

    rendre(reference, { noteEnvoyee, proposition, lignesProposition });
  } catch (err) {
    afficherToast(err.message, { type: 'erreur' });
    app.innerHTML = '<main class="conteneur"><h1>Impossible de charger la demande</h1></main>';
  }
}

function rendre(reference, { noteEnvoyee, proposition, lignesProposition }) {
  const app = document.getElementById('app');
  const etat = getEtatDemande();
  app.innerHTML = '';

  const main = document.createElement('main');
  main.className = 'conteneur';

  const entete = document.createElement('div');
  entete.className = 'entete-demande';
  const titre = document.createElement('h1');
  titre.className = 'accueil-demande__titre';
  titre.textContent = `Demande ${etat.demande.reference}`;
  const statut = document.createElement('span');
  statut.className = `demande-carte__statut demande-carte__statut--${categorieStatut(etat.demande.statut)}`;
  statut.textContent = LIBELLES_STATUT[etat.demande.statut] || etat.demande.statut;
  entete.append(titre, statut);
  main.appendChild(entete);

  const sectionsVisibles = etat.questionnaire.sections
    .filter((s) => etat.visibilite.sectionsVisibles.has(s.id) && s.partie !== 3)
    .sort((a, b) => a.ordre - b.ordre);

  // Une fois la demande soumise, l'écriture des réponses est déjà bloquée
  // côté serveur (RLS, client_peut_ecrire_reponse) : la saisie ne doit plus
  // être accessible depuis cette page, seuls le récapitulatif et le
  // rendez-vous d'entretien le restent.
  const modifiable = STATUTS_MODIFIABLES_CLIENT.has(etat.demande.statut);

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

    const carte = document.createElement(modifiable ? 'a' : 'div');
    if (modifiable) carte.href = `#/d/${reference}/s/${section.id}`;
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

  if (modifiable) {
    // Une fois toutes les sections visibles complètes, le bouton principal
    // mène directement au récapitulatif (revue + envoi) plutôt que de
    // renvoyer vers une section déjà remplie : le client n'a pas à deviner
    // qu'il doit aller chercher le lien "Récapitulatif" plus bas pour
    // trouver le bouton d'envoi.
    const premiereIncomplete = sectionsVisibles.find(
      (s) => (etat.progression.parSection.get(s.id)?.pourcentage ?? 100) < 100
    );

    const actions = document.createElement('div');
    actions.className = 'accueil-demande__actions';
    const boutonReprendre = document.createElement('a');
    boutonReprendre.className = 'btn btn--primaire';
    boutonReprendre.href = premiereIncomplete
      ? `#/d/${reference}/s/${premiereIncomplete.id}`
      : `#/d/${reference}/recap`;
    boutonReprendre.textContent = premiereIncomplete ? 'Reprendre la saisie' : 'Vérifier et envoyer mes réponses';
    actions.appendChild(boutonReprendre);
    main.appendChild(actions);
  }

  main.appendChild(
    creerCarteListe(
      rendreLignesDocuments({
        reference,
        demande: etat.demande,
        reponses: [...etat.reponses.values()],
        noteEnvoyee,
        proposition,
        lignesProposition,
      })
    )
  );

  app.appendChild(main);
  if (window.lucide) window.lucide.createIcons();
}

const STATUTS_AVEC_CRENEAUX = new Set(['soumise', 'entretien_planifie']);

// Le récapitulatif reste un lien de navigation (pas voir/imprimer) : tant
// que la demande est modifiable, cette page sert à soumettre les réponses
// (bouton d'envoi, liens vers les questions manquantes), pas seulement à
// les consulter.
function rendreLignesDocuments({ reference, demande, reponses, noteEnvoyee, proposition, lignesProposition }) {
  const elements = [
    creerLigneNavigation({
      href: `#/d/${reference}/recap`,
      icone: 'clipboard-list',
      titre: 'Récapitulatif',
      sousTitre: 'Toutes vos réponses',
    }),
  ];

  if (STATUTS_AVEC_CRENEAUX.has(demande.statut)) {
    elements.push(
      creerLigneNavigation({
        href: `#/d/${reference}/creneaux`,
        icone: 'calendar-clock',
        titre: "Rendez-vous d'entretien",
      })
    );
  }

  if (noteEnvoyee) {
    const { corps } = separerAnnexeGlossaire(noteEnvoyee.contenu_md);
    elements.push(
      creerLigneDocument({
        titre: 'Note de cadrage',
        sousTitre: `Version ${noteEnvoyee.version} — ${LIBELLES_STATUT[noteEnvoyee.statut] || noteEnvoyee.statut}`,
        icone: 'file-text',
        contenuHtml: rendreMarkdown(injecterValidationDansCorps(corps, noteEnvoyee)),
      })
    );
  }

  if (proposition && proposition.statut !== 'brouillon') {
    const noeud = construireDevisImprimable({ demande, reponses, proposition, lignes: lignesProposition });
    elements.push(
      creerLigneDocument({
        titre: 'Proposition commerciale',
        icone: 'receipt',
        contenuHtml: noeud.innerHTML,
        classeCorps: 'devis-imprimable',
      })
    );
  }

  return elements;
}
