// Ligne d'une tâche (CRM, lot B) : fiche client, page des tâches et bloc
// "Aujourd'hui" du tableau de bord. Bouton rond pour terminer, échéance en
// clair, report rapide, suppression facultative.
import { el, icone } from './dashboard-ui.js';
import { nomComplet } from '../engine/fiche-client.js';
import { ajouterJours, joursDeRetard, libelleEcheance, libelleTypeTache } from '../engine/taches.js';
import { cleJour } from '../engine/jalons.js';

const REPORTS = [
  { valeur: '1', libelle: 'Demain' },
  { valeur: '3', libelle: 'Dans 3 jours' },
  { valeur: '7', libelle: 'Dans 1 semaine' },
];

function nomResponsable(profil) {
  return profil?.nom || profil?.email || null;
}

// Nouvelle échéance après un report de `jours` jours à partir d'aujourd'hui.
export function echeanceApresReport(jours) {
  return ajouterJours(cleJour(new Date()), jours);
}

// opts : estAdmin, profilId (pour afficher le responsable quand ce n'est pas
// soi), avecClient (nom du client en lien vers sa fiche), onTerminer,
// onReporter(jours), onSupprimer (facultatif : sans lui, pas de bouton).
export function construireLigneTache(tache, { estAdmin = false, profilId = null, avecClient = false, onTerminer, onReporter, onSupprimer }) {
  const retard = joursDeRetard(tache.echeance);
  const ligne = el('li', `cl-tache${retard > 0 ? ' cl-tache--retard' : ''}`);

  const fait = el('button', 'cl-tache__fait');
  fait.type = 'button';
  fait.setAttribute('aria-label', `Marquer comme terminée : ${tache.titre}`);
  fait.appendChild(icone('check'));
  fait.addEventListener('click', onTerminer);

  const corps = el('div', 'cl-tache__corps');
  corps.appendChild(el('strong', null, tache.titre));
  if (avecClient && tache.clients?.raison_sociale) {
    const lien = el('a', 'cl-tache__client', tache.clients.raison_sociale);
    lien.href = `#/clients/${tache.client_id}/activite`;
    corps.appendChild(lien);
  }
  const meta = el('p', 'cl-tache__meta texte-doux');
  const morceaux = [libelleTypeTache(tache.type), libelleEcheance(tache.echeance)];
  if (tache.contacts) morceaux.push(nomComplet(tache.contacts));
  if (tache.demandes?.reference) morceaux.push(tache.demandes.reference);
  if ((estAdmin || tache.assignee_id !== profilId) && tache.assignee) morceaux.push(`Responsable : ${nomResponsable(tache.assignee)}`);
  meta.textContent = morceaux.filter(Boolean).join(' · ');
  corps.appendChild(meta);
  if (tache.description) corps.appendChild(el('p', 'cl-tache__description', tache.description));

  const actions = el('div', 'cl-tache__actions');
  const reporter = el('select', 'champ-saisie cl-tache__reporter');
  reporter.setAttribute('aria-label', `Reporter : ${tache.titre}`);
  reporter.appendChild(Object.assign(document.createElement('option'), { value: '', textContent: 'Reporter…' }));
  for (const r of REPORTS) reporter.appendChild(Object.assign(document.createElement('option'), { value: r.valeur, textContent: r.libelle }));
  reporter.addEventListener('change', () => reporter.value && onReporter(Number(reporter.value)));
  actions.appendChild(reporter);
  if (onSupprimer) {
    const supprimer = el('button', 'db-btn db-btn--discret');
    supprimer.type = 'button';
    supprimer.setAttribute('aria-label', `Supprimer la tâche : ${tache.titre}`);
    supprimer.appendChild(icone('trash-2'));
    supprimer.addEventListener('click', onSupprimer);
    actions.appendChild(supprimer);
  }

  ligne.append(fait, corps, actions);
  return ligne;
}
