import { connecter, demanderReinitialisationMotDePasse } from '../../auth.js';
import { afficherToast } from '../../components/toast.js';

export function vueConnexion() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <main class="ecran-connexion">
      <div class="carte-connexion">
        <h1>RD Recueil</h1>
        <p class="texte-doux">Connectez-vous avec l'adresse e-mail et le mot de passe qui vous ont été communiqués.</p>
        <form id="form-connexion" novalidate>
          <label class="champ">
            <span>Adresse e-mail</span>
            <input type="email" name="email" required autocomplete="email" />
          </label>
          <label class="champ">
            <span>Mot de passe</span>
            <input type="password" name="motDePasse" required autocomplete="current-password" />
          </label>
          <button type="submit" class="btn btn--primaire">Se connecter</button>
        </form>
        <button type="button" id="bouton-oublie" class="btn btn--secondaire">Mot de passe oublié ?</button>
      </div>
    </main>
  `;

  const form = document.getElementById('form-connexion');
  form.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    const donnees = new FormData(form);
    const bouton = form.querySelector('button');
    bouton.disabled = true;
    try {
      await connecter(donnees.get('email'), donnees.get('motDePasse'));
    } catch (err) {
      afficherToast(err.message, { type: 'erreur' });
    } finally {
      bouton.disabled = false;
    }
  });

  document.getElementById('bouton-oublie').addEventListener('click', async () => {
    const email = form.email.value.trim();
    if (!email) {
      afficherToast('Saisissez votre adresse e-mail ci-dessus, puis cliquez à nouveau.', { type: 'erreur' });
      return;
    }
    try {
      await demanderReinitialisationMotDePasse(email);
      afficherToast('E-mail de réinitialisation envoyé.', { type: 'succes' });
    } catch (err) {
      afficherToast(err.message, { type: 'erreur' });
    }
  });
}
