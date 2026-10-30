import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Prometeu · Curadoria',
  robots: { index: false, follow: false },
};

export default function LayoutRaiz({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
