// Choix d'un créneau d'entretien côté client - réservation réelle sur
// l'agenda du consultant via le widget Cal.com (rdformation/30min).
import { obtenirDemandeParReference } from '../../services/demandes.js';
import { listerCreneaux, confirmerReservationCalcom } from '../../services/creneaux.js';
import { afficherToast } from '../../components/toast.js';
import { creerBoutonRetour } from '../../components/bouton-retour.js';
import { navigate } from '../../router.js';
import { genererLienGoogleCalendar, genererIcs } from '../../engine/calendrier.js';

const LIEN_CALCOM = 'rdformation/30min';
const NAMESPACE_CALCOM = 'entretien-cadrage';

function formaterCreneau(creneau) {
  const options = { dateStyle: 'full', timeStyle: 'short' };
  const debut = new Date(creneau.debut).toLocaleString('fr-FR', options);
  const fin = new Date(creneau.fin).toLocaleTimeString('fr-FR', { timeStyle: 'short' });
  return `${debut} – ${fin}`;
}

function telechargerIcs(contenu, nomFichier) {
  const blob = new Blob([contenu], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  lien.click();
  URL.revokeObjectURL(url);
}

function rendreConfirmation(demande, creneau) {
  const bloc = document.createElement('div');
  bloc.className = 'carte confirmation-creneau';

  const icone = document.createElement('span');
  icone.className = 'confirmation-creneau__icone';
  icone.innerHTML = '<i data-lucide="calendar-check"></i>';
  bloc.appendChild(icone);

  const titre = document.createElement('p');
  titre.className = 'confirmation-creneau__titre';
  titre.textContent = 'Entretien confirmé';
  bloc.appendChild(titre);

  const date = document.createElement('p');
  date.className = 'confirmation-creneau__date';
  date.textContent = formaterCreneau(creneau);
  bloc.appendChild(date);

  const evenement = {
    titre: `Entretien de cadrage - ${demande.reference} (RD Formation)`,
    debut: new Date(creneau.debut),
    fin: new Date(creneau.fin),
    details: `Entretien de cadrage pour la demande ${demande.reference} avec RD Formation.`,
  };

  const actions = document.createElement('div');
  actions.className = 'confirmation-creneau__actions';

  const lienGoogle = document.createElement('a');
  lienGoogle.className = 'btn btn--secondaire';
  lienGoogle.href = genererLienGoogleCalendar(evenement);
  lienGoogle.target = '_blank';
  lienGoogle.rel = 'noopener noreferrer';
  lienGoogle.textContent = 'Ajouter à Google Calendar';

  const boutonIcs = document.createElement('button');
  boutonIcs.type = 'button';
  boutonIcs.className = 'btn btn--secondaire';
  boutonIcs.textContent = 'Télécharger (Outlook, Apple Calendar…)';
  boutonIcs.addEventListener('click', () => {
    telechargerIcs(genererIcs({ ...evenement, uid: `${demande.id}@rd-recueil` }), 'entretien-rd-formation.ics');
  });

  actions.append(lienGoogle, boutonIcs);
  bloc.appendChild(actions);

  return bloc;
}

// Chargeur officiel Cal.com (embed-snippet) - idempotent, sûr à rappeler.
function chargerCalcom() {
  (function (C, A, L) {
    let p = function (a, ar) {
      a.q.push(ar);
    };
    let d = C.document;
    C.Cal =
      C.Cal ||
      function () {
        let cal = C.Cal;
        let ar = arguments;
        if (!cal.loaded) {
          cal.ns = {};
          cal.q = cal.q || [];
          d.head.appendChild(d.createElement('script')).src = A;
          cal.loaded = true;
        }
        if (ar[0] === L) {
          const api = function () {
            p(api, arguments);
          };
          const namespace = ar[1];
          api.q = api.q || [];
          if (typeof namespace === 'string') {
            cal.ns[namespace] = cal.ns[namespace] || api;
            p(cal.ns[namespace], ar);
            p(cal, ['initNamespace', namespace]);
          } else p(cal, ar);
          return;
        }
        p(cal, ar);
      };
  })(window, 'https://app.cal.com/embed/embed.js', 'init');
}

export async function vueCreneauxClient(reference) {
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><p>Chargement…</p></main>';

  try {
    const demande = await obtenirDemandeParReference(reference);
    if (!demande) {
      app.innerHTML = '<main class="conteneur"><h1>Demande introuvable</h1></main>';
      return;
    }
    const creneaux = await listerCreneaux(demande.id);
    rendre(demande, creneaux);
  } catch (err) {
    afficherToast(err.message, { type: 'erreur' });
    app.innerHTML = '<main class="conteneur"><h1>Impossible de charger les créneaux</h1></main>';
  }
}

function rendre(demande, creneaux) {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const main = document.createElement('main');
  main.className = 'conteneur';

  main.appendChild(creerBoutonRetour(`#/d/${demande.reference}`, 'Retour à la demande'));

  const titre = document.createElement('h1');
  titre.textContent = "Rendez-vous d'entretien";
  main.appendChild(titre);

  const confirme = creneaux.find((c) => c.choisi);

  if (confirme) {
    main.appendChild(rendreConfirmation(demande, confirme));
    app.appendChild(main);
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  const p = document.createElement('p');
  p.textContent = 'Choisissez un créneau disponible dans le calendrier ci-dessous.';
  main.appendChild(p);

  const conteneurWidget = document.createElement('div');
  conteneurWidget.id = 'calcom-widget';
  conteneurWidget.className = 'calcom-widget';
  main.appendChild(conteneurWidget);

  app.appendChild(main);
  if (window.lucide) window.lucide.createIcons();

  chargerCalcom();
  window.Cal('init', NAMESPACE_CALCOM, { origin: 'https://cal.com' });
  window.Cal.ns[NAMESPACE_CALCOM]('inline', {
    elementOrSelector: '#calcom-widget',
    calLink: LIEN_CALCOM,
    config: { layout: 'month_view' },
  });

  let dejaTraite = false;
  window.Cal.ns[NAMESPACE_CALCOM]('on', {
    action: 'bookingSuccessfulV2',
    callback: async (evt) => {
      if (dejaTraite) return;
      const { data } = evt.detail;
      if (!data?.startTime || !data?.endTime) return;
      dejaTraite = true;
      try {
        await confirmerReservationCalcom(demande.id, { debut: data.startTime, fin: data.endTime });
        afficherToast('Rendez-vous confirmé. Merci !', { type: 'succes' });
        navigate(`/d/${demande.reference}`);
      } catch (err) {
        afficherToast(err.message, { type: 'erreur' });
        dejaTraite = false;
      }
    },
  });
}
