import { useState, useMemo, useEffect } from 'react';
import { useAccounting } from './context/AccountingContext';
import { createTransaction, deleteTransaction, updateTransaction } from './accountingService';
import {
  BookOpen, PlusCircle, Trash2, Edit, Search, Download, Printer,
  TrendingUp, TrendingDown, Wallet, Filter, X, ChevronDown
} from 'lucide-react';
import { TRANSACTION_TYPES, DIRECTION, CURRENCIES, DEFAULT_CURRENCY } from './constants';
import * as XLSX from 'xlsx';

const EMPTY_FORM = {
  transaction_date: new Date().toISOString().split('T')[0],
  direction: 'صادر',
  transaction_type: 'صرف',
  main_account_id: '',
  category_id: '',
  counterparty_id: '',
  amount: '',
  currency: DEFAULT_CURRENCY,
  description: '',
  reference_no: '',
  payment_method: 'نقدي',
  notes: '',
  source_account_id: '',
  destination_account_id: '',
  custom_values: {},
};

export default function DailyJournal({ showToast }) {
  const { transactions, accounts, categories, counterparties, customFields, getMonthSummary,
          calculateRunningBalance, isAdmin, loggedInUser, canWrite, canDelete } = useAccounting();

  // Find the main cash account to use as default
  const mainCashAccount = useMemo(() =>
    accounts.find(a => a.is_main === true) ||
    accounts.find(a => a.account_type === 'CASH') ||
    null
  , [accounts]);

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);

  // Auto-set main account defaults once accounts are loaded
  useEffect(() => {
    if (mainCashAccount && !editId) {
      setForm(f => f.main_account_id ? f : { ...f, main_account_id: mainCashAccount.id });
    }
  }, [mainCashAccount, editId]);

  const openNewForm = () => {
    setEditId(null);
    setShowForm(true);
    setForm({ ...EMPTY_FORM, main_account_id: mainCashAccount?.id || '' });
  };

  // Filters
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = today.slice(0, 7);
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterAccount, setFilterAccount] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterCounterparty, setFilterCounterparty] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) {
      showToast('المبلغ يجب أن يكون أكبر من صفر', 'error'); return;
    }
    if (!form.main_account_id) {
      showToast('يرجى اختيار الحساب', 'error'); return;
    }
    if (!form.description.trim()) {
      showToast('يرجى كتابة البيان', 'error'); return;
    }

    try {
      const data = {
        ...form,
        amount: parseFloat(form.amount),
        month_period: form.transaction_date.slice(0, 7),
      };

      if (editId) {
        await updateTransaction(editId, data, loggedInUser?.username);
        showToast('تم تحديث القيد بنجاح', 'success');
      } else {
        await createTransaction(data, loggedInUser?.username);
        showToast('تم حفظ القيد بنجاح', 'success');
      }

      setForm({ ...EMPTY_FORM });
      setEditId(null);
      setShowForm(false);
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء الحفظ', 'error');
    }
  };

  const summaryData = useMemo(() => getMonthSummary(filterMonth), [filterMonth, getMonthSummary]);
  const summary = useMemo(() => 
    summaryData[DEFAULT_CURRENCY] || Object.values(summaryData)[0] || { totalIn:0, totalOut:0, net:0 }
  , [summaryData]);

  const handleDelete = async (tx) => {
    if (!window.confirm(`هل تريد حذف القيد "${tx.transaction_no}"؟`)) return;
    await deleteTransaction(tx.id, loggedInUser?.username);
    showToast('تم حذف القيد', 'info');
  };

  // Filtered + sorted + running balance
  const filteredRaw = useMemo(() => {
    return transactions
      .filter(tx => {
        if (filterMonth && !tx.transaction_date?.startsWith(filterMonth)) return false;
        if (filterAccount) {
          if (tx.direction === 'تحويل') {
            if (tx.source_account_id !== filterAccount && tx.destination_account_id !== filterAccount) return false;
          } else {
             if (tx.main_account_id !== filterAccount) return false;
          }
        }
        if (filterCategory && tx.category_id !== filterCategory) return false;
        if (filterCounterparty && tx.counterparty_id !== filterCounterparty) return false;
        if (filterType && tx.direction !== filterType) return false;
        if (filterSearch) {
          const s = filterSearch.toLowerCase();
          if (!tx.description?.toLowerCase().includes(s) &&
              !tx.reference_no?.toLowerCase().includes(s) &&
              !tx.transaction_no?.toLowerCase().includes(s)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.transaction_date > b.transaction_date ? 1 : -1) || (a.created_at||0) - (b.created_at||0));
  }, [transactions, filterMonth, filterAccount, filterCategory, filterType, filterSearch]);

  const filteredWithBalance = useMemo(() => {
    let startingBalance = 0;
    // Calculate accurate starting balance if an account is selected
    if (filterAccount) {
      const acc = accounts.find(a => a.id === filterAccount);
      const accBalances = getAccountBalance(filterAccount);
      const accCurrency = acc?.currency || DEFAULT_CURRENCY;
      startingBalance = accBalances[accCurrency] || 0;
      
      // Since startingBalance from getAccountBalance is the *current* balance, 
      // we need to subtract all transactions *after* the filter month to get the month-start balance.
      // Or we can just calculate from opening_balance + past transactions like before, but filtered by currency.
      startingBalance = acc ? (Number(acc.opening_balance) || 0) : 0;
      
      if (filterMonth) {
         const pastTxs = transactions.filter(t => t.status === 'مرحّل' && t.transaction_date < filterMonth);
         pastTxs.forEach(tx => {
            const txCur = tx.currency || DEFAULT_CURRENCY;
            if (txCur !== accCurrency) return; // Only affect balance if currency matches

            if (tx.direction !== 'تحويل' && tx.main_account_id === filterAccount) {
              startingBalance += tx.direction === 'وارد' ? (tx.amount || 0) : -(tx.amount || 0);
            } else if (tx.direction === 'تحويل') {
              if (tx.source_account_id === filterAccount) startingBalance -= (tx.amount || 0);
              if (tx.destination_account_id === filterAccount) startingBalance += (tx.amount || 0);
            }
         });
      }
    }
    
    return calculateRunningBalance(filteredRaw, startingBalance, filterAccount);
  }, [filteredRaw, calculateRunningBalance, filterAccount, filterMonth, accounts, transactions]);
  const displayRows = [...filteredWithBalance].reverse();


  const exportToExcel = () => {
    const rows = displayRows.map(tx => ({
      'التاريخ': tx.transaction_date,
      'رقم القيد': tx.transaction_no,
      'البيان': tx.description,
      'الحساب': accounts.find(a => a.id === tx.main_account_id)?.name_ar || '',
      'الفئة': categories.find(c => c.id === tx.category_id)?.name_ar || '',
      'وارد': tx.direction === 'وارد' ? tx.amount : 0,
      'صادر': tx.direction === 'صادر' ? tx.amount : 0,
      'العملة': tx.currency || DEFAULT_CURRENCY,
      'الرصيد': tx.running_balance,
      'ملاحظات': tx.notes || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'اليومية');
    XLSX.writeFile(wb, `يومية-${filterMonth}.xlsx`);
  };

  // Visible custom fields
  const visibleCustomFields = customFields;

  return (
    <div className="animate-fade-in" style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      {/* Header */}
      <div className="card-header no-print">
        <h2 className="card-title"><BookOpen /> دفتر اليومية — {filterMonth}</h2>
        <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
          <button className="btn btn-outline" onClick={exportToExcel} style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
            <Download size={15}/> تصدير Excel
          </button>
          <button className="btn btn-outline" onClick={() => window.print()} style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
            <Printer size={15}/> طباعة
          </button>
          {canWrite && (
            <button className="btn btn-primary" onClick={openNewForm}
              style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
              <PlusCircle size={16}/> إضافة قيد جديد
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap' }}>
        {[
          { icon: TrendingUp,   label:'إجمالي الوارد',  val: summary.totalIn,  color:'var(--success)' },
          { icon: TrendingDown, label:'إجمالي الصادر',  val: summary.totalOut, color:'var(--danger)' },
          { icon: Wallet,       label:'صافي الشهر',     val: summary.net,      color: summary.net >= 0 ? 'var(--primary)' : 'var(--danger)' },
        ].map(k => (
          <div key={k.label} className="stat-card" style={{ flex:'1', minWidth:'160px', padding:'0.75rem 1rem' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', color:'var(--text-secondary)', fontSize:'0.85rem' }}>
              <k.icon size={15}/> {k.label}
            </div>
            <div style={{ fontWeight:'800', fontSize:'1.3rem', color: k.color, marginTop:'0.2rem' }}>
              {k.val.toLocaleString('en-US')}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ padding:'1rem' }}>
        <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap', alignItems:'flex-end' }}>
          <div className="form-group" style={{ margin:0, flex:'1', minWidth:'120px' }}>
            <label style={{ fontSize:'0.8rem' }}>الشهر</label>
            <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin:0, flex:'1', minWidth:'140px' }}>
            <label style={{ fontSize:'0.8rem' }}>الحساب</label>
            <select value={filterAccount} onChange={e => setFilterAccount(e.target.value)}>
              <option value="">الكل</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name_ar}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin:0, flex:'1', minWidth:'140px' }}>
            <label style={{ fontSize:'0.8rem' }}>الفئة</label>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="">الكل</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin:0, flex:'1', minWidth:'140px' }}>
            <label style={{ fontSize:'0.8rem' }}>المتبرع</label>
            <select value={filterCounterparty} onChange={e => setFilterCounterparty(e.target.value)}>
              <option value="">الكل</option>
              {counterparties.map(cp => <option key={cp.id} value={cp.id}>{cp.name_ar}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin:0, flex:'1', minWidth:'110px' }}>
            <label style={{ fontSize:'0.8rem' }}>النوع</label>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">الكل</option>
              <option value="وارد">وارد</option>
              <option value="صادر">صادر</option>
            </select>
          </div>
          <div className="form-group" style={{ margin:0, flex:'2', minWidth:'180px' }}>
            <label style={{ fontSize:'0.8rem' }}>بحث</label>
            <div style={{ position:'relative' }}>
              <Search size={14} style={{ position:'absolute', top:'50%', right:'10px', transform:'translateY(-50%)', color:'var(--text-secondary)' }}/>
              <input type="text" value={filterSearch} onChange={e => setFilterSearch(e.target.value)} placeholder="بيان، رقم مرجع..." style={{ paddingRight:'2rem' }}/>
            </div>
          </div>
          {(filterAccount || filterCategory || filterCounterparty || filterType || filterSearch) && (
            <button className="btn btn-outline" onClick={() => { setFilterAccount(''); setFilterCategory(''); setFilterCounterparty(''); setFilterType(''); setFilterSearch(''); }}
              style={{ alignSelf:'flex-end', padding:'0.5rem', color:'var(--danger)' }}>
              <X size={16}/>
            </button>
          )}
        </div>
      </div>

      {/* Quick Entry Form */}
      {showForm && (
        <div className="card animate-fade-in" style={{ border:'2px solid var(--primary)' }}>
          <h3 className="card-title" style={{ marginBottom:'1.5rem' }}>
            <PlusCircle size={18}/> {editId ? 'تعديل القيد' : 'إضافة قيد جديد'}
          </h3>
          <form onSubmit={handleSubmit}>
            {/* Type Toggle */}
            <div className="form-group" style={{ marginBottom:'1.25rem' }}>
              <label>نوع الحركة</label>
              <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', marginTop:'0.25rem' }}>
                {[
                  { dir:'وارد', type:'قبض', label:'وارد (+)', color:'var(--success)' },
                  { dir:'صادر', type:'صرف', label:'صادر (-)', color:'var(--danger)' },
                  { dir:'تحويل', type:'تحويل', label:'تحويل ↔', color:'var(--primary)' },
                ].map(opt => (
                  <button key={opt.dir} type="button"
                    onClick={() => { set('direction', opt.dir); set('transaction_type', opt.type); }}
                    className={`btn ${form.direction === opt.dir ? 'btn-primary' : 'btn-outline'}`}
                    style={{ borderColor: opt.color, color: form.direction === opt.dir ? 'white' : opt.color,
                      background: form.direction === opt.dir ? opt.color : 'transparent', fontWeight:'700' }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="stats-grid">
              <div className="form-group">
                <label>التاريخ *</label>
                <input type="date" value={form.transaction_date} onChange={e => set('transaction_date', e.target.value)} required />
              </div>
              <div className="form-group">
                <label>المبلغ *</label>
                <div style={{ display:'flex', gap:'0.25rem' }}>
                  <input type="number" step="any" min="0.01" placeholder="0" value={form.amount} onChange={e => set('amount', e.target.value)} required style={{ flex:1 }} />
                  <select value={form.currency} onChange={e => set('currency', e.target.value)} style={{ width:'80px' }}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              {form.direction !== 'تحويل' ? (
                <div className="form-group">
                  <label>الحساب *</label>
                  <select value={form.main_account_id} onChange={e => set('main_account_id', e.target.value)} required>
                    <option value="">-- اختر الحساب --</option>
                    {accounts.filter(a => a.is_active !== false).map(a => (
                      <option key={a.id} value={a.id}>{a.name_ar}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label>من حساب *</label>
                    <select value={form.source_account_id} onChange={e => set('source_account_id', e.target.value)} required>
                      <option value="">-- من --</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name_ar}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>إلى حساب *</label>
                    <select value={form.destination_account_id} onChange={e => set('destination_account_id', e.target.value)} required>
                      <option value="">-- إلى --</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name_ar}</option>)}
                    </select>
                  </div>
                </>
              )}
              <div className="form-group">
                <label>الفئة</label>
                <select value={form.category_id} onChange={e => set('category_id', e.target.value)}>
                  <option value="">-- بدون فئة --</option>
                  {categories.filter(c => c.is_active !== false).map(c => (
                    <option key={c.id} value={c.id}>{c.name_ar}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>المتبرع</label>
                <select value={form.counterparty_id} onChange={e => set('counterparty_id', e.target.value)}>
                  <option value="">--</option>
                  {counterparties.map(cp => <option key={cp.id} value={cp.id}>{cp.name_ar}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>طريقة الدفع</label>
                <select value={form.payment_method} onChange={e => set('payment_method', e.target.value)}>
                  {['نقدي','شيك','حوالة','بطاقة','أخرى'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>رقم مرجع / وصل</label>
                <input type="text" placeholder="اختياري" value={form.reference_no} onChange={e => set('reference_no', e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label>البيان / التفصيل *</label>
              <input type="text" placeholder="وصف تفصيلي للحركة..." value={form.description} onChange={e => set('description', e.target.value)} required />
            </div>
            <div className="form-group">
              <label>ملاحظات</label>
              <input type="text" placeholder="ملاحظات إضافية..." value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>

            {/* Dynamic Custom Fields */}
            {visibleCustomFields.length > 0 && (
              <div style={{ borderTop:'1px solid var(--border)', paddingTop:'1rem', marginTop:'0.5rem' }}>
                <p style={{ fontSize:'0.85rem', color:'var(--text-secondary)', marginBottom:'0.75rem' }}>حقول مخصصة</p>
                <div className="stats-grid">
                  {visibleCustomFields.map(cf => (
                    <div key={cf.id} className="form-group">
                      <label>{cf.label}</label>
                      <input
                        type={cf.type === 'number' || cf.type === 'currency' ? 'number' : cf.type === 'date' ? 'date' : 'text'}
                        value={form.custom_values?.[cf.id] || ''}
                        onChange={e => set('custom_values', { ...form.custom_values, [cf.id]: e.target.value })}
                        placeholder={cf.label}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display:'flex', gap:'0.75rem', marginTop:'1.25rem' }}>
              <button type="submit" className="btn btn-primary" style={{ flex:1, padding:'0.75rem', fontWeight:'bold' }}>حفظ القيد</button>
              <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>إلغاء</button>
            </div>
          </form>
        </div>
      )}

      {/* Journal Table */}
      <div className="card">
        <div className="table-container" style={{ overflowX:'auto', maxHeight:'60vh' }}>
          <table style={{ minWidth:'1100px' }}>
            <thead style={{ position:'sticky', top:0, zIndex:10 }}>
              <tr>
                <th>التاريخ</th>
                <th>رقم القيد</th>
                <th style={{ minWidth:'200px' }}>البيان</th>
                <th>الحساب</th>
                <th>الفئة</th>
                <th>المتبرع</th>
                <th style={{ color:'var(--success)' }}>وارد</th>
                <th style={{ color:'var(--danger)' }}>صادر</th>
                <th style={{ background:'var(--primary)', color:'white' }}>الرصيد</th>
                <th>مرجع</th>
                {visibleCustomFields.map(cf => <th key={cf.id}>{cf.label}</th>)}
                {(canWrite || canDelete) && <th>إجراءات</th>}
              </tr>
            </thead>
            <tbody>
              {displayRows.length === 0 ? (
                <tr>
                  <td colSpan={10 + visibleCustomFields.length + ((canWrite || canDelete) ? 1 : 0)} style={{ textAlign:'center', padding:'3rem', color:'var(--text-secondary)' }}>
                    لا توجد قيود تطابق الفلاتر المحددة
                  </td>
                </tr>
              ) : displayRows.map((tx, i) => (
                <tr key={tx.id}>
                  <td style={{ fontWeight:'600' }}>{tx.transaction_date}</td>
                  <td style={{ fontSize:'0.75rem', color:'var(--text-secondary)' }}>{tx.transaction_no}</td>
                  <td>{tx.description}</td>
                  <td>{accounts.find(a => a.id === tx.main_account_id)?.name_ar || '-'}</td>
                  <td>{categories.find(c => c.id === tx.category_id)?.name_ar || '-'}</td>
                  <td>{counterparties.find(cp => cp.id === tx.counterparty_id)?.name_ar || '-'}</td>
                  <td style={{ color:'var(--success)', fontWeight: tx.direction === 'وارد' ? '700' : '400' }}>
                    {tx.direction === 'وارد' ? `${tx.amount.toLocaleString('en-US')} ${tx.currency || DEFAULT_CURRENCY}` : ''}
                  </td>
                  <td style={{ color:'var(--danger)', fontWeight: tx.direction === 'صادر' ? '700' : '400' }}>
                    {tx.direction === 'صادر' ? `${tx.amount.toLocaleString('en-US')} ${tx.currency || DEFAULT_CURRENCY}` : ''}
                  </td>
                  <td style={{ fontWeight:'800', color: tx.running_balance >= 0 ? 'var(--primary)' : 'var(--danger)', background:'rgba(59,130,246,0.05)' }}>
                    {tx.running_balance?.toLocaleString('en-US')}
                  </td>
                  <td style={{ fontSize:'0.8rem', color:'var(--text-secondary)' }}>{tx.reference_no || '-'}</td>
                  {visibleCustomFields.map(cf => (
                    <td key={cf.id} style={{ fontSize:'0.85rem' }}>{tx.custom_values?.[cf.id] || '-'}</td>
                  ))}
                  {(canWrite || canDelete) && (
                    <td style={{ display:'flex', gap:'0.25rem' }}>
                      {canWrite && (
                        <button onClick={() => { 
                          setForm({...tx}); 
                          setEditId(tx.id); 
                          setShowForm(true); 
                          // Scroll to top where the form gets rendered
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                         }} className="btn btn-secondary" style={{ padding:'0.25rem 0.5rem' }} title="تعديل">
                          <Edit size={13}/>
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete(tx)} className="btn btn-danger" style={{ padding:'0.25rem 0.5rem' }} title="حذف">
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
        {displayRows.length > 0 && (
          <div style={{ padding:'0.75rem 1rem', borderTop:'1px solid var(--border)', display:'flex', gap:'2rem', fontSize:'0.9rem', color:'var(--text-secondary)' }}>
            <span>{displayRows.length} قيد</span>
            <span style={{ color:'var(--success)' }}>وارد: {summary.totalIn.toLocaleString('en-US')}</span>
            <span style={{ color:'var(--danger)' }}>صادر: {summary.totalOut.toLocaleString('en-US')}</span>
            <span style={{ fontWeight:'700', color: summary.net >= 0 ? 'var(--primary)' : 'var(--danger)' }}>الصافي: {summary.net.toLocaleString('en-US')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
