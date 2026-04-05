import { useState } from 'react';
import { useAccounting } from './context/AccountingContext';
import {
  createAccount, updateAccount, deleteAccount,
  createCategory, updateCategory, archiveCategory,
  createCounterparty, updateCounterparty, deleteCounterparty, COLL
} from './accountingService';
import { PlusCircle, Wallet, Edit, Trash2, Archive, Users, BadgeDollarSign, Tag } from 'lucide-react';
import { ACCOUNT_TYPES, COUNTERPARTY_TYPES, CATEGORY_TYPES } from './constants';

// =================== ACCOUNTS VIEW ===================
export function AccountsView({ showToast }) {
  const { accounts, transactions, getAccountBalance, isAdmin, loggedInUser, canWrite, canDelete } = useAccounting();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name_ar:'', account_type:'CASH', opening_balance:0, notes:'', is_active:true });
  const [editId, setEditId] = useState(null);
  const [viewId, setViewId] = useState(null);
  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name_ar.trim()) return showToast('يرجى كتابة اسم الحساب', 'error');
    if (editId) {
      await updateAccount(editId, form);
      showToast('تم تحديث الحساب', 'success');
    } else {
      await createAccount(form, loggedInUser?.username);
      showToast('تم إضافة الحساب', 'success');
    }
    setForm({ name_ar:'', account_type:'CASH', opening_balance:0, notes:'', is_active:true });
    setEditId(null); setShowForm(false);
  };

  const handleEdit = (a) => { setEditId(a.id); setForm({...a}); setShowForm(true); };
  const handleDelete = async (id) => {
    if (window.confirm('حذف هذا الحساب؟')) {
      await deleteAccount(id);
      showToast('تم الحذف', 'info');
    }
  };

  const viewedAccount = viewId ? accounts.find(a => a.id === viewId) : null;
  const viewedTxs = viewId ? transactions.filter(t => t.main_account_id === viewId || t.source_account_id === viewId || t.destination_account_id === viewId).sort((a,b) => (a.transaction_date > b.transaction_date ? 1 : -1)) : [];

  return (
    <div className="animate-fade-in" style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <div className="card-header">
        <h2 className="card-title"><Wallet /> الحسابات والدفاتر</h2>
        {canWrite && <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ name_ar:'', account_type:'CASH', opening_balance:0, notes:'', is_active:true }); }}>
          <PlusCircle size={16}/> حساب جديد
        </button>}
      </div>

      {showForm && canWrite && (
        <div className="card animate-fade-in" style={{ border:'2px solid var(--primary)' }}>
          <h3 className="card-title" style={{ marginBottom:'1.25rem' }}>{editId ? 'تعديل حساب' : 'إضافة حساب جديد'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="stats-grid">
              <div className="form-group"><label>اسم الحساب (عربي) *</label><input type="text" value={form.name_ar} onChange={e=>set('name_ar',e.target.value)} required /></div>
              <div className="form-group">
                <label>نوع الحساب</label>
                <select value={form.account_type} onChange={e=>set('account_type',e.target.value)}>
                  {Object.entries(ACCOUNT_TYPES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="form-group"><label>الرصيد الافتتاحي</label><input type="number" step="any" value={form.opening_balance} onChange={e=>set('opening_balance',parseFloat(e.target.value)||0)} /></div>
              <div className="form-group"><label>ملاحظات</label><input type="text" value={form.notes} onChange={e=>set('notes',e.target.value)} /></div>
            </div>
            <div style={{ display:'flex', gap:'0.75rem', marginTop:'1rem' }}>
              <button type="submit" className="btn btn-primary" style={{ flex:1 }}>{editId ? 'حفظ' : 'إضافة'}</button>
              <button type="button" className="btn btn-outline" onClick={() => { setShowForm(false); setEditId(null); }}>إلغاء</button>
            </div>
          </form>
        </div>
      )}

      {/* Account Ledger Detail */}
      {viewedAccount && (
        <div className="card animate-fade-in" style={{ border:'2px solid var(--primary)' }}>
          <div className="card-header" style={{ marginBottom:'1rem' }}>
            <h3 className="card-title">كشف حساب: {viewedAccount.name_ar}</h3>
            <button className="btn btn-outline" onClick={() => setViewId(null)}>إغلاق</button>
          </div>
          <div className="stats-grid" style={{ marginBottom:'1rem' }}>
            <div className="stat-card">
              <div className="stat-label">الرصيد الحالي</div>
              <div className="stat-value" style={{ color:'var(--primary)', fontSize:'1.4rem' }}>{getAccountBalance(viewedAccount.id).toLocaleString('en-US')}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">عدد الحركات</div>
              <div className="stat-value">{viewedTxs.length}</div>
            </div>
          </div>
          <div className="table-container">
            <table>
              <thead><tr><th>التاريخ</th><th>البيان</th><th>وارد</th><th>صادر</th></tr></thead>
              <tbody>
                {viewedTxs.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign:'center', color:'var(--text-secondary)' }}>لا توجد حركات</td></tr>
                ) : viewedTxs.map(tx => (
                  <tr key={tx.id}>
                    <td>{tx.transaction_date}</td>
                    <td>{tx.description}</td>
                    <td style={{ color:'var(--success)', fontWeight: tx.direction === 'وارد' ? '700':'400' }}>{tx.direction === 'وارد' ? tx.amount.toLocaleString('en-US') : ''}</td>
                    <td style={{ color:'var(--danger)', fontWeight: tx.direction === 'صادر' ? '700':'400' }}>{tx.direction === 'صادر' ? tx.amount.toLocaleString('en-US') : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Accounts Grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:'1rem' }}>
        {accounts.map(acc => {
          const balance = getAccountBalance(acc.id);
          return (
            <div key={acc.id} className="card" style={{ cursor:'pointer', transition:'transform 0.15s' }}
              onClick={() => setViewId(viewId === acc.id ? null : acc.id)}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontWeight:'700', fontSize:'1rem', marginBottom:'0.25rem' }}>{acc.name_ar}</div>
                  <div style={{ fontSize:'0.8rem', color:'var(--text-secondary)' }}>{ACCOUNT_TYPES[acc.account_type] || acc.account_type}</div>
                </div>
                {(canWrite || canDelete) && (
                  <div style={{ display:'flex', gap:'0.3rem' }} onClick={e => e.stopPropagation()}>
                    {canWrite && <button className="btn btn-secondary" style={{ padding:'0.25rem 0.5rem' }} onClick={() => handleEdit(acc)}><Edit size={13}/></button>}
                    {canDelete && <button className="btn btn-danger" style={{ padding:'0.25rem 0.5rem' }} onClick={() => handleDelete(acc.id)}><Trash2 size={13}/></button>}
                  </div>
                )}
              </div>
              <div style={{ marginTop:'1rem', padding:'0.5rem', background:'var(--bg-color)', borderRadius:'var(--radius-sm)', textAlign:'center' }}>
                <div style={{ fontSize:'1.4rem', fontWeight:'800', color: balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>{balance.toLocaleString('en-US')}</div>
                <div style={{ fontSize:'0.8rem', color:'var(--text-secondary)' }}>الرصيد الحالي</div>
              </div>
              {acc.is_main && <div style={{ marginTop:'0.5rem' }}><span className="badge badge-success">رئيسي</span></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =================== CATEGORIES VIEW ===================
export function CategoriesView({ showToast }) {
  const { categories, isAdmin, loggedInUser, canWrite, canDelete } = useAccounting();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name_ar:'', category_type:'INCOME', default_direction:'وارد', is_active:true, color:'#10b981' });
  const [editId, setEditId] = useState(null);
  const [tab, setTab] = useState('INCOME');
  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name_ar.trim()) return showToast('يرجى كتابة اسم الفئة', 'error');
    if (editId) {
      await updateCategory(editId, form);
      showToast('تم تحديث الفئة', 'success');
    } else {
      await createCategory(form, loggedInUser?.username);
      showToast('تم إضافة الفئة', 'success');
    }
    setForm({ name_ar:'', category_type:'INCOME', default_direction:'وارد', is_active:true, color:'#10b981' });
    setEditId(null); setShowForm(false);
  };

  const handleArchive = async (id) => {
    await archiveCategory(id);
    showToast('تم أرشفة الفئة', 'info');
  };

  const filtered = categories.filter(c => c.category_type === tab);

  return (
    <div className="animate-fade-in" style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <div className="card-header">
        <h2 className="card-title"><Tag /> الفئات والتصنيفات</h2>
        {canWrite && (
          <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ name_ar:'', category_type:tab, default_direction: tab === 'INCOME' ? 'وارد' : 'صادر', is_active:true, color:'#10b981' }); }}>
            <PlusCircle size={16}/> فئة جديدة
          </button>
        )}
      </div>

      {showForm && canWrite && (
        <div className="card animate-fade-in" style={{ border:'2px solid var(--primary)' }}>
          <form onSubmit={handleSubmit}>
            <div className="stats-grid">
              <div className="form-group"><label>اسم الفئة *</label><input type="text" value={form.name_ar} onChange={e=>set('name_ar',e.target.value)} required /></div>
              <div className="form-group">
                <label>نوع الفئة</label>
                <select value={form.category_type} onChange={e=>set('category_type',e.target.value)}>
                  {Object.entries(CATEGORY_TYPES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>الاتجاه الافتراضي</label>
                <select value={form.default_direction} onChange={e=>set('default_direction',e.target.value)}>
                  <option value="وارد">وارد (+)</option>
                  <option value="صادر">صادر (-)</option>
                </select>
              </div>
              <div className="form-group"><label>لون</label><input type="color" value={form.color} onChange={e=>set('color',e.target.value)} style={{ height:'40px', padding:'0.2rem' }} /></div>
            </div>
            <div style={{ display:'flex', gap:'0.75rem', marginTop:'1rem' }}>
              <button type="submit" className="btn btn-primary" style={{ flex:1 }}>{editId ? 'حفظ' : 'إضافة'}</button>
              <button type="button" className="btn btn-outline" onClick={() => { setShowForm(false); setEditId(null); }}>إلغاء</button>
            </div>
          </form>
        </div>
      )}

      {/* Tab switcher */}
      <div style={{ display:'flex', gap:'0.5rem', borderBottom:'2px solid var(--border)', paddingBottom:'0.5rem', flexWrap:'wrap' }}>
        {Object.entries(CATEGORY_TYPES).map(([k,v]) => (
          <button key={k} className={`btn ${tab === k ? 'btn-primary' : 'btn-outline'}`} style={{ padding:'0.4rem 0.8rem', fontSize:'0.85rem' }} onClick={() => setTab(k)}>{v}</button>
        ))}
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead><tr><th>اسم الفئة</th><th>النوع</th><th>الاتجاه</th><th>الحالة</th>{(canWrite || canDelete) && <th>إجراءات</th>}</tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign:'center', color:'var(--text-secondary)', padding:'2rem' }}>لا توجد فئات من هذا النوع</td></tr>
              ) : filtered.map(cat => (
                <tr key={cat.id}>
                  <td style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                    <span style={{ width:'12px', height:'12px', borderRadius:'50%', background: cat.color || '#888', display:'inline-block', flexShrink:0 }}/>
                    <span style={{ fontWeight:'600' }}>{cat.name_ar}</span>
                  </td>
                  <td>{CATEGORY_TYPES[cat.category_type] || cat.category_type}</td>
                  <td><span className={`badge ${cat.default_direction === 'وارد' ? 'badge-success' : 'badge-danger'}`}>{cat.default_direction}</span></td>
                  <td><span className={`badge ${cat.is_active !== false ? 'badge-success' : ''}`}>{cat.is_active !== false ? 'نشطة' : 'مؤرشفة'}</span></td>
                  {(canWrite || canDelete) && (
                    <td style={{ display:'flex', gap:'0.3rem' }}>
                      {canWrite && <button className="btn btn-secondary" style={{ padding:'0.25rem 0.5rem' }} onClick={() => { setEditId(cat.id); setForm({...cat}); setShowForm(true); }}><Edit size={13}/></button>}
                      {canDelete && <button className="btn btn-outline" style={{ padding:'0.25rem 0.5rem' }} onClick={() => handleArchive(cat.id)} title="أرشفة"><Archive size={13}/></button>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// =================== COUNTERPARTIES VIEW ===================
export function CounterpartiesView({ showToast }) {
  const { counterparties, isAdmin, loggedInUser, canWrite, canDelete } = useAccounting();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name_ar:'', type:'PERSON', phone:'', notes:'' });
  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  const EMPTY = { name_ar:'', type:'PERSON', phone:'', notes:'' };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name_ar.trim()) return showToast('يرجى كتابة الاسم', 'error');
    if (editId) {
      await updateCounterparty(editId, form);
      showToast('تم تحديث بيانات المتبرع', 'success');
    } else {
      await createCounterparty(form, loggedInUser?.username);
      showToast('تمت الإضافة', 'success');
    }
    setForm(EMPTY);
    setEditId(null);
    setShowForm(false);
  };

  const handleEdit = (cp) => {
    setEditId(cp.id);
    setForm({ name_ar: cp.name_ar, type: cp.type, phone: cp.phone || '', notes: cp.notes || '' });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (cp) => {
    if (!window.confirm(`حذف المتبرع “${cp.name_ar}”؟`)) return;
    await deleteCounterparty(cp.id);
    showToast('تم الحذف', 'info');
  };

  return (
    <div className="animate-fade-in" style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <div className="card-header">
        <h2 className="card-title"><Users /> المتبرعون</h2>
        {canWrite && <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditId(null); setForm(EMPTY); }}><PlusCircle size={16}/> إضافة متبرع</button>}
      </div>

      {showForm && canWrite && (
        <div className="card animate-fade-in" style={{ border:'2px solid var(--primary)' }}>
          <h3 className="card-title" style={{ marginBottom:'1rem' }}>{editId ? 'تعديل بيانات المتبرع' : 'إضافة متبرع جديد'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="stats-grid">
              <div className="form-group"><label>الاسم *</label><input type="text" value={form.name_ar} onChange={e=>set('name_ar',e.target.value)} required /></div>
              <div className="form-group">
                <label>النوع</label>
                <select value={form.type} onChange={e=>set('type',e.target.value)}>
                  {Object.entries(COUNTERPARTY_TYPES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="form-group"><label>الهاتف</label><input type="tel" value={form.phone} onChange={e=>set('phone',e.target.value)} /></div>
              <div className="form-group"><label>ملاحظات</label><input type="text" value={form.notes} onChange={e=>set('notes',e.target.value)} /></div>
            </div>
            <div style={{ display:'flex', gap:'0.75rem', marginTop:'1rem' }}>
              <button type="submit" className="btn btn-primary" style={{ flex:1 }}>{editId ? 'حفظ التعديلات' : 'إضافة'}</button>
              <button type="button" className="btn btn-outline" onClick={() => { setShowForm(false); setEditId(null); setForm(EMPTY); }}>إلغاء</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="table-container">
          <table>
            <thead><tr>
              <th>الاسم</th>
              <th>النوع</th>
              <th>الهاتف</th>
              <th>ملاحظات</th>
              {(canWrite || canDelete) && <th>إجراءات</th>}
            </tr></thead>
            <tbody>
              {counterparties.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign:'center', color:'var(--text-secondary)', padding:'2rem' }}>لا يوجد متبرعون مضافون بعد</td></tr>
              ) : counterparties.map(cp => (
                <tr key={cp.id}>
                  <td style={{ fontWeight:'600' }}>{cp.name_ar}</td>
                  <td>{COUNTERPARTY_TYPES[cp.type] || cp.type}</td>
                  <td style={{ direction:'ltr', textAlign:'right' }}>{cp.phone || '-'}</td>
                  <td style={{ color:'var(--text-secondary)', fontSize:'0.85rem' }}>{cp.notes || '-'}</td>
                  {(canWrite || canDelete) && (
                    <td style={{ display:'flex', gap:'0.3rem' }}>
                      {canWrite && (
                        <button className="btn btn-secondary" style={{ padding:'0.25rem 0.5rem' }} onClick={() => handleEdit(cp)} title="تعديل">
                          <Edit size={13}/>
                        </button>
                      )}
                      {canDelete && (
                        <button className="btn btn-danger" style={{ padding:'0.25rem 0.5rem' }} onClick={() => handleDelete(cp)} title="حذف">
                          <Trash2 size={13}/>
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
