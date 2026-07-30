"use client";

import { useEffect, useState } from 'react';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type User = { id: string; username: string };
type AuthResponse = { token: string; user: User };
type MonthDay = {
  date: string;
  locked: boolean;
  saleTotal: number;
  adjustmentTotal: number;
  dayTotal: number;
  saleCount: number;
  adjustmentCount: number;
};
type MonthResponse = {
  month: string;
  today: string;
  days: MonthDay[];
  total: number;
};
type DayResponse = {
  date: string;
  locked: boolean;
  sales: { item: string; price: number }[];
  adjustments: { amount: number; reason: string; direction: '+' | '-' }[];
  saleTotal: number;
  adjustmentTotal: number;
  dayTotal: number;
};

const currency = new Intl.NumberFormat('ar-EG', {
  style: 'currency',
  currency: 'EGP',
  maximumFractionDigits: 0
});

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function monthKeyFromDate(date: string) {
  return date.slice(0, 7);
}

function monthLabel(month: string) {
  const parsed = new Date(`${month}-01T00:00:00`);
  return new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric' }).format(parsed);
}

function shiftMonth(month: string, delta: number) {
  const [yearPart, monthPart] = month.split('-');
  const shifted = new Date(Number(yearPart), Number(monthPart) - 1 + delta, 1);
  const year = shifted.getFullYear();
  const nextMonth = String(shifted.getMonth() + 1).padStart(2, '0');
  return `${year}-${nextMonth}`;
}

function weekdayCount(month: string) {
  const [yearPart, monthPart] = month.split('-');
  const firstDay = new Date(Number(yearPart), Number(monthPart) - 1, 1);
  const daysInMonth = new Date(Number(yearPart), Number(monthPart), 0).getDate();
  const leadingEmpty = firstDay.getDay();
  const slots: Array<{ type: 'empty' } | { type: 'day'; day: number }> = [];

  for (let index = 0; index < leadingEmpty; index += 1) {
    slots.push({ type: 'empty' });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    slots.push({ type: 'day', day });
  }

  return slots;
}

async function apiRequest<T>(path: string, token?: string, init?: RequestInit) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {})
    }
  });

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    throw new Error(payload?.message ?? 'Request failed');
  }

  return payload as T;
}

export default function HomePage() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(monthKeyFromDate(todayIsoDate()));
  const [selectedDate, setSelectedDate] = useState(todayIsoDate());
  const [monthData, setMonthData] = useState<MonthResponse | null>(null);
  const [dayData, setDayData] = useState<DayResponse | null>(null);
  const [pageError, setPageError] = useState('');

  const [saleItem, setSaleItem] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [saleError, setSaleError] = useState('');
  const [saleLoading, setSaleLoading] = useState(false);

  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustDirection, setAdjustDirection] = useState<'+' | '-'>('+');
  const [adjustError, setAdjustError] = useState('');
  const [adjustLoading, setAdjustLoading] = useState(false);

  useEffect(() => {
    const storedToken = window.localStorage.getItem('el-wekala-token');
    if (!storedToken) {
      return;
    }

    setToken(storedToken);
    apiRequest<{ user: User }>('/auth/me', storedToken)
      .then((payload) => setUser(payload.user))
      .catch(() => {
        window.localStorage.removeItem('el-wekala-token');
        setToken(null);
      });
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    apiRequest<MonthResponse>(`/records/month/${selectedMonth}`, token)
      .then(setMonthData)
      .catch((error: Error) => setPageError(error.message));
  }, [token, selectedMonth]);

  useEffect(() => {
    if (!token) {
      return;
    }

    apiRequest<DayResponse>(`/records/day/${selectedDate}`, token)
      .then((payload) => {
        setDayData(payload);
        setSaleItem('');
        setSalePrice('');
        setAdjustAmount('');
        setAdjustReason('');
        setAdjustDirection('+');
      })
      .catch((error: Error) => setPageError(error.message));
  }, [token, selectedDate]);

  async function handleAuthSubmit() {
    setAuthLoading(true);
    setAuthError('');

    try {
      const endpoint = authMode === 'register' ? '/auth/register' : '/auth/login';
      const payload = await apiRequest<AuthResponse>(endpoint, undefined, {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });

      window.localStorage.setItem('el-wekala-token', payload.token);
      setToken(payload.token);
      setUser(payload.user);
      setSelectedDate(todayIsoDate());
      setSelectedMonth(monthKeyFromDate(todayIsoDate()));
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  }

  async function addSale() {
    if (!token) {
      return;
    }

    setSaleLoading(true);
    setSaleError('');

    try {
      await apiRequest<DayResponse>(`/records/day/${selectedDate}/sales`, token, {
        method: 'POST',
        body: JSON.stringify({ item: saleItem, price: Number(salePrice) })
      });
      const [nextDay, nextMonth] = await Promise.all([
        apiRequest<DayResponse>(`/records/day/${selectedDate}`, token),
        apiRequest<MonthResponse>(`/records/month/${selectedMonth}`, token)
      ]);
      setDayData(nextDay);
      setMonthData(nextMonth);
      setSaleItem('');
      setSalePrice('');
    } catch (error) {
      setSaleError(error instanceof Error ? error.message : 'Failed to add sale');
    } finally {
      setSaleLoading(false);
    }
  }

  async function addAdjustment() {
    if (!token) {
      return;
    }

    setAdjustLoading(true);
    setAdjustError('');

    try {
      await apiRequest<DayResponse>(`/records/day/${selectedDate}/adjustments`, token, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(adjustAmount),
          reason: adjustReason,
          direction: adjustDirection
        })
      });
      const [nextDay, nextMonth] = await Promise.all([
        apiRequest<DayResponse>(`/records/day/${selectedDate}`, token),
        apiRequest<MonthResponse>(`/records/month/${selectedMonth}`, token)
      ]);
      setDayData(nextDay);
      setMonthData(nextMonth);
      setAdjustAmount('');
      setAdjustReason('');
      setAdjustDirection('+');
    } catch (error) {
      setAdjustError(error instanceof Error ? error.message : 'Failed to add adjustment');
    } finally {
      setAdjustLoading(false);
    }
  }

  function logout() {
    window.localStorage.removeItem('el-wekala-token');
    setToken(null);
    setUser(null);
    setMonthData(null);
    setDayData(null);
  }

  const slots = weekdayCount(selectedMonth);
  const dayMap = new Map(monthData?.days.map((day) => [day.date, day]) ?? []);
  const dailyTotal = dayData?.dayTotal ?? 0;
  const monthTotal = monthData?.total ?? 0;
  const selectedLocked = dayData?.locked ?? selectedDate > todayIsoDate();

  if (!token) {
    return (
      <main className="page-shell auth-page">
        <section className="auth-card">
          <div>
            <p className="eyebrow">El-Wekala Curtains</p>
            <h1>حسابات المحل اليومية</h1>
            <p className="lead">
              اعمل user جديد بباسورد قوي، وبعد تسجيل الدخول هتلاقي calendar جميل يوضح الأيام المفتوحة والمقفولة، مع
              تسجيل البيعات والفلوس التانية في نفس اليوم.
            </p>
          </div>

          <div className="auth-switch">
            <button className={authMode === 'register' ? 'chip active' : 'chip'} onClick={() => setAuthMode('register')}>
              create user
            </button>
            <button className={authMode === 'login' ? 'chip active' : 'chip'} onClick={() => setAuthMode('login')}>
              login
            </button>
          </div>

          <div className="form-stack">
            <label className="field">
              <span>اسم المستخدم</span>
              <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="مثال: bebonageh68" />
            </label>
            <label className="field">
              <span>كلمة المرور القوية</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="8 أحرف على الأقل + أرقام"
              />
            </label>
            <p className="help-text">لازم الباسورد يكون 8 حروف أو أكثر ويحتوي على حروف وأرقام.</p>
            {authError ? <p className="error-text">{authError}</p> : null}
            <button className="primary-button" onClick={handleAuthSubmit} disabled={authLoading}>
              {authLoading ? 'جارٍ التنفيذ...' : authMode === 'register' ? 'إنشاء الحساب' : 'دخول'}
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">El-Wekala Curtains</p>
          <h1>مرحبًا {user?.username ?? ''}</h1>
        </div>
        <div className="topbar-actions">
          <span className="topbar-badge">API: {apiUrl}</span>
          <button className="secondary-button" onClick={logout}>
            logout
          </button>
        </div>
      </header>

      <section className="hero-card dashboard-hero">
        <div className="hero-copy">
          <p className="eyebrow">calendar</p>
          <h2>الأيام اللي فاتت مفتوحة، واللي جاية مقفولة</h2>
          <p className="lead">
            اختار يوم من التقويم، وسجل البيعات والخصومات أو الإضافات. كل يوم ليه حساب منفصل، وإجمالي اليوم بيتحسب
            تلقائيًا في آخر الصفحة.
          </p>
        </div>

        <div className="month-toolbar">
          <button className="chip" onClick={() => setSelectedMonth((current) => shiftMonth(current, -1))}>
            السابق
          </button>
          <div className="month-title">{monthLabel(selectedMonth)}</div>
          <button className="chip" onClick={() => setSelectedMonth((current) => shiftMonth(current, 1))}>
            التالي
          </button>
        </div>

        <div className="calendar-grid">
          {['أحد', 'اثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'].map((day) => (
            <div key={day} className="weekday-cell">
              {day}
            </div>
          ))}

          {slots.map((slot, index) => {
            if (slot.type === 'empty') {
              return <div key={`empty-${index}`} className="calendar-empty" />;
            }

            const date = `${selectedMonth}-${String(slot.day).padStart(2, '0')}`;
            const day = dayMap.get(date);
            const locked = date > todayIsoDate();
            const active = date === selectedDate;

            return (
              <button
                key={date}
                className={locked ? 'day-card locked' : active ? 'day-card active' : 'day-card'}
                onClick={() => {
                  if (locked) {
                    return;
                  }

                  setSelectedDate(date);
                }}
                disabled={locked}
              >
                <span className="day-number">{slot.day}</span>
                <span className="day-status">{locked ? 'مقفول' : day ? 'مفتوح' : 'جاهز'}</span>
                <strong>{currency.format(day?.dayTotal ?? 0)}</strong>
              </button>
            );
          })}
        </div>
      </section>

      <section className="content-grid">
        <article className="panel-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">إنشاء بيعة</p>
              <h3>الصنف والسعر في كل عمود</h3>
            </div>
            <button className="secondary-button" onClick={() => void addSale()} disabled={selectedLocked || saleLoading}>
              إنشاء بيعة
            </button>
          </div>

          <div className="table-card">
            <div className="table-row table-head">
              <span>الصنف</span>
              <span>السعر</span>
            </div>
            {(dayData?.sales ?? []).map((sale, index) => (
              <div className="table-row" key={`${sale.item}-${index}`}>
                <span>{sale.item}</span>
                <span>{currency.format(sale.price)}</span>
              </div>
            ))}
            {!dayData?.sales?.length ? <div className="table-empty">مفيش بيعات مسجلة لليوم ده</div> : null}
          </div>

          <div className="form-stack compact">
            <label className="field">
              <span>الصنف</span>
              <input value={saleItem} onChange={(event) => setSaleItem(event.target.value)} placeholder="مثال: ستارة بلاك أوت" disabled={selectedLocked} />
            </label>
            <label className="field">
              <span>السعر</span>
              <input value={salePrice} onChange={(event) => setSalePrice(event.target.value)} placeholder="مثال: 1200" inputMode="decimal" disabled={selectedLocked} />
            </label>
            {saleError ? <p className="error-text">{saleError}</p> : null}
            <button className="primary-button" onClick={() => void addSale()} disabled={selectedLocked || saleLoading}>
              {saleLoading ? 'جارٍ الحفظ...' : 'حفظ البيعة'}
            </button>
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">فلوس تانية</p>
              <h3>زيادة أو خصم على اليوم</h3>
            </div>
            <button className="secondary-button" onClick={() => void addAdjustment()} disabled={selectedLocked || adjustLoading}>
              فلوس تانية
            </button>
          </div>

          <div className="adjust-toggle">
            <button className={adjustDirection === '+' ? 'chip active' : 'chip'} onClick={() => setAdjustDirection('+')}>
              +
            </button>
            <button className={adjustDirection === '-' ? 'chip active' : 'chip'} onClick={() => setAdjustDirection('-')}>
              -
            </button>
          </div>

          <div className="form-stack compact">
            <label className="field">
              <span>كام</span>
              <input value={adjustAmount} onChange={(event) => setAdjustAmount(event.target.value)} placeholder="مثال: 250" inputMode="decimal" disabled={selectedLocked} />
            </label>
            <label className="field">
              <span>ليه</span>
              <input value={adjustReason} onChange={(event) => setAdjustReason(event.target.value)} placeholder="مثال: مصاريف مواصلات" disabled={selectedLocked} />
            </label>
            {adjustError ? <p className="error-text">{adjustError}</p> : null}
            <button className="primary-button" onClick={() => void addAdjustment()} disabled={selectedLocked || adjustLoading}>
              {adjustLoading ? 'جارٍ الحفظ...' : 'تسجيل الحركة'}
            </button>
          </div>

          <div className="table-card adjustments-table">
            <div className="table-row table-head">
              <span>كام</span>
              <span>ليه</span>
              <span>نوع</span>
            </div>
            {(dayData?.adjustments ?? []).map((adjustment, index) => (
              <div className="table-row" key={`${adjustment.reason}-${index}`}>
                <span>{currency.format(adjustment.amount)}</span>
                <span>{adjustment.reason}</span>
                <span>{adjustment.direction === '+' ? 'إضافة' : 'خصم'}</span>
              </div>
            ))}
            {!dayData?.adjustments?.length ? <div className="table-empty">مفيش فلوس تانية مسجلة لليوم ده</div> : null}
          </div>
        </article>
      </section>

      <section className="summary-grid">
        <article className="metric-card">
          <span>تاريخ اليوم المختار</span>
          <strong>{selectedDate}</strong>
        </article>
        <article className="metric-card">
          <span>إجمالي اليوم</span>
          <strong>{currency.format(dailyTotal)}</strong>
        </article>
        <article className="metric-card">
          <span>إجمالي الشهر المعروض</span>
          <strong>{currency.format(monthTotal)}</strong>
        </article>
        <article className={selectedLocked ? 'metric-card locked' : 'metric-card open'}>
          <span>حالة اليوم</span>
          <strong>{selectedLocked ? 'مقفول' : 'مفتوح'}</strong>
        </article>
      </section>

      {pageError ? <p className="error-banner">{pageError}</p> : null}
    </main>
  );
}