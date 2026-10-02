// Tableau de bord client (page d'accueil) : demandes, suivi, documents, charte
// RGPD - 01_ARCHITECTURE.md section 4.1.
import { listerMesDemandes } from '../../services/demandes.js';
import { listerDocumentsClient } from '../../services/documents.js';
import { calculerPourcentage } from './mes-demandes.js';
import { getProfil } from '../../store.js';
import { afficherToast } from '../../components/toast.js';
import { ETAPES_SUIVI, etapeCourante, prochaineAction } from '../../engine/suivi.js';
import { LIBELLES_STATUT, STATUTS_FINAUX, categorieStatut } from '../../engine/statuts.js';

const TELEPHONE = '07 66 62 60 19';

function el(tag, className, texte) {
  const noeud = document.createElement(tag);
  if (className) noeud.className = className;
  if (texte != null) noeud.textContent = texte;
  return noeud;
}

function icone(nom) {
  const i = document.createElement('i');
  i.setAttribute('data-lucide', nom);
  i.setAttribute('aria-hidden', 'true');
  return i;
}

function prenomDe(profil) {
  const source = profil?.nom || profil?.email?.split('@')[0] || '';
  const premier = source.trim().split(/\s+/)[0] || '';
  return premier ? premier.charAt(0).toUpperCase() + premier.slice(1).toLowerCase() : '';
}

function salutation(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

function lienBouton(href, classe, texte, nomIcone) {
  const a = el('a', classe);
  a.href = href;
  if (nomIcone) a.appendChild(icone(nomIcone));
  a.appendChild(el('span', null, texte));
  return a;
}

function construireHero(profil, actionPrincipale) {
  const hero = el('section', 'db-hero');
  const contenu = el('div', 'db-hero__contenu');

  const eyebrow = el('div', 'db-hero__eyebrow');
  eyebrow.appendChild(
    el('span', 'db-hero__date', new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))
  );
  const badge = el('span', 'db-hero__badge');
  badge.append(icone('user-round'), el('span', null, 'Espace client'));
  eyebrow.appendChild(badge);
  contenu.appendChild(eyebrow);

  const prenom = prenomDe(profil);
  contenu.appendChild(el('h1', 'db-hero__titre', `${salutation()}${prenom ? `, ${prenom}` : ''} !`));
  contenu.appendChild(
    el('p', 'db-hero__sous-titre', 'Suivez vos demandes, retrouvez vos documents et avancez à votre rythme.')
  );

  const actions = el('div', 'db-hero__actions');
  actions.appendChild(
    actionPrincipale
      ? lienBouton(actionPrincipale.href, 'db-btn db-btn--accent', actionPrincipale.libelle, 'arrow-right')
      : lienBouton('#/mes-demandes', 'db-btn db-btn--accent', 'Voir mes demandes', 'layout-list')
  );
  actions.appendChild(lienBouton('#/documents', 'db-btn db-btn--verre', 'Mes documents', 'folder-open'));
  contenu.appendChild(actions);

  hero.appendChild(contenu);
  const embleme = el('div', 'db-hero__embleme');
  embleme.setAttribute('aria-hidden', 'true');
  embleme.appendChild(icone('shield-check'));
  hero.appendChild(embleme);
  return hero;
}

function construireKpis({ total, enCours, aFaire, documents }) {
  const barre = el('section', 'db-kpis');
  const kpis = [
    { libelle: 'Demandes', valeur: total, nomIcone: 'layout-list' },
    { libelle: 'En cours', valeur: enCours, nomIcone: 'clock' },
    { libelle: 'Actions à faire', valeur: aFaire, nomIcone: 'circle-alert', accent: aFaire > 0 },
    { libelle: 'Documents', valeur: documents, nomIcone: 'folder-open' },
  ];
  for (const k of kpis) {
    const carte = el('div', 'db-kpi');
    const tete = el('div', 'db-kpi__tete');
    tete.append(icone(k.nomIcone), el('span', 'db-kpi__libelle', k.libelle));
    carte.append(tete, el('span', k.accent ? 'db-kpi__valeur db-kpi__valeur--accent' : 'db-kpi__valeur', String(k.valeur)));
    barre.appendChild(carte);
  }
  return barre;
}

function construireEtapes(statut) {
  const courante = etapeCourante(statut);
  const liste = el('ol', 'db-etapes');
  ETAPES_SUIVI.forEach((etape, index) => {
    const etat = index < courante ? 'fait' : index === courante ? 'courant' : 'avenir';
    const li = el('li', `db-etape db-etape--${etat}`);
    if (etat === 'courant') li.setAttribute('aria-current', 'step');
    const puce = el('span', 'db-etape__puce');
    if (etat === 'fait') puce.appendChild(icone('check'));
    else puce.textContent = String(index + 1);
    li.append(puce, el('span', 'db-etape__libelle', etape.libelle));
    liste.appendChild(li);
  });
  return liste;
}

function construireSuivi(demande, pourcentage) {
  const carte = el('article', 'db-carte db-suivi');

  const entete = el('div', 'db-suivi__entete');
  entete.appendChild(el('h3', 'db-suivi__reference', demande.reference));
  entete.appendChild(
    el(
      'span',
      `demande-carte__statut demande-carte__statut--${categorieStatut(demande.statut)}`,
      LIBELLES_STATUT[demande.statut] || demande.statut
    )
  );
  carte.appendChild(entete);

  carte.appendChild(construireEtapes(demande.statut));

  if (pourcentage != null && ['brouillon', 'envoyee', 'en_saisie'].includes(demande.statut)) {
    const progression = el('div', 'db-suivi__progression');
    const barre = el('span', 'db-barre');
    const rempli = el('span', 'db-barre__rempli');
    rempli.style.width = `${pourcentage}%`;
    barre.appendChild(rempli);
    progression.append(barre, el('span', 'db-suivi__pourcentage', `${pourcentage}% complété`));
    carte.appendChild(progression);
  }

  const action = prochaineAction(demande.statut, demande.reference);
  const pied = el('div', `db-suivi__pied db-suivi__pied--${action.type}`);
  pied.appendChild(el('p', 'db-suivi__action', action.libelle));
  if (action.href) {
    pied.appendChild(
      lienBouton(action.href, action.type === 'action' ? 'db-btn db-btn--primaire' : 'db-btn db-btn--discret', action.type === 'action' ? 'Continuer' : 'Voir', 'arrow-right')
    );
  } else if (action.type !== 'termine') {
    pied.appendChild(lienBouton(`#/d/${demande.reference}`, 'db-btn db-btn--discret', 'Voir la demande', 'arrow-right'));
  } else {
    pied.appendChild(lienBouton(`#/d/${demande.reference}`, 'db-btn db-btn--discret', 'Consulter', 'arrow-right'));
  }
  carte.appendChild(pied);
  return carte;
}

function construireAcces({ total, documents }) {
  const grille = el('div', 'db-acces');
  const cartes = [
    { href: '#/mes-demandes', nomIcone: 'layout-list', titre: 'Mes demandes', sous: `${total} demande${total > 1 ? 's' : ''}` },
    { href: '#/documents', nomIcone: 'folder-open', titre: 'Mes documents', sous: `${documents} document${documents > 1 ? 's' : ''}` },
    { href: '#/charte-rgpd', nomIcone: 'shield-check', titre: 'Charte RGPD', sous: 'Vos données et vos droits' },
    { href: '#/glossaire', nomIcone: 'book-open', titre: 'Glossaire', sous: 'Définitions des termes' },
  ];
  for (const c of cartes) {
    const a = el('a', 'db-acces__carte');
    a.href = c.href;
    const pastille = el('span', 'db-acces__icone');
    pastille.appendChild(icone(c.nomIcone));
    const texte = el('span', 'db-acces__texte');
    texte.append(el('strong', null, c.titre), el('small', null, c.sous));
    a.append(pastille, texte, icone('arrow-right'));
    grille.appendChild(a);
  }
  return grille;
}

function construireLateral(actionPrincipale, demandePrincipale) {
  const colonne = el('aside', 'db-lateral');

  const prochaine = el('section', 'db-carte');
  const titre = el('h2', 'db-titre');
  titre.append(icone('flag'), el('span', null, 'Prochaine étape'));
  prochaine.appendChild(titre);
  if (demandePrincipale) {
    const action = prochaineAction(demandePrincipale.statut, demandePrincipale.reference);
    prochaine.appendChild(el('p', 'db-lateral__reference', demandePrincipale.reference));
    prochaine.appendChild(el('p', 'db-lateral__texte', action.libelle));
    if (actionPrincipale) {
      prochaine.appendChild(lienBouton(actionPrincipale.href, 'db-btn db-btn--primaire', 'Continuer', 'arrow-right'));
    }
  } else {
    prochaine.appendChild(el('p', 'db-lateral__texte texte-doux', 'Aucune demande en cours pour le moment.'));
  }
  colonne.appendChild(prochaine);

  const aide = el('section', 'db-carte');
  const titreAide = el('h2', 'db-titre');
  titreAide.append(icone('life-buoy'), el('span', null, 'Besoin d’aide ?'));
  aide.appendChild(titreAide);
  aide.appendChild(el('p', 'db-lateral__texte', 'Votre consultant RD Formation vous répond du lundi au vendredi.'));
  const tel = el('a', 'db-lateral__contact');
  tel.href = `tel:${TELEPHONE.replace(/\s/g, '')}`;
  tel.append(icone('phone'), el('span', null, TELEPHONE));
  aide.appendChild(tel);
  colonne.appendChild(aide);
  return colonne;
}

export async function vueDashboardClient() {
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><p>Chargement…</p></main>';

  let demandes;
  let documents;
  let pourcentages;
  try {
    demandes = await listerMesDemandes();
    documents = await listerDocumentsClient(demandes.map((d) => d.id));
    const actives = demandes.filter((d) => !STATUTS_FINAUX.has(d.statut)).slice(0, 3);
    pourcentages = new Map(await Promise.all(actives.map(async (d) => [d.id, await calculerPourcentage(d)])));
  } catch (err) {
    afficherToast(err.message, { type: 'erreur' });
    app.innerHTML = '<main class="conteneur"><h1>Impossible de charger votre tableau de bord</h1></main>';
    return;
  }

  const enCours = demandes.filter((d) => !STATUTS_FINAUX.has(d.statut));
  const avecAction = enCours.filter((d) => prochaineAction(d.statut, d.reference).type === 'action');
  const demandePrincipale = avecAction[0] ?? enCours[0] ?? null;
  const actionPrincipale = avecAction[0] ? prochaineAction(avecAction[0].statut, avecAction[0].reference) : null;
  const nbDocuments = documents.notes.length + documents.propositions.length + documents.fichiers.length;

  const main = el('main', 'db');
  main.appendChild(construireHero(getProfil(), actionPrincipale));
  main.appendChild(
    construireKpis({ total: demandes.length, enCours: enCours.length, aFaire: avecAction.length, documents: nbDocuments })
  );

  const grille = el('div', 'db-grille');
  const principale = el('div', 'db-principale');

  const titreSuivi = el('h2', 'db-titre');
  titreSuivi.append(icone('route'), el('span', null, 'Suivi de mes demandes'));
  principale.appendChild(titreSuivi);
  if (enCours.length === 0) {
    principale.appendChild(el('p', 'db-vide texte-doux', 'Aucune demande en cours pour le moment.'));
  }
  for (const d of enCours.slice(0, 3)) {
    principale.appendChild(construireSuivi(d, pourcentages.get(d.id)));
  }
  if (enCours.length > 3) {
    principale.appendChild(lienBouton('#/mes-demandes', 'db-btn db-btn--discret', `Voir les ${enCours.length} demandes`, 'arrow-right'));
  }

  const titreAcces = el('h2', 'db-titre');
  titreAcces.append(icone('layout-dashboard'), el('span', null, 'Accès rapide'));
  principale.appendChild(titreAcces);
  principale.appendChild(construireAcces({ total: demandes.length, documents: nbDocuments }));

  grille.append(principale, construireLateral(actionPrincipale, demandePrincipale));
  main.appendChild(grille);

  app.innerHTML = '';
  app.appendChild(main);
  if (window.lucide) window.lucide.createIcons();
}
