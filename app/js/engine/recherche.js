// Recherche globale du CRM (lot E). Fonctions pures : la recherche porte sur des
// listes déjà chargées (selon les droits de l'utilisateur, la base ne renvoie que
// ce qu'il a le droit de voir) et ignore accents et casse.
//
// Portée : clients (nom, nom commercial, ville, SIRET, e-mail, téléphone),
// contacts (nom, e-mail, téléphone), demandes (référence, client) et, pour
// l'admin qui fournit la liste, factures (numéro).

import { chiffres, normaliserMots } from './texte.js';
import { nomComplet } from './fiche-client.js';

export const LONGUEUR_MIN_RECHERCHE = 2;
export const LIMITE_PAR_GROUPE = 5;

const TITRES = { clients: 'Clients', contacts: 'Contacts', demandes: 'Demandes', factures: 'Factures' };

// Un terme trop court ne cherche rien (évite d'afficher tout le CRM).
export function termeValide(terme) {
  return normaliserMots(terme).length >= LONGUEUR_MIN_RECHERCHE;
}

// Note de correspondance d'un terme sur un texte : 100 identique, 80 commence
// par le terme, 60 un mot commence par le terme, 40 le contient ; 0 sinon.
function noteTexte(texte, terme) {
  if (texte === '') return 0;
  if (texte === terme) return 100;
  if (texte.startsWith(terme)) return 80;
  if (` ${texte}`.includes(` ${terme}`)) return 60;
  return texte.includes(terme) ? 40 : 0;
}

// Tous les mots du terme doivent se retrouver (dans un champ au choix) ; la note
// d'un élément est la meilleure note de champ, ou la plus faible des notes de
// mot quand le terme en compte plusieurs. `numeros` : champs de chiffres
// (SIRET, téléphone) comparés sans espaces dès 3 chiffres.
function noterElement(champs, numeros, terme) {
  const mots = normaliserMots(terme).split(' ').filter(Boolean);
  const textes = champs.map((c) => normaliserMots(c));
  const chiffresTerme = chiffres(terme);
  const valeurs = numeros.map(chiffres);
  let pire = 100;
  for (const mot of mots) {
    let meilleure = Math.max(0, ...textes.map((t) => noteTexte(t, mot)));
    if (chiffresTerme.length >= 3 && chiffres(mot) === mot) {
      meilleure = Math.max(meilleure, ...valeurs.map((v) => (v === mot ? 100 : v.startsWith(mot) ? 80 : v.includes(mot) ? 40 : 0)));
    }
    if (meilleure === 0) return 0;
    pire = Math.min(pire, meilleure);
  }
  return mots.length === 0 ? 0 : pire;
}

function groupe(type, elements, limite) {
  const tries = elements
    .filter((e) => e.note > 0)
    .sort((a, b) => b.note - a.note || a.titre.localeCompare(b.titre, 'fr'));
  return { type, titre: TITRES[type], total: tries.length, items: tries.slice(0, limite) };
}

// donnees : { clients, contacts, demandes, factures } (listes facultatives).
// Retourne { total, groupes } : groupes non vides seulement, chaque item étant
// { id, titre, detail, href, note }.
export function rechercher(donnees = {}, terme = '', { limite = LIMITE_PAR_GROUPE } = {}) {
  if (!termeValide(terme)) return { total: 0, groupes: [] };
  const { clients = [], contacts = [], demandes = [], factures = [] } = donnees;
  const nomClient = new Map(clients.map((c) => [c.id, c.raison_sociale]));
  const refDemande = new Map(demandes.map((d) => [d.id, d.reference]));

  const resultatsClients = clients.map((c) => ({
    id: c.id,
    titre: c.raison_sociale,
    detail: [c.ville, c.siret].filter(Boolean).join(' · '),
    href: `#/clients/${c.id}`,
    note: noterElement([c.raison_sociale, c.nom_commercial, c.ville, c.email_general], [c.siret, c.telephone], terme),
  }));
  const resultatsContacts = contacts.map((k) => ({
    id: k.id,
    titre: nomComplet(k) || k.email || 'Contact sans nom',
    detail: [nomClient.get(k.client_id), k.email].filter(Boolean).join(' · '),
    href: `#/clients/${k.client_id}/contacts`,
    note: noterElement([nomComplet(k), k.nom, k.email], [k.telephone], terme),
  }));
  const resultatsDemandes = demandes.map((d) => ({
    id: d.id,
    titre: d.reference,
    detail: d.clients?.raison_sociale ?? '',
    href: `#/demandes/${d.reference}`,
    note: noterElement([d.reference, d.clients?.raison_sociale], [], terme),
  }));
  const resultatsFactures = factures.map((f) => ({
    id: f.id,
    titre: f.numero ? `Facture n° ${f.numero}` : 'Facture sans numéro',
    detail: refDemande.get(f.demande_id) ?? '',
    href: refDemande.has(f.demande_id) ? `#/demandes/${refDemande.get(f.demande_id)}` : '#/demandes',
    note: noterElement([f.numero], [], terme),
  }));

  const groupes = [
    groupe('clients', resultatsClients, limite),
    groupe('contacts', resultatsContacts, limite),
    groupe('demandes', resultatsDemandes, limite),
    groupe('factures', resultatsFactures, limite),
  ].filter((g) => g.total > 0);
  return { total: groupes.reduce((n, g) => n + g.total, 0), groupes };
}
