import { urlAbsolue } from '../../engine/validation.js';

export function render(question, valeur, { onChange, lectureSeule }) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'champ-saisie';
  input.placeholder = 'www.exemple.fr';
  input.value = valeur ?? '';
  input.disabled = Boolean(lectureSeule);
  input.addEventListener('input', () => onChange(input.value));
  // Complète le protocole manquant ("www.site.fr" -> "https://www.site.fr")
  // à la perte du focus, sans gêner la saisie en cours.
  input.addEventListener('blur', () => {
    const normalisee = urlAbsolue(input.value);
    if (normalisee && normalisee !== input.value) {
      input.value = normalisee;
      onChange(normalisee);
    }
  });
  return input;
}
