// Ajout d'un rendez-vous confirmé à l'agenda personnel (Google Calendar ou
// fichier .ics pour Outlook/Apple Calendar) - fonctions pures, sans DOM.
function formaterDateIcs(date) {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

export function genererLienGoogleCalendar({ titre, debut, fin, details = '', lieu = '' }) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: titre,
    dates: `${formaterDateIcs(debut)}/${formaterDateIcs(fin)}`,
    details,
    location: lieu,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function genererIcs({ titre, debut, fin, details = '', lieu = '', uid, maintenant = new Date() }) {
  const lignes = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RD Formation//RD Recueil//FR',
    'BEGIN:VEVENT',
    `UID:${uid || `entretien-${maintenant.getTime()}@rd-recueil`}`,
    `DTSTAMP:${formaterDateIcs(maintenant)}`,
    `DTSTART:${formaterDateIcs(debut)}`,
    `DTEND:${formaterDateIcs(fin)}`,
    `SUMMARY:${titre}`,
    details ? `DESCRIPTION:${details.replace(/\n/g, '\\n')}` : null,
    lieu ? `LOCATION:${lieu}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter((ligne) => ligne !== null);
  return lignes.join('\r\n');
}
