import { estCodeRncp, verifierCodeRncp } from '../../services/certifications.js';

// Champ libre (titre, code RNCP ou RS) - seul un code RNCP au format
// "RNCP12345" peut être vérifié auprès de France Compétences (l'API ne
// couvre pas le Répertoire Spécifique). Pour tout autre contenu, le champ se
// comporte comme un texte simple.
export function render(question, valeur, { onChange, lectureSeule }) {
  const conteneur = document.createElement('div');
  conteneur.className = 'champ-code-rncp';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'champ-saisie';
  input.placeholder = 'Ex. RNCP12345';
  input.value = valeur ?? '';
  input.disabled = Boolean(lectureSeule);
  conteneur.appendChild(input);

  if (lectureSeule) {
    return conteneur;
  }

  const statut = document.createElement('p');
  statut.className = 'texte-doux champ-code-rncp__statut';
  statut.hidden = true;
  conteneur.appendChild(statut);

  let dernierCodeVerifie = null;

  input.addEventListener('input', () => {
    onChange(input.value);
    statut.hidden = true;
  });

  input.addEventListener('blur', async () => {
    const code = input.value.trim();
    if (!estCodeRncp(code) || code === dernierCodeVerifie) return;
    dernierCodeVerifie = code;
    statut.hidden = false;
    statut.textContent = 'Vérification du code RNCP…';
    try {
      const resultat = await verifierCodeRncp(code);
      if (!resultat.trouve) {
        statut.textContent = 'Code RNCP inconnu de France Compétences.';
        return;
      }
      statut.textContent = resultat.actif
        ? `Certification vérifiée : ${resultat.intitule || resultat.rncp}.`
        : `Certification vérifiée (référence expirée) : ${resultat.intitule || resultat.rncp}.`;
    } catch {
      statut.hidden = true;
    }
  });

  return conteneur;
}
