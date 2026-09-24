// Lecture et validation de la note de cadrage côté client - section 4.1.
import { obtenirDemandeParReference } from '../../services/demandes.js';
import { listerVersions, validerNote, demanderModification } from '../../services/notes-cadrage.js';
import { rendreMarkdown, separerAnnexeGlossaire } from '../../components/markdown.js';
import { ouvrirModaleSignature, rendreApercuSignature } from '../../components/signature.js';
import { afficherToast } from '../../components/toast.js';
import { creerBoutonRetour } from '../../components/bouton-retour.js';
import { navigate } from '../../router.js';

export async function vueCadrageClient(reference) {
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><p>Chargement…</p></main>';

  try {
    const demande = await obtenirDemandeParReference(reference);
    if (!demande) {
      app.innerHTML = '<main class="conteneur"><h1>Demande introuvable</h1></main>';
      return;
    }

    const versions = await listerVersions(demande.id);
    const derniere = versions[0] ?? null;
    if (!derniere || derniere.statut === 'brouillon') {
      app.innerHTML =
        '<main class="conteneur"><h1>Note de cadrage</h1><p>La note de cadrage n’est pas encore disponible.</p></main>';
      return;
    }

    rendre(demande, derniere);
  } catch (err) {
    afficherToast(err.message, { type: 'erreur' });
    app.innerHTML = '<main class="conteneur"><h1>Impossible de charger la note de cadrage</h1></main>';
  }
}

function rendre(demande, note) {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const main = document.createElement('main');
  main.className = 'conteneur';

  main.appendChild(creerBoutonRetour(`#/d/${demande.reference}`, 'Retour à la demande'));

  const titre = document.createElement('h1');
  titre.textContent = 'Note de cadrage';
  main.appendChild(titre);

  const actionsHaut = document.createElement('div');
  actionsHaut.className = 'editeur-note__actions';
  const boutonImprimer = document.createElement('button');
  boutonImprimer.type = 'button';
  boutonImprimer.className = 'btn btn--secondaire';
  boutonImprimer.textContent = 'Exporter en PDF';
  boutonImprimer.addEventListener('click', () => window.print());
  actionsHaut.appendChild(boutonImprimer);
  main.appendChild(actionsHaut);

  const { corps, annexe } = separerAnnexeGlossaire(note.contenu_md);

  const contenu = document.createElement('div');
  contenu.className = 'carte editeur-note__apercu';
  contenu.innerHTML = rendreMarkdown(corps);
  main.appendChild(contenu);

  if (annexe) {
    const carteGlossaire = document.createElement('div');
    carteGlossaire.className = 'carte editeur-note__apercu';
    carteGlossaire.innerHTML = rendreMarkdown(annexe);
    main.appendChild(carteGlossaire);
  }

  if (note.statut === 'validee') {
    const info = document.createElement('p');
    info.className = 'texte-doux';
    info.textContent = `Note validée le ${new Date(note.validee_le).toLocaleDateString('fr-FR')}.`;
    main.appendChild(info);
    if (note.signature_image) main.appendChild(rendreApercuSignature(note.signature_image));
  } else if (note.statut === 'envoyee') {
    main.appendChild(rendreActions(demande, note));
  } else if (note.statut === 'a_revoir') {
    const info = document.createElement('p');
    info.className = 'texte-doux';
    info.textContent = 'Modification demandée — RD Formation prépare une nouvelle version.';
    main.appendChild(info);
  }

  app.appendChild(main);
  if (window.lucide) window.lucide.createIcons();
}

function rendreActions(demande, note) {
  const bloc = document.createElement('div');
  bloc.className = 'carte cadrage-actions';

  const boutonValider = document.createElement('button');
  boutonValider.type = 'button';
  boutonValider.className = 'btn btn--primaire';
  boutonValider.textContent = 'Valider la note';
  boutonValider.addEventListener('click', () => {
    ouvrirModaleSignature({
      onValider: async (signatureImage) => {
        try {
          await validerNote(note.id, signatureImage);
          afficherToast('Note validée. Merci !', { type: 'succes' });
          navigate(`/d/${demande.reference}`);
          return true;
        } catch (err) {
          afficherToast(err.message, { type: 'erreur' });
          return false;
        }
      },
    });
  });

  const formModif = document.createElement('form');
  const texte = document.createElement('textarea');
  texte.className = 'champ-saisie champ-saisie--zone';
  texte.placeholder = 'Expliquez ce qui doit être modifié…';
  texte.required = true;
  const boutonModifier = document.createElement('button');
  boutonModifier.type = 'submit';
  boutonModifier.className = 'btn btn--secondaire';
  boutonModifier.textContent = 'Demander une modification';
  formModif.append(texte, boutonModifier);
  formModif.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    boutonModifier.disabled = true;
    try {
      await demanderModification(note.id, texte.value);
      afficherToast('Demande de modification envoyée.', { type: 'succes' });
      navigate(`/d/${demande.reference}`);
    } catch (err) {
      afficherToast(err.message, { type: 'erreur' });
      boutonModifier.disabled = false;
    }
  });

  bloc.append(boutonValider, formModif);
  return bloc;
}
