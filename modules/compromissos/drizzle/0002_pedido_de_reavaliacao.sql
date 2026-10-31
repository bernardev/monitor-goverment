CREATE TABLE "compromissos"."pedido_de_reavaliacao" (
	"promessa_id" uuid NOT NULL,
	"tipo_do_alvo" text NOT NULL,
	"id_do_alvo" uuid NOT NULL,
	"motivo" text NOT NULL,
	"captura_id" uuid NOT NULL,
	"pedido_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "compromissos"."pedido_de_reavaliacao" ADD CONSTRAINT "pedido_de_reavaliacao_promessa_id_promessa_id_fk" FOREIGN KEY ("promessa_id") REFERENCES "compromissos"."promessa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pedido_de_reavaliacao_por_promessa" ON "compromissos"."pedido_de_reavaliacao" USING btree ("promessa_id");