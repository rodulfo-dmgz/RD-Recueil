// Kanban des demandes (refonte, phase 7) : une colonne par étape du parcours. On glisse
// une carte pour les changements de statut qui se font d'un simple clic (rouvrir la saisie,
// réorienter, abandonner) ; les autres étapes ont leur écran et la décision gagnée ou perdue
// revient au client : le dépôt est alors refusé avec une explication (engine/kanban-demandes.js).
import { listerDemandes, changerStatut } from '../../services/demandes.js';
import { listerResponsables } from '../../services/clients.js';
import { getProfil } from '../../store.js';
import { afficherToast } from '../../components/toast.js';
import { el, icone } from '../../components/dashboard-ui.js';
import { champSelect } from '../../components/champs-crm.js';
import { construireEtatVide } from '../../components/etat-vide.js';
import { ouvrirApercuDemande } from '../../components/apercu-demande.js';
import { COLONNES_DEMANDES, colonnesKanbanDemandes, deplacerDemande, transitionsRapides } from '../../engine/kanban-demandes.js';
import { LIBELLES_STATUT, LIBELLES_TYPE, categorieStatut } from '../../engine/statuts.js';
import { libelleDateLongue } from '../../engine/taches.js';
import { normaliserTexte } from '../../engine/texte.js';

const nomConsultant = (d) => d.consultant?.nom || d.consultant?.email || null;

export async function vueDemandesKanban() {
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><p>Chargement…</p></main>';

  const estAdmin = getProfil()?.role === 'admin';
  let responsables = [];
  if (estAdmin) {
    try {
      responsables = await listerResponsables();
    } catch (err) {
      afficherToast(err.message, { type: 'erreur' });
    }
  }

  const main = el('main', 'db taches-page taches-page--kanban');
  main.appendChild(el('h1', null, 'Demandes en Kanban'));
  main.appendChild(el('p', 'texte-doux', 'Glissez une carte pour rouvrir la saisie, réorienter ou abandonner une demande. Les autres étapes se font depuis la demande ; gagnée ou perdue dépend du client.'));

  const barre = el('div', 'taches-barre');
  const outils = el('div', 'taches-outils');
  const recherche = el('input', 'champ-saisie taches-recherche');
  recherche.type = 'search';
  recherche.placeholder = 'Référence ou client…';
  recherche.setAttribute('aria-label', 'Rechercher une demande');
  recherche.addEventListener('input', () => rendre());
  outils.appendChild(recherche);
  let consultant = null;
  if (estAdmin) {
    consultant = champSelect(
      'consultant',
      'Consultant',
      [{ valeur: 'aucun', libelle: 'Non attribuées' }, ...responsables.map((r) => ({ valeur: r.user_id, libelle: r.nom || r.email }))],
      '',
      'Tous les consultants'
    );
    consultant.wrapper.classList.add('taches-filtre');
    consultant.select.addEventListener('change', () => rendre());
    outils.appendChild(consultant.wrapper);
  }
  barre.appendChild(outils);
  main.appendChild(barre);

  const resultat = el('div', 'kanban');
  main.appendChild(resultat);

  let demandes = [];
  let enCours = null; // demande en train d'être glissée

  async function deplacer(demande, vers, confirmation) {
    if (confirmation && !window.confirm(confirmation)) return;
    const avant = demandes;
    demandes = demandes.map((d) => (d.id === demande.id ? { ...d, statut: vers } : d)); // affichage immédiat, annulé si refus
    rendre();
    try {
      await changerStatut(demande.id, vers);
      afficherToast(`Demande passée en « ${LIBELLES_STATUT[vers] ?? vers} ».`, { type: 'succes' });
    } catch (err) {
      demandes = avant;
      rendre();
      afficherToast(err.message, { type: 'erreur' });
    }
  }

  function surDepot(demande, colonne) {
    const resultatDepot = deplacerDemande(demande.statut, colonne);
    if (resultatDepot.type === 'refus') afficherToast(resultatDepot.message, { type: 'erreur' });
    else if (resultatDepot.type === 'ok') deplacer(demande, resultatDepot.vers, resultatDepot.confirmation);
  }

  function carte(d) {
    const article = el('article', 'kanban__carte');
    article.draggable = true;
    article.dataset.id = d.id;
    article.addEventListener('dragstart', (evenement) => {
      enCours = d;
      evenement.dataTransfer.setData('text/plain', d.id);
      evenement.dataTransfer.effectAllowed = 'move';
      article.classList.add('kanban__carte--deplacee');
      // Colonnes où le dépôt est permis ou non, pendant le glissement.
      for (const col of resultat.querySelectorAll('.kanban__colonne')) {
        const type = deplacerDemande(d.statut, col.dataset.colonne).type;
        col.classList.toggle('kanban__colonne--permise', type === 'ok');
        col.classList.toggle('kanban__colonne--interdite', type === 'refus');
      }
    });
    article.addEventListener('dragend', () => {
      enCours = null;
      article.classList.remove('kanban__carte--deplacee');
      for (const col of resultat.querySelectorAll('.kanban__colonne')) col.classList.remove('kanban__colonne--permise', 'kanban__colonne--interdite', 'kanban__colonne--survol');
    });
    article.addEventListener('click', (evenement) => {
      if (!evenement.target.closest('a, button, select')) ouvrirApercuDemande(d, estAdmin ? { consultant: nomConsultant(d) } : {});
    });

    const lien = el('a', 'kanban__titre kanban__titre--bouton', d.reference);
    lien.href = `#/demandes/${d.reference}`;
    article.appendChild(lien);
    article.appendChild(el('span', 'tl-titre__client tl-titre__client--texte', d.clients?.raison_sociale ?? 'Sans nom'));
    const infos = el('div', 'kanban__infos');
    const statut = el('span', `cl-statut cl-statut--${categorieStatut(d.statut)}`);
    statut.append(el('span', 'cl-statut__point'), LIBELLES_STATUT[d.statut] ?? d.statut);
    infos.appendChild(statut);
    if (d.date_limite) {
      const date = el('span', 'kanban__echeance');
      date.append(icone('calendar'), document.createTextNode(libelleDateLongue(d.date_limite)));
      infos.appendChild(date);
    }
    article.appendChild(infos);
    const types = (d.types || []).map((t) => LIBELLES_TYPE[t] ?? t);
    const pied = el('div', 'kanban__pied');
    pied.appendChild(el('span', 'kanban__types', [types.join(', '), estAdmin ? nomConsultant(d) ?? 'Non attribuée' : ''].filter(Boolean).join(' · ')));
    // Alternative au glisser-déposer (clavier, écran tactile) : seulement les changements permis.
    const permis = transitionsRapides(d.statut);
    if (permis.length > 0) {
      const choix = el('select', 'champ-saisie kanban__statut');
      choix.setAttribute('aria-label', `Changer le statut : ${d.reference}`);
      choix.appendChild(Object.assign(document.createElement('option'), { value: '', textContent: 'Déplacer…' }));
      for (const t of permis) choix.appendChild(Object.assign(document.createElement('option'), { value: t.vers, textContent: t.libelle }));
      choix.addEventListener('change', () => {
        const t = permis.find((x) => x.vers === choix.value);
        if (t) deplacer(d, t.vers, t.confirmation);
        else choix.value = '';
      });
      pied.appendChild(choix);
    }
    article.appendChild(pied);
    return article;
  }

  function rendre() {
    resultat.innerHTML = '';
    const terme = normaliserTexte(recherche.value);
    const filtrees = demandes.filter((d) => {
      if (terme && !normaliserTexte(`${d.reference} ${d.clients?.raison_sociale ?? ''}`).includes(terme)) return false;
      const c = consultant?.select.value;
      if (c === 'aucun') return !d.consultant_id;
      return !c || d.consultant_id === c;
    });
    if (demandes.length === 0) {
      resultat.appendChild(construireEtatVide({ icone: 'layout-list', titre: 'Aucune demande', texte: 'Il n’y a aucune demande en cours.' }));
      return;
    }
    const plateau = el('div', 'kanban__plateau');
    plateau.style.setProperty('--colonnes', String(COLONNES_DEMANDES.length));
    for (const colonne of colonnesKanbanDemandes(filtrees)) {
      const section = el('section', 'kanban__colonne');
      section.dataset.colonne = colonne.valeur;
      section.setAttribute('aria-label', `${colonne.libelle} : ${colonne.demandes.length} demande${colonne.demandes.length > 1 ? 's' : ''}`);
      const tete = el('header', 'kanban__tete');
      tete.append(el('span', `taches-point taches-point--${colonne.couleur}`), el('span', 'kanban__titre-colonne', colonne.libelle), el('span', 'taches-compte', String(colonne.demandes.length)));
      const cartes = el('div', 'kanban__cartes');
      if (colonne.demandes.length === 0) cartes.appendChild(el('p', 'kanban__vide texte-doux', 'Aucune demande.'));
      for (const d of colonne.demandes) cartes.appendChild(carte(d));
      section.addEventListener('dragover', (evenement) => {
        evenement.preventDefault();
        evenement.dataTransfer.dropEffect = 'move';
        section.classList.add('kanban__colonne--survol');
      });
      section.addEventListener('dragleave', (evenement) => {
        if (!section.contains(evenement.relatedTarget)) section.classList.remove('kanban__colonne--survol');
      });
      section.addEventListener('drop', (evenement) => {
        evenement.preventDefault();
        section.classList.remove('kanban__colonne--survol');
        const demande = enCours ?? demandes.find((d) => d.id === evenement.dataTransfer.getData('text/plain'));
        if (demande) surDepot(demande, colonne.valeur);
      });
      section.append(tete, cartes);
      plateau.appendChild(section);
    }
    resultat.appendChild(plateau);
    if (window.lucide) window.lucide.createIcons();
  }

  app.innerHTML = '';
  app.appendChild(main);
  try {
    demandes = await listerDemandes({});
  } catch (err) {
    afficherToast(err.message, { type: 'erreur' });
    resultat.appendChild(el('p', 'cl-champ__erreur', err.message));
    return;
  }
  rendre();
}
