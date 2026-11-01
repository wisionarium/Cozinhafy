import { store } from '../store.js';
import QRCode from 'qrcode';

export function renderAdminView(container, onNavigateTable) {
  let activeTab = 'tables'; // 'tables', 'products', 'profile', 'metrics'
  let selectedTable = '04';
  let searchQuery = '';
  let selectedCategory = 'todos';
  let statusFilter = 'all'; // 'all', 'available', 'unavailable'

  function showToast(message, icon = '✅') {
    const existing = document.querySelector('.admin-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'admin-toast';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  // Gerenciador de Bloqueio de Scroll ao abrir modais no Admin
  function attachModal(modalEl) {
    document.body.appendChild(modalEl);
    document.body.classList.add('modal-open');

    modalEl.addEventListener('wheel', (e) => {
      if (e.target === modalEl) e.preventDefault();
    }, { passive: false });

    modalEl.addEventListener('touchmove', (e) => {
      if (e.target === modalEl) e.preventDefault();
    }, { passive: false });

    return () => {
      modalEl.remove();
      if (!document.querySelector('.modal-overlay')) {
        document.body.classList.remove('modal-open');
      }
    };
  }

  // ==========================================================
  // MODAIS DE GESTÃO DE CATEGORIAS
  // ==========================================================

  // Modal para Criar ou Editar uma Categoria
  function openCategoryEditModal(catToEdit = null, onCreatedCallback = null) {
    const isEdit = Boolean(catToEdit);
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';

    let currentIcon = catToEdit?.icon || '🍽️';

    const popularEmojis = [
      '☕', '🥐', '🥪', '🍕', '🥗', '🍰', '🍔', '🍟',
      '🥩', '🥖', '🍹', '🍨', '🍺', '🍳', '🥞', '🥟',
      '🍩', '🍫', '🥤', '🌮', '🍣', '🍦', '🧇', '🍲'
    ];

    modal.innerHTML = `
      <div class="admin-modal-card" style="max-width: 480px;">
        <div class="modal-header">
          <h2 class="modal-title">
            ${isEdit ? '✏️ Editar Categoria' : '🏷️ Nova Categoria'}
          </h2>
          <button class="btn-close" id="modal-cat-close">&times;</button>
        </div>

        <form id="cat-form" style="display: flex; flex-direction: column; gap: 14px; margin-top: 8px;">
          <div class="form-field">
            <label class="form-label" for="cat-name">Nome da Categoria *</label>
            <input 
              type="text" 
              id="cat-name" 
              class="input-field" 
              style="margin-top: 0;"
              placeholder="Ex: Café da Manhã, Salgados, Pizzas..." 
              value="${catToEdit ? catToEdit.label : ''}" 
              required 
            />
          </div>

          <div class="form-field">
            <label class="form-label">
              <span>Ícone / Emoji Representativo</span>
              <span id="selected-icon-preview" style="font-size: 1.2rem;">${currentIcon}</span>
            </label>
            <div style="display: flex; gap: 8px; align-items: center;">
              <input 
                type="text" 
                id="cat-custom-icon" 
                class="input-field" 
                style="margin-top: 0; width: 80px; text-align: center; font-size: 1.2rem;" 
                value="${currentIcon}" 
                maxlength="4"
              />
              <span style="font-size: 0.8rem; color: var(--text-muted);">
                Escolha um emoji abaixo ou digite outro
              </span>
            </div>

            <div class="cat-emoji-grid">
              ${popularEmojis.map(emoji => `
                <button type="button" class="cat-emoji-btn ${currentIcon === emoji ? 'selected' : ''}" data-emoji="${emoji}">
                  ${emoji}
                </button>
              `).join('')}
            </div>
          </div>

          <div id="cat-error-msg" style="color: var(--accent-red); font-size: 0.82rem; font-weight: 700; display: none;"></div>

          <div style="display: flex; gap: 10px; margin-top: 8px;">
            <button type="button" id="modal-cat-cancel" class="dev-btn" style="flex: 1; justify-content: center; padding: 12px;">
              Cancelar
            </button>
            <button type="submit" class="admin-btn-primary" style="flex: 1; justify-content: center; padding: 12px;">
              ${isEdit ? '💾 Salvar Categoria' : '✨ Criar Categoria'}
            </button>
          </div>
        </form>
      </div>
    `;

    const closeModal = attachModal(modal);
    modal.querySelector('#modal-cat-close').onclick = closeModal;
    modal.querySelector('#modal-cat-cancel').onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };

    const iconInput = modal.querySelector('#cat-custom-icon');
    const iconPreview = modal.querySelector('#selected-icon-preview');

    modal.querySelectorAll('.cat-emoji-btn').forEach(btn => {
      btn.onclick = () => {
        modal.querySelectorAll('.cat-emoji-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        currentIcon = btn.dataset.emoji;
        iconInput.value = currentIcon;
        iconPreview.textContent = currentIcon;
      };
    });

    iconInput.oninput = (e) => {
      currentIcon = e.target.value || '🍽️';
      iconPreview.textContent = currentIcon;
    };

    const form = modal.querySelector('#cat-form');
    form.onsubmit = (e) => {
      e.preventDefault();
      const label = modal.querySelector('#cat-name').value.trim();
      const icon = iconInput.value.trim() || '🍽️';
      const errorMsg = modal.querySelector('#cat-error-msg');

      if (!label) {
        errorMsg.textContent = 'Por favor, informe o nome da categoria.';
        errorMsg.style.display = 'block';
        return;
      }

      if (isEdit) {
        store.updateCategory(catToEdit.id, { label, icon });
        showToast(`Categoria "${label}" atualizada!`, '🏷️');
        closeModal();
        update();
      } else {
        const created = store.addCategory({ label, icon });
        showToast(`Categoria "${label}" criada com sucesso!`, '✨');
        closeModal();
        if (onCreatedCallback && created) {
          onCreatedCallback(created);
        }
        update();
      }
    };
  }

  // Modal para Excluir Categoria (com salvaguarda de pratos vinculados)
  function openCategoryDeleteModal(cat) {
    const dishCount = store.getDishesCountForCategory(cat.id);
    const otherCategories = store.getCategories().filter(c => c.id !== cat.id);

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';

    modal.innerHTML = `
      <div class="admin-modal-card" style="max-width: 480px;">
        <div class="modal-header">
          <h2 class="modal-title" style="color: var(--accent-red);">
            🗑️ Excluir Categoria "${cat.icon} ${cat.label}"
          </h2>
          <button class="btn-close" id="modal-del-cat-close">&times;</button>
        </div>

        ${dishCount > 0 ? `
          <div style="background: rgba(245, 158, 11, 0.1); border-left: 3px solid var(--primary); padding: 12px; border-radius: var(--radius-sm); margin: 14px 0;">
            <div style="font-weight: 700; color: #fbbf24; font-size: 0.9rem; margin-bottom: 4px;">
              ⚠️ Categoria em uso!
            </div>
            <div style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4;">
              Existem <strong>${dishCount} prato(s)</strong> vinculados a esta categoria. Escolha para onde deseja transferi-los antes de excluir:
            </div>
          </div>

          <div class="form-field" style="margin-bottom: 20px;">
            <label class="form-label" for="reassign-cat-select">Transferir pratos para:</label>
            <select id="reassign-cat-select" class="input-field" style="margin-top: 0;">
              ${otherCategories.map(c => `
                <option value="${c.id}">${c.icon} ${c.label}</option>
              `).join('')}
            </select>
          </div>
        ` : `
          <p style="font-size: 0.95rem; margin: 14px 0 20px; line-height: 1.5;">
            Tem certeza que deseja excluir a categoria <strong>"${cat.icon} ${cat.label}"</strong>? 
            Esta ação removerá a categoria do painel e do cardápio dos clientes.
          </p>
        `}

        <div style="display: flex; gap: 10px;">
          <button id="btn-cancel-del-cat" class="dev-btn" style="flex: 1; justify-content: center; padding: 12px;">
            Cancelar
          </button>
          <button id="btn-confirm-del-cat" class="admin-btn-action btn-delete" style="flex: 1; justify-content: center; padding: 12px; font-size: 0.9rem;">
            ${dishCount > 0 ? 'Transferir e Excluir' : 'Sim, Excluir'}
          </button>
        </div>
      </div>
    `;

    const closeModal = attachModal(modal);
    modal.querySelector('#modal-del-cat-close').onclick = closeModal;
    modal.querySelector('#btn-cancel-del-cat').onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };

    modal.querySelector('#btn-confirm-del-cat').onclick = () => {
      let reassignId = null;
      if (dishCount > 0) {
        const select = modal.querySelector('#reassign-cat-select');
        reassignId = select ? select.value : null;
      }

      store.deleteCategory(cat.id, reassignId);
      showToast(`Categoria "${cat.label}" excluída!`, '🗑️');
      closeModal();
      update();
    };
  }

  // Modal com Listagem e Gestão Geral de Categorias
  function openCategoryManagerModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';

    function renderContent() {
      const categories = store.getCategories();

      modal.innerHTML = `
        <div class="admin-modal-card" style="max-width: 580px;">
          <div class="modal-header">
            <div>
              <h2 class="modal-title">🏷️ Gerenciador de Categorias</h2>
              <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
                Crie e personalize as seções do cardápio de acordo com o seu estabelecimento.
              </p>
            </div>
            <button class="btn-close" id="modal-manage-cat-close">&times;</button>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px;">
            <span style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted);">
              Categorias Ativas (${categories.length})
            </span>
            <div style="display: flex; gap: 8px;">
              <button id="btn-create-new-cat" class="admin-btn-primary" style="padding: 6px 14px; font-size: 0.82rem;">
                ✨ + Nova Categoria
              </button>
              <button id="btn-reset-cats" class="admin-btn-secondary" style="padding: 6px 10px; font-size: 0.78rem;" title="Restaura categorias padrão">
                ↺ Padrão
              </button>
            </div>
          </div>

          <div class="cat-manager-list">
            ${categories.length === 0 ? `
              <div style="text-align: center; color: var(--text-muted); padding: 30px 0; font-size: 0.9rem;">
                Nenhuma categoria cadastrada. Clique acima para criar a primeira!
              </div>
            ` : categories.map(cat => {
              const count = store.getDishesCountForCategory(cat.id);
              return `
                <div class="cat-manager-item">
                  <div class="cat-item-left">
                    <span class="cat-item-icon">${cat.icon}</span>
                    <div class="cat-item-info">
                      <span class="cat-item-name">${cat.label}</span>
                      <span class="cat-item-count">${count} ${count === 1 ? 'prato vinculado' : 'pratos vinculados'}</span>
                    </div>
                  </div>
                  <div class="cat-item-actions">
                    <button class="admin-btn-action btn-edit cat-edit-btn" data-id="${cat.id}" style="padding: 6px 10px; font-size: 0.75rem;">
                      ✏️ Editar
                    </button>
                    <button class="admin-btn-action btn-delete cat-del-btn" data-id="${cat.id}" style="padding: 6px 10px; font-size: 0.75rem;">
                      🗑️
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <div style="display: flex; justify-content: flex-end; margin-top: 10px; padding-top: 12px; border-top: 1px solid var(--border-subtle);">
            <button id="btn-close-cat-manager" class="dev-btn" style="padding: 8px 18px;">
              Concluir
            </button>
          </div>
        </div>
      `;

      modal.querySelector('#modal-manage-cat-close').onclick = () => modal.remove();
      modal.querySelector('#btn-close-cat-manager').onclick = () => modal.remove();

      modal.querySelector('#btn-create-new-cat').onclick = () => {
        openCategoryEditModal(null, () => renderContent());
      };

      modal.querySelector('#btn-reset-cats').onclick = () => {
        if (confirm('Deseja restaurar as 4 categorias padrão originais?')) {
          store.resetCategoriesToDefault();
          showToast('Categorias restauradas ao padrão original!', '↺');
          renderContent();
          update();
        }
      };

      modal.querySelectorAll('.cat-edit-btn').forEach(btn => {
        btn.onclick = () => {
          const cat = categories.find(c => c.id === btn.dataset.id);
          if (cat) openCategoryEditModal(cat, () => renderContent());
        };
      });

      modal.querySelectorAll('.cat-del-btn').forEach(btn => {
        btn.onclick = () => {
          const cat = categories.find(c => c.id === btn.dataset.id);
          if (cat) openCategoryDeleteModal(cat);
        };
      });
    }

    renderContent();
    const closeModal = attachModal(modal);
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };
  }

  // ==========================================================
  // MODAL DE CADASTRO / EDIÇÃO DE PRATO
  // ==========================================================

  function openProductModal(dishToEdit = null) {
    const isEdit = Boolean(dishToEdit);
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';

    let currentImg = dishToEdit?.image || '/images/hero.jpg';

    const presetImages = [
      { url: '/images/hero.jpg', label: 'Carnes' },
      { url: '/images/burger.jpg', label: 'Burgers' },
      { url: '/images/pasta.jpg', label: 'Massas' },
      { url: '/images/bruschetta.jpg', label: 'Entradas' },
      { url: '/images/dessert.jpg', label: 'Sobremesas' },
      { url: '/images/drink.jpg', label: 'Bebidas' }
    ];

    function renderCategoryOptions(selectedId) {
      const cats = store.getCategories();
      return cats.map(c => `
        <option value="${c.id}" ${selectedId === c.id ? 'selected' : ''}>
          ${c.icon} ${c.label}
        </option>
      `).join('');
    }

    const initialCategory = dishToEdit ? dishToEdit.category : (store.getCategories()[0]?.id || 'principais');
    let currentOptions = dishToEdit?.options ? [...dishToEdit.options] : ['Arroz Branco', 'Feijão Carioca', 'Macarrão ao Alho e Óleo', 'Farofa Crocante', 'Salada Fresca'];
    let hasCustomOptions = Boolean(dishToEdit?.hasCustomOptions);

    modal.innerHTML = `
      <div class="admin-modal-card">
        <div class="modal-header">
          <h2 class="modal-title">
            ${isEdit ? '✏️ Editar Prato' : '✨ Cadastrar Novo Prato'}
          </h2>
          <button class="btn-close" id="modal-close-btn">&times;</button>
        </div>

        <form id="product-form" style="display: flex; flex-direction: column; gap: 4px;">
          <!-- Nome e Categoria -->
          <div class="form-group-grid">
            <div class="form-field">
              <label class="form-label" for="prod-name">Nome do Prato *</label>
              <input 
                type="text" 
                id="prod-name" 
                class="input-field" 
                style="margin-top: 0;"
                placeholder="Ex: Risoto de Funghi Secchi" 
                value="${dishToEdit ? dishToEdit.name : ''}" 
                required 
              />
            </div>

            <div class="form-field">
              <div class="form-label">
                <span>Categoria *</span>
                <button type="button" id="btn-quick-create-cat" class="btn-cat-create-quick" title="Criar uma categoria agora">
                  + Nova Categoria
                </button>
              </div>
              <select id="prod-category" class="input-field" style="margin-top: 0;">
                ${renderCategoryOptions(initialCategory)}
              </select>
            </div>
          </div>

          <!-- Preço e Tempo de Preparo -->
          <div class="form-group-grid">
            <div class="form-field">
              <label class="form-label" for="prod-price">Preço de Venda (R$) *</label>
              <input 
                type="number" 
                id="prod-price" 
                class="input-field" 
                style="margin-top: 0;"
                step="0.01" 
                min="0.50" 
                placeholder="Ex: 58.90" 
                value="${dishToEdit ? dishToEdit.price : ''}" 
                required 
              />
            </div>

            <div class="form-field">
              <label class="form-label" for="prod-preptime">Tempo Estimado</label>
              <input 
                type="text" 
                id="prod-preptime" 
                class="input-field" 
                style="margin-top: 0;"
                placeholder="Ex: 15-20 min" 
                value="${dishToEdit ? dishToEdit.prepTime : '15-20 min'}" 
              />
            </div>
          </div>

          <!-- Tag de Destaque -->
          <div class="form-field">
            <label class="form-label" for="prod-tag">
              <span>Selo / Destaque Promocional</span>
              <span style="font-weight: 400; font-size: 0.72rem; color: var(--text-dim);">Opcional</span>
            </label>
            <input 
              type="text" 
              id="prod-tag" 
              class="input-field" 
              style="margin-top: 0;"
              placeholder="Ex: Mais Pedido ⭐" 
              value="${dishToEdit?.tag || ''}" 
            />
            <div class="tag-suggestions">
              <button type="button" class="tag-pill-btn" data-tag="Mais Pedido ⭐">Mais Pedido ⭐</button>
              <button type="button" class="tag-pill-btn" data-tag="Chef Choice 👨‍🍳">Chef Choice 👨‍🍳</button>
              <button type="button" class="tag-pill-btn" data-tag="Destaque 🔥">Destaque 🔥</button>
              <button type="button" class="tag-pill-btn" data-tag="Vegetariano 🍃">Vegetariano 🍃</button>
              <button type="button" class="tag-pill-btn" data-tag="Novidade ✨">Novidade ✨</button>
            </div>
          </div>

          <!-- Descrição -->
          <div class="form-field">
            <label class="form-label" for="prod-desc">Descrição & Ingredientes</label>
            <textarea 
              id="prod-desc" 
              class="input-field" 
              style="margin-top: 0;"
              rows="2" 
              placeholder="Descreva o prato com sabor e detalhes que atraiam o cliente..."
            >${dishToEdit?.description || ''}</textarea>
          </div>

          <!-- Foto do Prato -->
          <div class="form-field">
            <label class="form-label">
              <span>Foto do Prato</span>
              <span style="font-weight: 400; font-size: 0.72rem; color: var(--text-dim);">Escolha abaixo ou envie uma foto</span>
            </label>
            
            <div class="preset-img-grid">
              ${presetImages.map(item => `
                <div class="preset-img-card ${currentImg === item.url ? 'selected' : ''}" data-url="${item.url}" title="${item.label}">
                  <img src="${item.url}" alt="${item.label}" />
                </div>
              `).join('')}
            </div>

            <div style="display: flex; gap: 8px; margin-top: 8px;">
              <input 
                type="text" 
                id="prod-img-url" 
                class="input-field" 
                style="margin-top: 0; flex: 1; font-size: 0.8rem;"
                placeholder="Ou cole a URL direta de uma imagem externa" 
                value="${currentImg}" 
              />
              <label class="admin-btn-secondary" style="margin: 0; cursor: pointer; padding: 8px 12px; font-size: 0.8rem;">
                📷 Subir Foto
                <input type="file" id="prod-file-upload" accept="image/*" style="display: none;" />
              </label>
            </div>

            <div class="img-preview-box">
              <img id="modal-img-preview" class="img-preview-thumb" src="${currentImg}" alt="Pré-visualização" />
              <div style="font-size: 0.8rem; color: var(--text-muted);">
                <div style="font-weight: 700; color: var(--text-main); margin-bottom: 2px;">Prévia da Imagem</div>
                <div id="img-source-label">Esta imagem será exibida com destaque no cardápio do cliente.</div>
              </div>
            </div>
          </div>

          <!-- Personalização de Acompanhamentos (Prato Feito / Almoço) -->
          <div style="margin: 12px 0 16px; padding: 14px; background: rgba(245, 158, 11, 0.05); border: 1px dashed rgba(245, 158, 11, 0.35); border-radius: var(--radius-md);">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
              <div>
                <div style="font-weight: 800; font-size: 0.92rem; color: var(--primary); display: flex; align-items: center; gap: 6px;">
                  🍛 Personalização de Acompanhamentos (Prato Feito / Almoço)
                </div>
                <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">
                  Permite ao cliente escolher o que quer no prato com botões ON/OFF no celular.
                </div>
              </div>
              <label class="switch-control" style="flex-shrink: 0;">
                <input type="checkbox" id="prod-has-options" ${hasCustomOptions ? 'checked' : ''} />
                <span class="switch-slider"></span>
              </label>
            </div>

            <div id="options-manager-box" style="${hasCustomOptions ? 'display: block;' : 'display: none;'} margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.08);">
              <label class="form-label" style="margin-bottom: 6px;">
                <span>Acompanhamentos que compõem este prato:</span>
                <span style="font-size: 0.72rem; color: var(--text-dim);">Clique no ✕ para remover</span>
              </label>

              <div id="custom-options-tag-list" style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px;"></div>

              <div style="display: flex; gap: 8px;">
                <input type="text" id="new-option-input" class="input-field" style="margin-top: 0; flex: 1; font-size: 0.85rem;" placeholder="Ex: Arroz Branco, Feijão Carioca, Farofa..." />
                <button type="button" id="btn-add-custom-option" class="admin-btn-secondary" style="padding: 8px 14px; font-size: 0.82rem; white-space: nowrap;">
                  + Adicionar
                </button>
              </div>

              <div style="margin-top: 10px; font-size: 0.75rem; color: var(--text-dim); display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <span>Sugestões rápidas:</span>
                <button type="button" class="btn-quick-option" data-opt="Arroz Branco">+ Arroz Branco</button>
                <button type="button" class="btn-quick-option" data-opt="Feijão Carioca">+ Feijão</button>
                <button type="button" class="btn-quick-option" data-opt="Macarrão ao Alho e Óleo">+ Macarrão</button>
                <button type="button" class="btn-quick-option" data-opt="Farofa Crocante">+ Farofa</button>
                <button type="button" class="btn-quick-option" data-opt="Salada Fresca">+ Salada</button>
                <button type="button" class="btn-quick-option" data-opt="Batata Frita">+ Batata Frita</button>
                <button type="button" class="btn-quick-option" data-opt="Vinagrete">+ Vinagrete</button>
                <button type="button" class="btn-quick-option" data-opt="Ovo Frito">+ Ovo Frito</button>
              </div>
            </div>
          </div>

          <!-- Disponibilidade imediata -->
          <div style="display: flex; align-items: center; gap: 10px; margin: 10px 0 16px; padding: 10px 14px; background: rgba(255,255,255,0.03); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
            <input 
              type="checkbox" 
              id="prod-available" 
              style="width: 18px; height: 18px; accent-color: var(--primary); cursor: pointer;" 
              ${dishToEdit ? (dishToEdit.available ? 'checked' : '') : 'checked'} 
            />
            <label for="prod-available" style="font-size: 0.88rem; font-weight: 600; cursor: pointer;">
              Prato disponível para pedidos imediatamente
            </label>
          </div>

          <div id="form-error-msg" style="color: var(--accent-red); font-size: 0.82rem; font-weight: 700; display: none; margin-bottom: 8px;"></div>

          <!-- Botões de Ação -->
          <div style="display: flex; gap: 10px; margin-top: 6px;">
            <button type="button" id="modal-cancel-btn" class="dev-btn" style="flex: 1; justify-content: center; padding: 12px;">
              Cancelar
            </button>
            <button type="submit" class="admin-btn-primary" style="flex: 1; justify-content: center; padding: 12px;">
              ${isEdit ? '💾 Salvar Alterações' : '✨ Cadastrar Prato'}
            </button>
          </div>
        </form>
      </div>
    `;

    const closeModal = attachModal(modal);
    modal.querySelector('#modal-close-btn').onclick = closeModal;
    modal.querySelector('#modal-cancel-btn').onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };

    // Handler de criação rápida de categoria diretamente do formulário de prato
    const categorySelect = modal.querySelector('#prod-category');
    modal.querySelector('#btn-quick-create-cat').onclick = () => {
      openCategoryEditModal(null, (newCategory) => {
        categorySelect.innerHTML = renderCategoryOptions(newCategory.id);
      });
    };

    // Handlers das sugestões de tag
    modal.querySelectorAll('.tag-pill-btn').forEach(btn => {
      btn.onclick = () => {
        modal.querySelector('#prod-tag').value = btn.dataset.tag;
      };
    });

    // Handlers das imagens preset
    const imgPreview = modal.querySelector('#modal-img-preview');
    const imgUrlInput = modal.querySelector('#prod-img-url');

    modal.querySelectorAll('.preset-img-card').forEach(card => {
      card.onclick = () => {
        modal.querySelectorAll('.preset-img-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        currentImg = card.dataset.url;
        imgUrlInput.value = currentImg;
        imgPreview.src = currentImg;
      };
    });

    // Handler de digitação de URL personalizada
    imgUrlInput.oninput = (e) => {
      const url = e.target.value.trim();
      if (url) {
        currentImg = url;
        imgPreview.src = url;
        modal.querySelectorAll('.preset-img-card').forEach(c => c.classList.remove('selected'));
      }
    };

    // Handler de upload local (converte pra Base64 dataURL)
    const fileInput = modal.querySelector('#prod-file-upload');
    fileInput.onchange = (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (loadEvent) => {
          currentImg = loadEvent.target.result;
          imgUrlInput.value = '(Foto enviada do aparelho)';
          imgPreview.src = currentImg;
          modal.querySelectorAll('.preset-img-card').forEach(c => c.classList.remove('selected'));
          modal.querySelector('#img-source-label').textContent = `Foto carregada: ${file.name}`;
        };
        reader.readAsDataURL(file);
      }
    };

    // Gestão de Opções / Acompanhamentos
    const hasOptionsCheck = modal.querySelector('#prod-has-options');
    const optionsManagerBox = modal.querySelector('#options-manager-box');
    const optionsTagList = modal.querySelector('#custom-options-tag-list');
    const newOptionInput = modal.querySelector('#new-option-input');
    const btnAddOption = modal.querySelector('#btn-add-custom-option');

    function renderOptionsTags() {
      if (currentOptions.length === 0) {
        optionsTagList.innerHTML = '<span style="font-size: 0.78rem; color: var(--text-dim);">Nenhum acompanhamento adicionado ainda.</span>';
        return;
      }
      optionsTagList.innerHTML = currentOptions.map((opt, idx) => `
        <span class="option-tag-pill">
          <span>${opt}</span>
          <button type="button" class="btn-remove-opt" data-idx="${idx}" title="Remover">&times;</button>
        </span>
      `).join('');

      optionsTagList.querySelectorAll('.btn-remove-opt').forEach(btn => {
        btn.onclick = () => {
          const idx = parseInt(btn.dataset.idx);
          currentOptions.splice(idx, 1);
          renderOptionsTags();
        };
      });
    }
    renderOptionsTags();

    hasOptionsCheck.onchange = (e) => {
      hasCustomOptions = e.target.checked;
      optionsManagerBox.style.display = hasCustomOptions ? 'block' : 'none';
    };

    const addOption = (text) => {
      const clean = (text || '').trim();
      if (clean && !currentOptions.includes(clean)) {
        currentOptions.push(clean);
        renderOptionsTags();
      }
    };

    btnAddOption.onclick = () => {
      addOption(newOptionInput.value);
      newOptionInput.value = '';
      newOptionInput.focus();
    };

    newOptionInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        btnAddOption.click();
      }
    };

    modal.querySelectorAll('.btn-quick-option').forEach(btn => {
      btn.onclick = () => {
        addOption(btn.dataset.opt);
      };
    });

    // Submit do Formulário
    const form = modal.querySelector('#product-form');
    form.onsubmit = (e) => {
      e.preventDefault();
      const name = modal.querySelector('#prod-name').value.trim();
      const category = categorySelect.value;
      const priceVal = parseFloat(modal.querySelector('#prod-price').value);
      const prepTime = modal.querySelector('#prod-preptime').value.trim() || '15-20 min';
      const tag = modal.querySelector('#prod-tag').value.trim();
      const description = modal.querySelector('#prod-desc').value.trim();
      const available = modal.querySelector('#prod-available').checked;
      const errorMsg = modal.querySelector('#form-error-msg');

      if (!name) {
        errorMsg.textContent = 'Por favor, informe o nome do prato.';
        errorMsg.style.display = 'block';
        return;
      }

      if (isNaN(priceVal) || priceVal <= 0) {
        errorMsg.textContent = 'Por favor, informe um preço de venda válido maior que zero.';
        errorMsg.style.display = 'block';
        return;
      }

      const productPayload = {
        name,
        category,
        price: priceVal,
        prepTime,
        tag,
        description,
        image: currentImg || '/images/hero.jpg',
        available,
        hasCustomOptions,
        options: hasCustomOptions ? currentOptions : []
      };

      if (isEdit) {
        store.updateProduct(dishToEdit.id, productPayload);
        showToast(`Prato "${name}" atualizado com sucesso!`, '✏️');
      } else {
        store.addProduct(productPayload);
        showToast(`Prato "${name}" cadastrado no cardápio!`, '✨');
      }

      closeModal();
      update();
    };
  }

  function openDeleteConfirmModal(dish) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="admin-modal-card" style="max-width: 440px;">
        <div class="modal-header">
          <h2 class="modal-title" style="color: var(--accent-red);">
            🗑️ Excluir Prato
          </h2>
          <button class="btn-close" id="modal-close-btn">&times;</button>
        </div>

        <p style="font-size: 0.95rem; margin: 12px 0 20px; line-height: 1.5;">
          Tem certeza que deseja remover <strong>"${dish.name}"</strong> do cardápio? 
          Os clientes não poderão mais visualizar nem pedir este item.
        </p>

        <div style="display: flex; gap: 10px;">
          <button id="btn-cancel-del" class="dev-btn" style="flex: 1; justify-content: center; padding: 12px;">
            Cancelar
          </button>
          <button id="btn-confirm-del" class="admin-btn-action btn-delete" style="flex: 1; justify-content: center; padding: 12px; font-size: 0.9rem;">
            Sim, Excluir Prato
          </button>
        </div>
      </div>
    `;

    const closeModal = attachModal(modal);
    modal.querySelector('#modal-close-btn').onclick = closeModal;
    modal.querySelector('#btn-cancel-del').onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };

    modal.querySelector('#btn-confirm-del').onclick = () => {
      store.deleteProduct(dish.id);
      showToast(`Prato "${dish.name}" excluído.`, '🗑️');
      closeModal();
      update();
    };
  }

  function openResetConfirmModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="admin-modal-card" style="max-width: 440px;">
        <div class="modal-header">
          <h2 class="modal-title" style="color: var(--primary);">
            ↺ Restaurar Cardápio Padrão
          </h2>
          <button class="btn-close" id="modal-close-btn">&times;</button>
        </div>

        <p style="font-size: 0.95rem; margin: 12px 0 20px; line-height: 1.5;">
          Deseja restaurar a lista inicial original de 7 pratos do restaurante? 
          Itens cadastrados manualmente serão substituídos pelo modelo inicial.
        </p>

        <div style="display: flex; gap: 10px;">
          <button id="btn-cancel-reset" class="dev-btn" style="flex: 1; justify-content: center; padding: 12px;">
            Cancelar
          </button>
          <button id="btn-confirm-reset" class="admin-btn-primary" style="flex: 1; justify-content: center; padding: 12px;">
            Restaurar Agora
          </button>
        </div>
      </div>
    `;

    const closeModal = attachModal(modal);
    modal.querySelector('#modal-close-btn').onclick = closeModal;
    modal.querySelector('#btn-cancel-reset').onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };

    modal.querySelector('#btn-confirm-reset').onclick = () => {
      store.resetMenuToDefault();
      showToast('Cardápio restaurado para o padrão original!', '↺');
      closeModal();
      update();
    };
  }

  // ==========================================================
  // RENDERIZAÇÃO PRINCIPAL DO PAINEL
  // ==========================================================

  function update() {
    container.innerHTML = '';
    container.className = 'app-container';

    const currentCategories = store.getCategories();

    // Se a categoria selecionada foi excluída, volta pra 'todos'
    if (selectedCategory !== 'todos' && !currentCategories.some(c => c.id === selectedCategory)) {
      selectedCategory = 'todos';
    }

    // --- HEADER DO ADMIN ---
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--border-subtle); flex-wrap: wrap; gap: 12px;';
    header.innerHTML = `
      <div>
        <h1 style="font-family: var(--font-display); font-size: 1.8rem; font-weight: 800;">
          ⚙️ Painel Administrativo do Restaurante
        </h1>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">
          Cadastre novos pratos, crie categorias personalizadas, controle estoque e acompanhe métricas.
        </p>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 0.85rem; background: rgba(245, 158, 11, 0.12); color: var(--primary); padding: 6px 14px; border-radius: var(--radius-full); font-weight: 700;">
          Supervisor ADM
        </span>
      </div>
    `;
    container.appendChild(header);

    // --- ALERTAS DE CONTAS SOLICITADAS NO TOPO DO ADMIN ---
    const allBillReqs = store.getAllBillRequests();
    if (allBillReqs.length > 0) {
      allBillReqs.forEach(req => {
        const alertBanner = document.createElement('div');
        alertBanner.className = 'admin-bill-alert-bar';
        alertBanner.innerHTML = `
          <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
            <span style="font-size: 1.6rem;">🚨</span>
            <div>
              <div style="font-weight: 800; font-size: 1rem; color: #fbbf24;">
                Mesa ${req.table} Solicitou a Conta!
              </div>
              <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 2px;">
                Forma solicitada: <strong>${req.paymentMethodLabel}</strong> • Total: <strong style="color: var(--primary);">R$ ${(req.total || 0).toFixed(2).replace('.', ',')}</strong>
                ${req.notes ? ` • Obs: <em>${req.notes}</em>` : ''}
              </div>
            </div>
          </div>
          <button class="admin-btn-primary btn-close-table-quick" data-table="${req.table}" style="padding: 10px 18px; font-size: 0.85rem; background: #10b981; border-color: #10b981; white-space: nowrap;">
            ✅ Fechar Conta & Liberar Mesa ${req.table}
          </button>
        `;
        container.appendChild(alertBanner);

        alertBanner.querySelector('.btn-close-table-quick').onclick = () => {
          if (confirm(`Confirmar o recebimento e fechamento da conta da Mesa ${req.table}?`)) {
            store.closeTableBill(req.table);
            showToast(`Conta da Mesa ${req.table} fechada com sucesso!`, '✅');
            update();
          }
        };
      });
    }

    // --- ABAS DE NAVEGAÇÃO DO ADMIN ---
    const tablesOverview = store.getTablesOverview();
    const activeTablesCount = tablesOverview.filter(t => t.isOpen).length;

    const navTabs = document.createElement('div');
    navTabs.className = 'admin-nav-tabs';
    navTabs.innerHTML = `
      <button class="admin-nav-btn ${activeTab === 'tables' ? 'active' : ''}" id="tab-btn-tables" style="position: relative;">
        🍽️ Mesas & Comandas (${activeTablesCount} ativas)
        ${allBillReqs.length > 0 ? `
          <span style="background: #ef4444; color: #fff; font-size: 0.72rem; padding: 2px 7px; border-radius: 999px; margin-left: 6px; font-weight: 800;">
            ${allBillReqs.length} ${allBillReqs.length === 1 ? 'conta' : 'contas'}
          </span>
        ` : ''}
      </button>
      <button class="admin-nav-btn ${activeTab === 'products' ? 'active' : ''}" id="tab-btn-products">
        📋 Cardápio (${store.menu.length})
      </button>
      <button class="admin-nav-btn ${activeTab === 'profile' ? 'active' : ''}" id="tab-btn-profile">
        🏪 Perfil & Configurações
      </button>
      <button class="admin-nav-btn ${activeTab === 'metrics' ? 'active' : ''}" id="tab-btn-metrics">
        📊 Métricas & QR Codes
      </button>
    `;

    navTabs.querySelector('#tab-btn-tables').onclick = () => {
      activeTab = 'tables';
      update();
    };
    navTabs.querySelector('#tab-btn-products').onclick = () => {
      activeTab = 'products';
      update();
    };
    navTabs.querySelector('#tab-btn-profile').onclick = () => {
      activeTab = 'profile';
      update();
    };
    navTabs.querySelector('#tab-btn-metrics').onclick = () => {
      activeTab = 'metrics';
      update();
    };

    container.appendChild(navTabs);

    // ==========================================================
    // ABA: GESTÃO DE MESAS & COMANDAS
    // ==========================================================
    if (activeTab === 'tables') {
      const tablesSection = document.createElement('div');

      const tables = store.getTablesOverview();
      const hasOldOrders = tables.some(t => t.isOlderThan3Hours && t.orders.length > 0);

      // Barra superior com métricas e limpeza de visitas antigas
      const overviewBar = document.createElement('div');
      overviewBar.className = 'admin-tables-overview-bar';
      overviewBar.innerHTML = `
        <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
          <div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">Mesas Ativas</div>
            <div style="font-size: 1.3rem; font-weight: 800; color: var(--primary);">
              ${tables.filter(t => t.isOpen).length} de ${tables.length}
            </div>
          </div>
          <div style="width: 1px; height: 32px; background: var(--border-subtle);"></div>
          <div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">Contas Solicitadas</div>
            <div style="font-size: 1.3rem; font-weight: 800; color: ${allBillReqs.length > 0 ? '#ef4444' : 'var(--text-main)'};">
              ${allBillReqs.length}
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          ${hasOldOrders ? `
            <button id="btn-cleanup-old" class="dev-btn" style="color: #f59e0b; border-color: rgba(245, 158, 11, 0.4); padding: 8px 14px; font-size: 0.85rem;" title="Encerra visitas antigas de mais de 3 horas atrás">
              🧹 Encerrar Pedidos Antigos (> 3h)
            </button>
          ` : ''}
          <button id="btn-refresh-tables" class="dev-btn" style="padding: 8px 14px; font-size: 0.85rem;">
            🔄 Atualizar
          </button>
        </div>
      `;
      tablesSection.appendChild(overviewBar);

      if (hasOldOrders) {
        const cleanupBtn = overviewBar.querySelector('#btn-cleanup-old');
        if (cleanupBtn) {
          cleanupBtn.onclick = () => {
            if (confirm('Deseja encerrar e arquivar todos os pedidos com mais de 3 horas (pedidos da véspera)? As mesas ficarão limpas imediatamente.')) {
              store.cleanupOldOrders(3);
              showToast('Pedidos antigos encerrados com sucesso!', '🧹');
              update();
            }
          };
        }
      }

      overviewBar.querySelector('#btn-refresh-tables').onclick = () => update();

      // Grid de mesas
      const tablesGrid = document.createElement('div');
      tablesGrid.className = 'admin-tables-grid';

      tables.forEach(t => {
        const isRequested = Boolean(t.billRequest);
        const card = document.createElement('div');
        card.className = `admin-table-card ${isRequested ? 'bill-requested' : (t.isOpen ? 'is-active' : 'is-empty')}`;

        const elapsedMin = t.latestOrderTime ? Math.floor((Date.now() - t.latestOrderTime) / (1000 * 60)) : 0;

        card.innerHTML = `
          <div class="admin-table-card-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="admin-table-badge">Mesa ${t.table}</span>
              ${t.isOpen && t.customerNames.length > 0 ? `
                <span class="table-client-name">${t.customerNames[0]}</span>
              ` : ''}
            </div>
            <div>
              ${isRequested ? `
                <span class="status-pill status-pill-danger">🚨 CONTA PEDIDA</span>
              ` : (t.hasPending ? `
                <span class="status-pill status-pill-warning">🟡 Cozinha</span>
              ` : (t.isOpen ? `
                <span class="status-pill status-pill-success">🟢 Em Consumo</span>
              ` : `
                <span class="status-pill status-pill-muted">⚪ Livre</span>
              `))}
            </div>
          </div>

          ${isRequested ? `
            <div class="table-bill-alert-box">
              <div style="font-weight: 800; font-size: 0.85rem; color: #fbbf24;">
                Forma: ${t.billRequest.paymentMethodLabel}
              </div>
              ${t.billRequest.notes ? `<div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">Obs: ${t.billRequest.notes}</div>` : ''}
            </div>
          ` : ''}

          ${t.isOlderThan3Hours && t.orders.length > 0 ? `
            <div style="padding: 6px 10px; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-sm); font-size: 0.75rem; color: #f87171;">
              ⚠️ Visita antiga de mais de 3h atrás (ontem)
            </div>
          ` : ''}

          <div class="admin-table-card-body">
            ${t.orders.length === 0 ? `
              <div style="text-align: center; color: var(--text-dim); padding: 24px 0; font-size: 0.85rem;">
                Mesa livre no momento.<br>Aguardando novo cliente.
              </div>
            ` : `
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 0.8rem; color: var(--text-muted);">${t.orders.length} ${t.orders.length === 1 ? 'pedido' : 'pedidos'} (${elapsedMin} min)</span>
                <span style="font-size: 1.15rem; font-weight: 800; color: var(--primary);">
                  R$ ${t.total.toFixed(2).replace('.', ',')}
                </span>
              </div>

              <div class="table-items-compact-list">
                ${t.orders.flatMap(o => o.items || []).slice(0, 4).map(i => `
                  <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--text-muted); padding: 2px 0;">
                    <span>${i.quantity}x ${i.name}</span>
                    <span>R$ ${(i.price * i.quantity).toFixed(2).replace('.', ',')}</span>
                  </div>
                `).join('')}
                ${t.orders.flatMap(o => o.items || []).length > 4 ? `
                  <div style="font-size: 0.72rem; color: var(--text-dim); text-align: center; margin-top: 2px;">
                    + outros itens...
                  </div>
                ` : ''}
              </div>
            `}
          </div>

          <div class="admin-table-card-footer">
            ${t.orders.length > 0 ? `
              <button class="btn-close-table-action" data-table="${t.table}">
                ✅ Fechar Conta & Liberar Mesa
              </button>
            ` : ''}
            <button class="btn-view-as-client" data-table="${t.table}">
              📱 Ver Cardápio da Mesa
            </button>
          </div>
        `;

        const closeBtn = card.querySelector('.btn-close-table-action');
        if (closeBtn) {
          closeBtn.onclick = () => {
            if (confirm(`Deseja encerrar e liberar a Mesa ${t.table}? A comanda será finalizada e a mesa zerada para novos clientes.`)) {
              store.closeTableBill(t.table);
              showToast(`Mesa ${t.table} encerrada e liberada com sucesso!`, '✅');
              update();
            }
          };
        }

        const viewBtn = card.querySelector('.btn-view-as-client');
        if (viewBtn) {
          viewBtn.onclick = () => {
            if (onNavigateTable) onNavigateTable(t.table);
          };
        }

        tablesGrid.appendChild(card);
      });

      tablesSection.appendChild(tablesGrid);
      container.appendChild(tablesSection);
    }

    // ==========================================================
    // ABA 1: GESTÃO DO CARDÁPIO & PRODUTOS (CRUD COMPLETO)
    // ==========================================================
    if (activeTab === 'products') {
      const productsSection = document.createElement('div');

      // Barra de ferramentas (Busca + Botões de Ação)
      const toolbar = document.createElement('div');
      toolbar.className = 'admin-toolbar';

      const allCategoryFilters = [
        { id: 'todos', label: 'Todos', icon: '🍽️' },
        ...currentCategories
      ];

      toolbar.innerHTML = `
        <div class="admin-toolbar-row">
          <div class="admin-search-wrap">
            <span class="admin-search-icon">🔍</span>
            <input 
              type="text" 
              id="admin-search" 
              class="admin-search-input" 
              placeholder="Buscar por nome ou ingrediente..." 
              value="${searchQuery}" 
            />
          </div>

          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button id="btn-add-product" class="admin-btn-primary">
              ✨ + Cadastrar Novo Prato
            </button>
            <button id="btn-open-cat-manager" class="admin-btn-secondary" title="Gerenciar e criar novas categorias">
              🏷️ Gerenciar Categorias (${currentCategories.length})
            </button>
            <button id="btn-reset-menu" class="admin-btn-secondary" title="Restaurar pratos originais caso necessário">
              ↺ Restaurar Pratos
            </button>
          </div>
        </div>

        <div class="admin-toolbar-row" style="margin-top: -4px;">
          <!-- Filtro por Categoria Dinâmica -->
          <div class="admin-filter-bar">
            ${allCategoryFilters.map(cat => `
              <button 
                class="admin-filter-pill ${selectedCategory === cat.id ? 'active' : ''}" 
                data-cat="${cat.id}">
                ${cat.icon} ${cat.label}
              </button>
            `).join('')}
            <button id="btn-quick-add-cat-pill" class="admin-filter-pill" style="border-style: dashed; color: var(--primary);" title="Criar nova categoria">
              + Categoria
            </button>
          </div>

          <!-- Filtro por Disponibilidade -->
          <div style="display: flex; gap: 6px; font-size: 0.8rem;">
            <button class="admin-filter-pill ${statusFilter === 'all' ? 'active' : ''}" data-status="all">
              Todos
            </button>
            <button class="admin-filter-pill ${statusFilter === 'available' ? 'active' : ''}" data-status="available">
              🟢 Disponíveis
            </button>
            <button class="admin-filter-pill ${statusFilter === 'unavailable' ? 'active' : ''}" data-status="unavailable">
              🔴 Esgotados
            </button>
          </div>
        </div>
      `;

      productsSection.appendChild(toolbar);

      // Filtra produtos
      const filteredDishes = store.menu.filter(dish => {
        const matchesCategory = selectedCategory === 'todos' || dish.category === selectedCategory;
        const query = searchQuery.toLowerCase().trim();
        const matchesSearch = !query || 
          dish.name.toLowerCase().includes(query) || 
          (dish.description && dish.description.toLowerCase().includes(query));
        
        let matchesStatus = true;
        if (statusFilter === 'available') matchesStatus = dish.available !== false;
        if (statusFilter === 'unavailable') matchesStatus = dish.available === false;

        return matchesCategory && matchesSearch && matchesStatus;
      });

      // Grid de Pratos
      const dishGrid = document.createElement('div');
      dishGrid.className = 'admin-dish-grid';

      if (filteredDishes.length === 0) {
        dishGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-subtle);">
            <div style="font-size: 2.2rem; margin-bottom: 10px;">🍽️</div>
            <h3 style="font-family: var(--font-display); font-size: 1.2rem; margin-bottom: 6px;">Nenhum prato encontrado</h3>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 18px;">
              ${selectedCategory !== 'todos' ? `Nenhum prato na categoria selecionada.` : 'Tente alterar os filtros ou cadastre um novo prato agora mesmo.'}
            </p>
            <button id="btn-empty-add" class="admin-btn-primary" style="margin: 0 auto;">
              ✨ Cadastrar Novo Prato
            </button>
          </div>
        `;
      } else {
        filteredDishes.forEach(dish => {
          const isAvail = dish.available !== false;
          const catObj = currentCategories.find(c => c.id === dish.category) || { label: dish.category, icon: '🍽️' };

          const card = document.createElement('div');
          card.className = 'admin-dish-card';
          card.innerHTML = `
            <div class="admin-dish-thumb-wrap">
              <img class="admin-dish-thumb" src="${dish.image}" alt="${dish.name}" loading="lazy" onerror="this.src='/images/hero.jpg'" />
              ${dish.tag ? `<div class="admin-dish-tag-badge">${dish.tag}</div>` : ''}
              <div class="admin-dish-status-badge ${isAvail ? 'available' : 'unavailable'}">
                ${isAvail ? '✓ Disponível' : '✕ Esgotado'}
              </div>
            </div>

            <div class="admin-dish-content">
              <div class="admin-dish-header-row">
                <h3 class="admin-dish-title">${dish.name}</h3>
                <span class="admin-dish-price">R$ ${dish.price.toFixed(2).replace('.', ',')}</span>
              </div>

              <div class="admin-dish-meta">
                <span>${catObj.icon} ${catObj.label}</span>
                <span>•</span>
                <span>⏱️ ${dish.prepTime || '15-20 min'}</span>
                ${dish.hasCustomOptions && dish.options && dish.options.length > 0 ? `
                  <span>•</span>
                  <span style="color: var(--primary); font-weight: 700;">🍛 ${dish.options.length} acomp.</span>
                ` : ''}
              </div>

              <p class="admin-dish-desc">
                ${dish.description || 'Sem descrição cadastrada.'}
              </p>

              <div class="admin-dish-actions">
                <button 
                  class="admin-btn-action btn-toggle-stock ${isAvail ? 'active' : 'inactive'}" 
                  data-action="toggle" 
                  data-id="${dish.id}"
                  title="${isAvail ? 'Clique para marcar como esgotado' : 'Clique para marcar como disponível'}">
                  ${isAvail ? '🟢 Ativo' : '🔴 Esgotado'}
                </button>
                <button class="admin-btn-action btn-edit" data-action="edit" data-id="${dish.id}">
                  ✏️ Editar
                </button>
                <button class="admin-btn-action btn-delete" data-action="delete" data-id="${dish.id}">
                  🗑️ Excluir
                </button>
              </div>
            </div>
          `;

          card.querySelector('[data-action="toggle"]').onclick = () => {
            store.toggleItemAvailability(dish.id);
            showToast(`Status de "${dish.name}" alterado!`, '🔄');
          };

          card.querySelector('[data-action="edit"]').onclick = () => {
            openProductModal(dish);
          };

          card.querySelector('[data-action="delete"]').onclick = () => {
            openDeleteConfirmModal(dish);
          };

          dishGrid.appendChild(card);
        });
      }

      productsSection.appendChild(dishGrid);
      container.appendChild(productsSection);

      // Handlers da barra de ferramentas
      const searchInput = toolbar.querySelector('#admin-search');
      if (searchInput) {
        searchInput.oninput = (e) => {
          searchQuery = e.target.value;
          update();
          const freshInput = document.getElementById('admin-search');
          if (freshInput) {
            freshInput.focus();
            freshInput.setSelectionRange(freshInput.value.length, freshInput.value.length);
          }
        };
      }

      toolbar.querySelector('#btn-add-product').onclick = () => openProductModal(null);
      toolbar.querySelector('#btn-open-cat-manager').onclick = openCategoryManagerModal;
      toolbar.querySelector('#btn-quick-add-cat-pill').onclick = () => openCategoryEditModal(null);
      toolbar.querySelector('#btn-reset-menu').onclick = openResetConfirmModal;

      const emptyAdd = dishGrid.querySelector('#btn-empty-add');
      if (emptyAdd) emptyAdd.onclick = () => openProductModal(null);

      toolbar.querySelectorAll('[data-cat]').forEach(btn => {
        btn.onclick = () => {
          selectedCategory = btn.dataset.cat;
          update();
        };
      });

      toolbar.querySelectorAll('[data-status]').forEach(btn => {
        btn.onclick = () => {
          statusFilter = btn.dataset.status;
          update();
        };
      });
    }

    // ==========================================================
    // ABA 2: PERFIL & IDENTIDADE VISUAL DA EMPRESA
    // ==========================================================
    if (activeTab === 'profile') {
      const profile = store.getRestaurantProfile();
      let draftName = profile.name;
      let draftTagline = profile.tagline || '';
      let draftPhone = profile.phone || '';
      let draftAddress = profile.address || '';
      let draftBanner = profile.heroBanner || '/images/hero.jpg';
      let draftLogo = profile.logo || '';

      const bannerPresets = [
        { url: '/images/hero.jpg', label: 'Bistrô / Carnes' },
        { url: '/images/burger.jpg', label: 'Hamburgueria' },
        { url: '/images/pasta.jpg', label: 'Massas / Italiano' },
        { url: '/images/bruschetta.jpg', label: 'Café & Petiscos' },
        { url: '/images/dessert.jpg', label: 'Doces & Padaria' },
        { url: '/images/drink.jpg', label: 'Bar & Coquetéis' }
      ];

      const profileSection = document.createElement('div');
      profileSection.className = 'profile-settings-grid';

      profileSection.innerHTML = `
        <!-- Formulário de Configuração -->
        <div class="profile-card">
          <div style="margin-bottom: 20px;">
            <h2 style="font-family: var(--font-display); font-size: 1.3rem; font-weight: 800; display: flex; align-items: center; gap: 8px;">
              🏪 Identidade do Estabelecimento
            </h2>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">
              Personalize o nome da empresa, slogan, foto de capa e logotipo exibidos no cardápio do cliente.
            </p>
          </div>

          <form id="profile-form" style="display: flex; flex-direction: column; gap: 14px;">
            <!-- Nome da Empresa -->
            <div class="form-field">
              <label class="form-label" for="comp-name">Nome do Restaurante / Empresa *</label>
              <input 
                type="text" 
                id="comp-name" 
                class="input-field" 
                style="margin-top: 0;"
                value="${draftName}" 
                placeholder="Ex: Café Bistrô Paris, Smash Burger..." 
                required 
              />
            </div>

            <!-- Slogan / Subtítulo -->
            <div class="form-field">
              <label class="form-label" for="comp-tagline">Slogan / Subtítulo de Boas-Vindas</label>
              <input 
                type="text" 
                id="comp-tagline" 
                class="input-field" 
                style="margin-top: 0;"
                value="${draftTagline}" 
                placeholder="Ex: ☕ Cafeteria Artesanal, Doces & Brunch" 
              />
            </div>

            <!-- Telefone e Endereço -->
            <div class="form-group-grid">
              <div class="form-field">
                <label class="form-label" for="comp-phone">Telefone / WhatsApp</label>
                <input 
                  type="text" 
                  id="comp-phone" 
                  class="input-field" 
                  style="margin-top: 0;"
                  value="${draftPhone}" 
                  placeholder="Ex: (11) 98765-4321" 
                />
              </div>
              <div class="form-field">
                <label class="form-label" for="comp-address">Endereço / Local</label>
                <input 
                  type="text" 
                  id="comp-address" 
                  class="input-field" 
                  style="margin-top: 0;"
                  value="${draftAddress}" 
                  placeholder="Ex: Rua das Flores, 123 - Centro" 
                />
              </div>
            </div>

            <!-- Taxa de Serviço (10% Opcional) -->
            <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 14px;">
              <label style="display: flex; align-items: flex-start; gap: 10px; cursor: pointer;">
                <input 
                  type="checkbox" 
                  id="comp-service-fee" 
                  style="width: 18px; height: 18px; accent-color: var(--primary); margin-top: 2px;" 
                  ${profile.serviceFeeEnabled ? 'checked' : ''}
                />
                <div>
                  <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-main);">
                    Cobrar Taxa de Serviço de 10% (Opcional)
                  </div>
                  <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
                    Quando ativado, calcula e exibe automaticamente a taxa de 10% de serviço no detalhamento da comanda e fechamento de conta.
                  </div>
                </div>
              </label>
            </div>

            <!-- Banner de Capa -->
            <div class="form-field">
              <label class="form-label">
                <span>Foto de Capa do Cardápio (Banner Superior)</span>
                <span style="font-size: 0.72rem; color: var(--text-dim); font-weight: 400;">Escolha um tema ou envie uma foto</span>
              </label>

              <div class="banner-preset-grid">
                ${bannerPresets.map(preset => `
                  <div class="banner-preset-card ${draftBanner === preset.url ? 'selected' : ''}" data-url="${preset.url}">
                    <img src="${preset.url}" alt="${preset.label}" />
                    <div class="banner-preset-label">${preset.label}</div>
                  </div>
                `).join('')}
              </div>

              <div style="display: flex; gap: 8px; margin-top: 8px;">
                <input 
                  type="text" 
                  id="comp-banner-url" 
                  class="input-field" 
                  style="margin-top: 0; flex: 1; font-size: 0.8rem;" 
                  placeholder="Ou cole a URL direta de uma imagem" 
                  value="${draftBanner}" 
                />
                <label class="admin-btn-secondary" style="margin: 0; cursor: pointer; padding: 8px 12px; font-size: 0.8rem;">
                  📷 Enviar Capa
                  <input type="file" id="comp-banner-file" accept="image/*" style="display: none;" />
                </label>
              </div>
            </div>

            <!-- Logotipo da Empresa -->
            <div class="form-field">
              <label class="form-label">
                <span>Logotipo / Ícone da Empresa</span>
                <span style="font-size: 0.72rem; color: var(--text-dim); font-weight: 400;">Opcional - exibido junto ao nome</span>
              </label>
              <div style="display: flex; gap: 8px; align-items: center;">
                <input 
                  type="text" 
                  id="comp-logo-url" 
                  class="input-field" 
                  style="margin-top: 0; flex: 1; font-size: 0.8rem;" 
                  placeholder="Cole URL do logotipo ou envie um arquivo" 
                  value="${draftLogo}" 
                />
                <label class="admin-btn-secondary" style="margin: 0; cursor: pointer; padding: 8px 12px; font-size: 0.8rem;">
                  📷 Subir Logo
                  <input type="file" id="comp-logo-file" accept="image/*" style="display: none;" />
                </label>
                <button type="button" id="btn-remove-logo" class="admin-btn-secondary" style="color: var(--accent-red); padding: 8px 12px; ${draftLogo ? '' : 'display: none;'}" title="Remover logotipo">
                  ✕ Remover Logo
                </button>
              </div>
            </div>

            <div style="display: flex; gap: 10px; margin-top: 14px; padding-top: 16px; border-top: 1px solid var(--border-subtle);">
              <button type="button" id="btn-reset-profile" class="dev-btn" style="padding: 12px 18px;">
                ↺ Restaurar Padrão
              </button>
              <button type="submit" class="admin-btn-primary" style="flex: 1; justify-content: center; padding: 12px;">
                💾 Salvar Dados da Empresa
              </button>
            </div>
          </form>
        </div>

        <!-- Pré-visualização ao Vivo (Live Preview) -->
        <div>
          <div style="position: sticky; top: 70px;">
            <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
              <span>📱 Prévia do Cardápio do Cliente</span>
              <span style="font-size: 0.75rem; color: var(--accent-green); font-weight: 700;">● Ao Vivo</span>
            </div>

            <div class="profile-mockup-wrap">
              <div id="preview-header" class="profile-mockup-header" style="background-image: linear-gradient(to bottom, rgba(12, 15, 23, 0.35), var(--bg-main)), url('${draftBanner}');">
                <div class="client-hero-overlay" style="align-items: flex-end;">
                  <div class="client-hero-brand">
                    <img id="preview-logo" src="${draftLogo}" alt="Logo" class="client-hero-logo" style="${draftLogo ? '' : 'display: none;'}" onerror="this.style.display='none'" />
                    <div>
                      <div id="preview-tagline" class="client-subtitle">${draftTagline || 'Cardápio Digital'}</div>
                      <h1 id="preview-name" class="client-title" style="font-size: 1.35rem;">${draftName}</h1>
                    </div>
                  </div>
                  <div class="table-pill" style="font-size: 0.75rem; padding: 4px 10px;">
                    🍽️ Mesa 04
                  </div>
                </div>
              </div>

              <div style="padding: 16px;">
                <div style="height: 12px; width: 60%; background: rgba(255,255,255,0.08); border-radius: 4px; margin-bottom: 10px;"></div>
                <div style="display: flex; gap: 6px; margin-bottom: 14px;">
                  <div style="height: 24px; width: 65px; background: rgba(245, 158, 11, 0.2); border-radius: 99px;"></div>
                  <div style="height: 24px; width: 75px; background: rgba(255, 255, 255, 0.05); border-radius: 99px;"></div>
                  <div style="height: 24px; width: 65px; background: rgba(255, 255, 255, 0.05); border-radius: 99px;"></div>
                </div>
                <div style="display: flex; gap: 10px; align-items: center; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                  <div style="width: 44px; height: 44px; background: rgba(255,255,255,0.08); border-radius: 6px;"></div>
                  <div style="flex: 1;">
                    <div style="height: 10px; width: 70%; background: rgba(255,255,255,0.1); border-radius: 3px; margin-bottom: 6px;"></div>
                    <div style="height: 8px; width: 40%; background: var(--primary); border-radius: 3px;"></div>
                  </div>
                </div>
              </div>
            </div>

            <div style="font-size: 0.78rem; color: var(--text-muted); text-align: center; margin-top: 10px; line-height: 1.4;">
              ✨ As alterações salvas aqui são aplicadas na mesma hora em todas as comandas e cardápios.
            </div>
          </div>
        </div>
      `;

      container.appendChild(profileSection);

      // Eventos interativos da prévia ao vivo
      const previewName = profileSection.querySelector('#preview-name');
      const previewTagline = profileSection.querySelector('#preview-tagline');
      const previewHeader = profileSection.querySelector('#preview-header');
      const previewLogo = profileSection.querySelector('#preview-logo');
      const inputName = profileSection.querySelector('#comp-name');
      const inputTagline = profileSection.querySelector('#comp-tagline');
      const inputBannerUrl = profileSection.querySelector('#comp-banner-url');
      const inputLogoUrl = profileSection.querySelector('#comp-logo-url');
      const btnRemoveLogo = profileSection.querySelector('#btn-remove-logo');

      inputName.oninput = (e) => {
        draftName = e.target.value.trim() || 'Nome da Empresa';
        previewName.textContent = draftName;
      };

      inputTagline.oninput = (e) => {
        draftTagline = e.target.value.trim();
        previewTagline.textContent = draftTagline || 'Cardápio Digital';
      };

      // Presets de banner
      profileSection.querySelectorAll('.banner-preset-card').forEach(card => {
        card.onclick = () => {
          profileSection.querySelectorAll('.banner-preset-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          draftBanner = card.dataset.url;
          inputBannerUrl.value = draftBanner;
          previewHeader.style.backgroundImage = `linear-gradient(to bottom, rgba(12, 15, 23, 0.35), var(--bg-main)), url('${draftBanner}')`;
        };
      });

      inputBannerUrl.oninput = (e) => {
        const url = e.target.value.trim();
        if (url) {
          draftBanner = url;
          previewHeader.style.backgroundImage = `linear-gradient(to bottom, rgba(12, 15, 23, 0.35), var(--bg-main)), url('${draftBanner}')`;
          profileSection.querySelectorAll('.banner-preset-card').forEach(c => c.classList.remove('selected'));
        }
      };

      // Upload de Banner via arquivo local
      const bannerFile = profileSection.querySelector('#comp-banner-file');
      bannerFile.onchange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (loadEvent) => {
            draftBanner = loadEvent.target.result;
            inputBannerUrl.value = '(Foto enviada do aparelho)';
            previewHeader.style.backgroundImage = `linear-gradient(to bottom, rgba(12, 15, 23, 0.35), var(--bg-main)), url('${draftBanner}')`;
            profileSection.querySelectorAll('.banner-preset-card').forEach(c => c.classList.remove('selected'));
          };
          reader.readAsDataURL(file);
        }
      };

      // Input e Upload de Logotipo
      inputLogoUrl.oninput = (e) => {
        draftLogo = e.target.value.trim();
        if (draftLogo) {
          previewLogo.src = draftLogo;
          previewLogo.style.display = 'block';
          if (btnRemoveLogo) btnRemoveLogo.style.display = 'block';
        } else {
          previewLogo.style.display = 'none';
          if (btnRemoveLogo) btnRemoveLogo.style.display = 'none';
        }
      };

      const logoFile = profileSection.querySelector('#comp-logo-file');
      logoFile.onchange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (loadEvent) => {
            draftLogo = loadEvent.target.result;
            inputLogoUrl.value = '(Logo enviado do aparelho)';
            previewLogo.src = draftLogo;
            previewLogo.style.display = 'block';
            if (btnRemoveLogo) btnRemoveLogo.style.display = 'block';
          };
          reader.readAsDataURL(file);
        }
      };

      if (btnRemoveLogo) {
        btnRemoveLogo.onclick = () => {
          draftLogo = '';
          inputLogoUrl.value = '';
          previewLogo.style.display = 'none';
          btnRemoveLogo.style.display = 'none';
        };
      }

      // Reset profile
      profileSection.querySelector('#btn-reset-profile').onclick = () => {
        if (confirm('Deseja restaurar o nome e foto de capa padrão original (CozinhaFy)?')) {
          store.resetRestaurantProfile();
          showToast('Perfil da empresa restaurado ao padrão original!', '↺');
          update();
        }
      };

      // Salvar
      const form = profileSection.querySelector('#profile-form');
      form.onsubmit = (e) => {
        e.preventDefault();
        const name = inputName.value.trim();
        const tagline = inputTagline.value.trim();
        const phone = profileSection.querySelector('#comp-phone').value.trim();
        const address = profileSection.querySelector('#comp-address').value.trim();

        if (!name) {
          alert('Por favor, informe o nome da empresa.');
          inputName.focus();
          return;
        }

        const serviceFeeEnabled = profileSection.querySelector('#comp-service-fee')?.checked || false;

        store.updateRestaurantProfile({
          name,
          tagline,
          phone,
          address,
          heroBanner: draftBanner,
          logo: draftLogo,
          serviceFeeEnabled
        });

        showToast(`Dados de "${name}" salvos com sucesso!`, '🏪');
        update();
      };
    }

    // ==========================================================
    // ABA 3: VISÃO GERAL, MÉTRICAS & QR CODES
    // ==========================================================
    if (activeTab === 'metrics') {
      const metrics = store.getAdminMetrics();


      // --- CARDS DE MÉTRICAS ---
      const statsGrid = document.createElement('div');
      statsGrid.className = 'admin-stats-grid';
      statsGrid.innerHTML = `
        <div class="stat-card">
          <span class="stat-label">Faturamento Total</span>
          <span class="stat-value stat-highlight">
            R$ ${metrics.totalRevenue.toFixed(2).replace('.', ',')}
          </span>
        </div>

        <div class="stat-card">
          <span class="stat-label">Total de Pedidos</span>
          <span class="stat-value">
            ${metrics.totalOrders} <span style="font-size: 0.9rem; color: var(--text-muted); font-weight: 400;">(${metrics.completedOrdersCount} concluídos)</span>
          </span>
        </div>

        <div class="stat-card">
          <span class="stat-label">Ticket Médio</span>
          <span class="stat-value">
            R$ ${metrics.averageTicket.toFixed(2).replace('.', ',')}
          </span>
        </div>

        <div class="stat-card">
          <span class="stat-label">Tempo Médio de Preparo</span>
          <span class="stat-value">
            ⏱️ ${metrics.avgPrepMinutes} min
          </span>
        </div>
      `;
      container.appendChild(statsGrid);

      // --- SEÇÕES PRINCIPAIS (RANKING + GERADOR QR CODE) ---
      const sectionsGrid = document.createElement('div');
      sectionsGrid.className = 'admin-sections-grid';

      // 1. Ranking dos Mais Pedidos
      const rankingBox = document.createElement('div');
      rankingBox.className = 'admin-box';
      const maxSales = metrics.topItems.length > 0 ? metrics.topItems[0].count : 1;

      rankingBox.innerHTML = `
        <h2 class="admin-box-title">
          🏆 Pratos Mais Vendidos
        </h2>

        <div class="ranking-list">
          ${metrics.topItems.length === 0 ? `
            <div style="color: var(--text-muted); font-size: 0.9rem; padding: 20px 0;">
              Nenhuma venda registrada ainda.
            </div>
          ` : metrics.topItems.map((item, idx) => {
            const percent = Math.round((item.count / maxSales) * 100);
            return `
              <div class="ranking-item">
                <div class="ranking-info">
                  <span><strong>#${idx + 1}</strong> ${item.name}</span>
                  <span style="color: var(--primary);">${item.count} pedidos</span>
                </div>
                <div class="ranking-bar-bg">
                  <div class="ranking-bar-fill" style="width: ${percent}%;"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border-subtle);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="font-size: 0.95rem; font-weight: 700;">
              Controle Rápido de Estoque
            </h3>
            <button id="btn-quick-manage-all" class="dev-btn" style="font-size: 0.75rem;">
              Ver Todos (${store.menu.length}) ➔
            </button>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${store.menu.slice(0, 5).map(dish => `
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; padding: 6px 0;">
                <span>${dish.name}</span>
                <button class="menu-toggle-btn dev-btn ${dish.available ? 'active' : ''}" data-id="${dish.id}" style="padding: 3px 10px; font-size: 0.75rem;">
                  ${dish.available ? '✓ Disponível' : '✕ Esgotado'}
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      rankingBox.querySelectorAll('.menu-toggle-btn').forEach(btn => {
        btn.onclick = () => {
          store.toggleItemAvailability(btn.dataset.id);
        };
      });

      const quickManageBtn = rankingBox.querySelector('#btn-quick-manage-all');
      if (quickManageBtn) {
        quickManageBtn.onclick = () => {
          activeTab = 'products';
          update();
        };
      }

      sectionsGrid.appendChild(rankingBox);

      // 2. Gerador de QR Code de Mesas
      const qrBox = document.createElement('div');
      qrBox.className = 'admin-box';
      qrBox.innerHTML = `
        <h2 class="admin-box-title">
          📱 Gerador de QR Code para Mesas
        </h2>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 14px;">
          Gere a plaquinha com o QR Code vinculado diretamente ao número de cada mesa física do restaurante.
        </p>

        <div style="display: flex; align-items: center; gap: 10px;">
          <label style="font-size: 0.9rem; font-weight: 700;">Selecione a Mesa:</label>
          <select id="table-select" class="input-field" style="width: auto; padding: 6px 12px; margin-top: 0;">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20].map(n => {
              const pad = String(n).padStart(2, '0');
              return `<option value="${pad}" ${selectedTable === pad ? 'selected' : ''}>Mesa ${pad}</option>`;
            }).join('')}
          </select>
        </div>

        <div class="qr-preview-area" id="qr-display-area">
          <canvas id="qr-canvas" class="qr-preview-canvas"></canvas>
          <div class="qr-table-text">Mesa ${selectedTable}</div>
          <div class="qr-instruction">
            Escaneie para abrir o cardápio e fazer seu pedido
          </div>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 14px;">
          <button id="btn-open-table" class="dev-btn" style="flex: 1; justify-content: center; padding: 10px;">
            🚀 Testar como Cliente
          </button>
          <button id="btn-print-qr" class="dev-btn active" style="flex: 1; justify-content: center; padding: 10px;">
            🖨️ Imprimir Plaquinha
          </button>
        </div>
      `;

      sectionsGrid.appendChild(qrBox);
      container.appendChild(sectionsGrid);

      // Renderiza o QR Code
      setTimeout(() => {
        const canvas = document.getElementById('qr-canvas');
        if (canvas) {
          const tableUrl = `${window.location.origin}/?mesa=${selectedTable}`;
          QRCode.toCanvas(canvas, tableUrl, {
            width: 180,
            margin: 1,
            color: {
              dark: '#000000',
              light: '#ffffff'
            }
          });
        }

        const select = document.getElementById('table-select');
        if (select) {
          select.onchange = (e) => {
            selectedTable = e.target.value;
            update();
          };
        }

        const openBtn = document.getElementById('btn-open-table');
        if (openBtn) {
          openBtn.onclick = () => {
            onNavigateTable(selectedTable);
          };
        }

        const printBtn = document.getElementById('btn-print-qr');
        if (printBtn) {
          printBtn.onclick = () => {
            window.print();
          };
        }
      }, 50);
    }
  }

  const unsubscribe = store.subscribe(() => {
    update();
  });

  update();
  return () => {
    document.body.classList.remove('modal-open');
    unsubscribe();
  };
}
