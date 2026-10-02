// Lignes de documents d'une demande (note de cadrage, proposition, pièces
// déposées) : partagé entre l'espace client et la fiche client du staff.
import { urlTelechargement } from '../services/documents.js';
import { listerLignes } from '../services/propositions.js';
import { chargerReponses } from '../services/reponses.js';
import { creerLigneNavigation } from './liste-navigation.js';
import { creerLigneDocument } from './document-viewer.js';
import { rendreMarkdown, separerAnnexeGlossaire, injecterValidationDansCorps } from './markdown.js';
import { construireDevisImprimable } from './devis-imprimable.js';
import { afficherToast } from './toast.js';
import { LIBELLES_STATUT } from '../engine/statuts.js';

function formaterTaille(octets) {
  if (octets == null) return '';
  return octets < 1024 * 1024 ? `${Math.max(1, Math.round(octets / 1024))} Ko` : `${(octets / 1024 / 1024).toFixed(1)} Mo`;
}

function ligneFichier(fichier) {
  const ligne = creerLigneNavigation({
    href: '#',
    icone: 'paperclip',
    titre: fichier.nom.replace(/</g, '&lt;'),
    sousTitre: `Pièce déposée ${formaterTaille(fichier.taille)}`.trim(),
  });
  ligne.addEventListener('click', async (evt) => {
    evt.preventDefault();
    try {
      window.open(await urlTelechargement(fichier.chemin), '_blank', 'noopener');
    } catch (err) {
      afficherToast(err.message, { type: 'erreur' });
    }
  });
  return ligne;
}

// lireReponses : chargerReponses (vue client) par défaut ; le staff passe
// chargerReponsesStaff pour lire la table complète.
export async function construireLignesDemande(demande, documents, { lireReponses = chargerReponses } = {}) {
  const elements = [];

  const note = documents.notes.find((n) => n.demande_id === demande.id);
  if (note) {
    const { corps } = separerAnnexeGlossaire(note.contenu_md);
    elements.push(
      creerLigneDocument({
        titre: 'Note de cadrage',
        sousTitre: `Version ${note.version} · ${LIBELLES_STATUT[note.statut] || note.statut}`,
        icone: 'file-text',
        contenuHtml: rendreMarkdown(injecterValidationDansCorps(corps, note)),
      })
    );
  }

  const proposition = documents.propositions.find((p) => p.demande_id === demande.id);
  if (proposition) {
    const [lignes, reponses] = await Promise.all([listerLignes(proposition.id), lireReponses(demande.id)]);
    const noeud = construireDevisImprimable({ demande, reponses, proposition, lignes });
    elements.push(
      creerLigneDocument({
        titre: 'Proposition commerciale',
        icone: 'receipt',
        contenuHtml: noeud.innerHTML,
        classeCorps: 'devis-imprimable',
      })
    );
  }

  for (const f of documents.fichiers.filter((x) => x.demande_id === demande.id)) elements.push(ligneFichier(f));
  return elements;
}
