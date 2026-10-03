// Fil d'Ariane de la barre du haut : déduit de l'adresse (#/...) de la page.
// Fonction pure. Résultat : [{ libelle, href? }], le dernier élément (page
// courante) n'a pas de href. nomClient : nom du client de la fiche ouverte, quand
// la page l'a chargé ; titreRepli : titre de la page quand aucune règle ne s'applique.

const ONGLETS_CLIENT = {
  activite: 'Activité',
  contacts: 'Contacts',
  demandes: 'Demandes',
  documents: 'Documents',
  reclamations: 'Réclamations',
  modifications: 'Modifications',
};
const ETAPES_DEMANDE = {
  entretien: 'Entretien',
  cadrage: 'Note de cadrage',
  proposition: 'Proposition',
  creneaux: 'Créneaux',
  preuves: 'Preuves',
};
const ETAPES_DEMANDE_CLIENT = {
  recap: 'Récapitulatif',
  cadrage: 'Note de cadrage',
  proposition: 'Proposition',
  creneaux: 'Créneaux',
  s: 'Questionnaire',
};

export function filAriane(hash, { nomClient = null, titreRepli = 'RD Recueil' } = {}) {
  const parties = String(hash || '#/')
    .replace(/^#\/?/, '')
    .split('?')[0]
    .split('/')
    .filter(Boolean)
    .map((p) => decodeURIComponent(p));
  const [racine, deuxieme, troisieme] = parties;
  const repli = [{ libelle: titreRepli }];

  if (racine === 'clients' && parties.length >= 2) {
    const clients = { libelle: 'Clients', href: '#/clients' };
    if (deuxieme === 'nouveau') return [clients, { libelle: 'Nouveau client' }];
    if (deuxieme === 'doublons') return [clients, { libelle: 'Doublons' }];
    if (deuxieme === 'dormants') return [clients, { libelle: 'Clients dormants' }];
    const fiche = nomClient || 'Fiche client';
    if (troisieme && ONGLETS_CLIENT[troisieme]) return [clients, { libelle: fiche, href: `#/clients/${deuxieme}` }, { libelle: ONGLETS_CLIENT[troisieme] }];
    return [clients, { libelle: fiche }];
  }
  if (racine === 'demandes' && parties.length >= 2) {
    const demandes = { libelle: 'Demandes', href: '#/demandes' };
    if (deuxieme === 'nouvelle') return [demandes, { libelle: 'Nouvelle demande' }];
    if (troisieme && ETAPES_DEMANDE[troisieme]) return [demandes, { libelle: deuxieme, href: `#/demandes/${deuxieme}` }, { libelle: ETAPES_DEMANDE[troisieme] }];
    return [demandes, { libelle: deuxieme }];
  }
  if (racine === 'd' && deuxieme) {
    const mesDemandes = { libelle: 'Mes demandes', href: '#/mes-demandes' };
    if (troisieme) return [mesDemandes, { libelle: deuxieme, href: `#/d/${deuxieme}` }, { libelle: ETAPES_DEMANDE_CLIENT[troisieme] ?? troisieme }];
    return [mesDemandes, { libelle: deuxieme }];
  }
  if (racine === 'taches') return [{ libelle: 'Tâches' }, { libelle: deuxieme === 'kanban' ? 'Kanban' : 'Liste' }];
  if (racine === 'reclamation' && deuxieme) return [{ libelle: 'Signaler un problème', href: '#/reclamation' }, { libelle: deuxieme }];
  return repli;
}
