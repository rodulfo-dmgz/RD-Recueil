// Jalons d'une demande (dates importantes) : calendrier et rapport du client,
// indicateurs de l'admin - 01_ARCHITECTURE.md sections 4.1 et 4.2.
// Un jalon : { demande_id, reference, client, type, date }, type = 'creation',
// un statut (envoyee, soumise...), 'entretien' (date du rendez-vous) ou
// 'echeance' (date limite). Fonctions pures, testées.

export const LIBELLES_JALON = {
  creation: 'Demande créée',
  envoyee: 'Accès envoyé',
  en_saisie: 'Début de la saisie',
  soumise: 'Réponses envoyées',
  entretien_planifie: 'Entretien planifié',
  entretien: 'Rendez-vous d’entretien',
  en_analyse: 'Analyse du besoin',
  cadrage_envoye: 'Note de cadrage envoyée',
  cadrage_a_revoir: 'Modification demandée',
  cadrage_valide: 'Note de cadrage signée',
  proposition_envoyee: 'Proposition envoyée',
  gagnee: 'Proposition acceptée',
  perdue: 'Proposition refusée',
  reorientee: 'Demande réorientée',
  abandonnee: 'Demande abandonnée',
  echeance: 'Date limite',
};

const STATUTS_FINAUX_JALON = new Set(['gagnee', 'perdue', 'reorientee', 'abandonnee']);
const TYPES_HORS_STATUT = new Set(['creation', 'entretien', 'echeance']);
const MS_JOUR = 24 * 60 * 60 * 1000;

export function libelleJalon(type) {
  return LIBELLES_JALON[type] || type;
}

// 'fait' (déjà passé), 'avenir' (rendez-vous à venir), 'echeance' (date limite).
export function categorieJalon(jalon, maintenant = new Date()) {
  if (jalon.type === 'echeance') return 'echeance';
  if (jalon.type === 'entretien' && new Date(jalon.date) > maintenant) return 'avenir';
  return 'fait';
}

// Clé AAAA-MM-JJ dans le fuseau local du navigateur.
export function cleJour(date) {
  const d = new Date(date);
  const mois = String(d.getMonth() + 1).padStart(2, '0');
  const jour = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mois}-${jour}`;
}

export function trierJalons(jalons) {
  return [...jalons].sort((a, b) => new Date(a.date) - new Date(b.date));
}

export function jalonsParJour(jalons) {
  const parJour = new Map();
  for (const j of trierJalons(jalons)) {
    const cle = cleJour(j.date);
    if (!parJour.has(cle)) parJour.set(cle, []);
    parJour.get(cle).push(j);
  }
  return parJour;
}

// Grille d'un mois (mois de 0 à 11), semaines du lundi au dimanche ; null pour
// les cases hors du mois.
export function grilleMois(annee, mois) {
  const premier = new Date(annee, mois, 1);
  const decalage = (premier.getDay() + 6) % 7;
  const nbJours = new Date(annee, mois + 1, 0).getDate();
  const cases = [];
  for (let i = 0; i < decalage; i++) cases.push(null);
  for (let jour = 1; jour <= nbJours; jour++) {
    cases.push({ jour, cle: cleJour(new Date(annee, mois, jour)) });
  }
  while (cases.length % 7 !== 0) cases.push(null);
  const semaines = [];
  for (let i = 0; i < cases.length; i += 7) semaines.push(cases.slice(i, i + 7));
  return semaines;
}

export function grouperParDemande(jalons) {
  const groupes = new Map();
  for (const j of jalons) {
    if (!groupes.has(j.demande_id)) {
      groupes.set(j.demande_id, { demande_id: j.demande_id, reference: j.reference, client: j.client, jalons: [] });
    }
    groupes.get(j.demande_id).jalons.push(j);
  }
  for (const g of groupes.values()) g.jalons = trierJalons(g.jalons);
  return [...groupes.values()];
}

function premiereDate(jalons, ...types) {
  for (const type of types) {
    const j = jalons.find((x) => x.type === type);
    if (j) return new Date(j.date);
  }
  return null;
}

function jours(debut, fin) {
  if (!debut || !fin) return null;
  const ecart = (fin - debut) / MS_JOUR;
  return ecart >= 0 ? ecart : null;
}

// Dernier statut connu de la demande (hors création, rendez-vous et échéance).
function dernierStatut(jalons) {
  const statuts = jalons.filter((j) => !TYPES_HORS_STATUT.has(j.type));
  return statuts[statuts.length - 1] ?? null;
}

// Délais en jours entre les étapes clés ; null si une étape manque.
export function delaisDemande(jalons) {
  const trie = trierJalons(jalons);
  const dernier = dernierStatut(trie);
  const terminee = Boolean(dernier && STATUTS_FINAUX_JALON.has(dernier.type));
  return {
    reponseClient: jours(premiereDate(trie, 'envoyee'), premiereDate(trie, 'soumise')),
    priseRdv: jours(premiereDate(trie, 'soumise'), premiereDate(trie, 'entretien_planifie')),
    redactionNote: jours(premiereDate(trie, 'en_analyse', 'entretien_planifie'), premiereDate(trie, 'cadrage_envoye')),
    signatureNote: jours(premiereDate(trie, 'cadrage_envoye'), premiereDate(trie, 'cadrage_valide')),
    decisionProposition: jours(premiereDate(trie, 'proposition_envoyee'), premiereDate(trie, 'gagnee', 'perdue')),
    total: terminee ? jours(premiereDate(trie, 'creation'), new Date(dernier.date)) : null,
  };
}

export const ETAPES_DELAIS = [
  { cle: 'reponseClient', libelle: 'Réponse du client', detail: 'accès envoyé, réponses envoyées' },
  { cle: 'priseRdv', libelle: 'Prise de rendez-vous', detail: 'réponses envoyées, entretien planifié' },
  { cle: 'redactionNote', libelle: 'Rédaction de la note', detail: 'analyse, note envoyée' },
  { cle: 'signatureNote', libelle: 'Signature de la note', detail: 'note envoyée, note signée' },
  { cle: 'decisionProposition', libelle: 'Décision sur la proposition', detail: 'proposition envoyée, réponse du client' },
  { cle: 'total', libelle: 'Durée totale', detail: 'création, décision (demandes terminées)' },
];

function moyenne(valeurs) {
  const utiles = valeurs.filter((v) => v != null);
  if (utiles.length === 0) return { moyenne: null, n: 0 };
  return { moyenne: utiles.reduce((a, b) => a + b, 0) / utiles.length, n: utiles.length };
}

// groupes : résultat de grouperParDemande.
export function calculerKpis(groupes) {
  const delaisParDemande = groupes.map((g) => delaisDemande(g.jalons));
  const delais = {};
  for (const { cle } of ETAPES_DELAIS) delais[cle] = moyenne(delaisParDemande.map((d) => d[cle]));

  const gagnees = groupes.filter((g) => g.jalons.some((j) => j.type === 'gagnee')).length;
  const perdues = groupes.filter((g) => g.jalons.some((j) => j.type === 'perdue')).length;
  const enCours = groupes.filter((g) => {
    const dernier = dernierStatut(g.jalons);
    return !dernier || !STATUTS_FINAUX_JALON.has(dernier.type);
  }).length;

  return {
    total: groupes.length,
    enCours,
    delais,
    conversion: { gagnees, perdues, taux: gagnees + perdues > 0 ? gagnees / (gagnees + perdues) : null },
  };
}

// "3,5 j", "4 h", "< 1 h", "-" : durée lisible à partir de jours.
export function formaterDelai(valeurJours) {
  if (valeurJours == null) return '-';
  if (valeurJours < 1 / 24) return '< 1 h';
  if (valeurJours < 1) return `${Math.round(valeurJours * 24)} h`;
  return `${valeurJours.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} j`;
}

// Chronologie d'une demande : jalons triés avec le délai depuis le précédent.
export function chronologie(jalons) {
  const trie = trierJalons(jalons);
  return trie.map((j, i) => ({
    ...j,
    libelle: libelleJalon(j.type),
    delaiDepuisPrecedent: i === 0 ? null : jours(new Date(trie[i - 1].date), new Date(j.date)),
  }));
}
