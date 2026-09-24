// Rendu "facture" de la proposition commerciale (écran et export PDF via
// window.print(), même mécanisme que la note de cadrage : .imprimable +
// print.css) - repris du gabarit visuel du Simulateur de devis (RD
// Formation), avec les données réelles de la demande.
import { rendreMarkdown } from './markdown.js';

// Identité de l'émetteur : fixe (RD Formation / auto-entreprise), ne varie
// pas d'une proposition à l'autre - pas de champ en base pour ça.
const EMETTEUR = {
  nom: 'Rodulfo DOMINGUEZ JIMENEZ (RD FORMATION)',
  statut: 'Entrepreneur individuel',
  siret: '900 763 913',
  adresse: '33 rue Abel Gance, Bât C1B, App 21, 34070 Montpellier',
};

// RD Formation est en franchise de TVA (micro-entreprise) : jamais de TVA
// sur une proposition, quelle qu'elle soit.
const MENTION_TVA = 'TVA non applicable, art. 293 B du CGI.';
const VALIDITE_JOURS = 30;

function formaterMontant(montant) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(montant || 0);
}

function formaterDate(date) {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function extraireInfoClient(reponses) {
  const parId = new Map((reponses || []).map((r) => [r.question_id, r]));
  const valeur = (id) => parId.get(id)?.valeur;
  const nom = valeur('TC-1.01') || 'Client';
  const siret = valeur('TC-1.03');
  const adresseValeur = valeur('TC-1.06');
  const adresse =
    adresseValeur && typeof adresseValeur === 'object'
      ? Object.values(adresseValeur).filter(Boolean).join(', ')
      : adresseValeur;
  return { nom, siret, adresse };
}

function calculerTotal(lignes) {
  return lignes.reduce((somme, l) => somme + (l.total ?? l.quantite * l.prix_unitaire), 0);
}

export function construireDevisImprimable({ demande, reponses, proposition, lignes }) {
  const client = extraireInfoClient(reponses);
  const total = calculerTotal(lignes);
  const dateEmission = proposition.envoyee_le ? new Date(proposition.envoyee_le) : new Date();
  const dateValidite = new Date(dateEmission.getTime() + VALIDITE_JOURS * 86400000);

  const racine = document.createElement('div');
  racine.className = 'carte imprimable devis-imprimable';

  racine.innerHTML = `
    <div class="devis-imprimable__entete">
      <div class="devis-imprimable__marque">
        <img src="assets/images/logo.svg" alt="" />
        <div>
          <div class="devis-imprimable__nom">${EMETTEUR.nom}</div>
          <div class="devis-imprimable__details">${EMETTEUR.statut}
SIRET : ${EMETTEUR.siret}
${EMETTEUR.adresse}</div>
        </div>
      </div>
      <div class="devis-imprimable__meta">
        <h1>Proposition</h1>
        <div>Réf. ${demande.reference}</div>
        <div>Émise le ${formaterDate(dateEmission)}</div>
        <div>Valable jusqu'au ${formaterDate(dateValidite)}</div>
      </div>
    </div>

    <div class="devis-imprimable__parties">
      <div class="devis-imprimable__partie">
        <h3>Prestataire</h3>
        <div>${EMETTEUR.nom}
${EMETTEUR.statut}
SIRET : ${EMETTEUR.siret}
${EMETTEUR.adresse}</div>
      </div>
      <div class="devis-imprimable__partie devis-imprimable__partie--client">
        <h3>Client</h3>
        <div>${client.nom}${client.siret ? `\nSIRET : ${client.siret}` : ''}${client.adresse ? `\n${client.adresse}` : ''}</div>
      </div>
    </div>

    <table class="devis-imprimable__table">
      <thead><tr><th>Détails</th><th>Qté</th><th>Prix unitaire</th><th>TVA %</th><th>Total HT</th></tr></thead>
      <tbody>
        ${lignes
          .map(
            (l) => `<tr>
              <td>${l.designation}</td>
              <td>${l.quantite}</td>
              <td>${formaterMontant(l.prix_unitaire)}</td>
              <td>0 %</td>
              <td>${formaterMontant(l.total ?? l.quantite * l.prix_unitaire)}</td>
            </tr>`
          )
          .join('')}
      </tbody>
    </table>

    <div class="devis-imprimable__recap">
      <table class="devis-imprimable__recap-table">
        <thead><tr><th>Base HT</th><th>TVA</th><th>Montant TVA</th></tr></thead>
        <tbody><tr><td>${formaterMontant(total)}</td><td>0 %</td><td>${formaterMontant(0)}</td></tr></tbody>
      </table>
      <div class="devis-imprimable__totaux">
        <div class="devis-imprimable__ligne-totaux"><span>Total HT</span><span>${formaterMontant(total)}</span></div>
        <div class="devis-imprimable__ligne-totaux devis-imprimable__ligne-totaux--total"><span>Total net de TVA</span><span>${formaterMontant(total)}</span></div>
      </div>
    </div>

    <p class="devis-imprimable__mention">${MENTION_TVA}</p>

    <div class="devis-imprimable__conditions">
      <h3>Conditions</h3>
      <div>${rendreMarkdown(proposition.justification_md || '')}</div>
    </div>

    <div class="devis-imprimable__signature">
      <div>
        <p>Bon pour accord, date et signature du client :</p>
        <div class="devis-imprimable__case-signature"></div>
      </div>
    </div>

    <p class="devis-imprimable__pied">RD Formation · Document généré le ${formaterDate(new Date())}</p>
  `;

  return racine;
}
