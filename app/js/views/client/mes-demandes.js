import { supabase } from '../../supabase.js';
import { afficherToast } from '../../components/toast.js';

export async function vueMesDemandes() {
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><h1>Mes demandes</h1><p id="liste">Chargement…</p></main>';

  const { data, error } = await supabase
    .from('demandes')
    .select('id, reference, statut, created_at')
    .order('created_at', { ascending: false });

  const conteneur = document.getElementById('liste');

  if (error) {
    afficherToast(error.message, { type: 'erreur' });
    conteneur.textContent = 'Impossible de charger vos demandes.';
    return;
  }

  if (data.length === 0) {
    conteneur.textContent = 'Aucune demande pour le moment.';
    return;
  }

  conteneur.outerHTML = `
    <ul id="liste" class="liste-demandes">
      ${data.map((d) => `<li><a href="#/d/${d.reference}">${d.reference}</a> — ${d.statut}</li>`).join('')}
    </ul>
  `;
}
