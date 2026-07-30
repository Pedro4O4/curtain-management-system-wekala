"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppNav } from '../../components/app-nav';
import { useSession } from '../../components/use-session';
import { useToast } from '../../components/toast-context';
import { 
  DraftSaleRow, 
  DraftAdjustmentRow, 
  todayIsoDate, 
  apiRequest, 
  currency,
  DayResponse
} from '../../lib/sales';

export default function CreatePage() {
  const router = useRouter();
  const { token, ready } = useSession();
  const { showToast } = useToast();

  const [selectedDate, setSelectedDate] = useState(todayIsoDate());
  const [activeTab, setActiveTab] = useState<'sales' | 'adjustments'>('sales');
  
  const [saleRows, setSaleRows] = useState<DraftSaleRow[]>([
    { id: crypto.randomUUID(), item: '', price: '', confirmed: false }
  ]);
  
  const [adjustmentRows, setAdjustmentRows] = useState<DraftAdjustmentRow[]>([]);
  
  const [saving, setSaving] = useState(false);

  if (!ready) return null;
  if (!token) return null; // AppNav handles redirect

  const handleAddSaleRow = () => {
    setSaleRows([...saleRows, { id: crypto.randomUUID(), item: '', price: '', confirmed: false }]);
  };

  const handleUpdateSaleRow = (id: string, field: keyof DraftSaleRow, value: any) => {
    setSaleRows(saleRows.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  const handleRemoveSaleRow = (id: string) => {
    setSaleRows(saleRows.filter(row => row.id !== id));
  };

  const handleAddAdjustmentRow = () => {
    setAdjustmentRows([...adjustmentRows, { id: crypto.randomUUID(), amount: '', reason: '', direction: '-', confirmed: false }]);
  };

  const handleUpdateAdjustmentRow = (id: string, field: keyof DraftAdjustmentRow, value: any) => {
    setAdjustmentRows(adjustmentRows.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  const handleRemoveAdjustmentRow = (id: string) => {
    setAdjustmentRows(adjustmentRows.filter(row => row.id !== id));
  };

  const handleSaveSales = async () => {
    const confirmedRows = saleRows.filter(r => r.confirmed);
    if (confirmedRows.length === 0) {
      showToast('No confirmed sales to save.', 'info');
      return;
    }

    setSaving(true);
    try {
      for (const row of confirmedRows) {
        await apiRequest<DayResponse>(`/records/day/${selectedDate}/sales`, token, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item: row.item, price: Number(row.price) })
        });
      }
      showToast('Saved successfully!', 'success');
      router.push(`/details?date=${selectedDate}`);
    } catch (err: any) {
      showToast(err.message || 'Failed to save sales', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAdjustments = async () => {
    const confirmedRows = adjustmentRows.filter(r => r.confirmed);
    if (confirmedRows.length === 0) {
      showToast('No confirmed adjustments to save.', 'info');
      return;
    }

    setSaving(true);
    try {
      for (const row of confirmedRows) {
        await apiRequest<DayResponse>(`/records/day/${selectedDate}/adjustments`, token, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: Number(row.amount), reason: row.reason, direction: row.direction })
        });
      }
      showToast('Saved successfully!', 'success');
      router.push(`/details?date=${selectedDate}`);
    } catch (err: any) {
      showToast(err.message || 'Failed to save adjustments', 'error');
    } finally {
      setSaving(false);
    }
  };

  const renderSalesTab = () => {
    const runningTotal = saleRows.filter(r => r.confirmed).reduce((acc, curr) => acc + (Number(curr.price) || 0), 0);
    
    return (
      <>
        <div className="draft-list">
          {saleRows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-text">Add your first entry</div>
              <button className="btn btn-secondary mt-4" onClick={handleAddSaleRow}>Add Row</button>
            </div>
          ) : (
            saleRows.map((row, index) => (
              <div key={row.id} className={`draft-row ${row.confirmed ? 'confirmed' : ''}`}>
                <div className="row-index">{row.confirmed ? '✓' : index + 1}</div>
                <input 
                  type="text" 
                  className="form-input row-field" 
                  placeholder="Item Name" 
                  value={row.item}
                  onChange={(e) => handleUpdateSaleRow(row.id, 'item', e.target.value)}
                  disabled={row.confirmed}
                />
                <input 
                  type="number" 
                  className="form-input row-field" 
                  placeholder="Price" 
                  value={row.price}
                  onChange={(e) => handleUpdateSaleRow(row.id, 'price', e.target.value)}
                  disabled={row.confirmed}
                />
                <div className="row-actions">
                  <button 
                    className={`btn ${row.confirmed ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                    onClick={() => handleUpdateSaleRow(row.id, 'confirmed', !row.confirmed)}
                  >
                    {row.confirmed ? 'Edit' : 'Confirm'}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleRemoveSaleRow(row.id)}>Delete</button>
                </div>
              </div>
            ))
          )}
        </div>
        
        {saleRows.length > 0 && (
          <div className="composer-footer mt-4">
            <button className="btn btn-secondary" onClick={handleAddSaleRow}>+ Add Row</button>
            <div className="running-total">Total Confirmed: {currency.format(runningTotal)}</div>
          </div>
        )}
        
        {saleRows.length > 0 && (
          <div className="mt-6 flex justify-end">
            <button className="btn btn-primary btn-full" onClick={handleSaveSales} disabled={saving}>
              {saving ? 'Saving...' : 'Save All Confirmed Sales'}
            </button>
          </div>
        )}
      </>
    );
  };

  const renderAdjustmentsTab = () => {
    return (
      <>
        <div className="draft-list">
          {adjustmentRows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-text">Add your first entry</div>
              <button className="btn btn-secondary mt-4" onClick={handleAddAdjustmentRow}>Add Row</button>
            </div>
          ) : (
            adjustmentRows.map((row, index) => (
              <div key={row.id} className={`draft-row ${row.confirmed ? 'confirmed' : ''}`}>
                <div className="row-index">{row.confirmed ? '✓' : index + 1}</div>
                
                <div className="flex gap-1 items-center">
                  <button 
                    className={`btn btn-sm ${row.direction === '+' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => handleUpdateAdjustmentRow(row.id, 'direction', '+')}
                    disabled={row.confirmed}
                  >+</button>
                  <button 
                    className={`btn btn-sm ${row.direction === '-' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => handleUpdateAdjustmentRow(row.id, 'direction', '-')}
                    disabled={row.confirmed}
                  >-</button>
                </div>

                <input 
                  type="text" 
                  className="form-input row-field" 
                  placeholder="Reason" 
                  value={row.reason}
                  onChange={(e) => handleUpdateAdjustmentRow(row.id, 'reason', e.target.value)}
                  disabled={row.confirmed}
                />
                <input 
                  type="number" 
                  className="form-input row-field" 
                  placeholder="Amount" 
                  value={row.amount}
                  onChange={(e) => handleUpdateAdjustmentRow(row.id, 'amount', e.target.value)}
                  disabled={row.confirmed}
                />
                <div className="row-actions">
                  <button 
                    className={`btn ${row.confirmed ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                    onClick={() => handleUpdateAdjustmentRow(row.id, 'confirmed', !row.confirmed)}
                  >
                    {row.confirmed ? 'Edit' : 'Confirm'}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleRemoveAdjustmentRow(row.id)}>Delete</button>
                </div>
              </div>
            ))
          )}
        </div>

        {adjustmentRows.length > 0 && (
          <div className="composer-footer mt-4">
            <button className="btn btn-secondary" onClick={handleAddAdjustmentRow}>+ Add Row</button>
          </div>
        )}

        {adjustmentRows.length > 0 && (
          <div className="mt-6 flex justify-end">
            <button className="btn btn-primary btn-full" onClick={handleSaveAdjustments} disabled={saving}>
              {saving ? 'Saving...' : 'Save All Confirmed Adjustments'}
            </button>
          </div>
        )}
      </>
    );
  };

  return (
    <AppNav>
      <div className="dashboard-shell">
        <div className="composer-card panel-card">
          <div className="composer-header panel-header flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="composer-title panel-title">New Entry</h2>
            <div className="composer-actions">
              <input 
                type="date" 
                className="form-input date-picker" 
                max={todayIsoDate()}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          </div>
          
          <div className="composer-tabs flex border-b border-gray-200 dark:border-gray-700 mb-6">
            <button 
              className={`composer-tab py-2 px-4 ${activeTab === 'sales' ? 'active border-b-2 border-blue-500 font-bold' : ''}`}
              onClick={() => setActiveTab('sales')}
            >
              Sales
            </button>
            <button 
              className={`composer-tab py-2 px-4 ${activeTab === 'adjustments' ? 'active border-b-2 border-blue-500 font-bold' : ''}`}
              onClick={() => setActiveTab('adjustments')}
            >
              Adjustments
            </button>
          </div>

          {activeTab === 'sales' ? renderSalesTab() : renderAdjustmentsTab()}
        </div>
      </div>
    </AppNav>
  );
}
