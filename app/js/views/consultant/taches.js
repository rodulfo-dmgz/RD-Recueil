// Page des tâches (CRM, lot B) : mes tâches par défaut ; l'admin peut voir
// celles de toute l'équipe. Un consultant ne reçoit que les siennes (RLS).
import { listerTaches, terminerTache, reporterTache } from '../../services/taches.js';
import { listerResponsables } from '../../services/clients.js';
import { getProfil } from '../../store.js';
import { afficherToast } from '../../components/toast.js';
import { el } from '../../components/dashboard-ui.js';
import { champSelect } from '../../components/champs-crm.js';
import { construireLigneTache, echeanceApresReport } from '../../components/ligne-tache.js';
import { classerTaches } from '../../engine/taches.js';

const STATUTS = [
  { valeur: 'a_faire', libelle: 'À faire' },
  { valeur: 'terminee', libelle: 'Terminées' },
  { valeur: 'annulee', libelle: 'Annulées' },
];

function groupe(titre, taches, rendreLigne, classe = '') {
  if (taches.length === 0) return null;
  const carte = el('section', `db-carte${classe}`);
  carte.appendChild(el('h2', 'db-titre', `${titre} (${taches.length})`));
  const liste = el('ul', 'cl-taches');
  for (const t of taches) liste.appendChild(rendreLigne(t));
  carte.appendChild(liste);
  return carte;
}

export async function vueTaches() {
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

  const main = el('main', 'db');
  main.appendChild(el('h1', null, 'Tâches'));

  const filtres = el('div', 'cl-filtres');
  const statut = champSelect('statut', 'Statut', STATUTS, 'a_faire');
  filtres.appendChild(statut.wrapper);
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
  main.appendChild(filtres);

  const resultat = el('div', 'db-principale');
  main.appendChild(resultat);

  let taches = [];

  function rendre() {
    resultat.innerHTML = '';
    const filtrees = clientFiltre.select.value ? taches.filter((t) => t.client_id === clientFiltre.select.value) : taches;
    if (filtrees.length === 0) {
      resultat.appendChild(el('p', 'db-vide texte-doux', statut.select.value === 'a_faire' ? 'Aucune tâche à faire.' : 'Aucune tâche.'));
      return;
    }
    const agir = (promesse, message) =>
      promesse
        .then(() => {
          afficherToast(message, { type: 'succes' });
          return charger();
        })
        .catch((err) => afficherToast(err.message, { type: 'erreur' }));
    const ligne = (t) =>
      construireLigneTache(t, {
        estAdmin,
        profilId: profil?.user_id,
        avecClient: true,
        onTerminer: () => agir(terminerTache(t.id), 'Tâche terminée.'),
        onReporter: (jours) => agir(reporterTache(t.id, echeanceApresReport(jours)), 'Échéance reportée.'),
      });

    if (statut.select.value === 'a_faire') {
      const g = classerTaches(filtrees);
      for (const [titre, liste, classe] of [
        ['En retard', g.enRetard, ' db-carte--alerte'],
        ['Aujourd’hui', g.aujourdhui, ''],
        ['Cette semaine', g.semaine, ''],
        ['Plus tard', g.plusTard, ''],
      ]) {
        const carte = groupe(titre, liste, ligne, classe);
        if (carte) resultat.appendChild(carte);
      }
    } else {
      const triees = [...filtrees].sort((a, b) => String(b.terminee_le ?? b.updated_at).localeCompare(String(a.terminee_le ?? a.updated_at)));
      resultat.appendChild(groupe(statut.select.value === 'terminee' ? 'Terminées' : 'Annulées', triees, ligne));
    }
    if (window.lucide) window.lucide.createIcons();
  }

  async function charger() {
    resultat.innerHTML = '';
    resultat.appendChild(el('p', 'texte-doux', 'Chargement…'));
    try {
      taches = await listerTaches({
        statut: statut.select.value,
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

  statut.select.addEventListener('change', charger);
  if (responsable) responsable.select.addEventListener('change', charger);
  clientFiltre.select.addEventListener('change', rendre);

  app.innerHTML = '';
  app.appendChild(main);
  await charger();
  if (window.lucide) window.lucide.createIcons();
}
