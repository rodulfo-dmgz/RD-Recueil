import { listerDemandes } from '../../services/demandes.js';
import { listerResponsables } from '../../services/clients.js';
import { getProfil } from '../../store.js';
import { genererCsv } from '../../engine/csv.js';
import { afficherToast } from '../../components/toast.js';
import { telechargerCsv } from '../../components/telechargement.js';
import { listerMontants } from '../../services/montants.js';
import { libelleSourceMontant } from '../../engine/finance.js';
import { LIBELLES_STATUT, LIBELLES_TYPE, categorieStatut } from '../../engine/statuts.js';
import { formaterDate } from '../../engine/dates.js';
import { el, icone } from '../../components/dashboard-ui.js';
import { construireEtatVide } from '../../components/etat-vide.js';
import { boutonApercu, tableauListe } from '../../components/tableau-liste.js';
import { ouvrirApercuDemande } from '../../components/apercu-demande.js';

const COLONNES_CSV = [
  { libelle: 'Référence', valeur: (d) => d.reference },
  { libelle: 'Client', valeur: (d) => d.clients?.raison_sociale ?? '' },
  { libelle: 'Statut', valeur: (d) => d.statut },
  { libelle: 'Types', valeur: (d) => (d.types || []).join(', ') },
  { libelle: 'Date limite', valeur: (d) => d.date_limite ?? '' },
  { libelle: 'Créée le', valeur: (d) => (d.created_at ? d.created_at.slice(0, 10) : '') },
];

const STATUTS = [
  'brouillon', 'envoyee', 'en_saisie', 'soumise', 'entretien_planifie', 'en_analyse',
  'cadrage_envoye', 'cadrage_a_revoir', 'cadrage_valide', 'proposition_envoyee',
  'gagnee', 'perdue', 'reorientee', 'abandonnee',
];
const TYPES = [
  { valeur: 'FOR', libelle: 'Formation' },
  { valeur: 'PON', libelle: 'Prestation ponctuelle' },
  { valeur: 'MOD', libelle: 'Conception de module' },
  { valeur: 'ING', libelle: 'Ingénierie' },
  { valeur: 'CER', libelle: 'Démarche certifiante' },
];

function nomConsultant(demande) {
  return demande.consultant?.nom || demande.consultant?.email || null;
}

function pastilleStatutDemande(d) {
  const pastille = el('span', `cl-statut cl-statut--${categorieStatut(d.statut)}`);
  pastille.append(el('span', 'cl-statut__point'), LIBELLES_STATUT[d.statut] ?? d.statut);
  if (!d.archivee) return pastille;
  const bloc = el('span');
  bloc.append(pastille, document.createTextNode(' (archivée)'));
  return bloc;
}

function ouvrirApercu(demande, estAdmin) {
  ouvrirApercuDemande(demande, estAdmin ? { consultant: nomConsultant(demande) } : {});
}

function colonnesDemandes(estAdmin) {
  const colonnes = [
    {
      titre: 'Référence',
      icone: 'hash',
      largeur: 190,
      figee: true,
      tri: (d) => d.reference,
      rendu: (d) => {
        const lien = el('a', 'cl-nom', d.reference);
        lien.href = `#/demandes/${d.reference}`;
        const bloc = el('div', 'cl-nom-ligne');
        const cible = el('div');
        cible.appendChild(lien);
        bloc.append(cible, boutonApercu(`Aperçu de ${d.reference}`, () => ouvrirApercu(d, estAdmin)));
        return bloc;
      },
    },
    { titre: 'Client', icone: 'building-2', largeur: 240, tri: (d) => d.clients?.raison_sociale, rendu: (d) => d.clients?.raison_sociale ?? 'Sans nom' },
    { titre: 'Statut', icone: 'circle-dot', largeur: 190, tri: (d) => LIBELLES_STATUT[d.statut] ?? d.statut, rendu: pastilleStatutDemande },
    { titre: 'Types', icone: 'tags', largeur: 220, rendu: (d) => (d.types || []).map((t) => LIBELLES_TYPE[t] ?? t).join(', ') },
  ];
  if (estAdmin) colonnes.push({ titre: 'Consultant', icone: 'user-round', largeur: 200, tri: (d) => nomConsultant(d), rendu: (d) => nomConsultant(d) ?? 'Non attribuée' });
  colonnes.push(
    { titre: 'Date limite', icone: 'calendar', largeur: 150, tri: (d) => d.date_limite, rendu: (d) => (d.date_limite ? formaterDate(d.date_limite) : '') },
    { titre: 'Créée le', icone: 'clock', largeur: 150, tri: (d) => d.created_at, rendu: (d) => formaterDate(d.created_at) }
  );
  return colonnes;
}

export function vueListeDemandes() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  const main = el('main', 'db page-liste');

  const entete = el('div', 'cl-entete');
  entete.appendChild(el('h1', null, 'Demandes'));
  const actions = el('div', 'cl-entete__actions');
  entete.appendChild(actions);
  main.appendChild(entete);

  const filtres = el('div', 'cl-filtres');

  const selectStatut = document.createElement('select');
  selectStatut.className = 'champ-saisie cl-statut-filtre';
  selectStatut.setAttribute('aria-label', 'Filtrer par statut');
  selectStatut.innerHTML =
    '<option value="">Toutes les demandes</option>' + STATUTS.map((s) => `<option value="${s}">${LIBELLES_STATUT[s] ?? s}</option>`).join('');
  const nombreVue = el('span', 'cl-vue-nombre texte-doux');

  const selectType = document.createElement('select');
  selectType.className = 'champ-saisie cl-statut-filtre';
  selectType.setAttribute('aria-label', 'Filtrer par type');
  selectType.innerHTML =
    '<option value="">Tous types</option>' +
    TYPES.map((t) => `<option value="${t.valeur}">${t.libelle}</option>`).join('');

  // Colonne et filtre "Consultant" : réservés à l'admin, seul à voir toutes les
  // demandes (un consultant ne voit que les siennes, lot Accès).
  const estAdmin = getProfil()?.role === 'admin';
  const selectConsultant = document.createElement('select');
  selectConsultant.className = 'champ-saisie cl-statut-filtre';
  selectConsultant.setAttribute('aria-label', 'Filtrer par consultant');
  selectConsultant.hidden = !estAdmin;
  selectConsultant.innerHTML = '<option value="">Tous les consultants</option><option value="aucun">Non attribuées</option>';

  const labelArchivees = document.createElement('label');
  labelArchivees.className = 'champ-question__nsp';
  const caseArchivees = document.createElement('input');
  caseArchivees.type = 'checkbox';
  labelArchivees.append(caseArchivees, ' Afficher les demandes archivées');

  const boutonExporter = document.createElement('button');
  boutonExporter.type = 'button';
  boutonExporter.className = 'db-btn db-btn--discret';
  boutonExporter.append(icone('download'), el('span', null, 'Exporter en CSV'));
  actions.appendChild(boutonExporter);
  filtres.append(selectStatut, nombreVue, selectType, selectConsultant, labelArchivees);
  main.appendChild(filtres);

  const carte = el('section', 'db-carte');
  const liste = el('div');
  carte.appendChild(liste);
  main.appendChild(carte);

  let dernieresDemandes = [];

  boutonExporter.addEventListener('click', async () => {
    if (dernieresDemandes.length === 0) {
      afficherToast('Aucune demande à exporter.', { type: 'erreur' });
      return;
    }
    // Montants (HT) ajoutés quand ils sont disponibles ; sinon l'export reste possible sans eux.
    let colonnes = estAdmin ? [...COLONNES_CSV, { libelle: 'Consultant', valeur: (d) => nomConsultant(d) ?? '' }] : COLONNES_CSV;
    try {
      const parDemande = new Map((await listerMontants()).map((m) => [m.demande_id, m]));
      colonnes = [
        ...colonnes,
        { libelle: 'Montant HT', valeur: (d) => parDemande.get(d.id)?.montant_retenu ?? '' },
        { libelle: 'Source du montant', valeur: (d) => (parDemande.has(d.id) ? libelleSourceMontant(parDemande.get(d.id).source_montant) : '') },
      ];
    } catch {
      // montants indisponibles : l'export garde les colonnes déjà prévues.
    }
    const csv = genererCsv(dernieresDemandes, colonnes);
    telechargerCsv(`demandes-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  });

  async function rafraichir() {
    liste.innerHTML = '<p class="texte-doux">Chargement…</p>';
    try {
      const demandes = await listerDemandes({
        statut: selectStatut.value || undefined,
        type: selectType.value || undefined,
        consultantId: estAdmin ? selectConsultant.value || undefined : undefined,
        inclureArchivees: caseArchivees.checked,
      });
      dernieresDemandes = demandes;
      nombreVue.textContent = `· ${demandes.length}`;
      liste.innerHTML = '';
      if (demandes.length === 0) {
        liste.appendChild(construireEtatVide({ icone: 'layout-list', titre: 'Aucune demande', texte: 'Aucune demande ne correspond à ces filtres.' }));
        return;
      }
      liste.appendChild(
        tableauListe({
          id: 'demandes',
          colonnes: colonnesDemandes(estAdmin),
          lignes: demandes,
          onLigne: (d) => ouvrirApercu(d, estAdmin),
          libelleTotal: (lignes) => `${lignes.length} demande${lignes.length > 1 ? 's' : ''}`,
        })
      );
      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      afficherToast(err.message, { type: 'erreur' });
    }
  }

  if (estAdmin) {
    listerResponsables()
      .then((responsables) => {
        for (const r of responsables) selectConsultant.appendChild(Object.assign(document.createElement('option'), { value: r.user_id, textContent: r.nom || r.email }));
      })
      .catch((err) => afficherToast(err.message, { type: 'erreur' }));
  }
  selectConsultant.addEventListener('change', rafraichir);
  selectStatut.addEventListener('change', rafraichir);
  selectType.addEventListener('change', rafraichir);
  caseArchivees.addEventListener('change', rafraichir);
  rafraichir();

  app.appendChild(main);
}
