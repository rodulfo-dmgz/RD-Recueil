import { validerReponse } from '../engine/validation.js';
import { rendreTexteAvecGlossaire, idsGlossaireRestants } from '../engine/glossary.js';
import { modulesParType } from './fields/index.js';

function estVide(valeur) {
  if (valeur == null || valeur === '') return true;
  if (Array.isArray(valeur)) return valeur.length === 0;
  if (typeof valeur === 'object') return Object.keys(valeur).length === 0;
  return false;
}

// Rend une question complète : libellé (avec glossaire), champ de saisie du
// type correspondant, case NSP le cas échéant, pastilles "Voir aussi" et
// message d'erreur si une valeur déjà saisie est invalide.
export function rendreChamp(question, reponse, { onChange, lectureSeule, indexGlossaire, televerser, onAutoRemplir } = {}) {
  const { valeur, nsp } = reponse || {};
  const module = modulesParType[question.type];

  const conteneur = document.createElement('div');
  conteneur.className = 'champ-question';
  conteneur.id = `champ-${question.id}`;

  const label = document.createElement('p');
  label.className = 'champ-question__libelle';
  const curseur = { i: 0 };
  label.innerHTML = rendreTexteAvecGlossaire(question.libelle, question.glossaire, curseur);
  if (question.obligatoire) {
    const etoile = document.createElement('span');
    etoile.className = 'champ-question__obligatoire';
    etoile.textContent = ' *';
    etoile.setAttribute('aria-hidden', 'true');
    label.appendChild(etoile);
  }
  conteneur.appendChild(label);

  if (module) {
    const entree = module.render(question, valeur, {
      lectureSeule: Boolean(lectureSeule) || Boolean(nsp),
      onChange: (nouvelleValeur) => onChange({ valeur: nouvelleValeur, nsp: false }),
      televerser,
      onAutoRemplir,
    });
    conteneur.appendChild(entree);
  }

  if (question.nsp_autorise) {
    const nspLabel = document.createElement('label');
    nspLabel.className = 'champ-question__nsp';
    const nspInput = document.createElement('input');
    nspInput.type = 'checkbox';
    nspInput.checked = Boolean(nsp);
    nspInput.disabled = Boolean(lectureSeule);
    nspInput.addEventListener('change', () => onChange({ valeur, nsp: nspInput.checked }));
    nspLabel.append(nspInput, ' Je ne sais pas / à définir ensemble');
    conteneur.appendChild(nspLabel);
  }

  const idsRestants = idsGlossaireRestants(question.glossaire || [], curseur);
  if (idsRestants.length > 0 && indexGlossaire) {
    const voirAussi = document.createElement('div');
    voirAussi.className = 'champ-question__voir-aussi';
    voirAussi.append('Voir aussi : ');
    idsRestants.forEach((id, i) => {
      const terme = indexGlossaire.get(id);
      if (!terme) return;
      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.className = 'gl-term';
      bouton.dataset.gl = id;
      bouton.textContent = terme.libelle;
      voirAussi.appendChild(bouton);
      if (i < idsRestants.length - 1) voirAussi.append(', ');
    });
    conteneur.appendChild(voirAussi);
  }

  // Les champs vides et obligatoires ne sont pas signalés ici : ils sont
  // listés au récapitulatif (§4.1). Seule une valeur déjà saisie mais mal
  // formée déclenche un message immédiat.
  ajouterErreurSiBesoin(conteneur, question, { valeur, nsp });

  return conteneur;
}

function ajouterErreurSiBesoin(conteneur, question, { valeur, nsp }) {
  if (nsp || estVide(valeur)) return;
  const erreur = validerReponse(question, { valeur, nsp });
  if (!erreur) return;
  const erreurEl = document.createElement('p');
  erreurEl.className = 'champ-question__erreur';
  erreurEl.setAttribute('role', 'alert');
  erreurEl.textContent = erreur;
  conteneur.appendChild(erreurEl);
}

// Rafraîchit uniquement le message d'erreur d'une question déjà affichée,
// sans reconstruire le champ de saisie (qui ferait perdre le focus clavier
// pendant la frappe). À appeler à chaque mise à jour du store.
export function mettreAJourErreurChamp(question, reponse) {
  const conteneur = document.getElementById(`champ-${question.id}`);
  if (!conteneur) return;
  conteneur.querySelector('.champ-question__erreur')?.remove();
  ajouterErreurSiBesoin(conteneur, question, reponse || {});
}
