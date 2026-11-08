import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { ApiError } from "../../api/client";
import { getMyProviderProfile, listAssignedServiceRequests, quoteAssignedServiceRequest, updateAssignedServiceRequestStatus } from "../../api/providers";
import type { ApiServiceProvider, ApiServiceRequest, ServiceRequestStatus } from "../../api/types";

const nextStatuses: Record<ServiceRequestStatus, ServiceRequestStatus[]> = {
  PENDING: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function ProviderDashboardPage() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<ApiServiceProvider | null>(null);
  const [requests, setRequests] = useState<ApiServiceRequest[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [quote, setQuote] = useState<Record<string, { amount: string; notes: string }>>({});

  const load = useCallback(async () => {
    try {
      const [p, r] = await Promise.all([getMyProviderProfile(), listAssignedServiceRequests()]);
      setProfile(p);
      setRequests(r);
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load provider dashboard.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const updateStatus = async (id: string, status: ServiceRequestStatus) => {
    setBusyId(id);
    try {
      const updated = await updateAssignedServiceRequestStatus(id, status);
      setRequests((cur) => cur.map((r) => (r.id === id ? updated : r)));
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not update request."); }
    finally { setBusyId(null); }
  };

  const sendQuote = async (id: string) => {
    const q = quote[id] || { amount: "", notes: "" };
    setBusyId(id);
    try {
      const updated = await quoteAssignedServiceRequest(id, { quote_amount_kes: q.amount ? Number(q.amount) : null, quote_notes: q.notes || null });
      setRequests((cur) => cur.map((r) => (r.id === id ? updated : r)));
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not send quote."); }
    finally { setBusyId(null); }
  };

  return (
    <main className="page-wrap page-wrap--wide" style={{ padding: "2rem 1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h1>Provider Dashboard</h1>
          <p className="muted">Requests assigned to your approved provider profile appear here. You can accept work, progress status, and send quotes.</p>
          <p><strong>{user?.full_name}</strong> · {user?.email}</p>
          {profile ? <p className="muted"><strong>Profile:</strong> {profile.name} · {profile.category} · <strong>{profile.status}</strong></p> : <p className="form-status">No provider profile is linked to this account yet. Ask an administrator to create and approve a provider profile with your user as owner.</p>}
        </div>
        <div style={{ display: "flex", gap: ".5rem" }}>
          <Link className="button button--outline" to="/">Home</Link>
          <button className="button button--outline" type="button" onClick={() => { logout(); window.location.href = "/login"; }}>Log out</button>
        </div>
      </div>
      {error && <p className="form-status" role="alert">{error}</p>}
      {!error && requests.length === 0 && <p className="muted">No assigned service requests yet.</p>}
      <div style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
        {requests.map((r) => (
          <article key={r.id} className="dashboard-panel" style={{ padding: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
              <div style={{ minWidth: 280, flex: 1 }}>
                <h2 style={{ margin: 0 }}>{r.event_name}</h2>
                <p className="muted" style={{ margin: ".25rem 0" }}>{r.provider_name} · requested {new Date(r.requested_date).toLocaleString()}</p>
                {r.notes && <p>{r.notes}</p>}
                <p><strong>Status:</strong> {r.status} · <strong>Code:</strong> {r.confirmation_code}</p>
                {r.quote_amount_kes != null && <p><strong>Quote:</strong> KES {r.quote_amount_kes} {r.quote_notes ? `· ${r.quote_notes}` : ""}</p>}
              </div>
              <div style={{ display: "grid", gap: ".5rem", alignContent: "start", minWidth: 260 }}>
                <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
                  {nextStatuses[r.status].map((status) => (
                    <button key={status} className="button button--outline button--small" type="button" disabled={busyId === r.id} onClick={() => void updateStatus(r.id, status)}>{status.replace("_", " ")}</button>
                  ))}
                </div>
                {!["CANCELLED", "COMPLETED"].includes(r.status) && (
                  <div style={{ display: "grid", gap: ".4rem" }}>
                    <label className="form-field"><span>Quote (KES)</span><input type="number" min="0" value={quote[r.id]?.amount ?? (r.quote_amount_kes ?? "")} onChange={(e) => setQuote((c) => ({ ...c, [r.id]: { amount: e.target.value, notes: c[r.id]?.notes ?? r.quote_notes ?? "" } }))} /></label>
                    <label className="form-field"><span>Quote notes</span><input value={quote[r.id]?.notes ?? (r.quote_notes ?? "")} onChange={(e) => setQuote((c) => ({ ...c, [r.id]: { amount: c[r.id]?.amount ?? String(r.quote_amount_kes ?? ""), notes: e.target.value } }))} /></label>
                    <button className="button button--outline button--small" type="button" disabled={busyId === r.id} onClick={() => void sendQuote(r.id)}>Send quote</button>
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
