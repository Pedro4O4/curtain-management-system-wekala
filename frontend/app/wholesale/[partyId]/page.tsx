"use client";

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AppNav } from '../../../components/app-nav';
import { useSession } from '../../../components/use-session';
import { useToast } from '../../../components/toast-context';
import { apiRequest, currency, isValidIsoDate, Product, todayIsoDate } from '../../../lib/sales';
import {
  createWholesaleDraftItem,
  WholesaleAccount,
  WholesaleDraftItem,
  WholesaleTransaction,
  WholesaleTransactionType,
  wholesaleBalanceLabel,
  wholesaleTransactionLabel,
} from '../../../lib/wholesale';
import styles from '../wholesale.module.css';

type AccountAction = WholesaleTransactionType;

type ActionOption = {
  type: AccountAction;
  title: string;
  description: string;
  icon: string;
};

const arabicSorter = new Intl.Collator('ar', { sensitivity: 'base', numeric: true });

function actionOptions(kind: 'customer' | 'supplier'): ActionOption[] {
  if (kind === 'customer') {
    return [
      { type: 'sale_to_customer', title: 'بضاعة للعميل', description: 'سجّل الأصناف التي أخذها العميل', icon: '+' },
      { type: 'payment_from_customer', title: 'دفعة من العميل', description: 'خصم مبلغ مدفوع من حسابه', icon: '↓' },
    ];
  }

  return [
    { type: 'purchase_from_supplier', title: 'بضاعة من المورد', description: 'سجّل ما أخذته من المورد', icon: '+' },
    { type: 'payment_to_supplier', title: 'دفعة للمورد', description: 'سجّل مبلغًا دفعته للمورد', icon: '↓' },
    { type: 'sale_to_supplier', title: 'المورد أخذ بضاعة', description: 'تُخصم قيمتها من حساب المورد', icon: '↔' },
  ];
}

function actionHeading(action: AccountAction) {
  const headings: Record<AccountAction, { eyebrow: string; title: string; helper: string }> = {
    sale_to_customer: {
      eyebrow: 'حركة بضاعة',
      title: 'بضاعة أخذها العميل',
      helper: 'اكتب سعر البيع للمتر وعدد الأمتار لكل صنف.',
    },
    payment_from_customer: {
      eyebrow: 'حركة سداد',
      title: 'دفعة استلمتها من العميل',
      helper: 'سجّل المبلغ الذي دفعه العميل ليُخصم من المتبقي عليه.',
    },
    purchase_from_supplier: {
      eyebrow: 'حركة بضاعة',
      title: 'بضاعة أخذتها من المورد',
      helper: 'يُسجّل المتبقي بعد الدفعة في حساب المورد.',
    },
    payment_to_supplier: {
      eyebrow: 'حركة سداد',
      title: 'دفعة دفعتها للمورد',
      helper: 'سجّل المبلغ المدفوع ليُخصم من حساب المورد.',
    },
    sale_to_supplier: {
      eyebrow: 'تسوية بالحركة',
      title: 'بضاعة أخذها المورد منك',
      helper: 'قيمة هذه البضاعة تُخصم مباشرة من حساب المورد.',
    },
  };

  return headings[action];
}

function isPaymentAction(action: AccountAction) {
  return action === 'payment_from_customer' || action === 'payment_to_supplier';
}

function balanceClass(balance: number) {
  if (balance > 0.005) return styles.balancePositive;
  if (balance < -0.005) return styles.balanceNegative;
  return '';
}

function transactionEffectCopy(transaction: WholesaleTransaction) {
  if (Math.abs(transaction.balanceEffect) < 0.005) return 'تمت تسوية الحركة';
  return transaction.balanceEffect > 0
    ? `زاد الحساب ${currency.format(transaction.balanceEffect)}`
    : `خُصم من الحساب ${currency.format(Math.abs(transaction.balanceEffect))}`;
}

export default function WholesaleAccountPage() {
  const params = useParams<{ partyId?: string | string[] }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, ready } = useSession();
  const { showToast } = useToast();
  const partyId = Array.isArray(params.partyId) ? params.partyId[0] : params.partyId;
  const requestedDate = searchParams.get('date');
  const requestedScope = searchParams.get('scope');
  const initialDate = requestedDate && isValidIsoDate(requestedDate) && requestedDate <= todayIsoDate()
    ? requestedDate
    : todayIsoDate();
  const [account, setAccount] = useState<WholesaleAccount | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [action, setAction] = useState<AccountAction>('sale_to_customer');
  const [date, setDate] = useState(initialDate);
  const [items, setItems] = useState<WholesaleDraftItem[]>([createWholesaleDraftItem()]);
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const isRetailSupplierAccount = (account?.party.scope ?? requestedScope) === 'retail';
  const accountsBackPath = isRetailSupplierAccount
    ? `/retail-suppliers${requestedDate ? `?date=${encodeURIComponent(requestedDate)}` : ''}`
    : `/wholesale${requestedDate ? `?date=${encodeURIComponent(requestedDate)}` : ''}`;

  const loadAccount = useCallback(async () => {
    if (!token || !partyId) return;
    const response = await apiRequest<WholesaleAccount>(`/wholesale/parties/${encodeURIComponent(partyId)}/account`, token);
    setAccount(response);
    setLoadError(false);
  }, [partyId, token]);

  useEffect(() => {
    if (!token || !partyId) return;
    let active = true;
    setLoading(true);

    void loadAccount()
      .catch((error: unknown) => {
        if (active) {
          setAccount(null);
          setLoadError(true);
          showToast(error instanceof Error ? error.message : 'تعذّر تحميل الحساب.', 'error');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loadAccount, partyId, showToast, token]);

  useEffect(() => {
    if (!token) return;
    let active = true;

    apiRequest<Product[]>('/products', token)
      .then((itemsResponse) => {
        if (active) setProducts([...itemsResponse].sort((first, second) => arabicSorter.compare(first.name, second.name)));
      })
      .catch((error: Error) => {
        if (active) showToast(error.message || 'تعذّر تحميل أنواع الستائر.', 'error');
      });

    return () => {
      active = false;
    };
  }, [showToast, token]);

  useEffect(() => {
    if (!account) return;
    const allowedActions = actionOptions(account.party.kind).map((option) => option.type);
    if (!allowedActions.includes(action)) setAction(allowedActions[0]);
  }, [account, action]);

  const selectedAction = actionHeading(action);
  const paymentAction = isPaymentAction(action);
  const supplierOffsetAction = action === 'sale_to_supplier';
  const productByName = useMemo(() => new Map(products.map((product) => [product.name.trim(), product])), [products]);
  const tradeTotal = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.meters) || 0), 0),
    [items]
  );
  const paidNow = Number(paidAmount) || 0;
  const remaining = Math.max(tradeTotal - paidNow, 0);

  function changeAction(nextAction: AccountAction) {
    setAction(nextAction);
    setPaidAmount('');
    setPaymentAmount('');
  }

  function updateItem(id: string, field: keyof Omit<WholesaleDraftItem, 'id'>, value: string) {
    setItems((current) => current.map((row) => {
      if (row.id !== id) return row;
      if (field !== 'item') return { ...row, [field]: value };

      const matchedProduct = productByName.get(value.trim());
      return {
        ...row,
        item: value,
        ...(matchedProduct ? { price: String(matchedProduct.wholesalePrice) } : {}),
      };
    }));
  }

  function addItem() {
    setItems((current) => [...current, createWholesaleDraftItem()]);
  }

  function removeItem(id: string) {
    setItems((current) => current.length === 1 ? current : current.filter((item) => item.id !== id));
  }

  async function saveTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !partyId || !account) return;

    if (paymentAction) {
      const amount = Number(paymentAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        showToast('اكتب مبلغ دفعة صحيحًا أكبر من صفر.', 'info');
        return;
      }

      setSaving(true);
      try {
        await apiRequest<WholesaleTransaction>(`/wholesale/parties/${encodeURIComponent(partyId)}/transactions`, token, {
          method: 'POST',
          body: JSON.stringify({ date, type: action, amount }),
        });
        setPaymentAmount('');
        await loadAccount();
        showToast('تم تسجيل الدفعة وتحديث الحساب.', 'success');
      } catch (error: unknown) {
        showToast(error instanceof Error ? error.message : 'تعذّر تسجيل الدفعة.', 'error');
      } finally {
        setSaving(false);
      }
      return;
    }

    const cleanItems = items.map((item) => ({
      item: item.item.trim(),
      price: Number(item.price),
      meters: Number(item.meters),
      tobs: Number(item.tobs),
    }));
    const invalidItem = cleanItems.some((item) => (
      !item.item
      || !Number.isFinite(item.price)
      || item.price <= 0
      || !Number.isFinite(item.meters)
      || item.meters <= 0
      || !Number.isInteger(item.tobs)
      || item.tobs < 0
    ));

    if (invalidItem) {
      showToast('راجع اسم الصنف وسعر المتر وعدد الأمتار وعدد التوب.', 'info');
      return;
    }
    if (!supplierOffsetAction && (!Number.isFinite(paidNow) || paidNow < 0 || paidNow > tradeTotal)) {
      showToast('المدفوع الآن يجب أن يكون بين صفر وإجمالي الحركة.', 'info');
      return;
    }

    setSaving(true);
    try {
      await apiRequest<WholesaleTransaction>(`/wholesale/parties/${encodeURIComponent(partyId)}/transactions`, token, {
        method: 'POST',
        body: JSON.stringify({
          date,
          type: action,
          items: cleanItems,
          ...(supplierOffsetAction ? {} : { paidAmount: paidNow }),
        }),
      });
      setItems([createWholesaleDraftItem()]);
      setPaidAmount('');
      await loadAccount();
      showToast(supplierOffsetAction ? 'تمت تسوية البضاعة من حساب المورد.' : 'تم تسجيل حركة البضاعة.', 'success');
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : 'تعذّر تسجيل حركة البضاعة.', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!ready || !token) return null;

  return (
    <AppNav>
      <section className={styles.page}>
        <div className={styles.accountTopRow}>
          <div className={styles.accountHeader}>
            <span className={styles.accountIcon} aria-hidden="true">{account?.party.kind === 'supplier' ? '▦' : '◈'}</span>
            <div>
              <span className="eyebrow">{isRetailSupplierAccount ? 'موردين القطاعي' : 'حساب الجملة'}</span>
              <h2>{account?.party.name ?? 'تفاصيل الحساب'}</h2>
              {account && <p className={styles.accountSubtitle}>رقم التليفون: <b dir="ltr">{account.party.phone}</b></p>}
            </div>
          </div>
          <Link className={styles.backButton} href={accountsBackPath}>العودة إلى الحسابات</Link>
        </div>

        {loading ? (
          <div className={styles.loading}>جارٍ تحميل الحساب...</div>
        ) : !account ? (
          <div className={styles.error}>
            {loadError ? 'تعذّر العثور على هذا الحساب أو تحميل بياناته.' : 'لا توجد بيانات للحساب.'}
            <button className="btn btn-secondary" onClick={() => router.push(accountsBackPath)} type="button">العودة</button>
          </div>
        ) : (
          <>
            <section className={styles.accountSummary} aria-live="polite">
              <div>
                <span className={styles.summaryLabel}>{wholesaleBalanceLabel(account.party.kind, account.balance)}</span>
                <strong className={`${styles.summaryAmount} ${balanceClass(account.balance)}`}>{currency.format(Math.abs(account.balance))}</strong>
              </div>
              <p className={styles.summaryDescription}>
                {Math.abs(account.balance) < 0.005
                  ? 'لا توجد مبالغ معلّقة في الحساب الآن.'
                  : account.party.kind === 'customer'
                    ? account.balance > 0 ? 'هذا هو المبلغ المتبقي للعميل عليك تحصيله.' : 'للعميل رصيد لديك.'
                    : account.balance > 0 ? 'هذا هو المبلغ المتبقي للمورد، عليك سداده.' : 'لديك رصيد لدى المورد.'}
              </p>
            </section>

            <section className={styles.actionsGrid} aria-label="اختيار حركة الحساب">
              {actionOptions(account.party.kind).map((option) => (
                <button
                  aria-pressed={action === option.type}
                  className={`${styles.actionButton} ${action === option.type ? styles.actionButtonActive : ''}`}
                  key={option.type}
                  onClick={() => changeAction(option.type)}
                  type="button"
                >
                  <span className={styles.actionIcon} aria-hidden="true">{option.icon}</span>
                  <span><strong>{option.title}</strong><small>{option.description}</small></span>
                </button>
              ))}
            </section>

            <article className={styles.entryPanel}>
              <header className={styles.entryHeading}>
                <div>
                  <span className="eyebrow">{selectedAction.eyebrow}</span>
                  <h3>{selectedAction.title}</h3>
                  <p className={styles.helper}>{selectedAction.helper}</p>
                </div>
              </header>

              <form className={paymentAction ? styles.paymentForm : styles.tradeForm} onSubmit={saveTransaction}>
                <label className="form-group" htmlFor="wholesale-transaction-date">
                  <span className="form-label">تاريخ الحركة</span>
                  <input
                    className="form-input"
                    dir="ltr"
                    id="wholesale-transaction-date"
                    max={todayIsoDate()}
                    onChange={(event) => setDate(event.target.value)}
                    type="date"
                    value={date}
                  />
                </label>

                {paymentAction ? (
                  <>
                    <label className="form-group" htmlFor="wholesale-payment-amount">
                      <span className="form-label">مبلغ الدفعة</span>
                      <input
                        className="form-input"
                        dir="ltr"
                        id="wholesale-payment-amount"
                        inputMode="decimal"
                        min="0"
                        onChange={(event) => setPaymentAmount(event.target.value)}
                        step="0.01"
                        type="number"
                        value={paymentAmount}
                      />
                    </label>
                    <button className="btn btn-primary" disabled={saving} type="submit">
                      {saving ? 'جارٍ التسجيل...' : 'تأكيد وتسجيل الدفعة'}
                    </button>
                  </>
                ) : (
                  <>
                    <div className={styles.itemsArea}>
                      {items.map((item, index) => (
                        <div className={styles.itemRow} key={item.id}>
                          <label className={styles.numericField} htmlFor={`wholesale-item-${item.id}`}>
                            <span>الصنف رقم {index + 1}</span>
                            <input
                              aria-describedby={`wholesale-item-help-${item.id}`}
                              className="form-input"
                              id={`wholesale-item-${item.id}`}
                              list="wholesale-product-options"
                              onChange={(event) => updateItem(item.id, 'item', event.target.value)}
                              type="text"
                              value={item.item}
                            />
                            <small className={styles.itemNameHelper} id={`wholesale-item-help-${item.id}`}>
                              اكتب اسم الصنف كما تريد؛ الاقتراحات اختيارية ولن يُضاف الاسم إلى أنواع الستائر.
                            </small>
                          </label>
                          <label className={styles.numericField} htmlFor={`wholesale-price-${item.id}`}>
                            <span>سعر المتر</span>
                            <input
                              className="form-input"
                              dir="ltr"
                              id={`wholesale-price-${item.id}`}
                              inputMode="decimal"
                              min="0"
                              onChange={(event) => updateItem(item.id, 'price', event.target.value)}
                              step="0.01"
                              type="number"
                              value={item.price}
                            />
                          </label>
                          <label className={styles.numericField} htmlFor={`wholesale-meters-${item.id}`}>
                            <span>إجمالي الأمتار</span>
                            <input
                              className="form-input"
                              dir="ltr"
                              id={`wholesale-meters-${item.id}`}
                              inputMode="decimal"
                              min="0.01"
                              onChange={(event) => updateItem(item.id, 'meters', event.target.value)}
                              step="0.01"
                              type="number"
                              value={item.meters}
                            />
                          </label>
                          <label className={styles.numericField} htmlFor={`wholesale-tobs-${item.id}`}>
                            <span>عدد التوب</span>
                            <input
                              className="form-input"
                              dir="ltr"
                              id={`wholesale-tobs-${item.id}`}
                              inputMode="numeric"
                              min="0"
                              onChange={(event) => updateItem(item.id, 'tobs', event.target.value)}
                              step="1"
                              type="number"
                              value={item.tobs}
                            />
                          </label>
                          <button
                            aria-label={`حذف الصنف رقم ${index + 1}`}
                            className={styles.removeButton}
                            disabled={items.length === 1}
                            onClick={() => removeItem(item.id)}
                            type="button"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <datalist id="wholesale-product-options">
                      {products.map((product) => <option key={product._id} value={product.name} />)}
                    </datalist>
                    <button className={styles.addItemButton} onClick={addItem} type="button">+ إضافة صنف آخر</button>

                    <div className={styles.totalsBox}>
                      <div>
                        <span className={styles.smallLabel}>إجمالي الحركة</span>
                        <strong>{currency.format(tradeTotal)}</strong>
                      </div>
                      {!supplierOffsetAction && (
                        <div>
                          <span className={styles.smallLabel}>المدفوع الآن</span>
                          <strong>{currency.format(paidNow)}</strong>
                        </div>
                      )}
                      <div className={styles.due}>
                        <span className={styles.smallLabel}>{supplierOffsetAction ? 'يُخصم من الحساب' : 'المتبقي'}</span>
                        <strong>{currency.format(supplierOffsetAction ? tradeTotal : remaining)}</strong>
                      </div>
                    </div>

                    {!supplierOffsetAction && (
                      <label className="form-group" htmlFor="wholesale-paid-now">
                        <span className="form-label">المدفوع الآن <small>(اتركه فارغًا إذا لم يُدفع شيء)</small></span>
                        <input
                          className="form-input"
                          dir="ltr"
                          id="wholesale-paid-now"
                          inputMode="decimal"
                          max={tradeTotal || undefined}
                          min="0"
                          onChange={(event) => setPaidAmount(event.target.value)}
                          step="0.01"
                          type="number"
                          value={paidAmount}
                        />
                      </label>
                    )}
                    <button className="btn btn-primary" disabled={saving} type="submit">
                      {saving ? 'جارٍ التسجيل...' : supplierOffsetAction ? 'تأكيد وتسوية الحساب' : 'تأكيد وتسجيل الحركة'}
                    </button>
                  </>
                )}
              </form>
            </article>

            <article className={styles.ledgerPanel}>
              <header className={styles.ledgerHeader}>
                <div className={styles.sectionTitle}>
                  <span className="eyebrow">كشف الحساب</span>
                  <h3>كل الحركات المسجلة</h3>
                </div>
                <span className={styles.count}>{account.transactions.length}</span>
              </header>
              {!account.transactions.length ? (
                <div className={styles.empty}>لا توجد حركات مسجلة في هذا الحساب بعد.</div>
              ) : (
                <div className={styles.ledgerList}>
                  {account.transactions.map((transaction) => (
                    <article className={styles.transaction} key={transaction._id}>
                      <div>
                        <h4 className={styles.transactionTitle}>{wholesaleTransactionLabel(transaction.type)}</h4>
                        <span className={styles.transactionMeta}><b dir="ltr">{transaction.date}</b>{transaction.items.length ? ` • ${transaction.items.length} صنف` : ''}</span>
                        {transaction.items.length > 0 && (
                          <div className={styles.transactionItems}>
                            {transaction.items.map((item, index) => (
                              <span className={styles.itemPill} key={`${transaction._id}-${item.item}-${index}`}>
                                {item.item} — {item.meters} م × {currency.format(item.price)}{item.tobs > 0 ? ` • ${item.tobs} توب` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className={styles.transactionSide}>
                        <span className={styles.detailLabel}>{isPaymentAction(transaction.type) ? 'قيمة الدفعة' : 'إجمالي الحركة'}</span>
                        <strong className={styles.transactionTotal}>{currency.format(transaction.total)}</strong>
                        <span className={`${styles.transactionEffect} ${transaction.balanceEffect <= 0 ? styles.transactionEffectSettled : ''}`}>
                          {transactionEffectCopy(transaction)}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </article>
          </>
        )}
      </section>
    </AppNav>
  );
}
