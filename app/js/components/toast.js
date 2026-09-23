export function afficherToast(message, { type = 'info', duree = 4000 } = {}) {
  const conteneur = document.getElementById('toasts');
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  conteneur.appendChild(toast);
  setTimeout(() => toast.remove(), duree);
}
