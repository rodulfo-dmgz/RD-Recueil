// Boutons radio si <= 5 options, sinon liste déroulante - 01_ARCHITECTURE.md section 6.2.
export function render(question, valeur, { onChange, lectureSeule }) {
  const options = question.options || [];

  if (options.length > 5) {
    const select = document.createElement('select');
    select.className = 'champ-saisie';
    select.disabled = Boolean(lectureSeule);

    const vide = document.createElement('option');
    vide.value = '';
    vide.textContent = 'Sélectionner';
    vide.disabled = true;
    vide.hidden = true;
    vide.selected = !valeur;
    select.appendChild(vide);

    for (const option of options) {
      const opt = document.createElement('option');
      opt.value = option.valeur;
      opt.textContent = option.libelle.replace(/\\\*/g, '');
      opt.selected = option.valeur === valeur;
      select.appendChild(opt);
    }
    select.addEventListener('change', () => onChange(select.value || null));
    // Suppr/Retour arrière réinitialise la liste (aucun autre moyen de
    // revenir à "vide" une fois l'option placeholder cachée du menu).
    select.addEventListener('keydown', (evt) => {
      if (evt.key === 'Delete' || evt.key === 'Backspace') {
        evt.preventDefault();
        select.value = '';
        onChange(null);
      }
    });
    return select;
  }

  const conteneur = document.createElement('div');
  conteneur.className = 'champ-radios';
  conteneur.setAttribute('role', 'radiogroup');

  for (const option of options) {
    const label = document.createElement('label');
    label.className = 'champ-radios__option';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = `q-${question.id}`;
    input.value = option.valeur;
    input.checked = option.valeur === valeur;
    input.disabled = Boolean(lectureSeule);
    input.addEventListener('change', () => onChange(option.valeur));
    label.append(input, ' ' + option.libelle.replace(/\\\*/g, ''));
    conteneur.appendChild(label);
  }
  return conteneur;
}
