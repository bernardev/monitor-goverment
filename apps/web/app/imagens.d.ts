// Tipos das imagens importadas estaticamente (`import foto from './_imagens/x.jpg'`). O
// next-env.d.ts traz o mesmo, mas é gerado no build e fica fora do git; sem isto, o lint de um
// checkout limpo não conhece o tipo da imagem.
/// <reference types="next/image-types/global" />
