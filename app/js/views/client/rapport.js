// Rapport de projet du client : pour chaque demande, l'avancement, les
// durées et la chronologie des dates importantes - imprimable. Section 4.1.
import { listerMesDemandes } from '../../services/demandes.js';
import { listerJalons } from '../../services/jalons.js';
import { getClientApercuId } from '../../store.js';
import { afficherToast } from '../../components/toast.js';
import { el, icone, construireEtapes } from '../../components/dashboard-ui.js';
import { LIBELLES_STATUT, STATUTS_FINAUX, categorieStatut } from '../../engine/statuts.js';
import { grouperParDemande, delaisDemande, chronologie, formaterDelai } from '../../engine/jalons.js';

const MS_JOUR = 24 * 60 * 60 * 1000;

function formaterDate(date, type) {
  // La date limite n'a pas d'heure : on n'affiche pas un horaire trompeur.
  const options = { day: 'numeric', month: 'short', year: 'numeric' };
  if (type !== 'echeance') Object.assign(options, { hour: '2-digit', minute: '2-digit' });
  return new Date(date).toLocaleString('fr-FR', options);
}

function miniStat(libelle, valeur) {
  const bloc = el('div', 'db-mini');
  bloc.append(el('span', 'db-mini__valeur', valeur), el('span', 'db-mini__libelle', libelle));
  return bloc;
}

function construireRapport(demande, jalons, maintenant) {
  const carte = el('article', 'db-carte db-rapport');

  const entete = el('div', 'db-suivi__entete');
  entete.appendChild(el('h2', 'db-suivi__reference', demande.reference));
  entete.appendChild(
    el('span', `demande-carte__statut demande-carte__statut--${categorieStatut(demande.statut)}`, LIBELLES_STATUT[demande.statut] || demande.statut)
  );
  carte.appendChild(entete);
  carte.appendChild(construireEtapes(demande.statut));

  const delais = delaisDemande(jalons);
  const creation = jalons.find((j) => j.type === 'creation');
  const termine = STATUTS_FINAUX.has(demande.statut);
  const ecoule = termine ? delais.total : creation ? (maintenant - new Date(creation.date)) / MS_JOUR : null;
  const rdv = jalons.find((j) => j.type === 'entretien' && new Date(j.date) > maintenant);
  const stats = el('div', 'db-minis');
  stats.append(
    miniStat(termine ? 'Durée totale' : 'Depuis la création', formaterDelai(ecoule)),
    miniStat('Délai de réponse', formaterDelai(delais.reponseClient)),
    miniStat('Prochain rendez-vous', rdv ? formaterDate(rdv.date) : '-')
  );
  carte.appendChild(stats);

  carte.appendChild(el('h3', 'db-rapport__titre', 'Chronologie'));
  const tableau = el('table', 'db-table');
  const tete = el('thead');
  const ligneTete = el('tr');
  for (const t of ['Date', 'Étape', 'Délai depuis l’étape précédente']) ligneTete.appendChild(el('th', null, t));
  tete.appendChild(ligneTete);
  const corps = el('tbody');
  for (const c of chronologie(jalons)) {
    const ligne = el('tr');
    ligne.append(el('td', null, formaterDate(c.date, c.type)), el('td', null, c.libelle), el('td', null, formaterDelai(c.delaiDepuisPrecedent)));
    corps.appendChild(ligne);
  }
  tableau.append(tete, corps);
  const defilement = el('div', 'db-table-defilement');
  defilement.appendChild(tableau);
  carte.appendChild(defilement);
  return carte;
}

export async function vueRapport() {
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><p>Chargement…</p></main>';

  let demandes;
  let groupes;
  try {
    demandes = await listerMesDemandes({ userId: getClientApercuId() });
    const ids = new Set(demandes.map((d) => d.id));
    groupes = grouperParDemande((await listerJalons()).filter((j) => ids.has(j.demande_id)));
  } catch (err) {
    afficherToast(err.message, { type: 'erreur' });
    app.innerHTML = '<main class="conteneur"><h1>Impossible de charger votre rapport</h1></main>';
    return;
  }

  const main = el('main', 'db');
  const imprimable = el('div', 'imprimable db-principale');

  const entete = el('div', 'db-rapport__entete');
  const titre = el('h1', null, 'Mon rapport de projet');
  const imprimer = el('button', 'db-btn db-btn--discret');
  imprimer.type = 'button';
  imprimer.append(icone('printer'), el('span', null, 'Imprimer'));
  imprimer.addEventListener('click', () => window.print());
  entete.append(titre, imprimer);
  imprimable.appendChild(entete);
  imprimable.appendChild(
    el('p', 'texte-doux', `Suivi de vos demandes au ${new Date().toLocaleDateString('fr-FR')} : avancement, délais et dates importantes.`)
  );

  if (demandes.length === 0) imprimable.appendChild(el('p', 'texte-doux', 'Aucune demande pour le moment.'));
  const maintenant = new Date();
  const ordonnees = [...demandes].sort((a, b) => Number(STATUTS_FINAUX.has(a.statut)) - Number(STATUTS_FINAUX.has(b.statut)));
  for (const demande of ordonnees) {
    const jalons = groupes.find((g) => g.demande_id === demande.id)?.jalons ?? [];
    imprimable.appendChild(construireRapport(demande, jalons, maintenant));
  }

  main.appendChild(imprimable);
  app.innerHTML = '';
  app.appendChild(main);
  if (window.lucide) window.lucide.createIcons();
}
