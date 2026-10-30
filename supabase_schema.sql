-- ==========================================================
-- SCRIPT DE CRIAÇÃO DO BANCO DE DADOS EM TEMPO REAL (SUPABASE)
-- Bistrô Sabor & Arte - Sistema de Pedidos & KDS
-- ==========================================================
-- Como usar:
-- 1. Acesse seu painel no Supabase (https://supabase.com)
-- 2. Vá no menu lateral esquerdo em "SQL Editor"
-- 3. Clique em "New Query", cole todo este código e clique em "Run" (Executar)
-- ==========================================================

-- 1. TABELA DE PEDIDOS (COMANDAS EM TEMPO REAL)
create table if not exists public.orders (
  id text primary key,
  order_number integer not null,
  table_num text not null,
  customer_name text not null,
  items jsonb not null default '[]'::jsonb,
  total numeric(10, 2) not null default 0.00,
  status text not null default 'recebido' check (status in ('recebido', 'em_preparo', 'pronto')),
  device_id text,
  session_id text,
  created_at timestamptz default now(),
  started_at timestamptz,
  completed_at timestamptz
);

-- 2. TABELA DE ITENS DO CARDÁPIO
create table if not exists public.menu_items (
  id text primary key,
  name text not null,
  description text default '',
  price numeric(10, 2) not null default 0.00,
  category text not null,
  image text default '',
  tag text default '',
  available boolean not null default true,
  has_custom_options boolean not null default false,
  options jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

-- 3. TABELA DE CATEGORIAS DO CARDÁPIO
create table if not exists public.categories (
  id text primary key,
  label text not null,
  icon text not null default '🍽️',
  order_index integer default 0
);

-- 4. TABELA DE PERFIL DO RESTAURANTE
create table if not exists public.restaurant_profile (
  id text primary key default 'main',
  name text not null default 'Bistrô Sabor & Arte',
  tagline text default '✨ Experiência Gastronômica',
  hero_banner text default '/images/hero.jpg',
  logo text default '',
  phone text default '(11) 98765-4321',
  address text default 'Rua das Flores, 123',
  updated_at timestamptz default now()
);

-- 5. HABILITAR ROW LEVEL SECURITY (RLS) COM POLÍTICAS PÚBLICAS
alter table public.orders enable row level security;
alter table public.menu_items enable row level security;
alter table public.categories enable row level security;
alter table public.restaurant_profile enable row level security;

-- Políticas para orders (leitura, criação e atualização por clientes e cozinha)
drop policy if exists "Public orders select" on public.orders;
create policy "Public orders select" on public.orders for select using (true);

drop policy if exists "Public orders insert" on public.orders for insert with check (true);
create policy "Public orders insert" on public.orders for insert with check (true);

drop policy if exists "Public orders update" on public.orders for update using (true);
create policy "Public orders update" on public.orders for update using (true);

-- Políticas para menu_items
drop policy if exists "Public menu select" on public.menu_items;
create policy "Public menu select" on public.menu_items for select using (true);

drop policy if exists "Public menu all" on public.menu_items;
create policy "Public menu all" on public.menu_items for all using (true);

-- Políticas para categories
drop policy if exists "Public categories select" on public.categories;
create policy "Public categories select" on public.categories for select using (true);

drop policy if exists "Public categories all" on public.categories;
create policy "Public categories all" on public.categories for all using (true);

-- Políticas para restaurant_profile
drop policy if exists "Public profile select" on public.restaurant_profile;
create policy "Public profile select" on public.restaurant_profile for select using (true);

drop policy if exists "Public profile all" on public.restaurant_profile;
create policy "Public profile all" on public.restaurant_profile for all using (true);

-- 6. HABILITAR SINCRONIZAÇÃO EM TEMPO REAL (REALTIME REPLICATION)
-- Isso permite que a tela da cozinha receba novos pedidos no milissegundo em que o cliente envia!
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.menu_items;
alter publication supabase_realtime add table public.categories;
alter publication supabase_realtime add table public.restaurant_profile;

-- 7. DADOS INICIAIS DE PERFIL (SEED)
insert into public.restaurant_profile (id, name, tagline, hero_banner, logo, phone, address)
values (
  'main', 
  'Bistrô Sabor & Arte', 
  '✨ Experiência Gastronômica', 
  '/images/hero.jpg', 
  '', 
  '(11) 98765-4321', 
  'Rua das Flores, 123'
)
on conflict (id) do nothing;
