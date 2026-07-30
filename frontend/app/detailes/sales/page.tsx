"use client";

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppNav } from '../../../components/app-nav';
import { useSession } from '../../../components/use-session';
import { useToast } from '../../../components/toast-context';
import { apiRequest, currency, isValidIsoDate, SalesListResponse } from '../../../lib/sales';

function SalesHistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, ready } = useSession();
  const { showToast } = useToast();
  const [salesData, setSalesData] = useState<SalesListResponse | null>(null);
  const [loading, setLoading] = useState(true);
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
    }));
  }, [visibleSales]);

  const visibleTotal = visibleSales.reduce((sum, sale) => sum + sale.total, 0);

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
            <div className="daily-stat primary"><span>إجمالي المبيعات</span><strong>{currency.format(visibleTotal)}</strong></div>
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
                        <strong>{currency.format(day.total)}</strong>
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
