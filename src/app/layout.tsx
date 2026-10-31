import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Lúmina · Clínica conectada',
  description:
    'Seu cuidado em primeiro plano. Gestão odontológica, prontuário e inteligência clínica em um só lugar.',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
