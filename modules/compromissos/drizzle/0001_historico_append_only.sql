-- Invariante 5: o histórico de vereditos é append-only. Corrigir é publicar uma errata, nunca editar.
-- A regra fica também no banco para valer contra qualquer caminho de escrita, inclusive manual.
CREATE FUNCTION "compromissos"."historico_append_only"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'O histórico de vereditos não pode ser alterado nem apagado (invariante 5).'
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "registro_de_veredito_append_only"
  BEFORE UPDATE OR DELETE ON "compromissos"."registro_de_veredito"
  FOR EACH ROW EXECUTE FUNCTION "compromissos"."historico_append_only"();
--> statement-breakpoint
CREATE TRIGGER "registro_de_veredito_sem_truncate"
  BEFORE TRUNCATE ON "compromissos"."registro_de_veredito"
  FOR EACH STATEMENT EXECUTE FUNCTION "compromissos"."historico_append_only"();
