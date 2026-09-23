export function render(question, valeur, { onChange, lectureSeule }) {
  const input = document.createElement('input');
  input.type = 'url';
  input.className = 'champ-saisie';
  input.placeholder = 'https://';
  input.value = valeur ?? '';
  input.disabled = Boolean(lectureSeule);
  input.addEventListener('input', () => onChange(input.value));
  return input;
}
