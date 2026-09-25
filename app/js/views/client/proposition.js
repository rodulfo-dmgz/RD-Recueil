// Lecture et décision sur la proposition commerciale côté client.
import { obtenirDemandeParReference } from '../../services/demandes.js';
import { chargerReponses } from '../../services/reponses.js';
import { obtenirProposition, listerLignes, accepterProposition, refuserProposition } from '../../services/propositions.js';
import { construireDevisImprimable } from '../../components/devis-imprimable.js';
import { ouvrirModaleSignature } from '../../components/signature.js';
import { afficherToast } from '../../components/toast.js';
import { creerBoutonRetour } from '../../components/bouton-retour.js';
import { navigate } from '../../router.js';

export async function vuePropositionClient(reference) {
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><p>Chargement…</p></main>';

  try {
    const demande = await obtenirDemandeParReference(reference);
    if (!demande) {
      app.innerHTML = '<main class="conteneur"><h1>Demande introuvable</h1></main>';
      return;
    }

    const proposition = await obtenirProposition(demande.id);
    if (!proposition || proposition.statut === 'brouillon') {
      app.innerHTML =
        '<main class="conteneur"><h1>Proposition commerciale</h1><p>La proposition n’est pas encore disponible.</p></main>';
      return;
    }
    const [lignes, reponses] = await Promise.all([listerLignes(proposition.id), chargerReponses(demande.id)]);

    rendre(demande, proposition, lignes, reponses);
  } catch (err) {
    afficherToast(err.message, { type: 'erreur' });
    app.innerHTML = '<main class="conteneur"><h1>Impossible de charger la proposition</h1></main>';
  }
}

function rendre(demande, proposition, lignes, reponses) {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const main = document.createElement('main');
  main.className = 'conteneur';

  main.appendChild(creerBoutonRetour(`#/d/${demande.reference}`, 'Retour à la demande'));

  const titre = document.createElement('h1');
  titre.textContent = 'Proposition commerciale';
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

  main.appendChild(construireDevisImprimable({ demande, reponses, proposition, lignes }));

  if (proposition.statut === 'envoyee') {
    main.appendChild(rendreActions(demande, proposition));
  } else if (proposition.statut === 'acceptee') {
    const info = document.createElement('p');
    info.className = 'texte-doux';
    info.textContent = `Proposition acceptée le ${new Date(proposition.decidee_le).toLocaleDateString('fr-FR')}.`;
    main.appendChild(info);
  } else if (proposition.statut === 'refusee') {
    const info = document.createElement('p');
    info.className = 'texte-doux';
    info.textContent = `Proposition refusée le ${new Date(proposition.decidee_le).toLocaleDateString('fr-FR')}.`;
    main.appendChild(info);
  }

  app.appendChild(main);
  if (window.lucide) window.lucide.createIcons();
}

function rendreActions(demande, proposition) {
  const bloc = document.createElement('div');
  bloc.className = 'carte cadrage-actions';

  const boutonAccepter = document.createElement('button');
  boutonAccepter.type = 'button';
  boutonAccepter.className = 'btn btn--primaire';
  boutonAccepter.textContent = 'Accepter la proposition';
  boutonAccepter.addEventListener('click', () => {
    ouvrirModaleSignature({
      onValider: async (signatureImage) => {
        try {
          await accepterProposition(proposition.id, signatureImage);
          afficherToast('Proposition acceptée. Merci !', { type: 'succes' });
          navigate(`/d/${demande.reference}`);
          return true;
        } catch (err) {
          afficherToast(err.message, { type: 'erreur' });
          return false;
        }
      },
    });
  });

  const formRefus = document.createElement('form');
  const texte = document.createElement('textarea');
  texte.className = 'champ-saisie champ-saisie--zone';
  texte.placeholder = 'Expliquez le motif du refus (facultatif)…';
  const boutonRefuser = document.createElement('button');
  boutonRefuser.type = 'submit';
  boutonRefuser.className = 'btn btn--secondaire';
  boutonRefuser.textContent = 'Refuser la proposition';
  formRefus.append(texte, boutonRefuser);
  formRefus.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    if (!window.confirm('Confirmer le refus de cette proposition ?')) return;
    boutonRefuser.disabled = true;
    try {
      await refuserProposition(proposition.id, texte.value || null);
      afficherToast('Proposition refusée.', { type: 'succes' });
      navigate(`/d/${demande.reference}`);
    } catch (err) {
      afficherToast(err.message, { type: 'erreur' });
      boutonRefuser.disabled = false;
    }
  });

  bloc.append(boutonAccepter, formRefus);
  return bloc;
}
