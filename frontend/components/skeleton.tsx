"use client";

export function CalendarSkeleton() {
  return (
    <div className="calendar-grid">
      {Array.from({ length: 35 }, (_, i) => (
        <div key={i} className="skeleton skeleton-cell" />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="data-table">
      <div className="skeleton skeleton-row" style={{ borderRadius: '12px 12px 0 0' }} />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton skeleton-row" style={{ marginTop: 1 }} />
      ))}
    </div>
  );
}

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="stats-grid">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton skeleton-card" />
      ))}
    </div>
  );
}
