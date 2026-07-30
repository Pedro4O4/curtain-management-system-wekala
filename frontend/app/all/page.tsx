"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppNav } from '../../components/app-nav';
import { useSession } from '../../components/use-session';
import { useToast } from '../../components/toast-context';
import { CalendarSkeleton, StatsSkeleton } from '../../components/skeleton';
import { 
  MonthResponse, 
  monthKeyFromDate, 
  monthLabel, 
  shiftMonth, 
  todayIsoDate, 
  weekdayCount, 
  apiRequest, 
  currency 
} from '../../lib/sales';

export default function AllPage() {
  const router = useRouter();
  const { token, ready } = useSession();
  const { showToast } = useToast();
  
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [monthData, setMonthData] = useState<MonthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setSelectedMonth(monthKeyFromDate(todayIsoDate()));
  }, []);

  useEffect(() => {
    if (!token || !selectedMonth) return;

    let isMounted = true;
    setLoading(true);

    apiRequest<MonthResponse>(`/records/month/${selectedMonth}`, token)
      .then((data) => {
        if (isMounted) {
          setMonthData(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          showToast(err.message || 'Failed to load month data', 'error');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token, selectedMonth, showToast]);

  if (!ready) return null;
  if (!token) {
    return (
      <AppNav>
        <div className="empty-state">
          <div className="empty-text">Loading...</div>
        </div>
      </AppNav>
    );
  }

  const handlePrevMonth = () => setSelectedMonth(shiftMonth(selectedMonth, -1));
  const handleNextMonth = () => setSelectedMonth(shiftMonth(selectedMonth, 1));

  const daysPadding = selectedMonth ? weekdayCount(selectedMonth) : [];

  return (
    <AppNav>
      <div className="dashboard-shell">
        <div className="panel-card">
          <div className="panel-header">
            <div className="month-toolbar">
              <button className="btn btn-icon month-arrow" onClick={handlePrevMonth}>&larr;</button>
              <h2 className="month-title">{selectedMonth ? monthLabel(selectedMonth) : ''}</h2>
              <button className="btn btn-icon month-arrow" onClick={handleNextMonth}>&rarr;</button>
            </div>
          </div>
          
          {loading ? (
            <CalendarSkeleton />
          ) : (
            <div className="calendar-grid">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="weekday-cell">{day}</div>
              ))}
              
              {daysPadding.map((pad, idx) => {
                if (pad.type === 'empty') {
                  return <div key={`empty-${idx}`} className="calendar-empty"></div>;
                }
                const day = monthData?.days.find(d => {
                  const dNum = parseInt(d.date.split('-')[2], 10);
                  return dNum === pad.day;
                });
                
                if (!day) return <div key={`empty-${idx}`} className="calendar-empty"></div>;
                
                const isToday = day.date === todayIsoDate();
                const isLocked = day.date > todayIsoDate();
                const hasData = day.dayTotal > 0;
                
                let cellClasses = 'day-cell';
                if (isToday) cellClasses += ' today active';
                if (isLocked) cellClasses += ' locked';
                if (hasData) cellClasses += ' has-data';

                return (
                  <button 
                    key={day.date} 
                    className={cellClasses}
                    disabled={isLocked}
                    onClick={() => {
                      if (!isLocked) router.push(`/details?date=${day.date}`);
                    }}
                  >
                    <span className="day-number">{pad.day}</span>
                    {hasData && <span className="day-amount">{currency.format(day.dayTotal)}</span>}
                    {day.saleCount > 0 && <span className="day-badge badge badge-primary">{day.saleCount} sales</span>}
                    {isLocked && <span className="day-status badge badge-locked">Locked</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="panel-card mt-6">
          <div className="panel-header">
            <h3 className="panel-title">Month Summary</h3>
          </div>
          {loading ? (
            <StatsSkeleton />
          ) : (
            <div className="stats-grid">
              <div className="stat-card highlight">
                <div className="stat-label">Month Total</div>
                <div className="stat-value">{currency.format(monthData?.total || 0)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total Sales</div>
                <div className="stat-value">
                  {monthData?.days.reduce((acc, curr) => acc + curr.saleCount, 0) || 0}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Active Days</div>
                <div className="stat-value">
                  {monthData?.days.filter(d => d.dayTotal > 0).length || 0}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Current Status</div>
                <div className="stat-value badge badge-success">Open</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppNav>
  );
}
