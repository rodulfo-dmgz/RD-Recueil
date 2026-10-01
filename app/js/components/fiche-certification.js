// Construit la fiche d'une certification (RNCP ou Certif Info) à partir du
// résultat déjà obtenu (vérification live dans le champ code_rncp, ou
// détail mis en cache dans reponses.valeur - 01_ARCHITECTURE.md section 6.2).
// Partagé entre le champ de saisie (fields/code_rncp.js) et les vues en
// lecture seule qui doivent afficher la même fiche de façon permanente
// (lecture-demande.js, recap.js), y compris à l'impression (preuves.js).

function formaterDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('fr-FR');
}

export function construireFicheRncp(resultat) {
  const bloc = document.createElement('div');
  bloc.className = 'fiche-certification';

  if (!resultat.trouve) {
    bloc.textContent = 'Code RNCP inconnu de France Compétences.';
    return bloc;
  }

  const entete = document.createElement('p');
  entete.className = 'fiche-certification__intitule';
  entete.textContent = resultat.intitule || resultat.rncp;
  bloc.appendChild(entete);

  const debut = formaterDate(resultat.periodeValidite?.debut);
  const fin = formaterDate(resultat.periodeValidite?.fin);
  const statut = document.createElement('p');
  statut.className = resultat.actif
    ? 'fiche-certification__badge fiche-certification__badge--actif'
    : 'fiche-certification__badge fiche-certification__badge--expire';
  statut.textContent = resultat.actif
    ? `Certification active${debut ? ` depuis le ${debut}` : ''}.`
    : `Certification expirée${fin ? ` depuis le ${fin}` : ''}.`;
  bloc.appendChild(statut);

  if (resultat.blocsCompetences?.length) {
    const titre = document.createElement('p');
    titre.className = 'fiche-certification__section-titre';
    titre.textContent = 'Blocs de compétences (utile pour la note de cadrage) :';
    bloc.appendChild(titre);
    const liste = document.createElement('ul');
    liste.className = 'fiche-certification__liste';
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
    titre.className = 'fiche-certification__section-titre';
    titre.textContent = 'Domaine :';
    bloc.appendChild(titre);
    const liste = document.createElement('ul');
    liste.className = 'fiche-certification__liste';
    for (const d of domaines) {
      const li = document.createElement('li');
      li.textContent = d.intitule;
      liste.appendChild(li);
    }
    bloc.appendChild(liste);
  }

  if (resultat.conventionCollectives?.length) {
    const titre = document.createElement('p');
    titre.className = 'fiche-certification__section-titre';
    titre.textContent = 'Convention(s) collective(s) associée(s) :';
    bloc.appendChild(titre);
    const liste = document.createElement('ul');
    liste.className = 'fiche-certification__liste';
    for (const c of resultat.conventionCollectives) {
      const li = document.createElement('li');
      li.textContent = `${c.numero} - ${c.intitule}`;
      liste.appendChild(li);
    }
    bloc.appendChild(liste);
  }

  if (resultat.voiesAcces?.length) {
    const titre = document.createElement('p');
    titre.className = 'fiche-certification__section-titre';
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
    lien.className = 'fiche-certification__lien';
    lien.textContent = 'Voir la fiche officielle France Compétences';
    bloc.appendChild(lien);
  }

  return bloc;
}

const LIBELLES_ACCESSIBILITE = {
  formationInitiale: 'Formation initiale',
  apprentissage: 'Apprentissage',
  formationContinue: 'Formation continue',
  contratPro: 'Contrat de professionnalisation',
  vae: 'VAE',
  individuelle: 'Demande individuelle',
};

// Fiche Certif Info (intercariforef.org) - référentiel plus large que le
// seul RNCP.
export function construireFicheCertifInfo(resultat) {
  const bloc = document.createElement('div');
  bloc.className = 'fiche-certification';

  if (!resultat.trouve) {
    bloc.textContent = 'Certification introuvable dans Certif Info.';
    return bloc;
  }

  const entete = document.createElement('p');
  entete.className = 'fiche-certification__intitule';
  entete.textContent = resultat.intitule;
  bloc.appendChild(entete);

  if (resultat.actif) {
    const statut = document.createElement('p');
    statut.className = 'fiche-certification__badge fiche-certification__badge--actif';
    statut.textContent = resultat.actif;
    bloc.appendChild(statut);
  }

  if (resultat.objectif) {
    const titre = document.createElement('p');
    titre.className = 'fiche-certification__section-titre';
    titre.textContent = 'Objectif :';
    bloc.appendChild(titre);
    const texte = document.createElement('p');
    texte.className = 'texte-doux';
    texte.textContent = resultat.objectif;
    bloc.appendChild(texte);
  }

  const codesLies = [
    ...(resultat.rncp || []).map((r) => `RNCP ${r.code}`),
    ...(resultat.rs || []).map((r) => `RS ${r.code}`),
  ];
  if (codesLies.length) {
    const titre = document.createElement('p');
    titre.className = 'fiche-certification__section-titre';
    titre.textContent = 'Codes liés :';
    bloc.appendChild(titre);
    const texte = document.createElement('p');
    texte.className = 'texte-doux';
    texte.textContent = codesLies.join(', ');
    bloc.appendChild(texte);
  }

  // Métiers (ROME) et domaines (NSF) auxquels mène la certification - mêmes
  // référentiels que la fiche RNCP ci-dessus, mais absents jusqu'ici de la
  // fiche Certif Info alors que l'Edge Function les récupère déjà.
  const metiers = [...(resultat.rome || []), ...(resultat.nsf || [])];
  if (metiers.length) {
    const titre = document.createElement('p');
    titre.className = 'fiche-certification__section-titre';
    titre.textContent = 'Métiers (ROME) et domaines :';
    bloc.appendChild(titre);
    const liste = document.createElement('ul');
    liste.className = 'fiche-certification__liste';
    for (const m of metiers) {
      const li = document.createElement('li');
      li.textContent = m.libelle;
      liste.appendChild(li);
    }
    bloc.appendChild(liste);
  }

  const voiesAcces = Object.entries(resultat.accessibilite || {})
    .filter(([, actif]) => actif)
    .map(([cle]) => LIBELLES_ACCESSIBILITE[cle] || cle);
  if (voiesAcces.length) {
    const titre = document.createElement('p');
    titre.className = 'fiche-certification__section-titre';
    titre.textContent = "Voies d'accès :";
    bloc.appendChild(titre);
    const texte = document.createElement('p');
    texte.className = 'texte-doux';
    texte.textContent = voiesAcces.join(', ');
    bloc.appendChild(texte);
  }

  return bloc;
}
