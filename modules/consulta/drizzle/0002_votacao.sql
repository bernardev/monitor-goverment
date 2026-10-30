CREATE TABLE "consulta"."votacao" (
	"votacao_id" uuid PRIMARY KEY NOT NULL,
	"casa" text NOT NULL,
	"codigo_na_fonte" text NOT NULL,
	"dia" date NOT NULL,
	"registrada_em" timestamp with time zone NOT NULL,
	"descricao" text NOT NULL,
	"resultado" text NOT NULL,
	"secreta" boolean NOT NULL,
	"proposicoes" jsonb NOT NULL,
	"placar" jsonb NOT NULL,
	"captura_id" uuid NOT NULL,
	"captura_dos_votos_id" uuid NOT NULL,
	"ocorrido_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consulta"."voto" (
	"votacao_id" uuid NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"opcao" text NOT NULL,
	"registro_na_fonte" text,
	"sigla_partido_na_fonte" text,
	CONSTRAINT "voto_votacao_id_pessoa_id_pk" PRIMARY KEY("votacao_id","pessoa_id")
);
--> statement-breakpoint
CREATE INDEX "votacao_por_dia" ON "consulta"."votacao" USING btree ("dia","registrada_em");--> statement-breakpoint
CREATE INDEX "voto_por_pessoa" ON "consulta"."voto" USING btree ("pessoa_id");