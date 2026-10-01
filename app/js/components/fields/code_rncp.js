import {
  estCodeRncp,
  verifierCodeRncp,
  rechercherCertifInfo,
  obtenirCertifInfo,
} from '../../services/certifications.js';

function formaterDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('fr-FR');
}

function construireResultat(resultat) {
  const bloc = document.createElement('div');
  bloc.className = 'champ-code-rncp__resultat';

  if (!resultat.trouve) {
    bloc.textContent = 'Code RNCP inconnu de France Compétences.';
    return bloc;
  }

  const entete = document.createElement('p');
  entete.className = 'champ-code-rncp__intitule';
  entete.textContent = resultat.intitule || resultat.rncp;
  bloc.appendChild(entete);

  const debut = formaterDate(resultat.periodeValidite?.debut);
  const fin = formaterDate(resultat.periodeValidite?.fin);
  const statut = document.createElement('p');
  statut.className = resultat.actif ? 'champ-code-rncp__badge champ-code-rncp__badge--actif' : 'champ-code-rncp__badge champ-code-rncp__badge--expire';
  statut.textContent = resultat.actif
    ? `Certification active${debut ? ` depuis le ${debut}` : ''}.`
    : `Certification expirée${fin ? ` depuis le ${fin}` : ''}.`;
  bloc.appendChild(statut);

  if (resultat.blocsCompetences?.length) {
    const titre = document.createElement('p');
    titre.className = 'champ-code-rncp__section-titre';
    titre.textContent = 'Blocs de compétences (utile pour la note de cadrage) :';
    bloc.appendChild(titre);
    const liste = document.createElement('ul');
    liste.className = 'champ-code-rncp__liste';
    for (const b of resultat.blocsCompetences) {
      const li = document.createElement('li');
      li.textContent = b.intitule;
      liste.appendChild(li);
    }
    bloc.appendChild(liste);
  }

  const domaines = [...(resultat.domaines?.rome || []), ...(resultat.domaines?.nsf || [])];
  if (domaines.length) {
    const titre = document.createElement('p');
    titre.className = 'champ-code-rncp__section-titre';
    titre.textContent = 'Domaine :';
    bloc.appendChild(titre);
    const liste = document.createElement('ul');
    liste.className = 'champ-code-rncp__liste';
    for (const d of domaines) {
      const li = document.createElement('li');
      li.textContent = d.intitule;
      liste.appendChild(li);
    }
    bloc.appendChild(liste);
  }

  if (resultat.conventionCollectives?.length) {
    const titre = document.createElement('p');
    titre.className = 'champ-code-rncp__section-titre';
    titre.textContent = 'Convention(s) collective(s) associée(s) :';
    bloc.appendChild(titre);
    const liste = document.createElement('ul');
    liste.className = 'champ-code-rncp__liste';
    for (const c of resultat.conventionCollectives) {
      const li = document.createElement('li');
      li.textContent = `${c.numero} - ${c.intitule}`;
      liste.appendChild(li);
    }
    bloc.appendChild(liste);
  }

  if (resultat.voiesAcces?.length) {
    const titre = document.createElement('p');
    titre.className = 'champ-code-rncp__section-titre';
    titre.textContent = "Voies d'accès :";
    bloc.appendChild(titre);
    const texte = document.createElement('p');
    texte.className = 'texte-doux';
    texte.textContent = resultat.voiesAcces.join(', ');
    bloc.appendChild(texte);
  }

  if (resultat.lienOfficiel) {
    const lien = document.createElement('a');
    lien.href = resultat.lienOfficiel;
    lien.target = '_blank';
    lien.rel = 'noopener noreferrer';
    lien.className = 'champ-code-rncp__lien';
    lien.textContent = 'Voir la fiche officielle France Compétences';
    bloc.appendChild(lien);
  }

  return bloc;
}

const LIBELLES_ACCESSIBILITE = {
  formationInitiale: 'Formation initiale',
  apprentissage: 'Apprentissage',
  formationContinue: 'Formation continue',
  contratPro: 'Contrat de professionnalisation',
  vae: 'VAE',
  individuelle: 'Demande individuelle',
};

// Fiche Certif Info (intercariforef.org) - référentiel plus large que le
// seul RNCP, choisie via la recherche par intitulé (cf. render ci-dessous).
function construireResultatCertifInfo(resultat) {
  const bloc = document.createElement('div');
  bloc.className = 'champ-code-rncp__resultat';

  if (!resultat.trouve) {
    bloc.textContent = 'Certification introuvable dans Certif Info.';
    return bloc;
  }

  const entete = document.createElement('p');
  entete.className = 'champ-code-rncp__intitule';
  entete.textContent = resultat.intitule;
  bloc.appendChild(entete);

  if (resultat.actif) {
    const statut = document.createElement('p');
    statut.className = 'champ-code-rncp__badge champ-code-rncp__badge--actif';
    statut.textContent = resultat.actif;
    bloc.appendChild(statut);
  }

  if (resultat.objectif) {
    const titre = document.createElement('p');
    titre.className = 'champ-code-rncp__section-titre';
    titre.textContent = 'Objectif :';
    bloc.appendChild(titre);
    const texte = document.createElement('p');
    texte.className = 'texte-doux';
    texte.textContent = resultat.objectif;
    bloc.appendChild(texte);
  }

  const codesLies = [
    ...(resultat.rncp || []).map((r) => `RNCP ${r.code}`),
    ...(resultat.rs || []).map((r) => `RS ${r.code}`),
  ];
  if (codesLies.length) {
    const titre = document.createElement('p');
    titre.className = 'champ-code-rncp__section-titre';
    titre.textContent = 'Codes liés :';
    bloc.appendChild(titre);
    const texte = document.createElement('p');
    texte.className = 'texte-doux';
    texte.textContent = codesLies.join(', ');
    bloc.appendChild(texte);
  }

  const voiesAcces = Object.entries(resultat.accessibilite || {})
    .filter(([, actif]) => actif)
    .map(([cle]) => LIBELLES_ACCESSIBILITE[cle] || cle);
  if (voiesAcces.length) {
    const titre = document.createElement('p');
    titre.className = 'champ-code-rncp__section-titre';
    titre.textContent = "Voies d'accès :";
    bloc.appendChild(titre);
    const texte = document.createElement('p');
    texte.className = 'texte-doux';
    texte.textContent = voiesAcces.join(', ');
    bloc.appendChild(texte);
  }

  return bloc;
}

// Champ libre (titre, code RNCP ou RS) - seul un code RNCP au format
// "RNCP12345" peut être vérifié auprès de France Compétences (l'API ne
// couvre pas le Répertoire Spécifique). Pour tout autre texte d'au moins 3
// caractères, une recherche par intitulé dans Certif Info (référentiel plus
// large, intercariforef.org) propose des suggestions ; en choisir une
// affiche sa fiche complète. La vérification/recherche n'est jamais
// persistée : elle est relancée à chaque affichage du champ pour que le
// résultat reste visible plutôt que de disparaître dès que le composant est
// reconstruit.
export function render(question, valeur, { onChange, lectureSeule }) {
  const conteneur = document.createElement('div');
  conteneur.className = 'champ-code-rncp';

  const champRecherche = document.createElement('div');
  champRecherche.className = 'champ-code-rncp__recherche';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'champ-saisie';
  input.placeholder = 'Ex. RNCP12345 ou "Chef de projet digital"';
  input.value = valeur ?? '';
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
    conteneur.querySelector('.champ-code-rncp__resultat')?.remove();
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
      conteneur.appendChild(construireResultat(resultat));
    } catch {
      statut.hidden = true;
    }
  }

  async function choisirSuggestion(suggestion) {
    masquerSuggestions();
    input.value = suggestion.intitule;
    onChange(input.value);
    statut.hidden = false;
    statut.textContent = 'Chargement de la fiche Certif Info…';
    try {
      const resultat = await obtenirCertifInfo(suggestion.certifinfoCode);
      statut.hidden = true;
      effacerResultat();
      conteneur.appendChild(construireResultatCertifInfo(resultat));
    } catch {
      statut.hidden = true;
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

  function lancerRechercheCertifInfo(texte) {
    clearTimeout(minuterieRecherche);
    if (estCodeRncp(texte) || texte.trim().length < 3) {
      masquerSuggestions();
      return;
    }
    minuterieRecherche = setTimeout(async () => {
      try {
        const resultats = await rechercherCertifInfo(texte.trim());
        afficherSuggestions(resultats);
      } catch {
        masquerSuggestions();
      }
    }, 400);
  }

  if (estCodeRncp(valeur)) {
    lancerVerificationRncp(valeur.trim());
  }

  if (lectureSeule) {
    return conteneur;
  }

  input.addEventListener('input', () => {
    onChange(input.value);
    dernierCodeVerifie = null;
    statut.hidden = true;
    effacerResultat();
    lancerRechercheCertifInfo(input.value);
  });

  input.addEventListener('blur', () => {
    lancerVerificationRncp(input.value.trim());
    setTimeout(masquerSuggestions, 150);
  });

  return conteneur;
}
