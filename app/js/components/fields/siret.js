export function render(question, valeur, { onChange, lectureSeule }) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'champ-saisie champ-saisie--code';
  input.inputMode = 'numeric';
  input.maxLength = 14;
  input.value = valeur ?? '';
  input.disabled = Boolean(lectureSeule);
  input.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '').slice(0, 14);
    onChange(input.value);
  });
  return input;
}
