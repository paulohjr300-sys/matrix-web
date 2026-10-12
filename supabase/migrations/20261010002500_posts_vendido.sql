-- Posts do Instagram/Facebook de carro vendido: o painel marca "VENDIDO".
-- vendido_em: post já marcado (pelo painel, ou pelo lojista depois de
-- editar pelo app). vendido_erro: por que não deu para editar pela API (o
-- Instagram não permite editar a legenda de post publicado).

alter table public.posts_redes
  add column if not exists vendido_em timestamptz,
  add column if not exists vendido_erro text;
