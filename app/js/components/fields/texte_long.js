export function render(question, valeur, { onChange, lectureSeule }) {
  const textarea = document.createElement('textarea');
  textarea.className = 'champ-saisie champ-saisie--zone';
  textarea.maxLength = 5000;
  textarea.rows = 4;
  textarea.value = valeur ?? '';
  textarea.disabled = Boolean(lectureSeule);
  textarea.addEventListener('input', () => onChange(textarea.value));
  return textarea;
}
