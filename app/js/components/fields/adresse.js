export function render(question, valeur, { onChange, lectureSeule }) {
  const v = valeur || {};
  const conteneur = document.createElement('div');
  conteneur.className = 'champ-adresse';

  function creerChamp(cle, libelle) {
    const wrapper = document.createElement('label');
    wrapper.className = 'champ-adresse__champ';
    const span = document.createElement('span');
    span.textContent = libelle;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = v[cle] ?? '';
    input.disabled = Boolean(lectureSeule);
    input.addEventListener('input', () => onChange({ ...v, [cle]: input.value }));
    wrapper.append(span, input);
    return wrapper;
  }

  conteneur.append(creerChamp('rue', 'Rue'), creerChamp('cp', 'Code postal'), creerChamp('ville', 'Ville'));
  return conteneur;
}
