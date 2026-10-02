// Téléchargement d'un CSV généré côté navigateur (BOM pour qu'Excel lise l'UTF-8).
export function telechargerCsv(nomFichier, contenu) {
  const blob = new Blob(['﻿' + contenu], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  lien.click();
  URL.revokeObjectURL(url);
}
