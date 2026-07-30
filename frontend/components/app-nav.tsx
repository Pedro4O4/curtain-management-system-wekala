"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';
import { useSession } from './use-session';

type AppNavProps = {
  children: ReactNode;
};

const links = [
  { href: '/all', label: 'Dashboard', icon: '◫' },
  { href: '/create', label: 'Create', icon: '＋' },
  { href: '/detailes/sales', label: 'Details', icon: '☰' },
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
      <main className="dashboard-shell">
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

  // Active page info
  const activePage = links.find(l => l.href === pathname);
  const title = activePage?.label ?? 'El-Wekala';
  const subtitles: Record<string, string> = {
    '/all': 'Calendar overview & monthly tracking',
    '/create': 'Add new sales entries',
    '/detailes/sales': 'View every saved sale',
  };

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div className="brand-section">
          <span className="brand-eyebrow">El-Wekala Curtains</span>
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
            Logout
          </button>
        </div>
      </header>

      <nav className="nav-strip" aria-label="Main navigation">
        {links.map((link) => (
          <Link
            key={link.href}
            className={pathname === link.href ? 'nav-link active' : 'nav-link'}
            href={link.href}
          >
            <span>{link.icon}</span>
            {link.label}
          </Link>
        ))}
      </nav>

      {children}
    </main>
  );
}
