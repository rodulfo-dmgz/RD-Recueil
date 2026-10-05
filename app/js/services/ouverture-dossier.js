// Ouverture d'un dossier client en une fois (page « Nouveau client ou prospect ») : la fiche
// (déjà remplie par la recherche SIRET), puis, si on invite le contact, son enregistrement
// comme contact principal, la demande, « Identification de la structure » pré-remplie et le
// compte client. Chaque étape après la fiche peut échouer sans défaire les précédentes : le
// résultat dit ce qui a été fait et ce qui reste à faire (rien n'est supprimé en cas d'échec).
import { enregistrerClient, enregistrerContact } from './clients.js';
import { creerDemande, inviterClient } from './demandes.js';
import { enregistrerReponse } from './reponses.js';
import { rechercherEntreprise } from './entreprises.js';
import { reponsesIdentification, separerNom } from '../engine/pre-remplissage.js';
import { preparerContact } from '../engine/fiche-client.js';

// champs : ligne de la fiche (preparerFiche) ; invitation : { nom, email, types, dateLimite } ou null.
// Retour : { client, demande, compte, avertissements: [texte] } ; une erreur n'est lancée que si la
// fiche elle-même n'a pas pu être créée (ou la demande, qui n'a alors pas de suite).
export async function ouvrirDossierClient({ champs, invitation = null, consultantId }) {
  const client = await enregistrerClient(null, champs);
  const resultat = { client, demande: null, compte: null, avertissements: [] };
  if (!invitation) return resultat;

  try {
    const { prenom, nom } = separerNom(invitation.nom);
    await enregistrerContact(client.id, null, preparerContact({ prenom, nom, email: invitation.email, principal: true }));
  } catch (err) {
    resultat.avertissements.push(`Le contact n'a pas pu être ajouté à la fiche (${err.message}).`);
  }

  try {
    resultat.demande = await creerDemande({ clientId: client.id, types: invitation.types, dateLimite: invitation.dateLimite, consultantId });
  } catch (err) {
    resultat.avertissements.push(`La fiche est créée mais pas la demande (${err.message}). Créez-la depuis la fiche du client.`);
    return resultat;
  }

  // « Identification de la structure » arrive remplie : fiche et base SIRENE. Un échec est sans gravité.
  try {
    const sirene = champs.siret ? await rechercherEntreprise(champs.siret).catch(() => null) : null;
    const reponses = reponsesIdentification({ fiche: champs, sirene });
    const bilan = await Promise.allSettled(reponses.map((r) => enregistrerReponse(resultat.demande.id, r.question_id, { valeur: r.valeur, nsp: false })));
    const echecs = bilan.filter((b) => b.status === 'rejected').length;
    if (echecs > 0) resultat.avertissements.push(`${echecs} réponse(s) de « Identification de la structure » n'ont pas pu être pré-remplies.`);
  } catch (err) {
    resultat.avertissements.push(`« Identification de la structure » n'a pas pu être pré-remplie (${err.message}).`);
  }

  try {
    resultat.compte = await inviterClient(resultat.demande.id, invitation.email, { droit: 'editeur', nom: invitation.nom, statutActuel: 'brouillon' });
  } catch (err) {
    resultat.avertissements.push(`Le compte client n'a pas pu être créé (${err.message}). Vous pouvez réessayer depuis la demande.`);
  }
  return resultat;
}
