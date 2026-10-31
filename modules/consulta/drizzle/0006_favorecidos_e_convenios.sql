CREATE TABLE "consulta"."convenio" (
	"convenio_id" uuid PRIMARY KEY NOT NULL,
	"numero" text NOT NULL,
	"convenente" text NOT NULL,
	"objeto" text,
	"publicado_em" date NOT NULL,
	"valor_centavos" bigint NOT NULL,
	"emendas" jsonb NOT NULL,
	"codigos_das_emendas" text[] NOT NULL,
	"captura_id" uuid NOT NULL,
	"ocorrido_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consulta"."favorecidos_da_emenda" (
	"codigo_da_emenda" text PRIMARY KEY NOT NULL,
	"favorecidos" jsonb NOT NULL,
	"recebido_centavos" bigint NOT NULL,
	"captura_id" uuid NOT NULL,
	"ocorrido_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "convenio_por_emenda" ON "consulta"."convenio" USING gin ("codigos_das_emendas");