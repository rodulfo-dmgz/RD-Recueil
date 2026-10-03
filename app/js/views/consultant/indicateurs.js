// Indicateurs de performance (admin) : délais de réponse et de traitement,
// taux de conversion - calculés à partir des jalons (rpc_jalons). Section 4.2.
import { listerJalons } from '../../services/jalons.js';
import { afficherToast } from '../../components/toast.js';
import { el, construireKpis } from '../../components/dashboard-ui.js';
import { grouperParDemande, delaisDemande, calculerKpis, formaterDelai, ETAPES_DELAIS } from '../../engine/jalons.js';
import { listerMontants } from '../../services/montants.js';
import { listerToutesFactures } from '../../services/factures.js';
import { facturationParMois, kpisFacturation, resteAFacturerGagnees } from '../../engine/facturation.js';
import { agregerPipeline, caSigneParMois, formaterMontant, kpisFinance } from '../../engine/finance.js';

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

  // Montants (HT) : pipeline et CA signé. Leur indisponibilité n'empêche pas la page.
  let montants = null;
  try {
    montants = await listerMontants();
  } catch {
    montants = null;
  }
  if (montants) {
    const kf = kpisFinance(montants);
    main.appendChild(
      construireKpis([
        { libelle: 'Pipeline (HT)', valeur: formaterMontant(kf.pipeline), nomIcone: 'euro' },
        { libelle: 'CA pondéré', valeur: formaterMontant(kf.pondere), nomIcone: 'scale' },
        { libelle: `CA signé ${new Date().getFullYear()}`, valeur: formaterMontant(kf.caSigneAnnee), nomIcone: 'badge-check' },
        { libelle: 'Montant moyen gagné', valeur: formaterMontant(kf.montantMoyenGagne), nomIcone: 'calculator' },
      ])
    );

    const { etapes, total } = agregerPipeline(montants);
    const pipeline = el('section', 'db-carte');
    pipeline.appendChild(titre('Pipeline par étape'));
    pipeline.appendChild(
      tableau(
        ['Étape', 'Demandes', 'Montant', 'Pondéré', 'Sans montant'],
        [...etapes, { libelle: 'Total', ...total }].map((e) => [e.libelle, String(e.nb), formaterMontant(e.montant), formaterMontant(e.pondere), String(e.sansMontant)])
      )
    );
    pipeline.appendChild(el('p', 'texte-doux', 'Demandes en cours uniquement, montants HT (franchise de TVA). Le pondéré applique la probabilité de chaque demande.'));
    main.appendChild(pipeline);

    const mois = caSigneParMois(montants);
    const ca = el('section', 'db-carte');
    ca.appendChild(titre('CA signé des 12 derniers mois'));
    ca.appendChild(
      tableau(
        ['Mois', 'Demandes gagnées', 'CA signé'],
        [...mois.map((m) => [m.libelle, String(m.nb), formaterMontant(m.montant)]), ['Total', String(mois.reduce((n, m) => n + m.nb, 0)), formaterMontant(mois.reduce((t, m) => t + m.montant, 0))]]
      )
    );
    ca.appendChild(el('p', 'texte-doux', 'Daté par l’acceptation de la proposition par le client.'));
    main.appendChild(ca);

    let factures = null;
    try {
      factures = await listerToutesFactures();
    } catch {
      factures = null;
    }
    if (factures) {
      const kfact = kpisFacturation(factures);
      const reste = resteAFacturerGagnees(montants, factures);
      main.appendChild(
        construireKpis([
          { libelle: `Facturé ${kfact.annee}`, valeur: formaterMontant(kfact.factureAnnee), nomIcone: 'receipt' },
          { libelle: `Encaissé ${kfact.annee}`, valeur: formaterMontant(kfact.encaisseAnnee), nomIcone: 'wallet' },
          { libelle: 'À encaisser', valeur: `${formaterMontant(kfact.aEncaisser)} (${kfact.nbAEncaisser})`, nomIcone: 'hourglass' },
          { libelle: 'Gagné, à facturer', valeur: `${formaterMontant(reste.montant)} (${reste.nbDemandes})`, nomIcone: 'file-plus' },
        ])
      );
      const parMois = facturationParMois(factures);
      const fact = el('section', 'db-carte');
      fact.appendChild(titre('Facturation des 12 derniers mois'));
      fact.appendChild(
        tableau(
          ['Mois', 'Facturé', 'Encaissé'],
          [...parMois.map((m) => [m.libelle, formaterMontant(m.facture), formaterMontant(m.encaisse)]), ['Total', formaterMontant(parMois.reduce((t, m) => t + m.facture, 0)), formaterMontant(parMois.reduce((t, m) => t + m.encaisse, 0))]]
        )
      );
      fact.appendChild(el('p', 'texte-doux', 'Facturé : daté par l’émission de la facture. Encaissé : daté par le paiement. « Gagné, à facturer » : demandes gagnées dont le montant n’est pas encore entièrement facturé. Montants HT (franchise de TVA).'));
      main.appendChild(fact);
    }
  }

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
