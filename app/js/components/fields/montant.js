export function render(question, valeur, { onChange, lectureSeule }) {
  const conteneur = document.createElement('div');
  conteneur.className = 'champ-montant';

  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'champ-saisie';
  input.min = '0';
  input.step = '0.01';
  input.value = valeur ?? '';
  input.disabled = Boolean(lectureSeule);
  input.addEventListener('input', () => onChange(input.value === '' ? null : parseFloat(input.value)));

  const suffixe = document.createElement('span');
  suffixe.className = 'champ-montant__suffixe';
  suffixe.textContent = '€ HT';

  conteneur.append(input, suffixe);
  return conteneur;
}
