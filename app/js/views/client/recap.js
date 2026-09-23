import { getEtatDemande } from '../../store.js';
import { soumettre } from '../../services/demandes.js';
import { afficherToast } from '../../components/toast.js';
import { navigate } from '../../router.js';

function estVide(reponse) {
  if (!reponse || reponse.nsp) return false;
  const v = reponse.valeur;
  return v == null || v === '' || (Array.isArray(v) && v.length === 0);
}

function formaterValeur(question, reponse) {
  if (!reponse) return '—';
  if (reponse.nsp) return 'Je ne sais pas / à définir ensemble';
  const v = reponse.valeur;
  if (v == null || v === '') return '—';

  if (Array.isArray(v)) {
    if (v.length === 0) return '—';
    if (typeof v[0] === 'object') return `${v.length} ligne(s)`;
    const libelles = v.map(
      (val) => question.options?.find((o) => o.valeur === val)?.libelle?.replace(/\\\*/g, '') ?? val
    );
    return libelles.join(', ');
  }
  if (typeof v === 'object') return Object.values(v).filter(Boolean).join(', ');
  if (question.type === 'choix_unique') {
    return question.options?.find((o) => o.valeur === v)?.libelle?.replace(/\\\*/g, '') ?? v;
  }
  return String(v);
}

export function vueRecap(reference) {
  const etat = getEtatDemande();
  if (!etat || etat.demande.reference !== reference) {
    navigate(`/d/${reference}`);
    return;
  }
  rendre();

  function rendre() {
    const app = document.getElementById('app');
    app.innerHTML = '';
    const main = document.createElement('main');
    main.className = 'conteneur';

    const retour = document.createElement('a');
    retour.href = `#/d/${reference}`;
    retour.textContent = '← Retour à la demande';
    main.appendChild(retour);

    const titre = document.createElement('h1');
    titre.textContent = 'Récapitulatif';
    main.appendChild(titre);

    const sections = etat.questionnaire.sections
      .filter((s) => etat.visibilite.sectionsVisibles.has(s.id) && s.partie !== 3)
      .sort((a, b) => a.ordre - b.ordre);

    const manquantes = [];

    for (const section of sections) {
      const questions = etat.questionnaire.questions
        .filter(
          (q) => q.section === section.id && etat.visibilite.questionsVisibles.has(q.id) && q.rempli_par !== 'F'
        )
        .sort((a, b) => a.ordre - b.ordre);
      if (questions.length === 0) continue;

      const blocSection = document.createElement('section');
      blocSection.className = 'carte recap-section';
      const titreSection = document.createElement('h2');
      titreSection.textContent = section.titre;
      blocSection.appendChild(titreSection);

      const liste = document.createElement('dl');
      for (const question of questions) {
        const reponse = etat.reponses.get(question.id);
        const vide = estVide(reponse);
        if (question.obligatoire && vide) {
          manquantes.push({ question, section });
        }

        const dt = document.createElement('dt');
        dt.textContent = question.libelle.replace(/\\\*/g, '');
        const dd = document.createElement('dd');
        dd.textContent = formaterValeur(question, reponse);
        if (question.obligatoire && vide) dd.classList.add('recap-section__manquant');
        liste.append(dt, dd);
      }
      blocSection.appendChild(liste);
      main.appendChild(blocSection);
    }

    if (manquantes.length > 0) {
      const alerte = document.createElement('div');
      alerte.className = 'carte recap-manquantes';
      const titreAlerte = document.createElement('h2');
      titreAlerte.textContent = `${manquantes.length} question(s) obligatoire(s) sans réponse`;
      alerte.appendChild(titreAlerte);
      const listeManquantes = document.createElement('ul');
      for (const { question, section } of manquantes) {
        const li = document.createElement('li');
        const lien = document.createElement('a');
        lien.href = `#/d/${reference}/s/${section.id}`;
        lien.textContent = question.libelle.replace(/\\\*/g, '');
        li.appendChild(lien);
        listeManquantes.appendChild(li);
      }
      alerte.appendChild(listeManquantes);
      main.appendChild(alerte);
    }

    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'btn btn--primaire';
    bouton.textContent = 'Envoyer mes réponses';
    bouton.disabled = manquantes.length > 0;
    bouton.addEventListener('click', async () => {
      bouton.disabled = true;
      try {
        await soumettre(etat.demande.id);
        afficherToast('Réponses envoyées. Merci !', { type: 'succes' });
        navigate(`/d/${reference}`);
      } catch (err) {
        afficherToast(err.message, { type: 'erreur' });
        bouton.disabled = false;
      }
    });
    main.appendChild(bouton);

    app.appendChild(main);
  }
}
