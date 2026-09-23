export function render(question, valeur, { onChange, lectureSeule }) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'champ-saisie';
  input.maxLength = 300;
  input.value = valeur ?? '';
  input.disabled = Boolean(lectureSeule);
  input.addEventListener('input', () => onChange(input.value));
  return input;
}
