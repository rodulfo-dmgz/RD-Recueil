// Éditeur de proposition commerciale (devis) - 01_ARCHITECTURE.md section 15.
import { obtenirDemandeParReference } from '../../services/demandes.js';
import {
  obtenirProposition,
  listerLignes,
  creerProposition,
  mettreAJourJustification,
  remplacerLignes,
  envoyerProposition,
} from '../../services/propositions.js';
import { calculerTotalLigne, calculerTotalDevis } from '../../engine/devis.js';
import { rendreMarkdown } from '../../components/markdown.js';
import { afficherToast } from '../../components/toast.js';
import { creerBoutonRetour } from '../../components/bouton-retour.js';

const LIBELLES_STATUT_PROPOSITION = {
  brouillon: 'Brouillon',
  envoyee: 'Envoyée au client',
  acceptee: 'Acceptée',
  refusee: 'Refusée',
};

function formaterMontant(montant) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(montant || 0);
}

export async function vueEditeurProposition(reference) {
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><p>Chargement…</p></main>';

  try {
    const demande = await obtenirDemandeParReference(reference);
    if (!demande) {
      app.innerHTML = '<main class="conteneur"><h1>Demande introuvable</h1></main>';
      return;
    }

    const proposition = await obtenirProposition(demande.id);
    const lignes = proposition ? await listerLignes(proposition.id) : [];

    rendre({ demande, proposition, lignes });
  } catch (err) {
    afficherToast(err.message, { type: 'erreur' });
    app.innerHTML = '<main class="conteneur"><h1>Impossible de charger la proposition</h1></main>';
  }
}

function rendre({ demande, proposition, lignes }) {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const main = document.createElement('main');
  main.className = 'conteneur';

  main.appendChild(creerBoutonRetour(`#/demandes/${demande.reference}`, 'Retour à la demande'));

  const titre = document.createElement('h1');
  titre.textContent = `Proposition commerciale — ${demande.reference}`;
  main.appendChild(titre);

  if (!proposition) {
    main.appendChild(rendreGeneration(demande));
  } else if (proposition.statut === 'brouillon') {
    main.appendChild(rendreEditeur(demande, proposition, lignes));
  } else {
    main.appendChild(rendreLecture(proposition, lignes));
  }

  app.appendChild(main);
  if (window.lucide) window.lucide.createIcons();
}

function rendreGeneration(demande) {
  const bloc = document.createElement('div');
  bloc.className = 'carte';
  const p = document.createElement('p');
  p.textContent = 'Aucune proposition pour cette demande.';
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'btn btn--primaire';
  bouton.textContent = 'Créer la proposition';
  bouton.addEventListener('click', async () => {
    bouton.disabled = true;
    try {
      await creerProposition(demande.id);
      vueEditeurProposition(demande.reference);
    } catch (err) {
      afficherToast(err.message, { type: 'erreur' });
      bouton.disabled = false;
    }
  });
  bloc.append(p, bouton);
  return bloc;
}

function rendreEditeur(demande, proposition, lignesInitiales) {
  const bloc = document.createElement('div');
  const lignes = lignesInitiales.map((l) => ({ ...l }));

  const sectionDevis = document.createElement('div');
  sectionDevis.className = 'carte champ-tableau';
  const h2Devis = document.createElement('h2');
  h2Devis.textContent = 'Devis';
  sectionDevis.appendChild(h2Devis);

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Désignation</th><th>Quantité</th><th>Prix unitaire</th><th>Total</th><th></th></tr>';
  const tbody = document.createElement('tbody');
  table.append(thead, tbody);
  sectionDevis.appendChild(table);

  const totalGeneral = document.createElement('p');
  totalGeneral.className = 'devis-total';
  sectionDevis.appendChild(totalGeneral);

  let minuterieLignes;
  function sauvegarderLignes() {
    clearTimeout(minuterieLignes);
    minuterieLignes = setTimeout(async () => {
      try {
        await remplacerLignes(proposition.id, lignes);
      } catch (err) {
        afficherToast(err.message, { type: 'erreur' });
      }
    }, 800);
  }

  function rafraichirTotal() {
    totalGeneral.textContent = `Total : ${formaterMontant(calculerTotalDevis(lignes))}`;
  }

  function rendreLigne(ligne, index) {
    const tr = document.createElement('tr');

    const tdDesignation = document.createElement('td');
    const inputDesignation = document.createElement('input');
    inputDesignation.className = 'champ-saisie';
    inputDesignation.value = ligne.designation || '';
    inputDesignation.placeholder = 'Ex. Animation de la formation (3 jours)';
    inputDesignation.addEventListener('input', () => {
      ligne.designation = inputDesignation.value;
      sauvegarderLignes();
    });
    tdDesignation.appendChild(inputDesignation);

    const tdQuantite = document.createElement('td');
    const inputQuantite = document.createElement('input');
    inputQuantite.type = 'number';
    inputQuantite.min = '0';
    inputQuantite.step = 'any';
    inputQuantite.className = 'champ-saisie';
    inputQuantite.value = ligne.quantite ?? 1;
    inputQuantite.addEventListener('input', () => {
      ligne.quantite = Number(inputQuantite.value);
      tdTotal.textContent = formaterMontant(calculerTotalLigne(ligne));
      rafraichirTotal();
      sauvegarderLignes();
    });
    tdQuantite.appendChild(inputQuantite);

    const tdPrix = document.createElement('td');
    const inputPrix = document.createElement('input');
    inputPrix.type = 'number';
    inputPrix.min = '0';
    inputPrix.step = 'any';
    inputPrix.className = 'champ-saisie';
    inputPrix.value = ligne.prix_unitaire ?? 0;
    inputPrix.addEventListener('input', () => {
      ligne.prix_unitaire = Number(inputPrix.value);
      tdTotal.textContent = formaterMontant(calculerTotalLigne(ligne));
      rafraichirTotal();
      sauvegarderLignes();
    });
    tdPrix.appendChild(inputPrix);

    const tdTotal = document.createElement('td');
    tdTotal.textContent = formaterMontant(calculerTotalLigne(ligne));

    const tdSupprimer = document.createElement('td');
    const boutonSupprimer = document.createElement('button');
    boutonSupprimer.type = 'button';
    boutonSupprimer.className = 'btn btn--secondaire';
    boutonSupprimer.textContent = 'Retirer';
    boutonSupprimer.addEventListener('click', () => {
      const i = lignes.indexOf(ligne);
      if (i !== -1) lignes.splice(i, 1);
      tr.remove();
      rafraichirTotal();
      sauvegarderLignes();
    });
    tdSupprimer.appendChild(boutonSupprimer);

    tr.append(tdDesignation, tdQuantite, tdPrix, tdTotal, tdSupprimer);
    return tr;
  }

  for (const ligne of lignes) {
    tbody.appendChild(rendreLigne(ligne));
  }
  rafraichirTotal();

  const boutonAjouter = document.createElement('button');
  boutonAjouter.type = 'button';
  boutonAjouter.className = 'btn btn--secondaire';
  boutonAjouter.textContent = 'Ajouter une ligne';
  boutonAjouter.addEventListener('click', () => {
    const nouvelleLigne = { designation: '', quantite: 1, prix_unitaire: 0 };
    lignes.push(nouvelleLigne);
    tbody.appendChild(rendreLigne(nouvelleLigne));
    rafraichirTotal();
    sauvegarderLignes();
  });
  sectionDevis.appendChild(boutonAjouter);

  bloc.appendChild(sectionDevis);

  const grille = document.createElement('div');
  grille.className = 'editeur-note__grille';
  const colonneEdition = document.createElement('div');
  const h2Justification = document.createElement('h2');
  h2Justification.textContent = 'Justification';
  colonneEdition.appendChild(h2Justification);
  const textarea = document.createElement('textarea');
  textarea.className = 'champ-saisie champ-saisie--zone editeur-note__texte';
  textarea.placeholder = 'Argumentaire, modalités, conditions...';
  textarea.value = proposition.justification_md;
  colonneEdition.appendChild(textarea);

  const colonneApercu = document.createElement('div');
  colonneApercu.className = 'editeur-note__apercu carte';
  colonneApercu.innerHTML = rendreMarkdown(textarea.value);

  let minuterieTexte;
  textarea.addEventListener('input', () => {
    colonneApercu.innerHTML = rendreMarkdown(textarea.value);
    clearTimeout(minuterieTexte);
    minuterieTexte = setTimeout(async () => {
      try {
        await mettreAJourJustification(proposition.id, textarea.value);
      } catch (err) {
        afficherToast(err.message, { type: 'erreur' });
      }
    }, 800);
  });

  grille.append(colonneEdition, colonneApercu);
  bloc.appendChild(grille);

  const actions = document.createElement('div');
  actions.className = 'editeur-note__actions';
  const boutonEnvoyer = document.createElement('button');
  boutonEnvoyer.type = 'button';
  boutonEnvoyer.className = 'btn btn--primaire';
  boutonEnvoyer.textContent = 'Envoyer au client';
  boutonEnvoyer.addEventListener('click', async () => {
    if (lignes.length === 0) {
      afficherToast('Ajoutez au moins une ligne au devis avant d’envoyer.', { type: 'erreur' });
      return;
    }
    boutonEnvoyer.disabled = true;
    try {
      await mettreAJourJustification(proposition.id, textarea.value);
      await remplacerLignes(proposition.id, lignes);
      await envoyerProposition(proposition.id, demande.id);
      afficherToast('Proposition envoyée au client.', { type: 'succes' });
      vueEditeurProposition(demande.reference);
    } catch (err) {
      afficherToast(err.message, { type: 'erreur' });
      boutonEnvoyer.disabled = false;
    }
  });
  actions.appendChild(boutonEnvoyer);
  bloc.appendChild(actions);

  return bloc;
}

function rendreLecture(proposition, lignes) {
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

  const bloc = document.createElement('div');
  bloc.className = 'carte imprimable';

  const statut = document.createElement('p');
  statut.className = 'texte-doux';
  statut.textContent = LIBELLES_STATUT_PROPOSITION[proposition.statut] || proposition.statut;
  bloc.appendChild(statut);

  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>Désignation</th><th>Quantité</th><th>Prix unitaire</th><th>Total</th></tr></thead>';
  const tbody = document.createElement('tbody');
  for (const ligne of lignes) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${ligne.designation}</td><td>${ligne.quantite}</td><td>${formaterMontant(ligne.prix_unitaire)}</td><td>${formaterMontant(ligne.total)}</td>`;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  bloc.appendChild(table);

  const total = document.createElement('p');
  total.className = 'devis-total';
  total.textContent = `Total : ${formaterMontant(calculerTotalDevis(lignes))}`;
  bloc.appendChild(total);

  const justification = document.createElement('div');
  justification.innerHTML = rendreMarkdown(proposition.justification_md);
  bloc.appendChild(justification);

  if (proposition.statut === 'refusee' && proposition.commentaire_client) {
    const commentaire = document.createElement('p');
    commentaire.className = 'texte-doux';
    commentaire.textContent = `Motif du client : ${proposition.commentaire_client}`;
    bloc.appendChild(commentaire);
  }

  conteneur.appendChild(bloc);
  return conteneur;
}
