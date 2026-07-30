"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppNav } from '../../components/app-nav';
import { useSession } from '../../components/use-session';
import { useToast } from '../../components/toast-context';
import { TableSkeleton, StatsSkeleton } from '../../components/skeleton';
import { 
  DayResponse, 
  todayIsoDate, 
  apiRequest, 
  currency
} from '../../lib/sales';

function DetailsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, ready } = useSession();
  const { showToast } = useToast();

  const [date, setDate] = useState<string>('');
  const [dayData, setDayData] = useState<DayResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let initialDate = searchParams.get('date');
    if (!initialDate) {
      initialDate = localStorage.getItem('el-wekala-last-sale-date') || todayIsoDate();
    }
    setDate(initialDate);
  }, [searchParams]);

  useEffect(() => {
    if (!date) return;
    localStorage.setItem('el-wekala-last-sale-date', date);
  }, [date]);

  useEffect(() => {
    if (!token || !date) return;

    let isMounted = true;
    setLoading(true);

    apiRequest<DayResponse>(`/records/day/${date}`, token)
      .then((data) => {
        if (isMounted) {
          setDayData(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          showToast(err.message || 'Failed to load day data', 'error');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token, date, showToast]);

  if (!ready) return null;
  if (!token) return null;

  const isLocked = date > todayIsoDate();

  return (
    <div className="dashboard-shell">
      <div className="panel-card mb-6">
        <div className="panel-header flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="panel-title">Details for {date}</h2>
          <div className="flex gap-2 items-center">
            <input 
              type="date" 
              className="form-input date-picker" 
              max={todayIsoDate()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <button className="btn btn-secondary" onClick={() => router.push('/all')}>Back to Calendar</button>
            {!isLocked && <button className="btn btn-primary" onClick={() => router.push(`/create`)}>Add Sales</button>}
          </div>
        </div>
        
        {loading ? (
          <StatsSkeleton />
        ) : (
          <div className="stats-grid mt-4">
            <div className="stat-card highlight">
              <div className="stat-label">Day Total</div>
              <div className="stat-value">{currency.format(dayData?.dayTotal || 0)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Sales Total</div>
              <div className="stat-value">{currency.format(dayData?.saleTotal || 0)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Adjustments Total</div>
              <div className="stat-value">{currency.format(dayData?.adjustmentTotal || 0)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Status</div>
              <div className={`stat-value badge ${isLocked ? 'badge-locked' : 'badge-success'}`}>
                {isLocked ? 'Locked' : 'Open'}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="panel-card mb-6">
        <div className="panel-header">
          <h3 className="panel-title">Sales</h3>
        </div>
        <div className="data-table scrollable">
          <div className="table-header cols-2">
            <div>Item</div>
            <div>Price</div>
          </div>
          {loading ? (
            <TableSkeleton />
          ) : (
            dayData?.sales.length === 0 ? (
              <div className="table-empty empty-state">
                <div className="empty-text">No sales recorded</div>
              </div>
            ) : (
              dayData?.sales.map((sale, i) => (
                <div key={i} className="table-row cols-2">
                  <div>{sale.item}</div>
                  <div>{currency.format(sale.price)}</div>
                </div>
              ))
            )
          )}
        </div>
      </div>

      <div className="panel-card">
        <div className="panel-header">
          <h3 className="panel-title">Adjustments</h3>
        </div>
        <div className="data-table scrollable">
          <div className="table-header cols-3">
            <div>Amount</div>
            <div>Reason</div>
            <div>Type</div>
          </div>
          {loading ? (
            <TableSkeleton />
          ) : (
            dayData?.adjustments.length === 0 ? (
              <div className="table-empty empty-state">
                <div className="empty-text">No adjustments</div>
              </div>
            ) : (
              dayData?.adjustments.map((adj, i) => (
                <div key={i} className="table-row cols-3">
                  <div>{currency.format(adj.amount)}</div>
                  <div>{adj.reason}</div>
                  <div>{adj.direction === '+' ? 'Addition' : 'Deduction'}</div>
                </div>
              ))
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default function DetailsPage() {
  return (
    <AppNav>
      <Suspense fallback={<StatsSkeleton />}>
        <DetailsContent />
      </Suspense>
    </AppNav>
  );
}
