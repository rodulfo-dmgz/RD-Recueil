import { connecter, demanderReinitialisationMotDePasse } from '../../auth.js';
import { afficherToast } from '../../components/toast.js';
import { attacherToggleMotDePasse } from '../../components/mot-de-passe.js';
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
              <div class="mdp-champ">
                <input type="password" name="motDePasse" required autocomplete="current-password" />
                <button type="button" class="mdp-toggle" aria-label="Afficher le mot de passe" aria-pressed="false">
                  <i data-lucide="eye"></i>
                </button>
              </div>
            </label>
            <button type="submit" class="btn btn--primaire">Se connecter</button>
            <button type="button" id="bouton-oublie" class="btn btn--secondaire">Mot de passe oublié ?</button>
          </form>
        </section>
      </div>
    </main>

    <div id="modal-oublie" class="modal-fond" hidden>
      <div class="modal-carte" role="dialog" aria-modal="true" aria-labelledby="titre-modal-oublie">
        <button type="button" id="modal-oublie-fermer" class="modal-fermer" aria-label="Fermer">
          <i data-lucide="x"></i>
        </button>
        <h2 id="titre-modal-oublie">Mot de passe oublié ?</h2>
        <p class="texte-doux">Saisissez votre adresse e-mail : si un compte existe, vous recevrez un lien pour choisir un nouveau mot de passe.</p>
        <form id="form-oublie" novalidate>
          <label class="champ">
            <span>Adresse e-mail</span>
            <input type="email" name="email" required autocomplete="email" />
          </label>
          <p id="modal-oublie-message" class="modal-message" hidden></p>
          <button type="submit" class="btn btn--primaire btn-full">Envoyer le lien</button>
        </form>
      </div>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();
  if (window.gestionnaireTheme) window.gestionnaireTheme.mettreAJourBoutons();

  const form = document.getElementById('form-connexion');
  const champMotDePasse = form.motDePasse;
  attacherToggleMotDePasse(form.querySelector('.mdp-toggle'), champMotDePasse);

  form.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    const donnees = new FormData(form);
    const bouton = document.getElementById('form-connexion').querySelector('button[type="submit"]');
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

  // Modale "mot de passe oublié" - un champ dédié plutôt que de réutiliser
  // discrètement le champ e-mail du formulaire de connexion.
  const modal = document.getElementById('modal-oublie');
  const formOublie = document.getElementById('form-oublie');
  const messageOublie = document.getElementById('modal-oublie-message');

  const ouvrirModal = () => {
    formOublie.reset();
    formOublie.email.value = form.email.value.trim();
    messageOublie.hidden = true;
    messageOublie.className = 'modal-message';
    modal.hidden = false;
    formOublie.email.focus();
  };
  const fermerModal = () => {
    modal.hidden = true;
  };

  document.getElementById('bouton-oublie').addEventListener('click', ouvrirModal);
  document.getElementById('modal-oublie-fermer').addEventListener('click', fermerModal);
  modal.addEventListener('click', (evt) => {
    if (evt.target === modal) fermerModal();
  });
  document.addEventListener('keydown', function surEchap(evt) {
    if (evt.key === 'Escape' && !modal.hidden) fermerModal();
  });

  formOublie.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    const bouton = formOublie.querySelector('button[type="submit"]');
    bouton.disabled = true;
    try {
      await demanderReinitialisationMotDePasse(formOublie.email.value.trim());
      messageOublie.textContent = 'E-mail envoyé. Vérifiez votre boîte de réception.';
      messageOublie.className = 'modal-message modal-message--succes';
      messageOublie.hidden = false;
    } catch (err) {
      messageOublie.textContent = err.message;
      messageOublie.className = 'modal-message modal-message--erreur';
      messageOublie.hidden = false;
    } finally {
      bouton.disabled = false;
    }
  });
}
