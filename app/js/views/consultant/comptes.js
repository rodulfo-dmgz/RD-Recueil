// Liste des comptes et suppression définitive - réservé au rôle admin
// (01_ARCHITECTURE.md section 4.2, #/admin/utilisateurs). La suppression
// d'un compte client supprime aussi ses demandes (via demande_acces) : la
// confirmation liste donc explicitement ce qui sera perdu avant d'agir.
import { listerComptes, listerDemandesDuCompte, supprimerUtilisateur } from '../../services/comptes.js';
import { afficherToast } from '../../components/toast.js';
import { creerBoutonRetour } from '../../components/bouton-retour.js';

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
    const main = document.createElement('main');
    main.className = 'conteneur';
    main.appendChild(creerBoutonRetour('#/tableau-de-bord', 'Retour au tableau de bord'));

    const titre = document.createElement('h1');
    titre.textContent = 'Comptes';
    main.appendChild(titre);

    const liste = document.createElement('ul');
    liste.className = 'liste-demandes';
    if (comptes.length === 0) {
      liste.innerHTML = '<li class="texte-doux">Aucun compte.</li>';
    }
    for (const compte of comptes) {
      const li = document.createElement('li');
      li.className = 'relance-ligne';
      const info = document.createElement('span');
      info.textContent = `${compte.nom ? `${compte.nom} · ` : ''}${compte.email} · ${LIBELLES_ROLE[compte.role] || compte.role}`;
      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.className = 'btn btn--secondaire';
      bouton.textContent = 'Supprimer';
      bouton.addEventListener('click', () => confirmerEtSupprimer(compte, bouton));
      li.append(info, bouton);
      liste.appendChild(li);
    }
    main.appendChild(liste);
    app.appendChild(main);
    if (window.lucide) window.lucide.createIcons();
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
