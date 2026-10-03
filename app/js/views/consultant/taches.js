// Pages des tâches (CRM, lot B ; refonte de l'interface) : la liste, groupée par
// statut avec des onglets, et le Kanban où l'on glisse une carte d'une colonne à
// l'autre pour changer son statut. Un consultant ne reçoit que ses tâches (RLS) ;
// l'admin peut voir celles de toute l'équipe.
import { listerTaches, changerStatutTache, annulerTache, terminerTache, reporterTache } from '../../services/taches.js';
import { listerClientsDetail, listerResponsables } from '../../services/clients.js';
import { getProfil } from '../../store.js';
import { afficherToast } from '../../components/toast.js';
import { el, icone } from '../../components/dashboard-ui.js';
import { champSelect } from '../../components/champs-crm.js';
import { echeanceApresReport } from '../../components/ligne-tache.js';
import { construireEtatVide } from '../../components/etat-vide.js';
import { ouvrirApercuTache, pastilleUrgence } from '../../components/apercu-tache.js';
import { ouvrirModaleTache } from '../../components/modale-tache.js';
import { STATUTS_TACHE, colonnesKanban, deplacerTache, estOuverte, joursDeRetard, libelleDateLongue, libelleStatutTache, membresDeTache } from '../../engine/taches.js';
import { initiales, normaliserTexte } from '../../engine/texte.js';

const ONGLETS = [{ valeur: 'toutes', libelle: 'Toutes les tâches' }, ...STATUTS_TACHE.map((s) => ({ valeur: s.valeur, libelle: s.libelle }))];

// Pile d'avatars (3 au plus, puis « +n »).
function pileAvatars(tache) {
  const membres = membresDeTache(tache);
  const pile = el('span', 'tl-avatars');
  for (const m of membres.slice(0, 3)) {
    const avatar = el('span', 'tl-avatar', initiales(m.nom));
    avatar.title = m.nom;
    pile.appendChild(avatar);
  }
  if (membres.length > 3) pile.appendChild(el('span', 'tl-avatar tl-avatar--plus', `+${membres.length - 3}`));
  return pile;
}

function compteurPieces(tache) {
  const n = tache.pieces?.length ?? 0;
  const pj = el('span', 'tl-pj');
  if (n === 0) return pj;
  pj.setAttribute('aria-label', `${n} pièce${n > 1 ? 's' : ''} jointe${n > 1 ? 's' : ''}`);
  pj.append(icone('paperclip'), document.createTextNode(String(n)));
  return pj;
}

// Les menus « ... » ouverts se referment dès qu'on clique ailleurs.
function fermerMenus(sauf = null) {
  for (const menu of document.querySelectorAll('.tl-menu[open]')) if (menu !== sauf) menu.open = false;
}
if (!window.__menusTachesAttaches) {
  window.__menusTachesAttaches = true;
  document.addEventListener('click', (evenement) => fermerMenus(evenement.target.closest?.('.tl-menu') ?? null));
  document.addEventListener('keydown', (evenement) => {
    if (evenement.key === 'Escape') fermerMenus();
  });
}

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
  main.appendChild(el('h1', null, kanban ? 'Tâches Kanban' : 'Liste des tâches'));

  // ─── Barre d'outils : onglets à gauche ; recherche, filtres et ajout à droite ─
  const barre = el('div', 'taches-barre');
  let onglet = 'toutes';
  const boutonsOnglets = new Map();
  const groupeOnglets = el('div', 'taches-onglets');
  groupeOnglets.setAttribute('role', 'group');
  groupeOnglets.setAttribute('aria-label', 'Statut des tâches');
  for (const o of kanban ? ONGLETS : [...ONGLETS, { valeur: 'annulee', libelle: 'Annulées' }]) {
    const bouton = el('button', 'taches-onglet', o.libelle);
    bouton.type = 'button';
    bouton.addEventListener('click', () => {
      onglet = o.valeur;
      majOnglets();
      rendre();
    });
    boutonsOnglets.set(o.valeur, bouton);
    groupeOnglets.appendChild(bouton);
  }
  function majOnglets() {
    for (const [valeur, bouton] of boutonsOnglets) bouton.setAttribute('aria-pressed', String(valeur === onglet));
  }
  majOnglets();
  barre.appendChild(groupeOnglets);

  const outils = el('div', 'taches-outils');
  const champRecherche = el('input', 'champ-saisie taches-recherche');
  champRecherche.type = 'search';
  champRecherche.placeholder = 'Rechercher une tâche…';
  champRecherche.setAttribute('aria-label', 'Rechercher une tâche');
  champRecherche.hidden = true;
  champRecherche.addEventListener('input', () => rendre());
  const boutonRecherche = el('button', 'taches-outil');
  boutonRecherche.type = 'button';
  boutonRecherche.setAttribute('aria-label', 'Rechercher une tâche');
  boutonRecherche.setAttribute('aria-expanded', 'false');
  boutonRecherche.appendChild(icone('search'));
  boutonRecherche.addEventListener('click', () => {
    champRecherche.hidden = !champRecherche.hidden;
    boutonRecherche.setAttribute('aria-expanded', String(!champRecherche.hidden));
    if (champRecherche.hidden) {
      champRecherche.value = '';
      rendre();
    } else {
      champRecherche.focus();
    }
  });
  outils.append(champRecherche, boutonRecherche);

  let responsable = null;
  if (estAdmin) {
    responsable = champSelect(
      'responsable',
      'Responsable',
      [{ valeur: 'tous', libelle: 'Toute l’équipe' }, ...responsables.map((r) => ({ valeur: r.user_id, libelle: r.user_id === profil.user_id ? 'Moi' : r.nom || r.email }))],
      profil.user_id
    );
    responsable.wrapper.classList.add('taches-filtre');
    outils.appendChild(responsable.wrapper);
  }
  const clientFiltre = champSelect('client', 'Client', [], '', 'Tous les clients');
  clientFiltre.wrapper.classList.add('taches-filtre');
  outils.appendChild(clientFiltre.wrapper);

  outils.appendChild(el('span', 'taches-separateur'));
  const boutonAjout = el('button', 'db-btn db-btn--primaire');
  boutonAjout.type = 'button';
  boutonAjout.append(icone('plus'), el('span', null, 'Ajouter une tâche'));
  outils.appendChild(boutonAjout);
  barre.appendChild(outils);
  main.appendChild(barre);

  const resultat = el('div', kanban ? 'kanban' : 'taches-liste');
  main.appendChild(resultat);

  let taches = []; // toutes les tâches chargées (tous statuts)

  // ─── Actions ───────────────────────────────────────────────────────────────
  async function ajouter(statut = 'a_faire') {
    boutonAjout.disabled = true;
    try {
      const [clients, equipe] = await Promise.all([listerClientsDetail(), listerResponsables()]);
      ouvrirModaleTache({ clients, equipe, profil, estAdmin, clientId: clientFiltre.select.value, statut, onCree: () => charger() });
    } catch (err) {
      afficherToast(err.message, { type: 'erreur' });
    } finally {
      boutonAjout.disabled = false;
    }
  }
  boutonAjout.addEventListener('click', () => ajouter());

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
  // Menu « ... » d'une ligne : changer de statut, reporter, annuler.
  function menuLigne(t) {
    const menu = el('details', 'tl-menu');
    const resume = el('summary', 'tl-menu__bouton');
    resume.setAttribute('aria-label', `Actions : ${t.titre}`);
    resume.appendChild(icone('ellipsis'));
    const panneau = el('div', 'tl-menu__panneau');
    const item = (libelle, action, desactive = false) => {
      const b = el('button', 'tl-menu__item', libelle);
      b.type = 'button';
      b.disabled = desactive;
      b.addEventListener('click', () => {
        menu.open = false;
        action();
      });
      panneau.appendChild(b);
    };
    panneau.appendChild(el('p', 'tl-menu__titre', 'Passer en'));
    for (const s of STATUTS_TACHE) item(s.libelle, () => changerStatut(t.id, s.valeur), t.statut === s.valeur);
    if (estOuverte(t)) {
      panneau.appendChild(el('p', 'tl-menu__titre', 'Reporter'));
      for (const [libelle, jours] of [['À demain', 1], ['Dans 3 jours', 3], ['Dans 1 semaine', 7]]) item(libelle, () => agir(reporterTache(t.id, echeanceApresReport(jours)), 'Échéance reportée.'));
    }
    if (t.statut !== 'annulee') item('Annuler la tâche', () => agir(annulerTache(t.id), 'Tâche annulée.'));
    menu.append(resume, panneau);
    return menu;
  }

  function ligneListe(t) {
    const retard = estOuverte(t) && joursDeRetard(t.echeance) > 0;
    const li = el('li', `tl-ligne${retard ? ' tl-ligne--retard' : ''}`);
    let etat;
    if (estOuverte(t)) {
      etat = el('button', 'tl-fait');
      etat.type = 'button';
      etat.setAttribute('aria-label', `Marquer comme terminée : ${t.titre}`);
      etat.appendChild(icone('check'));
      etat.addEventListener('click', () => agir(terminerTache(t.id), 'Tâche terminée.'));
    } else {
      etat = el('span', `tl-fait tl-fait--${t.statut === 'terminee' ? 'fini' : 'annule'}`);
      etat.appendChild(icone(t.statut === 'terminee' ? 'check' : 'x'));
    }
    const titre = el('div', 'tl-titre');
    const bouton = el('button', 'tl-titre__bouton', t.titre);
    bouton.type = 'button';
    bouton.addEventListener('click', () => ouvrirDetail(t));
    titre.appendChild(bouton);
    if (t.clients?.raison_sociale) {
      const lien = el('a', 'tl-titre__client', t.clients.raison_sociale);
      lien.href = `#/clients/${t.client_id}/activite`;
      titre.appendChild(lien);
    }
    const date = el('span', 'tl-date');
    date.append(icone('calendar'), document.createTextNode(libelleDateLongue(t.echeance)));
    li.append(etat, titre, date, pastilleUrgence(t.urgence), pileAvatars(t), compteurPieces(t), menuLigne(t));
    return li;
  }

  function groupe(statut, liste) {
    const carte = el('section', 'tl-groupe');
    const tete = el('button', 'tl-groupe__tete');
    tete.type = 'button';
    tete.setAttribute('aria-expanded', 'true');
    tete.append(icone('chevron-down'), el('span', `taches-point taches-point--${statut.couleur}`), el('span', 'tl-groupe__titre', statut.libelle), el('span', 'taches-compte', String(liste.length)));
    const corps = el('div', 'tl-groupe__corps');
    const ul = el('ul', 'tl-lignes');
    for (const t of liste) ul.appendChild(ligneListe(t));
    corps.appendChild(ul);
    if (statut.valeur !== 'annulee') {
      const ajout = el('button', 'tl-ajout');
      ajout.type = 'button';
      ajout.append(icone('plus'), el('span', null, 'Ajouter une tâche'));
      ajout.addEventListener('click', () => ajouter(statut.valeur));
      corps.appendChild(ajout);
    }
    tete.addEventListener('click', () => {
      const ouvert = tete.getAttribute('aria-expanded') === 'true';
      tete.setAttribute('aria-expanded', String(!ouvert));
      corps.hidden = ouvert;
    });
    carte.append(tete, corps);
    return carte;
  }

  function rendreListe(filtrees) {
    const groupes =
      onglet === 'annulee'
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
    const retard = estOuverte(t) && joursDeRetard(t.echeance) > 0;
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

    const titre = el('button', 'kanban__titre kanban__titre--bouton', t.titre);
    titre.type = 'button';
    titre.addEventListener('click', () => ouvrirDetail(t));
    carte.appendChild(titre);
    if (t.clients?.raison_sociale) {
      const lien = el('a', 'tl-titre__client', t.clients.raison_sociale);
      lien.href = `#/clients/${t.client_id}/activite`;
      carte.appendChild(lien);
    }
    const infos = el('div', 'kanban__infos');
    const date = el('span', 'kanban__echeance');
    date.append(icone('calendar'), document.createTextNode(libelleDateLongue(t.echeance)));
    infos.appendChild(date);
    if (t.statut === 'terminee') {
      const fait = el('span', 'tl-fait tl-fait--fini');
      fait.setAttribute('aria-label', 'Terminée');
      fait.appendChild(icone('check'));
      infos.appendChild(fait);
    } else {
      infos.appendChild(pastilleUrgence(t.urgence));
    }
    carte.appendChild(infos);

    const pied = el('div', 'kanban__pied');
    pied.append(pileAvatars(t), compteurPieces(t));
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
    const colonnes = colonnesKanban(filtrees).filter((c) => onglet === 'toutes' || c.valeur === onglet);
    plateau.style.setProperty('--colonnes', String(colonnes.length));
    for (const colonne of colonnes) {
      const section = el('section', 'kanban__colonne');
      section.setAttribute('aria-label', `${colonne.libelle} : ${colonne.taches.length} tâche${colonne.taches.length > 1 ? 's' : ''}`);
      const tete = el('header', 'kanban__tete');
      const ajout = el('button', 'taches-outil kanban__ajout');
      ajout.type = 'button';
      ajout.setAttribute('aria-label', `Ajouter une tâche en « ${colonne.libelle} »`);
      ajout.appendChild(icone('plus'));
      ajout.addEventListener('click', () => ajouter(colonne.valeur));
      tete.append(el('span', `taches-point taches-point--${colonne.couleur}`), el('span', 'kanban__titre-colonne', colonne.libelle), el('span', 'taches-compte', String(colonne.taches.length)), ajout);
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
    const terme = normaliserTexte(champRecherche.value);
    const filtrees = taches.filter(
      (t) => (!clientFiltre.select.value || t.client_id === clientFiltre.select.value) && (!terme || normaliserTexte(`${t.titre} ${t.clients?.raison_sociale ?? ''} ${t.description ?? ''}`).includes(terme))
    );
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
