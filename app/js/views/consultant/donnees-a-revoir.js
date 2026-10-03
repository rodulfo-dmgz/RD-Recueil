// Données à revoir (admin, CRM lot F) : fiches sans activité depuis 36 mois ou
// plus (durée de conservation de la section 8.3 de l'architecture) et
// consentements arrivés à expiration. L'écran ne supprime rien : l'admin décide,
// fiche par fiche (archivage, suppression, mise à jour du consentement).
import { listerClientsDetail } from '../../services/clients.js';
import { listerContactsPourRevue, listerConsentementsExpires } from '../../services/consentements.js';
import { afficherToast } from '../../components/toast.js';
import { creerBoutonRetour } from '../../components/bouton-retour.js';
import { el, icone, tableau } from '../../components/dashboard-ui.js';
import { donneesARevoir, libelleTypeConsentement, MOIS_CONSERVATION } from '../../engine/consentements.js';
import { libelleStatutClient } from '../../engine/fiche-client.js';
import { libelleInactivite } from '../../engine/dormants.js';
import { formaterDate } from '../../engine/dates.js';

function lien(href, texte) {
  const a = el('a', 'cl-nom', texte);
  a.href = href;
  return a;
}

export async function vueDonneesARevoir() {
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><p>Chargement…</p></main>';

  let clients;
  let contacts;
  let consentements;
  try {
    [clients, contacts, consentements] = await Promise.all([listerClientsDetail(), listerContactsPourRevue(), listerConsentementsExpires()]);
  } catch (err) {
    afficherToast(err.message, { type: 'erreur' });
    app.innerHTML = '<main class="conteneur"><h1>Impossible de charger les données à revoir</h1></main>';
    return;
  }
  const { fiches, consentementsExpires } = donneesARevoir({ clients, contacts, consentements });

  const main = el('main', 'db');
  main.appendChild(creerBoutonRetour('#/indicateurs', 'Indicateurs'));
  main.appendChild(el('h1', null, 'Données à revoir'));
  main.appendChild(
    el(
      'p',
      'texte-doux',
      `Rien n’est supprimé automatiquement : cet écran signale les fiches à examiner (conservation de ${MOIS_CONSERVATION} mois sans activité) et les consentements expirés. La décision se prend depuis la fiche (archivage, suppression, mise à jour du consentement).`
    )
  );

  const carteFiches = el('section', 'db-carte');
  const titreFiches = el('h2', 'db-titre');
  titreFiches.append(icone('archive'), el('span', null, `Fiches sans activité depuis ${MOIS_CONSERVATION} mois ou plus (${fiches.length})`));
  carteFiches.appendChild(titreFiches);
  if (fiches.length === 0) carteFiches.appendChild(el('p', 'db-vide texte-doux', 'Aucune fiche à revoir.'));
  else {
    carteFiches.appendChild(
      tableau(
        ['Entreprise', 'Statut', 'Dernière activité', 'Inactive depuis', 'Contact principal'],
        fiches.map((f) => [lien(`#/clients/${f.client.id}`, f.client.raison_sociale), libelleStatutClient(f.client.statut), formaterDate(f.client.derniere_activite), libelleInactivite(f.moisInactifs), f.client.contact_principal || '-'])
      )
    );
  }
  main.appendChild(carteFiches);

  const carteConsentements = el('section', 'db-carte');
  const titreConsentements = el('h2', 'db-titre');
  titreConsentements.append(icone('shield-alert'), el('span', null, `Consentements expirés (${consentementsExpires.length})`));
  carteConsentements.appendChild(titreConsentements);
  if (consentementsExpires.length === 0) carteConsentements.appendChild(el('p', 'db-vide texte-doux', 'Aucun consentement expiré.'));
  else {
    carteConsentements.appendChild(
      tableau(
        ['Contact', 'Entreprise', 'Consentement', 'Expiré le'],
        consentementsExpires.map((e) => [
          e.client ? lien(`#/clients/${e.client.id}/contacts`, e.nomContact) : e.nomContact,
          e.client?.raison_sociale ?? '-',
          libelleTypeConsentement(e.consentement.type),
          formaterDate(e.consentement.date_expiration),
        ])
      )
    );
  }
  main.appendChild(carteConsentements);

  app.innerHTML = '';
  app.appendChild(main);
  if (window.lucide) window.lucide.createIcons();
}
