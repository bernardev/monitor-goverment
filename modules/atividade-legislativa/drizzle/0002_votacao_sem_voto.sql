ALTER TABLE "atividade_legislativa"."votacao_nominal" ALTER COLUMN "registrada_em" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "atividade_legislativa"."votacao_nominal" ADD COLUMN "relacao_completa" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "atividade_legislativa"."votacao_nominal" ADD COLUMN "sem_voto" jsonb DEFAULT '[]'::jsonb NOT NULL;