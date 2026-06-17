-- =========================================================
-- Casamento — Backend leve no Supabase (sem servidor próprio)
-- Modelo: 1 tabela com 1 linha (data jsonb) + funções protegidas por senha.
--   data = { "_auth": {"pass": <hash bcrypt>}, "site": {...}, "panel": {...} }
-- Segurança:
--   - RLS ligado e SEM policies → nenhum acesso direto pela API.
--   - Tudo passa por funções SECURITY DEFINER.
--   - get_site() é público (leitura do site). O resto exige a senha de edição.
--   - A senha NUNCA é exposta (get_site só devolve data->'site').
-- Senha inicial: "casa2026"  (troque no painel → Configurações).
-- =========================================================

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.wedding (
  id          int primary key default 1,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  constraint wedding_singleton check (id = 1)
);

alter table public.wedding enable row level security;
-- (intencional: nenhuma policy — acesso só via funções abaixo)

insert into public.wedding (id, data)
values (1, jsonb_build_object(
  '_auth', jsonb_build_object('pass', extensions.crypt('casa2026', extensions.gen_salt('bf'))),
  'site',  '{}'::jsonb,
  'panel', '{}'::jsonb
))
on conflict (id) do nothing;

-- ---------- helper interno: confere a senha ----------
create or replace function public._check_pass(p_pass text)
returns boolean
language sql security definer set search_path = public, extensions as $$
  select exists(
    select 1 from public.wedding
    where id = 1
      and (data->'_auth'->>'pass') = extensions.crypt(p_pass, data->'_auth'->>'pass')
  );
$$;

-- ---------- leitura pública do site ----------
create or replace function public.get_site()
returns jsonb
language sql security definer set search_path = public, extensions as $$
  select coalesce(data->'site', '{}'::jsonb) from public.wedding where id = 1;
$$;

-- ---------- leitura do painel (privado) ----------
create or replace function public.get_panel(p_pass text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public._check_pass(p_pass) then
    raise exception 'senha invalida' using errcode = '28000';
  end if;
  return (select coalesce(data->'panel', '{}'::jsonb) from public.wedding where id = 1);
end; $$;

-- ---------- gravar conteúdo do site ----------
create or replace function public.save_site(p_content jsonb, p_pass text)
returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public._check_pass(p_pass) then
    raise exception 'senha invalida' using errcode = '28000';
  end if;
  update public.wedding
     set data = jsonb_set(data, '{site}', coalesce(p_content, '{}'::jsonb), true),
         updated_at = now()
   where id = 1;
  return true;
end; $$;

-- ---------- gravar dados do painel ----------
create or replace function public.save_panel(p_data jsonb, p_pass text)
returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public._check_pass(p_pass) then
    raise exception 'senha invalida' using errcode = '28000';
  end if;
  update public.wedding
     set data = jsonb_set(data, '{panel}', coalesce(p_data, '{}'::jsonb), true),
         updated_at = now()
   where id = 1;
  return true;
end; $$;

-- ---------- verificar senha (login) ----------
create or replace function public.verify_pass(p_pass text)
returns boolean
language sql security definer set search_path = public, extensions as $$
  select public._check_pass(p_pass);
$$;

-- ---------- trocar senha ----------
create or replace function public.change_pass(p_old text, p_new text)
returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public._check_pass(p_old) then
    return false;
  end if;
  if p_new is null or length(p_new) < 4 then
    raise exception 'senha muito curta';
  end if;
  update public.wedding
     set data = jsonb_set(data, '{_auth,pass}',
                          to_jsonb(extensions.crypt(p_new, extensions.gen_salt('bf'))), true)
   where id = 1;
  return true;
end; $$;

-- ---------- permissões ----------
revoke all on function public._check_pass(text) from public;
grant execute on function public.get_site()                  to anon, authenticated;
grant execute on function public.get_panel(text)             to anon, authenticated;
grant execute on function public.save_site(jsonb, text)      to anon, authenticated;
grant execute on function public.save_panel(jsonb, text)     to anon, authenticated;
grant execute on function public.verify_pass(text)           to anon, authenticated;
grant execute on function public.change_pass(text, text)     to anon, authenticated;
