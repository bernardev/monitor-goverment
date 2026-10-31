'use client';

import type { ParlamentarResumo } from '@prometeu/contracts';
import { type ReactNode, useActionState, useState } from 'react';

import { type EstadoDoFormulario, registrarPromessa } from '../promessas/acoes';
import {
  COMPETENCIAS,
  ESTAGIOS,
  MENSURABILIDADES,
  rotulo,
  TIPOS_DE_FONTE,
  VEREDITOS,
} from './rotulos';

const INICIAL: EstadoDoFormulario = {};

/**
 * Ação do servidor já ligada à promessa. O `bind` é feito no componente do servidor: ligada no
 * cliente, a ação trava o envio sem JavaScript quando devolve erro.
 */
export type AcaoDoFormulario = (
  estado: EstadoDoFormulario,
  dados: FormData,
) => Promise<EstadoDoFormulario>;

function Erro({ estado }: { estado: EstadoDoFormulario }): ReactNode {
  return estado.erro ? (
    <p role="alert" className="erro">
      {estado.erro}
    </p>
  ) : null;
}

function Opcoes({ tabela }: { tabela: Readonly<Record<string, string>> }): ReactNode {
  return Object.entries(tabela).map(([valor, rotulo]) => (
    <option key={valor} value={valor}>
      {rotulo}
    </option>
  ));
}

export function FormularioDePromessa({
  parlamentares,
}: {
  parlamentares: readonly ParlamentarResumo[];
}): ReactNode {
  const [estado, enviar, enviando] = useActionState(registrarPromessa, INICIAL);
  const [localizacao, setLocalizacao] = useState('pagina');
  return (
    <form action={enviar} className="formulario">
      <label>
        Parlamentar
        <select name="pessoaId" required>
          {parlamentares.map((p) => (
            <option key={p.pessoaId} value={p.pessoaId}>
              {p.nome} ({p.siglaPartido ?? 'sem partido'})
            </option>
          ))}
        </select>
      </label>
      <label>
        Promessa, em texto curto e neutro
        <textarea name="texto" required maxLength={500} rows={2} />
      </label>
      <label>
        Tema (código, ex.: educacao)
        <input name="tema" required pattern="[a-z][a-z0-9_]*" />
      </label>
      <label>
        Mensurabilidade
        <select name="mensurabilidade">
          <Opcoes tabela={MENSURABILIDADES} />
        </select>
      </label>
      <label>
        Competência
        <select name="competencia">
          <Opcoes tabela={COMPETENCIAS} />
        </select>
      </label>
      <label>
        Meta mensurável (opcional)
        <input name="meta" />
      </label>

      <fieldset>
        <legend>Fonte</legend>
        <label>
          Endereço do documento (https), capturado agora como prova
          <input name="urlDaFonte" type="url" required pattern="https://.*" />
        </label>
        <label>
          Tipo
          <select name="tipoDeFonte">
            <Opcoes tabela={TIPOS_DE_FONTE} />
          </select>
        </label>
        <label>
          Citação literal
          <textarea name="citacaoLiteral" required rows={3} />
        </label>
        <label>
          Onde está no documento
          <select
            name="tipoDeLocalizacao"
            value={localizacao}
            onChange={(e) => {
              setLocalizacao(e.target.value);
            }}
          >
            <option value="pagina">Página</option>
            <option value="intervalo_de_tempo">Trecho de vídeo</option>
          </select>
        </label>
        {localizacao === 'pagina' ? (
          <label>
            Página
            <input name="pagina" type="number" min={1} required />
          </label>
        ) : (
          <>
            <label>
              Início (segundos)
              <input name="inicioEmSegundos" type="number" min={0} required />
            </label>
            <label>
              Fim (segundos)
              <input name="fimEmSegundos" type="number" min={0} required />
            </label>
          </>
        )}
        <label>
          Data da declaração
          <input name="dataDaDeclaracao" type="date" required />
        </label>
      </fieldset>

      <Erro estado={estado} />
      <button type="submit" disabled={enviando}>
        {enviando ? 'Capturando e registrando…' : 'Registrar promessa'}
      </button>
    </form>
  );
}

export function FormularioDeVeredito({
  propor,
  capturas,
}: {
  propor: AcaoDoFormulario;
  capturas: readonly string[];
}): ReactNode {
  const [estado, enviar, enviando] = useActionState(propor, INICIAL);
  return (
    <form action={enviar} className="formulario">
      <label>
        Veredito
        <select name="veredito">
          <Opcoes tabela={VEREDITOS} />
        </select>
      </label>
      <label>
        Justificativa
        <textarea name="justificativa" required rows={3} />
      </label>
      <fieldset>
        <legend>Evidências</legend>
        {capturas.map((captura) => (
          <label key={captura} className="em-linha">
            <input type="checkbox" name="evidencias" value={captura} /> Captura {captura}
          </label>
        ))}
        <label>
          Nova evidência: endereço (https), capturado agora
          <input name="urlDaEvidencia" type="url" pattern="https://.*" />
        </label>
      </fieldset>
      <label>
        Fundamento (só para não cumprida)
        <select name="fundamento">
          <option value="">Nenhum</option>
          <option value="mandato_encerrado">Mandato encerrado</option>
          <option value="ato_em_sentido_contrario">
            Ato em sentido contrário (use a nova evidência)
          </option>
        </select>
      </label>
      <label className="em-linha">
        <input type="checkbox" name="errata" value="sim" /> Errata: corrige o veredito vigente
      </label>
      <Erro estado={estado} />
      <button type="submit" disabled={enviando}>
        {enviando ? 'Enviando…' : 'Propor veredito'}
      </button>
    </form>
  );
}

export function Revisao({
  publicar: acaoDePublicar,
  recusar: acaoDeRecusar,
}: {
  publicar: AcaoDoFormulario;
  recusar: AcaoDoFormulario;
}): ReactNode {
  const [publicacao, publicar, publicando] = useActionState(acaoDePublicar, INICIAL);
  const [recusa, recusar, recusando] = useActionState(acaoDeRecusar, INICIAL);
  return (
    <div className="revisao">
      <form action={publicar}>
        <Erro estado={publicacao} />
        <button type="submit" disabled={publicando}>
          Publicar veredito
        </button>
      </form>
      <form action={recusar} className="formulario">
        <label>
          Motivo da recusa
          <input name="motivo" required />
        </label>
        <Erro estado={recusa} />
        <button type="submit" disabled={recusando}>
          Recusar e devolver
        </button>
      </form>
    </div>
  );
}

/** Sugere o vínculo de um fato com a promessa, no estágio escolhido (o primeiro é o sugerido). */
export function SugestaoDeVinculo({
  sugerir: acao,
  tipoDoAlvo,
  idDoAlvo,
  estagios,
}: {
  sugerir: AcaoDoFormulario;
  tipoDoAlvo: string;
  idDoAlvo: string;
  estagios: readonly string[];
}): ReactNode {
  const [estado, sugerir, sugerindo] = useActionState(acao, INICIAL);
  return (
    <form action={sugerir} className="em-linha">
      <input type="hidden" name="tipoDoAlvo" value={tipoDoAlvo} />
      <input type="hidden" name="idDoAlvo" value={idDoAlvo} />
      <label>
        Comprova o estágio{' '}
        <select name="estagioQueComprova" defaultValue={estagios[0]}>
          {estagios.map((e) => (
            <option key={e} value={e}>
              {rotulo(ESTAGIOS, e)}
            </option>
          ))}
        </select>
      </label>{' '}
      <button type="submit" disabled={sugerindo}>
        {sugerindo ? 'Sugerindo…' : 'Sugerir vínculo'}
      </button>
      <Erro estado={estado} />
    </form>
  );
}

/** Confirma um vínculo sugerido, ou rejeita (desfaz) com motivo. */
export function DecisaoDeVinculo({
  confirmar: acaoDeConfirmar,
  rejeitar: acaoDeRejeitar,
  confirmavel,
}: {
  confirmar: AcaoDoFormulario;
  rejeitar: AcaoDoFormulario;
  confirmavel: boolean;
}): ReactNode {
  const [confirmacao, confirmar, confirmando] = useActionState(acaoDeConfirmar, INICIAL);
  const [rejeicao, rejeitar, rejeitando] = useActionState(acaoDeRejeitar, INICIAL);
  return (
    <div className="revisao">
      {confirmavel && (
        <form action={confirmar}>
          <Erro estado={confirmacao} />
          <button type="submit" disabled={confirmando}>
            Confirmar vínculo
          </button>
        </form>
      )}
      <form action={rejeitar} className="em-linha">
        <label>
          Motivo <input name="motivo" required />
        </label>{' '}
        <button type="submit" disabled={rejeitando}>
          {confirmavel ? 'Rejeitar' : 'Desfazer'}
        </button>
        <Erro estado={rejeicao} />
      </form>
    </div>
  );
}

export function ConclusaoDeReavaliacao({ concluir }: { concluir: AcaoDoFormulario }): ReactNode {
  const [estado, acao, concluindo] = useActionState(concluir, INICIAL);
  return (
    <form action={acao}>
      <Erro estado={estado} />
      <button type="submit" disabled={concluindo}>
        Marcar como reavaliada
      </button>
    </form>
  );
}
