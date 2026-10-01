-- Thoune Store v1018
alter table public.store_settings add column if not exists delivery_bot_url text;

create or replace view public.public_store_settings as
select
  id, online, pix_key, delivery_bot_username, join_open,
  discount_percent, discount_active, updated_at, delivery_bot_url
from public.store_settings;

drop function if exists public.submit_customer_review(integer, text);
create or replace function public.submit_customer_review(p_rating integer,p_text text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user_id uuid:=auth.uid(); v_username text;
begin
 if v_user_id is null then raise exception 'Usuário não autenticado'; end if;
 if p_rating<1 or p_rating>5 then raise exception 'A nota deve estar entre 1 e 5'; end if;
 if p_text is null or length(trim(p_text))<3 then raise exception 'Escreva uma avaliação antes de enviar'; end if;
 select tiktok_username into v_username from public.profiles where id=v_user_id;
 insert into public.reviews(tiktok_username,rating,text,status) values(coalesce(v_username,'Cliente'),p_rating,trim(p_text),'pending');
 return jsonb_build_object('success',true);
end; $$;
revoke all on function public.submit_customer_review(integer,text) from public;
grant execute on function public.submit_customer_review(integer,text) to authenticated;
