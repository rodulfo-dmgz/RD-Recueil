// Blocs communs des tableaux de bord (client et consultant) : bandeau
// d'accueil, indicateurs, étapes de suivi - styles dans css/dashboard.css.
import { ETAPES_SUIVI, etapeCourante } from '../engine/suivi.js';

export function el(tag, className, texte) {
  const noeud = document.createElement(tag);
  if (className) noeud.className = className;
  if (texte != null) noeud.textContent = texte;
  return noeud;
}

export function icone(nom) {
  const i = document.createElement('i');
  i.setAttribute('data-lucide', nom);
  i.setAttribute('aria-hidden', 'true');
  return i;
}

export function lienBouton(href, classe, texte, nomIcone) {
  const a = el('a', classe);
  a.href = href;
  if (nomIcone) a.appendChild(icone(nomIcone));
  a.appendChild(el('span', null, texte));
  return a;
}

export function salutation(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

export function prenomDe(profil) {
  const source = profil?.nom || profil?.email?.split('@')[0] || '';
  const premier = source.trim().split(/\s+/)[0] || '';
  return premier ? premier.charAt(0).toUpperCase() + premier.slice(1).toLowerCase() : '';
}

// actions : éléments déjà construits (lienBouton) placés sous le texte.
export function construireHero({ badge, titre, sousTitre, actions }) {
  const hero = el('section', 'db-hero');
  const contenu = el('div', 'db-hero__contenu');

  const eyebrow = el('div', 'db-hero__eyebrow');
  eyebrow.appendChild(
    el('span', 'db-hero__date', new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))
  );
  const pastille = el('span', 'db-hero__badge');
  pastille.append(icone('user-round'), el('span', null, badge));
  eyebrow.appendChild(pastille);
  contenu.appendChild(eyebrow);

  contenu.appendChild(el('h1', 'db-hero__titre', titre));
  contenu.appendChild(el('p', 'db-hero__sous-titre', sousTitre));
  const zoneActions = el('div', 'db-hero__actions');
  zoneActions.append(...actions);
  contenu.appendChild(zoneActions);
  hero.appendChild(contenu);

  const embleme = el('div', 'db-hero__embleme');
  embleme.setAttribute('aria-hidden', 'true');
  embleme.appendChild(icone('shield-check'));
  hero.appendChild(embleme);
  return hero;
}

// kpis : [{ libelle, valeur, nomIcone, accent }]
export function construireKpis(kpis) {
  const barre = el('section', 'db-kpis');
  for (const k of kpis) {
    const carte = el('div', 'db-kpi');
    const tete = el('div', 'db-kpi__tete');
    tete.append(icone(k.nomIcone), el('span', 'db-kpi__libelle', k.libelle));
    carte.append(tete, el('span', k.accent ? 'db-kpi__valeur db-kpi__valeur--accent' : 'db-kpi__valeur', String(k.valeur)));
    barre.appendChild(carte);
  }
  return barre;
}

// Mêmes cinq étapes pour le client et le consultant : chacun voit où en est
// la demande de la même façon.
export function construireEtapes(statut) {
  const courante = etapeCourante(statut);
  const liste = el('ol', 'db-etapes');
  ETAPES_SUIVI.forEach((etape, index) => {
    const etat = index < courante ? 'fait' : index === courante ? 'courant' : 'avenir';
    const li = el('li', `db-etape db-etape--${etat}`);
    if (etat === 'courant') li.setAttribute('aria-current', 'step');
    const puce = el('span', 'db-etape__puce');
    if (etat === 'fait') puce.appendChild(icone('check'));
    else puce.textContent = String(index + 1);
    li.append(puce, el('span', 'db-etape__libelle', etape.libelle));
    liste.appendChild(li);
  });
  return liste;
}
