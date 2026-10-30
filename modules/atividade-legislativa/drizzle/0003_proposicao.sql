CREATE TABLE "atividade_legislativa"."proposicao" (
	"id" uuid PRIMARY KEY NOT NULL,
	"casa" text NOT NULL,
	"codigo_na_fonte" text NOT NULL,
	"sigla" text NOT NULL,
	"numero" integer NOT NULL,
	"ano" integer NOT NULL,
	"ementa" text,
	"apresentada_em" timestamp with time zone,
	"autores" jsonb NOT NULL,
	"situacao" jsonb,
	"tramitacoes" jsonb NOT NULL,
	"norma_gerada" text,
	"url_do_texto" text,
	"captura_id" uuid NOT NULL,
	"versao" integer NOT NULL,
	CONSTRAINT "proposicao_por_codigo" UNIQUE("casa","codigo_na_fonte")
);
