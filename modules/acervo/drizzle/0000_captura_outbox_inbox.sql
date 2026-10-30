-- O schema "acervo" e o seu dono são criados por infra/docker/postgres (ADR-0006).
CREATE TABLE "acervo"."captura" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sha256" char(64) NOT NULL,
	"fonte" text NOT NULL,
	"url" text NOT NULL,
	"coletada_em" timestamp with time zone NOT NULL,
	"caminho" text NOT NULL,
	"tipo_de_conteudo" text NOT NULL,
	"registrada_em" timestamp with time zone NOT NULL,
	CONSTRAINT "captura_sha256_unique" UNIQUE("sha256")
);
--> statement-breakpoint
CREATE TABLE "acervo"."inbox" (
	"id_do_evento" uuid NOT NULL,
	"consumidor" text NOT NULL,
	"processado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_id_do_evento_consumidor_pk" PRIMARY KEY("id_do_evento","consumidor")
);
--> statement-breakpoint
CREATE TABLE "acervo"."outbox" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"versao" integer NOT NULL,
	"ocorrido_em" timestamp with time zone NOT NULL,
	"id_do_agregado" text NOT NULL,
	"id_de_correlacao" text NOT NULL,
	"dados" jsonb NOT NULL,
	"publicado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "outbox_pendentes" ON "acervo"."outbox" USING btree ("ocorrido_em") WHERE "acervo"."outbox"."publicado_em" IS NULL;