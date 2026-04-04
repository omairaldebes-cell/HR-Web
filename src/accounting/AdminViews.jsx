import { useState } from 'react';
import { useAccounting } from './context/AccountingContext';
import { createCustomField, createTemplate, update, COLL } from './accountingService';
import { Settings as SettingsIcon, PlusCircle, Hash, Cpu, FileText } from 'lucide-react';
import { CUSTOM_FIELD_TYPES, TRANSACTION_TYPES } from './constants';

// =================== CUSTOM FIELDS BUILDER ===================
export function CustomFieldsBuilder({ showToast }) {
  const { customFields, isAdmin, loggedInUser } = useAccounting();
  const [form, setForm] = useState({ label:'', type:'TEXT', is_required:false, placeholder:'' });
  const [showForm, setShowForm] = useState(false);
  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.label.trim()) return showToast('يرجى كتابة اسم الحقل', 'error');
    await createCustomField({
      ...form,
      id: `cf_${Date.now()}`,
      applies_to: 'all',
    }, loggedInUser?.username);
    showToast('تم إضافة الحقل المخصص', 'success');
    setForm({ label:'', type:'TEXT', is_required:false, placeholder:'' });
    setShowForm(false);
  };

  return (
    <div className="animate-fade-in" style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <div className="card-header">
        <h2 className="card-title"><Hash /> منشئ الحقول المخصصة</h2>
        {isAdmin && <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}><PlusCircle size={16}/> حقل جديد</button>}
      </div>

      {!isAdmin && <div className="card" style={{ padding:'1.5rem', color:'var(--text-secondary)', textAlign:'center' }}>إدارة الحقول المخصصة متاحة للمديرين فقط</div>}

      {showForm && isAdmin && (
        <div className="card animate-fade-in" style={{ border:'2px solid var(--primary)' }}>
          <form onSubmit={handleSubmit}>
            <div className="stats-grid">
              <div className="form-group"><label>اسم الحقل (تسمية) *</label><input type="text" value={form.label} onChange={e=>set('label',e.target.value)} required /></div>
              <div className="form-group">
                <label>نوع البيانات</label>
                <select value={form.type} onChange={e=>set('type',e.target.value)}>
                  {Object.entries(CUSTOM_FIELD_TYPES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="form-group"><label>placeholder (إن وجد)</label><input type="text" value={form.placeholder} onChange={e=>set('placeholder',e.target.value)} /></div>
              <div className="form-group" style={{ display:'flex', alignItems:'center', gap:'0.5rem', paddingTop:'1.5rem' }}>
                <input type="checkbox" checked={form.is_required} onChange={e=>set('is_required',e.target.checked)} style={{ width:'auto' }} id="req" />
                <label htmlFor="req" style={{ cursor:'pointer', margin:0 }}>حقل إلزامي</label>
              </div>
            </div>
            <div style={{ display:'flex', gap:'0.75rem', marginTop:'1rem' }}>
              <button type="submit" className="btn btn-primary" style={{ flex:1 }}>إضافة الحقل</button>
              <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>إلغاء</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="table-container">
          <table>
            <thead><tr><th>اسم الحقل</th><th>النوع</th><th>إلزامي</th><th>placeholder</th></tr></thead>
            <tbody>
              {customFields.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign:'center', color:'var(--text-secondary)', padding:'2rem' }}>لا توجد حقول مخصصة بعد. أضف حقلاً ليظهر في نموذج الإدخال تلقائياً.</td></tr>
              ) : customFields.map(cf => (
                <tr key={cf.id}>
                  <td style={{ fontWeight:'600' }}>{cf.label}</td>
                  <td>{CUSTOM_FIELD_TYPES[cf.type] || cf.type}</td>
                  <td>{cf.is_required ? '✓' : '-'}</td>
                  <td style={{ color:'var(--text-secondary)', fontSize:'0.85rem' }}>{cf.placeholder || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// =================== ACCOUNTING SETTINGS ===================
export function AccountingSettings({ showToast }) {
  const { company, isAdmin } = useAccounting();
  const [form, setForm] = useState({ name_ar: company?.name_ar || '', currency: company?.currency || 'ل.س', decimal_places: company?.decimal_places ?? 0 });
  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  const handleSave = async (e) => {
    e.preventDefault();
    await update(COLL.COMPANY, 'default', form);
    showToast('تم حفظ إعدادات الشركة', 'success');
  };

  return (
    <div className="animate-fade-in" style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <div className="card-header">
        <h2 className="card-title"><SettingsIcon /> إعدادات دفتر اليومية</h2>
      </div>

      {!isAdmin && (
        <div className="card" style={{ padding:'1.5rem', color:'var(--text-secondary)', textAlign:'center' }}>الإعدادات متاحة للمديرين فقط</div>
      )}

      {isAdmin && (
        <div className="card">
          <h3 className="card-title" style={{ marginBottom:'1.5rem' }}>معلومات الشركة / الجهة</h3>
          <form onSubmit={handleSave}>
            <div className="stats-grid">
              <div className="form-group"><label>اسم الجهة (عربي)</label><input type="text" value={form.name_ar} onChange={e=>set('name_ar',e.target.value)} /></div>
              <div className="form-group"><label>رمز العملة (مثل: ل.س)</label><input type="text" value={form.currency} onChange={e=>set('currency',e.target.value)} /></div>
              <div className="form-group"><label>الخانات العشرية</label><input type="number" min="0" max="3" value={form.decimal_places} onChange={e=>set('decimal_places',parseInt(e.target.value)||0)} /></div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop:'1rem' }}>حفظ الإعدادات</button>
          </form>
        </div>
      )}

      {isAdmin && (
        <div className="card" style={{ padding:'1.5rem' }}>
          <h3 className="card-title" style={{ marginBottom:'1rem' }}>قوائم Firestore المستخدمة</h3>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:'0.5rem' }}>
            {['accounting_accounts','accounting_categories','accounting_counterparties','accounting_transactions','accounting_custom_fields','accounting_templates','accounting_periods','accounting_audit_log','accounting_company'].map(c => (
              <code key={c} style={{ padding:'0.3rem 0.6rem', background:'var(--bg-color)', borderRadius:'4px', fontSize:'0.78rem', border:'1px solid var(--border)' }}>{c}</code>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
