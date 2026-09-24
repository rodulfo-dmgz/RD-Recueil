// Bouton afficher/masquer un champ mot de passe (icônes Lucide).
export function attacherToggleMotDePasse(bouton, input) {
  bouton.addEventListener('click', () => {
    const visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    bouton.setAttribute('aria-pressed', String(!visible));
    bouton.setAttribute('aria-label', visible ? 'Afficher le mot de passe' : 'Masquer le mot de passe');
    bouton.innerHTML = '';
    const icone = document.createElement('i');
    icone.setAttribute('data-lucide', visible ? 'eye' : 'eye-off');
    bouton.appendChild(icone);
    if (window.lucide) window.lucide.createIcons({ root: bouton });
  });
}
