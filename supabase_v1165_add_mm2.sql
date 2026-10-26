-- Thoune Store v1165: adicionar MM2 sem alterar os produtos FTF existentes.
-- Execute no Supabase SQL Editor antes de publicar o novo site.
BEGIN;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS game text NOT NULL DEFAULT 'ftf';
UPDATE public.products SET game = 'ftf' WHERE game IS NULL OR btrim(game) = '';
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_game_check;
ALTER TABLE public.products ADD CONSTRAINT products_game_check CHECK (game = ANY (ARRAY['ftf','mm2']::text[]));
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_category_check;
ALTER TABLE public.products ADD CONSTRAINT products_category_check CHECK (
  (game = 'ftf' AND category = ANY (ARRAY['Lendária','Épica','Rara','Comum','Exclusiva','Atualização']::text[])) OR
  (game = 'mm2' AND category = ANY (ARRAY['Godly','Ancient','Chroma','Vintage','Unique','Legendary','Rare','Uncommon','Common','Seasonal']::text[]))
);
CREATE INDEX IF NOT EXISTS products_game_active_sort_idx ON public.products (game, active, sort_order, name);
COMMIT;
