import { listerDemandes } from '../../services/demandes.js';
import { genererCsv } from '../../engine/csv.js';
import { afficherToast } from '../../components/toast.js';

const COLONNES_CSV = [
  { libelle: 'Référence', valeur: (d) => d.reference },
  { libelle: 'Client', valeur: (d) => d.clients?.raison_sociale ?? '' },
  { libelle: 'Statut', valeur: (d) => d.statut },
  { libelle: 'Types', valeur: (d) => (d.types || []).join(', ') },
  { libelle: 'Date limite', valeur: (d) => d.date_limite ?? '' },
  { libelle: 'Créée le', valeur: (d) => (d.created_at ? d.created_at.slice(0, 10) : '') },
];

function telechargerCsv(nomFichier, contenu) {
  const blob = new Blob(['﻿' + contenu], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  lien.click();
  URL.revokeObjectURL(url);
}

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

  const boutonExporter = document.createElement('button');
  boutonExporter.type = 'button';
  boutonExporter.className = 'btn btn--secondaire';
  boutonExporter.textContent = 'Exporter en CSV';
  filtres.append(selectStatut, selectType, boutonExporter);
  main.appendChild(filtres);

  const liste = document.createElement('ul');
  liste.className = 'liste-demandes';
  main.appendChild(liste);

  let dernieresDemandes = [];

  boutonExporter.addEventListener('click', () => {
    if (dernieresDemandes.length === 0) {
      afficherToast('Aucune demande à exporter.', { type: 'erreur' });
      return;
    }
    const csv = genererCsv(dernieresDemandes, COLONNES_CSV);
    telechargerCsv(`demandes-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  });

  async function rafraichir() {
    liste.innerHTML = '<li>Chargement…</li>';
    try {
      const demandes = await listerDemandes({
        statut: selectStatut.value || undefined,
        type: selectType.value || undefined,
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
        a.textContent = `${d.reference} — ${d.clients?.raison_sociale ?? 'Sans nom'} — ${d.statut}`;
        li.appendChild(a);
        liste.appendChild(li);
      }
    } catch (err) {
      afficherToast(err.message, { type: 'erreur' });
    }
  }

  selectStatut.addEventListener('change', rafraichir);
  selectType.addEventListener('change', rafraichir);
  rafraichir();

  app.appendChild(main);
}
