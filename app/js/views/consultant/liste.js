import { listerDemandes } from '../../services/demandes.js';
import { listerResponsables } from '../../services/clients.js';
import { getProfil } from '../../store.js';
import { genererCsv } from '../../engine/csv.js';
import { afficherToast } from '../../components/toast.js';
import { telechargerCsv } from '../../components/telechargement.js';
import { listerMontants } from '../../services/montants.js';
import { libelleSourceMontant } from '../../engine/finance.js';

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

export function vueListeDemandes() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  const main = document.createElement('main');
  main.className = 'conteneur';

  const titre = document.createElement('h1');
  titre.textContent = 'Demandes';
  main.appendChild(titre);

  const filtres = document.createElement('div');
  filtres.className = 'liste-demandes__filtres';

  const selectStatut = document.createElement('select');
  selectStatut.className = 'champ-saisie';
  selectStatut.innerHTML =
    '<option value="">Tous statuts</option>' + STATUTS.map((s) => `<option value="${s}">${s}</option>`).join('');

  const selectType = document.createElement('select');
  selectType.className = 'champ-saisie';
  selectType.innerHTML =
    '<option value="">Tous types</option>' +
    TYPES.map((t) => `<option value="${t.valeur}">${t.libelle}</option>`).join('');

  // Colonne et filtre "Consultant" : réservés à l'admin, seul à voir toutes les
  // demandes (un consultant ne voit que les siennes, lot Accès).
  const estAdmin = getProfil()?.role === 'admin';
  const selectConsultant = document.createElement('select');
  selectConsultant.className = 'champ-saisie';
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
  boutonExporter.className = 'btn btn--secondaire';
  boutonExporter.textContent = 'Exporter en CSV';
  filtres.append(selectStatut, selectType, selectConsultant, labelArchivees, boutonExporter);
  main.appendChild(filtres);

  const liste = document.createElement('ul');
  liste.className = 'liste-demandes';
  main.appendChild(liste);

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
    liste.innerHTML = '<li>Chargement…</li>';
    try {
      const demandes = await listerDemandes({
        statut: selectStatut.value || undefined,
        type: selectType.value || undefined,
        consultantId: estAdmin ? selectConsultant.value || undefined : undefined,
        inclureArchivees: caseArchivees.checked,
      });
      dernieresDemandes = demandes;
      liste.innerHTML = '';
      if (demandes.length === 0) {
        liste.innerHTML = '<li>Aucune demande.</li>';
        return;
      }
      for (const d of demandes) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `#/demandes/${d.reference}`;
        a.textContent = `${d.reference} · ${d.clients?.raison_sociale ?? 'Sans nom'} · ${d.statut}${d.archivee ? ' (archivée)' : ''}${estAdmin ? ` · ${nomConsultant(d) ?? 'non attribuée'}` : ''}`;
        li.appendChild(a);
        liste.appendChild(li);
      }
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
