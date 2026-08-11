"use client";

import { FormEvent, Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppNav } from '../../components/app-nav';
import { useSession } from '../../components/use-session';
import { useToast } from '../../components/toast-context';
import { apiRequest, currency, DayResponse, isValidIsoDate, Product, todayIsoDate } from '../../lib/sales';

type EntryMode = 'sale' | 'adjustment';
type SaleDraft = { id: string; item: string; price: string; meters: string };

const arabicSorter = new Intl.Collator('ar', { sensitivity: 'base' });

function newSaleRow(): SaleDraft {
  return { id: crypto.randomUUID(), item: '', price: '', meters: '' };
}

function isUsableDate(value: string | null) {
  return Boolean(value && isValidIsoDate(value) && value <= todayIsoDate());
}

function CreateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, ready } = useSession();
  const { showToast } = useToast();
  const [selectedDate, setSelectedDate] = useState('');
  const [mode, setMode] = useState<EntryMode>('sale');
  const [saleRows, setSaleRows] = useState<SaleDraft[]>([newSaleRow()]);
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'instapay' | 'wallet'>('cash');
  const [direction, setDirection] = useState<'+' | '-'>('+');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [summary, setSummary] = useState<DayResponse | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryRefreshKey, setSummaryRefreshKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [focusLastItem, setFocusLastItem] = useState(false);
  const lastItemRef = useRef<HTMLInputElement | null>(null);
  const summaryRequestId = useRef(0);

  useEffect(() => {
    const requestedDate = searchParams.get('date');
    const nextDate = isUsableDate(requestedDate) ? requestedDate! : todayIsoDate();
    if (nextDate !== selectedDate) {
      summaryRequestId.current += 1;
      setSummary(null);
      setSummaryError(null);
      setLoadingSummary(true);
      setSelectedDate(nextDate);
    }
    setMode(searchParams.get('mode') === 'adjustment' ? 'adjustment' : 'sale');
  }, [searchParams]);

  useEffect(() => {
    if (!token || !selectedDate) return;

    let active = true;
    const requestId = ++summaryRequestId.current;
    setLoadingSummary(true);
    setSummary(null);
    setSummaryError(null);

    apiRequest<DayResponse>(`/records/day/${selectedDate}`, token)
      .then((data) => {
        if (active && summaryRequestId.current === requestId) setSummary(data);
      })
      .catch((error: unknown) => {
        if (active && summaryRequestId.current === requestId) {
          const message = error instanceof Error ? error.message : 'تعذّر تحميل ملخص اليوم';
          setSummaryError(message);
          showToast(message, 'error');
        }
      })
      .finally(() => {
        if (active && summaryRequestId.current === requestId) setLoadingSummary(false);
      });

    return () => {
      active = false;
    };
  }, [selectedDate, showToast, summaryRefreshKey, token]);

  useEffect(() => {
    if (!token) return;
    apiRequest<Product[]>('/products', token)
      .then((items) => setProducts([...items].sort((first, second) => arabicSorter.compare(first.name, second.name))))
      .catch(() => setProducts([]));
  }, [token]);

  useEffect(() => {
    if (!focusLastItem) return;
    lastItemRef.current?.focus();
    setFocusLastItem(false);
  }, [focusLastItem, saleRows.length]);

  function updateSaleRow(id: string, field: 'item' | 'price' | 'meters', value: string) {
    setSaleRows((rows) => rows.map((row) => row.id === id ? { ...row, [field]: value } : row));
  }

  function removeSaleRow(id: string) {
    setSaleRows((rows) => rows.length === 1 ? rows : rows.filter((row) => row.id !== id));
  }

  function addSaleRow() {
    setSaleRows((rows) => [...rows, newSaleRow()]);
    setFocusLastItem(true);
  }

  function changeDate(nextDate: string) {
    if (!isUsableDate(nextDate)) {
      showToast('اختر تاريخًا صحيحًا لا يتجاوز اليوم.', 'info');
      return false;
    }

    if (nextDate === selectedDate) return true;

    summaryRequestId.current += 1;
    setSummary(null);
    setSummaryError(null);
    setLoadingSummary(true);
    setSelectedDate(nextDate);
    return true;
  }

  async function saveSales(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const rowsToSave = saleRows.map((row) => ({ item: row.item.trim(), price: Number(row.price), meters: Number(row.meters) }));
    const totalToSave = rowsToSave.reduce((total, row) => total + (Number.isFinite(row.price) && Number.isFinite(row.meters) ? row.price * row.meters : 0), 0);
    const paidToSave = paidAmount === '' ? totalToSave : Number(paidAmount);
    const hasIncompleteRow = rowsToSave.some((row) => !row.item || !Number.isFinite(row.price) || row.price <= 0 || !Number.isFinite(row.meters) || row.meters <= 0);

    if (hasIncompleteRow) {
      showToast('اكتب الصنف والسعر وعدد الأمتار الصحيح في كل صف أولًا.', 'info');
      return;
    }

    if (!Number.isFinite(paidToSave) || paidToSave < 0 || paidToSave > totalToSave) {
      showToast('اكتب المبلغ المدفوع بشكل صحيح، ولا يمكن أن يكون أكبر من إجمالي البيعة.', 'info');
      return;
    }

    if (!token || !selectedDate) return;
    setSaving(true);

    try {
      const response = await apiRequest<DayResponse>(`/records/day/${selectedDate}/sales/bulk`, token, {
        method: 'POST',
        body: JSON.stringify({ sales: rowsToSave, paidAmount: paidToSave, paymentMethod }),
      });
      summaryRequestId.current += 1;
      setSummary(response);
      setSummaryError(null);
      setLoadingSummary(false);
      setSaleRows([newSaleRow()]);
      setPaidAmount('');
      setPaymentMethod('cash');
      showToast(
        `تم تسجيل بيعة رقم ${response.createdReceipt?.number ?? ''} بنجاح.`,
        'success'
      );
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : 'تعذّر تسجيل البيعة', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = Number(amount);

    if (!reason.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      showToast('اكتب السبب والمبلغ الصحيح أولًا.', 'info');
      return;
    }

    if (!token || !selectedDate) return;
    setSaving(true);

    try {
      const response = await apiRequest<DayResponse>(`/records/day/${selectedDate}/adjustments`, token, {
        method: 'POST',
        body: JSON.stringify({ amount: parsedAmount, reason: reason.trim(), direction }),
      });
      summaryRequestId.current += 1;
      setSummary(response);
      setSummaryError(null);
      setLoadingSummary(false);
      setAmount('');
      setReason('');
      showToast(direction === '+' ? 'تم تسجيل الزيادة في الخزنة.' : 'تم تسجيل الخصم من الخزنة.', 'success');
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : 'تعذّر تسجيل الحركة', 'error');
    } finally {
      setSaving(false);
    }
  }

  const saleTotal = saleRows.reduce((total, row) => total + ((Number(row.price) || 0) * (Number(row.meters) || 0)), 0);
  const enteredPaidAmount = Number(paidAmount);
  const currentPaidAmount = paidAmount === '' ? saleTotal : Number.isFinite(enteredPaidAmount) ? Math.min(Math.max(enteredPaidAmount, 0), saleTotal) : 0;
  const currentRemainingAmount = saleTotal - currentPaidAmount;
  const today = todayIsoDate();

  if (!ready || !token) return null;

  return (
    <section className="retail-workspace">
      <div className="workspace-bar">
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
            max={today}
            onChange={(event) => {
              if (!changeDate(event.target.value)) event.currentTarget.value = selectedDate;
            }}
            type="date"
            value={selectedDate}
          />
        </label>
      </div>

      <div className="workspace-heading">
        <span className="eyebrow">قطاعي</span>
        <h2>{mode === 'sale' ? 'سجّل بيعة جديدة' : 'سجّل حركة للخزنة'}</h2>
        <p>{mode === 'sale' ? 'اكتب الصنف والسعر ثم اضغط تأكيد وتسجيل.' : 'هذه حركة نقدية لا ترتبط بأي بيعة.'}</p>
      </div>

      <div className="entry-mode-switch" role="tablist" aria-label="نوع التسجيل">
        <button
          aria-selected={mode === 'sale'}
          className={mode === 'sale' ? 'active' : ''}
          onClick={() => setMode('sale')}
          role="tab"
          type="button"
        >
          <span aria-hidden="true">+</span>
          بيعة
        </button>
        <button
          aria-selected={mode === 'adjustment'}
          className={mode === 'adjustment' ? 'active' : ''}
          onClick={() => setMode('adjustment')}
          role="tab"
          type="button"
        >
          <span aria-hidden="true">±</span>
          الخزنة
        </button>
      </div>

      <div className="entry-layout">
        <div className="entry-card card-surface">
          {mode === 'sale' ? (
            <form onSubmit={saveSales}>
              <datalist id="curtain-types">
                {products.map((product) => <option key={product._id} value={product.name} />)}
              </datalist>
              <div className="entry-card-heading">
                <div>
                  <h3>بيعة جديدة</h3>
                  <p>يمكنك إضافة أكثر من صنف في نفس التسجيل.</p>
                </div>
                <span className="entry-count">{saleRows.length} {saleRows.length === 1 ? 'صنف' : 'أصناف'}</span>
              </div>

              <div className="sale-table">
                <div className="sale-table-head" aria-hidden="true">
                  <span>الصنف</span>
                  <span>سعر المتر</span>
                  <span>عدد الأمتار</span>
                  <span />
                </div>
                {saleRows.map((row, index) => (
                  <div className="sale-entry-row" key={row.id}>
                    <label className="sr-only" htmlFor={`item-${row.id}`}>الصنف رقم {index + 1}</label>
                    <div className="sale-item-field">
                      <span aria-hidden="true">الصنف</span>
                      <input
                        autoFocus={index === 0}
                        className="form-input"
                        id={`item-${row.id}`}
                        list="curtain-types"
                        onChange={(event) => updateSaleRow(row.id, 'item', event.target.value)}
                        ref={index === saleRows.length - 1 ? lastItemRef : undefined}
                        type="text"
                        value={row.item}
                      />
                    </div>
                    <label className="sr-only" htmlFor={`price-${row.id}`}>سعر المتر للصنف رقم {index + 1}</label>
                    <div className="sale-numeric-field price-field">
                      <span>سعر المتر</span>
                      <div className="money-input no-suffix">
                        <input
                          className="form-input"
                          dir="ltr"
                          id={`price-${row.id}`}
                          inputMode="decimal"
                          min="0"
                          onChange={(event) => updateSaleRow(row.id, 'price', event.target.value)}
                          step="0.01"
                          type="number"
                          value={row.price}
                        />
                      </div>
                    </div>
                    <label className="sr-only" htmlFor={`meters-${row.id}`}>عدد الأمتار للصنف رقم {index + 1}</label>
                    <div className="sale-numeric-field meter-field">
                      <span>عدد الأمتار</span>
                      <input
                        className="form-input meters-input"
                        dir="ltr"
                        id={`meters-${row.id}`}
                        inputMode="decimal"
                        min="0.01"
                        onChange={(event) => updateSaleRow(row.id, 'meters', event.target.value)}
                        step="0.01"
                        type="number"
                        value={row.meters}
                      />
                    </div>
                    <button
                      aria-label={`حذف الصنف رقم ${index + 1}`}
                      className="remove-row"
                      disabled={saleRows.length === 1}
                      onClick={() => removeSaleRow(row.id)}
                      title="حذف الصنف"
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <button className="add-row-button" onClick={addSaleRow} type="button">
                <span aria-hidden="true">+</span>
                إضافة صنف آخر
              </button>

              <div className="entry-total">
                <div>
                  <span>إجمالي البيعة</span>
                  <strong>{currency.format(saleTotal)}</strong>
                </div>
                <div>
                  <span>المدفوع</span>
                  <strong>{currency.format(currentPaidAmount)}</strong>
                </div>
                <div className={currentRemainingAmount > 0 ? 'entry-remaining' : ''}>
                  <span>المتبقي</span>
                  <strong>{currency.format(currentRemainingAmount)}</strong>
                </div>
              </div>
              <label className="form-group sale-payment-field" htmlFor="paid-amount">
                <span className="form-label">المدفوع الآن <small>(اتركه فارغًا للدفع الكامل)</small></span>
                <input
                  className="form-input"
                  dir="ltr"
                  id="paid-amount"
                  inputMode="decimal"
                  min="0"
                  onChange={(event) => setPaidAmount(event.target.value)}
                  step="0.01"
                  type="number"
                  value={paidAmount}
                />
              </label>
              <label className="form-group payment-method-field" htmlFor="payment-method">
                <span className="form-label">طريقة الدفع</span>
                <select className="form-input" id="payment-method" onChange={(event) => setPaymentMethod(event.target.value as 'cash' | 'instapay' | 'wallet')} value={paymentMethod}>
                  <option value="cash">كاش</option>
                  <option value="instapay">InstaPay</option>
                  <option value="wallet">محفظة</option>
                </select>
              </label>
              <button className="btn btn-primary confirm-button" disabled={saving} type="submit">
                {saving ? 'جارٍ التسجيل...' : 'تأكيد وتسجيل البيعة'}
              </button>
            </form>
          ) : (
            <form onSubmit={saveAdjustment}>
              <div className="entry-card-heading">
                <div>
                  <h3>الخزنة</h3>
                  <p>حركة نقدية مستقلة عن المبيعات.</p>
                </div>
              </div>

              <div className="movement-type" aria-label="نوع الحركة">
                <button
                  aria-pressed={direction === '+'}
                  className={direction === '+' ? 'active income' : ''}
                  onClick={() => setDirection('+')}
                  type="button"
                >
                  <span aria-hidden="true">↑</span>
                  زيادة / دخل
                </button>
                <button
                  aria-pressed={direction === '-'}
                  className={direction === '-' ? 'active expense' : ''}
                  onClick={() => setDirection('-')}
                  type="button"
                >
                  <span aria-hidden="true">↓</span>
                  خصم / خرج
                </button>
              </div>

              <div className="movement-fields">
                <label className="form-group" htmlFor="adjustment-reason">
                  <span className="form-label">البيان أو السبب</span>
                  <input
                    className="form-input"
                    id="adjustment-reason"
                    onChange={(event) => setReason(event.target.value)}
                    type="text"
                    value={reason}
                  />
                </label>
                <label className="form-group" htmlFor="adjustment-amount">
                  <span className="form-label">المبلغ</span>
                  <div className="money-input full-width">
                    <input
                      className="form-input"
                      dir="ltr"
                      id="adjustment-amount"
                      inputMode="decimal"
                      min="0"
                      onChange={(event) => setAmount(event.target.value)}
                      step="0.01"
                      type="number"
                      value={amount}
                    />
                    <span>ج.م</span>
                  </div>
                </label>
              </div>

              <button className="btn btn-primary confirm-button" disabled={saving} type="submit">
                {saving ? 'جارٍ التسجيل...' : direction === '+' ? 'تأكيد وتسجيل الزيادة' : 'تأكيد وتسجيل الخصم'}
              </button>
              <button className="cash-reasons-button" onClick={() => router.push(`/details?date=${selectedDate}&view=cash`)} type="button">
                عرض كل أسباب حركة الخزنة
              </button>
            </form>
          )}
        </div>

        <aside className="day-summary-card card-surface" aria-live="polite">
          <div className="summary-card-heading">
            <div>
              <span className="eyebrow">ملخص اليوم</span>
              <h3>{selectedDate || '...'}</h3>
            </div>
            <button className="text-button" onClick={() => selectedDate && router.push(`/details?date=${selectedDate}`)} type="button">
              التفاصيل
            </button>
          </div>
          {loadingSummary ? (
            <div className="summary-loading">جارٍ تحميل الحسابات...</div>
          ) : summaryError ? (
            <div className="summary-error">
              <p>تعذّر تحميل ملخص هذا اليوم.</p>
              <button className="text-button" onClick={() => setSummaryRefreshKey((value) => value + 1)} type="button">إعادة المحاولة</button>
            </div>
          ) : (
            <div className="summary-lines">
              <div><span>عدد البيعات</span><strong>{summary?.receipts.length ?? 0}</strong></div>
              <div><span>المُحصّل من البيع</span><strong>{currency.format(summary?.saleTotal ?? 0)}</strong></div>
              <div><span>دخل / خرج</span><strong className={(summary?.adjustmentTotal ?? 0) < 0 ? 'amount-negative' : 'amount-positive'}>{currency.format(summary?.adjustmentTotal ?? 0)}</strong></div>
              <div className="summary-net"><span>صافي اليوم</span><strong>{currency.format(summary?.dayTotal ?? 0)}</strong></div>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

export default function CreatePage() {
  return (
    <AppNav>
      <Suspense fallback={<div className="page-loading">جارٍ التحميل...</div>}>
        <CreateContent />
      </Suspense>
    </AppNav>
  );
}
