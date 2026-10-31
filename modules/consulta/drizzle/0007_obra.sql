CREATE TABLE "consulta"."obra" (
	"obra_id" uuid PRIMARY KEY NOT NULL,
	"id_na_fonte" text NOT NULL,
	"nome" text NOT NULL,
	"situacao" text NOT NULL,
	"uf" char(2),
	"percentual_centesimos" integer,
	"investimento_previsto_centavos" bigint NOT NULL,
	"codigos_das_emendas" text[] NOT NULL,
	"estado" jsonb NOT NULL,
	"captura_id" uuid NOT NULL,
	"ocorrido_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "obra_por_id_na_fonte" ON "consulta"."obra" USING btree ("id_na_fonte");--> statement-breakpoint
CREATE INDEX "obra_por_uf_e_situacao" ON "consulta"."obra" USING btree ("uf","situacao");--> statement-breakpoint
CREATE INDEX "obra_por_emenda" ON "consulta"."obra" USING gin ("codigos_das_emendas");