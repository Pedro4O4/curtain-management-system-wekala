"use client";

import { useEffect, useState } from 'react';
import { AppNav } from '../../../components/app-nav';
import { TableSkeleton, StatsSkeleton } from '../../../components/skeleton';
import { useSession } from '../../../components/use-session';
import { useToast } from '../../../components/toast-context';
import { apiRequest, currency, SalesListResponse } from '../../../lib/sales';

export default function SalesDetailsPage() {
  const { token, ready } = useSession();
  const { showToast } = useToast();
  const [salesData, setSalesData] = useState<SalesListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    setLoading(true);

    apiRequest<SalesListResponse>('/records/sales', token)
      .then((data) => {
        if (isMounted) {
          setSalesData(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          showToast(err.message || 'Failed to load sales', 'error');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token, showToast]);

  if (!ready || !token) return null;

  return (
    <AppNav>
      <div className="dashboard-shell">
        <div className="panel-card">
          <div className="panel-header">
            <h2 className="panel-title">All Sales</h2>
          </div>
          {loading ? (
            <StatsSkeleton />
          ) : (
            <div className="stats-grid">
              <div className="stat-card highlight">
                <div className="stat-label">Total Sales</div>
                <div className="stat-value">{currency.format(salesData?.total || 0)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Sales Entries</div>
                <div className="stat-value">{salesData?.sales.length || 0}</div>
              </div>
            </div>
          )}
        </div>

        <div className="panel-card">
          <div className="panel-header">
            <h3 className="panel-title">Sales Entries</h3>
          </div>
          <div className="data-table scrollable">
            <div className="table-header cols-3">
              <div>Date</div>
              <div>Item</div>
              <div>Price</div>
            </div>
            {loading ? (
              <TableSkeleton />
            ) : salesData?.sales.length === 0 ? (
              <div className="table-empty empty-state">
                <div className="empty-text">No sales recorded</div>
              </div>
            ) : (
              salesData?.sales.map((sale, index) => (
                <div key={`${sale.date}-${sale.item}-${index}`} className="table-row cols-3">
                  <div>{sale.date}</div>
                  <div>{sale.item}</div>
                  <div>{currency.format(sale.price)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AppNav>
  );
}
