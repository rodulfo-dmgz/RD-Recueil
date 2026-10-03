// Aperçu d'une tâche dans le tiroir latéral : message, équipe, pièces jointes
// (téléchargement et ajout), accès à la fiche du client.
import { ouvrirTiroir } from './tiroir.js';
import { ligne, pastillePersonne } from './apercu-client.js';
import { el, icone, lienBouton } from './dashboard-ui.js';
import { afficherToast } from './toast.js';
import { ajouterPieceJointe, lienPieceJointe } from '../services/taches.js';
import { EXTENSIONS_FICHIER_AUTORISEES } from '../engine/validation.js';
import { URGENCES, libelleEcheance, libelleStatutTache, libelleTypeTache, membresDeTache, STATUTS_TACHE } from '../engine/taches.js';

export function pastilleUrgence(valeur) {
  const urgence = URGENCES.find((u) => u.valeur === valeur) ?? URGENCES[1];
  return el('span', `tache-urgence tache-urgence--${urgence.couleur}`, urgence.libelle);
}

const taille = (octets) => (octets >= 1048576 ? `${(octets / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(octets / 1024))} Ko`);

// onChange : appelé après l'ajout d'une pièce jointe (la liste de la page se redessine).
export function ouvrirApercuTache(tache, { onChange = () => {} } = {}) {
  const couleur = STATUTS_TACHE.find((s) => s.valeur === tache.statut)?.couleur ?? 'cloture';
  const statut = el('span', 'taches-statut');
  statut.append(el('span', `taches-point taches-point--${couleur}`), libelleStatutTache(tache.statut));

  const equipe = el('span', 'tiroir-equipe');
  for (const m of membresDeTache(tache)) equipe.appendChild(pastillePersonne(m.nom));

  const message = el('span', 'tiroir-message', tache.description || '');
  const liste = el('dl', 'tiroir-fiche');
  liste.append(
    ligne('Statut', statut),
    ligne('Urgence', pastilleUrgence(tache.urgence)),
    ligne('Échéance', `${libelleEcheance(tache.echeance)} (${tache.echeance.split('-').reverse().join('/')})`),
    ligne('Client', tache.clients?.raison_sociale ?? 'Client non visible'),
    ligne('Type', libelleTypeTache(tache.type)),
    ligne('Équipe', equipe.childNodes.length > 0 ? equipe : '-'),
    ligne('Message', tache.description ? message : '-')
  );

  const pieces = el('section', 'tiroir-pieces');
  const titrePieces = el('h3', 'tiroir-pieces__titre');
  const listePieces = el('ul', 'tiroir-pieces__liste');
  function rendrePieces() {
    titrePieces.textContent = `Pièces jointes (${tache.pieces?.length ?? 0})`;
    listePieces.replaceChildren();
    for (const piece of tache.pieces ?? []) {
      const li = el('li', 'tiroir-pieces__ligne');
      const telecharger = el('button', 'tiroir-pieces__nom');
      telecharger.type = 'button';
      telecharger.append(icone('paperclip'), el('span', null, piece.nom), el('small', 'texte-doux', taille(piece.taille)));
      telecharger.addEventListener('click', async () => {
        try {
          window.open(await lienPieceJointe(piece.chemin), '_blank', 'noopener');
        } catch (err) {
          afficherToast(err.message, { type: 'erreur' });
        }
      });
      li.appendChild(telecharger);
      listePieces.appendChild(li);
    }
    if (window.lucide) window.lucide.createIcons();
  }
  const entree = el('input');
  entree.type = 'file';
  entree.multiple = true;
  entree.hidden = true;
  entree.accept = EXTENSIONS_FICHIER_AUTORISEES.map((e) => `.${e}`).join(',');
  entree.addEventListener('change', async () => {
    for (const fichier of entree.files) {
      try {
        const piece = await ajouterPieceJointe(tache.id, fichier);
        tache.pieces = [...(tache.pieces ?? []), piece];
        rendrePieces();
        onChange();
      } catch (err) {
        afficherToast(`${fichier.name} : ${err.message}`, { type: 'erreur' });
      }
    }
    entree.value = '';
  });
  const ajouter = el('button', 'db-btn db-btn--discret');
  ajouter.type = 'button';
  ajouter.append(icone('plus'), el('span', null, 'Ajouter une pièce jointe'));
  ajouter.addEventListener('click', () => entree.click());
  pieces.append(titrePieces, listePieces, ajouter, entree);
  rendrePieces();

  const corps = el('div');
  corps.append(liste, pieces);
  const actions = [];
  if (tache.clients?.raison_sociale) actions.push(lienBouton(`#/clients/${tache.client_id}/activite`, 'db-btn db-btn--primaire', 'Ouvrir la fiche client', 'arrow-right'));
  return ouvrirTiroir({ titre: tache.titre, sousTitre: tache.clients?.raison_sociale || undefined, corps, actions });
}
