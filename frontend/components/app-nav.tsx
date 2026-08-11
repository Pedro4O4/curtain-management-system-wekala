"use client";

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { MouseEvent, ReactNode, useEffect, useState } from 'react';
import { useSession } from './use-session';

type AppNavProps = {
  children: ReactNode;
};

const links = [
  { href: '/all', label: 'الرئيسية', icon: '⌂' },
  { href: '/detailes/sales', label: 'سجل المبيعات', icon: '▤' },
  { href: '/products', label: 'أنواع الستائر', icon: '◇' },
];

export function AppNav({ children }: AppNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, user, ready, logout } = useSession();
  const [saleRecordPickerOpen, setSaleRecordPickerOpen] = useState(false);

  useEffect(() => {
    if (ready && !token) {
      router.replace('/login');
    }
  }, [ready, token, router]);

  if (!ready) {
    return (
      <main className="app-shell app-loading">
        <div className="skeleton skeleton-line lg" />
        <div className="skeleton skeleton-line md" />
      </main>
    );
  }

  if (!token) {
    return null;
  }

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  function handleNavigation(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (href !== '/detailes/sales') return;
    event.preventDefault();
    setSaleRecordPickerOpen(true);
  }

  function openRetailSales() {
    const selectedDate = window.localStorage.getItem('el-wekala-selected-date');
    setSaleRecordPickerOpen(false);
    router.push(selectedDate ? `/detailes/sales?date=${selectedDate}` : '/detailes/sales');
  }

  function openWholesaleHistory() {
    const selectedDate = window.localStorage.getItem('el-wekala-selected-date');
    setSaleRecordPickerOpen(false);
    router.push(selectedDate ? `/wholesale/history?date=${selectedDate}` : '/wholesale/history');
  }

  // Active page info
  const activePage = links.find(l => l.href === pathname);
  const isRetailSupplierRoute = pathname === '/retail-suppliers'
    || (pathname.startsWith('/wholesale/') && searchParams.get('scope') === 'retail');
  const title = pathname === '/create'
    ? 'قطاعي'
    : pathname === '/details'
      ? 'ملخص اليوم'
      : pathname === '/products'
        ? 'أنواع الستائر'
        : isRetailSupplierRoute
          ? 'موردين القطاعي'
        : pathname === '/wholesale/history'
          ? 'سجل الجملة'
          : pathname.startsWith('/wholesale')
            ? 'الجملة'
            : activePage?.label ?? 'الوكالة للستائر';
  const subtitles: Record<string, string> = {
    '/all': 'سجّل يومك بسهولة ومن مكان واحد',
    '/create': 'بيع سريع وحركات الخزنة',
    '/details': 'المبيعات والحركات النقدية',
    '/detailes/sales': 'كل المبيعات التي تم تسجيلها',
    '/products': 'أنواع الستائر الجاهزة للاختيار عند البيع',
  };
  const subtitle = isRetailSupplierRoute
    ? 'تابع البضاعة والدفعات والتسوية مع كل مورد بشكل مستقل'
    : pathname === '/wholesale/history'
    ? 'كل حركات بضاعة ودفعات الجملة مجمعة حسب اليوم'
    : pathname.startsWith('/wholesale')
      ? 'حسابات العملاء والموردين وحركات البضاعة والدفعات'
      : subtitles[pathname];

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-section">
          <span className="brand-eyebrow">الوكالة للستائر</span>
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        <div className="topbar-actions">
          {user && (
            <div className="user-badge">
              <span className="user-initial">{user.username.charAt(0).toUpperCase()}</span>
              {user.username}
            </div>
          )}
          <button className="btn btn-secondary btn-sm btn-pill" onClick={handleLogout} type="button">
            خروج
          </button>
        </div>
      </header>

      <nav className="nav-strip" aria-label="التنقل الرئيسي">
        {links.map((link) => (
          <Link
            key={link.href}
            className={pathname === link.href ? 'nav-link active' : 'nav-link'}
            href={link.href}
            onClick={(event) => handleNavigation(event, link.href)}
          >
            <span>{link.icon}</span>
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="app-content">{children}</div>

      {saleRecordPickerOpen && (
        <div className="sale-record-overlay" onMouseDown={() => setSaleRecordPickerOpen(false)} role="presentation">
          <section
            aria-label="اختيار سجل المبيعات"
            aria-modal="true"
            className="sale-record-picker"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <button aria-label="إغلاق" className="sale-picker-close" onClick={() => setSaleRecordPickerOpen(false)} type="button">×</button>
            <span className="eyebrow">سجل المبيعات</span>
            <h2>اختر نوع البيع</h2>
            <p>اختر القطاع الذي تريد عرض مبيعاته.</p>
            <div className="sale-picker-options">
              <button className="sale-picker-option retail" onClick={openRetailSales} type="button">
                <span aria-hidden="true">◈</span>
                <strong>قطاعي</strong>
                <small>عرض سجل مبيعات القطاعي</small>
              </button>
              <button className="sale-picker-option wholesale" onClick={openWholesaleHistory} type="button">
                <span aria-hidden="true">▦</span>
                <strong>جملة</strong>
                <small>عرض سجل حركات الجملة</small>
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
