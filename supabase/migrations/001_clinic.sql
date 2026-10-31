-- Dentim MVP: uma clínica por projeto Supabase.
-- Execute no SQL Editor do seu projeto. Sem dados de demonstração em produção.
begin;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null check (char_length(name) between 2 and 160),
 email text not null,
 role text not null default 'dentist' check (role in ('admin','dentist','reception')),
 status text not null default 'pending' check (status in ('active','pending','suspended')),
 finance boolean not null default false,
 color text not null default '#d5e7cf',
 created_at timestamptz not null default now()
);
create table if not exists public.clinic_state (
 id text primary key check (id='main'),
 revision bigint not null default 0,
 data jsonb not null,
 updated_at timestamptz not null default now()
);
insert into public.clinic_state (id,data) values ('main', '{"patients":[],"appointments":[],"teeth":[],"treatments":[],"evolutions":[],"invoices":[],"payments":[],"expenses":[],"notes":[],"members":[],"audit":[]}') on conflict (id) do nothing;

-- Usuários recém-cadastrados nunca recebem acesso ou cargo escolhido pelo cliente.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.profiles(id,name,email,role,status,finance)
 values(new.id,substring(coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''),'Novo profissional') for 160),coalesce(new.email,''),'dentist','pending',false);
 return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.touch_clinic_state() returns trigger
language plpgsql set search_path=public,pg_temp as $$ begin new.updated_at=now();return new;end; $$;
drop trigger if exists on_clinic_state_update on public.clinic_state;
create trigger on_clinic_state_update before update on public.clinic_state for each row execute function public.touch_clinic_state();

alter table public.profiles enable row level security;
alter table public.clinic_state enable row level security;
revoke all on public.clinic_state from anon,authenticated;
revoke all on public.profiles from anon,authenticated;
grant select on public.profiles to authenticated;
grant all on public.clinic_state to service_role;
grant all on public.profiles to service_role;
drop policy if exists own_profile_read on public.profiles;
create policy own_profile_read on public.profiles for select to authenticated using (id=auth.uid());
-- O backend é o único canal para registros clínicos; filtra permissões e pacientes.
-- Dados completos nunca são liberados diretamente ao navegador pelo PostgREST.

-- Pair the entire data revision with the permission snapshot atomically.
-- Separate HTTP reads can race a suspension and must not be used for authorization.
create or replace function public.load_clinic_state() returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('revision',c.revision,'data',c.data,'profiles',(
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'email',p.email,'role',p.role,'status',p.status,'finance',p.finance,'color',p.color)),'[]'::jsonb)
  from public.profiles p
 )) from public.clinic_state c where c.id='main';
$$;
revoke all on function public.load_clinic_state() from public,anon,authenticated;
grant execute on function public.load_clinic_state() to service_role;

-- Invalidate stale writes even when a profile is edited from the SQL dashboard.
create or replace function public.invalidate_clinic_permission_revision() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.clinic_state set revision=revision+1 where id='main';
 return null;
end;
$$;
drop trigger if exists on_profile_permission_change on public.profiles;
create trigger on_profile_permission_change after insert or update or delete on public.profiles for each statement execute function public.invalidate_clinic_permission_revision();
revoke all on function public.invalidate_clinic_permission_revision() from public,anon,authenticated;

create or replace function public.admin_update_member(actor_id uuid,target_id uuid,patch jsonb) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor public.profiles; target public.profiles; next_role text; next_status text; next_finance boolean; next_name text;
begin
 perform pg_advisory_xact_lock(731992001);
 select * into actor from public.profiles where id=actor_id;
 if actor.id is null or actor.role<>'admin' or actor.status<>'active' then raise exception 'Acesso negado'; end if;
 select * into target from public.profiles where id=target_id;
 if target.id is null then raise exception 'Usuário não encontrado'; end if;
 next_role=coalesce(patch->>'role',target.role);
 next_status=coalesce(patch->>'status',target.status);
 next_finance=coalesce((patch->>'finance')::boolean,target.finance);
 next_name=coalesce(patch->>'name',target.name);
 if target.id=actor.id and (next_role<>'admin' or next_status<>'active') then raise exception 'Não remova seu próprio acesso';end if;
 if target.role='admin' and target.status='active' and (next_role<>'admin' or next_status<>'active') and (select count(*) from public.profiles where role='admin' and status='active')<=1 then raise exception 'Mantenha um administrador ativo';end if;
 update public.profiles set name=next_name,role=next_role,status=next_status,finance=next_finance where id=target_id;
 update public.clinic_state set data=jsonb_set(data,'{audit}',jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'action','updateMember','authorId',actor_id::text,'createdAt',now(),'entityId',target_id::text)) || coalesce(data->'audit','[]'::jsonb)),revision=revision+1 where id='main';
end;
$$;
revoke all on function public.admin_update_member(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.admin_update_member(uuid,uuid,jsonb) to service_role;
revoke all on function public.handle_new_user() from public,anon,authenticated;
commit;

-- Depois de cadastrar a primeira conta e confirmar o e-mail, promova seu UUID
-- no SQL Editor. Substitua APENAS o UUID abaixo (não execute com o placeholder):
-- update public.profiles set role='admin',status='active',finance=true where id='UUID-DA-SUA-CONTA';
