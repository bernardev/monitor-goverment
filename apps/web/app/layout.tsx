import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Prometeu',
  description:
    'Acompanhe o que foi prometido, o que virou lei, o que tem orçamento, o que foi pago e o que foi entregue.',
};

export default function LayoutRaiz({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
