-- O schema "compromissos" e o seu dono são criados por infra/docker/postgres (ADR-0006).
CREATE TABLE "compromissos"."fonte" (
	"id" uuid PRIMARY KEY NOT NULL,
	"promessa_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"captura_id" uuid NOT NULL,
	"citacao_literal" text NOT NULL,
	"localizacao" jsonb NOT NULL,
	"data_da_declaracao" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compromissos"."inbox" (
	"id_do_evento" uuid NOT NULL,
	"consumidor" text NOT NULL,
	"processado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_id_do_evento_consumidor_pk" PRIMARY KEY("id_do_evento","consumidor")
);
--> statement-breakpoint
CREATE TABLE "compromissos"."outbox" (
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
CREATE TABLE "compromissos"."promessa" (
	"id" uuid PRIMARY KEY NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"candidatura_id" uuid,
	"mandato_id" uuid,
	"texto" text NOT NULL,
	"tema" text NOT NULL,
	"mensurabilidade" text NOT NULL,
	"competencia" text NOT NULL,
	"meta_descricao" text,
	"meta_prazo" timestamp with time zone,
	"estagio" text NOT NULL,
	"versao" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compromissos"."proposta_de_veredito" (
	"promessa_id" uuid PRIMARY KEY NOT NULL,
	"veredito" text NOT NULL,
	"justificativa" text NOT NULL,
	"evidencias" uuid[] NOT NULL,
	"fundamento" jsonb,
	"errata" boolean NOT NULL,
	"proposto_por" uuid NOT NULL,
	"proposto_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compromissos"."registro_de_veredito" (
	"id" uuid PRIMARY KEY NOT NULL,
	"promessa_id" uuid NOT NULL,
	"veredito" text NOT NULL,
	"justificativa" text NOT NULL,
	"evidencias" uuid[] NOT NULL,
	"fundamento" jsonb,
	"errata" boolean NOT NULL,
	"proposto_por" uuid NOT NULL,
	"proposto_em" timestamp with time zone NOT NULL,
	"revisado_por" uuid NOT NULL,
	"publicado_em" timestamp with time zone NOT NULL,
	"corrige" uuid
);
--> statement-breakpoint
CREATE TABLE "compromissos"."vinculo" (
	"id" uuid PRIMARY KEY NOT NULL,
	"promessa_id" uuid NOT NULL,
	"tipo_do_alvo" text NOT NULL,
	"id_do_alvo" uuid NOT NULL,
	"estagio_que_comprova" text NOT NULL,
	"origem" text NOT NULL,
	"evidencias" uuid[] NOT NULL,
	"situacao" text NOT NULL,
	"sugerido_em" timestamp with time zone NOT NULL,
	"decidido_por" uuid,
	"decidido_em" timestamp with time zone,
	"motivo" text
);
--> statement-breakpoint
ALTER TABLE "compromissos"."fonte" ADD CONSTRAINT "fonte_promessa_id_promessa_id_fk" FOREIGN KEY ("promessa_id") REFERENCES "compromissos"."promessa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compromissos"."proposta_de_veredito" ADD CONSTRAINT "proposta_de_veredito_promessa_id_promessa_id_fk" FOREIGN KEY ("promessa_id") REFERENCES "compromissos"."promessa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compromissos"."registro_de_veredito" ADD CONSTRAINT "registro_de_veredito_promessa_id_promessa_id_fk" FOREIGN KEY ("promessa_id") REFERENCES "compromissos"."promessa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compromissos"."vinculo" ADD CONSTRAINT "vinculo_promessa_id_promessa_id_fk" FOREIGN KEY ("promessa_id") REFERENCES "compromissos"."promessa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fonte_por_promessa" ON "compromissos"."fonte" USING btree ("promessa_id");--> statement-breakpoint
CREATE INDEX "outbox_pendentes" ON "compromissos"."outbox" USING btree ("ocorrido_em") WHERE "compromissos"."outbox"."publicado_em" IS NULL;--> statement-breakpoint
CREATE INDEX "promessa_por_pessoa" ON "compromissos"."promessa" USING btree ("pessoa_id");--> statement-breakpoint
CREATE INDEX "registro_por_promessa" ON "compromissos"."registro_de_veredito" USING btree ("promessa_id");--> statement-breakpoint
CREATE INDEX "vinculo_por_promessa" ON "compromissos"."vinculo" USING btree ("promessa_id");