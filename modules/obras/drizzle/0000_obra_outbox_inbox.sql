-- O schema "obras" e o seu dono são criados por infra/docker/postgres (ADR-0006).
CREATE TABLE "obras"."inbox" (
	"id_do_evento" uuid NOT NULL,
	"consumidor" text NOT NULL,
	"processado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_id_do_evento_consumidor_pk" PRIMARY KEY("id_do_evento","consumidor")
);
--> statement-breakpoint
CREATE TABLE "obras"."obra" (
	"id" uuid PRIMARY KEY NOT NULL,
	"id_na_fonte" text NOT NULL,
	"apuracao" jsonb NOT NULL,
	"captura_id" uuid NOT NULL,
	"versao" integer NOT NULL,
	CONSTRAINT "obra_por_id_na_fonte" UNIQUE("id_na_fonte")
);
--> statement-breakpoint
CREATE TABLE "obras"."outbox" (
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
CREATE INDEX "outbox_pendentes" ON "obras"."outbox" USING btree ("ocorrido_em") WHERE "obras"."outbox"."publicado_em" IS NULL;