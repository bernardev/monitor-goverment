CREATE TABLE "consulta"."municipio" (
	"codigo_ibge" char(7) PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"uf" char(2) NOT NULL,
	"nome_busca" text GENERATED ALWAYS AS (lower(translate(nome, 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ', 'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn'))) STORED
);
--> statement-breakpoint
ALTER TABLE "consulta"."emenda" ADD COLUMN "municipios" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "consulta"."obra" ADD COLUMN "municipios" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "consulta"."obra" ADD COLUMN "nome_busca" text GENERATED ALWAYS AS (lower(translate(nome, 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ', 'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn'))) STORED;--> statement-breakpoint
ALTER TABLE "consulta"."parlamentar" ADD COLUMN "nome_busca" text GENERATED ALWAYS AS (lower(translate(nome, 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ', 'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn'))) STORED;--> statement-breakpoint
CREATE INDEX "municipio_por_uf" ON "consulta"."municipio" USING btree ("uf");--> statement-breakpoint
CREATE INDEX "emenda_por_municipio" ON "consulta"."emenda" USING gin ("municipios");--> statement-breakpoint
CREATE INDEX "obra_por_municipio" ON "consulta"."obra" USING gin ("municipios");--> statement-breakpoint
-- As colunas novas saem do que a projeção já guarda. A tabela `municipio` é uma projeção nova:
-- alimente-a reentregando os eventos de emenda e de obra (apps/worker, comando reentregar).
UPDATE "consulta"."emenda" SET "municipios" = ARRAY(
	SELECT DISTINCT d->>'municipioIbge' FROM jsonb_array_elements("destinacoes") d
	WHERE d->>'municipioIbge' IS NOT NULL ORDER BY 1
);--> statement-breakpoint
UPDATE "consulta"."obra" SET "municipios" = ARRAY(
	SELECT m->>'codigoIbge' FROM jsonb_array_elements("estado"->'municipios') m ORDER BY 1
);
