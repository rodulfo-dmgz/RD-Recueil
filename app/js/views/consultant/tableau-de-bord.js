import { listerDemandes, listerDemandesInactives } from '../../services/demandes.js';
import { afficherToast } from '../../components/toast.js';
import { LIBELLES_STATUT, STATUTS_FINAUX } from '../../engine/statuts.js';

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

  app.innerHTML = '';
  const main = document.createElement('main');
  main.className = 'conteneur';

  const entete = document.createElement('div');
  entete.className = 'tableau-de-bord__entete';
  const titre = document.createElement('h1');
  titre.textContent = 'Tableau de bord';
  const actions = document.createElement('div');
  actions.className = 'tableau-de-bord__actions';
  const lienListe = document.createElement('a');
  lienListe.className = 'btn btn--secondaire';
  lienListe.href = '#/demandes';
  lienListe.textContent = 'Toutes les demandes';
  const boutonNouvelle = document.createElement('a');
  boutonNouvelle.className = 'btn btn--primaire';
  boutonNouvelle.href = '#/demandes/nouvelle';
  boutonNouvelle.textContent = 'Nouvelle demande';
  actions.append(lienListe, boutonNouvelle);
  entete.append(titre, actions);
  main.appendChild(entete);

  // Échéances à J-5 (RM-04).
  const dansCinqJours = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  const echeancesProches = demandes.filter(
    (d) => d.date_limite && new Date(d.date_limite) <= dansCinqJours && !STATUTS_FINAUX.has(d.statut)
  );
  if (echeancesProches.length > 0) {
    const alerte = document.createElement('div');
    alerte.className = 'carte recap-manquantes';
    const h2 = document.createElement('h2');
    h2.textContent = `${echeancesProches.length} demande(s) à échéance proche`;
    alerte.appendChild(h2);
    const liste = document.createElement('ul');
    for (const d of echeancesProches) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#/demandes/${d.reference}`;
      a.textContent = `${d.reference} — ${d.clients?.raison_sociale ?? 'Sans nom'} (${d.date_limite})`;
      li.appendChild(a);
      liste.appendChild(li);
    }
    alerte.appendChild(liste);
    main.appendChild(alerte);
  }

  // Demandes sans réponse depuis plus de 7 jours (section 4.2).
  if (inactives.length > 0) {
    const alerteInactives = document.createElement('div');
    alerteInactives.className = 'carte recap-manquantes';
    const h2 = document.createElement('h2');
    h2.textContent = `${inactives.length} demande(s) sans réponse depuis plus de 7 jours`;
    alerteInactives.appendChild(h2);
    const liste = document.createElement('ul');
    for (const d of inactives) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#/demandes/${d.reference}`;
      a.textContent = `${d.reference} — ${d.clients?.raison_sociale ?? 'Sans nom'}`;
      li.appendChild(a);
      liste.appendChild(li);
    }
    alerteInactives.appendChild(liste);
    main.appendChild(alerteInactives);
  }

  if (demandes.length === 0) {
    const vide = document.createElement('p');
    vide.className = 'texte-doux';
    vide.textContent = 'Aucune demande pour le moment.';
    main.appendChild(vide);
  }

  const groupes = new Map();
  for (const d of demandes) {
    if (!groupes.has(d.statut)) groupes.set(d.statut, []);
    groupes.get(d.statut).push(d);
  }

  for (const [statut, liste] of groupes) {
    const section = document.createElement('section');
    section.className = 'carte tableau-de-bord__groupe';
    const h2 = document.createElement('h2');
    h2.textContent = `${LIBELLES_STATUT[statut] || statut} (${liste.length})`;
    section.appendChild(h2);
    const ul = document.createElement('ul');
    ul.className = 'liste-demandes';
    for (const d of liste) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#/demandes/${d.reference}`;
      a.textContent = `${d.reference} — ${d.clients?.raison_sociale ?? 'Sans nom'}`;
      li.appendChild(a);
      ul.appendChild(li);
    }
    section.appendChild(ul);
    main.appendChild(section);
  }

  app.appendChild(main);
}
