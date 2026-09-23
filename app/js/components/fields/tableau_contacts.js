import { render as renderContact } from './contact.js';

export function render(question, valeur, { onChange, lectureSeule }) {
  let contacts = Array.isArray(valeur) ? valeur.map((c) => ({ ...c })) : [];
  const conteneur = document.createElement('div');
  conteneur.className = 'champ-tableau-contacts';

  function rendre() {
    conteneur.innerHTML = '';

    contacts.forEach((contact, index) => {
      const bloc = document.createElement('div');
      bloc.className = 'champ-tableau-contacts__bloc carte';
      const champContact = renderContact(question, contact, {
        lectureSeule,
        onChange: (nouveau) => {
          contacts[index] = nouveau;
          onChange(contacts.map((c) => ({ ...c })));
        },
      });
      bloc.appendChild(champContact);

      if (!lectureSeule) {
        const supprimer = document.createElement('button');
        supprimer.type = 'button';
        supprimer.className = 'btn btn--secondaire';
        supprimer.textContent = 'Retirer ce contact';
        supprimer.addEventListener('click', () => {
          contacts.splice(index, 1);
          onChange(contacts.map((c) => ({ ...c })));
          rendre();
        });
        bloc.appendChild(supprimer);
      }
      conteneur.appendChild(bloc);
    });

    if (!lectureSeule) {
      const ajouter = document.createElement('button');
      ajouter.type = 'button';
      ajouter.className = 'btn btn--secondaire';
      ajouter.textContent = 'Ajouter un contact';
      ajouter.addEventListener('click', () => {
        contacts.push({});
        onChange(contacts.map((c) => ({ ...c })));
        rendre();
      });
      conteneur.appendChild(ajouter);
    }
  }

  rendre();
  return conteneur;
}
