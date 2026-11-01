import { store } from '../store.js';

export function renderKitchenView(container) {
  let activeFilter = 'pendentes'; // 'todos', 'pendentes', 'em_preparo', 'prontos'
  let timerInterval = null;

  function update() {
    container.innerHTML = '';
    container.className = 'app-container';

    // Contadores
    const allOrders = [...store.orders];
    const pendingOrders = allOrders.filter(o => o.status === 'recebido');
    const preparingOrders = allOrders.filter(o => o.status === 'em_preparo');
    const readyOrders = allOrders.filter(o => o.status === 'pronto');

    let displayedOrders = allOrders;
    if (activeFilter === 'pendentes') {
      displayedOrders = pendingOrders;
    } else if (activeFilter === 'em_preparo') {
      displayedOrders = preparingOrders;
    } else if (activeFilter === 'prontos') {
      displayedOrders = readyOrders;
    }

    // --- HEADER DA COZINHA ---
    const header = document.createElement('div');
    header.className = 'kitchen-header';
    header.innerHTML = `
      <div style="display: flex; align-items: center; gap: 14px;">
        <img src="${store.getRestaurantProfile().logo || '/CozinhaFy.jpg'}" alt="CozinhaFy" style="width: 44px; height: 44px; border-radius: 10px; object-fit: cover; border: 2px solid rgba(255, 255, 255, 0.2); box-shadow: 0 4px 10px rgba(0,0,0,0.3);" onerror="this.src='/CozinhaFy.jpg'" />
        <div>
          <h1 class="kitchen-title">
            🍳 CozinhaFy KDS 
            <span style="font-size: 0.95rem; font-weight: 600; color: var(--text-muted);">
              (Fila em Tempo Real)
            </span>
          </h1>
          <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">
            ${store.getRestaurantProfile().name} • Fila automática por ordem de chegada (FIFO).
          </div>
        </div>
      </div>

      <div class="kitchen-controls">
        <div id="kitchen-clock" style="font-family: var(--font-display); font-size: 1.2rem; font-weight: 800; color: var(--primary); background: rgba(0,0,0,0.4); padding: 6px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
          ${new Date().toLocaleTimeString()}
        </div>
      </div>
    `;
    container.appendChild(header);

    // --- ALERTA DE CONTAS SOLICITADAS ---
    const allBillReqs = store.getAllBillRequests();
    if (allBillReqs.length > 0) {
      const billBanner = document.createElement('div');
      billBanner.className = 'admin-bill-alert-bar';
      billBanner.style.marginBottom = '16px';
      billBanner.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 1.4rem;">🚨</span>
          <div>
            <strong style="color: #fbbf24;">Atenção Cozinha: Contas Solicitadas!</strong>
            <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 2px;">
              ${allBillReqs.map(r => `Mesa ${r.table} (${r.paymentMethodLabel})`).join(' • ')}
            </div>
          </div>
        </div>
      `;
      container.appendChild(billBanner);
    }

    // --- ABAS DE FILTRO ---
    const filterBar = document.createElement('div');
    filterBar.style.cssText = 'display: flex; gap: 10px; margin-bottom: 20px; overflow-x: auto;';

    const filters = [
      { id: 'pendentes', label: `🟡 Pendentes (${pendingOrders.length})` },
      { id: 'em_preparo', label: `🔵 Em Preparo (${preparingOrders.length})` },
      { id: 'prontos', label: `🟢 Prontos (${readyOrders.length})` },
      { id: 'todos', label: `Todos (${allOrders.length})` }
    ];

    filters.forEach(f => {
      const btn = document.createElement('button');
      btn.className = `dev-btn ${activeFilter === f.id ? 'active' : ''}`;
      btn.style.padding = '8px 16px';
      btn.style.fontSize = '0.9rem';
      btn.innerHTML = f.label;
      btn.onclick = () => {
        activeFilter = f.id;
        update();
      };
      filterBar.appendChild(btn);
    });
    container.appendChild(filterBar);

    // --- GRID DE COMANDAS ---
    if (displayedOrders.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.style.cssText = 'text-align: center; padding: 60px 20px; color: var(--text-muted);';
      emptyState.innerHTML = `
        <div style="font-size: 3rem; margin-bottom: 12px;">✅</div>
        <h3 style="font-size: 1.2rem; color: var(--text-main); font-family: var(--font-display);">
          Tudo limpo por aqui!
        </h3>
        <p style="font-size: 0.9rem; margin-top: 6px;">
          Nenhum pedido nesta etapa no momento.
        </p>
      `;
      container.appendChild(emptyState);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'kitchen-grid';

    displayedOrders.forEach(order => {
      const card = document.createElement('div');
      card.className = `kds-card receipt-ticket ${order.status}`;

      // Cálculo de tempo de espera
      const elapsedMinutes = Math.floor((Date.now() - order.createdAt) / (1000 * 60));
      let timerClass = 'timer-green';
      if (elapsedMinutes >= 15) {
        timerClass = 'timer-red';
      } else if (elapsedMinutes >= 8) {
        timerClass = 'timer-yellow';
      }

      card.innerHTML = `
        <div class="kds-receipt-tape"></div>

        <div>
          <div class="kds-receipt-brand">
            <span class="receipt-icon">🧾</span> *** COMANDA DE COZINHA ***
          </div>

          <div class="kds-receipt-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="kds-table-badge">Mesa ${order.table}</span>
              <span class="kds-ord-num">#${order.orderNumber}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="kds-status-tag ${order.status}">
                ${order.status === 'recebido' ? '🟡 Pendente' : (order.status === 'em_preparo' ? '🔵 Em Preparo' : '🟢 Pronto')}
              </span>
              <span class="kds-timer ${timerClass}">
                ⏱️ ${elapsedMinutes} min
              </span>
            </div>
          </div>

          <div class="kds-customer">
            <span>CLIENTE:</span> <strong>${order.customerName.toUpperCase()}</strong>
          </div>

          ${store.getBillRequestForTable(order.table) ? `
            <div style="margin: 6px 0; padding: 6px 10px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: var(--radius-sm); font-size: 0.78rem; font-weight: 800; color: #f87171;">
              🚨 Mesa pediu a conta (${store.getBillRequestForTable(order.table).paymentMethodLabel})
            </div>
          ` : ''}

          ${elapsedMinutes > 180 ? `
            <div style="margin: 6px 0; padding: 6px 10px; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: var(--radius-sm); font-size: 0.75rem; color: #fbbf24; display: flex; justify-content: space-between; align-items: center;">
              <span>⚠️ Pedido antigo (> 3h)</span>
              <button class="btn-kds-dismiss-old" data-id="${order.id}">Descartar</button>
            </div>
          ` : ''}

          <div class="kds-receipt-divider"></div>

          <div class="kds-items-list">
            ${order.items.map(item => {
              const hasOptions = item.selectedOptions && item.selectedOptions.length > 0;
              const hasUnselected = item.unselectedOptions && item.unselectedOptions.length > 0;
              const isComplete = hasOptions && !hasUnselected;

              return `
                <div class="kds-item-row">
                  <span class="kds-item-qty">${item.quantity}x</span>
                  <div style="flex-grow: 1;">
                    <div class="kds-item-header">
                      <span class="kds-item-name">${item.name}</span>
                      ${isComplete ? `
                        <span class="kds-complete-badge">(Completo)</span>
                      ` : ''}
                    </div>

                    ${hasOptions ? `
                      <div class="kds-options-container">
                        <div class="kds-options-vertical-list">
                          ${item.selectedOptions.map(opt => `
                            <div class="kds-opt-row complete">
                              <span class="kds-opt-dot">✓</span>
                              <span class="kds-opt-text">${opt}</span>
                            </div>
                          `).join('')}
                          ${hasUnselected ? item.unselectedOptions.map(opt => `
                            <div class="kds-opt-row unselected">
                              <span class="kds-opt-dot">✕</span>
                              <span class="kds-opt-text">SEM ${opt}</span>
                            </div>
                          `).join('') : ''}
                        </div>
                      </div>
                    ` : ''}

                    ${item.notes ? `<div class="kds-item-note">⚠️ OBS: ${item.notes}</div>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div>
          <div class="kds-receipt-divider" style="margin-top: 14px; margin-bottom: 12px;"></div>

          <div class="kds-actions">
            ${order.status === 'recebido' ? `
              <button class="btn-kds-action btn-kds-start" data-id="${order.id}">
                👨‍🍳 Iniciar Preparo
              </button>
            ` : ''}

            ${order.status === 'em_preparo' ? `
              <button class="btn-kds-action btn-kds-done" data-id="${order.id}">
                🛎️ Concluir & Avisar Mesa
              </button>
            ` : ''}

            ${order.status === 'pronto' ? `
              <div class="kds-done-receipt-badge">
                ✓ Pedido Pronto & Entregue
              </div>
            ` : ''}
          </div>
        </div>
      `;

      // Event handlers dos botões da cozinha
      const startBtn = card.querySelector('.btn-kds-start');
      if (startBtn) {
        startBtn.onclick = () => {
          store.updateOrderStatus(order.id, 'em_preparo');
        };
      }

      const doneBtn = card.querySelector('.btn-kds-done');
      if (doneBtn) {
        doneBtn.onclick = () => {
          store.updateOrderStatus(order.id, 'pronto');
        };
      }

      const dismissOldBtn = card.querySelector('.btn-kds-dismiss-old');
      if (dismissOldBtn) {
        dismissOldBtn.onclick = () => {
          if (confirm(`Descartar este pedido esquecido #${order.orderNumber}?`)) {
            store.deleteOrder(order.id);
          }
        };
      }

      grid.appendChild(card);
    });

    container.appendChild(grid);
  }

  // Atualiza o relógio a cada segundo e os timers dos pratos
  timerInterval = setInterval(() => {
    const clockEl = document.getElementById('kitchen-clock');
    if (clockEl) {
      clockEl.textContent = new Date().toLocaleTimeString();
    }
  }, 1000);

  // Escuta novas comandas em tempo real
  const unsubscribe = store.subscribe(() => {
    update();
  });

  update();

  return () => {
    clearInterval(timerInterval);
    unsubscribe();
  };
}
