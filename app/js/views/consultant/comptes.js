// Liste des comptes et suppression définitive - réservé au rôle admin
// (01_ARCHITECTURE.md section 4.2, #/admin/utilisateurs). La suppression
// d'un compte client supprime aussi ses demandes (via demande_acces) : la
// confirmation liste donc explicitement ce qui sera perdu avant d'agir.
import { listerComptes, listerDemandesDuCompte, supprimerUtilisateur } from '../../services/comptes.js';
import { afficherToast } from '../../components/toast.js';
import { creerBoutonRetour } from '../../components/bouton-retour.js';
import { el } from '../../components/dashboard-ui.js';
import { tableauListe } from '../../components/tableau-liste.js';

const LIBELLES_ROLE = { admin: 'Admin', consultant: 'Consultant', client: 'Client' };

export async function vueComptes() {
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><p>Chargement…</p></main>';
  await rafraichir();

  async function rafraichir() {
    let comptes;
    try {
      comptes = await listerComptes();
    } catch (err) {
      afficherToast(err.message, { type: 'erreur' });
      app.innerHTML = '<main class="conteneur"><h1>Impossible de charger les comptes</h1></main>';
      return;
    }
    rendre(comptes);
  }

  function rendre(comptes) {
    app.innerHTML = '';
    const main = el('main', 'db');
    main.appendChild(creerBoutonRetour('#/tableau-de-bord', 'Retour au tableau de bord'));

    const titre = document.createElement('h1');
    titre.textContent = 'Comptes';
    main.appendChild(titre);

    const carte = el('section', 'db-carte');
    if (comptes.length === 0) {
      carte.appendChild(el('p', 'texte-doux', 'Aucun compte.'));
    } else {
      carte.appendChild(
        tableauListe({
          id: 'comptes',
          colonnes: [
            { titre: 'Nom', icone: 'user-round', largeur: 240, figee: true, tri: (c) => c.nom || c.email, rendu: (c) => c.nom },
            { titre: 'E-mail', icone: 'mail', largeur: 300, tri: (c) => c.email, rendu: (c) => c.email },
            { titre: 'Rôle', icone: 'shield', largeur: 150, tri: (c) => LIBELLES_ROLE[c.role] || c.role, rendu: (c) => LIBELLES_ROLE[c.role] || c.role },
            { titre: '', largeur: 140, rendu: (c) => boutonSupprimer(c) },
          ],
          lignes: comptes,
          cle: (c) => c.user_id,
          libelleTotal: (lignes) => `${lignes.length} compte${lignes.length > 1 ? 's' : ''}`,
        })
      );
    }
    main.appendChild(carte);
    app.appendChild(main);
    if (window.lucide) window.lucide.createIcons();
  }

  function boutonSupprimer(compte) {
    const bouton = el('button', 'btn btn--secondaire', 'Supprimer');
    bouton.type = 'button';
    bouton.addEventListener('click', () => confirmerEtSupprimer(compte, bouton));
    return bouton;
  }

  async function confirmerEtSupprimer(compte, bouton) {
    let demandes = [];
    if (compte.role === 'client') {
      try {
        demandes = await listerDemandesDuCompte(compte.user_id);
      } catch (err) {
        afficherToast(err.message, { type: 'erreur' });
        return;
      }
    }

    const lignesDemandes = demandes
      .map((d) => `- ${d.reference} (${d.clients?.raison_sociale || 'Client inconnu'})`)
      .join('\n');
    const message =
      demandes.length > 0
        ? `Supprimer définitivement le compte ${compte.email} ?\n\nCela supprimera aussi ${demandes.length} demande(s) et toutes leurs données (réponses, notes de cadrage, propositions, fichiers) :\n${lignesDemandes}\n\nCette action est irréversible.`
        : `Supprimer définitivement le compte ${compte.email} ?\n\nCette action est irréversible.`;
    if (!window.confirm(message)) return;

    bouton.disabled = true;
    try {
      const { demandesSupprimees } = await supprimerUtilisateur(compte.user_id);
      afficherToast(
        `Compte supprimé${demandesSupprimees ? ` (${demandesSupprimees} demande(s) supprimée(s))` : ''}.`,
        { type: 'succes' }
      );
      rafraichir();
    } catch (err) {
      afficherToast(err.message, { type: 'erreur' });
      bouton.disabled = false;
    }
  }
}
