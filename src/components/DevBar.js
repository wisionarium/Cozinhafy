import { store } from '../store.js';

export function renderDevBar(currentView, currentTable, onViewChange) {
  const container = document.createElement('div');
  container.className = 'dev-bar';

  container.innerHTML = `
    <div class="dev-bar-left">
      ${store.isCloudConfigured() ? `
        <span class="dev-badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);" title="Conectado ao Supabase com replicação em tempo real multi-dispositivo">
          <span class="dev-pulse" style="background: #10b981;"></span>
          Nuvem Online (Supabase)
        </span>
      ` : `
        <span class="dev-badge" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3);" title="Operando localmente no navegador. Pronto para conectar ao Supabase e Vercel!">
          ⚡ Modo Local
        </span>
      `}
      <span style="font-weight: 700; font-size: 0.82rem; color: var(--text-muted); display: inline-flex; align-items: center; gap: 4px;">
        ${store.getRestaurantProfile().name}
      </span>
    </div>

    <div class="dev-buttons">
      <button class="dev-btn ${currentView === 'client' && currentTable === '04' ? 'active' : ''}" data-view="client" data-table="04">
        📱 Mesa 04 (Cliente)
      </button>
      <button class="dev-btn ${currentView === 'client' && currentTable === '02' ? 'active' : ''}" data-view="client" data-table="02">
        📱 Mesa 02 (Cliente)
      </button>
      <button class="dev-btn ${currentView === 'kitchen' ? 'active' : ''}" data-view="kitchen">
        🍳 Cozinha (KDS)
      </button>
      <button class="dev-btn ${currentView === 'admin' ? 'active' : ''}" data-view="admin">
        📊 Admin ${store.getAllBillRequests().length > 0 ? `(${store.getAllBillRequests().length} 🚨)` : ''}
      </button>
    </div>

    <button id="dev-sound-toggle" class="dev-btn" title="Alternar som de pedidos">
      ${store.soundEnabled ? '🔔 Som Ativo' : '🔕 Mudo'}
    </button>
  `;

  // Event listeners
  container.querySelectorAll('.dev-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      const table = btn.dataset.table || '04';
      onViewChange(view, table);
    });
  });

  const soundBtn = container.querySelector('#dev-sound-toggle');
  soundBtn.addEventListener('click', () => {
    store.soundEnabled = !store.soundEnabled;
    soundBtn.innerHTML = store.soundEnabled ? '🔔 Som Ativo' : '🔕 Mudo';
    if (store.soundEnabled) {
      store.playKitchenBell();
    }
  });

  return container;
}
