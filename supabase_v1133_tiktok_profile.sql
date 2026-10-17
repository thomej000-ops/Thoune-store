-- Thoune Store v1133 — perfil TikTok do cliente
-- Objetivo: guardar apenas os dados úteis para contato e avaliações.
-- Não altera o fluxo de Pix, fila, estoque ou pedidos existentes.

BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tiktok_display_name text;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tiktok_profile_url text;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tiktok_avatar text;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS tiktok_display_name text;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS tiktok_profile_url text;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS tiktok_avatar text;

COMMIT;

-- Salva o resultado da conferência do perfil no pedido.
-- Não é uma autenticação de identidade: serve apenas para registrar o perfil
-- que o próprio cliente informou para contato.
DROP FUNCTION IF EXISTS public.update_guest_tiktok_profile(uuid,text,text,text,text);

CREATE OR REPLACE FUNCTION public.update_guest_tiktok_profile(
  p_order_id uuid,
  p_tiktok_username text,
  p_tiktok_display_name text,
  p_tiktok_profile_url text,
  p_tiktok_avatar text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%rowtype;
  v_username text := lower(regexp_replace(trim(coalesce(p_tiktok_username,'')), '^@', ''));
  v_order_username text;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Pedido não informado.';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  v_order_username := lower(regexp_replace(trim(coalesce(v_order.tiktok_username,'')), '^@', ''));
  IF v_username = '' OR v_username <> v_order_username THEN
    RAISE EXCEPTION 'O TikTok informado não corresponde ao pedido.';
  END IF;

  UPDATE public.orders
  SET
    tiktok_display_name = NULLIF(trim(coalesce(p_tiktok_display_name,'')), ''),
    tiktok_profile_url = NULLIF(trim(coalesce(p_tiktok_profile_url,'')), ''),
    tiktok_avatar = NULLIF(trim(coalesce(p_tiktok_avatar,'')), ''),
    updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.update_guest_tiktok_profile(uuid,text,text,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.update_guest_tiktok_profile(uuid,text,text,text,text) TO anon, authenticated;

-- Atualiza a função de avaliação para copiar o nome/link/foto já salvos no pedido.
DROP FUNCTION IF EXISTS public.submit_guest_review(uuid,text,integer,text);

CREATE OR REPLACE FUNCTION public.submit_guest_review(
  p_order_id uuid,
  p_tiktok_username text,
  p_rating integer,
  p_text text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%rowtype;
  v_tiktok text := trim(coalesce(p_tiktok_username, ''));
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Pedido não informado.';
  END IF;
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'A nota deve estar entre 1 e 5.';
  END IF;
  IF p_text IS NULL OR length(trim(p_text)) < 3 THEN
    RAISE EXCEPTION 'Escreva pelo menos 3 caracteres.';
  END IF;
  IF v_tiktok = '' THEN
    RAISE EXCEPTION 'Usuário do TikTok não informado.';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
    AND status = 'delivered';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Só é possível avaliar pedidos entregues.';
  END IF;

  IF lower(regexp_replace(coalesce(v_order.tiktok_username, ''), '^@', ''))
     <> lower(regexp_replace(v_tiktok, '^@', '')) THEN
    RAISE EXCEPTION 'O usuário do TikTok não corresponde ao pedido.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.reviews WHERE order_id = p_order_id) THEN
    RAISE EXCEPTION 'Este pedido já possui uma avaliação.';
  END IF;

  INSERT INTO public.reviews (
    customer_id,
    order_id,
    tiktok_username,
    tiktok_display_name,
    tiktok_profile_url,
    tiktok_avatar,
    rating,
    text,
    status
  )
  VALUES (
    NULL,
    p_order_id,
    v_tiktok,
    v_order.tiktok_display_name,
    v_order.tiktok_profile_url,
    v_order.tiktok_avatar,
    p_rating,
    trim(p_text),
    'pending'
  );

  RETURN jsonb_build_object('success', true, 'status', 'pending');
END;
$$;

REVOKE ALL ON FUNCTION public.submit_guest_review(uuid,text,integer,text) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_guest_review(uuid,text,integer,text) TO anon, authenticated;

SELECT 'v1133 TikTok: OK' AS status;
