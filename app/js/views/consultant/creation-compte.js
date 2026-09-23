// Création d'un compte consultant ou admin - réservé au rôle admin
// (01_ARCHITECTURE.md section 8.1). L'accès client se crée depuis la vue 360
// d'une demande, pas ici.
import { creerCompte } from '../../services/comptes.js';
import { afficherToast } from '../../components/toast.js';

export function vueCreationCompte() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  const main = document.createElement('main');
  main.className = 'conteneur';

  const retour = document.createElement('a');
  retour.href = '#/tableau-de-bord';
  retour.textContent = '← Retour au tableau de bord';
  main.appendChild(retour);

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
  inputNom.required = true;
  champNom.appendChild(inputNom);

  const champEmail = document.createElement('label');
  champEmail.className = 'champ';
  champEmail.innerHTML = '<span>E-mail</span>';
  const inputEmail = document.createElement('input');
  inputEmail.type = 'email';
  inputEmail.required = true;
  champEmail.appendChild(inputEmail);

  const champRole = document.createElement('label');
  champRole.className = 'champ';
  champRole.innerHTML = '<span>Rôle</span>';
  const selectRole = document.createElement('select');
  selectRole.className = 'champ-saisie';
  selectRole.innerHTML = '<option value="consultant">Consultant</option><option value="admin">Admin</option>';
  champRole.appendChild(selectRole);

  const bouton = document.createElement('button');
  bouton.type = 'submit';
  bouton.className = 'btn btn--primaire';
  bouton.textContent = 'Créer le compte';

  form.append(champNom, champEmail, champRole, bouton);
  main.appendChild(form);

  const resultat = document.createElement('div');
  resultat.className = 'carte creation-compte__resultat';
  resultat.hidden = true;
  main.appendChild(resultat);

  form.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    bouton.disabled = true;
    try {
      const { email, motDePasseTemporaire } = await creerCompte({
        email: inputEmail.value,
        role: selectRole.value,
        nom: inputNom.value,
      });
      resultat.hidden = false;
      resultat.innerHTML = `
        <h2>Compte créé</h2>
        <p>Communiquez ces identifiants au titulaire par un canal sûr (jamais par écrit permanent si possible) :</p>
        <p><strong>E-mail :</strong> ${email}</p>
        <p><strong>Mot de passe temporaire :</strong> <code>${motDePasseTemporaire}</code></p>
        <p class="texte-doux">Un changement de mot de passe sera exigé à la première connexion.</p>
      `;
      form.reset();
      afficherToast('Compte créé.', { type: 'succes' });
    } catch (err) {
      afficherToast(err.message, { type: 'erreur' });
    } finally {
      bouton.disabled = false;
    }
  });

  app.appendChild(main);
}
