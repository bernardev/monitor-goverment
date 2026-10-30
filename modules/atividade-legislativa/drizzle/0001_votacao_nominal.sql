CREATE TABLE "atividade_legislativa"."votacao_nominal" (
	"id" uuid PRIMARY KEY NOT NULL,
	"casa" text NOT NULL,
	"codigo_na_fonte" text NOT NULL,
	"dia" date NOT NULL,
	"registrada_em" timestamp with time zone NOT NULL,
	"descricao" text NOT NULL,
	"resultado" text NOT NULL,
	"proposicoes" jsonb NOT NULL,
	"votos" jsonb NOT NULL,
	"captura_id" uuid NOT NULL,
	"captura_dos_votos_id" uuid NOT NULL,
	"versao" integer NOT NULL,
	CONSTRAINT "votacao_por_codigo" UNIQUE("casa","codigo_na_fonte")
);
