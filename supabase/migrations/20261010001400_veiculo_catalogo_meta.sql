-- Controle por veículo do catálogo do Facebook/Instagram. Por padrão todo
-- veículo publicado no site entra no catálogo; o lojista pode tirar um
-- carro específico sem tirá-lo do site.

begin;

alter table public.vehicles
  add column if not exists catalogo_meta boolean not null default true;

commit;
