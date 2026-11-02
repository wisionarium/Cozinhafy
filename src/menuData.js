export const INITIAL_MENU = [
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
  },
  {
    id: 'prato-1',
    name: 'Bife de Chorizo Nobre',
    category: 'principais',
    price: 78.90,
    description: 'Corte nobre grelhado na brasa, servido com batatas rústicas douradas, chimichurri artesanal e aspargos frescos.',
    image: '/images/hero.jpg',
    tag: 'Mais Pedido ⭐',
    prepTime: '20-25 min',
    available: true
  },
  {
    id: 'prato-2',
    name: 'Burger Gourmet Prime',
    category: 'principais',
    price: 46.50,
    description: 'Blend bovino 180g de angus, cheddar inglês maturado, bacon caramelizado no melaço e maionese trufada no pão brioche.',
    image: '/images/burger.jpg',
    tag: 'Destaque 🔥',
    prepTime: '15-20 min',
    available: true
  },
  {
    id: 'prato-3',
    name: 'Fettuccine Alfredo com Pollo',
    category: 'principais',
    price: 54.00,
    description: 'Massa fresca artesanal envolta em molho aveludado de parmesão grana padano, tiras de peito grelhado e tomatinhos confit.',
    image: '/images/pasta.jpg',
    tag: 'Chef Choice 👨‍🍳',
    prepTime: '15-20 min',
    available: true
  },
  {
    id: 'entrada-1',
    name: 'Bruschetta Pomodoro & Mozzarella',
    category: 'entradas',
    price: 34.00,
    description: 'Pão de fermentação natural tostado, tomates heirloom marinados em azeite extravirgem, mozzarella de búfala e redução balsâmica.',
    image: '/images/bruschetta.jpg',
    tag: 'Vegetariano 🍃',
    prepTime: '10-12 min',
    available: true
  },
  {
    id: 'sobremesa-1',
    name: 'Petit Gâteau Chocolat Noir',
    category: 'sobremesas',
    price: 32.00,
    description: 'Bolo quente com recheio cremoso fluído de chocolate belga 70%, servido com sorvete de baunilha Bourbon e framboesas frescas.',
    image: '/images/dessert.jpg',
    tag: 'Irresistível 🍫',
    prepTime: '12-15 min',
    available: true
  },
  {
    id: 'bebida-1',
    name: 'Soda Artesanal de Maracujá & Menta',
    category: 'bebidas',
    price: 18.50,
    description: 'Maracujá fresco macerado com hortelã orgânica, água gaseificada premium, gelo cristalino e fatia de laranja bahia.',
    image: '/images/drink.jpg',
    tag: 'Refrescante 🍹',
    prepTime: '5 min',
    available: true
  },
  {
    id: 'bebida-2',
    name: 'Vinho Tinto Reserva Cabernet (Taça)',
    category: 'bebidas',
    price: 28.00,
    description: 'Vinho encorpado com notas de frutas vermelhas e carvalho tostado. Safra especial 2022.',
    image: '/images/hero.jpg',
    tag: 'Harmonização 🍷',
    prepTime: '3 min',
    available: true
  },
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
  },
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

export const INITIAL_CATEGORIES = [
  { id: 'cafe', label: 'Café', icon: '☕' },
  { id: 'principais', label: 'Pratos', icon: '🍽️' },
  { id: 'bebidas', label: 'Bebidas', icon: '🍹' },
  { id: 'sobremesas', label: 'Sobremesa', icon: '🍨' },
  { id: 'pizzas', label: 'Pizzas', icon: '🍕' },
  { id: 'almoco', label: 'Almoço', icon: '🍛' },
  { id: 'entradas', label: 'Entradas', icon: '🥖' }
];

export const CATEGORIES = [
  { id: 'todos', label: 'Todos', icon: '🍽️' },
  ...INITIAL_CATEGORIES
];

