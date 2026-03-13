'use client';
/**
 * Settings  /adminpanel/settings
 * APIs needed:
 *   GET   /admin/settings              → { settings: { key: value } }
 *   PATCH /admin/settings              body: { key: value, ... }  → save settings
 *
 *   Settings keys:
 *     platform_name, platform_tagline, support_email
 *     max_recipes_per_user, enable_video_upload, enable_ads
 *     default_llm_provider, ollama_base_url
 *     recipe_cache_ttl_days, max_chat_history
 *     maintenance_mode, maintenance_message
 *     enable_chef_registration, require_chef_verification
 *     smtp_host, smtp_port, smtp_from
 */
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };
const hdr = (json = false) => ({ Authorization: `Bearer ${tok()}`, ...(json ? { 'Content-Type': 'application/json' } : {}) });

type Settings = Record<string, string | number | boolean>;

/* Toggle switch component */
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 24, borderRadius: 99, border: 'none', cursor: 'pointer',
        background: value ? 'var(--ag)' : 'var(--as2)',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        boxShadow: value ? '0 0 8px rgba(34,197,94,0.3)' : 'none',
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 3,
        left: value ? 23 : 3,
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </button>
  );
}

/* Section wrapper */
function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="adm-card adm-mb3">
      <div className="adm-card-hd">
        <span className="adm-card-title">{icon} {title}</span>
      </div>
      <div className="adm-card-bd" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {children}
      </div>
    </div>
  );
}

/* Setting row */
function SettingRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--at)' }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: 'var(--at3)', marginTop: 2 }}>{hint}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [settings,  setSettings]  = useState<Settings>({});
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [saved,     setSaved]     = useState(false);

  useEffect(() => {
    if (!tok()) { router.push('/adminpanel/login'); return; }
    fetch(`${API}/admin/settings`, { headers: hdr() })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.settings) setSettings(j.settings); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line

  const set = (key: string, value: string | number | boolean) =>
    setSettings(prev => ({ ...prev, [key]: value }));

  const get = (key: string, fallback: string | number | boolean = '') =>
    settings[key] ?? fallback;

  const save = async () => {
    setSaving(true); setError(null); setSaved(false);
    try {
      const r = await fetch(`${API}/admin/settings`, {
        method: 'PATCH', headers: hdr(true),
        body: JSON.stringify(settings),
      });
      if (!r.ok) { const t = await r.text(); throw new Error(t); }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--at3)' }}>
      <div style={{ fontSize: 24, marginBottom: 10 }}>⚙</div>
      Loading settings…
    </div>
  );

  return (
    <>
      <div className="adm-ph">
        <div>
          <div className="adm-ph-title">Settings</div>
          <div className="adm-ph-sub">Platform configuration and feature flags</div>
        </div>
        <div className="adm-ph-actions">
          {saved && <span style={{ fontSize: 12, color: 'var(--ag)', fontWeight: 600 }}>✓ Saved</span>}
          {error && <span style={{ fontSize: 12, color: 'var(--ar)' }}>⚠ {error}</span>}
          <button className="adm-btn adm-btn-primary" onClick={save} disabled={saving}>
            {saving ? '⏳ Saving…' : '💾 Save All Settings'}
          </button>
        </div>
      </div>

      {/* Platform */}
      <Section title="Platform" icon="🍳">
        <SettingRow label="Platform Name" hint="Shown in the browser tab and emails">
          <input className="adm-input" style={{ width: 240 }} value={String(get('platform_name', 'Chefsy'))} onChange={e => set('platform_name', e.target.value)} />
        </SettingRow>
        <SettingRow label="Tagline" hint="Shown on the home page below the logo">
          <input className="adm-input" style={{ width: 240 }} value={String(get('platform_tagline', 'Your AI Kitchen Companion'))} onChange={e => set('platform_tagline', e.target.value)} />
        </SettingRow>
        <SettingRow label="Support Email" hint="Shown in error pages and emails">
          <input className="adm-input" style={{ width: 240 }} type="email" value={String(get('support_email', ''))} onChange={e => set('support_email', e.target.value)} placeholder="support@chefsy.com" />
        </SettingRow>
      </Section>

      {/* Maintenance */}
      <Section title="Maintenance Mode" icon="🔧">
        <SettingRow label="Enable Maintenance Mode" hint="Blocks all non-admin users with a message">
          <Toggle value={Boolean(get('maintenance_mode', false))} onChange={v => set('maintenance_mode', v)} />
        </SettingRow>
        {get('maintenance_mode', false) && (
          <SettingRow label="Maintenance Message" hint="Displayed to users during maintenance">
            <textarea className="adm-textarea" style={{ width: 300, height: 72 }}
              value={String(get('maintenance_message', "We're upgrading Chefsy. Back soon!"))}
              onChange={e => set('maintenance_message', e.target.value)} />
          </SettingRow>
        )}
      </Section>

      {/* Features */}
      <Section title="Feature Flags" icon="◈">
        <SettingRow label="Enable Ads in Chat Feed" hint="Show sponsored content between chat blocks">
          <Toggle value={Boolean(get('enable_ads', true))} onChange={v => set('enable_ads', v)} />
        </SettingRow>
        <SettingRow label="Enable Video Upload" hint="Allow users to submit YouTube links">
          <Toggle value={Boolean(get('enable_video_upload', true))} onChange={v => set('enable_video_upload', v)} />
        </SettingRow>
        <SettingRow label="Enable Chef Registration" hint="Allow users to register as chefs">
          <Toggle value={Boolean(get('enable_chef_registration', true))} onChange={v => set('enable_chef_registration', v)} />
        </SettingRow>
        <SettingRow label="Require Chef Verification" hint="Chefs need admin approval before appearing publicly">
          <Toggle value={Boolean(get('require_chef_verification', true))} onChange={v => set('require_chef_verification', v)} />
        </SettingRow>
      </Section>

      {/* AI / LLM */}
      <Section title="AI & LLM Configuration" icon="✦">
        <SettingRow label="Default LLM Provider" hint="Used when user doesn't select a model">
          <select className="adm-select" style={{ width: 200 }} value={String(get('default_llm_provider', 'ollama'))} onChange={e => set('default_llm_provider', e.target.value)}>
            <option value="ollama">Ollama (local)</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="groq">Groq</option>
          </select>
        </SettingRow>
        <SettingRow label="Ollama Base URL" hint="Only used when provider is Ollama">
          <input className="adm-input" style={{ width: 240 }} value={String(get('ollama_base_url', 'http://localhost:11434'))} onChange={e => set('ollama_base_url', e.target.value)} />
        </SettingRow>
        <SettingRow label="Recipe Cache TTL (days)" hint="How long cached recipes are kept before re-generating">
          <input className="adm-input" style={{ width: 100 }} type="number" min={1} max={365}
            value={Number(get('recipe_cache_ttl_days', 30))} onChange={e => set('recipe_cache_ttl_days', Number(e.target.value))} />
        </SettingRow>
        <SettingRow label="Max Chat History (messages)" hint="Max messages stored per chat session">
          <input className="adm-input" style={{ width: 100 }} type="number" min={5} max={200}
            value={Number(get('max_chat_history', 50))} onChange={e => set('max_chat_history', Number(e.target.value))} />
        </SettingRow>
      </Section>

      {/* Limits */}
      <Section title="User Limits" icon="◎">
        <SettingRow label="Max Recipes Per User" hint="0 = unlimited">
          <input className="adm-input" style={{ width: 100 }} type="number" min={0}
            value={Number(get('max_recipes_per_user', 0))} onChange={e => set('max_recipes_per_user', Number(e.target.value))} />
        </SettingRow>
        <SettingRow label="Max Chats Per User Per Day" hint="0 = unlimited">
          <input className="adm-input" style={{ width: 100 }} type="number" min={0}
            value={Number(get('max_chats_per_day', 0))} onChange={e => set('max_chats_per_day', Number(e.target.value))} />
        </SettingRow>
      </Section>

      {/* Email / SMTP */}
      <Section title="Email (SMTP)" icon="✉">
        <SettingRow label="SMTP Host" hint="e.g. smtp.sendgrid.net">
          <input className="adm-input" style={{ width: 240 }} value={String(get('smtp_host', ''))} onChange={e => set('smtp_host', e.target.value)} placeholder="smtp.example.com" />
        </SettingRow>
        <div className="adm-grid2" style={{ gap: 12 }}>
          <SettingRow label="SMTP Port">
            <input className="adm-input" style={{ width: 100 }} type="number" value={Number(get('smtp_port', 587))} onChange={e => set('smtp_port', Number(e.target.value))} />
          </SettingRow>
          <SettingRow label="From Address">
            <input className="adm-input" style={{ width: 200 }} type="email" value={String(get('smtp_from', ''))} onChange={e => set('smtp_from', e.target.value)} placeholder="noreply@chefsy.com" />
          </SettingRow>
        </div>
      </Section>

      {/* Danger zone */}
      <div className="adm-card" style={{ border: '1px solid rgba(248,113,113,0.2)' }}>
        <div className="adm-card-hd" style={{ borderBottom: '1px solid rgba(248,113,113,0.15)' }}>
          <span className="adm-card-title" style={{ color: 'var(--ar)' }}>⚠ Danger Zone</span>
        </div>
        <div className="adm-card-bd" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SettingRow label="Clear Recipe Cache" hint="Removes all cached recipes. Users will see live LLM-generated results until cache rebuilds.">
            <button className="adm-btn adm-btn-danger adm-btn-sm"
              onClick={() => {
                if (window.confirm('Clear ALL cached recipes? This cannot be undone.')) {
                  fetch(`${API}/admin/cache/clear`, { method: 'POST', headers: hdr() });
                }
              }}>
              Clear Cache
            </button>
          </SettingRow>
          <SettingRow label="Flush Chat Logs" hint="Deletes all chat history for all users permanently.">
            <button className="adm-btn adm-btn-danger adm-btn-sm"
              onClick={() => {
                if (window.confirm('Delete ALL chat logs permanently? This cannot be undone.')) {
                  fetch(`${API}/admin/chats/flush`, { method: 'DELETE', headers: hdr() });
                }
              }}>
              Flush Logs
            </button>
          </SettingRow>
        </div>
      </div>

      {/* Sticky save bar */}
      <div style={{ position: 'sticky', bottom: 0, background: 'linear-gradient(0deg,var(--ab) 70%,transparent)', padding: '16px 0 0', marginTop: 12 }}>
        <div style={{ background: 'var(--as)', border: '1px solid var(--ae2)', borderRadius: 'var(--r2)', padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'var(--at2)' }}>
            {saved ? <span style={{ color: 'var(--ag)', fontWeight: 600 }}>✓ All settings saved</span>
                   : error ? <span style={{ color: 'var(--ar)' }}>⚠ {error}</span>
                   : 'Unsaved changes will be lost if you navigate away.'}
          </span>
          <button className="adm-btn adm-btn-primary" onClick={save} disabled={saving}>
            {saving ? '⏳ Saving…' : '💾 Save All Settings'}
          </button>
        </div>
      </div>
    </>
  );
}
