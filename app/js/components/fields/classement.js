// Liste réordonnable au clavier (boutons monter/descendre - accessible sans
// glisser-déposer). 01_ARCHITECTURE.md section 6.2.
export function render(question, valeur, { onChange, lectureSeule }) {
  const options = question.options || [];
  const libelleParValeur = new Map(options.map((o) => [o.valeur, o.libelle.replace(/\\\*/g, '')]));
  let ordre = Array.isArray(valeur) && valeur.length === options.length ? [...valeur] : options.map((o) => o.valeur);

  const liste = document.createElement('ol');
  liste.className = 'champ-classement';

  function deplacer(index, delta) {
    const nouvelIndex = index + delta;
    if (nouvelIndex < 0 || nouvelIndex >= ordre.length) return;
    [ordre[index], ordre[nouvelIndex]] = [ordre[nouvelIndex], ordre[index]];
    onChange([...ordre]);
    rendreListe();
  }

  function rendreListe() {
    liste.innerHTML = '';
    ordre.forEach((val, index) => {
      const item = document.createElement('li');
      item.className = 'champ-classement__item';
      const texte = document.createElement('span');
      texte.textContent = libelleParValeur.get(val) || val;
      item.appendChild(texte);

      if (!lectureSeule) {
        const haut = document.createElement('button');
        haut.type = 'button';
        haut.textContent = '↑';
        haut.setAttribute('aria-label', 'Monter');
        haut.disabled = index === 0;
        haut.addEventListener('click', () => deplacer(index, -1));

        const bas = document.createElement('button');
        bas.type = 'button';
        bas.textContent = '↓';
        bas.setAttribute('aria-label', 'Descendre');
        bas.disabled = index === ordre.length - 1;
        bas.addEventListener('click', () => deplacer(index, 1));

        item.append(haut, bas);
      }
      liste.appendChild(item);
    });
  }

  rendreListe();
  return liste;
}
