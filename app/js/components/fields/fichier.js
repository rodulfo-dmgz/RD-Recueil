// Dépôt multiple - 01_ARCHITECTURE.md section 6.2 (20 Mo max, types autorisés
// validés par engine/validation.js avant l'appel à `televerser`).
export function render(question, valeur, { onChange, lectureSeule, televerser }) {
  let chemins = Array.isArray(valeur) ? [...valeur] : [];

  const conteneur = document.createElement('div');
  conteneur.className = 'champ-fichier';

  const liste = document.createElement('ul');
  liste.className = 'champ-fichier__liste';

  function rendreListe() {
    liste.innerHTML = '';
    chemins.forEach((chemin, index) => {
      const li = document.createElement('li');
      const nom = chemin.split('/').pop();
      const span = document.createElement('span');
      span.textContent = nom;
      li.appendChild(span);
      if (!lectureSeule) {
        const retirer = document.createElement('button');
        retirer.type = 'button';
        retirer.className = 'btn btn--secondaire';
        retirer.textContent = 'Retirer';
        retirer.addEventListener('click', () => {
          chemins.splice(index, 1);
          onChange([...chemins]);
          rendreListe();
        });
        li.appendChild(retirer);
      }
      liste.appendChild(li);
    });
  }
  rendreListe();
  conteneur.appendChild(liste);

  if (!lectureSeule && televerser) {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.addEventListener('change', async () => {
      const fichiers = [...input.files];
      input.value = '';
      for (const fichier of fichiers) {
        const chemin = await televerser(fichier, question.id);
        if (chemin) chemins.push(chemin);
      }
      onChange([...chemins]);
      rendreListe();
    });
    conteneur.appendChild(input);
  }

  return conteneur;
}
