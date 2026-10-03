// Mise en forme des dates pour l'écran (fonctions pures). Une seule définition
// pour tout le CRM : avant, chaque écran avait sa copie.

const FORMAT_CLE = /^\d{4}-\d{2}-\d{2}$/;

// "2026-10-01" -> "01/10/2026" (la date reste celle du jour saisi, sans fuseau).
// Vide si la valeur n'est pas une date "aaaa-mm-jj".
export function formaterDateCourte(cle) {
  if (!cle || !FORMAT_CLE.test(cle)) return '';
  const [annee, mois, jour] = cle.split('-');
  return `${jour}/${mois}/${annee}`;
}

// Date ou horodatage -> "3 oct. 2026" (avec l'heure si demandé) ; "-" si vide.
export function formaterDate(date, { heure = false } = {}) {
  if (!date) return '-';
  const options = { day: 'numeric', month: 'short', year: 'numeric' };
  if (heure) Object.assign(options, { hour: '2-digit', minute: '2-digit' });
  return new Date(date).toLocaleString('fr-FR', options);
}
