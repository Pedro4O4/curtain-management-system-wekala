import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ToastProvider } from '../components/toast-context';
import './globals.css';

export const metadata: Metadata = {
  title: 'El-Wekala Curtains — Sales Management',
  description: 'Manage daily curtain sales and monthly performance tracking for El-Wekala Curtains.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" dir="ltr">
      <body>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}