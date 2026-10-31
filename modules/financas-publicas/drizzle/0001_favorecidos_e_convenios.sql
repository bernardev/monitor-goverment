CREATE TABLE "financas_publicas"."convenio" (
	"id" uuid PRIMARY KEY NOT NULL,
	"numero" text NOT NULL,
	"convenente" text NOT NULL,
	"objeto" text,
	"publicado_em" date NOT NULL,
	"valor_centavos" bigint NOT NULL,
	"emendas" jsonb NOT NULL,
	"captura_id" uuid NOT NULL,
	"versao" integer NOT NULL,
	CONSTRAINT "convenio_por_numero" UNIQUE("numero")
);
--> statement-breakpoint
CREATE TABLE "financas_publicas"."favorecidos_da_emenda" (
	"id" uuid PRIMARY KEY NOT NULL,
	"codigo_da_emenda" text NOT NULL,
	"recebimentos" jsonb NOT NULL,
	"captura_id" uuid NOT NULL,
	"versao" integer NOT NULL,
	CONSTRAINT "favorecidos_por_emenda" UNIQUE("codigo_da_emenda")
);
