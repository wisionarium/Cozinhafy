import './style.css';
import { renderDevBar } from './components/DevBar.js';
import { renderClientView } from './components/ClientView.js';
import { renderKitchenView } from './components/KitchenView.js';
import { renderAdminView } from './components/AdminView.js';

// Registra Service Worker para PWA e Cache Local
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('SW registration note:', err);
    });
  });
}

function initApp() {
  const appRoot = document.getElementById('app');
  appRoot.innerHTML = '';

  // Determina visão e mesa a partir da URL
  const urlParams = new URLSearchParams(window.location.search);
  let currentView = urlParams.get('view') || 'client'; // 'client', 'kitchen', 'admin'
  let currentTable = urlParams.get('mesa') || '04';

  let activeViewCleanup = null;

  // Container para a DevBar
  const devBarSlot = document.createElement('div');
  appRoot.appendChild(devBarSlot);

  // Container para a Tela Ativa
  const mainViewContainer = document.createElement('main');
  appRoot.appendChild(mainViewContainer);

  function render() {
    // Limpa view anterior se houver
    if (activeViewCleanup) {
      activeViewCleanup();
      activeViewCleanup = null;
    }

    // Renderiza DevBar
    devBarSlot.innerHTML = '';
    const devBarEl = renderDevBar(currentView, currentTable, (newView, newTable) => {
      currentView = newView;
      if (newTable) currentTable = newTable;

      // Atualiza URL sem recarregar a página
      const newParams = new URLSearchParams(window.location.search);
      newParams.set('view', currentView);
      if (currentView === 'client') {
        newParams.set('mesa', currentTable);
      } else {
        newParams.delete('mesa');
      }
      window.history.pushState({}, '', `${window.location.pathname}?${newParams.toString()}`);
      render();
    });
    devBarSlot.appendChild(devBarEl);

    // Renderiza tela ativa
    mainViewContainer.innerHTML = '';
    if (currentView === 'kitchen') {
      activeViewCleanup = renderKitchenView(mainViewContainer);
    } else if (currentView === 'admin') {
      activeViewCleanup = renderAdminView(mainViewContainer, (targetTable) => {
        currentView = 'client';
        currentTable = targetTable;
        render();
      });
    } else {
      activeViewCleanup = renderClientView(currentTable, mainViewContainer);
    }
  }

  // Escuta voltar/avançar no navegador
  window.addEventListener('popstate', () => {
    const params = new URLSearchParams(window.location.search);
    currentView = params.get('view') || 'client';
    currentTable = params.get('mesa') || '04';
    render();
  });

  render();
}

// Inicia aplicação
initApp();
