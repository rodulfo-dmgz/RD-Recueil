// Allure de l'interface (prototype, refonte inspirée de Twenty) : l'utilisateur
// peut essayer la nouvelle allure (menu clair, tableaux compacts) et revenir à
// l'actuelle d'un clic. Le choix est mémorisé dans ce navigateur ; les styles
// sont dans css/allure.css, tous préfixés par `body.look-nouveau`.
const CLE_ALLURE = 'rd-recueil-allure';
const CLE_DENSITE = 'rd-recueil-densite';

function lire(cle) {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null; // stockage indisponible : on garde l'allure actuelle
  }
}

function ecrire(cle, valeur) {
  try {
    localStorage.setItem(cle, valeur);
  } catch {
    // non mémorisé.
  }
}

export function allureNouvelle() {
  return lire(CLE_ALLURE) === 'nouvelle';
}

export function appliquerAllure() {
  document.body.classList.toggle('look-nouveau', allureNouvelle());
}

export function basculerAllure() {
  ecrire(CLE_ALLURE, allureNouvelle() ? 'actuelle' : 'nouvelle');
  appliquerAllure();
}

// Densité des tableaux sous la nouvelle allure : compacte par défaut.
export function densiteConfortable() {
  return lire(CLE_DENSITE) === 'confortable';
}

export function basculerDensite() {
  ecrire(CLE_DENSITE, densiteConfortable() ? 'compacte' : 'confortable');
}

// Bouton de la barre du haut : état et clic.
export function initialiserBoutonAllure(bouton) {
  if (!bouton) return;
  const majEtat = () => bouton.setAttribute('aria-pressed', String(allureNouvelle()));
  majEtat();
  bouton.addEventListener('click', () => {
    basculerAllure();
    majEtat();
  });
}
