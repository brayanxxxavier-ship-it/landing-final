-- =========================================================================
-- Luxury Galaxy — Exótico Versión
-- Esquema de Base de Datos y Políticas de Seguridad RLS en Supabase
-- Limpio, sin sentencias DROP, listo para primera ejecución en producción
-- =========================================================================

-- 1. Extensiones necesarias
create extension if not exists pgcrypto;

-- 2. Tabla de Catálogo de Vehículos
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  internal_id text unique not null,
  name text not null,
  description text not null,
  image_url text,
  price_cop numeric(18,2) not null default 0,
  price_usd numeric(18,2) not null default 0,
  status text not null default 'consulta' check (status in ('preventa','consulta','agotado','oculto')),
  is_public boolean not null default true,
  display_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Tabla de Solicitudes de Preventa
create table if not exists public.preorders (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text not null,
  age integer not null check (age between 18 and 120),
  document_type text not null check (document_type in ('CC','CE','PAS','NIT','OTRO')),
  document_number text not null,
  selected_vehicle_ids text[] not null check (cardinality(selected_vehicle_ids) > 0),
  message text not null default '',
  tracking_code char(6) not null unique,
  status text not null default 'recibida' check (status in ('recibida','en_revision','contactado','confirmada','cancelada')),
  created_at timestamptz not null default now()
);

-- 4. Tabla de Peticiones, Quejas, Reclamos y Sugerencias (PQRS)
create table if not exists public.pqrs (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('peticion','queja','reclamo','sugerencia')),
  full_name text not null,
  email text not null,
  phone text,
  document_type text,
  document_number text,
  subject text not null,
  message text not null,
  tracking_code char(6) not null unique,
  status text not null default 'radicado' check (status in ('radicado','en_tramite','respondido','cerrado')),
  created_at timestamptz not null default now()
);

-- 5. Perfiles de Administradores
create table if not exists public.admin_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','editor')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Asegurar columnas si la tabla ya existía
alter table if exists public.admin_profiles add column if not exists is_active boolean not null default true;
alter table if exists public.admin_profiles add column if not exists updated_at timestamptz not null default now();

-- 6. Índices para optimización de consultas
create index if not exists idx_vehicles_public_status on public.vehicles(is_public, status);
create index if not exists idx_vehicles_display_order on public.vehicles(display_order);
create index if not exists idx_preorders_created_at on public.preorders(created_at desc);
create index if not exists idx_preorders_tracking_code on public.preorders(tracking_code);
create index if not exists idx_pqrs_created_at on public.pqrs(created_at desc);
create index if not exists idx_pqrs_tracking_code on public.pqrs(tracking_code);
create index if not exists idx_admin_profiles_user on public.admin_profiles(user_id, role, is_active);

-- 7. Activación de Seguridad por Filas (Row Level Security)
alter table public.vehicles enable row level security;
alter table public.preorders enable row level security;
alter table public.pqrs enable row level security;
alter table public.admin_profiles enable row level security;

-- 8. Función para comprobación de rol administrador activo (blindada con search_path)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.admin_profiles
    where user_id = auth.uid()
      and role in ('admin','editor')
      and is_active = true
  );
$$;

-- 9. Políticas de Seguridad RLS Limpias

-- Vehículos: Lectura pública de autos activos
create policy "public_read_active_vehicles"
on public.vehicles for select
to anon, authenticated
using (is_public = true and status <> 'oculto');

-- Vehículos: Gestión integral exclusiva para administradores autenticados y activos
create policy "admins_manage_vehicles"
on public.vehicles for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Preventas: Inserción pública permitida para que usuarios anónimos registren su solicitud
create policy "public_insert_preorders"
on public.preorders for insert
to anon, authenticated
with check (true);

-- Preventas: Lectura y gestión exclusiva para administradores autorizados
create policy "admins_read_manage_preorders"
on public.preorders for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- PQRS: Inserción pública permitida para radicar peticiones y quejas
create policy "public_insert_pqrs"
on public.pqrs for insert
to anon, authenticated
with check (true);

-- PQRS: Lectura y resolución exclusiva para administradores autorizados
create policy "admins_read_manage_pqrs"
on public.pqrs for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Perfiles de Administradores: Lectura propia o por administradores autorizados
create policy "admins_read_profiles"
on public.admin_profiles for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

-- Perfiles de Administradores: Inserción restringida EXCLUSIVAMENTE a administradores activos existentes
-- (Se prohíbe la auto-escalación por parte de usuarios comunes)
create policy "admins_insert_profiles"
on public.admin_profiles for insert
to authenticated
with check (public.is_admin());

-- Perfiles de Administradores: Actualización y eliminación exclusiva para administradores
create policy "admins_manage_profiles"
on public.admin_profiles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins_delete_profiles"
on public.admin_profiles for delete
to authenticated
using (public.is_admin());

-- =========================================================================
-- 10. Procedimiento Seguro para Registro y Creación de Admin en la Tabla
-- Blindado contra inyección SQL mediante consultas parametrizadas
-- =========================================================================

create or replace function public.register_admin_user(
  target_email text,
  target_role text default 'admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  found_user_id uuid;
  result_record public.admin_profiles%rowtype;
begin
  -- Validación estricta de formato de correo (Anti SQL Injection)
  if target_email is null or target_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
    return jsonb_build_object('success', false, 'error', 'Formato de correo electrónico inválido.');
  end if;

  -- Validación de rol permitido
  if target_role not in ('admin', 'editor') then
    return jsonb_build_object('success', false, 'error', 'Rol no permitido. Debe ser admin o editor.');
  end if;

  -- Búsqueda segura y parametrizada en auth.users
  select id into found_user_id
  from auth.users
  where lower(email) = lower(trim(target_email))
  limit 1;

  if found_user_id is null then
    return jsonb_build_object(
      'success', false,
      'error', 'El usuario no existe en Supabase Auth. Primero créalo en Supabase Dashboard -> Authentication -> Users.'
    );
  end if;

  -- Inserción / actualización segura en la tabla admin_profiles con is_active = true
  insert into public.admin_profiles (user_id, email, role, is_active, updated_at)
  values (found_user_id, lower(trim(target_email)), target_role, true, now())
  on conflict (user_id) do update set
    email = excluded.email,
    role = excluded.role,
    is_active = true,
    updated_at = now()
  returning * into result_record;

  return jsonb_build_object(
    'success', true,
    'message', 'Usuario registrado con éxito en la tabla admin_profiles con rol activo.',
    'user_id', result_record.user_id,
    'email', result_record.email,
    'role', result_record.role,
    'is_active', result_record.is_active
  );
end;
$$;

-- =========================================================================
-- 11. Actualización No Destructiva para Tablas Existentes (CERO SENTENCIAS DROP)
-- Ejecutar estas sentencias si las tablas ya fueron creadas previamente.
-- No borra ni altera datos existentes.
-- =========================================================================

-- Asegurar que la columna image_url existe para almacenar fotos o Data URLs
alter table if exists public.vehicles add column if not exists image_url text;

-- Asegurar visibilidad pública y orden
alter table if exists public.vehicles add column if not exists is_public boolean not null default true;
alter table if exists public.vehicles add column if not exists display_order integer not null default 1;

-- =========================================================================
-- 12. Instrucciones para dar de alta al administrador en Supabase:
-- 1. Ve a tu consola de Supabase -> Authentication -> Users.
-- 2. Haz clic en "Add User" -> "Create user" y marca "Auto Confirm User".
-- 3. Ingresa el correo de tu administrador y su contraseña privada.
-- 4. Asigna el rol administrativo ejecutando en el SQL Editor de Supabase:
--    select public.register_admin_user('correo_del_admin@tu-empresa.com', 'admin');
-- =========================================================================
