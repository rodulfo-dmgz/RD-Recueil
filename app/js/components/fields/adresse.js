export function render(question, valeur, { onChange, lectureSeule }) {
  // Copie locale mutable : la section n'étant pas redessinée à chaque
  // frappe (pour ne pas perdre le focus), `valeur` resterait sinon figée à
  // l'état du tout premier rendu, et chaque sous-champ écraserait les
  // autres au lieu de les compléter.
  let v = { ...(valeur || {}) };
  const conteneur = document.createElement('div');
  conteneur.className = 'champ-adresse';

  function creerChamp(cle, libelle, pleineLargeur = false) {
    const wrapper = document.createElement('label');
    wrapper.className = 'champ-adresse__champ' + (pleineLargeur ? ' champ-adresse__champ--pleine' : '');
    const span = document.createElement('span');
    span.textContent = libelle;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'champ-saisie';
    input.value = v[cle] ?? '';
    input.disabled = Boolean(lectureSeule);
    input.addEventListener('input', () => {
      v = { ...v, [cle]: input.value };
      onChange(v);
    });
    wrapper.append(span, input);
    return wrapper;
  }

  conteneur.append(creerChamp('rue', 'Rue', true), creerChamp('cp', 'Code postal'), creerChamp('ville', 'Ville'));
  return conteneur;
}
