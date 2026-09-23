export function render(question, valeur, { onChange, lectureSeule }) {
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'champ-saisie';
  input.min = '0';
  input.step = '1';
  input.value = valeur ?? '';
  input.disabled = Boolean(lectureSeule);
  input.addEventListener('input', () => onChange(input.value === '' ? null : parseInt(input.value, 10)));
  return input;
}
