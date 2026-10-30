ALTER TABLE "consulta"."votacao" ALTER COLUMN "registrada_em" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "consulta"."voto" ALTER COLUMN "opcao" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "consulta"."votacao" ADD COLUMN "relacao_completa" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "consulta"."votacao" ADD COLUMN "contagem_sem_voto" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "consulta"."voto" ADD COLUMN "situacao_sem_voto" text;--> statement-breakpoint
ALTER TABLE "consulta"."voto" ADD COLUMN "motivo_categoria" text;--> statement-breakpoint
ALTER TABLE "consulta"."voto" ADD COLUMN "motivo_descricao" text;