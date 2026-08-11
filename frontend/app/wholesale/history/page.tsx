"use client";

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppNav } from '../../../components/app-nav';
import { useSession } from '../../../components/use-session';
import { useToast } from '../../../components/toast-context';
import { apiRequest, currency, isValidIsoDate, todayIsoDate } from '../../../lib/sales';
import {
  WholesaleHistoryResponse,
  WholesaleHistoryTransaction,
  WholesalePartyKind,
  WholesaleTransactionType,
  wholesaleTransactionLabel,
} from '../../../lib/wholesale';

type KindFilter = 'all' | WholesalePartyKind;

const transactionTypes: WholesaleTransactionType[] = [
  'sale_to_customer',
  'purchase_from_supplier',
  'sale_to_supplier',
  'payment_from_customer',
  'payment_to_supplier',
];

function isPayment(type: WholesaleTransactionType) {
  return type === 'payment_from_customer' || type === 'payment_to_supplier';
}

function partyKindLabel(kind: WholesalePartyKind) {
  return kind === 'customer' ? 'عميل' : 'مورد';
}

function historyQuery(kind: KindFilter, date: string | null) {
  const params = new URLSearchParams();
  if (kind !== 'all') params.set('kind', kind);
  if (date) params.set('date', date);
  const query = params.toString();
  return query ? `?${query}` : '';
}

function effectLabel(transaction: WholesaleHistoryTransaction) {
  if (Math.abs(transaction.balanceEffect) < 0.005) return 'لا يوجد متبقي';
  return transaction.balanceEffect > 0
    ? `زادت المستحقات ${currency.format(transaction.balanceEffect)}`
    : `تمت تسوية ${currency.format(Math.abs(transaction.balanceEffect))}`;
}

function itemDetails(item: { meters: number; price: number; tobs?: number }) {
  const tobs = Number(item.tobs);
  const baseDetails = `${item.meters} متر × ${currency.format(item.price)}`;

  return Number.isFinite(tobs) && tobs > 0
    ? `${baseDetails} · ${tobs} توب`
    : baseDetails;
}

function WholesaleHistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, ready } = useSession();
  const { showToast } = useToast();
  const requestedDate = searchParams.get('date');
  const initialDate = requestedDate && isValidIsoDate(requestedDate) && requestedDate <= todayIsoDate() ? requestedDate : null;
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate);
  const [kind, setKind] = useState<KindFilter>('all');
  const [history, setHistory] = useState<WholesaleHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);

    apiRequest<WholesaleHistoryResponse>(`/wholesale/history${historyQuery(kind, selectedDate)}`, token)
      .then((response) => {
        if (active) setHistory(response);
      })
      .catch((error: Error) => {
        if (active) {
          setHistory(null);
          showToast(error.message || 'تعذّر تحميل سجل الجملة.', 'error');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [kind, selectedDate, showToast, token]);

  const byType = history?.byType;
  const salesTotal = (byType?.sale_to_customer.total ?? 0) + (byType?.sale_to_supplier.total ?? 0);
  const purchasesTotal = byType?.purchase_from_supplier.total ?? 0;
  const receivedTotal = byType?.payment_from_customer.total ?? 0;
  const paidTotal = byType?.payment_to_supplier.total ?? 0;
  const days = history?.days ?? [];
  const shownTransactionTypes = useMemo(
    () => transactionTypes.filter((type) => (byType?.[type].count ?? 0) > 0),
    [byType]
  );

  function chooseDate(value: string) {
    if (!value || !isValidIsoDate(value) || value > todayIsoDate()) return;
    setSelectedDate(value);
    router.replace(`/wholesale/history?date=${value}`);
  }

  function showAllDays() {
    setSelectedDate(null);
    router.replace('/wholesale/history');
  }

  if (!ready || !token) return null;

  return (
    <section className="details-page">
      <div className="details-heading">
        <div>
          <span className="eyebrow">الجملة</span>
          <h2>{selectedDate ? `سجل الجملة ليوم ${selectedDate}` : 'سجل حركات الجملة'}</h2>
        </div>
        <Link className="text-button" href="/wholesale">حسابات العملاء والموردين</Link>
      </div>

      <section className="card-surface wholesale-history-controls" aria-label="فلترة سجل الجملة">
        <div className="history-filter-buttons">
          <button className={kind === 'all' ? 'active' : ''} onClick={() => setKind('all')} type="button">كل الحسابات</button>
          <button className={kind === 'customer' ? 'active' : ''} onClick={() => setKind('customer')} type="button">العملاء</button>
          <button className={kind === 'supplier' ? 'active' : ''} onClick={() => setKind('supplier')} type="button">الموردون</button>
        </div>
        <label className="history-date-filter">
          <span>تاريخ الحركة</span>
          <input
            className="form-input"
            dir="ltr"
            max={todayIsoDate()}
            onChange={(event) => chooseDate(event.target.value)}
            type="date"
            value={selectedDate ?? ''}
          />
        </label>
        {selectedDate && <button className="text-button history-all-days" onClick={showAllDays} type="button">عرض كل الأيام</button>}
      </section>

      {loading ? (
        <div className="details-loading card-surface">جارٍ تحميل سجل الجملة...</div>
      ) : (
        <>
          <div className="daily-stats sales-history-stats wholesale-history-stats">
            <div className="daily-stat primary"><span>بضاعة خارجة</span><strong>{currency.format(salesTotal)}</strong></div>
            <div className="daily-stat"><span>بضاعة من الموردين</span><strong>{currency.format(purchasesTotal)}</strong></div>
            <div className="daily-stat profit-stat"><span>دفعات مستلمة</span><strong>{currency.format(receivedTotal)}</strong></div>
            <div className="daily-stat remaining-stat"><span>دفعات للموردين</span><strong>{currency.format(paidTotal)}</strong></div>
            <div className="daily-stat"><span>عدد الحركات</span><strong>{history?.transactionCount ?? 0}</strong></div>
          </div>

          <article className="records-card card-surface">
            <div className="records-heading">
              <div>
                <span className="eyebrow">الحركات المسجلة</span>
                <h3>{selectedDate ? 'حركات اليوم المختار' : 'كل حركة مستقلة ومجمعة حسب اليوم'}</h3>
              </div>
              <span className="records-count">{history?.transactionCount ?? 0}</span>
            </div>

            {!days.length ? (
              <div className="empty-records"><p>{selectedDate ? 'لا توجد حركات جملة مسجلة لهذا اليوم.' : 'لا توجد حركات جملة مسجلة حتى الآن.'}</p></div>
            ) : (
              <div className="day-sales-list">
                {days.map((day) => (
                  <section className="day-sales-group" key={day.date}>
                    <header className="day-sales-header">
                      <div>
                        <span className="eyebrow">يوم الحركة</span>
                        <h4 dir="ltr">{day.date}</h4>
                      </div>
                      <div className="day-sales-total">
                        <span>{day.count} {day.count === 1 ? 'حركة' : 'حركات'}</span>
                        <strong>{currency.format(day.total)}</strong>
                        {day.paidTotal > 0 && <small>دفعات {currency.format(day.paidTotal)}</small>}
                        {Math.abs(day.balanceEffectTotal) > 0.005 && (
                          <small className={day.balanceEffectTotal > 0 ? 'receipt-profit' : 'amount-positive'}>
                            {day.balanceEffectTotal > 0 ? 'مستحقات ' : 'تسوية '}{currency.format(Math.abs(day.balanceEffectTotal))}
                          </small>
                        )}
                      </div>
                    </header>
                    <div className="receipt-list">
                      {day.transactions.map((transaction) => (
                        <details className="receipt-group" key={transaction._id}>
                          <summary className="receipt-header">
                            <span className="receipt-number">{wholesaleTransactionLabel(transaction.type)}</span>
                            <span className="receipt-meta">{transaction.partyName}</span>
                            <span className="receipt-method">{partyKindLabel(transaction.partyKind)}</span>
                            <strong>{currency.format(transaction.total)}</strong>
                            <span className="receipt-toggle" aria-hidden="true">⌄</span>
                          </summary>
                          <div className="wholesale-transaction-body">
                            <div className="wholesale-party-line">
                              <span>الحساب: <b>{transaction.partyName}</b></span>
                              <span dir="ltr">{transaction.partyPhone}</span>
                            </div>
                            {transaction.items.length > 0 && (
                              <div className="receipt-items">
                                {transaction.items.map((item, itemIndex) => (
                                  <div className="receipt-item" key={`${transaction._id}-${item.item}-${itemIndex}`}>
                                    <span>{item.item} <small>{itemDetails(item)}</small></span>
                                    <strong>{currency.format(item.price * item.meters)}</strong>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="receipt-payment-status wholesale-payment-status">
                              <div>
                                <span>{isPayment(transaction.type) ? 'قيمة الدفعة' : 'إجمالي الحركة'}</span>
                                <strong>{currency.format(transaction.total)}</strong>
                              </div>
                              <div className={transaction.balanceEffect > 0 ? 'remaining-due' : 'fully-paid'}>
                                <span>{transaction.balanceEffect > 0 ? 'المتبقي بالحساب' : 'التسوية بالحساب'}</span>
                                <strong>{currency.format(Math.abs(transaction.balanceEffect))}</strong>
                              </div>
                              <div className="wholesale-effect-tile">
                                <span>تأثير الحركة</span>
                                <strong>{effectLabel(transaction)}</strong>
                              </div>
                            </div>
                            <Link className="wholesale-account-link" href={`/wholesale/${transaction.partyId}?date=${day.date}`}>
                              فتح حساب {transaction.partyName}
                            </Link>
                          </div>
                        </details>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </article>

          {shownTransactionTypes.length > 0 && (
            <p className="wholesale-history-note">يعرض السجل البضاعة والدفعات لكل من العملاء والموردين، ومغلق افتراضيًا لتسهيل المراجعة.</p>
          )}
        </>
      )}
    </section>
  );
}

export default function WholesaleHistoryPage() {
  return (
    <AppNav>
      <Suspense fallback={<div className="page-loading">جارٍ تحميل سجل الجملة...</div>}>
        <WholesaleHistoryContent />
      </Suspense>
    </AppNav>
  );
}
