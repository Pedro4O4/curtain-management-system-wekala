"use client";

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppNav } from '../../components/app-nav';
import { useSession } from '../../components/use-session';
import { useToast } from '../../components/toast-context';
import { apiRequest, currency, DayResponse, isValidIsoDate, todayIsoDate } from '../../lib/sales';

function DetailsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, ready } = useSession();
  const { showToast } = useToast();
  const [date, setDate] = useState('');
  const [dayData, setDayData] = useState<DayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const dayRequestId = useRef(0);

  useEffect(() => {
    const requestedDate = searchParams.get('date');
    const today = todayIsoDate();
    const nextDate = requestedDate && isValidIsoDate(requestedDate) && requestedDate <= today ? requestedDate : today;
    if (nextDate !== date) {
      dayRequestId.current += 1;
      setDayData(null);
      setLoadError(null);
      setLoading(true);
      setDate(nextDate);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!token || !date) return;
    let active = true;
    const requestId = ++dayRequestId.current;
    setLoading(true);
    setDayData(null);
    setLoadError(null);

    apiRequest<DayResponse>(`/records/day/${date}`, token)
      .then((data) => {
        if (active && dayRequestId.current === requestId) setDayData(data);
      })
      .catch((error: Error) => {
        if (active && dayRequestId.current === requestId) {
          const message = error.message || 'تعذّر تحميل حسابات اليوم';
          setLoadError(message);
          showToast(message, 'error');
        }
      })
      .finally(() => {
        if (active && dayRequestId.current === requestId) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [date, reloadKey, showToast, token]);

  function changeDate(nextDate: string) {
    if (!isValidIsoDate(nextDate) || nextDate > todayIsoDate()) {
      showToast('اختر تاريخًا صحيحًا لا يتجاوز اليوم.', 'info');
      return false;
    }

    if (nextDate === date) return true;

    dayRequestId.current += 1;
    setDayData(null);
    setLoadError(null);
    setLoading(true);
    setDate(nextDate);
    return true;
  }

  if (!ready || !token) return null;

  return (
    <section className="details-page">
      <div className="details-toolbar card-surface">
        <button className="back-button" onClick={() => router.push('/all')} type="button">
          <span aria-hidden="true">›</span>
          الرئيسية
        </button>
        <label className="date-control compact">
          <span>تاريخ الحساب</span>
          <input
            aria-label="تاريخ الحساب"
            className="form-input"
            dir="ltr"
            max={todayIsoDate()}
            onChange={(event) => {
              if (!changeDate(event.target.value)) event.currentTarget.value = date;
            }}
            type="date"
            value={date}
          />
        </label>
        <div className="details-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => router.push(`/create?mode=adjustment&date=${date}`)} type="button">خصم أو زيادة</button>
          <button className="btn btn-primary btn-sm" onClick={() => router.push(`/create?mode=sale&date=${date}`)} type="button">+ بيعة</button>
        </div>
      </div>

      <div className="details-heading">
        <span className="eyebrow">ملخص اليوم</span>
        <h2>{date || '...'}</h2>
      </div>

      {loading ? (
        <div className="details-loading card-surface">جارٍ تحميل الحسابات...</div>
      ) : loadError ? (
        <div className="summary-error card-surface">
          <p>تعذّر تحميل حسابات هذا اليوم.</p>
          <button className="text-button" onClick={() => setReloadKey((value) => value + 1)} type="button">إعادة المحاولة</button>
        </div>
      ) : (
        <>
          <div className="daily-stats">
            <div className="daily-stat primary"><span>صافي اليوم</span><strong>{currency.format(dayData?.dayTotal ?? 0)}</strong></div>
            <div className="daily-stat"><span>المُحصّل من البيع</span><strong>{currency.format(dayData?.saleTotal ?? 0)}</strong></div>
            <div className="daily-stat"><span>دخل / خرج مستقل</span><strong className={(dayData?.adjustmentTotal ?? 0) < 0 ? 'amount-negative' : 'amount-positive'}>{currency.format(dayData?.adjustmentTotal ?? 0)}</strong></div>
            <div className="daily-stat"><span>عدد البيعات</span><strong>{dayData?.receipts.length ?? 0}</strong></div>
          </div>

          <article className="records-card card-surface">
            <div className="records-heading">
              <div>
                <span className="eyebrow">المبيعات</span>
                <h3>بيوع اليوم</h3>
              </div>
              <span className="records-count">{dayData?.receipts.length ?? 0}</span>
            </div>
            {!dayData?.receipts.length ? (
              <div className="empty-records">
                <p>لا توجد مبيعات مسجلة لهذا اليوم.</p>
                <button className="text-button" onClick={() => router.push(`/create?mode=sale&date=${date}`)} type="button">سجّل أول بيعة</button>
              </div>
            ) : (
              <div className="receipt-list daily-receipt-list">
                {dayData.receipts.map((sale, index) => (
                  <details className="receipt-group" key={`${sale.number ?? 'legacy'}-${index}`} open>
                    <summary className="receipt-header">
                      <span className="receipt-number">{sale.number === null ? 'بيعة قديمة' : `بيعة رقم ${sale.number}`}</span>
                      <span className="receipt-meta">{sale.items.length} {sale.items.length === 1 ? 'صنف' : 'أصناف'}</span>
                      <strong>{currency.format(sale.total)}</strong>
                      <span className="receipt-toggle" aria-hidden="true">⌄</span>
                    </summary>
                    <div className="receipt-items">
                      {sale.items.map((item, itemIndex) => (
                        <div className="receipt-item" key={`${item.item}-${itemIndex}`}>
                          <span>{item.item}</span>
                          <strong>{currency.format(item.price)}</strong>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </article>

          <article className="records-card card-surface">
            <div className="records-heading">
              <div>
                <span className="eyebrow">الخزنة</span>
                <h3>خصم وزيادة</h3>
              </div>
              <span className="records-count">{dayData?.adjustments.length ?? 0}</span>
            </div>
            {!dayData?.adjustments.length ? (
              <div className="empty-records">
                <p>لا توجد حركة نقدية مستقلة لهذا اليوم.</p>
                <button className="text-button" onClick={() => router.push(`/create?mode=adjustment&date=${date}`)} type="button">سجّل حركة خزنة</button>
              </div>
            ) : (
              <div className="records-list">
                {dayData.adjustments.map((adjustment, index) => (
                  <div className="record-row" key={`${adjustment.reason}-${index}`}>
                    <span className={`movement-mark ${adjustment.direction === '+' ? 'income' : 'expense'}`} aria-label={adjustment.direction === '+' ? 'زيادة' : 'خصم'}>
                      {adjustment.direction === '+' ? '↑' : '↓'}
                    </span>
                    <span className="record-label">
                      {adjustment.reason}
                      <small>{adjustment.direction === '+' ? 'زيادة / دخل' : 'خصم / خرج'}</small>
                    </span>
                    <strong className={adjustment.direction === '+' ? 'amount-positive' : 'amount-negative'}>
                      {adjustment.direction === '+' ? '+' : '-'}{currency.format(adjustment.amount)}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </article>
        </>
      )}
    </section>
  );
}

export default function DetailsPage() {
  return (
    <AppNav>
      <Suspense fallback={<div className="page-loading">جارٍ التحميل...</div>}>
        <DetailsContent />
      </Suspense>
    </AppNav>
  );
}
