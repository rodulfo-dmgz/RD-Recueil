// Pages des tâches (CRM, lot B ; refonte de l'interface) : la liste, groupée par
// statut avec des onglets, et le Kanban où l'on glisse une carte d'une colonne à
// l'autre pour changer son statut. Un consultant ne reçoit que ses tâches (RLS) ;
// l'admin peut voir celles de toute l'équipe.
import { listerTaches, changerStatutTache, terminerTache, reporterTache } from '../../services/taches.js';
import { listerClientsDetail, listerResponsables } from '../../services/clients.js';
import { getProfil } from '../../store.js';
import { afficherToast } from '../../components/toast.js';
import { el, icone } from '../../components/dashboard-ui.js';
import { champSelect } from '../../components/champs-crm.js';
import { construireLigneTache, echeanceApresReport } from '../../components/ligne-tache.js';
import { construireEtatVide } from '../../components/etat-vide.js';
import { ouvrirApercuTache, pastilleUrgence } from '../../components/apercu-tache.js';
import { ouvrirModaleTache } from '../../components/modale-tache.js';
import { STATUTS_TACHE, colonnesKanban, deplacerTache, joursDeRetard, libelleEcheance, libelleStatutTache, membresDeTache } from '../../engine/taches.js';
import { initiales } from '../../engine/texte.js';

const ONGLETS = [
  { valeur: 'toutes', libelle: 'Toutes les tâches' },
  ...STATUTS_TACHE.map((s) => ({ valeur: s.valeur, libelle: s.libelle })),
  { valeur: 'annulee', libelle: 'Annulées' },
];


async function monterPage(mode) {
  const kanban = mode === 'kanban';
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><p>Chargement…</p></main>';

  const profil = getProfil();
  const estAdmin = profil?.role === 'admin';
  let responsables = [];
  if (estAdmin) {
    try {
      responsables = await listerResponsables();
    } catch (err) {
      afficherToast(err.message, { type: 'erreur' });
    }
  }

  const main = el('main', `db taches-page${kanban ? ' taches-page--kanban' : ''}`);
  const entete = el('div', 'taches-entete');
  entete.appendChild(el('h1', null, kanban ? 'Tâches Kanban' : 'Liste des tâches'));
  const boutonAjout = el('button', 'db-btn db-btn--primaire');
  boutonAjout.type = 'button';
  boutonAjout.append(icone('plus'), el('span', null, 'Ajouter une tâche'));
  entete.appendChild(boutonAjout);
  main.appendChild(entete);
  if (kanban) main.appendChild(el('p', 'texte-doux', 'Glissez une carte vers une autre colonne pour changer son statut (ou utilisez le sélecteur de la carte). Colonne « Complet » : tâches terminées depuis 30 jours.'));

  const barre = el('div', 'taches-barre');
  let onglet = 'toutes';
  const boutonsOnglets = new Map();
  if (!kanban) {
    const liste = el('div', 'taches-onglets');
    liste.setAttribute('role', 'group');
    liste.setAttribute('aria-label', 'Statut des tâches');
    for (const o of ONGLETS) {
      const bouton = el('button', 'taches-onglet', o.libelle);
      bouton.type = 'button';
      bouton.addEventListener('click', () => {
        onglet = o.valeur;
        majOnglets();
        rendre();
      });
      boutonsOnglets.set(o.valeur, bouton);
      liste.appendChild(bouton);
    }
    barre.appendChild(liste);
  }
  function majOnglets() {
    for (const [valeur, bouton] of boutonsOnglets) bouton.setAttribute('aria-pressed', String(valeur === onglet));
  }
  majOnglets();

  const filtres = el('div', 'cl-filtres taches-filtres');
  let responsable = null;
  if (estAdmin) {
    responsable = champSelect(
      'responsable',
      'Responsable',
      [{ valeur: 'tous', libelle: 'Toute l’équipe' }, ...responsables.map((r) => ({ valeur: r.user_id, libelle: r.user_id === profil.user_id ? 'Moi' : r.nom || r.email }))],
      profil.user_id
    );
    filtres.appendChild(responsable.wrapper);
  }
  const clientFiltre = champSelect('client', 'Client', [], '', 'Tous les clients');
  filtres.appendChild(clientFiltre.wrapper);
  barre.appendChild(filtres);
  main.appendChild(barre);

  const resultat = el('div', kanban ? 'kanban' : 'taches-liste');
  main.appendChild(resultat);

  let taches = []; // toutes les tâches chargées (tous statuts)

  // ─── Actions ───────────────────────────────────────────────────────────────
  boutonAjout.addEventListener('click', async () => {
    boutonAjout.disabled = true;
    try {
      const [clients, equipe] = await Promise.all([listerClientsDetail(), listerResponsables()]);
      ouvrirModaleTache({ clients, equipe, profil, estAdmin, clientId: clientFiltre.select.value, onCree: () => charger() });
    } catch (err) {
      afficherToast(err.message, { type: 'erreur' });
    } finally {
      boutonAjout.disabled = false;
    }
  });
  const ouvrirDetail = (t) => ouvrirApercuTache(t, { onChange: () => rendre() });

  async function changerStatut(id, statut) {
    const avant = taches;
    if (avant.find((t) => t.id === id)?.statut === statut) return;
    taches = deplacerTache(taches, id, statut); // affichage immédiat, annulé si le serveur refuse
    rendre();
    try {
      await changerStatutTache(id, statut);
      afficherToast(`Tâche passée en « ${libelleStatutTache(statut)} ».`, { type: 'succes' });
    } catch (err) {
      taches = avant;
      rendre();
      afficherToast(err.message, { type: 'erreur' });
    }
  }
  const agir = (promesse, message) =>
    promesse
      .then(() => {
        afficherToast(message, { type: 'succes' });
        return charger();
      })
      .catch((err) => afficherToast(err.message, { type: 'erreur' }));

  // ─── Liste ─────────────────────────────────────────────────────────────────
  function groupe(statut, liste) {
    const carte = el('section', 'db-carte taches-groupe');
    const tete = el('button', 'taches-groupe__tete');
    tete.type = 'button';
    tete.setAttribute('aria-expanded', 'true');
    tete.append(icone('chevron-down'), el('span', `taches-point taches-point--${statut.couleur}`), el('span', 'taches-groupe__titre', statut.libelle), el('span', 'taches-compte', String(liste.length)));
    const ul = el('ul', 'cl-taches');
    for (const t of liste) {
      ul.appendChild(
        construireLigneTache(t, {
          estAdmin,
          profilId: profil?.user_id,
          avecClient: true,
          onTerminer: () => agir(terminerTache(t.id), 'Tâche terminée.'),
          onReporter: (jours) => agir(reporterTache(t.id, echeanceApresReport(jours)), 'Échéance reportée.'),
          onStatut: (valeur) => changerStatut(t.id, valeur),
          onOuvrir: () => ouvrirDetail(t),
        })
      );
    }
    tete.addEventListener('click', () => {
      const ouvert = tete.getAttribute('aria-expanded') === 'true';
      tete.setAttribute('aria-expanded', String(!ouvert));
      ul.hidden = ouvert;
    });
    carte.append(tete, ul);
    return carte;
  }

  function rendreListe(filtrees) {
    const groupes = onglet === 'annulee'
      ? [{ valeur: 'annulee', libelle: 'Annulées', couleur: 'cloture', taches: filtrees.filter((t) => t.statut === 'annulee') }]
      : colonnesKanban(filtrees, { joursComplet: onglet === 'terminee' ? 36500 : 30 }).filter((c) => onglet === 'toutes' || c.valeur === onglet);
    const affiches = groupes.filter((g) => g.taches.length > 0);
    if (affiches.length === 0) {
      resultat.appendChild(construireEtatVide({ icone: 'list-checks', titre: 'Aucune tâche', texte: 'Aucune tâche ne correspond à ces filtres.' }));
      return;
    }
    for (const g of affiches) resultat.appendChild(groupe(g, g.taches));
  }

  // ─── Kanban ────────────────────────────────────────────────────────────────
  function carteKanban(t) {
    const retard = t.statut !== 'terminee' && joursDeRetard(t.echeance) > 0;
    const carte = el('article', `kanban__carte${retard ? ' kanban__carte--retard' : ''}`);
    carte.draggable = true;
    carte.dataset.id = t.id;
    carte.addEventListener('dragstart', (evenement) => {
      evenement.dataTransfer.setData('text/plain', t.id);
      evenement.dataTransfer.effectAllowed = 'move';
      carte.classList.add('kanban__carte--deplacee');
    });
    carte.addEventListener('dragend', () => carte.classList.remove('kanban__carte--deplacee'));

    carte.addEventListener('click', (evenement) => {
      if (!evenement.target.closest('a, button, select, input')) ouvrirDetail(t);
    });
    const titreCarte = el('button', 'kanban__titre kanban__titre--bouton', t.titre);
    titreCarte.type = 'button';
    titreCarte.addEventListener('click', () => ouvrirDetail(t));
    carte.appendChild(titreCarte);
    if (t.clients?.raison_sociale) {
      const lien = el('a', 'cl-tache__client', t.clients.raison_sociale);
      lien.href = `#/clients/${t.client_id}/activite`;
      carte.appendChild(lien);
    }
    const infos = el('div', 'kanban__infos');
    const echeance = el('span', 'kanban__echeance');
    echeance.append(icone('calendar'), document.createTextNode(libelleEcheance(t.echeance)));
    infos.append(echeance, pastilleUrgence(t.urgence));
    carte.appendChild(infos);

    const pied = el('div', 'kanban__pied');
    const membres = membresDeTache(t);
    if (membres.length > 0) {
      const pile = el('span', 'kanban__membres');
      for (const m of membres.slice(0, 3)) {
        const avatar = el('span', 'kanban__avatar', initiales(m.nom));
        avatar.title = m.nom;
        pile.appendChild(avatar);
      }
      if (membres.length > 3) pile.appendChild(el('span', 'kanban__avatar kanban__avatar--plus', `+${membres.length - 3}`));
      pied.appendChild(pile);
    }
    if (t.pieces?.length > 0) {
      const pj = el('span', 'kanban__pj');
      pj.setAttribute('aria-label', `${t.pieces.length} pièce${t.pieces.length > 1 ? 's' : ''} jointe${t.pieces.length > 1 ? 's' : ''}`);
      pj.append(icone('paperclip'), document.createTextNode(String(t.pieces.length)));
      pied.appendChild(pj);
    }
    const statut = el('select', 'champ-saisie kanban__statut');
    statut.setAttribute('aria-label', `Statut : ${t.titre}`);
    for (const s of STATUTS_TACHE) statut.appendChild(Object.assign(document.createElement('option'), { value: s.valeur, textContent: s.libelle }));
    statut.value = t.statut;
    statut.addEventListener('change', () => changerStatut(t.id, statut.value));
    pied.appendChild(statut);
    carte.appendChild(pied);
    return carte;
  }

  function rendreKanban(filtrees) {
    const plateau = el('div', 'kanban__plateau');
    for (const colonne of colonnesKanban(filtrees)) {
      const section = el('section', 'kanban__colonne');
      section.setAttribute('aria-label', `${colonne.libelle} : ${colonne.taches.length} tâche${colonne.taches.length > 1 ? 's' : ''}`);
      const tete = el('header', 'kanban__tete');
      tete.append(el('span', `taches-point taches-point--${colonne.couleur}`), el('span', 'kanban__titre-colonne', colonne.libelle), el('span', 'taches-compte', String(colonne.taches.length)));
      const cartes = el('div', 'kanban__cartes');
      if (colonne.taches.length === 0) cartes.appendChild(el('p', 'kanban__vide texte-doux', 'Déposez une tâche ici.'));
      for (const t of colonne.taches) cartes.appendChild(carteKanban(t));
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
        const id = evenement.dataTransfer.getData('text/plain');
        if (id) changerStatut(id, colonne.valeur);
      });
      section.append(tete, cartes);
      plateau.appendChild(section);
    }
    resultat.appendChild(plateau);
  }

  // ─── Chargement et rendu ───────────────────────────────────────────────────
  function rendre() {
    resultat.innerHTML = '';
    const filtrees = clientFiltre.select.value ? taches.filter((t) => t.client_id === clientFiltre.select.value) : taches;
    if (kanban) rendreKanban(filtrees);
    else rendreListe(filtrees);
    if (window.lucide) window.lucide.createIcons();
  }

  async function charger() {
    resultat.innerHTML = '';
    resultat.appendChild(el('p', 'texte-doux', 'Chargement…'));
    try {
      taches = await listerTaches({
        statut: null,
        assigneeId: responsable ? (responsable.select.value === 'tous' ? undefined : responsable.select.value) : undefined,
      });
    } catch (err) {
      afficherToast(err.message, { type: 'erreur' });
      resultat.innerHTML = '';
      resultat.appendChild(el('p', 'cl-champ__erreur', err.message));
      return;
    }
    // Clients présents dans la liste, pour le filtre.
    const clients = new Map(taches.map((t) => [t.client_id, t.clients?.raison_sociale ?? 'Client']));
    const choisi = clientFiltre.select.value;
    clientFiltre.select.innerHTML = '';
    clientFiltre.select.appendChild(Object.assign(document.createElement('option'), { value: '', textContent: 'Tous les clients' }));
    for (const [id, nom] of [...clients].sort((a, b) => a[1].localeCompare(b[1]))) {
      clientFiltre.select.appendChild(Object.assign(document.createElement('option'), { value: id, textContent: nom, selected: id === choisi }));
    }
    rendre();
  }

  if (responsable) responsable.select.addEventListener('change', charger);
  clientFiltre.select.addEventListener('change', rendre);

  app.innerHTML = '';
  app.appendChild(main);
  await charger();
  if (window.lucide) window.lucide.createIcons();
}

export const vueTaches = () => monterPage('liste');
export const vueTachesKanban = () => monterPage('kanban');
