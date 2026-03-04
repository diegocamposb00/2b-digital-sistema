-- Ejecutá este SQL en Supabase → SQL Editor → New query

-- Tabla principal de clientes
create table clientes (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  nombre text not null,
  responsable text,
  plan_mensual text,
  ingreso_mensual numeric,
  diagnostico_vendido numeric,
  riesgo_final text default '—'
);

-- Tabla de auditorías (guarda el checklist completo como JSON)
create table auditorias (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  cliente_id uuid references clientes(id) on delete cascade,
  items jsonb not null default '{}'
);

-- Tabla de cotizaciones (guarda las variables como JSON)
create table cotizaciones (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  cliente_id uuid references clientes(id) on delete cascade,
  variables jsonb not null default '{}'
);

-- Permisos para acceso público (ajustá según necesites)
alter table clientes    enable row level security;
alter table auditorias  enable row level security;
alter table cotizaciones enable row level security;

create policy "Acceso total" on clientes    for all using (true) with check (true);
create policy "Acceso total" on auditorias  for all using (true) with check (true);
create policy "Acceso total" on cotizaciones for all using (true) with check (true);
