import { store } from '../store.js';
import confetti from 'canvas-confetti';

// --- GESTÃO DE DISPOSITIVO E SESSÃO DA MESA (SEM CADASTRO / PRIVADO NO CELULAR) ---
function getOrCreateClientSession(table) {
  const padTable = String(table).padStart(2, '0');

  // 1. Identificador Anônimo do Aparelho (Sem cadastro, isolado no celular do cliente)
  let deviceId = localStorage.getItem('bistro_device_id');
  if (!deviceId) {
    deviceId = 'dev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    localStorage.setItem('bistro_device_id', deviceId);
  }

  // 2. Chave de sessão da mesa atual neste aparelho
  const SESSION_KEY = `bistro_session_table_${padTable}`;
  let session = null;
  try {
    session = JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch (e) {}

  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;

  // Lógica de Expiração Automática (Visita da Manhã vs Tarde, ou > 45 minutos após entrega)
  let shouldExpire = false;
  if (session) {
    const sessionOrders = store.getOrdersForSession(padTable, session.sessionId, deviceId);
    const hasPending = sessionOrders.some(o => o.status !== 'pronto');
    const allDone = sessionOrders.length > 0 && sessionOrders.every(o => o.status === 'pronto');
    const latestOrder = sessionOrders[0];

    // Se todos os pedidos foram entregues e passaram mais de 45 minutos desde a entrega:
    if (allDone && latestOrder?.completedAt && (now - latestOrder.completedAt > 45 * 60 * 1000)) {
      shouldExpire = true;
    }

    // Se passou mais de 2 horas desde a abertura da visita sem nenhum prato em preparo:
    if (!hasPending && (now - session.startedAt > 2 * ONE_HOUR)) {
      shouldExpire = true;
    }
  }

  if (!session || shouldExpire) {
    session = {
      sessionId: 'sess_' + now + '_' + Math.random().toString(36).substring(2, 7),
      table: padTable,
      deviceId,
      startedAt: now
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  return { deviceId, sessionId: session.sessionId, session };
}

export function renderClientView(tableNumber, container) {
  let activeCategory = 'todos';
  let searchQuery = '';
  let selectedDish = null;
  let isCartOpen = false;
  const dismissedOrderIds = new Set();

  function update() {
    container.innerHTML = '';
    container.className = 'app-container mobile-mode';

    const cartItems = store.getTableCart(tableNumber);
    const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const cartTotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Recupera a sessão anônima exclusiva deste celular
    const clientSession = getOrCreateClientSession(tableNumber);
    const { deviceId, sessionId } = clientSession;

    const activeOrder = store.getActiveOrderForSession(tableNumber, sessionId, deviceId);
    const latestOrder = store.getLatestOrderForSession(tableNumber, sessionId, deviceId);
    const tableOrders = store.getOrdersForSession(tableNumber, sessionId, deviceId);
    const tableTotal = store.getSessionTotalBill(tableNumber, sessionId, deviceId);
    const restaurant = store.getRestaurantProfile();

    document.title = `${restaurant.name} | Cardápio Digital`;


    // --- 1. HERO BANNER DINÂMICO ---
    const heroEl = document.createElement('div');
    heroEl.className = 'client-hero';
    if (restaurant.heroBanner) {
      heroEl.style.backgroundImage = `linear-gradient(to bottom, rgba(12, 15, 23, 0.35), var(--bg-main)), url('${restaurant.heroBanner}')`;
      heroEl.style.backgroundPosition = 'center';
      heroEl.style.backgroundSize = 'cover';
      heroEl.style.backgroundRepeat = 'no-repeat';
    }

    heroEl.innerHTML = `
      <div class="client-hero-overlay">
        <div class="client-hero-brand">
          ${restaurant.logo ? `<img src="${restaurant.logo}" alt="Logo" class="client-hero-logo" onerror="this.style.display='none'" />` : ''}
          <div>
            <div class="client-subtitle">${restaurant.tagline || 'Cardápio Digital'}</div>
            <h1 class="client-title">${restaurant.name}</h1>
          </div>
        </div>
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          ${tableOrders.length > 0 ? `
            <button class="comanda-pill" id="btn-open-comanda" title="Ver consumo acumulado da mesa">
              📜 Comanda: R$ ${tableTotal.toFixed(2).replace('.', ',')}
            </button>
          ` : ''}
          <div class="table-pill" title="Mesa definida pelo QR Code">
            🍽️ Mesa ${tableNumber}
          </div>
        </div>
      </div>
    `;
    container.appendChild(heroEl);

    // Handler do botão da comanda no Hero
    const comandaBtn = heroEl.querySelector('#btn-open-comanda');
    if (comandaBtn) {
      comandaBtn.onclick = () => renderComandaModal();
    }

    // --- 2. RASTREADOR DE PEDIDO (EM PREPARO OU RECÉM-CONCLUÍDO) ---
    const orderToDisplay = activeOrder || (
      latestOrder && latestOrder.status === 'pronto' && !dismissedOrderIds.has(latestOrder.id)
        ? latestOrder
        : null
    );

    if (orderToDisplay) {
      const isReady = orderToDisplay.status === 'pronto';
      const trackerEl = document.createElement('div');
      trackerEl.className = `active-order-tracker ${isReady ? 'is-ready' : ''}`;

      let step1Class = 'completed';
      let step2Class = '';

      if (orderToDisplay.status === 'recebido') {
        step1Class = 'active';
      } else if (orderToDisplay.status === 'em_preparo') {
        step1Class = 'completed';
        step2Class = 'active';
      }

      trackerEl.innerHTML = `
        <div class="tracker-header">
          <span class="tracker-id">
            ${isReady ? '🎉 Pedido Pronto!' : `🛎️ Pedido #${orderToDisplay.orderNumber}`}
          </span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 0.82rem; color: ${isReady ? 'var(--accent-green)' : 'var(--primary)'}; font-weight: 800;">
              ${orderToDisplay.status === 'recebido' 
                ? '🟡 Na fila da Cozinha' 
                : (orderToDisplay.status === 'em_preparo' ? '🔵 Em Preparo pelo Chef' : '🟢 Pedido Entregue')}
            </span>
            ${isReady ? `
              <button class="btn-close" id="btn-dismiss-tracker" style="width: 22px; height: 22px; font-size: 0.85rem;" title="Dispensar aviso">&times;</button>
            ` : ''}
          </div>
        </div>

        ${!isReady ? `
          <!-- Barra de Progresso durante a espera -->
          <div class="tracker-steps">
            <div class="step-item ${step1Class}">
              <div class="step-bar"></div>
              <div class="step-label">1. Recebido</div>
            </div>
            <div class="step-item ${step2Class}">
              <div class="step-bar"></div>
              <div class="step-label">2. Preparando</div>
            </div>
            <div class="step-item">
              <div class="step-bar"></div>
              <div class="step-label">3. Pronto</div>
            </div>
          </div>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 8px;">
            Cliente: <strong>${orderToDisplay.customerName}</strong> (${orderToDisplay.items.length} itens)
          </div>
        ` : `
          <!-- Card de Aviso Limpo quando o pedido já está Pronto -->
          <div style="background: rgba(16, 185, 129, 0.12); border-left: 3px solid var(--accent-green); padding: 10px 14px; border-radius: var(--radius-sm); margin-top: 6px; font-size: 0.86rem; line-height: 1.45;">
            <div style="font-weight: 800; color: #34d399; margin-bottom: 3px;">
              🍽️ Servido na Mesa ${tableNumber}! Bom apetite, ${orderToDisplay.customerName}!
            </div>
            <div style="color: var(--text-muted); font-size: 0.78rem;">
              Pratos: ${orderToDisplay.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; flex-wrap: wrap; gap: 6px;">
            <span style="font-size: 0.78rem; color: var(--text-muted);">
              Deseja mais alguma coisa? Continue pedindo normalmente abaixo.
            </span>
            <button id="btn-quick-comanda-view" class="dev-btn" style="padding: 4px 10px; font-size: 0.75rem;">
              📜 Ver Comanda
            </button>
          </div>
        `}
      `;

      if (isReady) {
        const dismissBtn = trackerEl.querySelector('#btn-dismiss-tracker');
        if (dismissBtn) {
          dismissBtn.onclick = () => {
            dismissedOrderIds.add(orderToDisplay.id);
            update();
          };
        }
        const quickComandaBtn = trackerEl.querySelector('#btn-quick-comanda-view');
        if (quickComandaBtn) {
          quickComandaBtn.onclick = () => renderComandaModal();
        }
      }

      container.appendChild(trackerEl);
    }

    // --- 3. BARRA DE CATEGORIAS DINÂMICAS ---
    const dynamicCategories = [
      { id: 'todos', label: 'Todos', icon: '🍽️' },
      ...store.getCategories()
    ];


    const catBar = document.createElement('div');
    catBar.className = 'categories-bar';
    dynamicCategories.forEach(cat => {
      const chip = document.createElement('button');
      chip.className = `category-chip ${activeCategory === cat.id ? 'active' : ''}`;
      chip.innerHTML = `${cat.icon} ${cat.label}`;
      chip.onclick = () => {
        activeCategory = cat.id;
        update();
      };
      catBar.appendChild(chip);
    });
    container.appendChild(catBar);

    // --- 4. LISTA DE PRATOS ---
    const menuList = document.createElement('div');
    menuList.className = 'menu-list';

    const filteredMenu = store.menu
      .filter(item => {
        const matchCat = activeCategory === 'todos' || item.category === activeCategory;
        const matchSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchCat && matchSearch;
      })
      .sort((a, b) => {
        const aAvail = a.available !== false ? 1 : 0;
        const bAvail = b.available !== false ? 1 : 0;
        // Disponíveis primeiro (1), Esgotados por último (0)
        return bAvail - aAvail;
      });

    filteredMenu.forEach(dish => {
      const isAvailable = dish.available !== false;
      const card = document.createElement('div');
      card.className = `dish-card ${!isAvailable ? 'is-unavailable' : ''}`;
      card.innerHTML = `
        <div class="dish-thumb-wrap">
          <img class="dish-img lazy-dish" data-src="${dish.image}" alt="${dish.name}" loading="lazy" />
          ${!isAvailable ? '<div class="dish-badge-esgotado">Esgotado</div>' : ''}
        </div>
        <div class="dish-info">
          <div>
            ${dish.tag ? `<div class="dish-tag">${dish.tag}</div>` : ''}
            <h3 class="dish-name">${dish.name}</h3>
            <p class="dish-desc">${dish.description}</p>
          </div>
          <div class="dish-footer">
            <span class="dish-price">R$ ${dish.price.toFixed(2).replace('.', ',')}</span>
            <button class="btn-add-mini ${!isAvailable ? 'btn-disabled' : ''}" data-id="${dish.id}" ${!isAvailable ? 'disabled' : ''}>
              ${isAvailable ? (dish.hasCustomOptions ? 'Montar' : '+ Adicionar') : '✕ Esgotado'}
            </button>
          </div>
        </div>
      `;

      card.onclick = (e) => {
        if (!isAvailable) return;
        openDishModal(dish);
      };

      menuList.appendChild(card);
    });

    container.appendChild(menuList);

    // --- 5. BARRA FLUTUANTE DE CARRINHO ---
    if (cartCount > 0) {
      const cartBar = document.createElement('div');
      cartBar.className = 'cart-floating-bar';
      cartBar.innerHTML = `
        <div class="cart-bar-info">
          <span class="cart-badge-count">${cartCount}</span>
          <span>R$ ${cartTotal.toFixed(2).replace('.', ',')}</span>
        </div>
        <div class="cart-bar-cta">
          Ver Pedido ➔
        </div>
      `;
      cartBar.onclick = () => {
        isCartOpen = true;
        renderCartModal();
      };
      container.appendChild(cartBar);
    }

    // Inicializa carregamento antecipado com IntersectionObserver (300px margin)
    setupLazyPrefetch(container);
  }

  // --- MODAL DE DETALHES / PERSONALIZAÇÃO DO PRATO (COM OPÇÕES ON/OFF) ---
  function openDishModal(dish) {
    let qty = 1;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay is-centered';

    // Estado local das opções com switch ON/OFF (todas ativas por padrão)
    const hasOptions = Boolean(dish.hasCustomOptions && dish.options && dish.options.length > 0);
    const optionsState = {};
    if (hasOptions) {
      dish.options.forEach(opt => {
        optionsState[opt] = true;
      });
    }

    function getSummaryHTML() {
      if (!hasOptions) return '';
      const selected = dish.options.filter(o => optionsState[o]);
      const unselected = dish.options.filter(o => !optionsState[o]);

      let html = `<div class="custom-summary-box">`;
      if (selected.length > 0) {
        html += `<div style="font-weight: 700; color: #fbbf24;">✓ No seu prato: <span style="font-weight: 400; color: var(--text-main);">${selected.join(', ')}</span></div>`;
      } else {
        html += `<div style="color: #f87171; font-weight: 600;">⚠️ Nenhum acompanhamento selecionado</div>`;
      }
      if (unselected.length > 0) {
        html += `<div style="font-size: 0.74rem; color: #f87171; margin-top: 3px;">✕ Sem: ${unselected.join(', ')}</div>`;
      }
      html += `</div>`;
      return html;
    }

    modal.innerHTML = `
      <div class="modal-dish-card">
        <!-- Topo com Título e Fechar -->
        <div class="modal-dish-header">
          <div>
            <h2 class="modal-title" style="font-size: 1.15rem; margin-bottom: 2px;">${dish.name}</h2>
            ${hasOptions ? `<div style="font-size: 0.75rem; color: var(--primary); font-weight: 700;">🍛 Acompanhamentos Personalizáveis</div>` : ''}
          </div>
          <button class="btn-close" id="modal-close">&times;</button>
        </div>

        <!-- Conteúdo Riscável (Foto, Descrição, Opções e Observações) -->
        <div class="modal-dish-body">
          <img src="${dish.image}" alt="${dish.name}" class="modal-dish-img" onerror="this.src='/images/hero.jpg'" />
          
          <p class="modal-dish-desc">
            ${dish.description}
          </p>

          <div class="modal-dish-price">
            R$ ${dish.price.toFixed(2).replace('.', ',')}
          </div>

          ${hasOptions ? `
            <div class="custom-options-container" style="margin: 4px 0 10px 0;">
              <div class="custom-options-header">
                <span class="custom-options-title">🍛 O que você quer no seu prato?</span>
                <span class="custom-options-hint">Ligue ou desligue</span>
              </div>
              <div class="custom-options-grid">
                ${dish.options.map((opt, i) => `
                  <div class="custom-option-row is-active" id="opt-row-${i}" data-opt="${opt}">
                    <div class="custom-option-info">
                      <span class="custom-option-name">${opt}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                      <span class="custom-option-badge on" id="opt-badge-${i}">✓ Com</span>
                      <div class="custom-checkbox-square checked" id="opt-check-${i}">
                        <span class="check-mark">✓</span>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
              <div id="options-summary-container">
                ${getSummaryHTML()}
              </div>
            </div>
          ` : ''}

          <div style="margin-top: 4px; margin-bottom: 6px;">
            <label style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 4px;">
              Alguma observação para a cozinha?
            </label>
            <textarea id="dish-notes" class="input-field" rows="2" style="margin-top: 0;" placeholder="Ex: Carne ao ponto, sem cebola, gelo e limão..."></textarea>
          </div>
        </div>

        <!-- Barra Inferior Fixa (Quantidade + Adicionar estilo imagem 1 e 3) -->
        <div class="modal-dish-footer-sticky">
          <div class="modal-qty-selector">
            <button id="btn-minus" class="modal-qty-btn" type="button">-</button>
            <span id="qty-label" class="modal-qty-val">1</span>
            <button id="btn-plus" class="modal-qty-btn" type="button">+</button>
          </div>

          <button id="btn-confirm-add" class="modal-btn-add-action" type="button">
            <span>Adicionar</span>
            <span style="font-size: 1rem; font-weight: 800;">
              R$ <span id="total-btn-label">${dish.price.toFixed(2).replace('.', ',')}</span>
            </span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('#modal-close').onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };

    // Handlers interativos de clique nos quadrados checkbox com "V"
    if (hasOptions) {
      const summaryContainer = modal.querySelector('#options-summary-container');
      dish.options.forEach((opt, i) => {
        const row = modal.querySelector(`#opt-row-${i}`);
        const check = modal.querySelector(`#opt-check-${i}`);
        const badge = modal.querySelector(`#opt-badge-${i}`);

        const toggle = (forceVal = null) => {
          optionsState[opt] = forceVal !== null ? forceVal : !optionsState[opt];
          const isChecked = optionsState[opt];
          if (isChecked) {
            row.classList.add('is-active');
            row.classList.remove('is-inactive');
            badge.className = 'custom-option-badge on';
            badge.textContent = '✓ Com';
            check.classList.add('checked');
          } else {
            row.classList.remove('is-active');
            row.classList.add('is-inactive');
            badge.className = 'custom-option-badge off';
            badge.textContent = '✕ Sem';
            check.classList.remove('checked');
          }
          summaryContainer.innerHTML = getSummaryHTML();
        };

        row.onclick = () => toggle();
      });
    }

    const qtyLabel = modal.querySelector('#qty-label');
    const totalBtnLabel = modal.querySelector('#total-btn-label');

    modal.querySelector('#btn-minus').onclick = () => {
      if (qty > 1) {
        qty--;
        qtyLabel.textContent = qty;
        totalBtnLabel.textContent = (dish.price * qty).toFixed(2).replace('.', ',');
      }
    };

    modal.querySelector('#btn-plus').onclick = () => {
      qty++;
      qtyLabel.textContent = qty;
      totalBtnLabel.textContent = (dish.price * qty).toFixed(2).replace('.', ',');
    };

    modal.querySelector('#btn-confirm-add').onclick = () => {
      const notes = modal.querySelector('#dish-notes').value.trim();
      const selectedOptions = hasOptions ? dish.options.filter(o => optionsState[o]) : [];
      const unselectedOptions = hasOptions ? dish.options.filter(o => !optionsState[o]) : [];

      store.addToCart(tableNumber, dish, qty, notes, selectedOptions, unselectedOptions);
      close();
      update();
    };
  }

  // --- MODAL DO CARRINHO / CHECKOUT ---
  function renderCartModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';

    const cartItems = store.getTableCart(tableNumber);
    const cartTotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Recupera dados da sessão do cliente e nome lembrado no cache
    const clientSession = getOrCreateClientSession(tableNumber);
    const sessionOrders = store.getOrdersForSession(tableNumber, clientSession.sessionId, clientSession.deviceId);
    const lastOrderName = sessionOrders.length > 0 ? sessionOrders[0].customerName : '';
    const defaultName = clientSession.session?.customerName || lastOrderName || localStorage.getItem('bistro_client_name') || '';

    modal.innerHTML = `
      <div class="modal-sheet">
        <div class="modal-header">
          <h2 class="modal-title">Sua Comanda (Mesa ${tableNumber})</h2>
          <button class="btn-close" id="cart-close">&times;</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;">
          ${cartItems.map((item, index) => `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 10px; background: rgba(255, 255, 255, 0.04); border-radius: 8px;">
              <div style="flex-grow: 1; padding-right: 10px;">
                <div style="font-weight: 700; font-size: 0.95rem;">${item.name}</div>
                ${item.selectedOptions && item.selectedOptions.length > 0 ? `
                  <div style="font-size: 0.76rem; color: #fbbf24; margin-top: 2px;">
                    ✓ Com: ${item.selectedOptions.join(', ')}
                  </div>
                ` : ''}
                ${item.unselectedOptions && item.unselectedOptions.length > 0 ? `
                  <div style="font-size: 0.72rem; color: #f87171; margin-top: 1px;">
                    ✕ Sem: ${item.unselectedOptions.join(', ')}
                  </div>
                ` : ''}
                ${item.notes ? `<div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 2px;">Obs: ${item.notes}</div>` : ''}
                <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 2px;">
                  R$ ${item.price.toFixed(2).replace('.', ',')} cada
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                <button class="cart-qty-btn" data-index="${index}" data-delta="-1" style="width: 24px; height: 24px; border-radius: 4px; background: rgba(255,255,255,0.1); border:none; color:#fff; cursor:pointer;">-</button>
                <span style="font-weight: 800; font-size: 0.9rem;">${item.quantity}</span>
                <button class="cart-qty-btn" data-index="${index}" data-delta="1" style="width: 24px; height: 24px; border-radius: 4px; background: rgba(255,255,255,0.1); border:none; color:#fff; cursor:pointer;">+</button>
              </div>
            </div>
          `).join('')}
        </div>

        <div style="border-top: 1px dashed var(--border-subtle); padding-top: 14px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 1.15rem;">
            <span>Total:</span>
            <span style="color: var(--primary);">R$ ${cartTotal.toFixed(2).replace('.', ',')}</span>
          </div>
        </div>

        <div style="margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
            <label style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted);">
              Seu Nome (Para a cozinha identificar na Mesa ${tableNumber}) *
            </label>
            ${defaultName ? `
              <span style="font-size: 0.72rem; color: #34d399; font-weight: 700;">
                ✓ Lembrado no aparelho
              </span>
            ` : ''}
          </div>
          <input 
            type="text" 
            id="customer-name-input" 
            class="input-field" 
            value="${defaultName}" 
            placeholder="Ex: Jefferson" 
            autocomplete="name" 
          />
          <div id="name-error" style="color: var(--accent-red); font-size: 0.75rem; margin-top: 4px; display: none;">
            Por favor, informe seu nome para prosseguir.
          </div>
        </div>

        <button id="btn-submit-order" class="btn-primary-action">
          🚀 Enviar Pedido para Cozinha
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('#cart-close').onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };

    modal.querySelectorAll('.cart-qty-btn').forEach(btn => {
      btn.onclick = () => {
        const index = parseInt(btn.dataset.index);
        const delta = parseInt(btn.dataset.delta);
        store.updateCartQuantity(tableNumber, index, delta);
        close();
        if (store.getTableCart(tableNumber).length > 0) {
          renderCartModal();
        }
        update();
      };
    });

    modal.querySelector('#btn-submit-order').onclick = () => {
      const nameInput = modal.querySelector('#customer-name-input');
      const errorDiv = modal.querySelector('#name-error');
      const name = nameInput.value.trim();

      if (!name) {
        errorDiv.style.display = 'block';
        nameInput.focus();
        return;
      }

      // Salva no cache do aparelho e na sessão da mesa para nunca mais precisar redigitar
      try {
        localStorage.setItem('bistro_client_name', name);
        if (clientSession.session) {
          clientSession.session.customerName = name;
          localStorage.setItem(`bistro_session_table_${String(tableNumber).padStart(2, '0')}`, JSON.stringify(clientSession.session));
        }
      } catch (e) {}

      // Envia pedido com isolamento automático por sessão de cliente (sem cadastro)
      const newOrder = store.createOrder({
        table: tableNumber,
        customerName: name,
        items: cartItems,
        total: cartTotal,
        deviceId: clientSession.deviceId,
        sessionId: clientSession.sessionId
      });

      close();
      update();

      // Animação do Cozinheiro confirmando o envio do pedido
      showChefOrderSuccess(newOrder);
    };
  }

  // --- ANIMAÇÃO DO COZINHEIRO (FADE VINDO DE BAIXO E PARANDO NO MEIO: "PEDIDO FEITO!") ---
  function showChefOrderSuccess(order) {
    const overlay = document.createElement('div');
    overlay.className = 'chef-order-overlay';

    overlay.innerHTML = `
      <div class="chef-order-card">
        <img src="/Cozinheiro.png" alt="Cozinheiro" class="chef-order-img" onerror="this.src='/images/Cozinheiro.png'" />
        <h2 class="chef-order-title">Pedido feito!</h2>
        <div class="chef-order-badge">
          🛎️ Pedido #${order.orderNumber} • Mesa ${order.table}
        </div>
        <p class="chef-order-msg">
          O cozinheiro já recebeu seu pedido e iniciou a preparação com todo carinho!
        </p>
        <button class="chef-order-btn" id="btn-chef-dismiss" type="button">
          Acompanhar Preparo ➔
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      overlay.classList.add('fade-out');
      setTimeout(() => {
        overlay.remove();
      }, 360);
    };

    overlay.querySelector('#btn-chef-dismiss').onclick = dismiss;
    overlay.onclick = (e) => {
      if (e.target === overlay) dismiss();
    };

    // Fecha automaticamente após 4 segundos caso o cliente prefira apenas assistir
    setTimeout(() => {
      dismiss();
    }, 4000);
  }

  // --- MODAL DE HISTÓRICO DA COMANDA DA MESA (SESSÃO DO CLIENTE) ---
  function renderComandaModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';

    const { deviceId, sessionId } = getOrCreateClientSession(tableNumber);
    const orders = store.getOrdersForSession(tableNumber, sessionId, deviceId);
    const totalBill = store.getSessionTotalBill(tableNumber, sessionId, deviceId);

    modal.innerHTML = `
      <div class="admin-modal-card" style="max-width: 480px;">
        <div class="modal-header">
          <div>
            <h2 class="modal-title">📜 Comanda da Mesa ${tableNumber}</h2>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
              Histórico de consumo exclusivo desta visita
            </div>
          </div>
          <button class="btn-close" id="modal-comanda-close">&times;</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px; margin: 16px 0; max-height: 380px; overflow-y: auto;">
          ${orders.length === 0 ? `
            <div style="text-align: center; color: var(--text-muted); padding: 30px 0;">
              Nenhum pedido realizado nesta mesa nesta visita.
            </div>
          ` : orders.map(ord => {
            const statusConfig = {
              recebido: { label: '🟡 Recebido', color: 'var(--primary)' },
              em_preparo: { label: '🔵 Em Preparo', color: 'var(--accent-blue)' },
              pronto: { label: '🟢 Entregue na Mesa', color: 'var(--accent-green)' }
            }[ord.status] || { label: ord.status, color: 'var(--text-muted)' };

            return `
              <div style="padding: 12px; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span style="font-weight: 800; font-size: 0.95rem;">Pedido #${ord.orderNumber}</span>
                  <span style="font-size: 0.78rem; font-weight: 700; color: ${statusConfig.color};">
                    ${statusConfig.label}
                  </span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px; font-size: 0.82rem; color: var(--text-muted);">
                  ${ord.items.map(item => `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                      <div>
                        <span style="font-weight: 600;">${item.quantity}x ${item.name}</span>
                        ${item.selectedOptions && item.selectedOptions.length > 0 ? `
                          <div style="font-size: 0.74rem; color: #fbbf24;">✓ Com: ${item.selectedOptions.join(', ')}</div>
                        ` : ''}
                        ${item.unselectedOptions && item.unselectedOptions.length > 0 ? `
                          <div style="font-size: 0.71rem; color: #f87171;">✕ Sem: ${item.unselectedOptions.join(', ')}</div>
                        ` : ''}
                        ${item.notes ? `<div style="font-size: 0.72rem; color: var(--text-dim);">Obs: ${item.notes}</div>` : ''}
                      </div>
                      <span style="font-weight: 700;">R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}</span>
                    </div>
                  `).join('')}
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 0.9rem; margin-top: 8px; padding-top: 6px; border-top: 1px dashed var(--border-subtle);">
                  <span>Subtotal</span>
                  <span style="color: var(--primary);">R$ ${ord.total.toFixed(2).replace('.', ',')}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div style="border-top: 1px solid var(--border-subtle); padding-top: 14px; margin-top: auto;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 16px;">
            <span style="font-size: 1rem; font-weight: 700;">Total da Comanda:</span>
            <span style="font-size: 1.4rem; font-weight: 800; color: var(--primary);">
              R$ ${totalBill.toFixed(2).replace('.', ',')}
            </span>
          </div>

          <div style="display: flex; gap: 8px;">
            <button id="btn-comanda-close-action" class="dev-btn" style="flex: 1; justify-content: center; padding: 12px;">
              Fechar
            </button>
            <button id="btn-comanda-more-food" class="admin-btn-primary" style="flex: 1; justify-content: center; padding: 12px;">
              🍽️ Pedir Mais Itens
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('#modal-comanda-close').onclick = close;
    modal.querySelector('#btn-comanda-close-action').onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };

    modal.querySelector('#btn-comanda-more-food').onclick = () => {
      close();
      window.scrollTo({ top: 250, behavior: 'smooth' });
    };
  }

  // --- ANTECIPAÇÃO INVISÍVEL DE IMAGENS (Intersection Observer com 300px) ---
  function setupLazyPrefetch(root) {
    const images = root.querySelectorAll('.lazy-dish');
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            const src = img.dataset.src;
            if (src) {
              img.src = src;
              img.removeAttribute('data-src');
            }
            obs.unobserve(img);
          }
        });
      }, { rootMargin: '300px 0px' });

      images.forEach(img => observer.observe(img));
    } else {
      images.forEach(img => {
        img.src = img.dataset.src;
      });
    }

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        store.menu.forEach(dish => {
          const preImg = new Image();
          preImg.src = dish.image;
        });
      });
    }
  }

  // Escuta mudanças em tempo real na store
  const unsubscribe = store.subscribe((eventData) => {
    if (eventData?.action === 'STATUS_CHANGED' && eventData?.newStatus === 'pronto') {
      const padTable = String(tableNumber).padStart(2, '0');
      if (eventData.table === padTable) {
        try {
          confetti({
            particleCount: 110,
            spread: 80,
            origin: { y: 0.5 }
          });
        } catch (e) {}
      }
    }
    update();
  });

  update();
  return () => unsubscribe();
}
