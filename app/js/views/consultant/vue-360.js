import { obtenirDemandeParReference, changerStatut, inviterClient, relancerClient } from '../../services/demandes.js';
import { chargerQuestionnaire, chargerGlossaire } from '../../services/questionnaire.js';
import { chargerReponsesStaff } from '../../services/reponses.js';
import { listerFichiers } from '../../services/fichiers.js';
import { chargerCommentaires, posterCommentaire } from '../../services/commentaires.js';
import { chargerJournal } from '../../services/evenements.js';
import { obtenirAcces } from '../../services/demande-acces.js';
import { indexerGlossaire } from '../../engine/glossary.js';
import { calculerVisibilite } from '../../engine/conditions.js';
import { afficherToast } from '../../components/toast.js';
import { initGlossaryTooltip } from '../../components/glossary-tooltip.js';
import { rendreReponsesParSection, rendreJournal } from '../../components/lecture-demande.js';

const TRANSITIONS = {
  soumise: [
    { vers: 'entretien_planifie', libelle: 'Planifier l’entretien' },
    { vers: 'en_saisie', libelle: 'Réouvrir la saisie' },
  ],
  en_analyse: [{ vers: 'reorientee', libelle: 'Passer en réorientée' }],
};
const STATUTS_FINAUX = new Set(['gagnee', 'perdue', 'reorientee', 'abandonnee']);
const STATUTS_AVEC_CADRAGE = new Set([
  'en_analyse',
  'cadrage_envoye',
  'cadrage_a_revoir',
  'cadrage_valide',
  'proposition_envoyee',
]);

export async function vueVue360(reference) {
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><p>Chargement…</p></main>';

  try {
    const demande = await obtenirDemandeParReference(reference);
    if (!demande) {
      app.innerHTML = '<main class="conteneur"><h1>Demande introuvable</h1></main>';
      return;
    }

    const [questionnaire, glossaireTermes, reponses, fichiers, commentaires, journal, acces] = await Promise.all([
      chargerQuestionnaire(demande.questionnaire_id),
      chargerGlossaire(demande.questionnaire_id),
      chargerReponsesStaff(demande.id),
      listerFichiers(demande.id),
      chargerCommentaires(demande.id),
      chargerJournal(demande.id),
      obtenirAcces(demande.id),
    ]);

    const glossaireIndex = indexerGlossaire(glossaireTermes);
    initGlossaryTooltip(glossaireIndex);
    const visibilite = calculerVisibilite(questionnaire, reponses);

    rendre({ demande, questionnaire, reponses, fichiers, commentaires, journal, visibilite, acces });
  } catch (err) {
    afficherToast(err.message, { type: 'erreur' });
    app.innerHTML = '<main class="conteneur"><h1>Impossible de charger la demande</h1></main>';
  }
}

function rendre({ demande, questionnaire, reponses, fichiers, commentaires, journal, visibilite, acces }) {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const main = document.createElement('main');
  main.className = 'conteneur';

  const retour = document.createElement('a');
  retour.href = '#/tableau-de-bord';
  retour.textContent = '← Retour au tableau de bord';
  main.appendChild(retour);

  const titre = document.createElement('h1');
  titre.textContent = `${demande.reference} — ${demande.statut}`;
  main.appendChild(titre);

  main.appendChild(rendreActions(demande));

  if (demande.statut === 'brouillon') {
    main.appendChild(rendreInvitation(demande));
  } else if (['envoyee', 'en_saisie'].includes(demande.statut) && acces.length > 0) {
    main.appendChild(rendreRelance(demande, acces));
  }

  const nsp = reponses.filter((r) => r.nsp && visibilite.questionsVisibles.has(r.question_id));
  if (nsp.length > 0) {
    main.appendChild(rendreListeAlerte(`${nsp.length} point(s) à définir en entretien`, nsp, questionnaire));
  }

  main.appendChild(rendreReponsesParSection(questionnaire, reponses, visibilite));
  main.appendChild(rendreFichiers(fichiers));
  main.appendChild(rendreCommentaires(demande, commentaires));
  main.appendChild(rendreJournal(journal));

  app.appendChild(main);
}

function rendreActions(demande) {
  const actions = document.createElement('div');
  actions.className = 'vue360__actions';

  for (const t of TRANSITIONS[demande.statut] || []) {
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'btn btn--secondaire';
    bouton.textContent = t.libelle;
    bouton.addEventListener('click', () => transitionner(demande, t.vers));
    actions.appendChild(bouton);
  }

  if (demande.statut === 'soumise' || demande.statut === 'entretien_planifie') {
    const lienEntretien = document.createElement('a');
    lienEntretien.className = 'btn btn--primaire';
    lienEntretien.href = `#/demandes/${demande.reference}/entretien`;
    lienEntretien.textContent = 'Mode entretien';
    actions.appendChild(lienEntretien);
  }

  if (STATUTS_AVEC_CADRAGE.has(demande.statut)) {
    const lienNote = document.createElement('a');
    lienNote.className = 'btn btn--primaire';
    lienNote.href = `#/demandes/${demande.reference}/cadrage`;
    lienNote.textContent = 'Note de cadrage';
    actions.appendChild(lienNote);
  }

  const lienPreuves = document.createElement('a');
  lienPreuves.className = 'btn btn--secondaire';
  lienPreuves.href = `#/demandes/${demande.reference}/preuves`;
  lienPreuves.textContent = 'Dossier de preuves';
  actions.appendChild(lienPreuves);

  if (!STATUTS_FINAUX.has(demande.statut)) {
    const abandonner = document.createElement('button');
    abandonner.type = 'button';
    abandonner.className = 'btn btn--secondaire';
    abandonner.textContent = 'Abandonner';
    abandonner.addEventListener('click', () => {
      if (window.confirm('Confirmer l’abandon de cette demande ?')) transitionner(demande, 'abandonnee');
    });
    actions.appendChild(abandonner);
  }

  return actions;
}

function rendreInvitation(demande) {
  const form = document.createElement('form');
  form.className = 'carte';
  const h2 = document.createElement('h2');
  h2.textContent = 'Inviter le client';
  const inputEmail = document.createElement('input');
  inputEmail.type = 'email';
  inputEmail.className = 'champ-saisie';
  inputEmail.placeholder = 'e-mail du contact';
  inputEmail.required = true;
  const bouton = document.createElement('button');
  bouton.type = 'submit';
  bouton.className = 'btn btn--primaire';
  bouton.textContent = 'Envoyer l’invitation';
  form.append(h2, inputEmail, bouton);

  const resultat = document.createElement('div');
  resultat.className = 'carte creation-compte__resultat';
  resultat.hidden = true;

  form.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    bouton.disabled = true;
    try {
      const { email, motDePasseTemporaire, compteExistant } = await inviterClient(demande.id, inputEmail.value);
      resultat.hidden = false;
      resultat.innerHTML = compteExistant
        ? `<p>${email} a déjà un compte : accès à cette demande accordé, aucun nouveau mot de passe à communiquer.</p>`
        : `
          <p>Communiquez ces identifiants au client par un canal sûr :</p>
          <p><strong>E-mail :</strong> ${email}</p>
          <p><strong>Mot de passe temporaire :</strong> <code>${motDePasseTemporaire}</code></p>
          <p class="texte-doux">Un changement de mot de passe sera exigé à la première connexion.</p>
        `;
      afficherToast('Accès créé.', { type: 'succes' });
      form.reset();
      bouton.disabled = false;
    } catch (err) {
      afficherToast(err.message, { type: 'erreur' });
      bouton.disabled = false;
    }
  });

  const conteneur = document.createElement('div');
  conteneur.append(form, resultat);
  return conteneur;
}

function rendreRelance(demande, acces) {
  const bloc = document.createElement('div');
  bloc.className = 'carte';
  const h2 = document.createElement('h2');
  h2.textContent = 'Relancer le client';
  bloc.appendChild(h2);

  const liste = document.createElement('ul');
  liste.className = 'liste-demandes';
  for (const a of acces) {
    const li = document.createElement('li');
    li.className = 'relance-ligne';
    const email = document.createElement('span');
    email.textContent = a.email;
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'btn btn--secondaire';
    bouton.textContent = 'Noter une relance';
    bouton.addEventListener('click', async () => {
      bouton.disabled = true;
      try {
        await relancerClient(demande.id, a.email);
        afficherToast(`Relance journalisée pour ${a.email}.`, { type: 'succes' });
      } catch (err) {
        afficherToast(err.message, { type: 'erreur' });
      } finally {
        bouton.disabled = false;
      }
    });
    li.append(email, bouton);
    liste.appendChild(li);
  }
  bloc.appendChild(liste);
  return bloc;
}

function rendreListeAlerte(titreTexte, reponsesAlerte, questionnaire) {
  const bloc = document.createElement('div');
  bloc.className = 'carte recap-manquantes';
  const h2 = document.createElement('h2');
  h2.textContent = titreTexte;
  bloc.appendChild(h2);
  const liste = document.createElement('ul');
  for (const r of reponsesAlerte) {
    const q = questionnaire.questions.find((qq) => qq.id === r.question_id);
    const li = document.createElement('li');
    li.textContent = q ? q.libelle.replace(/\\\*/g, '') : r.question_id;
    liste.appendChild(li);
  }
  bloc.appendChild(liste);
  return bloc;
}

function rendreFichiers(fichiers) {
  const bloc = document.createElement('section');
  bloc.className = 'carte';
  const h2 = document.createElement('h2');
  h2.textContent = `Fichiers (${fichiers.length})`;
  bloc.appendChild(h2);
  const liste = document.createElement('ul');
  if (fichiers.length === 0) {
    liste.innerHTML = '<li class="texte-doux">Aucun fichier déposé.</li>';
  }
  for (const f of fichiers) {
    const li = document.createElement('li');
    li.textContent = f.nom;
    liste.appendChild(li);
  }
  bloc.appendChild(liste);
  return bloc;
}

function rendreCommentaires(demande, commentaires) {
  const bloc = document.createElement('section');
  bloc.className = 'carte';
  const h2 = document.createElement('h2');
  h2.textContent = 'Commentaires';
  bloc.appendChild(h2);

  const liste = document.createElement('ul');
  if (commentaires.length === 0) {
    liste.innerHTML = '<li class="texte-doux">Aucun commentaire.</li>';
  }
  for (const c of commentaires) {
    const li = document.createElement('li');
    li.textContent = `${c.interne ? '[interne] ' : ''}${c.texte}`;
    liste.appendChild(li);
  }
  bloc.appendChild(liste);

  const form = document.createElement('form');
  const texte = document.createElement('textarea');
  texte.className = 'champ-saisie champ-saisie--zone';
  texte.placeholder = 'Ajouter un commentaire…';
  const interneLabel = document.createElement('label');
  interneLabel.className = 'champ-question__nsp';
  const interneInput = document.createElement('input');
  interneInput.type = 'checkbox';
  interneLabel.append(interneInput, ' Commentaire interne (invisible du client)');
  const bouton = document.createElement('button');
  bouton.type = 'submit';
  bouton.className = 'btn btn--secondaire';
  bouton.textContent = 'Ajouter';
  form.append(texte, interneLabel, bouton);

  form.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    if (!texte.value.trim()) return;
    bouton.disabled = true;
    try {
      await posterCommentaire(demande.id, { cible: 'general', texte: texte.value, interne: interneInput.checked });
      vueVue360(demande.reference);
    } catch (err) {
      afficherToast(err.message, { type: 'erreur' });
      bouton.disabled = false;
    }
  });

  bloc.appendChild(form);
  return bloc;
}

async function transitionner(demande, vers) {
  try {
    await changerStatut(demande.id, vers);
    afficherToast('Statut mis à jour.', { type: 'succes' });
    vueVue360(demande.reference);
  } catch (err) {
    afficherToast(err.message, { type: 'erreur' });
  }
}
