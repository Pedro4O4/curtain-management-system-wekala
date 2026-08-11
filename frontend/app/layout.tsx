import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import { ToastProvider } from '../components/toast-context';
import './globals.css';

export const metadata: Metadata = {
  title: 'الوكالة للستائر',
  description: 'إدارة مبيعات وحركة خزنة الوكالة للستائر.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <ToastProvider>
          <Suspense fallback={<main className="app-shell app-loading"><div className="skeleton skeleton-line lg" /></main>}>
            {children}
          </Suspense>
        </ToastProvider>
      </body>
    </html>
  );
}
