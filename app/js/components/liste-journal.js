// Liste du journal d'audit (admin, CRM lot F) : sur la page "Journal d'audit"
// (avec filtres) et dans l'onglet "Modifications" d'une fiche client (`clientId`).
// Les entrées s'affichent des plus récentes aux plus anciennes, par pages ; le
// détail des colonnes changées s'ouvre sous chaque entrée.
import { listerJournal, TAILLE_PAGE_JOURNAL } from '../services/audit.js';
import { afficherToast } from './toast.js';
import { el } from './dashboard-ui.js';
import { bouton } from './champs-crm.js';
import { TABLES_AUDIT, libelleAction, libelleTable, lienEntree, phraseEntree, resumerChangements } from '../engine/audit.js';

const PERIODES = [
  { valeur: '', libelle: 'Toute la période' },
  { valeur: '1', libelle: 'Dernières 24 heures' },
  { valeur: '7', libelle: '7 derniers jours' },
  { valeur: '30', libelle: '30 derniers jours' },
  { valeur: '365', libelle: '12 derniers mois' },
];

function ligneEntree(entree, noms) {
  const bloc = el('li', 'jr-entree');
  const tete = el('div', 'jr-entree__tete');
  tete.appendChild(el('span', `cl-badge jr-action jr-action--${entree.action}`, libelleAction(entree.action)));
  tete.appendChild(
    el('time', 'jr-entree__date texte-doux', new Date(entree.created_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }))
  );
  bloc.appendChild(tete);

  const phrase = el('p', 'jr-entree__phrase');
  const lien = lienEntree(entree);
  if (lien) {
    const a = el('a', null, phraseEntree(entree));
    a.href = lien;
    phrase.appendChild(a);
  } else {
    phrase.textContent = phraseEntree(entree);
  }
  bloc.appendChild(phrase);

  const lignes = resumerChangements(entree, noms);
  if (lignes.length > 0) {
    const details = el('details', 'jr-entree__details');
    details.appendChild(el('summary', null, `${lignes.length} champ${lignes.length > 1 ? 's' : ''} · ${libelleTable(entree.table_name)}`));
    const liste = el('ul');
    for (const l of lignes) {
      const li = el('li');
      li.appendChild(el('strong', null, `${l.libelle} : `));
      if (l.avant === null) li.appendChild(document.createTextNode(l.apres));
      else if (l.apres === null) li.appendChild(document.createTextNode(l.avant));
      else li.appendChild(document.createTextNode(`${l.avant} → ${l.apres}`));
      liste.appendChild(li);
    }
    details.appendChild(liste);
    bloc.appendChild(details);
  }
  return bloc;
}

// clientId : limite la liste à une fiche (sans filtres). noms : { idCompte: nom }.
// comptes : [{ user_id, nom, email }] pour le filtre "Compte" de la page complète.
export function construireListeJournal({ clientId = null, noms = {}, comptes = [] } = {}) {
  const racine = el('div', 'jr');
  const filtres = el('div', 'cl-filtres');
  const table = el('select', 'champ-saisie cl-statut-filtre');
  table.setAttribute('aria-label', 'Filtrer par type d’élément');
  table.innerHTML = '<option value="">Tous les éléments</option>' + TABLES_AUDIT.map((t) => `<option value="${t.valeur}">${t.libelle}</option>`).join('');
  const periode = el('select', 'champ-saisie cl-statut-filtre');
  periode.setAttribute('aria-label', 'Période');
  periode.innerHTML = PERIODES.map((p) => `<option value="${p.valeur}">${p.libelle}</option>`).join('');
  const compte = el('select', 'champ-saisie cl-statut-filtre');
  compte.setAttribute('aria-label', 'Compte à l’origine du changement');
  compte.innerHTML = '<option value="">Tous les comptes</option>';
  for (const c of comptes) compte.appendChild(Object.assign(document.createElement('option'), { value: c.user_id, textContent: c.nom || c.email }));
  const recherche = el('input', 'champ-saisie cl-recherche');
  recherche.type = 'search';
  recherche.placeholder = 'Rechercher un nom, une référence…';
  recherche.setAttribute('aria-label', 'Rechercher dans le journal');
  if (!clientId) filtres.append(recherche, table, compte, periode);
  racine.appendChild(filtres);

  const liste = el('ul', 'jr-liste');
  const message = el('p', 'texte-doux');
  const plus = bouton('db-btn db-btn--discret', 'Voir les entrées plus anciennes', 'chevrons-down', () => charger(true));
  plus.hidden = true;
  racine.append(message, liste, plus);

  let dernierId = null;
  let version = 0; // une réponse en retard d'un filtre précédent est ignorée

  async function charger(suite = false) {
    const cette = ++version;
    plus.disabled = true;
    if (!suite) {
      liste.innerHTML = '';
      dernierId = null;
      message.textContent = 'Chargement…';
    }
    let depuis;
    if (periode.value) depuis = new Date(Date.now() - Number(periode.value) * 24 * 60 * 60 * 1000).toISOString();
    try {
      const entrees = await listerJournal({
        table: table.value || undefined,
        clientId: clientId || undefined,
        userId: compte.value || undefined,
        depuis,
        recherche: recherche.value,
        avantId: suite ? dernierId : undefined,
      });
      if (cette !== version) return;
      for (const e of entrees) liste.appendChild(ligneEntree(e, noms));
      if (entrees.length > 0) dernierId = entrees.at(-1).id;
      message.textContent = liste.children.length === 0 ? 'Aucune entrée pour ces critères.' : '';
      plus.hidden = entrees.length < TAILLE_PAGE_JOURNAL;
    } catch (err) {
      if (cette !== version) return;
      message.textContent = '';
      afficherToast(err.message, { type: 'erreur' });
    } finally {
      if (cette === version) plus.disabled = false;
    }
  }

  let minuteur = null;
  recherche.addEventListener('input', () => {
    clearTimeout(minuteur);
    minuteur = setTimeout(() => charger(), 250);
  });
  [table, compte, periode].forEach((s) => s.addEventListener('change', () => charger()));
  charger();
  return racine;
}
