export function render(question, valeur, { onChange, lectureSeule }) {
  const input = document.createElement('input');
  input.type = 'date';
  input.className = 'champ-saisie';
  input.value = valeur ?? '';
  input.disabled = Boolean(lectureSeule);
  input.addEventListener('input', () => onChange(input.value || null));
  return input;
}
