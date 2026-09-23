// Grille éditable, colonnes définies par question.colonnes (section 6.1/6.2).
export function render(question, valeur, { onChange, lectureSeule }) {
  const colonnes = question.colonnes || [];
  let lignes = Array.isArray(valeur) ? valeur.map((l) => ({ ...l })) : [];

  const conteneur = document.createElement('div');
  conteneur.className = 'champ-tableau';
  const table = document.createElement('table');

  function rendre() {
    table.innerHTML = '';

    const thead = document.createElement('thead');
    const trHead = document.createElement('tr');
    for (const colonne of colonnes) {
      const th = document.createElement('th');
      th.textContent = colonne;
      trHead.appendChild(th);
    }
    trHead.appendChild(document.createElement('th'));
    thead.appendChild(trHead);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    lignes.forEach((ligne, index) => {
      const tr = document.createElement('tr');
      for (const colonne of colonnes) {
        const td = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'text';
        input.value = ligne[colonne] ?? '';
        input.disabled = Boolean(lectureSeule);
        input.addEventListener('input', () => {
          ligne[colonne] = input.value;
          onChange(lignes.map((l) => ({ ...l })));
        });
        td.appendChild(input);
        tr.appendChild(td);
      }

      const tdSupprimer = document.createElement('td');
      if (!lectureSeule) {
        const bouton = document.createElement('button');
        bouton.type = 'button';
        bouton.className = 'btn btn--secondaire';
        bouton.textContent = 'Supprimer';
        bouton.addEventListener('click', () => {
          lignes.splice(index, 1);
          onChange(lignes.map((l) => ({ ...l })));
          rendre();
        });
        tdSupprimer.appendChild(bouton);
      }
      tr.appendChild(tdSupprimer);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
  }

  rendre();
  conteneur.appendChild(table);

  if (!lectureSeule) {
    const ajouter = document.createElement('button');
    ajouter.type = 'button';
    ajouter.className = 'btn btn--secondaire';
    ajouter.textContent = 'Ajouter une ligne';
    ajouter.addEventListener('click', () => {
      lignes.push(Object.fromEntries(colonnes.map((c) => [c, ''])));
      onChange(lignes.map((l) => ({ ...l })));
      rendre();
    });
    conteneur.appendChild(ajouter);
  }

  return conteneur;
}
