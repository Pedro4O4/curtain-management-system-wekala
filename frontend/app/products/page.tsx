"use client";

import { FormEvent, useEffect, useState } from 'react';
import { AppNav } from '../../components/app-nav';
import { useSession } from '../../components/use-session';
import { useToast } from '../../components/toast-context';
import { apiRequest, Product } from '../../lib/sales';

export default function ProductsPage() {
  const { token, ready } = useSession();
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiRequest<Product[]>('/products', token)
      .then(setProducts)
      .catch((error: Error) => showToast(error.message || 'تعذّر تحميل الأنواع.', 'error'));
  }, [showToast, token]);

  async function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !token) return;
    setSaving(true);
    try {
      const product = await apiRequest<Product>('/products', token, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      });
      setProducts((current) => current.some((entry) => entry._id === product._id) ? current : [...current, product].sort((a, b) => a.name.localeCompare(b.name, 'ar')));
      setName('');
      showToast('تمت إضافة النوع.', 'success');
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : 'تعذّر إضافة النوع.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function removeProduct(product: Product) {
    if (!token || !window.confirm(`حذف «${product.name}» من الاختيارات؟`)) return;
    try {
      await apiRequest(`/products/${product._id}`, token, { method: 'DELETE' });
      setProducts((current) => current.filter((entry) => entry._id !== product._id));
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : 'تعذّر حذف النوع.', 'error');
    }
  }

  if (!ready || !token) return null;

  return (
    <AppNav>
      <section className="products-page">
        <div className="workspace-heading">
          <span className="eyebrow">إعدادات البيع</span>
          <h2>أنواع الستائر</h2>
          <p>أضف الأصناف التي لديك مرة واحدة، ثم اخترها سريعًا عند تسجيل أي بيعة.</p>
        </div>
        <article className="entry-card card-surface products-card">
          <form className="product-add-form" onSubmit={addProduct}>
            <label className="form-group" htmlFor="product-name">
              <span className="form-label">اسم النوع</span>
              <input className="form-input" id="product-name" onChange={(event) => setName(event.target.value)} type="text" value={name} />
            </label>
            <button className="btn btn-primary" disabled={saving || !name.trim()} type="submit">{saving ? 'جارٍ الإضافة...' : 'إضافة النوع'}</button>
          </form>
          {!products.length ? (
            <div className="empty-records"><p>لم تضف أي نوع بعد.</p></div>
          ) : (
            <div className="product-chip-list">
              {products.map((product) => (
                <div className="product-chip" key={product._id}>
                  <span>{product.name}</span>
                  <button aria-label={`حذف ${product.name}`} onClick={() => void removeProduct(product)} type="button">×</button>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </AppNav>
  );
}
