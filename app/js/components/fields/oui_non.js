export function render(question, valeur, { onChange, lectureSeule }) {
  const conteneur = document.createElement('div');
  conteneur.className = 'champ-oui-non';
  conteneur.setAttribute('role', 'radiogroup');

  for (const [val, texte] of [['oui', 'Oui'], ['non', 'Non']]) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = `q-${question.id}`;
    input.value = val;
    input.checked = valeur === val;
    input.disabled = Boolean(lectureSeule);
    input.addEventListener('change', () => onChange(val));
    label.append(input, ' ' + texte);
    conteneur.appendChild(label);
  }
  return conteneur;
}
