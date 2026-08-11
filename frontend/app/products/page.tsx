"use client";

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AppNav } from '../../components/app-nav';
import { useSession } from '../../components/use-session';
import { useToast } from '../../components/toast-context';
import { apiRequest, currency, Product } from '../../lib/sales';

const arabicSorter = new Intl.Collator('ar', { sensitivity: 'base', numeric: true });

function sortProducts(items: Product[]) {
  return [...items].sort((first, second) => arabicSorter.compare(first.name, second.name));
}

function csvValue(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export default function ProductsPage() {
  const { token, ready } = useSession();
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);
  const [bulkAmount, setBulkAmount] = useState('');
  const [bulkDirection, setBulkDirection] = useState<'+' | '-'>('+');
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [name, setName] = useState('');
  const [wholesalePrice, setWholesalePrice] = useState('');
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editWholesalePrice, setEditWholesalePrice] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingBulk, setSavingBulk] = useState(false);
  const [deletingBulk, setDeletingBulk] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiRequest<Product[]>('/products', token)
      .then((items) => setProducts(sortProducts(items)))
      .catch((error: Error) => showToast(error.message || 'تعذّر تحميل الأنواع.', 'error'));
  }, [showToast, token]);

  const filteredProducts = useMemo(() => {
    const cleanQuery = query.trim().toLocaleLowerCase('ar');
    if (!cleanQuery) return products;
    return products.filter((product) => `${product.name} ${product.wholesalePrice}`.toLocaleLowerCase('ar').includes(cleanQuery));
  }, [products, query]);
  const allVisibleSelected = filteredProducts.length > 0 && filteredProducts.every((product) => bulkSelectedIds.includes(product._id));

  async function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const price = Number(wholesalePrice);
    if (!name.trim() || !token || !Number.isFinite(price) || price < 0) return;
    setSaving(true);
    try {
      const product = await apiRequest<Product>('/products', token, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), wholesalePrice: price }),
      });
      setProducts((current) => current.some((entry) => entry._id === product._id) ? current : sortProducts([...current, product]));
      setName('');
      setWholesalePrice('');
      showToast('تمت إضافة النوع.', 'success');
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : 'تعذّر إضافة النوع.', 'error');
    } finally {
      setSaving(false);
    }
  }

  function removeFromExport(id: string) {
    setSelectedProducts((current) => current.filter((product) => product._id !== id));
  }

  function toggleExportProduct(product: Product) {
    setSelectedProducts((current) => current.some((entry) => entry._id === product._id)
      ? current.filter((entry) => entry._id !== product._id)
      : [...current, product]);
  }

  function addAllToExport() {
    setSelectedProducts(products);
  }

  function toggleBulkProduct(id: string) {
    setBulkSelectedIds((current) => current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]);
  }

  function toggleAllVisibleProducts() {
    setBulkSelectedIds((current) => {
      const visibleIds = filteredProducts.map((product) => product._id);
      if (allVisibleSelected) return current.filter((id) => !visibleIds.includes(id));
      return Array.from(new Set([...current, ...visibleIds]));
    });
  }

  async function applyBulkPriceAdjustment() {
    const amount = Number(bulkAmount);
    const adjustment = bulkDirection === '+' ? amount : -amount;
    if (!token || !bulkSelectedIds.length || !Number.isFinite(amount) || amount <= 0) {
      showToast('اكتب رقمًا صحيحًا أكبر من صفر.', 'info');
      return;
    }

    setSavingBulk(true);
    try {
      const updatedProducts = await apiRequest<Product[]>('/products/bulk-price', token, {
        method: 'PATCH',
        body: JSON.stringify({ productIds: bulkSelectedIds, adjustment }),
      });
      const updatesById = new Map(updatedProducts.map((product) => [product._id, product]));
      setProducts((current) => sortProducts(current.map((product) => updatesById.get(product._id) ?? product)));
      setSelectedProducts((current) => current.map((product) => updatesById.get(product._id) ?? product));
      setBulkAmount('');
      setBulkSelectedIds([]);
      setBulkEditOpen(false);
      showToast(`تم تعديل أسعار ${updatedProducts.length} صنف.`, 'success');
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : 'تعذّر تعديل الأسعار.', 'error');
    } finally {
      setSavingBulk(false);
    }
  }

  async function removeBulkProducts() {
    if (!token || !bulkSelectedIds.length) return;
    if (!window.confirm(`حذف ${bulkSelectedIds.length} صنف محدد؟ لا يمكن التراجع عن هذا الإجراء.`)) return;

    setDeletingBulk(true);
    try {
      const response = await apiRequest<{ deletedIds: string[] }>('/products/bulk', token, {
        method: 'DELETE',
        body: JSON.stringify({ productIds: bulkSelectedIds }),
      });
      const deletedIds = new Set(response.deletedIds);
      setProducts((current) => current.filter((product) => !deletedIds.has(product._id)));
      setSelectedProducts((current) => current.filter((product) => !deletedIds.has(product._id)));
      setBulkSelectedIds([]);
      showToast(`تم حذف ${response.deletedIds.length} صنف.`, 'success');
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : 'تعذّر حذف الأصناف.', 'error');
    } finally {
      setDeletingBulk(false);
    }
  }

  function startEditing(product: Product) {
    setEditingProduct(product);
    setEditName(product.name);
    setEditWholesalePrice(String(product.wholesalePrice));
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const price = Number(editWholesalePrice);
    if (!token || !editingProduct || !editName.trim() || !Number.isFinite(price) || price < 0) return;
    setSavingEdit(true);
    try {
      const updated = await apiRequest<Product>(`/products/${editingProduct._id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ name: editName.trim(), wholesalePrice: price }),
      });
      setProducts((current) => sortProducts(current.map((product) => product._id === updated._id ? updated : product)));
      setSelectedProducts((current) => current.map((product) => product._id === updated._id ? updated : product));
      setEditingProduct(null);
      showToast('تم تعديل الصنف.', 'success');
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : 'تعذّر تعديل الصنف.', 'error');
    } finally {
      setSavingEdit(false);
    }
  }

  async function removeProduct(product: Product) {
    if (!token || !window.confirm(`حذف «${product.name}» من الأنواع؟`)) return;
    try {
      await apiRequest(`/products/${product._id}`, token, { method: 'DELETE' });
      setProducts((current) => current.filter((entry) => entry._id !== product._id));
      removeFromExport(product._id);
      setBulkSelectedIds((current) => current.filter((id) => id !== product._id));
      if (editingProduct?._id === product._id) setEditingProduct(null);
      showToast('تم حذف الصنف.', 'success');
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : 'تعذّر حذف الصنف.', 'error');
    }
  }

  function downloadCsv() {
    if (!selectedProducts.length) {
      showToast('اختر صنفًا واحدًا على الأقل أولًا.', 'info');
      return;
    }
    const rows = [
      ['الرقم', 'الصنف', 'سعر الجملة للمتر'],
      ...selectedProducts.map((product, index) => [index + 1, product.name, product.wholesalePrice]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvValue).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'curtain-types.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  if (!ready || !token) return null;

  return (
    <AppNav>
      <section className="products-page">
        <div className="workspace-heading products-heading">
          <div>
            <span className="eyebrow">إعدادات البيع</span>
            <h2>أنواع الستائر وأسعار الجملة</h2>
            <p>اضغط على أي صنف لإضافته إلى قائمة التصدير، أو عدّل بياناته من نفس الصفحة.</p>
          </div>
          <span className="product-total-count">{products.length} صنف</span>
        </div>

        <article className="entry-card card-surface products-card">
          <div className="products-section-title">
            <div>
              <span className="eyebrow">صنف جديد</span>
              <h3>أضف نوع ستارة</h3>
            </div>
          </div>
          <form className="product-add-form" onSubmit={addProduct}>
            <label className="form-group" htmlFor="product-name">
              <span className="form-label">اسم الصنف</span>
              <input className="form-input" id="product-name" onChange={(event) => setName(event.target.value)} type="text" value={name} />
            </label>
            <label className="form-group" htmlFor="wholesale-price">
              <span className="form-label">سعر الجملة للمتر</span>
              <input className="form-input" dir="ltr" id="wholesale-price" inputMode="decimal" min="0" onChange={(event) => setWholesalePrice(event.target.value)} step="0.01" type="number" value={wholesalePrice} />
            </label>
            <button className="btn btn-primary" disabled={saving || !name.trim() || wholesalePrice === ''} type="submit">{saving ? 'جارٍ الإضافة...' : 'إضافة الصنف'}</button>
          </form>
        </article>

        <div className="products-workspace">
          <article className="products-library card-surface">
            <div className="products-library-header">
              <div>
                <span className="eyebrow">قائمة الأصناف</span>
                <h3>استخدم زر إضافة لاختيار الصنف للتصدير</h3>
              </div>
              <div className="products-header-actions">
                <span className="records-count">{filteredProducts.length}</span>
                <button className="select-visible-button" onClick={toggleAllVisibleProducts} type="button">{allVisibleSelected ? 'إلغاء تحديد المعروض' : 'تحديد كل المعروض'}</button>
              </div>
            </div>
            <label className="product-search" htmlFor="product-search">
              <span aria-hidden="true">⌕</span>
              <strong>بحث</strong>
              <input aria-label="ابحث بالاسم أو السعر" id="product-search" onChange={(event) => setQuery(event.target.value)} type="search" value={query} />
            </label>
            {bulkSelectedIds.length > 0 && (
              <div className="bulk-selection-ready">
                <span>{bulkSelectedIds.length} صنف محدد للتعديل</span>
                <div className="bulk-ready-actions">
                  <button className="btn btn-secondary bulk-delete-button" disabled={deletingBulk} onClick={() => void removeBulkProducts()} type="button">{deletingBulk ? 'جارٍ الحذف...' : 'حذف المحدد'}</button>
                  <button className="btn btn-primary" onClick={() => setBulkEditOpen(true)} type="button">تعديل الأسعار المحددة</button>
                </div>
              </div>
            )}
            {!filteredProducts.length ? (
              <div className="empty-records"><p>{products.length ? 'لا توجد نتيجة مطابقة للبحث.' : 'لم تضف أي صنف بعد.'}</p></div>
            ) : (
              <div className="product-list">
                {filteredProducts.map((product, index) => {
                  const copied = selectedProducts.some((entry) => entry._id === product._id);
                  const selectedForBulk = bulkSelectedIds.includes(product._id);
                  return (
                    <div
                      className={copied ? 'product-row copied' : 'product-row'}
                      key={product._id}
                    >
                      <span className="product-row-number">{String(index + 1).padStart(2, '0')}</span>
                      <input
                        aria-label={`تحديد ${product.name} لتعديل السعر`}
                        checked={selectedForBulk}
                        className="product-bulk-checkbox"
                        onChange={() => toggleBulkProduct(product._id)}
                        onClick={(event) => event.stopPropagation()}
                        type="checkbox"
                      />
                      <span className="product-row-name"><strong>{product.name}</strong><small>سعر الجملة للمتر</small></span>
                      <strong className="product-row-price">{currency.format(product.wholesalePrice)}</strong>
                      <span className="product-row-actions">
                        <button className={copied ? 'product-copy-button added' : 'product-copy-button'} onClick={() => toggleExportProduct(product)} type="button">{copied ? 'إزالة' : 'إضافة'}</button>
                        <button aria-label={`تعديل ${product.name}`} className="product-action edit" onClick={(event) => { event.stopPropagation(); startEditing(product); }} type="button">تعديل</button>
                        <button aria-label={`حذف ${product.name}`} className="product-action delete" onClick={(event) => { event.stopPropagation(); void removeProduct(product); }} type="button">حذف</button>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </article>

          <aside className="product-export-card card-surface">
            <div className="products-library-header">
              <div>
                <span className="eyebrow">قائمة التصدير</span>
                <h3>الأصناف المختارة</h3>
              </div>
              <div className="export-header-actions"><span className="export-count">{selectedProducts.length}</span><button className="export-all-button" disabled={!products.length} onClick={addAllToExport} type="button">إضافة الكل</button></div>
            </div>
            {!selectedProducts.length ? (
              <div className="export-empty"><span aria-hidden="true">▣</span><p>اضغط على الأصناف من القائمة لتظهر هنا.</p></div>
            ) : (
              <ol className="export-product-list">
                {selectedProducts.map((product, index) => (
                  <li key={product._id}>
                    <span>{index + 1}</span>
                    <strong>{product.name}</strong>
                    <small>{currency.format(product.wholesalePrice)}</small>
                    <button aria-label={`إزالة ${product.name}`} onClick={() => removeFromExport(product._id)} type="button">×</button>
                  </li>
                ))}
              </ol>
            )}
            <button className="btn btn-primary export-csv-button" disabled={!selectedProducts.length} onClick={downloadCsv} type="button">تنزيل Excel (CSV)</button>
          </aside>
        </div>

        {editingProduct && (
          <div className="product-edit-overlay" onMouseDown={() => !savingEdit && setEditingProduct(null)} role="presentation">
            <form className="product-edit-dialog" onMouseDown={(event) => event.stopPropagation()} onSubmit={saveEdit}>
              <button aria-label="إغلاق" className="sale-picker-close" disabled={savingEdit} onClick={() => setEditingProduct(null)} type="button">×</button>
              <span className="eyebrow">تعديل الصنف</span>
              <h3>عدّل البيانات ثم احفظ</h3>
              <label className="form-group" htmlFor="edit-product-name"><span className="form-label">اسم الصنف</span><input className="form-input" id="edit-product-name" onChange={(event) => setEditName(event.target.value)} type="text" value={editName} /></label>
              <label className="form-group" htmlFor="edit-wholesale-price"><span className="form-label">سعر الجملة للمتر</span><input className="form-input" dir="ltr" id="edit-wholesale-price" inputMode="decimal" min="0" onChange={(event) => setEditWholesalePrice(event.target.value)} step="0.01" type="number" value={editWholesalePrice} /></label>
              <div className="product-edit-actions"><button className="btn btn-secondary" disabled={savingEdit} onClick={() => setEditingProduct(null)} type="button">إلغاء</button><button className="btn btn-primary" disabled={savingEdit || !editName.trim() || editWholesalePrice === ''} type="submit">{savingEdit ? 'جارٍ الحفظ...' : 'حفظ التعديل'}</button></div>
            </form>
          </div>
        )}

        {bulkEditOpen && (
          <div className="product-edit-overlay" onMouseDown={() => !savingBulk && setBulkEditOpen(false)} role="presentation">
            <section aria-label="تعديل أسعار الأصناف المحددة" className="product-edit-dialog bulk-edit-dialog" onMouseDown={(event) => event.stopPropagation()}>
              <button aria-label="إغلاق" className="sale-picker-close" disabled={savingBulk} onClick={() => setBulkEditOpen(false)} type="button">×</button>
              <span className="eyebrow">تعديل جماعي</span>
              <h3>تعديل أسعار {bulkSelectedIds.length} صنف</h3>
              <p>اختر زيادة أو خصم، ثم اكتب قيمة التعديل بالجنيه لكل متر.</p>
              <div className="bulk-direction-switch">
                <button aria-pressed={bulkDirection === '+'} className={bulkDirection === '+' ? 'active increase' : ''} onClick={() => setBulkDirection('+')} type="button">+ زيادة</button>
                <button aria-pressed={bulkDirection === '-'} className={bulkDirection === '-' ? 'active decrease' : ''} onClick={() => setBulkDirection('-')} type="button">− خصم</button>
              </div>
              <label className="form-group" htmlFor="bulk-price-amount"><span className="form-label">قيمة التعديل</span><input className="form-input" dir="ltr" id="bulk-price-amount" inputMode="decimal" min="0.01" onChange={(event) => setBulkAmount(event.target.value)} step="0.01" type="number" value={bulkAmount} /></label>
              <div className="product-edit-actions"><button className="btn btn-secondary" disabled={savingBulk} onClick={() => setBulkEditOpen(false)} type="button">إلغاء</button><button className="btn btn-primary" disabled={savingBulk || !bulkAmount} onClick={() => void applyBulkPriceAdjustment()} type="button">{savingBulk ? 'جارٍ التطبيق...' : bulkDirection === '+' ? 'تطبيق الزيادة' : 'تطبيق الخصم'}</button></div>
            </section>
          </div>
        )}
      </section>
    </AppNav>
  );
}
