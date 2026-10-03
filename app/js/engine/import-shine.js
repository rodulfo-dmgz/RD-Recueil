// Import de l'export bancaire Shine (CRM, lot D, étape D6). Fonctions pures :
// pas de DOM, pas de base.
//
// Ce que contient l'export (fichier "BQ_<début>_<fin>.csv") : les mouvements
// bancaires, pas la liste des factures. Une facture n'y figure donc que si elle
// a été payée, et son numéro, le nom du client et la date d'émission ne se lisent
// que dans le nom de la pièce jointe ("FACTURE_3_Nom du client_2021-09-04.pdf").
// Encodage Windows-1252, séparateur ";", montants "1000,00", dates "jj/mm/aaaa".

const PIECE_FACTURE = /FACTURE[_ ]+(\d+)[_ ]+(.+?)[_ ]+(\d{4}-\d{2}-\d{2})\.(?:pdf|png|jpe?g)/gi;

// Octets du fichier -> texte. UTF-8 si valide, sinon Windows-1252 (cas de Shine).
export function decoderCsv(octets) {
  let texte;
  try {
    texte = new TextDecoder('utf-8', { fatal: true }).decode(octets);
  } catch {
    texte = new TextDecoder('windows-1252').decode(octets);
  }
  return texte.replace(/^﻿/, '');
}

// Texte CSV -> tableau de lignes (tableaux de cellules). Gère les cellules entre
// guillemets (séparateur, guillemets doublés et retours à la ligne inclus).
export function lireCsv(texte, separateur = ';') {
  const lignes = [];
  let ligne = [];
  let cellule = '';
  let entreGuillemets = false;
  for (let i = 0; i < texte.length; i += 1) {
    const c = texte[i];
    if (entreGuillemets) {
      if (c === '"' && texte[i + 1] === '"') {
        cellule += '"';
        i += 1;
      } else if (c === '"') {
        entreGuillemets = false;
      } else {
        cellule += c;
      }
    } else if (c === '"') {
      entreGuillemets = true;
    } else if (c === separateur) {
      ligne.push(cellule);
      cellule = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texte[i + 1] === '\n') i += 1;
      ligne.push(cellule);
      cellule = '';
      if (ligne.some((v) => v !== '')) lignes.push(ligne);
      ligne = [];
    } else {
      cellule += c;
    }
  }
  ligne.push(cellule);
  if (ligne.some((v) => v !== '')) lignes.push(ligne);
  return lignes;
}

// "Date d'opération" -> "date d operation" : comparaison des titres de colonnes
// sans accents ni ponctuation, pour ne pas dépendre de l'encodage du fichier.
function normaliser(titre) {
  return String(titre ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const COLONNES = {
  transactionId: 'transaction id',
  dateOperation: 'date d operation',
  credit: 'credit',
  libelle: 'libelle',
  contrepartie: 'nom de la contrepartie',
  montantHt: 'montant ht',
  pieces: 'pieces',
};
// Colonnes sans lesquelles le fichier n'est pas exploitable, avec leur titre dans Shine.
const OBLIGATOIRES = { transactionId: 'Transaction ID', dateOperation: "Date d'opération", credit: 'Crédit', pieces: 'Pièces' };

// "1000,00" ou "1 000,50" -> nombre ; vide ou illisible -> null.
export function lireMontantCsv(texte) {
  const brut = String(texte ?? '').replace(/[\s  ]/g, '').replace(',', '.');
  if (brut === '') return null;
  const n = Number(brut);
  return Number.isFinite(n) ? n : null;
}

// "06/09/2021" -> "2021-09-06" ; autre forme -> null.
export function lireDateCsv(texte) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(texte ?? '').trim());
  if (!m) return null;
  const date = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  if (date.getFullYear() !== Number(m[3]) || date.getMonth() !== Number(m[2]) - 1 || date.getDate() !== Number(m[1])) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// Texte de l'export -> { mouvements, erreur }. `erreur` est un message en
// français quand le fichier n'a pas la forme attendue ; sinon null.
export function analyserExportBanque(texte) {
  const lignes = lireCsv(texte);
  if (lignes.length === 0) return { mouvements: [], erreur: 'Le fichier est vide.' };
  const titres = lignes[0].map(normaliser);
  const index = {};
  for (const [cle, titre] of Object.entries(COLONNES)) index[cle] = titres.indexOf(titre);
  const manquantes = Object.keys(OBLIGATOIRES).filter((cle) => index[cle] === -1);
  if (manquantes.length > 0) {
    return { mouvements: [], erreur: 'Ce fichier ne ressemble pas à un export bancaire Shine : colonnes introuvables (' + manquantes.map((c) => OBLIGATOIRES[c]).join(', ') + ').' };
  }
  const cellule = (ligne, cle) => (index[cle] === -1 ? '' : (ligne[index[cle]] ?? '').trim());
  const mouvements = lignes.slice(1).map((ligne) => ({
    transactionId: cellule(ligne, 'transactionId'),
    dateOperation: lireDateCsv(cellule(ligne, 'dateOperation')),
    credit: lireMontantCsv(cellule(ligne, 'credit')) ?? 0,
    montantHt: lireMontantCsv(cellule(ligne, 'montantHt')),
    libelle: cellule(ligne, 'libelle'),
    contrepartie: cellule(ligne, 'contrepartie'),
    pieces: cellule(ligne, 'pieces'),
  }));
  return { mouvements, erreur: null };
}

// Mouvements -> factures payées. Un crédit dont la pièce jointe est une facture
// ("FACTURE_<n>_<client>_<date>.pdf") donne une facture : numéro, client, date
// d'émission (celle du nom de la pièce), date de paiement (date d'opération) et
// montant HT encaissé. Plusieurs crédits pour la même facture (paiement en
// plusieurs fois) sont additionnés ; la date de paiement est celle du dernier.
// Les autres crédits (aides, remboursements...) sont comptés dans `autresCredits`.
export function extraireFacturesPayees(mouvements = []) {
  const parNumero = new Map();
  let autresCredits = 0;
  for (const m of mouvements) {
    if (!(m.credit > 0)) continue;
    const pieces = [...m.pieces.matchAll(PIECE_FACTURE)];
    if (pieces.length !== 1) {
      autresCredits += 1;
      continue;
    }
    const [, numero, client, dateEmission] = pieces[0];
    const montant = Math.round((m.montantHt != null && m.montantHt > 0 ? m.montantHt : m.credit) * 100) / 100;
    const existante = parNumero.get(numero);
    if (existante) {
      existante.montantHt = Math.round((existante.montantHt + montant) * 100) / 100;
      existante.nbPaiements += 1;
      if (m.dateOperation && (!existante.datePaiement || m.dateOperation > existante.datePaiement)) existante.datePaiement = m.dateOperation;
      existante.transactions.push(m.transactionId);
    } else {
      parNumero.set(numero, {
        numero,
        client: client.trim(),
        dateEmission,
        datePaiement: m.dateOperation,
        montantHt: montant,
        nbPaiements: 1,
        transactions: [m.transactionId],
      });
    }
  }
  const factures = [...parNumero.values()].sort((a, b) => a.dateEmission.localeCompare(b.dateEmission) || Number(a.numero) - Number(b.numero));
  return { factures, autresCredits };
}

// Aperçu avant application : compare chaque facture du fichier aux références
// déjà saisies (même numéro). Rien n'est jamais supprimé ni écrasé.
//  - nouvelle : le numéro n'existe pas encore (à créer) ;
//  - paiement_a_enregistrer : le numéro existe sans date de paiement (on ajoute
//    seulement la date) ;
//  - deja_a_jour : le numéro existe et porte déjà une date de paiement.
// existantes : lignes de la table `factures` ({ id, demande_id, numero, date_paiement }).
export function planifierImport(facturesFichier = [], existantes = []) {
  const parNumero = new Map(existantes.filter((f) => f.numero).map((f) => [String(f.numero), f]));
  return facturesFichier.map((facture) => {
    const existante = parNumero.get(facture.numero);
    if (!existante) return { ...facture, etat: 'nouvelle', existante: null };
    return { ...facture, etat: existante.date_paiement ? 'deja_a_jour' : 'paiement_a_enregistrer', existante };
  });
}

export const LIBELLES_ETAT_IMPORT = {
  nouvelle: 'Nouvelle facture',
  paiement_a_enregistrer: 'Ajouter la date de paiement',
  deja_a_jour: 'Déjà à jour',
};

// ─── Rattachement aux demandes et application ───────────────────────────────

// Mots sans valeur pour reconnaître un client (civilités, formes juridiques).
const MOTS_VIDES = new Set(['madame', 'monsieur', 'mme', 'mr', 'mlle', 'm', 'sarl', 'sas', 'sasu', 'eurl', 'sa', 'et', 'de', 'la', 'le']);

function motsDuNom(nom) {
  return normaliser(nom)
    .split(' ')
    .filter((m) => m.length >= 2 && !MOTS_VIDES.has(m));
}

// Demandes dont le client ressemble au nom lu dans le fichier : tous les mots de
// l'un se retrouvent dans l'autre ("Madame Test Un" et "TEST UN" concordent).
// demandes : lignes de `demandes` avec `clients.raison_sociale`. Retourne les
// identifiants des demandes concordantes ; l'écran ne présélectionne que s'il y
// en a une seule.
export function demandesCorrespondantes(nomClient, demandes = []) {
  const mots = motsDuNom(nomClient);
  if (mots.length === 0) return [];
  return demandes
    .filter((d) => {
      const motsClient = motsDuNom(d.clients?.raison_sociale);
      if (motsClient.length === 0) return false;
      return mots.every((m) => motsClient.includes(m)) || motsClient.every((m) => mots.includes(m));
    })
    .map((d) => d.id);
}

// Plan d'import + choix de l'utilisateur -> ce qu'il faut écrire en base.
// choix : { [numero]: demande_id } pour les factures nouvelles. Une facture
// nouvelle sans demande choisie est ignorée (listée avec sa raison) ; une facture
// déjà à jour ne génère rien.
export function preparerApplication(plan = [], choix = {}) {
  const creations = [];
  const paiements = [];
  const ignorees = [];
  let dejaAJour = 0;
  for (const f of plan) {
    if (f.etat === 'deja_a_jour') {
      dejaAJour += 1;
    } else if (f.etat === 'paiement_a_enregistrer') {
      paiements.push({ id: f.existante.id, numero: f.numero, date_paiement: f.datePaiement });
    } else if (!choix[f.numero]) {
      ignorees.push({ numero: f.numero, raison: 'Aucune demande choisie' });
    } else {
      creations.push({
        demande_id: choix[f.numero],
        numero: f.numero,
        montant_ht: f.montantHt,
        date_emission: f.dateEmission,
        date_paiement: f.datePaiement,
        source: 'import',
      });
    }
  }
  return { creations, paiements, ignorees, dejaAJour };
}
