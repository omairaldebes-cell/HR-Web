import { useMemo, useState } from 'react';
import { useAccounting } from './context/AccountingContext';
import { createTransaction } from './accountingService';
import {
  LayoutDashboard, TrendingUp, TrendingDown, Wallet, ArrowUpCircle,
  ArrowDownCircle, ArrowLeftRight, PlusCircle, Users, BookOpen, ChevronRight,
  Scale, CheckCircle, X
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { DEFAULT_CURRENCY, CURRENCIES } from './constants';

export default function AccountingDashboard({ setActiveTab }) {
  const { transactions, accounts, getAccountBalance, getMonthSummary, company, canWrite, loggedInUser } = useAccounting();

  const [showRecon, setShowRecon] = useState(false);
  const [reconForm, setReconForm] = useState({ accountId: '', actualCash: '', currency: DEFAULT_CURRENCY });

  const today = new Date().toISOString().split('T')[0];
  const currentMonth = today.slice(0, 7);

  const expectedBalances = reconForm.accountId ? getAccountBalance(reconForm.accountId) : {};
  const expectedCash = expectedBalances[reconForm.currency] || 0;
  const actualCashNum = parseFloat(reconForm.actualCash) || 0;
  const cashDifference = reconForm.actualCash ? actualCashNum - expectedCash : 0;

  const handleReconcile = async (e) => {
    e.preventDefault();
    if (!reconForm.accountId || !reconForm.actualCash) return;
    if (cashDifference === 0) {
      alert('الرصيد الفعلي يطابق رصيد النظام. لا توجد حاجة لتسوية.');
      setShowRecon(false);
      return;
    }
    
    const dir = cashDifference > 0 ? 'وارد' : 'صادر';
    const amount = Math.abs(cashDifference);
    const data = {
      transaction_date: today,
      direction: dir,
      transaction_type: 'تسوية',
      main_account_id: reconForm.accountId,
       amount,
       currency: reconForm.currency,
       description: `تسوية جردية (${reconForm.currency}) - الرصيد الفعلي: ${actualCashNum.toLocaleString('en-US')}`,
       category_id: '',
       counterparty_id: '',
       reference_no: 'تسوية-جرد',
       notes: `الفرق: ${cashDifference}`,
       custom_values: {},
       month_period: currentMonth
     };

    try {
       await createTransaction(data, loggedInUser?.username);
        alert('تم إنشاء قيد التسوية الجردية بنجاح.');
        setShowRecon(false);
        setReconForm({ accountId: '', actualCash: '', currency: DEFAULT_CURRENCY });
    } catch(err) {
       console.error(err);
       alert('حدث خطأ أثناء حفظ التسوية');
    }
  };

  const todayTxs = transactions.filter(tx => tx.transaction_date === today && tx.status === 'مرحّل');
  const todayIn  = todayTxs.filter(t => t.direction === 'وارد').reduce((s, t) => s + (t.amount || 0), 0);
  const todayOut = todayTxs.filter(t => t.direction === 'صادر').reduce((s, t) => s + (t.amount || 0), 0);

  const summaries = getMonthSummary(currentMonth);
  const mainAccount = accounts.find(a => a.is_main);
  const mainBalances = mainAccount ? getAccountBalance(mainAccount.id) : {};

  // Chart: last 7 days in vs out
  const last7 = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      const dayLabel = `${d.getDate()}/${d.getMonth()+1}`;
      const dayTxs = transactions.filter(t => t.transaction_date === dStr && t.status === 'مرحّل');
      days.push({
        name: dayLabel,
        وارد: dayTxs.filter(t => t.direction === 'وارد').reduce((s,t) => s+(t.amount||0), 0),
        صادر: dayTxs.filter(t => t.direction === 'صادر').reduce((s,t) => s+(t.amount||0), 0),
      });
    }
    return days;
  }, [transactions]);

  // Top accounts by balance
  const topAccounts = accounts.slice(0, 6).map(a => ({
    ...a, balance: getAccountBalance(a.id)
  }));

  // Recent transactions
  const recentTxs = transactions
    .slice().sort((a,b) => (b.created_at||0) - (a.created_at||0))
    .slice(0, 8);

  return (
    <div className="animate-fade-in" style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      {/* Header */}
      <div className="card-header no-print" style={{ padding:'0 0 0.5rem' }}>
        <h2 className="card-title"><LayoutDashboard /> {company?.name_ar || 'دفتر اليومية الذكي'}</h2>
        <span style={{ color:'var(--text-secondary)', fontSize:'0.85rem' }}>{today}</span>
      </div>

      {/* Quick Action Buttons */}
      {canWrite && (
        <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
          {[
            { label:'إضافة وارد', icon: ArrowUpCircle, tab:'acc_daily', color:'var(--success)', dir:'وارد' },
            { label:'إضافة صادر', icon: ArrowDownCircle, tab:'acc_daily', color:'var(--danger)', dir:'صادر' },
            { label:'تحويل بين الحسابات', icon: ArrowLeftRight, tab:'acc_daily', color:'var(--primary)' },
            { label:'حساب جديد', icon: PlusCircle, tab:'acc_accounts', color:'var(--warning)' },
            { label:'فئة جديدة', icon: BookOpen, tab:'acc_categories', color:'var(--primary)' },
          ].map(btn => (
            <button
              key={btn.label}
              className="btn btn-outline"
              onClick={() => setActiveTab(btn.tab)}
              style={{ display:'flex', alignItems:'center', gap:'0.4rem', borderColor: btn.color, color: btn.color, fontWeight:'600' }}
            >
              <btn.icon size={16} />
              {btn.label}
            </button>
          ))}
          <button
            className="btn btn-outline"
            onClick={() => setShowRecon(!showRecon)}
            style={{ display:'flex', alignItems:'center', gap:'0.4rem', borderColor: '#8b5cf6', color: '#8b5cf6', fontWeight:'600' }}
          >
            <Scale size={16}/> مطابقة جردية
          </button>
        </div>
      )}

      {/* Recon Form */}
      {showRecon && canWrite && (
        <div className="card animate-fade-in" style={{ border:'2px solid #8b5cf6', marginBottom:'1rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
             <h3 className="card-title" style={{color:'#8b5cf6'}}><Scale size={18}/> مطابقة جردية للصندوق</h3>
             <button className="btn" style={{background:'none', color:'var(--text-secondary)'}} onClick={() => setShowRecon(false)}><X size={18}/></button>
          </div>
          <form onSubmit={handleReconcile}>
             <div className="stats-grid">
               <div className="form-group">
                 <label>الصندوق / الحساب</label>
                 <select value={reconForm.accountId} onChange={e => setReconForm({...reconForm, accountId: e.target.value})} required>
                   <option value="">-- اختر --</option>
                   {accounts.filter(a => a.is_active !== false).map(a => <option key={a.id} value={a.id}>{a.name_ar}</option>)}
                 </select>
               </div>
                <div className="form-group">
                  <label>الرصيد الفعلي</label>
                  <div style={{ display:'flex', gap:'0.25rem' }}>
                    <input type="number" step="any" value={reconForm.actualCash} onChange={e => setReconForm({...reconForm, actualCash: e.target.value})} required placeholder="0" style={{ flex:1 }} />
                    <select value={reconForm.currency} onChange={e => setReconForm({...reconForm, currency: e.target.value})} style={{ width:'80px' }}>
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
             </div>
             {reconForm.accountId && reconForm.actualCash && (
               <div style={{ marginTop:'1rem', padding:'1rem', background:'var(--bg-color)', borderRadius:'var(--radius-md)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'1rem' }}>
                  <div>
                    <div style={{ fontSize:'0.9rem', color:'var(--text-secondary)' }}>رصيد الحساب المسجل: <span style={{fontWeight:'bold', color:'var(--text-primary)', fontSize:'1rem'}}>{expectedCash.toLocaleString('en-US')} {reconForm.currency}</span></div>
                    <div style={{ fontSize:'0.9rem', color:'var(--text-secondary)', marginTop:'0.2rem' }}>الفرق: <span style={{fontWeight:'bold', fontSize:'1rem', color: cashDifference > 0 ? 'var(--success)' : cashDifference < 0 ? 'var(--danger)' : 'var(--text-primary)'}}>{cashDifference.toLocaleString('en-US')} {reconForm.currency}</span></div>
                  </div>
                  <div style={{ textAlign:'left' }}>
                    {cashDifference === 0 ? (
                      <span style={{color:'var(--success)', fontWeight:'bold', display:'flex', alignItems:'center', gap:'0.3rem'}}><CheckCircle size={18}/> متطابق تماماً</span>
                    ) : (
                      <span style={{color:'var(--warning)', fontSize:'0.85rem' }}>سيتم إنشاء قيد دخل/خرج تلقائي بقيمة <b>{Math.abs(cashDifference).toLocaleString('en-US')} {reconForm.currency}</b> بحالة <b>"{cashDifference > 0 ? 'وارد' : 'صادر'}"</b> لتسوية الفرق.</span>
                    )}
                  </div>
               </div>
             )}
             <div style={{ marginTop:'1.25rem' }}>
               <button type="submit" className="btn btn-primary" style={{ width:'100%', background:'#8b5cf6', borderColor:'#8b5cf6', fontWeight:'700' }}>تسوية ورصد الفروقات</button>
             </div>
          </form>
        </div>
      )}

      {/* KPI Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">رصيد الصندوق الرئيسي</div>
          {Object.entries(mainBalances).map(([cur, bal]) => (
            <div key={cur} className="stat-value" style={{ color: bal >= 0 ? 'var(--primary)' : 'var(--danger)', fontSize:'1.4rem' }}>
              {bal.toLocaleString('en-US')} <span style={{ fontSize:'0.8rem', opacity:0.7 }}>{cur}</span>
            </div>
          ))}
          {Object.keys(mainBalances).length === 0 && <div className="stat-value" style={{ fontSize:'1.4rem' }}>0</div>}
        </div>
        <div className="stat-card">
          <div className="stat-label">صافي الشهر الحالي</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.25rem' }}>
            {Object.entries(summaries).map(([cur, s]) => (
              <div key={cur} style={{ borderBottom:'1px solid var(--border)', paddingBottom:'0.2rem' }}>
                <div style={{ color: s.net >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight:'700', fontSize:'1.1rem' }}>
                  {s.net.toLocaleString('en-US')} <span style={{ fontSize:'0.7rem' }}>{cur}</span>
                </div>
                <div style={{ fontSize:'0.7rem', color:'var(--text-secondary)' }}>و: {s.totalIn.toLocaleString('en-US')} | ص: {s.totalOut.toLocaleString('en-US')}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chart + Accounts */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem' }}>
        <div className="card">
          <h3 className="card-title" style={{ marginBottom:'1rem', fontSize:'1rem' }}>
            <TrendingUp size={16}/> الحركة اليومية (آخر 7 أيام)
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={last7} margin={{ top:5, right:10, left:0, bottom:5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill:'var(--text-secondary)', fontSize:12 }} />
              <YAxis tick={{ fill:'var(--text-secondary)', fontSize:11 }} />
              <Tooltip contentStyle={{ background:'var(--surface)', border:'1px solid var(--border)' }} />
              <Legend />
              <Bar dataKey="وارد" fill="#10b981" radius={[4,4,0,0]} />
              <Bar dataKey="صادر" fill="#ef4444" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="card-title" style={{ marginBottom:'1rem', fontSize:'1rem' }}>
            <Wallet size={16}/> أرصدة الحسابات
          </h3>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
            {topAccounts.map(acc => (
              <div key={acc.id} style={{ padding:'0.4rem 0', borderBottom:'1px solid var(--border)' }}>
                <div style={{ fontSize:'0.85rem', fontWeight:'600' }}>{acc.name_ar}</div>
                <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', marginTop:'0.2rem' }}>
                  {Object.entries(getAccountBalance(acc.id)).map(([cur, bal]) => (
                    <span key={cur} style={{ fontSize:'0.8rem', fontWeight:'700', color: bal >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {bal.toLocaleString('en-US')} {cur}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card">
        <div className="card-header" style={{ marginBottom:'1rem' }}>
          <h3 className="card-title" style={{ fontSize:'1rem' }}><BookOpen size={16}/> آخر القيود</h3>
          <button className="btn btn-outline" style={{ fontSize:'0.85rem', padding:'0.3rem 0.8rem' }} onClick={() => setActiveTab('acc_daily')}>
            عرض الكل <ChevronRight size={14}/>
          </button>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>رقم القيد</th>
                <th>البيان</th>
                <th>الحساب</th>
                <th>النوع</th>
                <th>المبلغ</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {recentTxs.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign:'center', color:'var(--text-secondary)', padding:'2rem' }}>لا توجد قيود بعد</td></tr>
              ) : recentTxs.map(tx => (
                <tr key={tx.id}>
                  <td>{tx.transaction_date}</td>
                  <td style={{ fontSize:'0.8rem', color:'var(--text-secondary)' }}>{tx.transaction_no}</td>
                  <td>{tx.description}</td>
                  <td>{accounts.find(a => a.id === tx.main_account_id)?.name_ar || '-'}</td>
                  <td><span className={`badge ${tx.direction === 'وارد' ? 'badge-success' : 'badge-danger'}`}>{tx.direction}</span></td>
                  <td style={{ fontWeight:'700', color: tx.direction === 'وارد' ? 'var(--success)' : 'var(--danger)' }}>
                    {(tx.amount || 0).toLocaleString('en-US')} <span style={{fontSize:'0.75rem'}}>{tx.currency || DEFAULT_CURRENCY}</span>
                  </td>
                  <td><span className="badge">{tx.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
