// Charte de protection des données personnelles (RGPD) - 01_ARCHITECTURE.md
// section 8.3. Texte statique ; la durée de conservation et l'absence de
// données médicales reprennent exactement les règles de cette section.
import { creerBoutonRetour } from '../../components/bouton-retour.js';

const SECTIONS = [
  {
    titre: 'Qui traite vos données ?',
    paragraphes: [
      'RD Formation, organisme de formation basé à Montpellier, est responsable du traitement des données collectées dans RD Recueil.',
    ],
  },
  {
    titre: 'Quelles données collectons-nous ?',
    liste: [
      'Votre identité professionnelle : nom, adresse e-mail et, si vous les renseignez, téléphone et fonction.',
      'Les informations de votre structure : raison sociale, SIRET, adresse, effectif, secteur d’activité.',
      'Vos réponses au questionnaire de recueil des besoins et les pièces que vous déposez.',
      'Vos échanges avec RD Formation : commentaires, note de cadrage, proposition commerciale et signatures.',
    ],
    paragraphes: [
      'Nous ne collectons aucune donnée médicale. Merci de ne pas en saisir, y compris dans les zones de texte libre, par exemple lorsque vous décrivez des besoins d’adaptation pour des participants.',
    ],
  },
  {
    titre: 'Pourquoi ces données ?',
    liste: [
      'Analyser votre besoin de formation et préparer l’entretien avec votre consultant.',
      'Rédiger, vous soumettre puis conserver la note de cadrage et la proposition commerciale.',
      'Vous permettre de signer en ligne et conserver la preuve de votre accord.',
      'Justifier de notre démarche dans le cadre de la certification Qualiopi.',
    ],
    paragraphes: ['Ces traitements reposent sur l’exécution de mesures précontractuelles prises à votre demande et sur notre intérêt légitime à documenter notre démarche qualité.'],
  },
  {
    titre: 'Qui peut y accéder ?',
    paragraphes: [
      'Seuls vous, les personnes que vous avez invitées sur votre demande et l’équipe RD Formation peuvent consulter vos informations. Vos données ne sont ni vendues ni cédées à des tiers à des fins commerciales.',
      'Elles sont hébergées chez notre prestataire technique Supabase, dans la région Europe (Francfort). Les e-mails de notification transitent par un prestataire d’envoi dédié.',
    ],
  },
  {
    titre: 'Combien de temps les conservons-nous ?',
    paragraphes: [
      'Trois ans après le dernier statut final de votre demande (gagnée, perdue, réorientée ou abandonnée), puis vos données sont anonymisées.',
    ],
  },
  {
    titre: 'Vos droits',
    liste: [
      'Accéder à vos données et en obtenir une copie.',
      'Faire rectifier des informations inexactes.',
      'Demander l’effacement de vos données ou la limitation de leur traitement.',
      'Vous opposer à un traitement pour des motifs légitimes.',
      'Récupérer vos données dans un format réutilisable (portabilité).',
    ],
    paragraphes: [
      'Pour exercer ces droits, contactez RD Formation à contact@rd-formation.com ou au 07 66 62 60 19. Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la CNIL (www.cnil.fr).',
    ],
  },
  {
    titre: 'Comment vos données sont-elles protégées ?',
    liste: [
      'Accès par compte personnel, avec un mot de passe temporaire à changer dès la première connexion.',
      'Cloisonnement strict : chaque client ne voit que ses propres demandes.',
      'Communications chiffrées entre votre navigateur et nos serveurs.',
    ],
    paragraphes: ['Ne communiquez jamais vos identifiants à une autre personne.'],
  },
];

export function vueCharteRgpd() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  const main = document.createElement('main');
  main.className = 'conteneur charte';
  main.appendChild(creerBoutonRetour('#/accueil', 'Retour au tableau de bord'));

  const titre = document.createElement('h1');
  titre.textContent = 'Charte de protection des données';
  main.appendChild(titre);

  const intro = document.createElement('p');
  intro.className = 'texte-doux';
  intro.textContent =
    'RD Formation s’engage à protéger vos données personnelles conformément au Règlement général sur la protection des données (RGPD).';
  main.appendChild(intro);

  for (const section of SECTIONS) {
    const carte = document.createElement('section');
    carte.className = 'carte charte__section';
    const h2 = document.createElement('h2');
    h2.textContent = section.titre;
    carte.appendChild(h2);
    if (section.liste) {
      const ul = document.createElement('ul');
      for (const item of section.liste) {
        const li = document.createElement('li');
        li.textContent = item;
        ul.appendChild(li);
      }
      carte.appendChild(ul);
    }
    for (const texte of section.paragraphes || []) {
      const p = document.createElement('p');
      p.textContent = texte;
      carte.appendChild(p);
    }
    main.appendChild(carte);
  }

  app.appendChild(main);
}
