// Éditeur de note de cadrage - 01_ARCHITECTURE.md section 10.
import { obtenirDemandeParReference } from '../../services/demandes.js';
import { chargerQuestionnaire, chargerGlossaire, chargerGabaritCadrage } from '../../services/questionnaire.js';
import { chargerReponsesStaff } from '../../services/reponses.js';
import {
  listerVersions,
  creerNote,
  mettreAJourContenu,
  envoyerNote,
} from '../../services/notes-cadrage.js';
import { indexerGlossaire } from '../../engine/glossary.js';
import { calculerVisibilite } from '../../engine/conditions.js';
import { genererNoteCadrage } from '../../engine/template.js';
import { rendreMarkdown, separerAnnexeGlossaire } from '../../components/markdown.js';
import { rendreApercuSignature } from '../../components/signature.js';
import { afficherToast } from '../../components/toast.js';
import { creerBoutonRetour } from '../../components/bouton-retour.js';
import { getProfil } from '../../store.js';

const LIBELLES_STATUT_NOTE = {
  brouillon: 'Brouillon',
  envoyee: 'Envoyée au client',
  a_revoir: 'À revoir',
  validee: 'Validée',
};

export async function vueEditeurNote(reference) {
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><p>Chargement…</p></main>';

  try {
    const demande = await obtenirDemandeParReference(reference);
    if (!demande) {
      app.innerHTML = '<main class="conteneur"><h1>Demande introuvable</h1></main>';
      return;
    }

    const [questionnaire, glossaireTermes, gabaritMarkdown, reponses, versions] = await Promise.all([
      chargerQuestionnaire(demande.questionnaire_id),
      chargerGlossaire(demande.questionnaire_id),
      chargerGabaritCadrage(demande.questionnaire_id),
      chargerReponsesStaff(demande.id),
      listerVersions(demande.id),
    ]);

    const glossaireIndex = indexerGlossaire(glossaireTermes);
    const visibilite = calculerVisibilite(questionnaire, reponses);

    rendre({ demande, questionnaire, glossaireIndex, gabaritMarkdown, reponses, visibilite, versions });
  } catch (err) {
    afficherToast(err.message, { type: 'erreur' });
    app.innerHTML = '<main class="conteneur"><h1>Impossible de charger la note de cadrage</h1></main>';
  }
}

function genererDepuisContexte({ questionnaire, glossaireIndex, gabaritMarkdown, reponses, visibilite, demande }, version) {
  return genererNoteCadrage({
    gabaritMarkdown,
    meta: {
      reference: demande.reference,
      date: new Date().toLocaleDateString('fr-FR'),
      version,
      redacteur: getProfil()?.nom || getProfil()?.email || 'RD Formation',
    },
    questionnaire,
    reponses,
    visibilite,
    glossaireIndex,
  });
}

function rendre(contexte) {
  const { demande, versions } = contexte;
  const app = document.getElementById('app');
  app.innerHTML = '';
  const main = document.createElement('main');
  main.className = 'conteneur';

  main.appendChild(creerBoutonRetour(`#/demandes/${demande.reference}`, 'Retour à la demande'));

  const titre = document.createElement('h1');
  titre.textContent = `Note de cadrage — ${demande.reference}`;
  main.appendChild(titre);

  const derniere = versions[0] ?? null;

  if (!derniere) {
    main.appendChild(rendreGeneration(contexte));
  } else if (derniere.statut === 'brouillon') {
    main.appendChild(rendreEditeur(contexte, derniere));
  } else {
    main.appendChild(rendreLecture(derniere));
    if (derniere.statut === 'a_revoir') {
      main.appendChild(rendreNouvelleVersion(contexte, derniere));
    }
  }

  if (versions.length > 0) {
    main.appendChild(rendreHistorique(versions));
  }

  app.appendChild(main);
  if (window.lucide) window.lucide.createIcons();
}

function rendreGeneration(contexte) {
  const bloc = document.createElement('div');
  bloc.className = 'carte';
  const p = document.createElement('p');
  p.textContent = 'Aucune note de cadrage pour cette demande.';
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'btn btn--primaire';
  bouton.textContent = 'Générer la note';
  bouton.addEventListener('click', async () => {
    bouton.disabled = true;
    try {
      const contenu = genererDepuisContexte(contexte, 1);
      await creerNote(contexte.demande.id, contenu);
      vueEditeurNote(contexte.demande.reference);
    } catch (err) {
      afficherToast(err.message, { type: 'erreur' });
      bouton.disabled = false;
    }
  });
  bloc.append(p, bouton);
  return bloc;
}

function rendreEditeur(contexte, note) {
  const bloc = document.createElement('div');

  const grille = document.createElement('div');
  grille.className = 'editeur-note__grille';

  const colonneEdition = document.createElement('div');
  const textarea = document.createElement('textarea');
  textarea.className = 'champ-saisie champ-saisie--zone editeur-note__texte';
  textarea.value = note.contenu_md;
  colonneEdition.appendChild(textarea);
  const statutEnregistrement = document.createElement('p');
  statutEnregistrement.className = 'texte-doux';
  statutEnregistrement.textContent = 'Enregistré';
  colonneEdition.appendChild(statutEnregistrement);

  const colonneApercu = document.createElement('div');
  colonneApercu.className = 'editeur-note__apercu carte';
  colonneApercu.innerHTML = rendreMarkdown(textarea.value);

  let minuterie;
  textarea.addEventListener('input', () => {
    statutEnregistrement.textContent = 'Modifications non enregistrées…';
    colonneApercu.innerHTML = rendreMarkdown(textarea.value);
    clearTimeout(minuterie);
    minuterie = setTimeout(async () => {
      try {
        await mettreAJourContenu(note.id, textarea.value);
        statutEnregistrement.textContent = 'Enregistré';
      } catch (err) {
        statutEnregistrement.textContent = 'Échec de l’enregistrement';
        afficherToast(err.message, { type: 'erreur' });
      }
    }, 800);
  });

  grille.append(colonneEdition, colonneApercu);
  bloc.appendChild(grille);

  const actions = document.createElement('div');
  actions.className = 'editeur-note__actions';

  const boutonRegenerer = document.createElement('button');
  boutonRegenerer.type = 'button';
  boutonRegenerer.className = 'btn btn--secondaire';
  boutonRegenerer.textContent = 'Régénérer depuis les réponses';
  boutonRegenerer.addEventListener('click', async () => {
    if (!window.confirm('Remplacer le contenu actuel du brouillon par une régénération depuis les réponses ?')) return;
    const contenu = genererDepuisContexte(contexte, note.version);
    textarea.value = contenu;
    colonneApercu.innerHTML = rendreMarkdown(contenu);
    try {
      await mettreAJourContenu(note.id, contenu);
      afficherToast('Note régénérée.', { type: 'succes' });
    } catch (err) {
      afficherToast(err.message, { type: 'erreur' });
    }
  });

  const boutonEnvoyer = document.createElement('button');
  boutonEnvoyer.type = 'button';
  boutonEnvoyer.className = 'btn btn--primaire';
  boutonEnvoyer.textContent = 'Envoyer au client';
  boutonEnvoyer.addEventListener('click', async () => {
    boutonEnvoyer.disabled = true;
    try {
      await mettreAJourContenu(note.id, textarea.value);
      await envoyerNote(note.id, contexte.demande.id);
      afficherToast('Note envoyée au client.', { type: 'succes' });
      vueEditeurNote(contexte.demande.reference);
    } catch (err) {
      afficherToast(err.message, { type: 'erreur' });
      boutonEnvoyer.disabled = false;
    }
  });

  actions.append(boutonRegenerer, boutonEnvoyer);
  bloc.appendChild(actions);

  return bloc;
}

function rendreLecture(note) {
  const conteneur = document.createElement('div');

  const actionsHaut = document.createElement('div');
  actionsHaut.className = 'editeur-note__actions';
  const boutonImprimer = document.createElement('button');
  boutonImprimer.type = 'button';
  boutonImprimer.className = 'btn btn--secondaire';
  boutonImprimer.textContent = 'Exporter en PDF';
  boutonImprimer.addEventListener('click', () => window.print());
  actionsHaut.appendChild(boutonImprimer);
  conteneur.appendChild(actionsHaut);

  const documentNote = document.createElement('div');
  documentNote.className = 'editeur-note__document';

  const bloc = document.createElement('div');
  bloc.className = 'carte editeur-note__apercu';
  const statut = document.createElement('p');
  statut.className = 'texte-doux';
  statut.textContent = `Version ${note.version} — ${LIBELLES_STATUT_NOTE[note.statut] || note.statut}`;
  bloc.appendChild(statut);
  const { corps, annexe } = separerAnnexeGlossaire(note.contenu_md);
  const contenu = document.createElement('div');
  contenu.innerHTML = rendreMarkdown(corps);
  bloc.appendChild(contenu);
  documentNote.appendChild(bloc);

  if (annexe) {
    const blocGlossaire = document.createElement('div');
    blocGlossaire.className = 'carte editeur-note__apercu';
    blocGlossaire.innerHTML = rendreMarkdown(annexe);
    documentNote.appendChild(blocGlossaire);
  }

  if (note.signature_image) documentNote.appendChild(rendreApercuSignature(note.signature_image));

  conteneur.appendChild(documentNote);

  return conteneur;
}

function rendreNouvelleVersion(contexte, derniere) {
  const bloc = document.createElement('div');
  bloc.className = 'carte';
  const p = document.createElement('p');
  p.textContent = 'Le client a demandé une modification.';
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'btn btn--primaire';
  bouton.textContent = 'Créer la version suivante';
  bouton.addEventListener('click', async () => {
    bouton.disabled = true;
    try {
      await creerNote(contexte.demande.id, derniere.contenu_md);
      vueEditeurNote(contexte.demande.reference);
    } catch (err) {
      afficherToast(err.message, { type: 'erreur' });
      bouton.disabled = false;
    }
  });
  bloc.append(p, bouton);
  return bloc;
}

function rendreHistorique(versions) {
  const bloc = document.createElement('section');
  bloc.className = 'carte';
  const h2 = document.createElement('h2');
  h2.textContent = 'Historique des versions';
  bloc.appendChild(h2);
  const liste = document.createElement('ul');
  for (const v of versions) {
    const li = document.createElement('li');
    li.textContent = `Version ${v.version} — ${LIBELLES_STATUT_NOTE[v.statut] || v.statut}`;
    liste.appendChild(li);
  }
  bloc.appendChild(liste);
  return bloc;
}
