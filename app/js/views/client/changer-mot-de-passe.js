import { definirNouveauMotDePasse } from '../../auth.js';
import { setProfil } from '../../store.js';
import { afficherToast } from '../../components/toast.js';
import { navigate } from '../../router.js';

export function vueChangerMotDePasse({ oblige = false } = {}) {
  const app = document.getElementById('app');
  app.innerHTML = `
    <main class="ecran-connexion">
      <div class="carte-connexion">
        <h1>${oblige ? 'Choisissez votre mot de passe' : 'Changer de mot de passe'}</h1>
        ${
          oblige
            ? '<p class="texte-doux">Pour votre sécurité, choisissez un nouveau mot de passe avant de continuer.</p>'
            : ''
        }
        <form id="form-mot-de-passe" novalidate>
          <label class="champ">
            <span>Nouveau mot de passe</span>
            <input type="password" name="motDePasse" required minlength="8" autocomplete="new-password" />
          </label>
          <label class="champ">
            <span>Confirmez le mot de passe</span>
            <input type="password" name="confirmation" required minlength="8" autocomplete="new-password" />
          </label>
          <button type="submit" class="btn btn--primaire">Valider</button>
        </form>
      </div>
    </main>
  `;

  const form = document.getElementById('form-mot-de-passe');
  form.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    const donnees = new FormData(form);
    const motDePasse = donnees.get('motDePasse');
    const confirmation = donnees.get('confirmation');
    if (motDePasse !== confirmation) {
      afficherToast('Les deux mots de passe ne correspondent pas.', { type: 'erreur' });
      return;
    }
    const bouton = form.querySelector('button');
    bouton.disabled = true;
    try {
      await definirNouveauMotDePasse(motDePasse);
      setProfil(null); // force un rechargement du profil (doit_changer_mot_de_passe à jour)
      afficherToast('Mot de passe mis à jour.', { type: 'succes' });
      navigate('/');
    } catch (err) {
      afficherToast(err.message, { type: 'erreur' });
      bouton.disabled = false;
    }
  });
}
