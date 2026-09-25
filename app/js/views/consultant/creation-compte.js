// Création d'un compte consultant, admin ou client - réservé au rôle admin
// (01_ARCHITECTURE.md section 8.1). Un compte client doit être rattaché à
// une demande (demande_acces) ; les comptes consultant/admin n'ont pas ce
// besoin.
import { creerCompte } from '../../services/comptes.js';
import { listerDemandes, inviterClient } from '../../services/demandes.js';
import { afficherToast } from '../../components/toast.js';
import { creerBoutonRetour } from '../../components/bouton-retour.js';

export async function vueCreationCompte() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  const main = document.createElement('main');
  main.className = 'conteneur';

  main.appendChild(creerBoutonRetour('#/tableau-de-bord', 'Retour au tableau de bord'));

  const titre = document.createElement('h1');
  titre.textContent = 'Créer un compte';
  main.appendChild(titre);

  const form = document.createElement('form');
  form.className = 'carte';

  const champNom = document.createElement('label');
  champNom.className = 'champ';
  champNom.innerHTML = '<span>Nom</span>';
  const inputNom = document.createElement('input');
  inputNom.type = 'text';
  inputNom.className = 'champ-saisie';
  inputNom.required = true;
  champNom.appendChild(inputNom);

  const champEmail = document.createElement('label');
  champEmail.className = 'champ';
  champEmail.innerHTML = '<span>E-mail</span>';
  const inputEmail = document.createElement('input');
  inputEmail.type = 'email';
  inputEmail.className = 'champ-saisie';
  inputEmail.required = true;
  champEmail.appendChild(inputEmail);

  const champRole = document.createElement('label');
  champRole.className = 'champ';
  champRole.innerHTML = '<span>Rôle</span>';
  const selectRole = document.createElement('select');
  selectRole.className = 'champ-saisie';
  selectRole.innerHTML =
    '<option value="consultant">Consultant</option><option value="admin">Admin</option><option value="client">Client</option>';
  champRole.appendChild(selectRole);

  // Champs spécifiques au rôle client : le compte doit être rattaché à une
  // demande existante (demande_acces), sinon l'accès n'a pas de sens.
  const champDemande = document.createElement('label');
  champDemande.className = 'champ';
  champDemande.hidden = true;
  champDemande.innerHTML = '<span>Demande à rattacher</span>';
  const selectDemande = document.createElement('select');
  selectDemande.className = 'champ-saisie';
  selectDemande.innerHTML = '<option value="">Chargement…</option>';
  selectDemande.addEventListener('keydown', (evt) => {
    if (evt.key === 'Delete' || evt.key === 'Backspace') {
      evt.preventDefault();
      selectDemande.value = '';
    }
  });
  champDemande.appendChild(selectDemande);

  const champDroit = document.createElement('label');
  champDroit.className = 'champ';
  champDroit.hidden = true;
  champDroit.innerHTML = '<span>Droit d\'accès</span>';
  const selectDroit = document.createElement('select');
  selectDroit.className = 'champ-saisie';
  selectDroit.innerHTML = '<option value="editeur">Éditeur (peut saisir)</option><option value="lecteur">Lecteur (consultation seule)</option>';
  champDroit.appendChild(selectDroit);

  function basculerChampsClient() {
    const estClient = selectRole.value === 'client';
    champDemande.hidden = !estClient;
    champDroit.hidden = !estClient;
    selectDemande.required = estClient;
  }
  selectRole.addEventListener('change', basculerChampsClient);

  const bouton = document.createElement('button');
  bouton.type = 'submit';
  bouton.className = 'btn btn--primaire';
  bouton.textContent = 'Créer le compte';

  form.append(champNom, champEmail, champRole, champDemande, champDroit, bouton);
  main.appendChild(form);

  const resultat = document.createElement('div');
  resultat.className = 'carte creation-compte__resultat';
  resultat.hidden = true;
  main.appendChild(resultat);

  let demandesParId = new Map();

  form.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    bouton.disabled = true;
    try {
      const estClient = selectRole.value === 'client';
      const { email, motDePasseTemporaire, compteExistant } = estClient
        ? await inviterClient(selectDemande.value, inputEmail.value, {
            droit: selectDroit.value,
            nom: inputNom.value,
            statutActuel: demandesParId.get(selectDemande.value)?.statut,
          })
        : await creerCompte({ email: inputEmail.value, role: selectRole.value, nom: inputNom.value });
      resultat.hidden = false;
      resultat.innerHTML = compteExistant
        ? `<h2>Accès accordé</h2><p>${email} avait déjà un compte : accès à la demande accordé, aucun nouveau mot de passe à communiquer.</p>`
        : `
        <h2>Compte créé</h2>
        <p>Communiquez ces identifiants au titulaire par un canal sûr (jamais par écrit permanent si possible) :</p>
        <p><strong>E-mail :</strong> ${email}</p>
        <p><strong>Mot de passe temporaire :</strong> <code>${motDePasseTemporaire}</code></p>
        <p class="texte-doux">Un changement de mot de passe sera exigé à la première connexion.</p>
      `;
      form.reset();
      basculerChampsClient();
      afficherToast(compteExistant ? 'Accès accordé.' : 'Compte créé.', { type: 'succes' });
    } catch (err) {
      afficherToast(err.message, { type: 'erreur' });
    } finally {
      bouton.disabled = false;
    }
  });

  app.appendChild(main);
  if (window.lucide) window.lucide.createIcons();

  try {
    const demandes = await listerDemandes({ inclureArchivees: true });
    demandesParId = new Map(demandes.map((d) => [d.id, d]));
    selectDemande.innerHTML =
      '<option value="" disabled hidden selected>Sélectionner</option>' +
      demandes
        .map((d) => `<option value="${d.id}">${d.reference}, ${d.clients?.raison_sociale || 'Client inconnu'}</option>`)
        .join('');
  } catch (err) {
    selectDemande.innerHTML = '<option value="">Impossible de charger les demandes</option>';
    afficherToast(err.message, { type: 'erreur' });
  }
}
