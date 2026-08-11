"use client";

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AppNav } from '../../components/app-nav';
import { useSession } from '../../components/use-session';
import { useToast } from '../../components/toast-context';
import { apiRequest, currency, isValidIsoDate, todayIsoDate } from '../../lib/sales';
import { WholesaleParty, WholesalePartyKind, WholesalePartyScope, wholesaleBalanceLabel } from '../../lib/wholesale';
import styles from './wholesale.module.css';

const arabicSorter = new Intl.Collator('ar', { sensitivity: 'base', numeric: true });

function sortParties(parties: WholesaleParty[]) {
  return [...parties].sort((first, second) => arabicSorter.compare(first.name, second.name));
}

function balanceClass(balance: number) {
  if (balance > 0.005) return styles.balancePositive;
  if (balance < -0.005) return styles.balanceNegative;
  return '';
}

export default function WholesalePage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const scope: WholesalePartyScope = pathname === '/retail-suppliers' ? 'retail' : 'wholesale';
  const supplierOnly = scope === 'retail';
  const { token, ready } = useSession();
  const { showToast } = useToast();
  const [parties, setParties] = useState<WholesaleParty[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const requestedDate = searchParams.get('date');
  const requestedKind = searchParams.get('kind');
  const requestedPartyKind: WholesalePartyKind | null = requestedKind === 'customer' || requestedKind === 'supplier'
    ? requestedKind
    : null;
  const kind: WholesalePartyKind | null = supplierOnly ? 'supplier' : requestedPartyKind;
  const selectedDate = requestedDate && isValidIsoDate(requestedDate) && requestedDate <= todayIsoDate()
    ? requestedDate
    : '';
  const dateQuery = selectedDate ? `&date=${encodeURIComponent(selectedDate)}` : '';
  const isRetailSupplierBook = scope === 'retail' && supplierOnly;
  const accountDetailPath = (partyId: string) => {
    const query = new URLSearchParams();
    if (selectedDate) query.set('date', selectedDate);
    if (scope === 'retail') query.set('scope', scope);
    const suffix = query.toString();
    return `/wholesale/${partyId}${suffix ? `?${suffix}` : ''}`;
  };

  function accountsPath(nextKind: WholesalePartyKind) {
    if (supplierOnly) return `/retail-suppliers${selectedDate ? `?date=${encodeURIComponent(selectedDate)}` : ''}`;
    return `/wholesale?kind=${nextKind}${dateQuery}`;
  }

  useEffect(() => {
    if (!token || !kind) return;
    let active = true;
    setLoading(true);

    apiRequest<WholesaleParty[]>(`/wholesale/parties?kind=${kind}&scope=${scope}`, token)
      .then((items) => {
        if (active) setParties(sortParties(items));
      })
      .catch((error: Error) => {
        if (active) {
          setParties([]);
          showToast(error.message || 'تعذّر تحميل الحسابات.', 'error');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [kind, scope, showToast, token]);

  const kindCopy = useMemo(() => kind === 'customer'
    ? {
      icon: '◈',
      heading: 'حسابات العملاء',
      description: 'العملاء الذين يأخذون بضاعة منك، وتظهر قيمة المتبقي لكل عميل.',
      addTitle: 'أضف عميلًا',
      addButton: 'إضافة العميل',
      empty: 'لم تضف أي عميل حتى الآن.',
    }
    : {
      icon: '▦',
      heading: 'حسابات الموردين',
      description: 'الموردون الذين تأخذ منهم بضاعة، مع متابعة ما لك وما عليك.',
      addTitle: 'أضف موردًا',
      addButton: 'إضافة المورد',
      empty: 'لم تضف أي مورد حتى الآن.',
    }, [kind]);

  async function createParty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !kind || !name.trim() || !phone.trim()) {
      showToast('اكتب الاسم ورقم التليفون أولًا.', 'info');
      return;
    }

    setSaving(true);
    try {
      const created = await apiRequest<WholesaleParty>('/wholesale/parties', token, {
        method: 'POST',
        body: JSON.stringify({ kind, scope, name: name.trim(), phone: phone.trim() }),
      });
      const party = { ...created, balance: Number(created.balance) || 0 };
      setParties((current) => current.some((entry) => entry._id === party._id)
        ? current
        : sortParties([...current, party]));
      setName('');
      setPhone('');
      showToast(kind === 'customer' ? 'تمت إضافة العميل.' : 'تمت إضافة المورد.', 'success');
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : 'تعذّر إضافة الحساب.', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!ready || !token) return null;

  if (!kind) {
    return (
      <AppNav>
        <section className={styles.page}>
          <header className={styles.hero}>
            <div>
              <span className="eyebrow">الجملة</span>
              <h2>اختر نوع الحساب</h2>
              <p>افتح حسابات العملاء الذين يأخذون بضاعة منك، أو حسابات الموردين الذين تأخذ منهم بضاعة.</p>
            </div>
          </header>

          <section className={styles.choiceGrid} aria-label="اختيار حسابات الجملة">
            <button className={styles.choiceCard} onClick={() => router.push(accountsPath('customer'))} type="button">
              <span className={styles.choiceIcon} aria-hidden="true">◈</span>
              <span className={styles.choiceCopy}>
                <strong>حساب العملاء</strong>
                <small>بضاعة تخرج من المحل، دفعات، ومتأخرات كل عميل.</small>
              </span>
              <span className={styles.choiceArrow} aria-hidden="true">‹</span>
            </button>
            <button className={styles.choiceCard} onClick={() => router.push(accountsPath('supplier'))} type="button">
              <span className={`${styles.choiceIcon} ${styles.supplierChoiceIcon}`} aria-hidden="true">▦</span>
              <span className={styles.choiceCopy}>
                <strong>حساب الموردين</strong>
                <small>بضاعة تدخل للمحل، دفعاتك، وتسوية البضاعة التي يأخذها المورد.</small>
              </span>
              <span className={styles.choiceArrow} aria-hidden="true">‹</span>
            </button>
          </section>
        </section>
      </AppNav>
    );
  }

  return (
    <AppNav>
      <section className={styles.page}>
        <header className={styles.hero}>
          <div>
            <span className="eyebrow">{isRetailSupplierBook ? 'قطاعي' : 'الجملة'}</span>
            <h2>{isRetailSupplierBook ? 'حسابات موردين القطاعي' : 'حسابات العملاء والموردين'}</h2>
            <p>{isRetailSupplierBook
              ? 'سجّل البضاعة التي تأخذها من كل مورد ودفعاتك وتسوية البضاعة في حساب مستقل.'
              : 'سجّل البضاعة والدفعات في حساب مستقل لكل شخص، وستعرف المتبقي فورًا.'}</p>
          </div>
          <Link className={styles.heroLink} href="/products">إدارة أنواع الستائر</Link>
        </header>

        {!supplierOnly && <section className={styles.kindSwitch} aria-label="نوع الحساب">
          <button
            aria-pressed={kind === 'customer'}
            className={`${styles.kindButton} ${kind === 'customer' ? styles.kindButtonActive : ''}`}
            onClick={() => router.push(accountsPath('customer'))}
            type="button"
          >
            <span className={styles.kindIcon} aria-hidden="true">◈</span>
            <span><strong>العملاء</strong><small>بضاعة تخرج من المحل</small></span>
          </button>
          <button
            aria-pressed={kind === 'supplier'}
            className={`${styles.kindButton} ${kind === 'supplier' ? styles.kindButtonActive : ''}`}
            onClick={() => router.push(accountsPath('supplier'))}
            type="button"
          >
            <span className={styles.kindIcon} aria-hidden="true">▦</span>
            <span><strong>الموردون</strong><small>بضاعة تدخل إلى المحل</small></span>
          </button>
        </section>}

        <section className={styles.workspace}>
          <article className={styles.accountsPanel}>
            <header className={styles.panelHeader}>
              <div className={styles.sectionTitle}>
                <span className="eyebrow">{isRetailSupplierBook ? 'موردو القطاعي' : kind === 'customer' ? 'عملاء الجملة' : 'مورّدو الجملة'}</span>
                <h3>{kindCopy.heading}</h3>
                <p className={styles.helper}>{kindCopy.description}</p>
              </div>
              <span className={styles.count}>{parties.length}</span>
            </header>

            {loading ? (
              <div className={styles.loading}>جارٍ تحميل الحسابات...</div>
            ) : !parties.length ? (
              <div className={styles.empty}>{kindCopy.empty}</div>
            ) : (
              <div className={styles.accountList}>
                {parties.map((party) => (
                  <button
                    className={styles.accountCard}
                    key={party._id}
                    onClick={() => router.push(accountDetailPath(party._id))}
                    type="button"
                  >
                    <span>
                      <strong>{party.name}</strong>
                      <span className={styles.accountPhone} dir="ltr">{party.phone}</span>
                    </span>
                    <span className={styles.balanceBox}>
                      <span>{wholesaleBalanceLabel(party.kind, party.balance)}</span>
                      <b className={balanceClass(party.balance)}>{currency.format(Math.abs(party.balance))}</b>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </article>

          <aside className={styles.newPartyPanel}>
            <span className="eyebrow">حساب جديد</span>
            <h3 className={styles.formTitle}>{kindCopy.addTitle}</h3>
            <p className={styles.helper}>يكفي الاسم ورقم التليفون، ثم سجّل منه البضاعة أو الدفعات.</p>
            <form className={styles.partyForm} onSubmit={createParty}>
              <label className="form-group" htmlFor="wholesale-party-name">
                <span className="form-label">الاسم</span>
                <input
                  className="form-input"
                  id="wholesale-party-name"
                  onChange={(event) => setName(event.target.value)}
                  type="text"
                  value={name}
                />
              </label>
              <label className="form-group" htmlFor="wholesale-party-phone">
                <span className="form-label">رقم التليفون</span>
                <input
                  className="form-input"
                  dir="ltr"
                  id="wholesale-party-phone"
                  inputMode="tel"
                  onChange={(event) => setPhone(event.target.value)}
                  type="tel"
                  value={phone}
                />
              </label>
              <button className={`btn btn-primary ${styles.formButton}`} disabled={saving} type="submit">
                {saving ? 'جارٍ الإضافة...' : kindCopy.addButton}
              </button>
            </form>
          </aside>
        </section>
      </section>
    </AppNav>
  );
}
