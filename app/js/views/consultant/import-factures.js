// Import des paiements depuis l'export bancaire Shine (admin, CRM lot D). Le
// fichier est lu dans le navigateur, jamais envoyé tel quel : seuls le numéro, les
// dates et le montant des factures retenues sont enregistrés, après aperçu.
import { listerDemandes } from '../../services/demandes.js';
import { listerFacturesImport, appliquerImportFactures } from '../../services/factures.js';
import { afficherToast } from '../../components/toast.js';
import { creerBoutonRetour } from '../../components/bouton-retour.js';
import { el, icone } from '../../components/dashboard-ui.js';
import { bouton } from '../../components/champs-crm.js';
import { formaterMontant } from '../../engine/finance.js';
import { formaterDateCourte } from '../../engine/facturation.js';
import {
  LIBELLES_ETAT_IMPORT,
  analyserExportBanque,
  decoderCsv,
  demandesCorrespondantes,
  extraireFacturesPayees,
  planifierImport,
  preparerApplication,
} from '../../engine/import-shine.js';

const AUTO = { decimales: 'auto' };

function libelleDemande(d) {
  return `${d.reference} · ${d.clients?.raison_sociale ?? 'Sans nom'}`;
}

export async function vueImportFactures() {
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><p>Chargement…</p></main>';

  let demandes;
  try {
    demandes = await listerDemandes({ inclureArchivees: true });
  } catch (err) {
    afficherToast(err.message, { type: 'erreur' });
    app.innerHTML = '<main class="conteneur"><h1>Impossible de charger les demandes</h1></main>';
    return;
  }
  const demandeParId = new Map(demandes.map((d) => [d.id, d]));
  let facturesFichier = null; // { factures, autresCredits, nomFichier }
  const choix = {}; // numéro de facture -> demande_id, pour les factures nouvelles

  const main = el('main', 'db');
  main.appendChild(creerBoutonRetour('#/indicateurs', 'Indicateurs'));
  main.appendChild(el('h1', null, 'Importer les paiements Shine'));

  const intro = el('section', 'db-carte');
  const titreIntro = el('h2', 'db-titre');
  titreIntro.append(icone('file-up'), el('span', null, 'Fichier à importer'));
  intro.appendChild(titreIntro);
  intro.appendChild(
    el(
      'p',
      'texte-doux',
      'Dans Shine, ouvrez « Nouvel export comptable », choisissez « Ponctuel », cochez « CSV » dans Transactions et la période voulue. L’import repère les virements reçus dont la pièce jointe est une facture : il crée la référence de la facture ou ajoute sa date de paiement. Le montant est celui encaissé. Rien n’est supprimé ni écrasé, et le même fichier peut être importé plusieurs fois.'
    )
  );
  const entree = el('input', 'champ-saisie');
  entree.type = 'file';
  entree.accept = '.csv,text/csv';
  entree.setAttribute('aria-label', 'Fichier CSV exporté depuis Shine');
  intro.appendChild(entree);
  main.appendChild(intro);

  const apercu = el('div', 'db-principale');
  main.appendChild(apercu);

  // Annuler : on oublie le fichier et l'aperçu, rien n'a été enregistré.
  function abandonner() {
    facturesFichier = null;
    entree.value = '';
    for (const cle of Object.keys(choix)) delete choix[cle];
    apercu.innerHTML = '';
    entree.focus();
  }

  async function afficher() {
    apercu.innerHTML = '';
    if (!facturesFichier) return;
    let existantes;
    try {
      existantes = await listerFacturesImport();
    } catch (err) {
      afficherToast(err.message, { type: 'erreur' });
      return;
    }
    const plan = planifierImport(facturesFichier.factures, existantes);
    const nb = (etat) => plan.filter((p) => p.etat === etat).length;

    const carte = el('section', 'db-carte');
    const titre = el('h2', 'db-titre');
    titre.append(icone('list-checks'), el('span', null, `Aperçu : ${facturesFichier.nomFichier}`));
    carte.appendChild(titre);
    if (plan.length === 0) {
      carte.appendChild(el('p', 'texte-doux', `Aucune facture payée trouvée dans ce fichier (${facturesFichier.autresCredits} autre(s) virement(s) reçu(s) ignoré(s)).`));
      apercu.appendChild(carte);
      return;
    }
    carte.appendChild(
      el(
        'p',
        'texte-doux',
        `${nb('nouvelle')} nouvelle(s) facture(s), ${nb('paiement_a_enregistrer')} paiement(s) à enregistrer, ${nb('deja_a_jour')} déjà à jour. ${facturesFichier.autresCredits} autre(s) virement(s) reçu(s) sans facture ignoré(s).`
      )
    );

    const enveloppe = el('div', 'db-table-defilement');
    const tableau = el('table', 'db-table');
    const ligneTitres = el('tr');
    ['N°', 'Client (fichier)', 'Émise le', 'Payée le', 'Montant HT', 'Action', 'Demande'].forEach((t) => ligneTitres.appendChild(el('th', null, t)));
    tableau.appendChild(el('thead')).appendChild(ligneTitres);
    const corps = el('tbody');
    for (const f of plan) {
      const ligne = el('tr');
      let cellDemande;
      if (f.etat === 'nouvelle') {
        const select = el('select', 'champ-saisie');
        select.setAttribute('aria-label', `Demande de la facture ${f.numero}`);
        select.appendChild(Object.assign(document.createElement('option'), { value: '', textContent: 'Ne pas importer' }));
        const proposees = demandesCorrespondantes(f.client, demandes);
        const ordre = [...demandes].sort((a, b) => Number(proposees.includes(b.id)) - Number(proposees.includes(a.id)));
        for (const d of ordre) {
          select.appendChild(Object.assign(document.createElement('option'), { value: d.id, textContent: `${proposees.includes(d.id) ? '★ ' : ''}${libelleDemande(d)}` }));
        }
        if (choix[f.numero] === undefined) choix[f.numero] = proposees.length === 1 ? proposees[0] : '';
        select.value = choix[f.numero];
        select.addEventListener('change', () => {
          choix[f.numero] = select.value;
          majBouton();
        });
        cellDemande = select;
      } else {
        const d = demandeParId.get(f.existante.demande_id);
        cellDemande = document.createTextNode(d ? libelleDemande(d) : '');
      }
      const cellules = [f.numero, f.client, formaterDateCourte(f.dateEmission), formaterDateCourte(f.datePaiement), formaterMontant(f.montantHt, AUTO), LIBELLES_ETAT_IMPORT[f.etat]];
      for (const c of cellules) ligne.appendChild(el('td', null, c));
      const td = el('td');
      td.appendChild(cellDemande);
      ligne.appendChild(td);
      corps.appendChild(ligne);
    }
    tableau.appendChild(corps);
    enveloppe.appendChild(tableau);
    carte.appendChild(enveloppe);
    carte.appendChild(el('p', 'texte-doux', '★ : demande dont le client ressemble au nom du fichier. Une facture sans demande choisie n’est pas importée.'));

    const resume = el('p', 'texte-doux');
    const erreurGenerale = el('p', 'cl-champ__erreur');
    erreurGenerale.setAttribute('role', 'alert');
    const appliquer = bouton('db-btn db-btn--primaire', 'Appliquer l’import', 'check', async () => {
      const { creations, paiements } = preparerApplication(plan, choix);
      if (!window.confirm(`Créer ${creations.length} facture(s) et enregistrer ${paiements.length} date(s) de paiement ? Rien n’est supprimé.`)) return;
      appliquer.disabled = true;
      erreurGenerale.textContent = '';
      try {
        const r = await appliquerImportFactures({ creations, paiements });
        afficherToast(`Import terminé : ${r.creees} facture(s) créée(s), ${r.misesAJour} paiement(s) enregistré(s).`, { type: 'succes' });
        await afficher();
      } catch (err) {
        erreurGenerale.textContent = err.message;
        appliquer.disabled = false;
      }
    });
    function majBouton() {
      const r = preparerApplication(plan, choix);
      const total = r.creations.length + r.paiements.length;
      appliquer.disabled = total === 0;
      resume.textContent =
        total === 0
          ? 'Rien à importer pour le moment.'
          : `À importer : ${r.creations.length} facture(s) à créer, ${r.paiements.length} paiement(s) à enregistrer${r.ignorees.length > 0 ? `, ${r.ignorees.length} ignorée(s) faute de demande` : ''}.`;
    }
    majBouton();
    const annuler = bouton('db-btn db-btn--discret', 'Annuler', 'x', abandonner);
    const actions = el('div', 'cl-form__actions');
    actions.append(appliquer, annuler);
    carte.append(resume, erreurGenerale, actions);
    apercu.appendChild(carte);
    if (window.lucide) window.lucide.createIcons();
  }

  entree.addEventListener('change', async () => {
    apercu.innerHTML = '';
    facturesFichier = null;
    const fichier = entree.files?.[0];
    if (!fichier) return;
    try {
      const { mouvements, erreur } = analyserExportBanque(decoderCsv(new Uint8Array(await fichier.arrayBuffer())));
      if (erreur) throw new Error(erreur);
      facturesFichier = { ...extraireFacturesPayees(mouvements), nomFichier: fichier.name };
      for (const cle of Object.keys(choix)) delete choix[cle];
      await afficher();
    } catch (err) {
      apercu.appendChild(el('p', 'cl-champ__erreur', err.message));
    }
  });

  app.innerHTML = '';
  app.appendChild(main);
  if (window.lucide) window.lucide.createIcons();
}
