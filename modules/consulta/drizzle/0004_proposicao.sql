CREATE TABLE "consulta"."autoria" (
	"proposicao_id" uuid NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"proponente" boolean NOT NULL,
	CONSTRAINT "autoria_proposicao_id_pessoa_id_pk" PRIMARY KEY("proposicao_id","pessoa_id")
);
--> statement-breakpoint
CREATE TABLE "consulta"."proposicao" (
	"proposicao_id" uuid PRIMARY KEY NOT NULL,
	"casa" text NOT NULL,
	"codigo_na_fonte" text NOT NULL,
	"sigla" text NOT NULL,
	"numero" integer NOT NULL,
	"ano" integer NOT NULL,
	"ementa" text,
	"apresentada_em" timestamp with time zone,
	"situacao" jsonb,
	"ultima_tramitacao_em" timestamp with time zone,
	"norma_gerada" text,
	"url_do_texto" text,
	"autores" jsonb NOT NULL,
	"tramitacoes" jsonb NOT NULL,
	"captura_id" uuid NOT NULL,
	"ocorrido_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "autoria_por_pessoa" ON "consulta"."autoria" USING btree ("pessoa_id");--> statement-breakpoint
CREATE UNIQUE INDEX "proposicao_por_codigo" ON "consulta"."proposicao" USING btree ("casa","codigo_na_fonte");--> statement-breakpoint
CREATE INDEX "proposicao_por_ultima_tramitacao" ON "consulta"."proposicao" USING btree ("ultima_tramitacao_em");