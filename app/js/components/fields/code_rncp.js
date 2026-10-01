import {
  estCodeRncp,
  verifierCodeRncp,
  rechercherCertifInfo,
  obtenirCertifInfo,
} from '../../services/certifications.js';
import { construireFicheRncp, construireFicheCertifInfo } from '../../components/fiche-certification.js';

// valeur : chaîne (ancien format, texte seul) ou { texte, source, detail }.
// source/detail mettent en cache la fiche obtenue (RNCP ou Certif Info) pour
// qu'elle survive à un rechargement et s'affiche aussi en lecture seule
// (lecture-demande.js, recap.js) sans dépendre d'un nouvel appel API -
// 01_ARCHITECTURE.md section 6.2.
function texteDe(valeur) {
  if (typeof valeur === 'string') return valeur;
  return valeur?.texte ?? '';
}

// Reconnaît un code RNCP même sans le préfixe "RNCP" (le consultant tape
// souvent juste les chiffres) pour déclencher la vérification en direct
// pendant la frappe, comme pour la recherche Certif Info par intitulé.
function normaliserCandidatRncp(texte) {
  const propre = (texte || '').trim();
  if (estCodeRncp(propre)) return propre.toUpperCase();
  if (/^\d{3,5}$/.test(propre)) return `RNCP${propre}`;
  return null;
}

// Champ libre (titre, code RNCP ou RS) - seul un code RNCP au format
// "RNCP12345" peut être vérifié auprès de France Compétences (l'API ne
// couvre pas le Répertoire Spécifique). Pour tout autre texte d'au moins 3
// caractères, une recherche par intitulé dans Certif Info (référentiel plus
// large, intercariforef.org) propose des suggestions ; en choisir une
// affiche sa fiche complète.
export function render(question, valeur, { onChange, lectureSeule }) {
  const conteneur = document.createElement('div');
  conteneur.className = 'champ-code-rncp';

  const champRecherche = document.createElement('div');
  champRecherche.className = 'champ-code-rncp__recherche';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'champ-saisie';
  input.placeholder = 'Ex. RNCP12345 ou "Chef de projet digital"';
  input.value = texteDe(valeur);
  input.disabled = Boolean(lectureSeule);
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-autocomplete', 'list');
  champRecherche.appendChild(input);

  const suggestions = document.createElement('ul');
  suggestions.className = 'champ-code-rncp__suggestions';
  suggestions.hidden = true;
  suggestions.setAttribute('role', 'listbox');
  champRecherche.appendChild(suggestions);

  conteneur.appendChild(champRecherche);

  const statut = document.createElement('p');
  statut.className = 'texte-doux champ-code-rncp__statut';
  statut.hidden = true;
  conteneur.appendChild(statut);

  let dernierCodeVerifie = null;
  let minuterieRecherche = null;

  function effacerResultat() {
    conteneur.querySelector('.fiche-certification')?.remove();
  }

  function masquerSuggestions() {
    suggestions.hidden = true;
    suggestions.innerHTML = '';
    input.setAttribute('aria-expanded', 'false');
  }

  async function lancerVerificationRncp(code) {
    if (!estCodeRncp(code) || code === dernierCodeVerifie) return;
    dernierCodeVerifie = code;
    statut.hidden = false;
    statut.textContent = 'Vérification du code RNCP…';
    try {
      const resultat = await verifierCodeRncp(code);
      statut.hidden = true;
      effacerResultat();
      conteneur.appendChild(construireFicheRncp(resultat));
      if (resultat.trouve) onChange({ texte: code, source: 'rncp', detail: resultat });
    } catch {
      statut.hidden = true;
    }
  }

  async function choisirSuggestion(suggestion) {
    masquerSuggestions();
    input.value = suggestion.intitule;
    statut.hidden = false;
    statut.textContent = 'Chargement de la fiche Certif Info…';
    try {
      const resultat = await obtenirCertifInfo(suggestion.certifinfoCode);
      statut.hidden = true;
      effacerResultat();
      conteneur.appendChild(construireFicheCertifInfo(resultat));
      // Objet (avec fiche) seulement si une fiche a vraiment été trouvée ;
      // sinon une simple chaîne, comme le reste du champ (cf. input ci-dessous)
      // - un objet avec detail: null serait à tort compté comme "répondu" par
      // les contrôles de complétion (estRenseignee), qui ne testent que
      // valeur == null / valeur === ''.
      onChange(resultat.trouve ? { texte: suggestion.intitule, source: 'certifinfo', detail: resultat } : suggestion.intitule);
    } catch (err) {
      statut.textContent = err.message || 'Fiche Certif Info indisponible pour le moment.';
      onChange(suggestion.intitule);
    }
  }

  function afficherSuggestions(liste) {
    suggestions.innerHTML = '';
    if (liste.length === 0) {
      masquerSuggestions();
      return;
    }
    for (const s of liste) {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.textContent = s.rncpCode ? `${s.intitule} (${s.rncpCode})` : s.intitule;
      // mousedown (pas click) : se déclenche avant le blur de l'input, qui
      // sinon masquerait les suggestions avant que le choix soit enregistré.
      li.addEventListener('mousedown', (evt) => {
        evt.preventDefault();
        choisirSuggestion(s);
      });
      suggestions.appendChild(li);
    }
    suggestions.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  // Pendant la frappe : un code RNCP (avec ou sans préfixe) déclenche sa
  // vérification en direct dès 3 chiffres, exactement comme la recherche
  // Certif Info par intitulé pour tout autre texte.
  function lancerRecherche(texte) {
    clearTimeout(minuterieRecherche);

    const candidatRncp = normaliserCandidatRncp(texte);
    if (candidatRncp) {
      masquerSuggestions();
      minuterieRecherche = setTimeout(() => lancerVerificationRncp(candidatRncp), 400);
      return;
    }

    if (texte.trim().length < 3) {
      masquerSuggestions();
      return;
    }
    minuterieRecherche = setTimeout(async () => {
      statut.hidden = false;
      statut.textContent = 'Recherche dans Certif Info…';
      try {
        const resultats = await rechercherCertifInfo(texte.trim());
        statut.hidden = true;
        afficherSuggestions(resultats);
      } catch (err) {
        masquerSuggestions();
        statut.hidden = false;
        statut.textContent = err.message || 'Recherche Certif Info indisponible pour le moment.';
      }
    }, 400);
  }

  // Une fiche déjà mise en cache (sélection précédente, survit au
  // rechargement) s'affiche immédiatement sans appel réseau ; sinon, un code
  // RNCP reconnu est revérifié en direct (son statut peut avoir changé).
  if (typeof valeur === 'object' && valeur?.detail) {
    conteneur.appendChild(
      valeur.source === 'certifinfo' ? construireFicheCertifInfo(valeur.detail) : construireFicheRncp(valeur.detail)
    );
    if (valeur.source === 'rncp') dernierCodeVerifie = valeur.texte;
  } else if (estCodeRncp(texteDe(valeur))) {
    lancerVerificationRncp(texteDe(valeur).trim());
  }

  if (lectureSeule) {
    return conteneur;
  }

  input.addEventListener('input', () => {
    onChange(input.value);
    dernierCodeVerifie = null;
    statut.hidden = true;
    effacerResultat();
    lancerRecherche(input.value);
  });

  input.addEventListener('blur', () => {
    lancerVerificationRncp(normaliserCandidatRncp(input.value) || input.value.trim());
    setTimeout(masquerSuggestions, 150);
  });

  return conteneur;
}
