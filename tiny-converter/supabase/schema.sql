-- Schema do Conversor Tiny (Lei Atual Jeans)
-- Rode este arquivo inteiro no SQL Editor do seu projeto Supabase (Database > SQL Editor).
-- Pode rodar de novo com segurança: todos os comandos usam "if not exists" / "or replace".

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────
-- Mapeamentos de coluna salvos (para não remapear toda vez que o layout
-- de uma planilha de origem se repete de uma coleção/temporada para outra).
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists mapping_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  file_type text not null check (file_type in ('produtos', 'pedidos')),
  mapping jsonb not null,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- Paletas de cores por coleção/temporada (código numérico -> nome da cor).
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists color_palettes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  entries jsonb not null, -- [{ "code": "1", "name": "Branco" }, ...]
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- Paletas de tamanho em letra (P/M/G/GG/G1/G2 -> código de 2 dígitos do SKU).
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists size_palettes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  entries jsonb not null, -- [{ "label": "P", "code": "01" }, ...]
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- Clientes (para achar CNPJ/CPF e Inscrição Estadual ao converter pedidos).
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  nome_fantasia text not null,
  razao_social text,
  cnpj_ou_cpf text,
  ie text,
  endereco text,
  cidade text,
  bairro text,
  uf text,
  cep text,
  email text,
  telefone text,
  contato text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists clients_nome_fantasia_idx on clients (lower(nome_fantasia));

-- ─────────────────────────────────────────────────────────────────────────
-- Catálogo de produtos (gerado pela conversão de Cadastro de Produtos).
-- Usado, na conversão de Pedidos, para conferir se o preço digitado pelo
-- representante bate com o preço cadastrado.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  sku text not null,
  parent_sku text,
  descricao text not null,
  preco numeric,
  collection text, -- ex: "Verão 27"
  raw jsonb,
  created_at timestamptz not null default now()
);
create index if not exists products_sku_idx on products (sku);
create index if not exists products_parent_sku_idx on products (parent_sku);

-- ─────────────────────────────────────────────────────────────────────────
-- Log simples de cada conversão feita (auditoria/histórico).
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists conversion_logs (
  id uuid primary key default gen_random_uuid(),
  file_type text not null,
  file_name text,
  row_count int,
  warning_count int,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- Segurança: só usuários autenticados (login por e-mail/senha do Supabase
-- Auth) podem ler ou escrever. Crie os usuários da sua equipe em
-- Authentication > Users no painel do Supabase.
-- ─────────────────────────────────────────────────────────────────────────
alter table mapping_presets enable row level security;
alter table color_palettes enable row level security;
alter table size_palettes enable row level security;
alter table clients enable row level security;
alter table products enable row level security;
alter table conversion_logs enable row level security;

drop policy if exists "authenticated full access" on mapping_presets;
create policy "authenticated full access" on mapping_presets
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on color_palettes;
create policy "authenticated full access" on color_palettes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on size_palettes;
create policy "authenticated full access" on size_palettes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on clients;
create policy "authenticated full access" on clients
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on products;
create policy "authenticated full access" on products
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on conversion_logs;
create policy "authenticated full access" on conversion_logs
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
