// Dossier de preuves Qualiopi (version V1 simplifiée : page imprimable par
// demande - 01_ARCHITECTURE.md section 11 ; l'export combiné multi-demandes
// est marqué V2 dans la spec).
import { obtenirDemandeParReference } from '../../services/demandes.js';
import { chargerQuestionnaire, chargerGlossaire } from '../../services/questionnaire.js';
import { chargerReponsesStaff } from '../../services/reponses.js';
import { chargerJournal } from '../../services/evenements.js';
import { listerVersions } from '../../services/notes-cadrage.js';
import { indexerGlossaire } from '../../engine/glossary.js';
import { calculerVisibilite } from '../../engine/conditions.js';
import { rendreReponsesParSection, rendreJournal } from '../../components/lecture-demande.js';
import { rendreMarkdown } from '../../components/markdown.js';
import { afficherToast } from '../../components/toast.js';

export async function vuePreuves(reference) {
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><p>Chargement…</p></main>';

  try {
    const demande = await obtenirDemandeParReference(reference);
    if (!demande) {
      app.innerHTML = '<main class="conteneur"><h1>Demande introuvable</h1></main>';
      return;
    }

    const [questionnaire, glossaireTermes, reponses, journal, versions] = await Promise.all([
      chargerQuestionnaire(demande.questionnaire_id),
      chargerGlossaire(demande.questionnaire_id),
      chargerReponsesStaff(demande.id),
      chargerJournal(demande.id),
      listerVersions(demande.id),
    ]);

    const glossaireIndex = indexerGlossaire(glossaireTermes);
    const visibilite = calculerVisibilite(questionnaire, reponses);
    const noteValidee = versions.find((v) => v.statut === 'validee') ?? null;

    rendre({ demande, questionnaire, reponses, journal, visibilite, noteValidee });
  } catch (err) {
    afficherToast(err.message, { type: 'erreur' });
    app.innerHTML = '<main class="conteneur"><h1>Impossible de charger le dossier de preuves</h1></main>';
  }
}

function rendre({ demande, questionnaire, reponses, journal, visibilite, noteValidee }) {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const main = document.createElement('main');
  main.className = 'conteneur';

  const retour = document.createElement('a');
  retour.href = `#/demandes/${demande.reference}`;
  retour.textContent = '← Retour à la demande';
  main.appendChild(retour);

  const actionsHaut = document.createElement('div');
  actionsHaut.className = 'editeur-note__actions';
  const boutonImprimer = document.createElement('button');
  boutonImprimer.type = 'button';
  boutonImprimer.className = 'btn btn--secondaire';
  boutonImprimer.textContent = 'Exporter en PDF';
  boutonImprimer.addEventListener('click', () => window.print());
  actionsHaut.appendChild(boutonImprimer);
  main.appendChild(actionsHaut);

  const imprimable = document.createElement('div');
  imprimable.className = 'imprimable';

  const titre = document.createElement('h1');
  titre.textContent = `Dossier de preuves — ${demande.reference}`;
  imprimable.appendChild(titre);

  const meta = document.createElement('p');
  meta.className = 'texte-doux';
  meta.textContent = `Statut : ${demande.statut} · Généré le ${new Date().toLocaleDateString('fr-FR')}`;
  imprimable.appendChild(meta);

  const titreReponses = document.createElement('h2');
  titreReponses.textContent = 'Réponses au questionnaire';
  imprimable.appendChild(titreReponses);
  imprimable.appendChild(rendreReponsesParSection(questionnaire, reponses, visibilite));

  const titreNote = document.createElement('h2');
  titreNote.textContent = 'Note de cadrage validée';
  imprimable.appendChild(titreNote);
  if (noteValidee) {
    const contenu = document.createElement('div');
    contenu.className = 'carte';
    const infoValidation = document.createElement('p');
    infoValidation.className = 'texte-doux';
    infoValidation.textContent = `Version ${noteValidee.version} — validée le ${new Date(noteValidee.validee_le).toLocaleDateString('fr-FR')}`;
    contenu.appendChild(infoValidation);
    const rendu = document.createElement('div');
    rendu.innerHTML = rendreMarkdown(noteValidee.contenu_md);
    contenu.appendChild(rendu);
    imprimable.appendChild(contenu);
  } else {
    const aucune = document.createElement('p');
    aucune.className = 'texte-doux';
    aucune.textContent = 'Aucune note de cadrage validée pour cette demande.';
    imprimable.appendChild(aucune);
  }

  imprimable.appendChild(rendreJournal(journal));

  main.appendChild(imprimable);
  app.appendChild(main);
}
