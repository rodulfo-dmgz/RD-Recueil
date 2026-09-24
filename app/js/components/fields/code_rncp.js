import { estCodeRncp, verifierCodeRncp } from '../../services/certifications.js';

function formaterDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('fr-FR');
}

function construireResultat(resultat) {
  const bloc = document.createElement('div');
  bloc.className = 'champ-code-rncp__resultat';

  if (!resultat.trouve) {
    bloc.textContent = 'Code RNCP inconnu de France Compétences.';
    return bloc;
  }

  const entete = document.createElement('p');
  entete.className = 'champ-code-rncp__intitule';
  entete.textContent = resultat.intitule || resultat.rncp;
  bloc.appendChild(entete);

  const debut = formaterDate(resultat.periodeValidite?.debut);
  const fin = formaterDate(resultat.periodeValidite?.fin);
  const statut = document.createElement('p');
  statut.className = resultat.actif ? 'champ-code-rncp__badge champ-code-rncp__badge--actif' : 'champ-code-rncp__badge champ-code-rncp__badge--expire';
  statut.textContent = resultat.actif
    ? `Certification active${debut ? ` depuis le ${debut}` : ''}.`
    : `Certification expirée${fin ? ` depuis le ${fin}` : ''}.`;
  bloc.appendChild(statut);

  if (resultat.blocsCompetences?.length) {
    const titre = document.createElement('p');
    titre.className = 'champ-code-rncp__section-titre';
    titre.textContent = 'Blocs de compétences (utile pour la note de cadrage) :';
    bloc.appendChild(titre);
    const liste = document.createElement('ul');
    liste.className = 'champ-code-rncp__liste';
    for (const b of resultat.blocsCompetences) {
      const li = document.createElement('li');
      li.textContent = b.intitule;
      liste.appendChild(li);
    }
    bloc.appendChild(liste);
  }

  const domaines = [...(resultat.domaines?.rome || []), ...(resultat.domaines?.nsf || [])];
  if (domaines.length) {
    const titre = document.createElement('p');
    titre.className = 'champ-code-rncp__section-titre';
    titre.textContent = 'Domaine :';
    bloc.appendChild(titre);
    const liste = document.createElement('ul');
    liste.className = 'champ-code-rncp__liste';
    for (const d of domaines) {
      const li = document.createElement('li');
      li.textContent = d.intitule;
      liste.appendChild(li);
    }
    bloc.appendChild(liste);
  }

  if (resultat.conventionCollectives?.length) {
    const titre = document.createElement('p');
    titre.className = 'champ-code-rncp__section-titre';
    titre.textContent = 'Convention(s) collective(s) associée(s) :';
    bloc.appendChild(titre);
    const liste = document.createElement('ul');
    liste.className = 'champ-code-rncp__liste';
    for (const c of resultat.conventionCollectives) {
      const li = document.createElement('li');
      li.textContent = `${c.numero} - ${c.intitule}`;
      liste.appendChild(li);
    }
    bloc.appendChild(liste);
  }

  if (resultat.voiesAcces?.length) {
    const titre = document.createElement('p');
    titre.className = 'champ-code-rncp__section-titre';
    titre.textContent = "Voies d'accès :";
    bloc.appendChild(titre);
    const texte = document.createElement('p');
    texte.className = 'texte-doux';
    texte.textContent = resultat.voiesAcces.join(', ');
    bloc.appendChild(texte);
  }

  if (resultat.lienOfficiel) {
    const lien = document.createElement('a');
    lien.href = resultat.lienOfficiel;
    lien.target = '_blank';
    lien.rel = 'noopener noreferrer';
    lien.className = 'champ-code-rncp__lien';
    lien.textContent = 'Voir la fiche officielle France Compétences';
    bloc.appendChild(lien);
  }

  return bloc;
}

// Champ libre (titre, code RNCP ou RS) - seul un code RNCP au format
// "RNCP12345" peut être vérifié auprès de France Compétences (l'API ne
// couvre pas le Répertoire Spécifique). Pour tout autre contenu, le champ se
// comporte comme un texte simple. La vérification n'est jamais persistée :
// elle est donc relancée à chaque affichage du champ (retour sur la section,
// rechargement) pour que le résultat reste visible plutôt que de disparaître
// dès que le composant est reconstruit.
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

  const statut = document.createElement('p');
  statut.className = 'texte-doux champ-code-rncp__statut';
  statut.hidden = true;
  conteneur.appendChild(statut);

  let dernierCodeVerifie = null;

  async function lancerVerification(code) {
    if (!estCodeRncp(code) || code === dernierCodeVerifie) return;
    dernierCodeVerifie = code;
    statut.hidden = false;
    statut.textContent = 'Vérification du code RNCP…';
    try {
      const resultat = await verifierCodeRncp(code);
      statut.hidden = true;
      conteneur.querySelector('.champ-code-rncp__resultat')?.remove();
      conteneur.appendChild(construireResultat(resultat));
    } catch {
      statut.hidden = true;
    }
  }

  if (estCodeRncp(valeur)) {
    lancerVerification(valeur.trim());
  }

  if (lectureSeule) {
    return conteneur;
  }

  input.addEventListener('input', () => {
    onChange(input.value);
    dernierCodeVerifie = null;
    statut.hidden = true;
    conteneur.querySelector('.champ-code-rncp__resultat')?.remove();
  });

  input.addEventListener('blur', () => lancerVerification(input.value.trim()));

  return conteneur;
}
