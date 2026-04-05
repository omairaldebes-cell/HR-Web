import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { listen, seedIfEmpty, COLL } from '../accountingService';
import {
  SEED_INCOME_CATEGORIES, SEED_EXPENSE_CATEGORIES, SEED_ACCOUNTS,
  CATEGORY_TYPES, ACCOUNT_TYPES
} from '../constants';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';

const AccountingContext = createContext(null);

export const useAccounting = () => {
  const ctx = useContext(AccountingContext);
  if (!ctx) throw new Error('useAccounting must be used inside AccountingProvider');
  return ctx;
};

export function AccountingProvider({ children, loggedInUser }) {
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [counterparties, setCounterparties] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  // Seed on first load
  useEffect(() => {
    const runSeed = async () => {
      // ---- Company defaults ----
      const compRef = doc(db, COLL.COMPANY, 'default');
      const compSnap = await getDoc(compRef);
      if (!compSnap.exists()) {
        await setDoc(compRef, {
          name_ar: 'دفتر اليومية الذكي',
          name_en: 'Smart Daily Accounting',
          currency: 'ل.س',
          decimal_places: 0,
          fiscal_year_start_month: 1,
          created_at: Date.now(),
        });
      }

      // ---- Seed Accounts ----
      await seedIfEmpty(COLL.ACCOUNTS, SEED_ACCOUNTS, (a) => ({
        name_ar: a.name_ar,
        name_en: '',
        account_type: a.type || 'CASH',
        is_active: true,
        is_main: a.is_main || false,
        opening_balance: 0,
        normal_balance_direction: a.type === 'EXPENSE_BUCKET' ? 'صادر' : 'وارد',
        notes: '',
      }));

      // ---- Seed Categories ----
      await seedIfEmpty(COLL.CATEGORIES,
        [
          ...SEED_INCOME_CATEGORIES.map(n => ({ name_ar: n, type: 'INCOME', direction: 'وارد' })),
          ...SEED_EXPENSE_CATEGORIES.map(n => ({ name_ar: n, type: 'EXPENSE', direction: 'صادر' })),
        ],
        (c) => ({
          name_ar: c.name_ar,
          name_en: '',
          category_type: c.type,
          default_direction: c.direction,
          is_active: true,
          parent_category_id: null,
          color: c.type === 'INCOME' ? '#10b981' : '#ef4444',
        })
      );
    };

    runSeed().catch(console.error);
  }, []);

  // Real-time listeners
  useEffect(() => {
    const unsubs = [
      listen(COLL.ACCOUNTS, setAccounts),
      listen(COLL.CATEGORIES, setCategories),
      listen(COLL.COUNTERPARTIES, setCounterparties),
      listen(COLL.CUSTOM_FIELDS, setCustomFields),
      listen(COLL.TEMPLATES, setTemplates),
      listen(COLL.TRANSACTIONS, setTransactions),
      listen(COLL.PERIODS, setPeriods),
      onSnapshot(doc(db, COLL.COMPANY, 'default'), snap => {
        if (snap.exists()) setCompany({ id: snap.id, ...snap.data() });
      }),
    ];
    setLoading(false);
    return () => unsubs.forEach(u => u());
  }, []);

  // Derived computed balance per account
  const getAccountBalance = useCallback((accountId) => {
    const acc = accounts.find(a => a.id === accountId);
    let balance = acc ? (Number(acc.opening_balance) || 0) : 0;

    transactions.filter(tx => tx.status === 'مرحّل').forEach(tx => {
      if (tx.direction !== 'تحويل' && tx.main_account_id === accountId) {
        balance += tx.direction === 'وارد' ? (tx.amount || 0) : -(tx.amount || 0);
      } else if (tx.direction === 'تحويل') {
        if (tx.source_account_id === accountId) balance -= (tx.amount || 0);
        if (tx.destination_account_id === accountId) balance += (tx.amount || 0);
      }
    });

    return balance;
  }, [transactions, accounts]);

  // Running balance for a sorted list of transactions
  const calculateRunningBalance = useCallback((sortedTxs, openingBalance = 0, specificAccountId = null) => {
    let balance = Number(openingBalance) || 0;
    return sortedTxs.map(tx => {
      let change = 0;
      if (tx.direction !== 'تحويل') {
        change = tx.direction === 'وارد' ? (tx.amount || 0) : -(tx.amount || 0);
      } else {
        // If we are filtering by a specific account, only affect the balance if it's the source or target
        if (specificAccountId) {
          if (tx.source_account_id === specificAccountId) change = -(tx.amount || 0);
          if (tx.destination_account_id === specificAccountId) change = (tx.amount || 0);
        } else {
          // Without a specific account filter, a transfer is mathematically 0 net globally
          change = 0;
        }
      }
      balance += change;
      return { ...tx, running_balance: balance };
    });
  }, []);

  // Month totals
  const getMonthSummary = useCallback((yearMonth) => {
    const monthTxs = transactions.filter(tx =>
      tx.transaction_date && tx.transaction_date.startsWith(yearMonth) && tx.status === 'مرحّل'
    );
    const totalIn  = monthTxs.filter(t => t.direction === 'وارد').reduce((s, t) => s + (t.amount || 0), 0);
    const totalOut = monthTxs.filter(t => t.direction === 'صادر').reduce((s, t) => s + (t.amount || 0), 0);
    return { totalIn, totalOut, net: totalIn - totalOut, count: monthTxs.length };
  }, [transactions]);

  return (
    <AccountingContext.Provider value={{
      // Data
      accounts, categories, counterparties, customFields, templates,
      transactions, periods, company, loading, loggedInUser,
      // Computed
      getAccountBalance, calculateRunningBalance, getMonthSummary,
      // Convenience checks
      isAdmin: loggedInUser?.role === 'admin',
      canWrite: loggedInUser?.role === 'admin' || loggedInUser?.acc_permissions?.includes('write'),
      canDelete: loggedInUser?.role === 'admin' || loggedInUser?.acc_permissions?.includes('delete'),
      canRead: loggedInUser?.role === 'admin' || loggedInUser?.acc_permissions?.includes('read'),
    }}>
      {children}
    </AccountingContext.Provider>
  );
}
