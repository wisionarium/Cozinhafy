import { INITIAL_MENU, INITIAL_CATEGORIES } from './menuData.js';
import { supabase, isSupabaseConfigured } from './lib/supabase.js';

const STORAGE_KEYS = {
  ORDERS: 'bistro_orders_v1',
  MENU: 'bistro_menu_v1',
  CATEGORIES: 'bistro_categories_v1',
  PROFILE: 'bistro_profile_v1',
  CART: 'bistro_cart_v1',
  BILL_REQUESTS: 'bistro_bill_requests_v1'
};

const DEFAULT_RESTAURANT_PROFILE = {
  name: 'CozinhaFy',
  tagline: '✨ Pedidos & Cozinha em Tempo Real',
  heroBanner: '/images/hero.jpg',
  logo: '/CozinhaFy.jpg',
  phone: '(11) 98765-4321',
  address: 'Rua das Flores, 123',
  serviceFeeEnabled: false,
  serviceFeePercent: 10
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
  active: cat.active !== false,
  order_index: idx !== undefined ? idx : 0
});

const mapRowToCategory = (row) => ({
  id: row.id,
  label: row.label,
  icon: row.icon || '🍽️',
  active: row.active !== false
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
  address: row.address,
  serviceFeeEnabled: row.service_fee_enabled !== undefined ? Boolean(row.service_fee_enabled) : false,
  serviceFeePercent: row.service_fee_percent ? parseFloat(row.service_fee_percent) : 10
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

    // Assegura que a categoria Café exista e fique no início
    if (!this.categories.some(c => c.id === 'cafe')) {
      this.categories.unshift({ id: 'cafe', label: 'Café', icon: '☕' });
      this.saveCategories();
    }

    // Assegura que haja itens de Café no cardápio
    if (!this.menu.some(m => m.category === 'cafe')) {
      const sampleCafes = [
        {
          id: 'cafe-1',
          name: 'Espresso Duplo Especial',
          category: 'cafe',
          price: 9.90,
          description: 'Café 100% arábica especial moído na hora, extração perfeita com crema espessa e aveludada.',
          image: '/images/drink.jpg',
          tag: 'Especial ☕',
          prepTime: '3-5 min',
          available: true
        },
        {
          id: 'cafe-2',
          name: 'Cappuccino Italiano',
          category: 'cafe',
          price: 14.50,
          description: 'Espresso com leite vaporizado sedoso, espuma densa e toque suave de cacau belga.',
          image: '/images/dessert.jpg',
          tag: 'Cremoso 🥛',
          prepTime: '5 min',
          available: true
        },
        {
          id: 'cafe-3',
          name: 'Iced Vanilla Latte',
          category: 'cafe',
          price: 16.90,
          description: 'Café gelado com leite fresco integral, cubos de gelo cristalino e xarope de baunilha Bourbon.',
          image: '/images/drink.jpg',
          tag: 'Gelado 🧊',
          prepTime: '5 min',
          available: true
        }
      ];
      this.menu.unshift(...sampleCafes);
      this.saveMenu();
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

    // Assegura que a categoria Pizzas exista
    if (!this.categories.some(c => c.id === 'pizzas')) {
      const idx = this.categories.findIndex(c => c.id === 'principais');
      if (idx !== -1) {
        this.categories.splice(idx + 1, 0, { id: 'pizzas', label: 'Pizzas', icon: '🍕' });
      } else {
        this.categories.push({ id: 'pizzas', label: 'Pizzas', icon: '🍕' });
      }
      this.saveCategories();
    }

    // Assegura que haja pizzas de exemplo no cardápio
    if (!this.menu.some(m => m.category === 'pizzas')) {
      const samplePizzas = [
        {
          id: 'pizza-1',
          name: 'Pizza Pepperoni Nobre',
          category: 'pizzas',
          price: 58.90,
          description: 'Massa artesanal de fermentação lenta 48h, molho de tomate pelati italiano, mozzarella fatiada e pepperoni crocante.',
          image: '/images/hero.jpg',
          tag: 'Mais Pedida 🍕',
          prepTime: '15-20 min',
          available: true
        },
        {
          id: 'pizza-2',
          name: 'Pizza Margherita Clássica',
          category: 'pizzas',
          price: 52.90,
          description: 'Molho de tomate fresco, mozzarella fior di latte, manjericão colhido na hora e azeite extravirgem.',
          image: '/images/bruschetta.jpg',
          tag: 'Tradicional 🇮🇹',
          prepTime: '15-20 min',
          available: true
        }
      ];
      this.menu.push(...samplePizzas);
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

    // Atualiza nome padrão e logotipo se ainda estiverem com o nome antigo
    if (this.profile.name === 'Bistrô Sabor & Arte' || !this.profile.name) {
      this.profile.name = 'CozinhaFy';
    }
    if (!this.profile.logo || this.profile.logo.includes('favicon')) {
      this.profile.logo = '/CozinhaFy.jpg';
    }
    this.saveProfile();

    // Inicializa carrinho
    try {
      this.cart = JSON.parse(localStorage.getItem(STORAGE_KEYS.CART) || '{}');
    } catch {
      this.cart = {};
    }

    // Inicializa solicitações de conta / encerramento
    try {
      this.billRequests = JSON.parse(localStorage.getItem(STORAGE_KEYS.BILL_REQUESTS) || '{}');
    } catch {
      this.billRequests = {};
    }

    // Limpeza automática imediata de pedidos esquecidos e solicitações de conta (> 3 horas)
    this.cleanupOldOrders(3);
    setInterval(() => this.cleanupOldOrders(3), 5 * 60 * 1000);

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
      this.billRequests = JSON.parse(localStorage.getItem(STORAGE_KEYS.BILL_REQUESTS) || '{}');
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

  playBillAlert() {
    if (!this.soundEnabled) return;
    this.initAudio();
    if (!this.audioContext) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Dois sinos brilhantes anunciando solicitação de conta
    const playNote = (freq, start, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.35, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + duration);
    };

    playNote(783.99, now, 0.4);         // Sol (G5)
    playNote(1046.50, now + 0.18, 0.6); // Dó (C6)
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
  getOrdersForSession(table, sessionId, deviceId = null, maxAgeHours = 3) {
    const padTable = String(table).padStart(2, '0');
    const now = Date.now();
    const cutoff = maxAgeHours ? (now - (maxAgeHours * 60 * 60 * 1000)) : 0;

    return this.orders.filter(o => {
      if (o.table !== padTable) return false;

      // Pedidos criados há mais de 3 horas não pertencem à visita ativa do cliente
      if (cutoff && o.createdAt && o.createdAt < cutoff) {
        return false;
      }

      // Se temos sessionId, ela tem precedência estrita
      if (sessionId) {
        return o.sessionId === sessionId;
      }

      // Apenas se não houver sessionId usamos deviceId
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

  // --- SOLICITAÇÃO DE CONTA E ENCERRAMENTO DE COMANDAS (OPÇÃO B - RESTAURANTE) ---
  saveBillRequests() {
    localStorage.setItem(STORAGE_KEYS.BILL_REQUESTS, JSON.stringify(this.billRequests));
  }

  requestBill(table, { paymentMethod = 'cartao_credito', customerName = '', notes = '', sessionId = null, deviceId = null } = {}) {
    const padTable = String(table).padStart(2, '0');
    const total = this.getSessionTotalBill(table, sessionId, deviceId) || this.getTableTotalBill(table);

    const paymentLabels = {
      cartao_credito: 'Cartão de Crédito 💳',
      cartao_debito: 'Cartão de Débito 💳',
      pix: 'Pix 📱',
      dinheiro: 'Dinheiro 💵'
    };

    const requestData = {
      table: padTable,
      paymentMethod,
      paymentMethodLabel: paymentLabels[paymentMethod] || paymentMethod,
      customerName: customerName || 'Cliente',
      notes: notes || '',
      sessionId,
      deviceId,
      total,
      requestedAt: Date.now()
    };

    this.billRequests[padTable] = requestData;
    this.saveBillRequests();

    // Toca som de alerta para o Admin / Cozinha / Garçom
    this.playBillAlert();

    // Notifica todas as abas
    this.broadcast('SYNC', { action: 'BILL_REQUESTED', table: padTable, request: requestData });

    return requestData;
  }

  cancelBillRequest(table) {
    const padTable = String(table).padStart(2, '0');
    if (this.billRequests[padTable]) {
      delete this.billRequests[padTable];
      this.saveBillRequests();
      this.broadcast('SYNC', { action: 'BILL_REQUEST_CANCELLED', table: padTable });
      return true;
    }
    return false;
  }

  getBillRequestForTable(table, sessionId = null) {
    const padTable = String(table).padStart(2, '0');
    const req = this.billRequests[padTable];
    if (!req) return null;

    const THREE_HOURS = 3 * 60 * 60 * 1000;
    // Se a solicitação foi feita há mais de 3 horas, expira e limpa
    if (!req.requestedAt || (Date.now() - req.requestedAt > THREE_HOURS)) {
      delete this.billRequests[padTable];
      this.saveBillRequests();
      return null;
    }

    // Se um sessionId foi informado, a solicitação só é visível para a mesma sessão do cliente
    if (sessionId && req.sessionId && req.sessionId !== sessionId) {
      return null;
    }

    return req;
  }

  getAllBillRequests() {
    return Object.values(this.billRequests);
  }

  closeTableBill(table, { paymentMethod = null, sessionId = null } = {}) {
    const padTable = String(table).padStart(2, '0');

    // Conclui todos os pedidos pendentes da mesa
    let modified = false;
    this.orders.forEach(o => {
      if (o.table === padTable) {
        if (o.status !== 'pronto') {
          o.status = 'pronto';
          o.completedAt = Date.now();
          modified = true;
        }
      }
    });

    if (modified) {
      this.saveOrders();
    }

    // Remove solicitação de conta se houver
    if (this.billRequests[padTable]) {
      delete this.billRequests[padTable];
      this.saveBillRequests();
    }

    // Limpa o carrinho da mesa
    this.clearCart(table);

    // Toca som de confirmação
    this.playReadyBell();

    // Notifica todas as abas (o cliente receberá e resetará a sessão dele!)
    this.broadcast('SYNC', {
      action: 'BILL_CLOSED',
      table: padTable,
      sessionId,
      timestamp: Date.now()
    });

    return true;
  }

  deleteOrder(orderId) {
    const prevLen = this.orders.length;
    this.orders = this.orders.filter(o => o.id !== orderId);
    if (this.orders.length !== prevLen) {
      this.saveOrders();
      this.broadcast('SYNC', { action: 'ORDER_DELETED', orderId });
      if (isSupabaseConfigured && supabase) {
        supabase.from('orders').delete().eq('id', orderId).catch(console.error);
      }
      return true;
    }
    return false;
  }

  cleanupOldOrders(maxHours = 3) {
    const cutoff = Date.now() - (maxHours * 60 * 60 * 1000);
    let modified = false;
    this.orders.forEach(o => {
      if (o.createdAt < cutoff && o.status !== 'pronto') {
        o.status = 'pronto';
        o.completedAt = o.completedAt || Date.now();
        modified = true;
      }
    });

    // Também remove solicitações de conta com mais de 3 horas
    let removedReqs = false;
    Object.keys(this.billRequests).forEach(tbl => {
      if (this.billRequests[tbl]?.requestedAt < cutoff) {
        delete this.billRequests[tbl];
        removedReqs = true;
      }
    });

    if (removedReqs) {
      this.saveBillRequests();
    }

    if (modified) {
      this.saveOrders();
      this.broadcast('SYNC', { action: 'ORDERS_CLEANED' });
    }
    return modified || removedReqs;
  }

  getTablesOverview() {
    const tablesMap = {};
    const now = Date.now();
    const THREE_HOURS = 3 * 60 * 60 * 1000;

    // Constrói mapa das mesas com pedidos
    this.orders.forEach(order => {
      const table = order.table;
      if (!tablesMap[table]) {
        tablesMap[table] = {
          table,
          orders: [],
          total: 0,
          hasPending: false,
          latestOrderTime: 0,
          customerNames: new Set()
        };
      }
      tablesMap[table].orders.push(order);
      tablesMap[table].total += (order.total || 0);
      if (order.status !== 'pronto') {
        tablesMap[table].hasPending = true;
      }
      if (order.createdAt > tablesMap[table].latestOrderTime) {
        tablesMap[table].latestOrderTime = order.createdAt;
      }
      if (order.customerName) {
        tablesMap[table].customerNames.add(order.customerName);
      }
    });

    // Mesas conhecidas padrão para garantir presença mesmo se vazias
    ['01', '02', '03', '04', '05', '06'].forEach(tbl => {
      if (!tablesMap[tbl]) {
        tablesMap[tbl] = {
          table: tbl,
          orders: [],
          total: 0,
          hasPending: false,
          latestOrderTime: 0,
          customerNames: new Set()
        };
      }
    });

    return Object.values(tablesMap).map(t => {
      const billReq = this.getBillRequestForTable(t.table);
      const isOld = t.latestOrderTime > 0 && (now - t.latestOrderTime > THREE_HOURS);
      return {
        ...t,
        customerNames: Array.from(t.customerNames),
        billRequest: billReq,
        isOlderThan3Hours: isOld,
        isOpen: t.orders.length > 0 && (!isOld || t.hasPending || Boolean(billReq))
      };
    }).sort((a, b) => a.table.localeCompare(b.table));
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

  addCategory({ label, icon, active }) {
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
      icon: (icon || '🍽️').trim(),
      active: active !== undefined ? Boolean(active) : true
    };

    this.categories.push(newCategory);
    this.saveCategories();
    this.broadcast('SYNC', { action: 'CATEGORIES_UPDATED', newCategory });

    if (isSupabaseConfigured && supabase) {
      supabase.from('categories').insert(mapCategoryToRow(newCategory, this.categories.length - 1)).catch(console.error);
    }

    return newCategory;
  }

  isCategoryActive(categoryId) {
    if (!categoryId || categoryId === 'todos') return true;
    if (categoryId === 'pratos') {
      const main = this.categories.find(c => c.id === 'principais' || c.id === 'pratos');
      return main ? main.active !== false : true;
    }
    const cat = this.categories.find(c => c.id === categoryId);
    return cat ? cat.active !== false : true;
  }

  toggleCategoryActive(categoryId) {
    const cat = this.categories.find(c => c.id === categoryId);
    if (!cat) return null;

    cat.active = cat.active === false ? true : false;
    this.saveCategories();
    this.broadcast('SYNC', { action: 'CATEGORIES_UPDATED', categoryId });

    if (isSupabaseConfigured && supabase) {
      supabase.from('categories').update({ active: cat.active }).eq('id', categoryId).catch(console.error);
    }

    return cat.active;
  }

  updateCategory(categoryId, { label, icon, active }) {
    const cat = this.categories.find(c => c.id === categoryId);
    if (!cat) return null;

    if (label !== undefined) cat.label = label.trim();
    if (icon !== undefined) cat.icon = (icon || '🍽️').trim();
    if (active !== undefined) cat.active = Boolean(active);

    this.saveCategories();
    this.broadcast('SYNC', { action: 'CATEGORIES_UPDATED', categoryId });

    if (isSupabaseConfigured && supabase) {
      supabase.from('categories').update({ label: cat.label, icon: cat.icon, active: cat.active }).eq('id', categoryId).catch(console.error);
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
      address: updatedData.address !== undefined ? updatedData.address.trim() : this.profile.address,
      serviceFeeEnabled: updatedData.serviceFeeEnabled !== undefined ? Boolean(updatedData.serviceFeeEnabled) : this.profile.serviceFeeEnabled,
      serviceFeePercent: updatedData.serviceFeePercent !== undefined ? parseFloat(updatedData.serviceFeePercent) : (this.profile.serviceFeePercent || 10)
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
