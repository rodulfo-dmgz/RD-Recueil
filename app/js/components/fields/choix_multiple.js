export function render(question, valeur, { onChange, lectureSeule }) {
  const options = question.options || [];
  const valeurs = new Set(Array.isArray(valeur) ? valeur : []);

  const conteneur = document.createElement('div');
  conteneur.className = 'champ-cases';

  for (const option of options) {
    const label = document.createElement('label');
    label.className = 'champ-cases__option';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = option.valeur;
    input.checked = valeurs.has(option.valeur);
    input.disabled = Boolean(lectureSeule);
    input.addEventListener('change', () => {
      if (input.checked) valeurs.add(option.valeur);
      else valeurs.delete(option.valeur);
      onChange([...valeurs]);
    });
    label.append(input, ' ' + option.libelle.replace(/\\\*/g, ''));
    conteneur.appendChild(label);
  }
  return conteneur;
}
