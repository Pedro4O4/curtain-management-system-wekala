export type WholesalePartyKind = 'customer' | 'supplier';
export type WholesalePartyScope = 'retail' | 'wholesale';

export type WholesaleTransactionType =
  | 'sale_to_customer'
  | 'purchase_from_supplier'
  | 'sale_to_supplier'
  | 'payment_from_customer'
  | 'payment_to_supplier';

export type WholesaleParty = {
  _id: string;
  kind: WholesalePartyKind;
  scope?: WholesalePartyScope;
  name: string;
  phone: string;
  balance: number;
  createdAt?: string;
  updatedAt?: string;
};

export type WholesaleItem = {
  item: string;
  price: number;
  meters: number;
  tobs: number;
};

export type WholesaleTransaction = {
  _id: string;
  partyId: string;
  date: string;
  type: WholesaleTransactionType;
  items: WholesaleItem[];
  total: number;
  paidAmount: number;
  balanceEffect: number;
  createdAt: string;
};

export type WholesaleAccount = {
  party: Omit<WholesaleParty, 'balance'>;
  balance: number;
  transactions: WholesaleTransaction[];
};

export type WholesaleHistoryTransaction = Omit<WholesaleTransaction, 'createdAt'> & {
  createdAt: string | null;
  partyName: string;
  partyPhone: string;
  partyKind: WholesalePartyKind;
  partyScope?: WholesalePartyScope;
  party?: Pick<WholesaleParty, '_id' | 'name' | 'phone' | 'kind' | 'scope'>;
};

export type WholesaleHistoryDay = {
  date: string;
  transactions: WholesaleHistoryTransaction[];
  count: number;
  total: number;
  paidTotal: number;
  balanceEffectTotal: number;
};

export type WholesaleHistoryTypeTotal = {
  count: number;
  total: number;
  paidTotal: number;
  balanceEffectTotal: number;
};

export type WholesaleHistoryResponse = {
  filters: { kind?: WholesalePartyKind; scope?: WholesalePartyScope; date?: string; month?: string };
  transactions: WholesaleHistoryTransaction[];
  days: WholesaleHistoryDay[];
  total: number;
  paidTotal: number;
  balanceEffectTotal: number;
  transactionCount: number;
  partyCount: number;
  byType: Record<WholesaleTransactionType, WholesaleHistoryTypeTotal>;
};

export type WholesaleDraftItem = {
  id: string;
  item: string;
  price: string;
  meters: string;
  tobs: string;
};

export function createWholesaleDraftItem(): WholesaleDraftItem {
  return {
    id: crypto.randomUUID(),
    item: '',
    price: '',
    meters: '',
    tobs: '0',
  };
}

export function wholesaleTransactionLabel(type: WholesaleTransactionType) {
  const labels: Record<WholesaleTransactionType, string> = {
    sale_to_customer: 'بضاعة للعميل',
    payment_from_customer: 'دفعة من العميل',
    purchase_from_supplier: 'بضاعة من المورد',
    payment_to_supplier: 'دفعة للمورد',
    sale_to_supplier: 'بضاعة أخذها المورد',
  };

  return labels[type];
}

export function wholesaleBalanceLabel(kind: WholesalePartyKind, balance: number) {
  if (Math.abs(balance) < 0.005) return 'الحساب متساوٍ';

  if (kind === 'customer') {
    return balance > 0 ? 'مستحق لك من العميل' : 'رصيد للعميل';
  }

  return balance > 0 ? 'مستحق للمورد' : 'رصيد لك لدى المورد';
}
