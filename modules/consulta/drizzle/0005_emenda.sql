CREATE TABLE "consulta"."emenda" (
	"emenda_id" uuid PRIMARY KEY NOT NULL,
	"codigo_na_fonte" text NOT NULL,
	"ano" integer NOT NULL,
	"tipo" text NOT NULL,
	"numero" text NOT NULL,
	"autor_pessoa_id" uuid,
	"autor_nome" text NOT NULL,
	"ufs" text[] NOT NULL,
	"destinacoes" jsonb NOT NULL,
	"empenhado_centavos" bigint NOT NULL,
	"liquidado_centavos" bigint NOT NULL,
	"pago_centavos" bigint NOT NULL,
	"restos_inscritos_centavos" bigint NOT NULL,
	"restos_cancelados_centavos" bigint NOT NULL,
	"restos_pagos_centavos" bigint NOT NULL,
	"captura_id" uuid NOT NULL,
	"ocorrido_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "emenda_por_codigo" ON "consulta"."emenda" USING btree ("codigo_na_fonte");--> statement-breakpoint
CREATE INDEX "emenda_por_ano" ON "consulta"."emenda" USING btree ("ano");--> statement-breakpoint
CREATE INDEX "emenda_por_autor" ON "consulta"."emenda" USING btree ("autor_pessoa_id");--> statement-breakpoint
CREATE INDEX "emenda_por_uf" ON "consulta"."emenda" USING gin ("ufs");