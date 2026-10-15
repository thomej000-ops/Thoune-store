-- Thoune Store v1119 — estoque infinito sem alterar o fluxo Pix.
-- Execute UMA VEZ no Supabase SQL Editor antes de publicar o ZIP.
-- A migração altera as funções existentes mantendo o restante do código original.
-- Se alguma estrutura não corresponder ao esperado, a transação falha sem aplicar mudanças parciais.

BEGIN;

DO $migration$
DECLARE
  v_signature regprocedure;
  v_definition text;
  v_updated text;
  v_signatures regprocedure[] := ARRAY[
    'public.create_guest_order(jsonb,text,text,text)'::regprocedure,
    'public.create_order(jsonb)'::regprocedure,
    'public.create_order(jsonb,text,text)'::regprocedure
  ];
  v_changed boolean;
BEGIN
  FOREACH v_signature IN ARRAY v_signatures LOOP
    v_definition := pg_get_functiondef(v_signature);

    v_updated := regexp_replace(
      v_definition,
      $pattern$if\s+v_quantity\s*>\s*v_stock\s+then\s+raise\s+exception\s+'Estoque insuficiente para: %',\s*v_product_name\s*;\s*end\s+if\s*;$pattern$,
      '',
      'gi'
    );

    IF v_updated = v_definition THEN
      RAISE EXCEPTION 'Não encontrei o bloqueio de estoque esperado em %. Nenhuma alteração será aplicada.', v_signature;
    END IF;

    EXECUTE v_updated;
  END LOOP;

  -- Ao aprovar o Pix, não descontar estoque; manter autenticação de admin,
  -- validação do pedido, confirmação do pagamento e mudança para awaiting_delivery.
  v_signature := 'public.confirm_payment(uuid)'::regprocedure;
  v_definition := pg_get_functiondef(v_signature);
  v_updated := regexp_replace(
    v_definition,
    $pattern$for\s+v_item\s+in\s+select\s+\*\s+from\s+public\.order_items\s+where\s+order_id\s*=\s*p_order_id\s+loop\s+update\s+public\.products\s+set\s+stock\s*=\s*stock\s*-\s*v_item\.quantity\s*,\s*updated_at\s*=\s*now\(\)\s+where\s+id\s*=\s*v_item\.product_id\s+and\s+active\s*=\s*true\s+and\s+stock\s*>=\s*v_item\.quantity\s*;\s*if\s+not\s+found\s+then\s+raise\s+exception\s+'Estoque insuficiente para: %',\s*v_item\.product_name\s*;\s*end\s+if\s*;\s*end\s+loop\s*;$pattern$,
    '',
    'gi'
  );

  IF v_updated = v_definition THEN
    RAISE EXCEPTION 'Não encontrei o bloco de desconto de estoque esperado em confirm_payment(uuid). Nenhuma alteração será aplicada.';
  END IF;

  EXECUTE v_updated;
END;
$migration$;

COMMIT;

-- Verificação após execução: todas as funções abaixo devem retornar false para bloqueio.
SELECT p.oid::regprocedure AS assinatura,
       p.prosrc ILIKE '%Estoque insuficiente para:%' AS ainda_tem_bloqueio_estoque,
       p.prosrc ILIKE '%stock = stock - v_item.quantity%' AS ainda_desconta_estoque_na_aprovacao
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('create_guest_order','create_order','confirm_payment')
ORDER BY p.proname, p.oid::regprocedure::text;
