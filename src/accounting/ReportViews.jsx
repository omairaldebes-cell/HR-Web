import { useState, useMemo } from 'react';
import { useAccounting } from './context/AccountingContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { BarChart2, BookOpen, Calendar, Filter, X, ArrowUpCircle, ArrowDownCircle, Wallet, Tag } from 'lucide-react';
import * as XLSX from 'xlsx';

export function MonthlyReport() {
  const { transactions, categories, accounts } = useAccounting();
  
  const ARABIC_MONTHS = ['كانون الثاني','شباط','آذار','نيسان','أيار','حزيران','تموز','آب','أيلول','تشرين الأول','تشرين الثاني','كانون الأول'];

  // Default to current month
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);
  const [filterAccount, setFilterAccount] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDirection, setFilterDirection] = useState('');

  // 1. Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const d = t.transaction_date;
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      if (filterAccount && t.main_account_id !== filterAccount) return false;
      if (filterCategory && t.category_id !== filterCategory) return false;
      if (filterDirection && t.direction !== filterDirection) return false;
      return true;
    });
  }, [transactions, startDate, endDate, filterAccount, filterCategory, filterDirection]);

  // 2. Generate month rows based on range
  const monthsInRange = useMemo(() => {
    if (!startDate || !endDate) return [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const months = [];
    
    // We want to iterate months from start date year/month to end date year/month
    let current = new Date(start.getFullYear(), start.getMonth(), 1);
    const final = new Date(end.getFullYear(), end.getMonth(), 1);

    while (current <= final) {
      const mStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
      const mLabel = `${ARABIC_MONTHS[current.getMonth()]} ${current.getFullYear()}`;
      months.push({ key: mStr, label: mLabel });
      current.setMonth(current.getMonth() + 1);
    }
    return months;
  }, [startDate, endDate]);

  // 3. Determine columns (Categories)
  const topCategories = useMemo(() => {
    if (filterCategory) return [filterCategory];
    
    const catTotals = {};
    filteredTransactions.forEach(t => {
      if (t.category_id) {
        catTotals[t.category_id] = (catTotals[t.category_id] || 0) + (t.amount || 0);
      }
    });

    return Object.entries(catTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id]) => id);
  }, [filteredTransactions, filterCategory]);

  // 4. Matrix Rows
  const matrixRows = useMemo(() => {
    return monthsInRange.map(m => {
      const monthTxs = filteredTransactions.filter(t => t.transaction_date?.startsWith(m.key));
      const row = { month: m.label, monthKey: m.key };
      
      topCategories.forEach(catId => {
        const catName = categories.find(c => c.id === catId)?.name_ar || catId;
        // Total for this category in this month (respecting filters)
        row[catName] = monthTxs.filter(t => t.category_id === catId).reduce((s, t) => s + (t.amount || 0), 0);
      });

      row['إجمالي وارد'] = monthTxs.filter(t => t.direction === 'وارد').reduce((s, t) => s + (t.amount || 0), 0);
      row['إجمالي صادر'] = monthTxs.filter(t => t.direction === 'صادر').reduce((s, t) => s + (t.amount || 0), 0);
      row['صافي'] = row['إجمالي وارد'] - row['إجمالي صادر'];
      return row;
    });
  }, [filteredTransactions, topCategories, monthsInRange, categories]);

  const chartData = useMemo(() => {
    return matrixRows.map(r => ({
      name: r.month,
      وارد: r['إجمالي وارد'],
      صادر: r['إجمالي صادر']
    }));
  }, [matrixRows]);

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(matrixRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `التقرير`);
    XLSX.writeFile(wb, `financial-report-${startDate}-to-${endDate}.xlsx`);
  };

  const clearFilters = () => {
    setFilterAccount('');
    setFilterCategory('');
    setFilterDirection('');
    setStartDate(firstDay);
    setEndDate(lastDay);
  };

  return (
    <div className="animate-fade-in" style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      
      {/* Filters Section */}
      <div className="card" style={{ padding:'1rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
          <h2 className="card-title" style={{ fontSize:'1rem' }}><Filter size={18}/> فلاتر التقرير</h2>
          <button className="btn btn-outline" style={{ fontSize:'0.8rem', padding:'0.2rem 0.6rem', color:'var(--danger)' }} onClick={clearFilters}>
            <X size={14}/> إعادة تعيين
          </button>
        </div>
        
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'1rem', alignItems:'flex-end' }}>
          <div className="form-group" style={{ margin:0 }}>
            <label style={{ fontSize:'0.75rem' }}><Calendar size={12}/> من تاريخ</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin:0 }}>
            <label style={{ fontSize:'0.75rem' }}><Calendar size={12}/> إلى تاريخ</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin:0 }}>
            <label style={{ fontSize:'0.75rem' }}><Wallet size={12}/> الحساب</label>
            <select value={filterAccount} onChange={e => setFilterAccount(e.target.value)}>
              <option value="">الكل</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name_ar}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin:0 }}>
            <label style={{ fontSize:'0.75rem' }}><Tag size={12}/> الفئة</label>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="">كافة الفئات</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin:0 }}>
            <label style={{ fontSize:'0.75rem' }}><ArrowUpCircle size={12}/> الحركة</label>
            <select value={filterDirection} onChange={e => setFilterDirection(e.target.value)}>
              <option value="">الكل (وارد/صادر)</option>
              <option value="وارد">وارد فقط</option>
              <option value="صادر">صادر فقط</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card-header no-print">
        <h2 className="card-title" style={{ fontSize:'1.2rem' }}><BarChart2 /> تحليل البيانات والنمو</h2>
        <button className="btn btn-outline" onClick={exportExcel} style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
          تصدير Excel
        </button>
      </div>

      {/* Summary Chart */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom:'1rem', fontSize:'1rem' }}>وارد مقابل صادر للفترة المختارة</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{top:5,right:10,left:0,bottom:5}}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
            <XAxis dataKey="name" tick={{fill:'var(--text-secondary)',fontSize:11}} />
            <YAxis tick={{fill:'var(--text-secondary)',fontSize:11}} />
            <Tooltip contentStyle={{background:'var(--surface)',border:'1px solid var(--border)'}} />
            <Legend />
            <Bar dataKey="وارد" fill="#10b981" radius={[4,4,0,0]} />
            <Bar dataKey="صادر" fill="#ef4444" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* The Matrix */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom:'1rem', fontSize:'1rem' }}>مصفوفة الفئات والأشهر</h3>
        <div className="table-container" style={{ overflowX:'auto' }}>
          <table style={{ minWidth:'900px' }}>
            <thead>
              <tr>
                <th>الشهر</th>
                {topCategories.map(id => <th key={id}>{categories.find(c=>c.id===id)?.name_ar || id}</th>)}
                <th style={{ color:'var(--success)' }}>وارد</th>
                <th style={{ color:'var(--danger)' }}>صادر</th>
                <th style={{ color:'var(--primary)' }}>صافي</th>
              </tr>
            </thead>
            <tbody>
              {matrixRows.length === 0 ? (
                <tr><td colSpan={topCategories.length + 4} style={{ textAlign:'center', padding:'3rem', color:'var(--text-secondary)' }}>لا توجد بيانات للفترة المحددة</td></tr>
              ) : matrixRows.map((row, i) => (
                <tr key={i}>
                  <td style={{ fontWeight:'700' }}>{row.month}</td>
                  {topCategories.map(id => {
                    const catName = categories.find(c=>c.id===id)?.name_ar || id;
                    return <td key={id} style={{ fontSize:'0.85rem' }}>{row[catName] > 0 ? row[catName].toLocaleString('en-US') : '-'}</td>;
                  })}
                  <td style={{ color:'var(--success)', fontWeight:'700' }}>{row['إجمالي وارد'].toLocaleString('en-US')}</td>
                  <td style={{ color:'var(--danger)', fontWeight:'700' }}>{row['إجمالي صادر'].toLocaleString('en-US')}</td>
                  <td style={{ color: row['صافي']>=0?'var(--primary)':'var(--danger)', fontWeight:'800' }}>{row['صافي'].toLocaleString('en-US')}</td>
                </tr>
              ))}
            </tbody>
            {matrixRows.length > 0 && (
              <tfoot style={{ background:'var(--bg-color)', fontWeight:'bold' }}>
                <tr>
                  <td>الإجمالي الكلي</td>
                  {topCategories.map(id => {
                    const catName = categories.find(c=>c.id===id)?.name_ar || id;
                    const total = matrixRows.reduce((sum, r) => sum + (r[catName] || 0), 0);
                    return <td key={id}>{total > 0 ? total.toLocaleString('en-US') : '-'}</td>;
                  })}
                  <td style={{ color:'var(--success)' }}>{matrixRows.reduce((s,r)=>s+r['إجمالي وارد'],0).toLocaleString('en-US')}</td>
                  <td style={{ color:'var(--danger)' }}>{matrixRows.reduce((s,r)=>s+r['إجمالي صادر'],0).toLocaleString('en-US')}</td>
                  <td style={{ color:'var(--primary)' }}>{matrixRows.reduce((s,r)=>s+r['صافي'],0).toLocaleString('en-US')}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

export function AuditLog() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const unsub = listen(COLL.AUDIT_LOG, (data) => {
      setLogs(data.sort((a,b) => (b.timestamp||0) - (a.timestamp||0)).slice(0, 100));
    });
    return () => unsub();
  }, []);

  return (
    <div className="animate-fade-in" style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <div className="card-header">
        <h2 className="card-title"><BookOpen /> سجل التدقيق (Audit Log)</h2>
        <span style={{ color:'var(--text-secondary)', fontSize:'0.85rem' }}>{logs.length} إجراء مسجّل</span>
      </div>
      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>الوقت</th>
                <th>الإجراء</th>
                <th>المجموعة</th>
                <th>المستخدم</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign:'center', color:'var(--text-secondary)', padding:'2rem' }}>
                    لا توجد سجلات بعد. كل عملية إضافة/تعديل/حذف ستظهر هنا.
                  </td>
                </tr>
              ) : logs.map((log, i) => (
                <tr key={i}>
                  <td style={{ fontSize:'0.8rem', color:'var(--text-secondary)' }}>
                    {new Date(log.timestamp).toLocaleString('en-US')}
                  </td>
                  <td>
                    <span className={`badge ${log.action === 'create' ? 'badge-success' : log.action === 'delete' ? 'badge-danger' : ''}`}>
                      {log.action === 'create' ? 'إضافة' : log.action === 'update' ? 'تعديل' : log.action === 'delete' ? 'حذف' : log.action}
                    </span>
                  </td>
                  <td style={{ fontSize:'0.8rem' }}>{log.collection?.replace('accounting_','') || '-'}</td>
                  <td style={{ fontWeight:'600' }}>{log.user || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
