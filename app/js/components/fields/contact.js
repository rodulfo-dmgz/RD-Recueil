export function render(question, valeur, { onChange, lectureSeule }) {
  const v = valeur || {};
  const conteneur = document.createElement('div');
  conteneur.className = 'champ-contact';

  function creerChamp(cle, libelle, type = 'text') {
    const wrapper = document.createElement('label');
    wrapper.className = 'champ-contact__champ';
    const span = document.createElement('span');
    span.textContent = libelle;
    const input = document.createElement('input');
    input.type = type;
    input.value = v[cle] ?? '';
    input.disabled = Boolean(lectureSeule);
    input.addEventListener('input', () => onChange({ ...v, [cle]: input.value }));
    wrapper.append(span, input);
    return wrapper;
  }

  conteneur.append(
    creerChamp('nom', 'Nom'),
    creerChamp('fonction', 'Fonction'),
    creerChamp('email', 'E-mail', 'email'),
    creerChamp('tel', 'Téléphone', 'tel')
  );
  return conteneur;
}
