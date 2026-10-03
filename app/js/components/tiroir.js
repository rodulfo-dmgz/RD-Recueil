// Tiroir latéral (panneau à droite) : aperçu d'une fiche sans quitter la liste.
// Accessible : rôle dialogue, focus placé dans le panneau puis rendu à l'élément
// d'origine, Échap et clic sur le fond ferment, Tab reste dans le panneau. Sur
// téléphone il occupe tout l'écran. Un seul tiroir à la fois.
import { el, icone } from './dashboard-ui.js';

let compteur = 0;
let courant = null;

const FOCALISABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// titre, sousTitre : texte ; corps : nœud ; actions : nœuds du pied (liens ou boutons).
export function ouvrirTiroir({ titre, sousTitre, corps, actions = [], onFermee = () => {} }) {
  if (courant) courant.fermer();
  const precedent = document.activeElement;
  const id = `tiroir-titre-${++compteur}`;

  const fond = el('div', 'tiroir-fond');
  const panneau = el('aside', 'tiroir');
  panneau.setAttribute('role', 'dialog');
  panneau.setAttribute('aria-modal', 'true');
  panneau.setAttribute('aria-labelledby', id);
  panneau.tabIndex = -1;

  const entete = el('header', 'tiroir__entete');
  const textes = el('div', 'tiroir__textes');
  const h2 = el('h2', 'tiroir__titre', titre);
  h2.id = id;
  textes.appendChild(h2);
  if (sousTitre) textes.appendChild(el('p', 'tiroir__sous-titre texte-doux', sousTitre));
  const fermerBtn = el('button', 'tiroir__fermer');
  fermerBtn.type = 'button';
  fermerBtn.setAttribute('aria-label', 'Fermer l’aperçu');
  fermerBtn.appendChild(icone('x'));
  entete.append(textes, fermerBtn);

  const contenu = el('div', 'tiroir__corps');
  contenu.appendChild(corps);
  panneau.append(entete, contenu);
  if (actions.length > 0) {
    const pied = el('footer', 'tiroir__pied');
    actions.forEach((a) => pied.appendChild(a));
    panneau.appendChild(pied);
  }

  let ferme = false;
  function fermer() {
    if (ferme) return;
    ferme = true;
    document.removeEventListener('keydown', surClavier, true);
    fond.remove();
    panneau.remove();
    if (courant?.fermer === fermer) courant = null;
    if (precedent instanceof HTMLElement && document.contains(precedent)) precedent.focus();
    onFermee();
  }

  function surClavier(evenement) {
    if (evenement.key === 'Escape') {
      evenement.preventDefault();
      evenement.stopPropagation();
      fermer();
    } else if (evenement.key === 'Tab') {
      const elements = [...panneau.querySelectorAll(FOCALISABLES)];
      if (elements.length === 0) return;
      const premier = elements[0];
      const dernier = elements[elements.length - 1];
      if (evenement.shiftKey && (document.activeElement === premier || document.activeElement === panneau)) {
        evenement.preventDefault();
        dernier.focus();
      } else if (!evenement.shiftKey && document.activeElement === dernier) {
        evenement.preventDefault();
        premier.focus();
      }
    }
  }

  fermerBtn.addEventListener('click', fermer);
  fond.addEventListener('click', fermer);
  // Un lien du tiroir qui change de page referme le tiroir.
  panneau.addEventListener('click', (evenement) => {
    if (evenement.target.closest('a[href^="#/"]')) fermer();
  });
  document.addEventListener('keydown', surClavier, true);
  document.body.append(fond, panneau);
  if (window.lucide) window.lucide.createIcons();
  fermerBtn.focus();

  courant = { fermer };
  return { fermer };
}
