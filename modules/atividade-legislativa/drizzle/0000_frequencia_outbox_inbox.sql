-- O schema "atividade_legislativa" e o seu dono são criados por infra/docker/postgres (ADR-0006).
CREATE TABLE "atividade_legislativa"."inbox" (
	"id_do_evento" uuid NOT NULL,
	"consumidor" text NOT NULL,
	"processado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_id_do_evento_consumidor_pk" PRIMARY KEY("id_do_evento","consumidor")
);
--> statement-breakpoint
CREATE TABLE "atividade_legislativa"."outbox" (
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
CREATE TABLE "atividade_legislativa"."registro_de_frequencia" (
	"id" uuid PRIMARY KEY NOT NULL,
	"casa" text NOT NULL,
	"dia" date NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"mandato_id" uuid NOT NULL,
	"situacao" text NOT NULL,
	"motivo_categoria" text,
	"motivo_descricao" text,
	"registro_na_fonte" text NOT NULL,
	"sessoes" jsonb NOT NULL,
	"captura_id" uuid NOT NULL,
	"versao" integer NOT NULL,
	CONSTRAINT "frequencia_por_dia" UNIQUE("casa","pessoa_id","dia")
);
--> statement-breakpoint
CREATE INDEX "outbox_pendentes" ON "atividade_legislativa"."outbox" USING btree ("ocorrido_em") WHERE "atividade_legislativa"."outbox"."publicado_em" IS NULL;--> statement-breakpoint
CREATE INDEX "frequencia_por_mandato" ON "atividade_legislativa"."registro_de_frequencia" USING btree ("mandato_id","dia");