CREATE TABLE "consulta"."coleta" (
	"fonte" text NOT NULL,
	"tabela" text NOT NULL,
	"versao_do_contrato" text NOT NULL,
	"registros" integer NOT NULL,
	"ocorrido_em" timestamp with time zone NOT NULL,
	CONSTRAINT "coleta_fonte_tabela_pk" PRIMARY KEY("fonte","tabela")
);
