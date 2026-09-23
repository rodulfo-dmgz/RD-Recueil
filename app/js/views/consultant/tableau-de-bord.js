import { supabase } from '../../supabase.js';
import { afficherToast } from '../../components/toast.js';

export async function vueTableauDeBord() {
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><h1>Tableau de bord</h1><p id="liste">Chargement…</p></main>';

  const { data, error } = await supabase
    .from('demandes')
    .select('id, reference, statut, created_at')
    .order('created_at', { ascending: false });

  const conteneur = document.getElementById('liste');

  if (error) {
    afficherToast(error.message, { type: 'erreur' });
    conteneur.textContent = 'Impossible de charger les demandes.';
    return;
  }

  if (data.length === 0) {
    conteneur.textContent = 'Aucune demande.';
    return;
  }

  conteneur.outerHTML = `
    <ul id="liste" class="liste-demandes">
      ${data.map((d) => `<li><a href="#/demandes/${d.reference}">${d.reference}</a> — ${d.statut}</li>`).join('')}
    </ul>
  `;
}
