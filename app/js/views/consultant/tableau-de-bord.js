// Tableau de bord consultant/admin : même présentation que celui du client
// (bandeau, indicateurs) et mêmes cinq étapes de suivi, pour que le
// consultant voie les demandes comme le client les voit - section 4.2.
import { listerDemandes, listerDemandesInactives } from '../../services/demandes.js';
import { getProfil } from '../../store.js';
import { afficherToast } from '../../components/toast.js';
import { el, icone, lienBouton, prenomDe, salutation, construireHero, construireKpis } from '../../components/dashboard-ui.js';
import { ETAPES_SUIVI, etapeCourante, actionConsultant } from '../../engine/suivi.js';
import { listerJalons } from '../../services/jalons.js';
import { grouperParDemande, calculerKpis, formaterDelai } from '../../engine/jalons.js';
import { formaterTaux } from './indicateurs.js';
import { LIBELLES_STATUT, STATUTS_FINAUX } from '../../engine/statuts.js';

const LIBELLES_ROLE = { admin: 'Administrateur', consultant: 'Espace consultant' };
const MAX_PAR_ETAPE = 5;

function societe(demande) {
  return demande.clients?.raison_sociale ?? 'Sans nom';
}

function titreSection(nomIcone, texte) {
  const h2 = el('h2', 'db-titre');
  h2.append(icone(nomIcone), el('span', null, texte));
  return h2;
}

function ligneDemande(demande, detail, bouton) {
  const ligne = el('a', 'db-ligne');
  ligne.href = `#/demandes/${demande.reference}`;
  const texte = el('span', 'db-ligne__texte');
  texte.append(el('strong', null, demande.reference), el('small', null, `${societe(demande)}${detail ? ` · ${detail}` : ''}`));
  ligne.appendChild(texte);
  if (bouton) ligne.appendChild(el('span', 'db-ligne__action', bouton));
  ligne.appendChild(icone('arrow-right'));
  return ligne;
}

function carteAlerte(nomIcone, titre, demandes, detail) {
  const carte = el('section', 'db-carte db-carte--alerte');
  carte.appendChild(titreSection(nomIcone, titre));
  const liste = el('div', 'db-lignes');
  for (const d of demandes) liste.appendChild(ligneDemande(d, detail?.(d)));
  carte.appendChild(liste);
  return carte;
}

function construirePipeline(demandes) {
  const grille = el('div', 'db-pipeline');
  ETAPES_SUIVI.forEach((etape, index) => {
    const dans = demandes.filter((d) => etapeCourante(d.statut) === index);
    const colonne = el('section', 'db-carte db-pipeline__colonne');
    const tete = el('div', 'db-pipeline__tete');
    tete.append(el('span', 'db-pipeline__numero', String(index + 1)), el('h3', null, etape.libelle), el('span', 'db-pipeline__total', String(dans.length)));
    colonne.appendChild(tete);

    if (dans.length === 0) colonne.appendChild(el('p', 'db-vide texte-doux', 'Aucune demande'));
    const liste = el('div', 'db-lignes');
    for (const d of dans.slice(0, MAX_PAR_ETAPE)) liste.appendChild(ligneDemande(d, LIBELLES_STATUT[d.statut] || d.statut));
    colonne.appendChild(liste);
    if (dans.length > MAX_PAR_ETAPE) {
      colonne.appendChild(lienBouton('#/demandes', 'db-btn db-btn--discret', `Voir les ${dans.length} demandes`, 'arrow-right'));
    }
    grille.appendChild(colonne);
  });
  return grille;
}

export async function vueTableauDeBord() {
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><p>Chargement…</p></main>';

  let demandes;
  let inactives;
  try {
    [demandes, inactives] = await Promise.all([listerDemandes(), listerDemandesInactives()]);
  } catch (err) {
    afficherToast(err.message, { type: 'erreur' });
    app.innerHTML = '<main class="conteneur"><h1>Impossible de charger le tableau de bord</h1></main>';
    return;
  }

  const profil = getProfil();
  let kpisDelais = null;
  if (profil?.role === 'admin') {
    try {
      kpisDelais = calculerKpis(grouperParDemande(await listerJalons()));
    } catch {
      // indicateurs indisponibles : le reste du tableau de bord s'affiche.
    }
  }
  const actives = demandes.filter((d) => !STATUTS_FINAUX.has(d.statut));
  const aTraiter = actives.filter((d) => actionConsultant(d.statut));
  const dansCinqJours = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  const echeances = actives.filter((d) => d.date_limite && new Date(d.date_limite) <= dansCinqJours);

  const prenom = prenomDe(profil);
  const main = el('main', 'db');
  main.appendChild(
    construireHero({
      badge: LIBELLES_ROLE[profil?.role] || 'Espace consultant',
      titre: `${salutation()}${prenom ? `, ${prenom}` : ''} !`,
      sousTitre: 'Suivez les demandes de vos clients et les actions à mener, étape par étape.',
      actions: [
        lienBouton('#/demandes/nouvelle', 'db-btn db-btn--accent', 'Nouvelle demande', 'plus'),
        lienBouton('#/demandes', 'db-btn db-btn--verre', 'Toutes les demandes', 'list'),
      ],
    })
  );
  main.appendChild(
    construireKpis([
      { libelle: 'Demandes actives', valeur: actives.length, nomIcone: 'layout-list' },
      { libelle: 'À traiter', valeur: aTraiter.length, nomIcone: 'circle-alert', accent: aTraiter.length > 0 },
      { libelle: 'Échéances proches', valeur: echeances.length, nomIcone: 'calendar-clock', accent: echeances.length > 0 },
      { libelle: 'Sans réponse (7 j)', valeur: inactives.length, nomIcone: 'hourglass' },
    ])
  );

  if (kpisDelais) {
    main.appendChild(
      construireKpis([
        { libelle: 'Réponse client (moy.)', valeur: formaterDelai(kpisDelais.delais.reponseClient.moyenne), nomIcone: 'clock' },
        { libelle: 'Prise de RDV (moy.)', valeur: formaterDelai(kpisDelais.delais.priseRdv.moyenne), nomIcone: 'calendar-check' },
        { libelle: 'Signature note (moy.)', valeur: formaterDelai(kpisDelais.delais.signatureNote.moyenne), nomIcone: 'pen-line' },
        { libelle: 'Taux de conversion', valeur: formaterTaux(kpisDelais.conversion.taux), nomIcone: 'trending-up' },
      ])
    );
    main.appendChild(lienBouton('#/indicateurs', 'db-btn db-btn--discret db-btn--lien', 'Tous les indicateurs', 'chart-column'));
  }

  const principale = el('div', 'db-principale');

  principale.appendChild(titreSection('list-checks', 'À traiter'));
  if (aTraiter.length === 0) {
    principale.appendChild(el('p', 'db-vide texte-doux', 'Rien à traiter pour le moment.'));
  } else {
    const carte = el('section', 'db-carte');
    const liste = el('div', 'db-lignes');
    for (const d of aTraiter) liste.appendChild(ligneDemande(d, null, actionConsultant(d.statut)));
    carte.appendChild(liste);
    principale.appendChild(carte);
  }

  if (echeances.length > 0) {
    principale.appendChild(
      carteAlerte('calendar-clock', `${echeances.length} demande(s) à échéance proche`, echeances, (d) => `échéance ${d.date_limite}`)
    );
  }
  if (inactives.length > 0) {
    principale.appendChild(
      carteAlerte('hourglass', `${inactives.length} demande(s) sans réponse depuis plus de 7 jours`, inactives)
    );
  }

  principale.appendChild(titreSection('route', 'Avancement des demandes'));
  if (demandes.length === 0) principale.appendChild(el('p', 'db-vide texte-doux', 'Aucune demande pour le moment.'));
  principale.appendChild(construirePipeline(demandes));

  main.appendChild(principale);
  app.innerHTML = '';
  app.appendChild(main);
  if (window.lucide) window.lucide.createIcons();
}
