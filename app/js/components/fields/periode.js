export function render(question, valeur, { onChange, lectureSeule }) {
  const conteneur = document.createElement('div');
  conteneur.className = 'champ-periode';

  const debut = document.createElement('input');
  debut.type = 'date';
  debut.className = 'champ-saisie';
  debut.value = valeur?.debut ?? '';
  debut.disabled = Boolean(lectureSeule);

  const fin = document.createElement('input');
  fin.type = 'date';
  fin.className = 'champ-saisie';
  fin.value = valeur?.fin ?? '';
  fin.disabled = Boolean(lectureSeule);

  function emettre() {
    onChange({ debut: debut.value || null, fin: fin.value || null });
  }
  debut.addEventListener('input', emettre);
  fin.addEventListener('input', emettre);

  const labelDebut = document.createElement('span');
  labelDebut.textContent = 'Du';
  const labelFin = document.createElement('span');
  labelFin.textContent = 'au';

  conteneur.append(labelDebut, debut, labelFin, fin);
  return conteneur;
}
