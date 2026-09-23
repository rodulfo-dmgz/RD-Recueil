// État global minimal. L'état de la demande en cours de saisie sera ajouté au Lot 2.

let profil = null;
const abonnes = new Set();

export function getProfil() {
  return profil;
}

export function setProfil(nouveauProfil) {
  profil = nouveauProfil;
  abonnes.forEach((fn) => fn(profil));
}

export function surProfil(fn) {
  abonnes.add(fn);
  return () => abonnes.delete(fn);
}
