import { useState, useEffect, useMemo } from 'react';
import { useAccounting } from './context/AccountingContext';
import { listen, COLL } from './accountingService';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { BarChart2, BookOpen } from 'lucide-react';
import * as XLSX from 'xlsx';

export function MonthlyReport() {
  const { transactions, categories } = useAccounting();
  const [year, setYear] = useState(new Date().getFullYear());

  const ARABIC_MONTHS = ['كانون الثاني','شباط','آذار','نيسان','أيار','حزيران','تموز','آب','أيلول','تشرين الأول','تشرين الثاني','كانون الأول'];

  const topIncomeCategories = useMemo(() => {
    const catTotals = {};
    transactions.filter(t => t.direction === 'وارد' && t.transaction_date?.startsWith(String(year))).forEach(t => {
      if (t.category_id) catTotals[t.category_id] = (catTotals[t.category_id] || 0) + (t.amount || 0);
    });
    return Object.entries(catTotals).sort((a,b) => b[1]-a[1]).slice(0,8).map(([id]) => id);
  }, [transactions, year]);

  const matrixRows = useMemo(() => {
    return ARABIC_MONTHS.map((monthName, idx) => {
      const monthKey = `${year}-${String(idx+1).padStart(2,'0')}`;
      const monthTxs = transactions.filter(t => t.transaction_date?.startsWith(monthKey));
      const row = { month: monthName };
      topIncomeCategories.forEach(catId => {
        const catName = categories.find(c => c.id === catId)?.name_ar || catId;
        row[catName] = monthTxs.filter(t => t.category_id === catId && t.direction === 'وارد').reduce((s,t) => s+(t.amount||0), 0);
      });
      row['إجمالي وارد'] = monthTxs.filter(t=>t.direction==='وارد').reduce((s,t)=>s+(t.amount||0),0);
      row['إجمالي صادر'] = monthTxs.filter(t=>t.direction==='صادر').reduce((s,t)=>s+(t.amount||0),0);
      row['صافي'] = row['إجمالي وارد'] - row['إجمالي صادر'];
      return row;
    });
  }, [transactions, categories, year, topIncomeCategories]);

  const chartData = matrixRows.map(r => ({ name: r.month.substring(0,6), وارد: r['إجمالي وارد'], صادر: r['إجمالي صادر'] }));

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(matrixRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `تقرير-${year}`);
    XLSX.writeFile(wb, `monthly-report-${year}.xlsx`);
  };

  return (
    <div className="animate-fade-in" style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <div className="card-header">
        <h2 className="card-title"><BarChart2 /> التقرير الشهري السنوي</h2>
        <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
          <input type="number" value={year} onChange={e=>setYear(parseInt(e.target.value)||2026)} className="btn btn-outline" style={{ width:'90px', padding:'0.4rem' }} />
          <button className="btn btn-outline" onClick={exportExcel}>تصدير Excel</button>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title" style={{ marginBottom:'1rem', fontSize:'1rem' }}>وارد مقابل صادر — {year}</h3>
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

      <div className="card">
        <h3 className="card-title" style={{ marginBottom:'1rem', fontSize:'1rem' }}>مصفوفة الفئات والأشهر</h3>
        <div className="table-container" style={{ overflowX:'auto' }}>
          <table style={{ minWidth:'900px' }}>
            <thead>
              <tr>
                <th>الشهر</th>
                {topIncomeCategories.map(id => <th key={id}>{categories.find(c=>c.id===id)?.name_ar || id}</th>)}
                <th style={{ color:'var(--success)' }}>وارد</th>
                <th style={{ color:'var(--danger)' }}>صادر</th>
                <th style={{ color:'var(--primary)' }}>صافي</th>
              </tr>
            </thead>
            <tbody>
              {matrixRows.map((row, i) => (
                <tr key={i}>
                  <td style={{ fontWeight:'700' }}>{row.month}</td>
                  {topIncomeCategories.map(id => {
                    const catName = categories.find(c=>c.id===id)?.name_ar || id;
                    return <td key={id} style={{ fontSize:'0.85rem' }}>{row[catName] > 0 ? row[catName].toLocaleString() : '-'}</td>;
                  })}
                  <td style={{ color:'var(--success)', fontWeight:'700' }}>{row['إجمالي وارد'].toLocaleString()}</td>
                  <td style={{ color:'var(--danger)', fontWeight:'700' }}>{row['إجمالي صادر'].toLocaleString()}</td>
                  <td style={{ color: row['صافي']>=0?'var(--primary)':'var(--danger)', fontWeight:'800' }}>{row['صافي'].toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
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
                    {new Date(log.timestamp).toLocaleString('ar-SA')}
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
