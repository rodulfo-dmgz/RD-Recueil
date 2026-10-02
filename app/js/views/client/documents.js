// Documents du client, regroupés par demande : note de cadrage, proposition
// commerciale, pièces déposées - 01_ARCHITECTURE.md section 4.1.
import { listerMesDemandes } from '../../services/demandes.js';
import { getClientApercuId } from '../../store.js';
import { listerDocumentsClient } from '../../services/documents.js';
import { creerCarteListe } from '../../components/liste-navigation.js';
import { construireLignesDemande } from '../../components/documents-demande.js';
import { creerBoutonRetour } from '../../components/bouton-retour.js';
import { afficherToast } from '../../components/toast.js';

export async function vueDocuments() {
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><p>Chargement…</p></main>';

  try {
    const demandes = await listerMesDemandes({ userId: getClientApercuId() });
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
