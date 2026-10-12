// Instant loading state for every admin route: navigations show structure
// immediately instead of a blank page while the server fetches (each DB
// round trip costs a transatlantic RTT, so first paint would otherwise wait
// seconds with no feedback).
export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-[var(--ops-bg)]">
      <div className="max-w-[1180px] mx-auto px-6 lg:px-7 py-6 animate-pulse" aria-busy="true" aria-label="Loading">
        <div className="ph">
          <div>
            <div className="h-7 w-48 rounded bg-[var(--ops-border)]" />
            <div className="h-4 w-64 rounded bg-[var(--ops-border)] mt-2" />
          </div>
        </div>
        <div className="kpis">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card kpi">
              <div className="ki" />
              <div className="h-3 w-24 rounded bg-[var(--ops-border)]" />
              <div className="h-7 w-28 rounded bg-[var(--ops-border)] mt-2" />
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-h"><div className="h-4 w-32 rounded bg-[var(--ops-border)]" /></div>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="row">
              <div className="tx">
                <div className="h-4 w-2/3 rounded bg-[var(--ops-border)]" />
                <div className="h-3 w-1/3 rounded bg-[var(--ops-border)] mt-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
