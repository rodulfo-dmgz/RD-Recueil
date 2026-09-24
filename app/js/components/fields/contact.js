export function render(question, valeur, { onChange, lectureSeule }) {
  // Copie locale mutable : voir le même correctif dans fields/adresse.js -
  // sans ça, chaque sous-champ écrase les autres au lieu de les compléter.
  let v = { ...(valeur || {}) };
  const conteneur = document.createElement('div');
  conteneur.className = 'champ-contact';

  function creerChamp(cle, libelle, type = 'text') {
    const wrapper = document.createElement('label');
    wrapper.className = 'champ-contact__champ';
    const span = document.createElement('span');
    span.textContent = libelle;
    const input = document.createElement('input');
    input.type = type;
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

  conteneur.append(
    creerChamp('nom', 'Nom'),
    creerChamp('fonction', 'Fonction'),
    creerChamp('email', 'E-mail', 'email'),
    creerChamp('tel', 'Téléphone', 'tel')
  );
  return conteneur;
}
