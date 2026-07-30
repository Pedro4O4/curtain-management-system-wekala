"use client";

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppNav } from '../../../components/app-nav';
import { useSession } from '../../../components/use-session';
import { useToast } from '../../../components/toast-context';
import { apiRequest, currency, isValidIsoDate, SalesListResponse, SaleReceipt, todayIsoDate } from '../../../lib/sales';

function SalesHistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, ready } = useSession();
  const { showToast } = useToast();
  const [salesData, setSalesData] = useState<SalesListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentAmounts, setPaymentAmounts] = useState<Record<number, string>>({});
  const [savingPayment, setSavingPayment] = useState<number | null>(null);
  const requestedDate = searchParams.get('date');
  const selectedDate = requestedDate && isValidIsoDate(requestedDate) ? requestedDate : null;

  useEffect(() => {
    if (!token) return;
    let active = true;

    apiRequest<SalesListResponse>('/records/sales', token)
      .then((data) => {
        if (active) setSalesData(data);
      })
      .catch((error: Error) => {
        if (active) showToast(error.message || 'تعذّر تحميل سجل المبيعات', 'error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [showToast, token]);

  const visibleSales = useMemo(
    () => selectedDate ? (salesData?.sales ?? []).filter((sale) => sale.date === selectedDate) : (salesData?.sales ?? []),
    [salesData, selectedDate]
  );

  const salesByDay = useMemo(() => {
    const grouped = new Map<string, SalesListResponse['sales']>();

    for (const sale of visibleSales) {
      grouped.set(sale.date, [...(grouped.get(sale.date) ?? []), sale]);
    }

    return Array.from(grouped, ([date, sales]) => ({
      date,
      sales,
      total: sales.reduce((sum, sale) => sum + sale.total, 0),
      paid: sales.reduce((sum, sale) => sum + sale.paidAmount, 0),
      remaining: sales.reduce((sum, sale) => sum + sale.remainingAmount, 0),
    }));
  }, [visibleSales]);

  const visiblePaidTotal = visibleSales.reduce((sum, sale) => sum + sale.paidAmount, 0);
  const visibleRemainingTotal = visibleSales.reduce((sum, sale) => sum + sale.remainingAmount, 0);

  async function savePayment(sale: SalesListResponse['sales'][number]) {
    if (sale.number === null || !token) return;
    const amount = Number(paymentAmounts[sale.number]);
    if (!Number.isFinite(amount) || amount <= 0 || amount > sale.remainingAmount) {
      showToast('اكتب مبلغًا صحيحًا لا يزيد عن المتبقي.', 'info');
      return;
    }

    setSavingPayment(sale.number);
    try {
      const updated = await apiRequest<SaleReceipt>(`/records/sales/${sale.number}/payments`, token, {
        method: 'POST',
        body: JSON.stringify({ amount, date: todayIsoDate() }),
      });
      setSalesData((current) => current ? {
        ...current,
        sales: current.sales.map((entry) => entry.number === sale.number ? { ...entry, ...updated } : entry),
      } : current);
      setPaymentAmounts((current) => ({ ...current, [sale.number!]: '' }));
      showToast('تم تسجيل الدفعة وتحديث المتبقي.', 'success');
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : 'تعذّر تسجيل الدفعة.', 'error');
    } finally {
      setSavingPayment(null);
    }
  }

  if (!ready || !token) return null;

  return (
    <section className="details-page">
      <div className="details-heading">
        <span className="eyebrow">المبيعات</span>
        <h2>{selectedDate ? `مبيعات يوم ${selectedDate}` : 'سجل البيوع'}</h2>
        {selectedDate && (
          <button className="text-button history-all-days" onClick={() => router.push('/detailes/sales')} type="button">
            عرض كل الأيام
          </button>
        )}
      </div>

      {loading ? (
        <div className="details-loading card-surface">جارٍ تحميل المبيعات...</div>
      ) : (
        <>
          <div className="daily-stats sales-history-stats">
            <div className="daily-stat primary"><span>إجمالي المُحصّل</span><strong>{currency.format(visiblePaidTotal)}</strong></div>
            <div className="daily-stat remaining-stat"><span>إجمالي المتبقي</span><strong>{currency.format(visibleRemainingTotal)}</strong></div>
            <div className="daily-stat"><span>عدد البيعات</span><strong>{visibleSales.length}</strong></div>
          </div>
          <article className="records-card card-surface">
            <div className="records-heading">
              <div>
                <span className="eyebrow">البيوع المسجلة</span>
                <h3>{selectedDate ? 'بيوع اليوم المختار' : 'كل بيعة مستقلة برقمها'}</h3>
              </div>
              <span className="records-count">{visibleSales.length}</span>
            </div>
            {!visibleSales.length ? (
              <div className="empty-records"><p>{selectedDate ? 'لا توجد مبيعات مسجلة لهذا اليوم.' : 'لا توجد مبيعات مسجلة حتى الآن.'}</p></div>
            ) : (
              <div className="day-sales-list">
                {salesByDay.map((day) => (
                  <section className="day-sales-group" key={day.date}>
                    <header className="day-sales-header">
                      <div>
                        <span className="eyebrow">يوم البيع</span>
                        <h4 dir="ltr">{day.date}</h4>
                      </div>
                      <div className="day-sales-total">
                        <span>{day.sales.length} {day.sales.length === 1 ? 'بيعة' : 'بيعات'}</span>
                        <strong>{currency.format(day.paid)}</strong>
                        {day.remaining > 0 && <small>متبقي {currency.format(day.remaining)}</small>}
                      </div>
                    </header>
                    <div className="receipt-list">
                      {day.sales.map((sale, index) => (
                        <details className="receipt-group" key={`${sale.number ?? 'legacy'}-${index}`} open={index === 0}>
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
                          {!sale.legacy && (
                            <div className="receipt-payment-status">
                              <div>
                                <span>المدفوع</span>
                                <strong>{currency.format(sale.paidAmount)}</strong>
                              </div>
                              <div className={sale.remainingAmount > 0 ? 'remaining-due' : 'fully-paid'}>
                                <span>{sale.remainingAmount > 0 ? 'المتبقي' : 'تم السداد'}</span>
                                <strong>{currency.format(sale.remainingAmount)}</strong>
                              </div>
                            </div>
                          )}
                          {!sale.legacy && sale.remainingAmount > 0 && sale.number !== null && (
                            <form className="receipt-payment-form" onSubmit={(event) => { event.preventDefault(); void savePayment(sale); }}>
                              <label htmlFor={`payment-${sale.number}`}>تسجيل دفعة جديدة</label>
                              <input
                                className="form-input"
                                dir="ltr"
                                id={`payment-${sale.number}`}
                                inputMode="decimal"
                                max={sale.remainingAmount}
                                min="0"
                                onChange={(event) => setPaymentAmounts((current) => ({ ...current, [sale.number!]: event.target.value }))}
                                step="0.01"
                                type="number"
                                value={paymentAmounts[sale.number] ?? ''}
                              />
                              <button className="btn btn-primary" disabled={savingPayment === sale.number} type="submit">
                                {savingPayment === sale.number ? 'جارٍ الحفظ...' : 'تسجيل الدفعة'}
                              </button>
                            </form>
                          )}
                        </details>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </article>
        </>
      )}
    </section>
  );
}

export default function SalesDetailsPage() {
  return (
    <AppNav>
      <Suspense fallback={<div className="page-loading">جارٍ التحميل...</div>}>
        <SalesHistoryContent />
      </Suspense>
    </AppNav>
  );
}
