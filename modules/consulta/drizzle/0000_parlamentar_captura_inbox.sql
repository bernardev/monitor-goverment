-- O schema "consulta" e o seu dono são criados por infra/docker/postgres (ADR-0006).
CREATE TABLE "consulta"."captura" (
	"captura_id" uuid PRIMARY KEY NOT NULL,
	"fonte" text NOT NULL,
	"url" text NOT NULL,
	"coletada_em" timestamp with time zone NOT NULL,
	"sha256" char(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consulta"."inbox" (
	"id_do_evento" uuid NOT NULL,
	"consumidor" text NOT NULL,
	"processado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_id_do_evento_consumidor_pk" PRIMARY KEY("id_do_evento","consumidor")
);
--> statement-breakpoint
CREATE TABLE "consulta"."parlamentar" (
	"pessoa_id" uuid PRIMARY KEY NOT NULL,
	"nome" text,
	"nome_em" timestamp with time zone,
	"sigla_partido" text,
	"partido_em" timestamp with time zone,
	"url_da_foto" text,
	"foto_em" timestamp with time zone,
	"mandato_id" uuid,
	"cargo" text,
	"circunscricao" text,
	"mandato_inicio" timestamp with time zone,
	"mandato_fim" timestamp with time zone,
	"mandato_captura_id" uuid,
	"captura_id" uuid,
	"atualizado_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "parlamentar_por_nome" ON "consulta"."parlamentar" USING btree ("nome");--> statement-breakpoint
CREATE INDEX "parlamentar_por_circunscricao" ON "consulta"."parlamentar" USING btree ("circunscricao");