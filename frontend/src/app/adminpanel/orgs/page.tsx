'use client';
import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';

interface Org {
  id: number;
  org_name: string;
  org_type: string;
  slug: string;
  plan: string;
  is_active: boolean;
  is_verified: boolean;
  active_modules: string[];
  member_count: number;
  created_at: string;
}

const MODULE_KEY = 'org_custom_meal_planner';

function getToken() {
  try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; }
}

const ORG_TYPE_ICON: Record<string, string> = {
  corporate: '🏢',
  gym: '🏋️',
  nutrition: '🥗',
  others: '🏛️',
};

export default function OrgsPage() {
  const [orgs,    setOrgs]    = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [toggling, setToggling] = useState<number | null>(null);
  const [toast,   setToast]   = useState('');

  const load = () => {
    const tok = getToken();
    fetch(`${API}/admin/orgs?limit=100`, { headers: { Authorization: `Bearer ${tok}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setOrgs(Array.isArray(d) ? d : (d.orgs ?? [])))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const toggleModule = async (org: Org, enabled: boolean) => {
    setToggling(org.id);
    const tok = getToken();
    try {
      const r = await fetch(`${API}/admin/orgs/${org.id}/modules`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ module_key: MODULE_KEY, enabled }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.detail || `HTTP ${r.status}`);
      }
      const data = await r.json();
      setOrgs(prev => prev.map(o => o.id === org.id
        ? { ...o, active_modules: data.active_modules }
        : o
      ));
      showToast(`Custom Meal Planner ${enabled ? 'enabled' : 'disabled'} for ${org.org_name}`);
    } catch (e: any) {
      showToast(`Error: ${e.message}`);
    } finally {
      setToggling(null);
    }
  };

  const filtered = orgs.filter(o =>
    !search || o.org_name.toLowerCase().includes(search.toLowerCase()) ||
    o.org_type.toLowerCase().includes(search.toLowerCase()) ||
    o.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: '#1e293b', color: '#f8fafc', padding: '10px 18px',
          borderRadius: 8, fontSize: 13, boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        }}>
          {toast}
        </div>
      )}

      {/* Page header */}
      <div className="adm-ph">
        <div>
          <div className="adm-ph-title">Organisations</div>
          <div className="adm-ph-sub">
            Manage organisation feature modules · {orgs.length} total orgs
          </div>
        </div>
      </div>

      {/* Module info banner */}
      <div className="adm-card adm-mb3" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>🥗</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--at)', marginBottom: 4 }}>
              Custom Meal Planner Module
            </div>
            <p style={{ fontSize: 12, color: 'var(--at3)', margin: 0, lineHeight: 1.6 }}>
              Toggle allows org admins (Nutrition, Gym, etc.) to manually build 7-day template meal plans
              and invite their members to adopt them. Use the toggle in each row to enable or disable this
              feature per organisation.
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="adm-row adm-g2 adm-mb3">
        <input
          className="adm-input"
          style={{ maxWidth: 320 }}
          placeholder="Search by name, type, or slug…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="adm-card">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="adm-sk" style={{ height: 44, marginBottom: 8, borderRadius: 8 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="adm-card" style={{ textAlign: 'center', padding: 48 }}>
          <div className="adm-empty-icon">🏛️</div>
          <div className="adm-empty-title">No organisations found</div>
        </div>
      ) : (
        <div className="adm-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="adm-tbl-wrap">
            <table className="adm-tbl">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>#</th>
                  <th>Organisation</th>
                  <th>Type</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Plan</th>
                  <th style={{ width: 90, textAlign: 'center' }}>Status</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Members</th>
                  <th style={{ textAlign: 'center', minWidth: 200 }}>
                    🥗 Custom Meal Planner
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((org, i) => {
                  const hasModule = (org.active_modules || []).includes(MODULE_KEY);
                  const isToggling = toggling === org.id;
                  return (
                    <tr key={org.id}>
                      <td style={{ color: 'var(--at3)', fontSize: 11 }}>{i + 1}</td>
                      <td>
                        <div>
                          <span className="td-bold">{org.org_name}</span>
                          <div style={{ fontSize: 11, color: 'var(--at3)', marginTop: 1 }}>{org.slug}</div>
                        </div>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                          <span>{ORG_TYPE_ICON[org.org_type] || '🏛️'}</span>
                          <span style={{ textTransform: 'capitalize' }}>{org.org_type}</span>
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 600,
                          background: 'var(--ae)', color: 'var(--at2)',
                          textTransform: 'capitalize',
                        }}>
                          {org.plan}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                          background: org.is_active ? 'rgba(34,197,94,0.1)' : 'rgba(156,163,175,0.15)',
                          color: org.is_active ? '#16a34a' : 'var(--at3)',
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                          {org.is_active ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--at3)', fontSize: 12 }}>
                        {org.member_count}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                          {/* Toggle switch */}
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: isToggling ? 'wait' : 'pointer' }}>
                            <div
                              onClick={() => !isToggling && toggleModule(org, !hasModule)}
                              style={{
                                width: 40, height: 22, borderRadius: 999, cursor: isToggling ? 'wait' : 'pointer',
                                background: hasModule ? '#3b82f6' : '#cbd5e1',
                                position: 'relative', transition: 'background 0.2s',
                                opacity: isToggling ? 0.6 : 1,
                              }}
                            >
                              <div style={{
                                position: 'absolute', top: 3, left: hasModule ? 20 : 3,
                                width: 16, height: 16, borderRadius: '50%', background: '#fff',
                                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                              }} />
                            </div>
                            <span style={{
                              fontSize: 12, fontWeight: 600,
                              color: hasModule ? '#3b82f6' : 'var(--at3)',
                            }}>
                              {isToggling ? '…' : hasModule ? 'Enabled' : 'Disabled'}
                            </span>
                          </label>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="adm-card adm-mt3" style={{ background: 'var(--ae)', border: 'none' }}>
        <p style={{ fontSize: 12, color: 'var(--at3)', margin: 0, lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--at2)' }}>How it works:</strong> Enabling &quot;Custom Meal Planner&quot; for an
          org adds <code>org_custom_meal_planner</code> to that org&apos;s <code>active_modules</code>.
          The org admin can then build manual 7-day template plans from their dashboard and invite members
          or groups to adopt the plans. The global platform-level toggle is managed in <strong>Platform Modules</strong>.
        </p>
      </div>
    </div>
  );
}
