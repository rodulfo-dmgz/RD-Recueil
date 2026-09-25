import { creerDemande } from '../../services/demandes.js';
import { listerClients } from '../../services/clients.js';
import { afficherToast } from '../../components/toast.js';
import { creerBoutonRetour } from '../../components/bouton-retour.js';
import { navigate } from '../../router.js';
import { getProfil } from '../../store.js';
import { render as rendreChampSiret } from '../../components/fields/siret.js';
import { rechercherEntreprise } from '../../services/entreprises.js';

const TYPES = [
  { valeur: 'FOR', libelle: 'Formation' },
  { valeur: 'PON', libelle: 'Prestation ponctuelle' },
  { valeur: 'MOD', libelle: 'Conception de module' },
  { valeur: 'ING', libelle: 'Ingénierie' },
  { valeur: 'CER', libelle: 'Démarche certifiante' },
];

function champTexte(id, label, { obligatoire = false, type = 'text' } = {}) {
  const wrapper = document.createElement('label');
  wrapper.className = 'champ';
  const span = document.createElement('span');
  span.textContent = label;
  const input = document.createElement('input');
  input.type = type;
  input.id = id;
  input.required = obligatoire;
  wrapper.append(span, input);
  return wrapper;
}

export async function vueCreationDemande() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  const main = document.createElement('main');
  main.className = 'conteneur';

  main.appendChild(creerBoutonRetour('#/tableau-de-bord', 'Retour au tableau de bord'));

  const titre = document.createElement('h1');
  titre.textContent = 'Nouvelle demande';
  main.appendChild(titre);

  const form = document.createElement('form');
  form.className = 'carte';

  const champClientExistant = document.createElement('label');
  champClientExistant.className = 'champ';
  champClientExistant.innerHTML = '<span>Client existant</span>';
  const selectClientExistant = document.createElement('select');
  selectClientExistant.className = 'champ-saisie';
  selectClientExistant.innerHTML = '<option value="">Nouveau client…</option>';
  champClientExistant.appendChild(selectClientExistant);

  const champRaisonSociale = champTexte('raison-sociale', 'Raison sociale', { obligatoire: true });
  const champDateLimite = champTexte('date-limite', 'Date limite (optionnel)', { type: 'date' });

  const champSiret = document.createElement('label');
  champSiret.className = 'champ';
  const spanSiret = document.createElement('span');
  spanSiret.textContent = 'SIRET (optionnel)';
  champSiret.appendChild(spanSiret);
  let valeurSiret = '';
  champSiret.appendChild(
    rendreChampSiret(null, '', {
      onChange: (v) => {
        valeurSiret = v;
      },
      lectureSeule: false,
      onAutoRemplir: async (siret, statut, donneesPreChargees) => {
        const donnees = donneesPreChargees || (await rechercherEntreprise(siret));
        if (!donnees) {
          statut.textContent = 'Aucun établissement trouvé pour ce SIRET.';
          return;
        }
        const inputRaisonSociale = document.getElementById('raison-sociale');
        const rempli = Boolean(donnees.raisonSociale) && !inputRaisonSociale.value.trim();
        if (rempli) inputRaisonSociale.value = donnees.raisonSociale;
        statut.textContent = rempli
          ? `${donnees.raisonSociale} - raison sociale pré-remplie.`
          : `${donnees.raisonSociale || 'Établissement trouvé'}${inputRaisonSociale.value.trim() ? ' (raison sociale déjà renseignée, non modifiée)' : ''}.`;
      },
    })
  );

  const fieldsetTypes = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = 'Types de prestation pressentis';
  fieldsetTypes.appendChild(legend);
  for (const type of TYPES) {
    const label = document.createElement('label');
    label.className = 'champ-cases__option';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = type.valeur;
    input.name = 'types';
    label.append(input, ' ' + type.libelle);
    fieldsetTypes.appendChild(label);
  }

  const bouton = document.createElement('button');
  bouton.type = 'submit';
  bouton.className = 'btn btn--primaire';
  bouton.textContent = 'Créer la demande';

  function basculerChampsClient() {
    const clientExistant = Boolean(selectClientExistant.value);
    champRaisonSociale.hidden = clientExistant;
    champSiret.hidden = clientExistant;
    document.getElementById('raison-sociale').required = !clientExistant;
  }
  selectClientExistant.addEventListener('change', basculerChampsClient);

  form.append(champClientExistant, champRaisonSociale, champSiret, fieldsetTypes, champDateLimite, bouton);
  main.appendChild(form);
  app.appendChild(main);
  if (window.lucide) window.lucide.createIcons();

  form.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    bouton.disabled = true;
    try {
      const types = [...fieldsetTypes.querySelectorAll('input:checked')].map((i) => i.value);
      const demande = await creerDemande({
        clientId: selectClientExistant.value || undefined,
        raisonSociale: document.getElementById('raison-sociale').value,
        siret: valeurSiret,
        types,
        dateLimite: document.getElementById('date-limite').value || null,
        consultantId: getProfil()?.user_id,
      });
      afficherToast('Demande créée.', { type: 'succes' });
      navigate(`/demandes/${demande.reference}`);
    } catch (err) {
      afficherToast(err.message, { type: 'erreur' });
      bouton.disabled = false;
    }
  });

  try {
    const clients = await listerClients();
    selectClientExistant.innerHTML =
      '<option value="">Nouveau client…</option>' +
      clients.map((c) => `<option value="${c.id}">${c.raison_sociale}</option>`).join('');
  } catch (err) {
    afficherToast(err.message, { type: 'erreur' });
  }
}
