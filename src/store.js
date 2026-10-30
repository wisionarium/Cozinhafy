import { INITIAL_MENU, INITIAL_CATEGORIES } from './menuData.js';
import { supabase, isSupabaseConfigured } from './lib/supabase.js';

const STORAGE_KEYS = {
  ORDERS: 'bistro_orders_v1',
  MENU: 'bistro_menu_v1',
  CATEGORIES: 'bistro_categories_v1',
  PROFILE: 'bistro_profile_v1',
  CART: 'bistro_cart_v1'
};

const DEFAULT_RESTAURANT_PROFILE = {
  name: 'Bistrô Sabor & Arte',
  tagline: '✨ Experiência Gastronômica',
  heroBanner: '/images/hero.jpg',
  logo: '',
  phone: '(11) 98765-4321',
  address: 'Rua das Flores, 123'
};


// Canal de comunicação instantânea entre abas
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('bistro_sync_channel') : null;

// Funções auxiliares para mapeamento entre JavaScript e PostgreSQL/Supabase
const mapOrderToRow = (order) => ({
  id: order.id,
  order_number: order.orderNumber,
  table_num: order.table,
  customer_name: order.customerName,
  items: order.items,
  total: order.total,
  status: order.status,
  device_id: order.deviceId || null,
  session_id: order.sessionId || null,
  created_at: order.createdAt ? new Date(order.createdAt).toISOString() : new Date().toISOString(),
  started_at: order.startedAt ? new Date(order.startedAt).toISOString() : null,
  completed_at: order.completedAt ? new Date(order.completedAt).toISOString() : null
});

const mapRowToOrder = (row) => ({
  id: row.id,
  orderNumber: row.order_number,
  table: row.table_num,
  customerName: row.customer_name,
  items: row.items,
  total: parseFloat(row.total || 0),
  status: row.status,
  deviceId: row.device_id,
  sessionId: row.session_id,
  createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  startedAt: row.started_at ? new Date(row.started_at).getTime() : null,
  completedAt: row.completed_at ? new Date(row.completed_at).getTime() : null
});

const mapDishToRow = (dish) => ({
  id: dish.id,
  name: dish.name,
  description: dish.description || '',
  price: dish.price,
  category: dish.category,
  image: dish.image || '',
  tag: dish.tag || '',
  available: dish.available !== false,
  has_custom_options: !!dish.hasCustomOptions,
  options: dish.options || []
});

const mapRowToDish = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description || '',
  price: parseFloat(row.price || 0),
  category: row.category,
  image: row.image || '',
  tag: row.tag || '',
  prepTime: '15-20 min',
  available: row.available !== false,
  hasCustomOptions: !!row.has_custom_options,
  options: row.options || []
});

const mapCategoryToRow = (cat, idx) => ({
  id: cat.id,
  label: cat.label,
  icon: cat.icon || '🍽️',
  order_index: idx !== undefined ? idx : 0
});

const mapRowToCategory = (row) => ({
  id: row.id,
  label: row.label,
  icon: row.icon || '🍽️'
});

const mapProfileToRow = (profile) => ({
  id: 'main',
  name: profile.name,
  tagline: profile.tagline || '',
  hero_banner: profile.heroBanner || '',
  logo: profile.logo || '',
  phone: profile.phone || '',
  address: profile.address || '',
  updated_at: new Date().toISOString()
});

const mapRowToProfile = (row) => ({
  name: row.name,
  tagline: row.tagline,
  heroBanner: row.hero_banner,
  logo: row.logo,
  phone: row.phone,
  address: row.address
});

// Mock inicial de pedidos para demonstração
const SEED_ORDERS = [
  {
    id: 'ord-101',
    orderNumber: 101,
    table: '02',
    customerName: 'Mariana Silva',
    items: [
      { id: 'prato-2', name: 'Burger Gourmet Prime', price: 46.50, quantity: 2, notes: 'Um sem cebola, o outro ao ponto' },
      { id: 'bebida-1', name: 'Soda Artesanal de Maracujá & Menta', price: 18.50, quantity: 2, notes: 'Gelo e limão' }
    ],
    total: 130.00,
    status: 'em_preparo',
    createdAt: Date.now() - 1000 * 60 * 7, // 7 minutos atrás
    startedAt: Date.now() - 1000 * 60 * 3
  },
  {
    id: 'ord-102',
    orderNumber: 102,
    table: '05',
    customerName: 'Carlos Eduardo',
    items: [
      { id: 'entrada-1', name: 'Bruschetta Pomodoro & Mozzarella', price: 34.00, quantity: 1, notes: 'Caprichar no azeite' },
      { id: 'prato-1', name: 'Bife de Chorizo Nobre', price: 78.90, quantity: 1, notes: 'Ao ponto pra mal passada' }
    ],
    total: 112.90,
    status: 'recebido',
    createdAt: Date.now() - 1000 * 60 * 2 // 2 minutos atrás
  }
];

class Store {
  constructor() {
    this.listeners = new Set();
    this.audioContext = null;
    this.soundEnabled = true;

    // Inicializa pedidos
    const storedOrders = localStorage.getItem(STORAGE_KEYS.ORDERS);
    if (!storedOrders) {
      this.orders = SEED_ORDERS;
      this.saveOrders();
    } else {
      try {
        this.orders = JSON.parse(storedOrders);
      } catch {
        this.orders = SEED_ORDERS;
      }
    }

    // Inicializa cardápio
    const storedMenu = localStorage.getItem(STORAGE_KEYS.MENU);
    if (!storedMenu) {
      this.menu = INITIAL_MENU;
      this.saveMenu();
    } else {
      try {
        this.menu = JSON.parse(storedMenu);
      } catch {
        this.menu = INITIAL_MENU;
      }
    }

    // Inicializa categorias
    const storedCategories = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (!storedCategories) {
      this.categories = INITIAL_CATEGORIES;
      this.saveCategories();
    } else {
      try {
        this.categories = JSON.parse(storedCategories);
      } catch {
        this.categories = INITIAL_CATEGORIES;
      }
    }

    // Assegura que a categoria Almoço exista
    if (!this.categories.some(c => c.id === 'almoco')) {
      this.categories.unshift({ id: 'almoco', label: 'Almoço', icon: '🍛' });
      this.saveCategories();
    }

    // Assegura que haja pratos de almoço personalizáveis caso o cardápio salvo não tenha
    if (!this.menu.some(m => m.category === 'almoco')) {
      const samplePfs = [
        {
          id: 'prato-pf-1',
          name: 'Prato Feito Clássico (Bife Acebolado)',
          category: 'almoco',
          price: 34.90,
          description: 'Bife bovino macio acebolado na chapa com acompanhamentos selecionáveis à sua escolha.',
          image: '/images/hero.jpg',
          tag: 'Almoço Executivo 🍛',
          prepTime: '15-20 min',
          available: true,
          hasCustomOptions: true,
          options: ['Arroz Branco', 'Feijão Carioca', 'Macarrão ao Alho e Óleo', 'Farofa Crocante', 'Salada Fresca']
        },
        {
          id: 'prato-pf-2',
          name: 'PF Frango Grelhado Executivo',
          category: 'almoco',
          price: 29.90,
          description: 'Filé de peito marinado grelhado na chapa. Monte seu almoço ligando ou desligando o que quiser.',
          image: '/images/pasta.jpg',
          tag: 'Mais Pedido Almoço ⭐',
          prepTime: '15-20 min',
          available: true,
          hasCustomOptions: true,
          options: ['Arroz Branco', 'Feijão Carioca', 'Farofa Crocante', 'Batata Frita', 'Salada Fresca']
        }
      ];
      this.menu.unshift(...samplePfs);
      this.saveMenu();
    }

    // Inicializa perfil do restaurante
    const storedProfile = localStorage.getItem(STORAGE_KEYS.PROFILE);
    if (!storedProfile) {
      this.profile = DEFAULT_RESTAURANT_PROFILE;
      this.saveProfile();
    } else {
      try {
        this.profile = { ...DEFAULT_RESTAURANT_PROFILE, ...JSON.parse(storedProfile) };
      } catch {
        this.profile = DEFAULT_RESTAURANT_PROFILE;
      }
    }

    // Inicializa carrinho
    try {
      this.cart = JSON.parse(localStorage.getItem(STORAGE_KEYS.CART) || '{}');
    } catch {
      this.cart = {};
    }

    // Escuta sincronizações vindas de outras abas
    if (channel) {
      channel.onmessage = (event) => {
        if (event.data?.type === 'SYNC') {
          this.reloadFromStorage();
          this.notify(event.data.payload);
        }
      };
    }

    window.addEventListener('storage', (e) => {
      if (Object.values(STORAGE_KEYS).includes(e.key)) {
        this.reloadFromStorage();
        this.notify();
      }
    });

    // Inicializa sincronização em nuvem se o Supabase estiver configurado
    this.initSupabase();
  }

  reloadFromStorage() {
    try {
      this.orders = JSON.parse(localStorage.getItem(STORAGE_KEYS.ORDERS) || '[]');
      this.menu = JSON.parse(localStorage.getItem(STORAGE_KEYS.MENU) || '[]');
      this.categories = JSON.parse(localStorage.getItem(STORAGE_KEYS.CATEGORIES) || '[]');
      this.profile = { ...DEFAULT_RESTAURANT_PROFILE, ...JSON.parse(localStorage.getItem(STORAGE_KEYS.PROFILE) || '{}') };
      this.cart = JSON.parse(localStorage.getItem(STORAGE_KEYS.CART) || '{}');
    } catch (e) {
      console.error('Erro ao recarregar storage', e);
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(eventData = null) {
    this.listeners.forEach(fn => fn(eventData));
  }

  broadcast(type, payload = null) {
    if (channel) {
      channel.postMessage({ type, payload });
    }
    this.notify(payload);
  }

  // --- SINCRONIZAÇÃO EM NUVEM (SUPABASE REALTIME) ---
  isCloudConfigured() {
    return Boolean(isSupabaseConfigured);
  }

  isCloudReady() {
    return Boolean(isSupabaseConfigured && this.cloudConnected);
  }

  async initSupabase() {
    if (!isSupabaseConfigured || !supabase) {
      console.info('⚡ Bistrô: Operando em modo Local (localStorage + BroadcastChannel). Configure o .env para sincronizar em nuvem.');
      return;
    }

    console.info('🚀 Bistrô: Supabase configurado! Inicializando sincronização em tempo real...');
    try {
      await this.fetchInitialSupabaseData();
      this.setupSupabaseRealtime();
    } catch (err) {
      console.warn('Aviso ao inicializar Supabase:', err);
    }
  }

  async fetchInitialSupabaseData() {
    if (!isSupabaseConfigured || !supabase) return;

    try {
      // 1. Carrega ou envia cardápio
      const { data: dbMenu, error: menuErr } = await supabase.from('menu_items').select('*');
      if (!menuErr && dbMenu && dbMenu.length > 0) {
        this.menu = dbMenu.map(mapRowToDish);
        this.saveMenu();
      } else if (!menuErr && (!dbMenu || dbMenu.length === 0)) {
        // Se a tabela do Supabase estiver vazia, popula com o cardápio local
        await supabase.from('menu_items').upsert(this.menu.map(mapDishToRow));
      }

      // 2. Carrega ou envia categorias
      const { data: dbCats, error: catErr } = await supabase.from('categories').select('*').order('order_index', { ascending: true });
      if (!catErr && dbCats && dbCats.length > 0) {
        this.categories = dbCats.map(mapRowToCategory);
        this.saveCategories();
      } else if (!catErr && (!dbCats || dbCats.length === 0)) {
        await supabase.from('categories').upsert(this.categories.map((c, i) => mapCategoryToRow(c, i)));
      }

      // 3. Carrega ou envia perfil
      const { data: dbProf, error: profErr } = await supabase.from('restaurant_profile').select('*').eq('id', 'main').maybeSingle();
      if (!profErr && dbProf) {
        this.profile = { ...this.profile, ...mapRowToProfile(dbProf) };
        this.saveProfile();
      } else if (!profErr && !dbProf) {
        await supabase.from('restaurant_profile').upsert(mapProfileToRow(this.profile));
      }

      // 4. Carrega pedidos ativos/recentes
      const { data: dbOrders, error: ordersErr } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(50);
      if (!ordersErr && dbOrders && dbOrders.length > 0) {
        this.orders = dbOrders.map(mapRowToOrder);
        this.saveOrders();
      }

      this.notify({ action: 'CLOUD_SYNCED' });
    } catch (e) {
      console.error('Erro na sincronização inicial com Supabase:', e);
    }
  }

  setupSupabaseRealtime() {
    if (!isSupabaseConfigured || !supabase) return;

    this.supabaseChannel = supabase
      .channel('bistro-live-room')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        this.handleRealtimeOrder(payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, (payload) => {
        this.handleRealtimeMenu(payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, (payload) => {
        this.handleRealtimeCategories(payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_profile' }, (payload) => {
        this.handleRealtimeProfile(payload);
      })
      .subscribe((status) => {
        this.cloudConnected = (status === 'SUBSCRIBED');
        this.notify({ action: 'CLOUD_STATUS_CHANGED', status, connected: this.cloudConnected });
      });
  }

  handleRealtimeOrder(payload) {
    const { eventType, new: newRow, old: oldRow } = payload;
    if (eventType === 'INSERT' && newRow) {
      const order = mapRowToOrder(newRow);
      if (!this.orders.some(o => o.id === order.id)) {
        this.orders.unshift(order);
        this.saveOrders();
        this.playKitchenBell();
        this.notify({ action: 'NEW_ORDER', order });
      }
    } else if (eventType === 'UPDATE' && newRow) {
      const order = mapRowToOrder(newRow);
      const idx = this.orders.findIndex(o => o.id === order.id);
      if (idx !== -1) {
        const prevStatus = this.orders[idx].status;
        this.orders[idx] = order;
        this.saveOrders();
        if (prevStatus !== 'pronto' && order.status === 'pronto') {
          this.playReadyBell();
        }
        this.notify({ action: 'STATUS_CHANGED', orderId: order.id, newStatus: order.status, table: order.table });
      }
    } else if (eventType === 'DELETE' && oldRow?.id) {
      this.orders = this.orders.filter(o => o.id !== oldRow.id);
      this.saveOrders();
      this.notify({ action: 'ORDER_DELETED', orderId: oldRow.id });
    }
  }

  handleRealtimeMenu(payload) {
    const { eventType, new: newRow, old: oldRow } = payload;
    if ((eventType === 'INSERT' || eventType === 'UPDATE') && newRow) {
      const dish = mapRowToDish(newRow);
      const idx = this.menu.findIndex(d => d.id === dish.id);
      if (idx !== -1) {
        this.menu[idx] = dish;
      } else {
        this.menu.unshift(dish);
      }
      this.saveMenu();
      this.notify({ action: 'MENU_UPDATED', dishId: dish.id });
    } else if (eventType === 'DELETE' && oldRow?.id) {
      this.menu = this.menu.filter(d => d.id !== oldRow.id);
      this.saveMenu();
      this.notify({ action: 'MENU_UPDATED', dishId: oldRow.id });
    }
  }

  handleRealtimeCategories(payload) {
    const { eventType, new: newRow, old: oldRow } = payload;
    if ((eventType === 'INSERT' || eventType === 'UPDATE') && newRow) {
      const cat = mapRowToCategory(newRow);
      const idx = this.categories.findIndex(c => c.id === cat.id);
      if (idx !== -1) {
        this.categories[idx] = cat;
      } else {
        this.categories.push(cat);
      }
      this.saveCategories();
      this.notify({ action: 'CATEGORIES_UPDATED' });
    } else if (eventType === 'DELETE' && oldRow?.id) {
      this.categories = this.categories.filter(c => c.id !== oldRow.id);
      this.saveCategories();
      this.notify({ action: 'CATEGORIES_UPDATED' });
    }
  }

  handleRealtimeProfile(payload) {
    if (payload.new) {
      this.profile = { ...this.profile, ...mapRowToProfile(payload.new) };
      this.saveProfile();
      this.notify({ action: 'PROFILE_UPDATED' });
    }
  }

  // --- ÁUDIO (Sintetizador Web Audio API sem arquivos externos) ---
  initAudio() {
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
      }
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  playKitchenBell() {
    if (!this.soundEnabled) return;
    this.initAudio();
    if (!this.audioContext) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Dois tons tipo "Ding-Dong" de restaurante gourmet
    const playNote = (freq, start, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.3, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + duration);
    };

    playNote(659.25, now, 0.4);       // Mi (E5)
    playNote(523.25, now + 0.25, 0.6); // Dó (C5)
  }

  playReadyBell() {
    if (!this.soundEnabled) return;
    this.initAudio();
    if (!this.audioContext) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Três tons ascendentes alegres de prato pronto
    const notes = [523.25, 659.25, 783.99]; // Dó, Mi, Sol
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.15;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.5);
    });
  }

  // --- GESTÃO DE PEDIDOS ---
  saveOrders() {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(this.orders));
  }

  createOrder({ table, customerName, items, total, deviceId = null, sessionId = null }) {
    const nextNumber = this.orders.length > 0 
      ? Math.max(...this.orders.map(o => o.orderNumber || 100)) + 1 
      : 101;

    const newOrder = {
      id: 'ord-' + Date.now(),
      orderNumber: nextNumber,
      table: String(table).padStart(2, '0'),
      customerName: customerName.trim(),
      deviceId,
      sessionId,
      items,
      total,
      status: 'recebido', // recebido -> em_preparo -> pronto
      createdAt: Date.now()
    };

    // Fila FIFO: novo pedido entra na lista
    this.orders.unshift(newOrder);
    this.saveOrders();

    // Limpa carrinho da mesa
    this.clearCart(table);

    // Toca som na cozinha e avisa todas as abas
    this.playKitchenBell();
    this.broadcast('SYNC', { action: 'NEW_ORDER', order: newOrder });

    // Sincroniza em nuvem no Supabase caso configurado
    if (isSupabaseConfigured && supabase) {
      supabase.from('orders').insert(mapOrderToRow(newOrder)).then(({ error }) => {
        if (error) console.error('Erro ao enviar pedido para o Supabase:', error);
      });
    }

    return newOrder;
  }

  updateOrderStatus(orderId, newStatus) {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return;

    order.status = newStatus;
    if (newStatus === 'em_preparo') {
      order.startedAt = Date.now();
    } else if (newStatus === 'pronto') {
      order.completedAt = Date.now();
      this.playReadyBell();
    }

    this.saveOrders();
    this.broadcast('SYNC', { action: 'STATUS_CHANGED', orderId, newStatus, table: order.table });

    // Sincroniza em nuvem no Supabase caso configurado
    if (isSupabaseConfigured && supabase) {
      supabase.from('orders').update({
        status: newStatus,
        started_at: order.startedAt ? new Date(order.startedAt).toISOString() : null,
        completed_at: order.completedAt ? new Date(order.completedAt).toISOString() : null
      }).eq('id', orderId).then(({ error }) => {
        if (error) console.error('Erro ao atualizar status do pedido no Supabase:', error);
      });
    }
  }

  getOrdersForTable(table) {
    const padTable = String(table).padStart(2, '0');
    return this.orders.filter(o => o.table === padTable);
  }

  getActiveOrderForTable(table) {
    const padTable = String(table).padStart(2, '0');
    return this.orders.find(o => o.table === padTable && o.status !== 'pronto');
  }

  getLatestOrderForTable(table) {
    const padTable = String(table).padStart(2, '0');
    return this.orders.find(o => o.table === padTable);
  }

  getTableTotalBill(table) {
    const orders = this.getOrdersForTable(table);
    return orders.reduce((sum, o) => sum + (o.total || 0), 0);
  }

  // --- MÉTODOS DE SESSÃO / DISPOSITIVO ANÔNIMO (ISOLAMENTO DE COMANDAS) ---
  getOrdersForSession(table, sessionId, deviceId = null) {
    const padTable = String(table).padStart(2, '0');
    return this.orders.filter(o => {
      if (o.table !== padTable) return false;
      if (sessionId && o.sessionId) {
        return o.sessionId === sessionId;
      }
      if (deviceId && o.deviceId) {
        return o.deviceId === deviceId;
      }
      return false;
    });
  }

  getActiveOrderForSession(table, sessionId, deviceId = null) {
    const orders = this.getOrdersForSession(table, sessionId, deviceId);
    return orders.find(o => o.status !== 'pronto');
  }

  getLatestOrderForSession(table, sessionId, deviceId = null) {
    const orders = this.getOrdersForSession(table, sessionId, deviceId);
    return orders[0] || null;
  }

  getSessionTotalBill(table, sessionId, deviceId = null) {
    const orders = this.getOrdersForSession(table, sessionId, deviceId);
    return orders.reduce((sum, o) => sum + (o.total || 0), 0);
  }

  // --- CARRINHO ---
  saveCart() {
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(this.cart));
  }

  getTableCart(table) {
    const key = `table_${table}`;
    return this.cart[key] || [];
  }

  addToCart(table, item, quantity = 1, notes = '', selectedOptions = null, unselectedOptions = null) {
    const key = `table_${table}`;
    if (!this.cart[key]) {
      this.cart[key] = [];
    }

    const selKey = selectedOptions ? selectedOptions.slice().sort().join('|') : '';
    const existingIndex = this.cart[key].findIndex(
      i => i.id === item.id && 
           (i.notes || '') === (notes || '') &&
           (i.selectedOptions ? i.selectedOptions.slice().sort().join('|') : '') === selKey
    );

    if (existingIndex > -1) {
      this.cart[key][existingIndex].quantity += quantity;
    } else {
      this.cart[key].push({
        ...item,
        quantity,
        notes,
        selectedOptions: selectedOptions || [],
        unselectedOptions: unselectedOptions || []
      });
    }

    this.saveCart();
    this.notify({ action: 'CART_UPDATED', table });
  }

  updateCartQuantity(table, index, delta) {
    const key = `table_${table}`;
    if (!this.cart[key]) return;

    this.cart[key][index].quantity += delta;
    if (this.cart[key][index].quantity <= 0) {
      this.cart[key].splice(index, 1);
    }

    this.saveCart();
    this.notify({ action: 'CART_UPDATED', table });
  }

  clearCart(table) {
    const key = `table_${table}`;
    delete this.cart[key];
    this.saveCart();
    this.notify({ action: 'CART_UPDATED', table });
  }

  // --- CARDÁPIO / ADMIN ---
  saveMenu() {
    localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify(this.menu));
  }

  toggleItemAvailability(itemId) {
    const item = this.menu.find(i => i.id === itemId);
    if (item) {
      item.available = !item.available;
      this.saveMenu();
      this.broadcast('SYNC', { action: 'MENU_UPDATED', itemId });

      if (isSupabaseConfigured && supabase) {
        supabase.from('menu_items').update({ available: item.available }).eq('id', itemId).catch(console.error);
      }
    }
  }

  addProduct(productData) {
    const newProduct = {
      id: 'prato-' + Date.now(),
      name: (productData.name || '').trim(),
      category: productData.category || 'principais',
      price: parseFloat(productData.price) || 0,
      description: (productData.description || '').trim(),
      image: productData.image || '/images/hero.jpg',
      tag: (productData.tag || '').trim(),
      prepTime: (productData.prepTime || '15-20 min').trim(),
      available: productData.available !== undefined ? Boolean(productData.available) : true,
      hasCustomOptions: Boolean(productData.hasCustomOptions),
      options: Array.isArray(productData.options) ? productData.options : []
    };

    this.menu.unshift(newProduct);
    this.saveMenu();
    this.broadcast('SYNC', { action: 'MENU_UPDATED', newProduct });

    if (isSupabaseConfigured && supabase) {
      supabase.from('menu_items').insert(mapDishToRow(newProduct)).catch(console.error);
    }

    return newProduct;
  }

  updateProduct(productId, updatedData) {
    const index = this.menu.findIndex(i => i.id === productId);
    if (index === -1) return null;

    this.menu[index] = {
      ...this.menu[index],
      name: updatedData.name !== undefined ? updatedData.name.trim() : this.menu[index].name,
      category: updatedData.category || this.menu[index].category,
      price: updatedData.price !== undefined ? parseFloat(updatedData.price) || 0 : this.menu[index].price,
      description: updatedData.description !== undefined ? updatedData.description.trim() : this.menu[index].description,
      image: updatedData.image || this.menu[index].image,
      tag: updatedData.tag !== undefined ? updatedData.tag.trim() : this.menu[index].tag,
      prepTime: updatedData.prepTime !== undefined ? updatedData.prepTime.trim() : this.menu[index].prepTime,
      available: updatedData.available !== undefined ? Boolean(updatedData.available) : this.menu[index].available,
      hasCustomOptions: updatedData.hasCustomOptions !== undefined ? Boolean(updatedData.hasCustomOptions) : Boolean(this.menu[index].hasCustomOptions),
      options: Array.isArray(updatedData.options) ? updatedData.options : (this.menu[index].options || [])
    };

    this.saveMenu();
    this.broadcast('SYNC', { action: 'MENU_UPDATED', productId });

    if (isSupabaseConfigured && supabase) {
      supabase.from('menu_items').update(mapDishToRow(this.menu[index])).eq('id', productId).catch(console.error);
    }

    return this.menu[index];
  }

  deleteProduct(productId) {
    const prevLength = this.menu.length;
    this.menu = this.menu.filter(i => i.id !== productId);
    if (this.menu.length !== prevLength) {
      this.saveMenu();
      this.broadcast('SYNC', { action: 'MENU_UPDATED', productId });

      if (isSupabaseConfigured && supabase) {
        supabase.from('menu_items').delete().eq('id', productId).catch(console.error);
      }

      return true;
    }
    return false;
  }

  resetMenuToDefault() {
    this.menu = JSON.parse(JSON.stringify(INITIAL_MENU));
    this.saveMenu();
    this.broadcast('SYNC', { action: 'MENU_UPDATED' });
  }

  // --- GESTÃO DE CATEGORIAS DINÂMICAS ---
  saveCategories() {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(this.categories));
  }

  getCategories() {
    return this.categories;
  }

  addCategory({ label, icon }) {
    const cleanLabel = (label || '').trim();
    if (!cleanLabel) return null;

    // Normaliza ID slug a partir do nome
    const slug = cleanLabel
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || ('cat-' + Date.now());

    // Evita IDs duplicados
    const finalId = this.categories.some(c => c.id === slug) 
      ? `${slug}-${Date.now().toString().slice(-4)}` 
      : slug;

    const newCategory = {
      id: finalId,
      label: cleanLabel,
      icon: (icon || '🍽️').trim()
    };

    this.categories.push(newCategory);
    this.saveCategories();
    this.broadcast('SYNC', { action: 'CATEGORIES_UPDATED', newCategory });

    if (isSupabaseConfigured && supabase) {
      supabase.from('categories').insert(mapCategoryToRow(newCategory, this.categories.length - 1)).catch(console.error);
    }

    return newCategory;
  }

  updateCategory(categoryId, { label, icon }) {
    const cat = this.categories.find(c => c.id === categoryId);
    if (!cat) return null;

    if (label !== undefined) cat.label = label.trim();
    if (icon !== undefined) cat.icon = (icon || '🍽️').trim();

    this.saveCategories();
    this.broadcast('SYNC', { action: 'CATEGORIES_UPDATED', categoryId });

    if (isSupabaseConfigured && supabase) {
      supabase.from('categories').update({ label: cat.label, icon: cat.icon }).eq('id', categoryId).catch(console.error);
    }

    return cat;
  }

  deleteCategory(categoryId, reassignToId = null) {
    // Se foi selecionada uma categoria destino, reatribui os pratos existentes
    if (reassignToId) {
      let modified = false;
      this.menu.forEach(dish => {
        if (dish.category === categoryId) {
          dish.category = reassignToId;
          modified = true;
        }
      });
      if (modified) {
        this.saveMenu();
        this.broadcast('SYNC', { action: 'MENU_UPDATED' });
        if (isSupabaseConfigured && supabase) {
          supabase.from('menu_items').update({ category: reassignToId }).eq('category', categoryId).catch(console.error);
        }
      }
    }

    const prevLength = this.categories.length;
    this.categories = this.categories.filter(c => c.id !== categoryId);
    if (this.categories.length !== prevLength) {
      this.saveCategories();
      this.broadcast('SYNC', { action: 'CATEGORIES_UPDATED', categoryId });

      if (isSupabaseConfigured && supabase) {
        supabase.from('categories').delete().eq('id', categoryId).catch(console.error);
      }

      return true;
    }
    return false;
  }

  getDishesCountForCategory(categoryId) {
    return this.menu.filter(d => d.category === categoryId).length;
  }

  resetCategoriesToDefault() {
    this.categories = JSON.parse(JSON.stringify(INITIAL_CATEGORIES));
    this.saveCategories();
    this.broadcast('SYNC', { action: 'CATEGORIES_UPDATED' });
  }

  // --- PERFIL DO RESTAURANTE ---
  saveProfile() {
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(this.profile));
  }

  getRestaurantProfile() {
    return this.profile;
  }

  updateRestaurantProfile(updatedData) {
    this.profile = {
      ...this.profile,
      name: updatedData.name !== undefined ? updatedData.name.trim() : this.profile.name,
      tagline: updatedData.tagline !== undefined ? updatedData.tagline.trim() : this.profile.tagline,
      heroBanner: updatedData.heroBanner || this.profile.heroBanner,
      logo: updatedData.logo !== undefined ? updatedData.logo : this.profile.logo,
      phone: updatedData.phone !== undefined ? updatedData.phone.trim() : this.profile.phone,
      address: updatedData.address !== undefined ? updatedData.address.trim() : this.profile.address
    };

    this.saveProfile();
    this.broadcast('SYNC', { action: 'PROFILE_UPDATED', profile: this.profile });

    if (isSupabaseConfigured && supabase) {
      supabase.from('restaurant_profile').upsert(mapProfileToRow(this.profile)).catch(console.error);
    }

    return this.profile;
  }

  resetRestaurantProfile() {
    this.profile = { ...DEFAULT_RESTAURANT_PROFILE };
    this.saveProfile();
    this.broadcast('SYNC', { action: 'PROFILE_UPDATED', profile: this.profile });
    return this.profile;
  }



  // --- MÉTRICAS ADMIN ---
  getAdminMetrics() {
    const totalOrders = this.orders.length;
    const completedOrders = this.orders.filter(o => o.status === 'pronto');
    const totalRevenue = this.orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const averageTicket = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;

    // Calcular tempo médio de preparo
    const finishedWithTimes = this.orders.filter(o => o.createdAt && o.completedAt);
    let avgPrepMinutes = 14; // baseline estimado
    if (finishedWithTimes.length > 0) {
      const totalTimeMs = finishedWithTimes.reduce((acc, o) => acc + (o.completedAt - o.createdAt), 0);
      avgPrepMinutes = Math.round(totalTimeMs / finishedWithTimes.length / (1000 * 60));
    }

    // Ranking dos pratos mais vendidos
    const itemCounts = {};
    this.orders.forEach(order => {
      order.items?.forEach(item => {
        itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
      });
    });

    const topItems = Object.entries(itemCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalOrders,
      completedOrdersCount: completedOrders.length,
      activeOrdersCount: totalOrders - completedOrders.length,
      totalRevenue,
      averageTicket,
      avgPrepMinutes,
      topItems
    };
  }
}

export const store = new Store();
