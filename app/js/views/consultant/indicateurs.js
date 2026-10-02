// Indicateurs de performance (admin) : délais de réponse et de traitement,
// taux de conversion - calculés à partir des jalons (rpc_jalons). Section 4.2.
import { listerJalons } from '../../services/jalons.js';
import { afficherToast } from '../../components/toast.js';
import { el, construireKpis } from '../../components/dashboard-ui.js';
import { grouperParDemande, delaisDemande, calculerKpis, formaterDelai, ETAPES_DELAIS } from '../../engine/jalons.js';

export function formaterTaux(taux) {
  return taux == null ? '-' : `${Math.round(taux * 100)} %`;
}

function titre(texte) {
  return el('h2', 'db-titre', texte);
}

function tableau(colonnes, lignes) {
  const t = el('table', 'db-table');
  const tete = el('thead');
  const ligneTete = el('tr');
  for (const c of colonnes) ligneTete.appendChild(el('th', null, c));
  tete.appendChild(ligneTete);
  const corps = el('tbody');
  for (const cellules of lignes) {
    const ligne = el('tr');
    for (const cellule of cellules) {
      const td = el('td');
      if (cellule instanceof Node) td.appendChild(cellule);
      else td.textContent = cellule;
      ligne.appendChild(td);
    }
    corps.appendChild(ligne);
  }
  t.append(tete, corps);
  const defilement = el('div', 'db-table-defilement');
  defilement.appendChild(t);
  return defilement;
}

function lienDemande(demande) {
  const a = el('a', null, demande.reference);
  a.href = `#/demandes/${demande.reference}`;
  return a;
}

export async function vueIndicateurs() {
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><p>Chargement…</p></main>';

  let groupes;
  try {
    groupes = grouperParDemande(await listerJalons());
  } catch (err) {
    afficherToast(err.message, { type: 'erreur' });
    app.innerHTML = '<main class="conteneur"><h1>Impossible de charger les indicateurs</h1></main>';
    return;
  }

  const kpis = calculerKpis(groupes);
  const main = el('main', 'db');
  main.appendChild(el('h1', null, 'Indicateurs de performance'));
  main.appendChild(
    construireKpis([
      { libelle: 'Demandes (en cours)', valeur: `${kpis.total} (${kpis.enCours})`, nomIcone: 'layout-list' },
      { libelle: 'Taux de conversion', valeur: formaterTaux(kpis.conversion.taux), nomIcone: 'trending-up' },
      { libelle: 'Réponse client (moy.)', valeur: formaterDelai(kpis.delais.reponseClient.moyenne), nomIcone: 'clock' },
      { libelle: 'Prise de RDV (moy.)', valeur: formaterDelai(kpis.delais.priseRdv.moyenne), nomIcone: 'calendar-check' },
    ])
  );

  const moyennes = el('section', 'db-carte');
  moyennes.appendChild(titre('Délais moyens par étape'));
  moyennes.appendChild(
    tableau(
      ['Étape', 'Mesure', 'Délai moyen', 'Demandes'],
      ETAPES_DELAIS.map((e) => [e.libelle, e.detail, formaterDelai(kpis.delais[e.cle].moyenne), String(kpis.delais[e.cle].n)])
    )
  );
  moyennes.appendChild(
    el('p', 'texte-doux', `Conversion : ${kpis.conversion.gagnees} proposition(s) acceptée(s), ${kpis.conversion.perdues} refusée(s).`)
  );
  main.appendChild(moyennes);

  const detail = el('section', 'db-carte');
  detail.appendChild(titre('Détail par demande'));
  detail.appendChild(
    tableau(
      ['Demande', 'Client', ...ETAPES_DELAIS.map((e) => e.libelle)],
      groupes.map((g) => {
        const d = delaisDemande(g.jalons);
        return [lienDemande(g), g.client ?? 'Sans nom', ...ETAPES_DELAIS.map((e) => formaterDelai(d[e.cle]))];
      })
    )
  );
  main.appendChild(detail);

  app.innerHTML = '';
  app.appendChild(main);
}
