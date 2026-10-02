// Documents du client, regroupés par demande : note de cadrage, proposition
// commerciale, pièces déposées - 01_ARCHITECTURE.md section 4.1.
import { listerMesDemandes } from '../../services/demandes.js';
import { listerDocumentsClient, urlTelechargement } from '../../services/documents.js';
import { listerLignes } from '../../services/propositions.js';
import { chargerReponses } from '../../services/reponses.js';
import { creerLigneNavigation, creerCarteListe } from '../../components/liste-navigation.js';
import { creerLigneDocument } from '../../components/document-viewer.js';
import { rendreMarkdown, separerAnnexeGlossaire, injecterValidationDansCorps } from '../../components/markdown.js';
import { construireDevisImprimable } from '../../components/devis-imprimable.js';
import { creerBoutonRetour } from '../../components/bouton-retour.js';
import { afficherToast } from '../../components/toast.js';
import { LIBELLES_STATUT } from '../../engine/statuts.js';

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

async function construireLignesDemande(demande, documents) {
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
    const [lignes, reponses] = await Promise.all([listerLignes(proposition.id), chargerReponses(demande.id)]);
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

export async function vueDocuments() {
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><p>Chargement…</p></main>';

  try {
    const demandes = await listerMesDemandes();
    const documents = await listerDocumentsClient(demandes.map((d) => d.id));

    const main = document.createElement('main');
    main.className = 'conteneur';
    main.appendChild(creerBoutonRetour('#/accueil', 'Retour au tableau de bord'));
    const titre = document.createElement('h1');
    titre.textContent = 'Mes documents';
    main.appendChild(titre);

    let nbBlocs = 0;
    for (const demande of demandes) {
      const elements = await construireLignesDemande(demande, documents);
      if (elements.length === 0) continue;
      nbBlocs++;
      const sousTitre = document.createElement('h2');
      sousTitre.textContent = demande.reference;
      main.append(sousTitre, creerCarteListe(elements));
    }
    if (nbBlocs === 0) {
      const vide = document.createElement('p');
      vide.className = 'texte-doux';
      vide.textContent = 'Aucun document disponible pour le moment. Ils apparaîtront ici au fil de votre demande.';
      main.appendChild(vide);
    }

    app.innerHTML = '';
    app.appendChild(main);
    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    afficherToast(err.message, { type: 'erreur' });
    app.innerHTML = '<main class="conteneur"><h1>Impossible de charger vos documents</h1></main>';
  }
}
