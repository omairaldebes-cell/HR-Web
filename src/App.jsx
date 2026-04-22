import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { calculatePenaltyHours, parseExcel } from './utils';
import { db } from './firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { AccountingProvider } from './accounting/context/AccountingContext';
import AccountingDashboard from './accounting/AccountingDashboard';
import DailyJournal from './accounting/DailyJournal';
import { AccountsView, CategoriesView, CounterpartiesView } from './accounting/MasterDataViews';
import { MonthlyReport } from './accounting/ReportViews';
import ImportLegacy from './accounting/ImportLegacy';
import { CustomFieldsBuilder, AccountingSettings } from './accounting/AdminViews';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { 
  Users, 
  Clock, 
  Upload, 
  LayoutDashboard, 
  PlusCircle, 
  ListTodo,
  FileSpreadsheet,
  Settings,
  Trash2,
  CalendarCheck,
  Banknote,
  FileText,
  Edit,
  Lock,
  LogOut,
  UserCog,
  Menu,
  Printer,
  BarChart2,
  Bell,
  Download,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  X,
  BookOpen,
  Wallet,
  Tag
} from 'lucide-react';

const ARABIC_MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];

const MonthPicker = ({ value, onChange }) => {
  const [year, month] = value.split('-');
  return (
    <div style={{display:'flex', gap:'0.5rem', alignItems:'center'}}>
      <select value={month} onChange={e => onChange(`${year}-${e.target.value}`)} className="btn-outline btn" style={{padding: '0.4rem 1rem'}}>
        {ARABIC_MONTHS.map((m, i) => <option key={i} value={String(i+1).padStart(2,'0')}>{m}</option>)}
      </select>
      <input type="number" value={year} onChange={e => onChange(`${e.target.value}-${month}`)} className="btn-outline btn" style={{padding: '0.4rem', width:'80px'}} />
    </div>
  );
};

const DEFAULT_SETTINGS = {
  workStart: '09:00',
  workEnd: '15:00',
  hoursPerLeaveDay: 6,
  overtimeRate: 0,
  themeMode: 'dark'
};

const HR_NAV = [
  { id: 'dashboard',  label: 'لوحة القيادة',       icon: LayoutDashboard, group: 'hr' },
  { id: 'analytics',  label: 'التحليلات',           icon: BarChart2,       group: 'hr' },
  { id: 'employees',  label: 'إدارة الموظفين',      icon: Users,           group: 'hr' },
  { id: 'attendance', label: 'تسجيل الحضور',       icon: Clock,           group: 'hr' },
  { id: 'records',    label: 'سجل الحضور الكامل',  icon: FileText,        group: 'hr' },
  { id: 'leaves',     label: 'طلبات الإجازة',      icon: CalendarCheck,   group: 'hr' },
  { id: 'advances',   label: 'السلف النقدية',      icon: Banknote,        group: 'hr' },
  { id: 'upload',     label: 'رفع ملف إكسل',       icon: Upload,          group: 'hr' },
  { id: 'settings',   label: 'الإعدادات',           icon: Settings,        group: 'hr' },
  { id: 'users',      label: 'إدارة المستخدمين',   icon: UserCog,         group: 'hr' },
];

const ACC_NAV = [
  { id: 'acc_dashboard',  label: 'لوحة المحاسبة',       icon: LayoutDashboard, group: 'acc' },
  { id: 'acc_daily',      label: 'دفتر اليومية',         icon: BookOpen,        group: 'acc' },
  { id: 'acc_accounts',   label: 'الحسابات والدفاتر',    icon: Wallet,          group: 'acc' },
  { id: 'acc_categories', label: 'الفئات',               icon: Tag,             group: 'acc' },
  { id: 'acc_parties',    label: 'الأطراف',              icon: Users,           group: 'acc' },
  { id: 'acc_report',     label: 'التقارير الشهرية',    icon: BarChart2,       group: 'acc' },
  { id: 'acc_import',     label: 'استيراد Excel',        icon: Upload,          group: 'acc' },
  { id: 'acc_fields',     label: 'الحقول المخصصة',      icon: FileSpreadsheet, group: 'acc' },
  { id: 'acc_settings',   label: 'إعدادات المحاسبة',    icon: Settings,        group: 'acc' },
];

const navItems = [...HR_NAV, ...ACC_NAV];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [profileEmpId, setProfileEmpId] = useState(null);
  const [toasts, setToasts] = useState([]);
  
  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  }, []);
  
  // Auth State
  const [loggedInUser, setLoggedInUser] = useState(() => {
    const saved = localStorage.getItem('hr_logged_in_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });

  // App State (from Firebase)
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsDocId, setSettingsDocId] = useState(null);
  const [appUsers, setAppUsers] = useState([]);

  // Current View Month
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Fetch from Firebase
  useEffect(() => {
    const unsubEmp = onSnapshot(collection(db, 'employees'), (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubAtt = onSnapshot(collection(db, 'attendance'), (snapshot) => {
      setAttendance(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubAdv = onSnapshot(collection(db, 'advances'), (snapshot) => {
      setAdvances(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubUsers = onSnapshot(collection(db, 'app_users'), (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAppUsers(usersList);
      
      // Auto-create default admin if collection is completely empty
      if (usersList.length === 0) {
        addDoc(collection(db, 'app_users'), {
          username: 'faez',
          password: 'faez@123',
          role: 'admin',
          permissions: navItems.map(item => item.id) // all permissions
        });
      }
    });

    const unsubSet = onSnapshot(collection(db, 'settings'), (snapshot) => {
      if (!snapshot.empty) {
        setSettingsDocId(snapshot.docs[0].id);
        const data = snapshot.docs[0].data();
        setSettings({ ...DEFAULT_SETTINGS, ...data });
      } else {
        addDoc(collection(db, 'settings'), DEFAULT_SETTINGS).then(ref => {
          setSettingsDocId(ref.id);
        });
      }
    });

    return () => {
      unsubEmp(); unsubAtt(); unsubAdv(); unsubSet(); unsubUsers();
    };
  }, []);

  // Apply theme mode and mouse tracking for apple-glass shimmer effect
  useEffect(() => {
    document.body.className = settings.themeMode || 'dark';

    if (settings.themeMode === 'apple-glass') {
      const handleMouseMove = (e) => {
        const cards = document.querySelectorAll('.card, .stat-card, .btn, .modal-box');
        for (const card of cards) {
          const rect = card.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          card.style.setProperty('--mouse-x', `${x}px`);
          card.style.setProperty('--mouse-y', `${y}px`);
          card.classList.add('glass-shimmer');
        }
      };

      window.addEventListener('mousemove', handleMouseMove);
      return () => window.removeEventListener('mousemove', handleMouseMove);
    }
  }, [settings.themeMode]);

  // Update localStorage when logged in user changes
  useEffect(() => {
    if (loggedInUser) {
      localStorage.setItem('hr_logged_in_user', JSON.stringify(loggedInUser));
    } else {
      localStorage.removeItem('hr_logged_in_user');
    }
  }, [loggedInUser]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (appUsers.length === 0) {
      alert('جاري تحميل بيانات النظام، يرجى المحاولة خلال ثوانٍ...');
      return;
    }
    const user = appUsers.find(u => u.username === loginForm.username && u.password === loginForm.password);
    if (user) {
      setLoggedInUser(user);
      
      // Redirect to the first available tab for this user if they don't have dashboard
      if (user.permissions && !user.permissions.includes('dashboard')) {
        setActiveTab(user.permissions[0]);
      } else {
        setActiveTab('dashboard');
      }
    } else {
      alert('خطأ في اسم المستخدم أو كلمة المرور');
    }
  };

  const handleLogout = () => {
    setLoggedInUser(null);
    setLoginForm({ username: '', password: '' });
  };

  // Derived Statistics for Dashboard (Filtered by Month)
  const stats = useMemo(() => {
    return employees.map(emp => {
      const allRecords = attendance.filter(a => a.employeeId === emp.id);
      const totalAllPenaltyHours = allRecords.reduce((sum, r) => sum + (r.penaltyHours || 0), 0);
      const hoursPerLeaveDay = settings.hoursPerLeaveDay || 6;
      const consumedLeavesAllTime = (totalAllPenaltyHours / hoursPerLeaveDay).toFixed(2);
      const remainingLeaves = (emp.totalLeaves - consumedLeavesAllTime).toFixed(2);

      const monthRecords = allRecords.filter(a => a.date && a.date.startsWith(viewMonth));
      const monthPenaltyHours = monthRecords.reduce((sum, r) => sum + (r.penaltyHours || 0), 0);
      const monthExtraHours = monthRecords.reduce((sum, r) => sum + (parseFloat(r.extraHours) || 0), 0);
      
      const baseSalary = parseFloat(emp.salary) || 0;
      const otValue = monthExtraHours * (parseFloat(settings.overtimeRate) || 0);

      const monthAdvancesList = advances.filter(ad => ad.employeeId === emp.id && ad.month === viewMonth);
      const totalAdvances = monthAdvancesList.reduce((sum, ad) => sum + (parseFloat(ad.amount) || 0), 0);

      const netSalary = baseSalary + otValue - totalAdvances;

      return {
        ...emp,
        remainingLeaves,
        monthPenaltyHours,
        monthExtraHours,
        otValue,
        totalAdvances,
        netSalary
      };
    });
  }, [employees, attendance, advances, settings, viewMonth]);
  // Low-leave alert badges shown on sidebar
  const lowLeaveAlerts = useMemo(() => stats.filter(s => parseFloat(s.remainingLeaves) < 3), [stats]);

  // LOGIN VIEW
  if (!loggedInUser) {
    return (
      <div style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'var(--bg-color)'}}>
        <div className="card animate-fade-in" style={{maxWidth: '400px', width: '100%', textAlign: 'center'}}>
          <Lock size={48} style={{margin:'0 auto 1rem', color:'var(--primary)'}} />
          <h2 className="card-title" style={{marginBottom: '2rem'}}>تسجيل الدخول للنظام</h2>
          
          <form onSubmit={handleLogin} style={{textAlign: 'right'}}>
            <div className="form-group">
              <label>اسم المستخدم</label>
              <input 
                type="text" 
                value={loginForm.username} 
                onChange={e => setLoginForm({...loginForm, username: e.target.value})} 
                required 
              />
            </div>
            <div className="form-group" style={{marginBottom: '2rem'}}>
              <label>كلمة المرور</label>
              <input 
                type="password" 
                value={loginForm.password} 
                onChange={e => setLoginForm({...loginForm, password: e.target.value})} 
                required 
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{width: '100%'}}>دخول</button>
          </form>
        </div>

        <footer style={{
          position: 'absolute',
          bottom: '20px',
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          opacity: 0.8,
          lineHeight: '1.6'
        }}>
          <div>Developed by Omair Aldebes | تم تطويره بواسطة عمير الدبس</div>
          <div>© 2026 All Rights Reserved | جميع الحقوق محفوظة © 2026</div>
        </footer>
      </div>
    );
  }

  // --- REGULAR VIEWS ---

  const Dashboard = () => {
    const totalPayroll = stats.reduce((sum, s) => sum + s.netSalary, 0);
    const totalOT = stats.reduce((sum, s) => sum + s.otValue, 0);
    const totalAdvances = stats.reduce((sum, s) => sum + s.totalAdvances, 0);
    const totalPenaltyHours = stats.reduce((sum, s) => sum + s.monthPenaltyHours, 0);
    return (
    <div className="animate-fade-in">
      <div className="card-header no-print">
        <h2 className="card-title"><LayoutDashboard /> لوحة القيادة</h2>
        <div><MonthPicker value={viewMonth} onChange={setViewMonth} /></div>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid" style={{marginBottom:'1.5rem'}}>
        <div className="stat-card"><div className="stat-label">إجمالي كتلة الرواتب</div><div className="stat-value" style={{fontSize:'1.4rem'}}>{totalPayroll.toLocaleString('en-US')}</div><div className="stat-label">ل.س</div></div>
        <div className="stat-card"><div className="stat-label">إجمالي العمل الإضافي</div><div className="stat-value" style={{fontSize:'1.4rem',color:'var(--success)'}}>{totalOT.toLocaleString('en-US')}</div><div className="stat-label">ل.س</div></div>
        <div className="stat-card"><div className="stat-label">إجمالي السلف</div><div className="stat-value" style={{fontSize:'1.4rem',color:'var(--warning)'}}>{totalAdvances.toLocaleString('en-US')}</div><div className="stat-label">ل.س</div></div>
        <div className="stat-card"><div className="stat-label">ساعات تأخير إجمالية</div><div className="stat-value" style={{fontSize:'1.4rem',color:'var(--danger)'}}>{totalPenaltyHours}</div><div className="stat-label">ساعة</div></div>
      </div>

      {/* Alerts */}
      {lowLeaveAlerts.length > 0 && (
        <div className="card" style={{marginBottom:'1.5rem', borderColor:'var(--warning)', borderWidth:'2px'}}>
          <h3 className="card-title" style={{color:'var(--warning)', marginBottom:'0.75rem'}}><AlertTriangle size={18}/> تحذير: رصيد إجازات منخفض</h3>
          <div style={{display:'flex', gap:'0.75rem', flexWrap:'wrap'}}>
            {lowLeaveAlerts.map(s => <span key={s.id} className="badge badge-danger" style={{fontSize:'0.9rem', padding:'0.4rem 0.8rem'}}>{s.name} — {s.remainingLeaves} يوم</span>)}
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="card-title" style={{ marginBottom: '1rem' }}><ListTodo /> التقرير الشهري ({viewMonth})</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>اسم الموظف</th>
                <th>الراتب الأساسي</th>
                <th>رصيد الإجازات المتبقي</th>
                <th>ساعات التأخير (الشهر)</th>
                <th>العمل الإضافي (ساعات)</th>
                <th>قيمة الإضافي</th>
                <th>السلف المخصومة</th>
                <th>الصافي المستحق</th>
                <th>بروفايل</th>
              </tr>
            </thead>
            <tbody>
              {stats.length === 0 ? (
                <tr><td colSpan="9" style={{textAlign: 'center', color: 'var(--text-secondary)'}}>&#x644;&#x627; &#x64A;&#x648;&#x62C;&#x62F; &#x628;&#x64A;&#x627;&#x646;&#x627;&#x62A;</td></tr>
              ) : (
                stats.map(s => (
                  <tr key={s.id}>
                    <td style={{fontWeight: '700'}}>{s.name}</td>
                    <td>{s.salary} ل.س</td>
                    <td>
                      <span className={`badge ${s.remainingLeaves < 3 ? 'badge-danger' : 'badge-success'}`}>
                        {s.remainingLeaves} أيام
                      </span>
                    </td>
                    <td style={{color: s.monthPenaltyHours > 0 ? 'var(--danger)' : 'inherit'}}>{s.monthPenaltyHours} ساعة</td>
                    <td>{s.monthExtraHours} ساعة</td>
                    <td>{s.otValue.toLocaleString('en-US')} ل.س</td>
                    <td style={{color: s.totalAdvances > 0 ? 'var(--warning)' : 'inherit'}}>{s.totalAdvances.toLocaleString('en-US')} ل.س</td>
                    <td style={{fontWeight: '800', color: 'var(--primary)'}}>{s.netSalary.toLocaleString('en-US')} ل.س</td>
                    <td>
                      <button className="btn btn-secondary" style={{padding:'0.3rem 0.7rem'}} onClick={() => { setProfileEmpId(s.id); setActiveTab('employees'); }}>
                        <Users size={14}/>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

  /* ================================================
     ANALYTICS VIEW
  ================================================ */
  const AnalyticsView = () => {
    const salaryChartData = stats.map(s => ({ name: s.name, 'صافي': s.netSalary, 'سلف': s.totalAdvances, 'إضافي': s.otValue }));
    return (
      <div className="animate-fade-in" style={{display:'flex', flexDirection:'column', gap:'2rem'}}>
        <div className="card-header" style={{padding:'0 0 1rem'}}>
          <h2 className="card-title"><BarChart2 /> لوحة التحليلات البصرية</h2>
          <MonthPicker value={viewMonth} onChange={setViewMonth} />
        </div>

        <div className="card">
          <h3 className="card-title" style={{marginBottom:'1.5rem'}}><TrendingUp size={18}/> مقارنة الرواتب والسلف والإضافي</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={salaryChartData} margin={{top:5,right:10,left:10,bottom:5}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{fill:'var(--text-secondary)',fontSize:12}} />
              <YAxis tick={{fill:'var(--text-secondary)',fontSize:12}} />
              <Tooltip contentStyle={{background:'var(--surface)',border:'1px solid var(--border)',color:'var(--text-primary)'}} />
              <Legend />
              <Bar dataKey="صافي" fill="#3b82f6" radius={[4,4,0,0]} />
              <Bar dataKey="سلف" fill="#f59e0b" radius={[4,4,0,0]} />
              <Bar dataKey="إضافي" fill="#10b981" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const EmployeesView = () => {
    const [name, setName] = useState('');
    const [salary, setSalary] = useState('');
    const [leaves, setLeaves] = useState(12);
    const [workDays, setWorkDays] = useState([0, 1, 2, 3, 4]);
    const [editId, setEditId] = useState(null);

    const handleAdd = async (e) => {
      e.preventDefault();
      if (!name.trim() || !salary.trim()) return;
      
      const data = { name: name.trim(), salary: salary, totalLeaves: parseFloat(leaves), workDays };

      if (editId) {
        await updateDoc(doc(db, 'employees', editId), data);
        setEditId(null);
      } else {
        await addDoc(collection(db, 'employees'), data);
      }
      setName(''); setSalary(''); setLeaves(12); setWorkDays([0, 1, 2, 3, 4]);
    };

    const handleEdit = (emp) => {
      setEditId(emp.id); 
      setName(emp.name); 
      setSalary(emp.salary); 
      setLeaves(emp.totalLeaves); 
      setWorkDays(emp.workDays || [0, 1, 2, 3, 4]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id) => {
      if(window.confirm('هل أنت متأكد من حذف هذا الموظف؟')) await deleteDoc(doc(db, 'employees', id));
    };

    const toggleDay = (i) => workDays.includes(i) ? setWorkDays(workDays.filter(d=>d!==i)) : setWorkDays([...workDays, i].sort());
    const daysOfWeek = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

    return (
      <div className="animate-fade-in grid-cols-2" style={{display: 'flex', flexDirection: 'column', gap: '2rem'}}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title"><PlusCircle /> {editId ? 'تحديث موظف' : 'إضافة موظف جديد'}</h2>
          </div>
          <form onSubmit={handleAdd}>
            <div className="grid-cols-2" style={{marginBottom: '1rem'}}>
              <div className="form-group"><label>اسم الموظف</label><input type="text" value={name} onChange={e=>setName(e.target.value)} required /></div>
              <div className="form-group"><label>الراتب الشهري (ل.س)</label><input type="number" value={salary} onChange={e=>setSalary(e.target.value)} required /></div>
              <div className="form-group"><label>رصيد الإجازات السنوي (أيام)</label><input type="number" step="0.5" value={leaves} onChange={e=>setLeaves(e.target.value)} required /></div>
            </div>
            
            <div className="form-group">
              <label>أيام العمل الافتراضية</label>
              <div style={{display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem'}}>
                {daysOfWeek.map((day, i) => (
                  <label key={i} style={{cursor: 'pointer'}}><input type="checkbox" checked={workDays.includes(i)} onChange={()=>toggleDay(i)} style={{width: 'auto', marginLeft:'5px'}} />{day}</label>
                ))}
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{marginTop: '1rem'}}>{editId ? 'حفظ التحديث' : 'إضافة'}</button>
          </form>
        </div>

        {/* Employee Profiles */}
        {employees.map(emp => {
          if (profileEmpId && profileEmpId !== emp.id) return null;
          const empStats = stats.find(s => s.id === emp.id);
          const empAttendance = attendance.filter(a => a.employeeId === emp.id).length;
          const empAdvances = advances.filter(a => a.employeeId === emp.id).reduce((s,a) => s + (parseFloat(a.amount)||0), 0);
          return (
            <div key={emp.id} className="card" style={{border: profileEmpId === emp.id ? '2px solid var(--primary)' : ''}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'1rem'}}>
                <div style={{display:'flex', gap:'1rem', alignItems:'center'}}>
                  <div style={{width:'52px',height:'52px',borderRadius:'50%',background:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.4rem',fontWeight:'900',color:'white',flexShrink:0}}>
                    {emp.name.charAt(0)}
                  </div>
                  <div>
                    <div style={{fontWeight:'800', fontSize:'1.1rem'}}>{emp.name}</div>
                    <div style={{color:'var(--text-secondary)', fontSize:'0.85rem'}}>راتب: {parseFloat(emp.salary).toLocaleString('en-US')} ل.س &nbsp;|  سجلات: {empAttendance} &nbsp;|  سلف: {empAdvances.toLocaleString('en-US')} ل.س</div>
                  </div>
                </div>
                <div style={{display:'flex', gap:'0.5rem', flexWrap:'wrap'}}>
                  <span className={`badge ${empStats && empStats.remainingLeaves < 3 ? 'badge-danger' : 'badge-success'}`} style={{fontSize:'0.85rem', padding:'0.4rem 0.8rem'}}>إجازات متبقية: {empStats?.remainingLeaves ?? '...'} يوم</span>
                  <button type="button" onClick={() => handleEdit(emp)} className="btn btn-secondary" style={{padding:'0.4rem 0.8rem'}}><Edit size={14}/> تعديل</button>
                  <button onClick={() => handleDelete(emp.id)} className="btn btn-danger" style={{padding:'0.4rem 0.8rem'}}><Trash2 size={14}/> حذف</button>
                  <button onClick={() => { setProfileEmpId(profileEmpId === emp.id ? null : emp.id); setActiveTab('records'); }} className="btn btn-outline" style={{padding:'0.4rem 0.8rem'}}><FileText size={14}/> سجل الحضور</button>
                </div>
              </div>
            </div>
          );
        })}
        {profileEmpId && <button className="btn btn-outline" style={{alignSelf:'flex-start'}} onClick={() => setProfileEmpId(null)}>عرض جميع الموظفين</button>}
      </div>
    );
  };

  const AttendanceView = () => {
    const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [expandedRow, setExpandedRow] = useState(null);
    
    // Local state for forms
    const [checkInTimes, setCheckInTimes] = useState({});
    const [checkOutTimes, setCheckOutTimes] = useState({});

    // Initialize default times when employees or date changes
    useEffect(() => {
      const initialCheckIn = {};
      const initialCheckOut = {};
      employees.forEach(emp => {
        initialCheckIn[emp.id] = settings.workStart || '09:00';
        initialCheckOut[emp.id] = settings.workEnd || '15:00';
      });
      setCheckInTimes(initialCheckIn);
      setCheckOutTimes(initialCheckOut);
    }, [employees, date, settings]);

    // Determine states
    const employeeStates = employees.map(emp => {
      const record = attendance.find(a => a.employeeId === emp.id && a.date === date);
      let state = 'pending'; // 1
      if (record) {
        if (record.type === 'leave' || record.type === 'absent') state = 'absent'; // 4
        else if (record.checkIn && !record.checkOut) state = 'checked-in'; // 2
        else if (record.checkOut) state = 'completed'; // 3
      }
      return { emp, record, state };
    });

    const pendingCount = employeeStates.filter(s => s.state === 'pending' || s.state === 'checked-in').length;
    const completedCount = employeeStates.filter(s => s.state === 'completed' || s.state === 'absent').length;
    const totalCount = employeeStates.length;
    const isAllCompleted = completedCount === totalCount && totalCount > 0;

    const handleExpand = (empId) => {
      setExpandedRow(expandedRow === empId ? null : empId);
    };

    const expandNextPending = (currentIndex) => {
      for (let i = currentIndex + 1; i < employeeStates.length; i++) {
        if (employeeStates[i].state === 'pending' || employeeStates[i].state === 'checked-in') {
          setExpandedRow(employeeStates[i].emp.id);
          return;
        }
      }
      for (let i = 0; i < currentIndex; i++) {
        if (employeeStates[i].state === 'pending' || employeeStates[i].state === 'checked-in') {
          setExpandedRow(employeeStates[i].emp.id);
          return;
        }
      }
      setExpandedRow(null); 
    };

    const handleCheckIn = async (index, empId) => {
      const time = checkInTimes[empId];
      await addDoc(collection(db, 'attendance'), { 
        employeeId: empId, 
        date, 
        checkIn: time, 
        checkOut: '', 
        penaltyHours: 0, 
        extraHours: 0, 
        type: 'manual', 
        timestamp: Date.now() 
      });
      showToast(`تم تسجيل حضور ${employees.find(e=>e.id===empId)?.name}`, 'info');
      expandNextPending(index);
    };

    const handleCheckOut = async (index, empId, recordId, checkInTime) => {
      const time = checkOutTimes[empId] || settings.workEnd;
      const penaltyHours = calculatePenaltyHours(checkInTime, time, settings.workStart, settings.workEnd);
      await updateDoc(doc(db, 'attendance', recordId), { 
        checkOut: time, 
        penaltyHours,
      });
      showToast(`تم إكمال دوام ${employees.find(e=>e.id===empId)?.name}`, 'success');
      expandNextPending(index);
    };

    const handleAbsent = async (index, empId) => {
      await addDoc(collection(db, 'attendance'), {
        employeeId: empId,
        date,
        checkIn: '',
        checkOut: '',
        penaltyHours: settings.hoursPerLeaveDay,
        extraHours: 0,
        type: 'leave',
        timestamp: Date.now()
      });
      showToast(`تم تسجيل غياب/إجازة`, 'warning');
      expandNextPending(index);
    };

    const handleSubmitDay = () => {
      if (isAllCompleted) {
        showToast('تم اعتماد اليوم بنجاح!', 'success');
      }
    };

    return (
      <div className="animate-fade-in card" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', overflow: 'visible' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 className="card-title" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
              <Clock style={{ color: 'var(--primary)', marginRight: '0.5rem' }} /> إدارة دوام اليوم
            </h2>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              إنجاز الموظفين: {completedCount} من {totalCount}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
              className="btn-outline" 
              style={{ padding: '0.65rem 1rem', borderRadius: 'var(--radius-md)' }} 
            />
            <button 
              className={`btn ${isAllCompleted ? 'btn-primary' : 'btn-secondary'}`} 
              onClick={handleSubmitDay}
              disabled={!isAllCompleted}
              style={{ opacity: isAllCompleted ? 1 : 0.5, cursor: isAllCompleted ? 'pointer' : 'not-allowed' }}
            >
              <CheckCircle size={18} /> اعتماد اليوم
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ width: '100%', height: '8px', background: 'rgba(128,128,128,0.2)', borderRadius: '4px', marginBottom: '2rem', overflow: 'hidden' }}>
          <div style={{ 
            width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%', 
            height: '100%', 
            background: 'var(--success)', 
            transition: 'width 0.5s ease' 
          }} />
        </div>

        {/* Employee List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {employeeStates.map((item, index) => {
            const { emp, record, state } = item;
            const isExpanded = expandedRow === emp.id;

            let cardStyle = {
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--surface)',
              transition: 'all 0.3s ease',
              overflow: 'hidden'
            };

            let accentBorder = '';
            let statusBadge = null;

            if (state === 'pending') {
              statusBadge = <span className="badge" style={{ background: 'transparent', border: '1px solid var(--warning)', color: 'var(--warning)' }}>في الانتظار</span>;
            } else if (state === 'checked-in') {
              accentBorder = '4px solid var(--primary)';
              statusBadge = <span className="badge" style={{ color: 'var(--primary)', background: 'rgba(59, 130, 246, 0.1)' }}>حضر: {record.checkIn}</span>;
            } else if (state === 'completed') {
              cardStyle.opacity = 0.6;
              statusBadge = <span className="badge badge-success"><CheckCircle size={12} style={{ marginLeft: '4px' }}/> مكتمل ({record.checkIn} - {record.checkOut})</span>;
            } else if (state === 'absent') {
              cardStyle.opacity = 0.5;
              statusBadge = <span className="badge badge-danger">غائب/إجازة</span>;
            }

            return (
              <div key={emp.id} style={{ ...cardStyle, borderRight: accentBorder || cardStyle.border }}>
                {/* Collapsed Header */}
                <div 
                  onClick={() => state !== 'completed' && state !== 'absent' && handleExpand(emp.id)}
                  style={{ 
                    padding: '1rem 1.5rem', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    cursor: (state !== 'completed' && state !== 'absent') ? 'pointer' : 'default'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ 
                      width: '40px', height: '40px', borderRadius: '50%', 
                      background: 'var(--primary)', color: 'white', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', 
                      fontWeight: 'bold', fontSize: '1.2rem',
                      opacity: state === 'absent' ? 0.5 : 1
                    }}>
                      {emp.name.charAt(0)}
                    </div>
                    <span style={{ 
                      fontWeight: '700', fontSize: '1.1rem',
                      textDecoration: state === 'absent' ? 'line-through' : 'none'
                    }}>
                      {emp.name}
                    </span>
                  </div>
                  <div>
                    {statusBadge}
                  </div>
                </div>

                {/* Expanded Area */}
                {isExpanded && state !== 'completed' && state !== 'absent' && (
                  <div style={{ 
                    padding: '1.5rem', 
                    borderTop: '1px solid var(--border)',
                    background: 'rgba(128,128,128,0.02)',
                    animation: 'fadeIn 0.3s ease-out'
                  }}>
                    {state === 'pending' && (
                      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div className="form-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                          <label>الحضور الفعلي</label>
                          <input 
                            type="time" 
                            value={checkInTimes[emp.id] || ''} 
                            onChange={(e) => setCheckInTimes({...checkInTimes, [emp.id]: e.target.value})} 
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                          <button className="btn btn-primary" onClick={() => handleCheckIn(index, emp.id)}>
                            تسجيل الحضور
                          </button>
                          <button className="btn btn-outline" onClick={() => handleAbsent(index, emp.id)} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                            تخطي / غياب
                          </button>
                        </div>
                      </div>
                    )}

                    {state === 'checked-in' && (
                      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div className="form-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                          <label>الانصراف الفعلي</label>
                          <input 
                            type="time" 
                            value={checkOutTimes[emp.id] || ''} 
                            onChange={(e) => setCheckOutTimes({...checkOutTimes, [emp.id]: e.target.value})} 
                          />
                        </div>
                        <button className="btn btn-primary" style={{ background: 'var(--success)' }} onClick={() => handleCheckOut(index, emp.id, record.id, record.checkIn)}>
                          اعتماد الانصراف
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {employeeStates.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              لا يوجد موظفين مسجلين في النظام.
            </div>
          )}
        </div>
      </div>
    );
  };

  const AttendanceCalendar = ({ employeeId, month, attendanceRecords, employees, settings }) => {
    if (!employeeId) return <div style={{textAlign:'center', padding:'2rem', color:'var(--text-secondary)'}}>الرجاء اختيار موظف لعرض التقويم</div>;
    
    const emp = employees.find(e => e.id === employeeId);
    const workDays = emp?.workDays || [0, 1, 2, 3, 4];
    
    const [year, monthNum] = month.split('-').map(Number);
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const firstDayOfMonth = new Date(year, monthNum - 1, 1).getDay();
    
    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);

    const dayLabels = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

    return (
      <div className="calendar-container animate-fade-in" style={{marginTop:0}}>
        <div className="calendar-grid">
          {dayLabels.map(l => <div key={l} className="calendar-day-header">{l}</div>)}
          {days.map((d, i) => {
            if (d === null) return <div key={`empty-${i}`} className="calendar-day empty"></div>;
            
            const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const record = attendanceRecords.find(r => r.date === dateStr && r.employeeId === employeeId);
            
            let statusClass = '';
            let tooltip = '';
            if (record) {
              if (record.type === 'leave') { statusClass = 'status-leave'; tooltip = 'إجازة'; }
              else if (record.penaltyHours > 0) { statusClass = 'status-late'; tooltip = `تأخير: ${record.penaltyHours} ساعة`; }
              else { statusClass = 'status-present'; tooltip = 'حاضر'; }
            } else {
              const dayOfWeek = new Date(year, monthNum - 1, d).getDay();
              const isWorkDay = workDays.includes(dayOfWeek);
              const isPast = new Date(year, monthNum - 1, d) < new Date().setHours(0,0,0,0);
              if (isWorkDay && isPast) { statusClass = 'status-absent'; tooltip = 'غياب'; }
            }

            return (
              <div key={d} className={`calendar-day ${statusClass}`} title={tooltip}>
                <span className="day-number">{d}</span>
                {record && record.penaltyHours > 0 && <span className="penalty-mini">{record.penaltyHours}h</span>}
              </div>
            );
          })}
        </div>
        <div className="calendar-legend">
          <div style={{display:'flex', alignItems:'center', gap:'0.4rem'}}><div style={{width:'12px',height:'12px',background:'var(--success)',borderRadius:'2px'}}></div> حاضر</div>
          <div style={{display:'flex', alignItems:'center', gap:'0.4rem'}}><div style={{width:'12px',height:'12px',background:'var(--warning)',borderRadius:'2px'}}></div> تأخير</div>
          <div style={{display:'flex', alignItems:'center', gap:'0.4rem'}}><div style={{width:'12px',height:'12px',background:'var(--primary)',borderRadius:'2px'}}></div> إجازة</div>
          <div style={{display:'flex', alignItems:'center', gap:'0.4rem'}}><div style={{width:'12px',height:'12px',background:'var(--danger)',borderRadius:'2px'}}></div> غياب</div>
          <div style={{display:'flex', alignItems:'center', gap:'0.4rem', marginRight:'auto'}}><AlertTriangle size={14} style={{color:'var(--text-secondary)'}}/> الغياب يتم تقديره بناءً على أيام العمل الافتراضية</div>
        </div>
      </div>
    );
  };

  const RecordsView = () => {
    const [filterEmp, setFilterEmp] = useState(''); 
    const [viewMode, setViewMode] = useState('table'); // 'table' | 'calendar'
    const [filterMonth, setFilterMonth] = useState(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    const [filterDateStart, setFilterDateStart] = useState(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [filterDateEnd, setFilterDateEnd] = useState(() => {
      const d = new Date();
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    });

    const [editId, setEditId] = useState(null); const [editData, setEditData] = useState({ checkIn: '', checkOut: '', extraHours: 0 });
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [printMode, setPrintMode] = useState(null); // null | 'detailed' | 'issues'

    const handleEdit = async (rec) => {
      if (editId === rec.id) {
        const penaltyHours = calculatePenaltyHours(editData.checkIn, editData.checkOut, settings.workStart, settings.workEnd);
        await updateDoc(doc(db, 'attendance', rec.id), { checkIn: editData.checkIn, checkOut: editData.checkOut, extraHours: parseFloat(editData.extraHours) || 0, penaltyHours });
        setEditId(null);
        showToast('تم تحديث السجل بنجاح', 'success');
      } else {
        setEditId(rec.id); setEditData({ checkIn: rec.checkIn||'', checkOut: rec.checkOut||'', extraHours: rec.extraHours||0 });
      }
    };

    const handleDelete = async(id) => {
      if (window.confirm('متأكد من عملية الحذف؟')) {
        await deleteDoc(doc(db, 'attendance', id));
        showToast('تم حذف السجل', 'info');
      }
    };

    const filtered = attendance.slice().sort((a,b) => (b.timestamp||0)-(a.timestamp||0)).filter(rec => {
        const passEmp = filterEmp ? rec.employeeId === filterEmp : true;
        if (viewMode === 'calendar') {
          return passEmp && rec.date && rec.date.startsWith(filterMonth);
        }
        const passStart = filterDateStart ? rec.date >= filterDateStart : true;
        const passEnd = filterDateEnd ? rec.date <= filterDateEnd : true;
        return passEmp && passStart && passEnd;
      });

    const issuesOnly = filtered.filter(rec => (rec.penaltyHours > 0) || rec.type === 'leave');
    const printRows = printMode === 'issues' ? issuesOnly : filtered;

    const triggerPrint = (mode) => {
      setPrintMode(mode);
      setShowPrintModal(false);
      setTimeout(() => {
        window.onafterprint = () => setPrintMode(null);
        window.print();
      }, 80);
    };

    const isSingleEmployee = filterEmp !== '';
    const selectedEmp = isSingleEmployee ? employees.find(e => e.id === filterEmp) : null;
    
    let summary = null;
    if (selectedEmp) {
      const allRecords = attendance.filter(a => a.employeeId === selectedEmp.id);
      const totalAllPenaltyHours = allRecords.reduce((sum, r) => sum + (r.penaltyHours || 0), 0);
      const hoursPerLeaveDay = settings.hoursPerLeaveDay || 6;
      const consumedLeavesAllTime = (totalAllPenaltyHours / hoursPerLeaveDay).toFixed(2);
      const remainingLeaves = (selectedEmp.totalLeaves - consumedLeavesAllTime).toFixed(2);

      const rangeExtraHours = filtered.reduce((sum, r) => sum + (parseFloat(r.extraHours) || 0), 0);
      const rangePenaltyHours = filtered.reduce((sum, r) => sum + (parseFloat(r.penaltyHours) || 0), 0);
      const rangeOtValue = rangeExtraHours * (parseFloat(settings.overtimeRate) || 0);
      const rangeConsumedLeaves = (rangePenaltyHours / hoursPerLeaveDay).toFixed(2);

      const rangeAdvancesList = advances.filter(ad => {
         if (ad.employeeId !== selectedEmp.id) return false;
         const adDate = ad.date || `${ad.month}-01`;
         const passStart = viewMode === 'calendar' ? adDate.startsWith(filterMonth) : (filterDateStart ? adDate >= filterDateStart : true);
         const passEnd = viewMode === 'calendar' ? adDate.startsWith(filterMonth) : (filterDateEnd ? adDate <= filterDateEnd : true);
         return passStart && passEnd;
      });

      const totalRangeAdvances = rangeAdvancesList.reduce((sum, ad) => sum + (parseFloat(ad.amount) || 0), 0);
      const baseSalary = parseFloat(selectedEmp.salary) || 0;
      const netSalary = baseSalary + rangeOtValue - totalRangeAdvances;

      summary = {
        name: selectedEmp.name,
        baseSalary,
        rangeExtraHours,
        rangeOtValue,
        totalRangeAdvances,
        netSalary,
        remainingLeaves,
        rangeConsumedLeaves,
        rangePenaltyHours
      };
    }

    return (
      <>
        {/* PRINT OPTIONS MODAL - Moved outside card to ensure fixed positioning relative to viewport */}
        {showPrintModal && (
          <div className="modal-overlay" onClick={() => setShowPrintModal(false)}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem'}}>
                <h3 style={{margin:0, color:'var(--text-primary)'}}><Printer size={18} style={{verticalAlign:'middle', marginLeft:'6px'}}/> خيارات الطباعة</h3>
                <button type="button" onClick={() => setShowPrintModal(false)} className="btn btn-secondary" style={{padding:'0.3rem 0.6rem'}}><X size={16}/></button>
              </div>
              <div style={{display:'flex', flexDirection:'column', gap:'0.75rem'}}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{padding:'0.85rem 1.5rem', fontSize:'1rem', display:'flex', alignItems:'center', gap:'0.75rem', justifyContent:'flex-start'}}
                  onClick={() => triggerPrint('detailed')}
                >
                  <FileText size={20}/>
                  <div style={{textAlign:'right'}}>
                    <div>طباعة السجل التفصيلي</div>
                    <div style={{fontSize:'0.8rem', opacity:0.85, fontWeight:'400'}}>جميع السجلات المفلترة ({filtered.length} سجل)</div>
                  </div>
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{padding:'0.85rem 1.5rem', fontSize:'1rem', display:'flex', alignItems:'center', gap:'0.75rem', justifyContent:'flex-start', borderColor:'var(--danger)', color:'var(--danger)'}}
                  onClick={() => triggerPrint('issues')}
                >
                  <AlertTriangle size={20}/>
                  <div style={{textAlign:'right'}}>
                    <div>طباعة سجلات التأخير والإجازات فقط</div>
                    <div style={{fontSize:'0.8rem', opacity:0.75, fontWeight:'400'}}>السجلات التي تحوي تأخير أو إجازة ({issuesOnly.length} سجل)</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="animate-fade-in card print-card">

        <div className="card-header no-print">
          <h2 className="card-title"><FileText /> سجل الحضور الكامل</h2>
          <div style={{display:'flex', gap:'0.5rem'}}>
            <div className="btn-group" style={{background:'var(--bg-color)', padding:'2px', borderRadius:'var(--radius-md)', display:'flex'}}>
              <button className={`btn ${viewMode === 'table' ? 'btn-primary' : ''}`} style={{padding:'0.4rem 0.8rem', fontSize:'0.8rem'}} onClick={() => setViewMode('table')}>جدول</button>
              <button className={`btn ${viewMode === 'calendar' ? 'btn-primary' : ''}`} style={{padding:'0.4rem 0.8rem', fontSize:'0.8rem'}} onClick={() => setViewMode('calendar')}>تقويم</button>
            </div>
            <button onClick={() => setShowPrintModal(true)} className="btn btn-outline" style={{display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.4rem 0.8rem'}}><Printer size={16}/> طباعة</button>
          </div>
        </div>

        <div className="stats-grid no-print" style={{marginBottom: '1.5rem', backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)'}}>
          <div className="form-group" style={{marginBottom: 0}}>
            <label>الموظف</label>
            <select value={filterEmp} onChange={e=>setFilterEmp(e.target.value)}>
              <option value="">{viewMode==='calendar'?'-- اختر موظف --':'الكل'}</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          {viewMode === 'table' ? (
            <>
              <div className="form-group" style={{marginBottom: 0}}><label>من تاريخ</label><input type="date" value={filterDateStart} onChange={e=>setFilterDateStart(e.target.value)} /></div>
              <div className="form-group" style={{marginBottom: 0}}><label>إلى تاريخ</label><input type="date" value={filterDateEnd} onChange={e=>setFilterDateEnd(e.target.value)} /></div>
            </>
          ) : (
            <div className="form-group" style={{marginBottom: 0}}><label>الشهر</label><MonthPicker value={filterMonth} onChange={setFilterMonth} /></div>
          )}
        </div>
        
        {summary && (
          <div className="print-summary" style={{marginBottom: '1.5rem', padding: '1.5rem', border: '2px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)'}}>
            <h3 style={{marginBottom: '1rem', color: 'var(--primary)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem'}}>
              تقرير الموظف: {summary.name} 
              {viewMode === 'calendar' ? ` (${filterMonth})` : (filterDateStart && filterDateEnd ? ` (من ${filterDateStart} إلى ${filterDateEnd})` : '')}
              {printMode === 'issues' && <span style={{marginRight:'0.75rem', fontSize:'0.85rem', color:'var(--danger)', fontWeight:'400'}}>(يعرض سجلات التأخير والإجازات فقط)</span>}
            </h3>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', fontWeight: 'bold'}}>
               <div>الراتب الأساسي:<br/><span style={{color: 'var(--text-secondary)', fontSize:'1.2rem'}}>{summary.baseSalary.toLocaleString('en-US')} ل.س</span></div>
               <div>ساعات العمل الإضافي:<br/><span style={{color: 'var(--success)', fontSize:'1.2rem'}}>{summary.rangeExtraHours} ساعة ({summary.rangeOtValue.toLocaleString('en-US')} ل.س)</span></div>
               <div>ساعات التأخير (للفترة):<br/><span style={{color: 'var(--danger)', fontSize:'1.2rem'}}>{summary.rangePenaltyHours} ساعة (~ {summary.rangeConsumedLeaves} يوم إجازة)</span></div>
               <div>السلف (للفترة):<br/><span style={{color: 'var(--warning)', fontSize:'1.2rem'}}>{summary.totalRangeAdvances.toLocaleString()} ل.س</span></div>
               <div>رصيد الإجازات المتبقي (الكلي):<br/><span style={{color: summary.remainingLeaves < 3 ? 'var(--danger)' : 'var(--primary)', fontSize:'1.2rem'}}>{summary.remainingLeaves} يوم</span></div>
               <div style={{borderRight: '4px solid var(--primary)', paddingRight: '0.5rem', color: 'var(--primary)'}}>صافي الراتب المستحق:<br/><span style={{fontSize:'1.5rem', color: 'var(--primary)'}}>{summary.netSalary.toLocaleString()} ل.س</span></div>
            </div>
          </div>
        )}

        {viewMode === 'table' ? (
          <div className="table-container">
            <table>
              <thead><tr><th>الموظف</th><th>التاريخ</th><th>النوع</th><th>الحضور</th><th>الانصراف</th><th>إضافي</th><th>تأخير</th><th className="no-print">إجراءات</th></tr></thead>
              <tbody>
                {printRows.map(rec => {
                  const emp = employees.find(e => e.id === rec.employeeId);
                  const isEditing = editId === rec.id;
                  return (
                    <tr key={rec.id} style={{background: rec.type === 'leave' ? 'rgba(245,158,11,0.07)' : rec.penaltyHours > 0 ? 'rgba(239,68,68,0.05)' : ''}}>
                      <td style={{fontWeight:'700'}}>{emp?.name || 'محذوف'}</td><td>{rec.date}</td><td>{rec.type==='leave'?'إجازة':rec.type==='excel'?'إكسل':'يدوي'}</td>
                      {isEditing ? (
                        <>
                          <td><input type="time" value={editData.checkIn} onChange={e=>setEditData({...editData,checkIn:e.target.value})} style={{padding:'0.2rem',width:'auto'}} /></td>
                          <td><input type="time" value={editData.checkOut} onChange={e=>setEditData({...editData,checkOut:e.target.value})} style={{padding:'0.2rem',width:'auto'}} /></td>
                          <td><input type="number" step="0.5" value={editData.extraHours} onChange={e=>setEditData({...editData,extraHours:e.target.value})} style={{padding:'0.2rem',width:'60px'}} /></td>
                          <td>سيتم الحساب</td>
                        </>
                      ) : (
                        <>
                          <td>{rec.checkIn || (rec.type==='leave'?'-':'غير مسجل')}</td><td>{rec.checkOut || (rec.type==='leave'?'-':'غير مسجل')}</td><td>{rec.extraHours||0}</td><td style={{color: rec.penaltyHours > 0 ? 'var(--danger)' : 'inherit', fontWeight: rec.penaltyHours > 0 ? '700' : '400'}}>{rec.penaltyHours} ساعة</td>
                        </>
                      )}
                      <td className="no-print">
                        {rec.type !== 'leave' && <button onClick={()=>handleEdit(rec)} className={`btn ${isEditing?'btn-success':'btn-secondary'}`} style={{padding:'0.3rem 0.6rem',marginLeft:'0.5rem',background:isEditing?'var(--success)':''}}>{isEditing?'حفظ':'تعديل'}</button>}
                        <button onClick={()=>handleDelete(rec.id)} className="btn btn-danger" style={{padding:'0.3rem 0.6rem'}}><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  )
                })}
                {printRows.length === 0 && <tr><td colSpan="8" style={{textAlign:'center'}}>لا يوجد سجلات</td></tr>}
              </tbody>
            </table>
          </div>
        ) : (
          <AttendanceCalendar 
            employeeId={filterEmp} 
            month={filterMonth} 
            attendanceRecords={attendance} 
            employees={employees} 
            settings={settings}
          />
        )}
      </div>
      </>
    );
  };

  const LeaveRequestsView = () => {
    const [empId, setEmpId] = useState(''); const [date, setDate] = useState('');
    const handleAdd = async (e) => {
      e.preventDefault(); if (!empId || !date) return;
      await addDoc(collection(db, 'attendance'), { employeeId: empId, date, checkIn: '', checkOut: '', penaltyHours: settings.hoursPerLeaveDay, extraHours: 0, type: 'leave', timestamp: Date.now() });
      alert(`تم خصم وتنزيل الإجازة بنجاح.`); setDate(''); setEmpId('');
    };

    return (
      <div className="animate-fade-in card">
        <h2 className="card-title" style={{marginBottom:'1.5rem'}}><CalendarCheck /> إضافة يوم إجازة (يخصم من الرصيد والغيابات)</h2>
        <form onSubmit={handleAdd} className="flex-row" style={{alignItems:'flex-end'}}>
          <div className="form-group" style={{flex:1,marginBottom:0}}>
            <label>الموظف</label><select value={empId} onChange={e=>setEmpId(e.target.value)} required><option value="">-- اختر --</option>{employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select>
          </div>
          <div className="form-group" style={{flex:1,marginBottom:0}}><label>التاريخ</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} required /></div>
          <button type="submit" className="btn btn-primary">حفظ الإجازة</button>
        </form>
      </div>
    );
  };

  const AdvancesView = () => {
    const [empId, setEmpId] = useState(''); 
    const [month, setMonth] = useState(() => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; });
    const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [amount, setAmount] = useState('');

    const handleAdd = async (e) => {
      e.preventDefault(); if (!empId || !month || !amount || !date) return;
      await addDoc(collection(db, 'advances'), { employeeId: empId, date, month, amount: parseFloat(amount), timestamp: Date.now() });
      alert('تم التسجيل بنجاح.'); setEmpId(''); setAmount('');
    };

    const handleDelete = async (id) => window.confirm('متأكد؟') && await deleteDoc(doc(db, 'advances', id));

    return (
      <div className="animate-fade-in grid-cols-2" style={{display:'flex', flexDirection:'column', gap:'2rem'}}>
        <div className="card">
          <h2 className="card-title" style={{marginBottom:'1.5rem'}}><Banknote /> سلفة نقدية</h2>
          <form onSubmit={handleAdd}>
            <div className="stats-grid">
              <div className="form-group"><label>الموظف</label><select value={empId} onChange={e=>setEmpId(e.target.value)} required><option value="">-- اختر --</option>{employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
              <div className="form-group"><label>تاريخ الطلب</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} required /></div>
              <div className="form-group"><label>تخصم من شهر</label><MonthPicker value={month} onChange={setMonth} /></div>
              <div className="form-group"><label>المبلغ (ل.س)</label><input type="number" value={amount} onChange={e=>setAmount(e.target.value)} required /></div>
            </div>
            <button type="submit" className="btn btn-primary" style={{marginTop:'1rem'}}>صرف</button>
          </form>
        </div>
        
        <div className="card">
          <h2 className="card-title" style={{marginBottom:'1rem'}}>السلف السابقة</h2>
          <div className="table-container">
            <table>
              <thead><tr><th>الموظف</th><th>تاريخ الطلب</th><th>لشهر</th><th>المبلغ</th><th>حذف</th></tr></thead>
              <tbody>
                {advances.slice().sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)).map(adv => (
                  <tr key={adv.id}><td>{employees.find(e=>e.id===adv.employeeId)?.name}</td><td>{adv.date || '-'}</td><td>{adv.month}</td><td>{adv.amount.toLocaleString('en-US')}</td><td><button onClick={()=>handleDelete(adv.id)} className="btn btn-danger" style={{padding:'0.3rem'}}><Trash2 size={16}/></button></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const UploadView = () => {
    const [previewRecords, setPreviewRecords] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleFile = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const rawSheets = await parseExcel(file);
        if (!rawSheets || Object.keys(rawSheets).length === 0) return alert('الملف فارغ أو غير صالح');
        let newRecords = [];
        
        Object.keys(rawSheets).forEach((sheetName, sIndex) => {
          const rows = rawSheets[sheetName];
          let matchedEmp = employees.find(e => e.name.toLowerCase().trim() === sheetName.toLowerCase().trim());

          rows.forEach((row, i) => {
            const keys = Object.keys(row);
            const getVal = (keywords) => { const k = keys.find(key=>keywords.some(kw=>key.toLowerCase().includes(kw))); return k ? row[k] : null; };
            const rowEmpName = getVal(['اسم', 'name', 'employee']);
            
            let finalEmp = matchedEmp;
            if (rowEmpName) {
               finalEmp = employees.find(e => e.name.toLowerCase().trim() === rowEmpName.toString().toLowerCase().trim()) || finalEmp;
            }

            const dateVal = getVal(['تاريخ', 'date', 'يوم']);
            let inVal = getVal(['حضور', 'in', 'start']); 
            let outVal = getVal(['انصراف', 'out', 'end']);
            
            const formatExcelTime = (val) => {
              if (typeof val === 'number') {
                const totalSeconds = Math.round(val * 86400);
                const hrs = Math.floor(totalSeconds / 3600);
                const mins = Math.floor((totalSeconds % 3600) / 60);
                return `${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}`;
              }
              return val ? String(val) : '';
            };

            inVal = formatExcelTime(inVal);
            outVal = formatExcelTime(outVal);

            if (finalEmp && dateVal) {
               const parsedDate = typeof dateVal === 'number' 
                 ? new Date((dateVal - (25567 + 1)) * 86400 * 1000).toISOString().split('T')[0]
                 : String(dateVal);
                 
               const actualOutVal = outVal || settings.workEnd;
               const penaltyHours = calculatePenaltyHours(inVal, actualOutVal, settings.workStart, settings.workEnd);
               
               newRecords.push({
                 id: Date.now() + '-' + i + '-' + sIndex,
                 employeeId: finalEmp.id,
                 empName: finalEmp.name,
                 date: parsedDate,
                 checkIn: inVal,
                 checkOut: outVal,
                 actualCheckOut: actualOutVal,
                 penaltyHours,
                 extraHours: 0,
                 type: 'excel'
               });
            }
          });
        });

        if (newRecords.length > 0) {
          setPreviewRecords(newRecords);
        } else {
          alert('لم يتم العثور على بيانات مطابقة. تأكد من أن أسماء أوراق العمل أو عمود "الاسم" يطابق أسماء الموظفين.');
        }
      } catch (err) { alert('حدث خطأ في قراءة الملف.'); }
      e.target.value = '';
    };

    const updatePreviewRecord = (id, field, value) => {
      setPreviewRecords(prev => prev.map(rec => {
        if (rec.id === id) {
          const updated = { ...rec, [field]: value };
          if (field === 'checkIn' || field === 'checkOut') {
            const actualOutVal = updated.checkOut || settings.workEnd;
            updated.actualCheckOut = actualOutVal;
            updated.penaltyHours = calculatePenaltyHours(updated.checkIn, actualOutVal, settings.workStart, settings.workEnd);
          }
          return updated;
        }
        return rec;
      }));
    };

    const confirmUpload = async () => {
      if(!previewRecords || previewRecords.length === 0) return;
      setIsUploading(true);
      try {
        await Promise.all(previewRecords.map(rec => {
          const { id, empName, actualCheckOut, ...dbData } = rec;
          dbData.checkOut = actualCheckOut;
          dbData.timestamp = Date.now();
          return addDoc(collection(db, 'attendance'), dbData);
        }));
        alert(`تم اعتماد ${previewRecords.length} سجل بنجاح.`);
        setPreviewRecords(null);
      } catch(e) { alert('حدث خطأ في الرفع.'); }
      setIsUploading(false);
    };

    return (
      <div className="animate-fade-in card">
        <div className="card-header"><h2 className="card-title"><FileSpreadsheet /> رفع ملف إكسل</h2></div>
        
        {!previewRecords ? (
          <label className="drop-zone">
            <Upload className="drop-zone-icon" />
            <span style={{fontSize:'1.25rem', fontWeight:'700'}}>اختر ملف للإكسل (معلومة: يمكن استخدام ورقة لكل موظف يحمل اسمه)</span>
            <input type="file" accept=".xlsx, .xls" onChange={handleFile} style={{display:'none'}} />
          </label>
        ) : (
          <div className="preview-container">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem'}}>
              <h3>مراجعة البيانات المستخرجة ({previewRecords.length} سجل)</h3>
              <div style={{display:'flex', gap:'0.5rem'}}>
                <button className="btn btn-secondary" onClick={() => setPreviewRecords(null)}>إلغاء</button>
                <button className="btn btn-primary" onClick={confirmUpload} disabled={isUploading}>{isUploading ? 'جاري الرفع...' : 'حفظ واعتماد'}</button>
              </div>
            </div>
            
            <div className="table-container" style={{maxHeight:'60vh', overflowY:'auto'}}>
              <table>
                <thead style={{position:'sticky', top:0, zIndex:2, backgroundColor:'var(--surface)'}}>
                  <tr><th>الموظف</th><th>التاريخ</th><th>الحضور</th><th>الانصراف</th><th>تأخير (ساعات)</th><th>ملاحظة</th></tr>
                </thead>
                <tbody>
                  {previewRecords.map(rec => (
                    <tr key={rec.id}>
                      <td style={{fontWeight:'bold'}}>{rec.empName}</td>
                      <td><input type="date" value={rec.date} onChange={(e)=>updatePreviewRecord(rec.id, 'date', e.target.value)} style={{width:'auto'}}/></td>
                      <td><input type="time" value={rec.checkIn} onChange={(e)=>updatePreviewRecord(rec.id, 'checkIn', e.target.value)} style={{width:'auto'}}/></td>
                      <td><input type="time" value={rec.checkOut} onChange={(e)=>updatePreviewRecord(rec.id, 'checkOut', e.target.value)} style={{width:'auto'}}/></td>
                      <td style={{color: rec.penaltyHours > 0 ? 'var(--danger)' : ''}}>{rec.penaltyHours}</td>
                      <td style={{color:'var(--text-secondary)', fontSize:'0.8rem'}}>{!rec.checkOut ? `يفترض الساعة ${settings.workEnd}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const SettingsView = () => {
    const [stg, setStg] = useState(settings);
    useEffect(() => { setStg(settings); }, [settings]);
    const handleSave = async (e) => {
      e.preventDefault();
      if (settingsDocId) { await updateDoc(doc(db, 'settings', settingsDocId), stg); alert('تم حفظ الإعدادات سحابياً بنجاح.'); }
    };
    return (
      <div className="animate-fade-in card" style={{maxWidth:'600px'}}>
        <div className="card-header"><h2 className="card-title"><Settings /> الإعدادات العامة</h2></div>
        <form onSubmit={handleSave}>
          <div className="form-group"><label>وقت بداية العمل</label><input type="time" value={stg.workStart} onChange={e=>setStg({...stg, workStart:e.target.value})} required /></div>
          <div className="form-group"><label>وقت الانصراف</label><input type="time" value={stg.workEnd} onChange={e=>setStg({...stg, workEnd:e.target.value})} required /></div>
          <div className="form-group"><label>ساعات العمل اليومية (تعادل يوم إجازة كامل)</label><input type="number" value={stg.hoursPerLeaveDay} onChange={e=>setStg({...stg, hoursPerLeaveDay:parseInt(e.target.value)})} required /></div>
          <div className="form-group"><label>قيمة ساعة العمل الإضافية الواحدة (ل.س)</label><input type="number" value={stg.overtimeRate} onChange={e=>setStg({...stg, overtimeRate:parseFloat(e.target.value)})} required /></div>
          <div className="form-group">
            <label>المظهر (Theme)</label>
            <select value={stg.themeMode || 'dark'} onChange={e=>setStg({...stg, themeMode: e.target.value})}>
              <option value="light">فاتح (Light)</option>
              <option value="dark">داكن (Dark)</option>
              <option value="colorful">ملون (Colorful)</option>
              <option value="apple-glass">آبل جلاس (Apple Glass)</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary" style={{marginTop:'1rem'}}>حفظ الإعدادات</button>
        </form>
      </div>
    );
  };

  // NEW: User Management View
  const UsersView = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [selectedPermissions, setSelectedPermissions] = useState(navItems.map(i => i.id));
    const [editId, setEditId] = useState(null);

    const handleAdd = async (e) => {
      e.preventDefault();
      if (!username.trim() || !password.trim()) return;

      const existingUser = editId ? appUsers.find(u => u.id === editId) : null;
      const data = {
        username: username.trim(),
        password: password.trim(),
        permissions: selectedPermissions,
        role: existingUser ? existingUser.role : 'user'
      };

      if (editId) {
        await updateDoc(doc(db, 'app_users', editId), data);
        // If editing self, update active session state
        if (loggedInUser.id === editId) {
          setLoggedInUser({ ...loggedInUser, ...data });
        }
        setEditId(null);
      } else {
        await addDoc(collection(db, 'app_users'), data);
      }
      setUsername(''); setPassword(''); setSelectedPermissions(navItems.map(i => i.id));
    };

    const handleEdit = (u) => {
      setEditId(u.id);
      setUsername(u.username);
      setPassword(u.password);
      setSelectedPermissions(u.permissions || []);
    };

    const handleDelete = async (id, role, uname) => {
      if (role === 'admin' && uname === 'faez') return alert("لا يمكنك حذف حساب المدير الافتراضي!");
      if(window.confirm('متاكد؟')) {
        await deleteDoc(doc(db, 'app_users', id));
      }
    };

    const togglePermission = (id) => {
      if (selectedPermissions.includes(id)) {
        setSelectedPermissions(selectedPermissions.filter(p => p !== id));
      } else {
        setSelectedPermissions([...selectedPermissions, id]);
      }
    };

    return (
      <div className="animate-fade-in grid-cols-2" style={{display: 'flex', flexDirection: 'column', gap: '2rem'}}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title"><UserCog /> {editId ? 'تعديل مستخدم' : 'إضافة مستخدم للوحة التحكم'}</h2>
          </div>
          <form onSubmit={handleAdd}>
            <div className="grid-cols-2" style={{marginBottom: '1rem'}}>
              <div className="form-group"><label>اسم المستخدم</label><input type="text" value={username} onChange={e=>setUsername(e.target.value)} required /></div>
              <div className="form-group"><label>كلمة المرور</label><input type="text" value={password} onChange={e=>setPassword(e.target.value)} required /></div>
            </div>
            <div className="form-group">
              <label>صلاحيات الوصول للقوائم (اختر المسموح له)</label>
              <div style={{display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem', background:'var(--bg-color)', padding:'1rem', borderRadius:'var(--radius-md)'}}>
                {navItems.map((item) => (
                  <label key={item.id} style={{display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', background:'var(--card-bg)', padding:'0.5rem', borderRadius:'4px', border:'1px solid var(--border)'}}>
                    <input type="checkbox" checked={selectedPermissions.includes(item.id)} onChange={() => togglePermission(item.id)} style={{width: 'auto'}} />
                    <span><item.icon size={14} style={{verticalAlign:'middle'}}/> {item.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{marginTop: '1rem'}}>{editId ? 'حفظ' : 'إضافة مستخدم'}</button>
          </form>
        </div>

        <div className="card">
          <h2 className="card-title" style={{marginBottom: '1rem'}}>المستخدمين الحاليين</h2>
          <div className="table-container">
            <table>
              <thead><tr><th>الاسم</th><th>الرقم السري</th><th>الصلاحيات</th><th>إجراءات</th></tr></thead>
              <tbody>
                {appUsers.map(u => (
                  <tr key={u.id}>
                    <td style={{fontWeight: 'bold', color: u.role === 'admin' ? 'var(--primary)': ''}}>{u.username} {u.role==='admin'?'(مدير)':''}</td>
                    <td>{u.password}</td>
                    <td>{u.permissions?.length === navItems.length ? 'الكل' : (u.permissions?.length || 0) + ' نوافذ'}</td>
                    <td>
                      <button onClick={()=>handleEdit(u)} className="btn btn-secondary" style={{padding:'0.4rem 0.8rem', marginLeft:'0.5rem'}}>تعديل</button>
                      <button onClick={()=>handleDelete(u.id, u.role, u.username)} disabled={u.role === 'admin' && u.username === 'faez'} className="btn btn-danger" style={{padding:'0.4rem 0.8rem', opacity: u.role === 'admin' && u.username === 'faez' ? 0.5 : 1}}>حذف</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }


  const isAccTab = activeTab.startsWith('acc_');

  const renderActiveView = () => {
    // HR views
    switch (activeTab) {
      case 'dashboard':  return <Dashboard />;
      case 'analytics':  return <AnalyticsView />;
      case 'employees':  return <EmployeesView />;
      case 'attendance': return <AttendanceView />;
      case 'records':    return <RecordsView />;
      case 'leaves':     return <LeaveRequestsView />;
      case 'advances':   return <AdvancesView />;
      case 'upload':     return <UploadView />;
      case 'settings':   return <SettingsView />;
      case 'users':      return <UsersView />;
    }
    // Accounting views — all wrapped in AccountingProvider
    const accView = (() => {
      switch (activeTab) {
        case 'acc_dashboard':  return <AccountingDashboard setActiveTab={setActiveTab} />;
        case 'acc_daily':      return <DailyJournal showToast={showToast} />;
        case 'acc_accounts':   return <AccountsView showToast={showToast} />;
        case 'acc_categories': return <CategoriesView showToast={showToast} />;
        case 'acc_parties':    return <CounterpartiesView showToast={showToast} />;
        case 'acc_report':     return <MonthlyReport />;
        case 'acc_import':     return <ImportLegacy showToast={showToast} />;
        case 'acc_fields':     return <CustomFieldsBuilder showToast={showToast} />;
        case 'acc_settings':   return <AccountingSettings showToast={showToast} />;
        default: return null;
      }
    })();
    if (accView) {
      return (
        <AccountingProvider loggedInUser={loggedInUser}>
          {accView}
        </AccountingProvider>
      );
    }
    return null;
  };

  // Filter nav items based on permissions
  const allowedNavItems = navItems.filter(item => 
    loggedInUser?.role === 'admin' || loggedInUser?.permissions?.includes(item.id) || item.id === 'analytics'
  );

  return (
    <>
      <div className="app-container">
      {/* SIDEBAR */}
      <aside 
        className={`sidebar ${isSidebarOpen ? 'expanded' : ''}`}
        onMouseEnter={() => setIsSidebarOpen(true)}
        onMouseLeave={() => setIsSidebarOpen(false)}
      >
        <div className="sidebar-header">
           <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="sidebar-toggle">
              <Menu size={24} />
           </button>
           <span className="sidebar-title">تطبيق HR</span>
        </div>
        
        <nav className="sidebar-nav">
          {/* HR section */}
          {isSidebarOpen && <div style={{padding:'0.4rem 0.75rem',fontSize:'0.7rem',color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:'0.08em',opacity:0.7,marginTop:'0.25rem'}}>الموارد البشرية</div>}
          {allowedNavItems.filter(t=>t.group==='hr').map(tab => {
            const Icon = tab.icon;
            return (
              <div
                key={tab.id}
                className={`sidebar-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={22} />
                <span className="sidebar-label">{tab.label}</span>
              </div>
            );
          })}
          {/* Divider */}
          <div style={{height:'1px',background:'var(--border)',margin:'0.5rem 0.75rem'}} />
          {/* Accounting section */}
          {isSidebarOpen && <div style={{padding:'0.4rem 0.75rem',fontSize:'0.7rem',color:'var(--primary)',textTransform:'uppercase',letterSpacing:'0.08em',opacity:0.9,fontWeight:'700'}}>دفتر اليومية الذكي</div>}
          {allowedNavItems.filter(t=>t.group==='acc').map(tab => {
            const Icon = tab.icon;
            return (
              <div
                key={tab.id}
                className={`sidebar-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={22} />
                <span className="sidebar-label">{tab.label}</span>
              </div>
            );
          })}
        </nav>
        
        <div className="sidebar-footer">
          <div className="sidebar-user" title={loggedInUser.username}>
            <UserCog size={24} />
            <span className="sidebar-label">{loggedInUser.username} {loggedInUser.role === 'admin' ? '(مدير)' : ''}</span>
          </div>
          <button onClick={handleLogout} className="sidebar-nav-item logout-btn">
            <LogOut size={24} /> 
            <span className="sidebar-label">تسجيل خروج</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="main-wrapper">
        <header className="top-header">
          <div className="header-title">
            {isAccTab ? 'دفتر اليومية الذكي' : 'نظام إدارة الموارد البشرية'}
          </div>
          <div style={{display:'flex', alignItems:'center', gap:'1rem'}}>
            {lowLeaveAlerts.length > 0 && (
              <div style={{position:'relative', cursor:'pointer'}} title="تحذير: إجازات منخفضة">
                <Bell size={22} style={{color:'var(--warning)'}}/>
                <span style={{position:'absolute',top:'-6px',left:'-6px',background:'var(--danger)',color:'white',borderRadius:'50%',width:'18px',height:'18px',fontSize:'0.65rem',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:'bold'}}>{lowLeaveAlerts.length}</span>
              </div>
            )}
            <div style={{fontSize:'0.85rem', color:'var(--text-secondary)'}}><UserCog size={16} style={{verticalAlign:'middle', marginLeft:'4px'}}/>{loggedInUser.username}</div>
          </div>
        </header>

        <main className="main-content">
          {renderActiveView()}
        </main>
      </div>
    </div>

    {/* Toast Notifications */}
    <div style={{position:'fixed', bottom:'1.5rem', left:'1.5rem', display:'flex', flexDirection:'column', gap:'0.5rem', zIndex:9999}}>
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === 'success' ? <CheckCircle size={16}/> : <Bell size={16}/>}
          <span>{t.message}</span>
          <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} style={{background:'none',border:'none',cursor:'pointer',color:'inherit',marginRight:'auto'}}><X size={14}/></button>
        </div>
      ))}
    </div>
    </>
  );
}
