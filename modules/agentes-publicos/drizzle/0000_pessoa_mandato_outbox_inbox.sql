-- O schema "agentes_publicos" e o seu dono são criados por infra/docker/postgres (ADR-0006).
CREATE TABLE "agentes_publicos"."identificador_externo" (
	"fonte" text NOT NULL,
	"codigo" text NOT NULL,
	"pessoa_id" uuid NOT NULL,
	CONSTRAINT "identificador_externo_fonte_codigo_pk" PRIMARY KEY("fonte","codigo")
);
--> statement-breakpoint
CREATE TABLE "agentes_publicos"."inbox" (
	"id_do_evento" uuid NOT NULL,
	"consumidor" text NOT NULL,
	"processado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_id_do_evento_consumidor_pk" PRIMARY KEY("id_do_evento","consumidor")
);
--> statement-breakpoint
CREATE TABLE "agentes_publicos"."mandato" (
	"id" uuid PRIMARY KEY NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"cargo" text NOT NULL,
	"circunscricao" text NOT NULL,
	"inicio" timestamp with time zone NOT NULL,
	"fim" timestamp with time zone,
	"captura_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agentes_publicos"."outbox" (
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
CREATE TABLE "agentes_publicos"."pessoa" (
	"id" uuid PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"sigla_partido" text,
	"url_da_foto" text,
	"versao" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agentes_publicos"."identificador_externo" ADD CONSTRAINT "identificador_externo_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "agentes_publicos"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentes_publicos"."mandato" ADD CONSTRAINT "mandato_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "agentes_publicos"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "identificador_por_pessoa" ON "agentes_publicos"."identificador_externo" USING btree ("pessoa_id");--> statement-breakpoint
CREATE INDEX "mandato_por_pessoa" ON "agentes_publicos"."mandato" USING btree ("pessoa_id");--> statement-breakpoint
CREATE INDEX "outbox_pendentes" ON "agentes_publicos"."outbox" USING btree ("ocorrido_em") WHERE "agentes_publicos"."outbox"."publicado_em" IS NULL;