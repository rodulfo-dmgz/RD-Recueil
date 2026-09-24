import { connecter, demanderReinitialisationMotDePasse } from '../../auth.js';
import { afficherToast } from '../../components/toast.js';
import { navigate } from '../../router.js';

export function vueConnexion() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <main class="login-page-wrapper">
      <div class="login-layout">
        <section class="login-brand-card" aria-label="Identité RD Recueil">
          <div class="login-brand-content">
            <img src="assets/images/logo.svg" alt="RD Formation" class="login-brand__logo" />
            <p class="login-brand__nom">RD Recueil</p>
            <p class="login-brand__slogan">Recueil des besoins et note de cadrage, RD Formation.</p>
          </div>
        </section>
        <section class="login-form-card" aria-labelledby="titre-connexion">
          <button type="button" class="theme-toggle" data-theme-toggle aria-label="Basculer entre mode clair et mode sombre" aria-pressed="false">
            <i data-lucide="moon"></i>
          </button>
          <form id="form-connexion" class="login-form" novalidate>
            <div>
              <h1 id="titre-connexion" class="login-form__titre">Connexion</h1>
              <p class="login-form__soustitre">Accédez à votre espace avec l'adresse e-mail et le mot de passe qui vous ont été communiqués.</p>
            </div>
            <label class="champ">
              <span>Adresse e-mail</span>
              <input type="email" name="email" required autocomplete="email" />
            </label>
            <label class="champ">
              <span>Mot de passe</span>
              <input type="password" name="motDePasse" required autocomplete="current-password" />
            </label>
            <button type="submit" class="btn btn--primaire">Se connecter</button>
            <button type="button" id="bouton-oublie" class="btn btn--secondaire">Mot de passe oublié ?</button>
          </form>
        </section>
      </div>
    </main>
  `;
  if (window.lucide) window.lucide.createIcons();
  if (window.gestionnaireTheme) window.gestionnaireTheme.mettreAJourBoutons();

  const form = document.getElementById('form-connexion');
  form.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    const donnees = new FormData(form);
    const bouton = form.querySelector('button');
    bouton.disabled = true;
    try {
      await connecter(donnees.get('email'), donnees.get('motDePasse'));
      navigate('/');
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
