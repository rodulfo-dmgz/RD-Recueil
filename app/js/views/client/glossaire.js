import { chargerGlossaire, obtenirVersionPublieeCourante } from '../../services/questionnaire.js';
import { afficherToast } from '../../components/toast.js';

export async function vueGlossaire() {
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><p>Chargement…</p></main>';

  try {
    const questionnaireId = await obtenirVersionPublieeCourante();
    if (!questionnaireId) {
      app.innerHTML = '<main class="conteneur"><h1>Glossaire</h1><p>Aucun glossaire publié pour le moment.</p></main>';
      return;
    }
    const termes = await chargerGlossaire(questionnaireId);
    rendre(termes);
  } catch (err) {
    afficherToast(err.message, { type: 'erreur' });
    app.innerHTML = '<main class="conteneur"><h1>Impossible de charger le glossaire</h1></main>';
  }
}

function rendre(termes) {
  const categories = [...new Set(termes.map((t) => t.categorie))].sort();
  const app = document.getElementById('app');
  app.innerHTML = '';

  const main = document.createElement('main');
  main.className = 'conteneur';

  const titre = document.createElement('h1');
  titre.textContent = 'Glossaire';
  main.appendChild(titre);

  const barre = document.createElement('div');
  barre.className = 'glossaire-barre';

  const recherche = document.createElement('input');
  recherche.type = 'search';
  recherche.className = 'champ-saisie';
  recherche.placeholder = 'Rechercher un terme…';

  const filtre = document.createElement('select');
  filtre.className = 'champ-saisie';
  const toutes = document.createElement('option');
  toutes.value = '';
  toutes.textContent = 'Toutes les catégories';
  filtre.appendChild(toutes);
  for (const categorie of categories) {
    const option = document.createElement('option');
    option.value = categorie;
    option.textContent = categorie;
    filtre.appendChild(option);
  }

  barre.append(recherche, filtre);
  main.appendChild(barre);

  const liste = document.createElement('div');
  liste.className = 'glossaire-liste';
  main.appendChild(liste);

  function rafraichir() {
    const q = recherche.value.trim().toLowerCase();
    const categorie = filtre.value;
    liste.innerHTML = '';

    const filtres = termes
      .filter(
        (t) =>
          (!categorie || t.categorie === categorie) &&
          (!q || t.libelle.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q))
      )
      .sort((a, b) => a.libelle.localeCompare(b.libelle));

    if (filtres.length === 0) {
      const vide = document.createElement('p');
      vide.className = 'texte-doux';
      vide.textContent = 'Aucun terme ne correspond.';
      liste.appendChild(vide);
      return;
    }

    for (const terme of filtres) {
      const carte = document.createElement('article');
      carte.className = 'carte glossaire-terme';
      const h2 = document.createElement('h2');
      h2.textContent = terme.libelle;
      const cat = document.createElement('p');
      cat.className = 'texte-doux';
      cat.textContent = terme.categorie;
      const def = document.createElement('p');
      def.textContent = terme.definition;
      const ex = document.createElement('p');
      ex.className = 'glossaire-terme__exemple';
      ex.textContent = terme.exemple;
      carte.append(h2, cat, def, ex);
      liste.appendChild(carte);
    }
  }

  recherche.addEventListener('input', rafraichir);
  filtre.addEventListener('change', rafraichir);
  rafraichir();

  app.appendChild(main);
}
