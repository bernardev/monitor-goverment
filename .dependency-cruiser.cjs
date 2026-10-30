/**
 * Regras de arquitetura verificadas no CI (ADR-0002, ADR-0003).
 * Se uma regra precisar mudar, a mudança vem acompanhada de um ADR.
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'sem-ciclos',
      comment: 'Dependências circulares impedem entender e extrair módulos.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'sem-import-nao-resolvido',
      comment:
        'Import que não resolve costuma ser tentativa de acessar o interior de outro módulo ' +
        '(bloqueado pelo campo "exports" do package.json).',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'modulo-so-pelo-ponto-de-entrada',
      comment: 'ADR-0002: um módulo só usa outro pelo src/index.ts público.',
      severity: 'error',
      from: { path: '^modules/([^/]+)/' },
      to: {
        path: '^modules/',
        pathNot: ['^modules/$1/', '^modules/[^/]+/src/index\.ts$'],
      },
    },
    {
      name: 'dominio-puro',
      comment:
        'ADR-0003: o domínio só depende de si mesmo e do shared-kernel. ' +
        'Nada de framework, ORM, HTTP ou módulos do Node.',
      severity: 'error',
      from: { path: '^modules/([^/]+)/src/domain/' },
      to: {
        pathNot: ['^modules/$1/src/domain/', '^packages/shared-kernel/'],
      },
    },
    {
      name: 'aplicacao-nao-conhece-adaptadores',
      comment: 'ADR-0003: casos de uso dependem de portas, não de infraestrutura nem de entradas.',
      severity: 'error',
      from: { path: '^modules/([^/]+)/src/application/' },
      to: { path: '^modules/$1/src/(infrastructure|interface)/' },
    },
    {
      name: 'infraestrutura-nao-conhece-entradas',
      severity: 'error',
      from: { path: '^modules/([^/]+)/src/infrastructure/' },
      to: { path: '^modules/$1/src/interface/' },
    },
    {
      name: 'front-so-pela-api',
      comment: 'ADR-0004: site e painel falam com o domínio apenas pela API.',
      severity: 'error',
      from: { path: '^apps/(web|curadoria)/' },
      to: { path: '^(modules|apps/(api|worker))/' },
    },
    {
      name: 'kernel-nao-depende-de-ninguem',
      comment: 'O shared-kernel é a base; não pode depender de módulos ou apps.',
      severity: 'error',
      from: { path: '^packages/shared-kernel/' },
      to: { path: '^(modules|apps)/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(dist|\.next|coverage)/|next-env\.d\.ts$' },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['@prometeu/source', 'import', 'require', 'node', 'default'],
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
