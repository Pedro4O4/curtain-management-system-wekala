"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MouseEvent, ReactNode, useEffect } from 'react';
import { useSession } from './use-session';

type AppNavProps = {
  children: ReactNode;
};

const links = [
  { href: '/all', label: 'الرئيسية', icon: '⌂' },
  { href: '/detailes/sales', label: 'سجل المبيعات', icon: '▤' },
];

export function AppNav({ children }: AppNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { token, user, ready, logout } = useSession();

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

    const selectedDate = window.localStorage.getItem('el-wekala-selected-date');
    if (!selectedDate) return;

    event.preventDefault();
    router.push(`${href}?date=${selectedDate}`);
  }

  // Active page info
  const activePage = links.find(l => l.href === pathname);
  const title = pathname === '/create'
    ? 'قطاعي'
    : pathname === '/details'
      ? 'ملخص اليوم'
      : activePage?.label ?? 'الوكالة للستائر';
  const subtitles: Record<string, string> = {
    '/all': 'سجّل يومك بسهولة ومن مكان واحد',
    '/create': 'بيع سريع وحركات الخزنة',
    '/details': 'المبيعات والحركات النقدية',
    '/detailes/sales': 'كل المبيعات التي تم تسجيلها',
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-section">
          <span className="brand-eyebrow">الوكالة للستائر</span>
          <h1 className="page-title">{title}</h1>
          {subtitles[pathname] && <p className="page-subtitle">{subtitles[pathname]}</p>}
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
    </main>
  );
}
