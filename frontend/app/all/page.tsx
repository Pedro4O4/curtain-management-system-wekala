"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppNav } from '../../components/app-nav';
import { useSession } from '../../components/use-session';
import { useToast } from '../../components/toast-context';
import { apiRequest, currency, DayResponse, isValidIsoDate, todayIsoDate } from '../../lib/sales';

export default function AllPage() {
  const router = useRouter();
  const { token, ready } = useSession();
  const { showToast } = useToast();
  const [selectedDate, setSelectedDate] = useState('');
  const [dayData, setDayData] = useState<DayResponse | null>(null);

  useEffect(() => {
    const today = todayIsoDate();
    setSelectedDate(today);
    window.localStorage.setItem('el-wekala-selected-date', today);
  }, []);

  useEffect(() => {
    if (!token || !selectedDate) return;
    let active = true;

    apiRequest<DayResponse>(`/records/day/${selectedDate}`, token)
      .then((data) => {
        if (active) setDayData(data);
      })
      .catch((error: Error) => {
        if (active) {
          setDayData(null);
          showToast(error.message || 'تعذّر تحميل حسابات اليوم', 'error');
        }
      });

    return () => {
      active = false;
    };
  }, [selectedDate, showToast, token]);

  const today = todayIsoDate();

  function chooseDate(nextDate: string) {
    if (!nextDate || !isValidIsoDate(nextDate) || nextDate > today) {
      showToast('اختر تاريخًا صحيحًا لا يتجاوز اليوم.', 'info');
      return false;
    }

    setSelectedDate(nextDate);
    window.localStorage.setItem('el-wekala-selected-date', nextDate);
    return true;
  }

  function openCreate(mode: 'sale' | 'adjustment') {
    if (!selectedDate) return;
    router.push(`/create?mode=${mode}&date=${selectedDate}`);
  }

  if (!ready) return null;

  return (
    <AppNav>
      <div className="retail-home">
        <section className="home-hero card-surface">
          <div>
            <span className="eyebrow">إدارة اليوم</span>
            <h2>كل حسابات محل الستائر في مكان واحد</h2>
            <p>اختَر التاريخ ثم سجّل البيع أو حركة الخزنة في ثوانٍ.</p>
          </div>
          <label className="date-control">
            <span>تاريخ الحساب</span>
            <input
              aria-label="تاريخ الحساب"
              className="form-input"
              dir="ltr"
              max={today}
              onChange={(event) => {
                if (!chooseDate(event.target.value)) event.currentTarget.value = selectedDate;
              }}
              type="date"
              value={selectedDate}
            />
          </label>
        </section>

        <section className="business-section" aria-labelledby="business-type-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">نوع البيع</span>
              <h2 id="business-type-title">اختر القسم</h2>
            </div>
          </div>
          <div className="business-switch">
            <button
              className="business-card active"
              type="button"
              aria-pressed="true"
              onClick={() => document.getElementById('retail-actions')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            >
              <span className="business-icon" aria-hidden="true">◈</span>
              <span>
                <strong>قطاعي</strong>
                <small>بيع مباشر للعملاء</small>
              </span>
              <span className="selected-mark" aria-hidden="true">✓</span>
            </button>
            <button
              className="business-card coming-soon"
              onClick={() => showToast('قسم الجملة سيكون متاحًا قريبًا.', 'info')}
              type="button"
            >
              <span className="business-icon muted" aria-hidden="true">▦</span>
              <span>
                <strong>جملة</strong>
                <small>قريبًا</small>
              </span>
              <span className="soon-badge">قريبًا</span>
            </button>
          </div>
        </section>

        <section className="retail-actions-section card-surface" id="retail-actions" aria-labelledby="retail-actions-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">قطاعي</span>
              <h2 id="retail-actions-title">ماذا تريد أن تسجّل؟</h2>
            </div>
            {selectedDate && (
              <button className="text-button" onClick={() => router.push(`/details?date=${selectedDate}`)} type="button">
                عرض ملخص اليوم
              </button>
            )}
          </div>
          <div className="quick-actions">
            <button className="quick-action sale-action" disabled={!selectedDate} onClick={() => openCreate('sale')} type="button">
              <span className="quick-action-icon" aria-hidden="true">+</span>
              <span>
                <strong>بيعة</strong>
                <small>سجّل صنفًا وسعره</small>
              </span>
              <span className="action-arrow" aria-hidden="true">‹</span>
            </button>
            <button className="quick-action adjustment-action" disabled={!selectedDate} onClick={() => openCreate('adjustment')} type="button">
              <span className="quick-action-icon" aria-hidden="true">±</span>
              <span>
                <strong>خصم أو زيادة</strong>
                <small>دخل أو خرج غير مرتبط ببيعة</small>
              </span>
              <span className="action-arrow" aria-hidden="true">‹</span>
            </button>
          </div>
          <div className="today-summary" aria-live="polite">
            <div>
              <span>المُحصّل اليوم</span>
              <strong>{currency.format(dayData?.saleTotal ?? 0)}</strong>
            </div>
            <div>
              <span>حركة الخزنة</span>
              <strong className={(dayData?.adjustmentTotal ?? 0) < 0 ? 'amount-negative' : 'amount-positive'}>
                {currency.format(dayData?.adjustmentTotal ?? 0)}
              </strong>
            </div>
            <div>
              <span>صافي اليوم</span>
              <strong>{currency.format(dayData?.dayTotal ?? 0)}</strong>
            </div>
          </div>
        </section>
      </div>
    </AppNav>
  );
}
