import { envoyerLienMagique } from '../../auth.js';
import { afficherToast } from '../../components/toast.js';

export function vueConnexion() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <main class="ecran-connexion">
      <div class="carte-connexion">
        <h1>RD Recueil</h1>
        <p class="texte-doux">Recevez un lien de connexion par e-mail, sans mot de passe.</p>
        <form id="form-connexion" novalidate>
          <label class="champ">
            <span>Adresse e-mail</span>
            <input type="email" name="email" required autocomplete="email" />
          </label>
          <button type="submit" class="btn btn--primaire">Recevoir le lien</button>
        </form>
      </div>
    </main>
  `;

  const form = document.getElementById('form-connexion');
  form.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    const email = new FormData(form).get('email');
    const bouton = form.querySelector('button');
    bouton.disabled = true;
    try {
      await envoyerLienMagique(email);
      afficherToast('Lien envoyé. Consultez votre boîte de réception.', { type: 'succes' });
    } catch (err) {
      afficherToast(err.message, { type: 'erreur' });
    } finally {
      bouton.disabled = false;
    }
  });
}
