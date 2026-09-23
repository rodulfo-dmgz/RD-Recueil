// Validation par type de champ - 01_ARCHITECTURE.md section 6.2.

export const TAILLE_FICHIER_MAX_OCTETS = 20 * 1024 * 1024;
export const EXTENSIONS_FICHIER_AUTORISEES = ['pdf', 'docx', 'xlsx', 'pptx', 'png', 'jpg', 'jpeg'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CP_RE = /^\d{5}$/;

function estVide(valeur) {
  if (valeur == null) return true;
  if (typeof valeur === 'string') return valeur.trim() === '';
  if (Array.isArray(valeur)) return valeur.length === 0;
  if (typeof valeur === 'object') return Object.keys(valeur).length === 0;
  return false;
}

function estDateValide(texte) {
  return typeof texte === 'string' && DATE_RE.test(texte) && !Number.isNaN(Date.parse(texte));
}

function luhnValide(chiffres) {
  let somme = 0;
  for (let i = 0; i < chiffres.length; i++) {
    let n = Number(chiffres[chiffres.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    somme += n;
  }
  return somme % 10 === 0;
}

function validerEmail(email) {
  return EMAIL_RE.test(email) ? null : 'Adresse e-mail invalide.';
}

const VALIDATEURS = {
  texte: (v) => {
    if (typeof v !== 'string' || v.length < 1 || v.length > 300) return '1 à 300 caractères attendus.';
    return null;
  },
  texte_long: (v) => {
    if (typeof v !== 'string' || v.length < 1 || v.length > 5000) return '1 à 5 000 caractères attendus.';
    return null;
  },
  nombre: (v) => {
    if (!Number.isInteger(v) || v < 0) return 'Nombre entier positif attendu.';
    return null;
  },
  montant: (v) => {
    if (typeof v !== 'number' || v < 0) return 'Montant positif attendu.';
    const decimales = (String(v).split('.')[1] || '').length;
    if (decimales > 2) return 'Deux décimales maximum.';
    return null;
  },
  date: (v) => (estDateValide(v) ? null : 'Date invalide (AAAA-MM-JJ).'),
  periode: (v) => {
    if (!v || !estDateValide(v.debut) || !estDateValide(v.fin)) return 'Période invalide.';
    if (v.fin < v.debut) return 'La date de fin doit être postérieure ou égale à la date de début.';
    return null;
  },
  choix_unique: (v, question) => {
    const valeurs = (question.options || []).map((o) => o.valeur);
    if (!valeurs.includes(v)) return 'Choix invalide.';
    return null;
  },
  choix_multiple: (v, question, { obligatoire }) => {
    if (!Array.isArray(v)) return 'Choix invalide.';
    const valeurs = new Set((question.options || []).map((o) => o.valeur));
    if (v.some((val) => !valeurs.has(val))) return 'Choix invalide.';
    if (obligatoire && v.length === 0) return 'Sélectionnez au moins une option.';
    return null;
  },
  oui_non: (v) => (v === 'oui' || v === 'non' ? null : 'Réponse "oui" ou "non" attendue.'),
  classement: (v, question) => {
    const attendu = (question.options || []).map((o) => o.valeur).sort();
    const recu = Array.isArray(v) ? [...v].sort() : null;
    if (!recu || attendu.length !== recu.length || attendu.some((val, i) => val !== recu[i])) {
      return 'Le classement doit contenir tous les éléments proposés.';
    }
    return null;
  },
  tableau: (v, _question, { obligatoire }) => {
    if (!Array.isArray(v)) return 'Tableau invalide.';
    if (obligatoire && v.length === 0) return 'Ajoutez au moins une ligne.';
    return null;
  },
  contact: (v) => {
    if (!v || estVide(v.nom) || estVide(v.email)) return 'Nom et e-mail obligatoires.';
    return validerEmail(v.email);
  },
  tableau_contacts: (v, _question, { obligatoire }) => {
    if (!Array.isArray(v)) return 'Liste de contacts invalide.';
    if (obligatoire && v.length === 0) return 'Ajoutez au moins un contact.';
    for (const contact of v) {
      const erreur = VALIDATEURS.contact(contact);
      if (erreur) return erreur;
    }
    return null;
  },
  adresse: (v) => {
    if (!v || estVide(v.rue) || estVide(v.ville)) return 'Rue et ville obligatoires.';
    if (!CP_RE.test(v.cp || '')) return 'Code postal invalide (5 chiffres).';
    return null;
  },
  siret: (v) => {
    if (typeof v !== 'string' || !/^\d{14}$/.test(v)) return 'Le SIRET doit contenir 14 chiffres.';
    return luhnValide(v) ? null : 'SIRET invalide (clé de contrôle incorrecte).';
  },
  url: (v) => {
    try {
      const u = new URL(v);
      return u.protocol === 'http:' || u.protocol === 'https:' ? null : 'URL invalide.';
    } catch {
      return 'URL invalide.';
    }
  },
  fichier: (v, _question, { obligatoire }) => {
    if (!Array.isArray(v)) return 'Fichier(s) invalide(s).';
    if (obligatoire && v.length === 0) return 'Déposez au moins un fichier.';
    return null;
  },
};

export function validerFichierDepot({ nom, taille }) {
  if (taille > TAILLE_FICHIER_MAX_OCTETS) return 'Fichier trop volumineux (20 Mo maximum).';
  const extension = nom.split('.').pop().toLowerCase();
  if (!EXTENSIONS_FICHIER_AUTORISEES.includes(extension)) return 'Type de fichier non autorisé.';
  return null;
}

// Types dont la validation du "vide + obligatoire" produit un message dédié
// (ex. "Ajoutez au moins une ligne.") plutôt que le message générique : on ne
// court-circuite pas la vérification, on laisse le validateur du type gérer
// aussi bien une valeur absente qu'une liste vide.
const TYPES_LISTE = new Set(['choix_multiple', 'tableau', 'tableau_contacts', 'fichier']);

// Valide la réponse à une question. `nsp` (case "Je ne sais pas") rend la
// réponse valide quelle que soit la valeur (01_ARCHITECTURE.md section 6.2).
export function validerReponse(question, { valeur, nsp } = {}) {
  if (nsp) return null;

  const vide = estVide(valeur);

  if (TYPES_LISTE.has(question.type)) {
    return VALIDATEURS[question.type](vide ? [] : valeur, question, { obligatoire: question.obligatoire });
  }

  if (vide) {
    return question.obligatoire ? 'Réponse obligatoire.' : null;
  }

  const validateur = VALIDATEURS[question.type];
  if (!validateur) return null;
  return validateur(valeur, question, { obligatoire: question.obligatoire });
}
