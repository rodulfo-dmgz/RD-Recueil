// Création d'un client ou d'un prospect (CRM, lot A). Réservé au staff. On commence par le
// SIRET : la fiche se remplit depuis la base SIRENE. Une case permet d'aller plus loin en une
// fois : inviter le contact (demande + compte de connexion, « Identification de la structure »
// déjà remplie).
import { listerResponsables } from '../../services/clients.js';
import { ouvrirDossierClient } from '../../services/ouverture-dossier.js';
import { navigate } from '../../router.js';
import { getProfil } from '../../store.js';
import { afficherToast } from '../../components/toast.js';
import { construireFormulaireClient } from '../../components/formulaire-client.js';
import { ouvrirModaleCrm } from '../../components/modale-crm.js';
import { champ } from '../../components/champs-crm.js';
import { el, icone } from '../../components/dashboard-ui.js';
import { LIBELLES_TYPE } from '../../engine/statuts.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Bloc « Accès du client » : case à cocher et, si elle l'est, les informations du contact et de la demande.
function construireBlocInvitation({ responsables, estAdmin, profil }) {
  const bloc = el('fieldset', 'cl-form__groupe cl-form__acces');
  bloc.appendChild(el('legend', null, 'Accès du client'));
  const ligneCase = el('label', 'cl-case');
  const caseInviter = el('input');
  caseInviter.type = 'checkbox';
  ligneCase.append(caseInviter, el('span', null, 'Inviter le contact : créer sa demande et son compte de connexion'));
  bloc.appendChild(ligneCase);

  const detail = el('div', 'cl-form__invitation');
  detail.hidden = true;
  const nom = champ('Nom du contact', 'contact_nom', '');
  const email = champ('E-mail du contact', 'contact_email', '', 'email');
  const types = el('fieldset', 'cl-form__types');
  types.appendChild(el('legend', null, 'Types de prestation pressentis'));
  for (const [valeur, libelle] of Object.entries(LIBELLES_TYPE)) {
    const label = el('label', 'cl-case');
    const input = el('input');
    input.type = 'checkbox';
    input.value = valeur;
    label.append(input, el('span', null, libelle));
    types.appendChild(label);
  }
  const erreurTypes = el('span', 'cl-champ__erreur');
  erreurTypes.setAttribute('role', 'alert');
  types.appendChild(erreurTypes);
  const dateLimite = champ('Date limite (facultatif)', 'date_limite', '', 'date');

  const consultant = el('label', 'cl-champ');
  consultant.hidden = !estAdmin;
  consultant.appendChild(el('span', 'cl-champ__libelle', 'Consultant responsable de la demande'));
  const choixConsultant = el('select', 'champ-saisie');
  for (const r of responsables) choixConsultant.appendChild(Object.assign(document.createElement('option'), { value: r.user_id, textContent: r.nom || r.email, selected: r.user_id === profil?.user_id }));
  consultant.appendChild(choixConsultant);

  detail.append(
    nom.wrapper,
    email.wrapper,
    types,
    dateLimite.wrapper,
    consultant,
    el('p', 'texte-doux', 'La demande est créée avec « Identification de la structure » déjà remplie (fiche et base SIRENE) : le contact vérifie et corrige si besoin. Un mot de passe temporaire vous est montré pour le lui transmettre.')
  );
  bloc.appendChild(detail);
  caseInviter.addEventListener('change', () => {
    detail.hidden = !caseInviter.checked;
    if (caseInviter.checked) nom.input.focus();
  });

  // null si la case n'est pas cochée ; sinon l'invitation, ou une erreur lancée avec un message clair.
  function lire() {
    if (!caseInviter.checked) return null;
    nom.erreur.textContent = nom.input.value.trim() ? '' : 'Le nom du contact est obligatoire.';
    email.erreur.textContent = EMAIL.test(email.input.value.trim()) ? '' : 'Saisissez une adresse e-mail valide.';
    const choisis = [...types.querySelectorAll('input:checked')].map((i) => i.value);
    erreurTypes.textContent = choisis.length > 0 ? '' : 'Choisissez au moins un type de prestation.';
    if (nom.erreur.textContent || email.erreur.textContent || erreurTypes.textContent) throw new Error('Complétez les informations du contact pour l’inviter.');
    return { nom: nom.input.value.trim(), email: email.input.value.trim().toLowerCase(), types: choisis, dateLimite: dateLimite.input.value || null, consultantId: (estAdmin && choixConsultant.value) || profil?.user_id };
  }
  return { bloc, lire };
}

// Identifiants à transmettre au contact, montrés avant de quitter la page.
function montrerIdentifiants(compte, auFermer) {
  const mot2passe = el('p', null, 'Mot de passe temporaire : ');
  mot2passe.appendChild(el('code', null, compte.motDePasseTemporaire));
  ouvrirModaleCrm({
    titre: 'Compte client créé',
    noeuds: [
      el('p', null, 'Communiquez ces identifiants au contact par un canal sûr :'),
      el('p', null, `E-mail : ${compte.email}`),
      mot2passe,
      el('p', 'texte-doux', 'Un changement de mot de passe sera exigé à sa première connexion.'),
    ],
    onFermee: auFermer,
  });
}

export async function vueClientNouveau() {
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><p>Chargement…</p></main>';

  let responsables = [];
  try {
    responsables = await listerResponsables();
  } catch (err) {
    afficherToast(err.message, { type: 'erreur' });
  }

  const profil = getProfil();
  const estAdmin = profil?.role === 'admin';
  const invitation = construireBlocInvitation({ responsables, estAdmin, profil });

  const main = el('main', 'db');
  const retour = el('a', 'cl-retour');
  retour.href = '#/clients';
  retour.append(icone('arrow-left'), el('span', null, 'Tous les clients'));
  main.appendChild(retour);
  main.appendChild(el('h1', null, 'Nouveau client ou prospect'));
  main.appendChild(el('p', 'texte-doux', 'Saisissez le SIRET : la fiche se remplit toute seule depuis la base officielle des entreprises (SIRENE).'));

  const carte = el('section', 'db-carte');
  carte.appendChild(
    construireFormulaireClient({
      // Un contact qui n'a pas encore fait de demande est un prospect.
      valeurs: { statut: 'prospect' },
      responsables,
      avecResponsable: estAdmin,
      libelleBouton: 'Créer la fiche',
      blocSupplementaire: invitation.bloc,
      onAnnuler: () => navigate('/clients'),
      onEnregistrer: async (champs) => {
        const aInviter = invitation.lire();
        // Dès qu'une demande est ouverte, le contact n'est plus un simple prospect.
        const fiche = aInviter && champs.statut === 'prospect' ? { ...champs, statut: 'client' } : champs;
        const resultat = await ouvrirDossierClient({ champs: fiche, invitation: aInviter, consultantId: aInviter?.consultantId });
        afficherToast(resultat.demande ? 'Fiche et demande créées.' : 'Fiche créée.', { type: 'succes' });
        for (const message of resultat.avertissements) afficherToast(message, { type: 'erreur', duree: 8000 });
        const destination = resultat.demande ? `/demandes/${resultat.demande.reference}` : `/clients/${resultat.client.id}`;
        if (resultat.compte && !resultat.compte.compteExistant) montrerIdentifiants(resultat.compte, () => navigate(destination));
        else navigate(destination);
      },
    })
  );
  main.appendChild(carte);

  app.innerHTML = '';
  app.appendChild(main);
  if (window.lucide) window.lucide.createIcons();
}
