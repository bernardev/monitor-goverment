CREATE TABLE "consulta"."frequencia" (
	"registro_id" uuid PRIMARY KEY NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"casa" text NOT NULL,
	"dia" date NOT NULL,
	"situacao" text NOT NULL,
	"motivo_categoria" text,
	"motivo_descricao" text,
	"registro_na_fonte" text NOT NULL,
	"sessoes" jsonb NOT NULL,
	"captura_id" uuid NOT NULL,
	"ocorrido_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "frequencia_por_pessoa" ON "consulta"."frequencia" USING btree ("pessoa_id","dia");