// Organisation choisie par l'utilisateur (ERP : une personne peut appartenir à plusieurs organismes).
// La base ne s'en sert que pour RESTREINDRE (en-tête x-organisme, voir crm_org_courante) ; elle ne donne
// jamais un droit de plus. Mémorisée dans le navigateur ; l'application fonctionne sans elle.
const CLE = 'crm_organisation';

export function lireOrganisation() {
  try {
    return window.localStorage.getItem(CLE) || null;
  } catch {
    return null;
  }
}

export function memoriserOrganisation(id) {
  try {
    if (id) window.localStorage.setItem(CLE, id);
    else window.localStorage.removeItem(CLE);
  } catch {
    // stockage indisponible : l'organisation unique de la personne est alors déduite par la base
  }
}
