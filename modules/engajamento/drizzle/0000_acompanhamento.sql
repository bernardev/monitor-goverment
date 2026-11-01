-- O schema "engajamento" e o seu dono são criados por infra/docker/postgres (ADR-0006).
CREATE TABLE "engajamento"."acompanhamento" (
	"cidadao_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"alvo_id" text NOT NULL,
	"desde" timestamp with time zone NOT NULL,
	CONSTRAINT "acompanhamento_cidadao_id_tipo_alvo_id_pk" PRIMARY KEY("cidadao_id","tipo","alvo_id")
);
--> statement-breakpoint
CREATE INDEX "acompanhamento_por_alvo" ON "engajamento"."acompanhamento" USING btree ("tipo","alvo_id");