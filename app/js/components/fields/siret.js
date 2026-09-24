import { rechercherEtablissements } from '../../services/entreprises.js';

const DELAI_DEBOUNCE_MS = 400;
const CHIFFRES_MIN_SUGGESTIONS = 3;
// ponytail: l'API est une recherche floue, pas un index par préfixe -
// "35600000" (8 chiffres) renvoie 0 résultat en interrogeant l'API à chaque
// frappe, "356000000" (9) renvoie LA POSTE. Entre 3 et 8 chiffres, on ne
// réinterroge donc pas l'API (ça ne renverrait rien) : on filtre localement
// le lot reçu à 3 chiffres, en escalade, sans réseau ni latence.
const CHIFFRES_SIREN_COMPLET = 9;

export function render(question, valeur, { onChange, lectureSeule, onAutoRemplir }) {
  const conteneur = document.createElement('div');
  conteneur.className = 'champ-siret';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'champ-saisie champ-saisie--code';
  input.inputMode = 'numeric';
  input.maxLength = 14;
  input.autocomplete = 'off';
  input.value = valeur ?? '';
  input.disabled = Boolean(lectureSeule);
  conteneur.appendChild(input);

  const liste = document.createElement('ul');
  liste.className = 'champ-siret__suggestions';
  liste.hidden = true;
  liste.setAttribute('role', 'listbox');
  conteneur.appendChild(liste);

  let statut = null;
  if (onAutoRemplir) {
    statut = document.createElement('p');
    statut.className = 'texte-doux champ-siret__statut';
    statut.hidden = true;
    conteneur.appendChild(statut);
  }

  if (lectureSeule || !onAutoRemplir) {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 14);
      onChange(input.value);
    });
    return conteneur;
  }

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-autocomplete', 'list');

  function fermerSuggestions() {
    liste.hidden = true;
    liste.innerHTML = '';
    input.setAttribute('aria-expanded', 'false');
  }

  let dernierSiretTraite = null;

  async function declencherAutoRemplir(siret, donneesPreChargees) {
    // Évite un second remplissage (donc un second toast) si le champ perd le
    // focus après une sélection dans la liste, sur la même valeur déjà traitée.
    if (siret === dernierSiretTraite) return;
    dernierSiretTraite = siret;
    statut.hidden = false;
    statut.textContent = 'Recherche de l\'établissement…';
    try {
      await onAutoRemplir(siret, statut, donneesPreChargees);
    } catch {
      statut.textContent = "Recherche de l'établissement indisponible pour le moment.";
    }
  }

  function choisirSuggestion(suggestion) {
    input.value = suggestion.siret;
    onChange(suggestion.siret);
    fermerSuggestions();
    declencherAutoRemplir(suggestion.siret, suggestion);
  }

  function afficherSuggestions(suggestions) {
    liste.innerHTML = '';
    if (suggestions.length === 0) {
      fermerSuggestions();
      return;
    }
    for (const suggestion of suggestions) {
      const li = document.createElement('li');
      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.className = 'champ-siret__suggestion';
      bouton.setAttribute('role', 'option');
      const adresseTexte = suggestion.adresse
        ? `${suggestion.adresse.rue}, ${suggestion.adresse.cp} ${suggestion.adresse.ville}`.trim()
        : '';
      bouton.innerHTML = `
        <span class="champ-siret__suggestion-nom">${suggestion.raisonSociale || 'Établissement'}${suggestion.estSiege ? ' (siège)' : ''}</span>
        <span class="champ-siret__suggestion-adresse">${adresseTexte}${adresseTexte ? ' - ' : ''}${suggestion.siret}</span>
      `;
      // mousedown + preventDefault empêche l'input de perdre le focus au
      // clic : sans ça, le blur de l'input se déclenche avant le "click" du
      // bouton, ferme la liste, et la sélection ne se produit jamais.
      bouton.addEventListener('mousedown', (evt) => evt.preventDefault());
      bouton.addEventListener('click', () => choisirSuggestion(suggestion));
      li.appendChild(bouton);
      liste.appendChild(li);
    }
    liste.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  let minuterie = null;
  let requeteEnCours = 0;
  let dernierLot = null; // { prefixe, suggestions } - dernier lot reçu de l'API

  function interroger(valeurActuelle) {
    minuterie = setTimeout(async () => {
      const id = ++requeteEnCours;
      try {
        const suggestions = await rechercherEtablissements(valeurActuelle);
        if (id !== requeteEnCours || input.value !== valeurActuelle) return; // réponse obsolète
        dernierLot = { prefixe: valeurActuelle, suggestions };
        afficherSuggestions(suggestions);
      } catch {
        // recherche indisponible : la saisie manuelle reste possible
      }
    }, DELAI_DEBOUNCE_MS);
  }

  input.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '').slice(0, 14);
    onChange(input.value);
    dernierSiretTraite = null; // toute frappe autorise à nouveau le remplissage automatique
    clearTimeout(minuterie);
    const valeurActuelle = input.value;

    if (valeurActuelle.length < CHIFFRES_MIN_SUGGESTIONS) {
      dernierLot = null;
      fermerSuggestions();
      return;
    }

    // Entre 3 et 8 chiffres : filtre local du dernier lot API plutôt qu'un
    // nouvel appel réseau (qui renverrait 0 résultat dans cette plage).
    if (dernierLot && valeurActuelle.length < CHIFFRES_SIREN_COMPLET && valeurActuelle.startsWith(dernierLot.prefixe)) {
      afficherSuggestions(dernierLot.suggestions.filter((s) => s.siret.startsWith(valeurActuelle)));
      return;
    }

    interroger(valeurActuelle);
  });

  input.addEventListener('blur', () => {
    // Laisse le temps à un clic sur une suggestion de s'exécuter avant de la fermer.
    setTimeout(fermerSuggestions, 150);
    if (input.value.length === 14) declencherAutoRemplir(input.value);
  });

  input.addEventListener('keydown', (evt) => {
    if (evt.key === 'Escape') fermerSuggestions();
  });

  return conteneur;
}
