// ==========================================
// دفتر اليومية الذكي — Firebase Service Layer
// ==========================================
import { db } from '../firebase';
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, getDoc, getDocs, query, where,
  orderBy, serverTimestamp, writeBatch, setDoc
} from 'firebase/firestore';

// ---- COLLECTIONS ----
export const COLL = {
  ACCOUNTS:         'accounting_accounts',
  CATEGORIES:       'accounting_categories',
  COUNTERPARTIES:   'accounting_counterparties',
  CUSTOM_FIELDS:    'accounting_custom_fields',
  TEMPLATES:        'accounting_templates',
  TRANSACTIONS:     'accounting_transactions',
  TX_LINES:         'accounting_transaction_lines',
  TX_CUSTOM_VALUES: 'accounting_tx_custom_values',
  PERIODS:          'accounting_periods',
  AUDIT_LOG:        'accounting_audit_log',
  COMPANY:          'accounting_company',
  SETTINGS:         'accounting_settings',
};

// ---- GENERIC CRUD ----
export const listen = (collectionName, callback, constraints = []) => {
  const q = constraints.length
    ? query(collection(db, collectionName), ...constraints)
    : collection(db, collectionName);
  return onSnapshot(q, snap =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );
};

export const create = async (collectionName, data) => {
  const ref = await addDoc(collection(db, collectionName), {
    ...data,
    created_at: Date.now(),
    updated_at: Date.now(),
  });
  return ref.id;
};

export const update = async (collectionName, id, data) => {
  await updateDoc(doc(db, collectionName, id), {
    ...data,
    updated_at: Date.now(),
  });
};

export const remove = async (collectionName, id) => {
  await deleteDoc(doc(db, collectionName, id));
};

export const getAll = async (collectionName) => {
  const snap = await getDocs(collection(db, collectionName));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// ---- ACCOUNTS ----
export const createAccount = (data, user) =>
  create(COLL.ACCOUNTS, { ...data, created_by: user });

export const updateAccount = (id, data) =>
  update(COLL.ACCOUNTS, id, data);

export const deleteAccount = (id) =>
  remove(COLL.ACCOUNTS, id);

// ---- CATEGORIES ----
export const createCategory = (data, user) =>
  create(COLL.CATEGORIES, { ...data, is_active: true, created_by: user });

export const updateCategory = (id, data) =>
  update(COLL.CATEGORIES, id, data);

export const archiveCategory = (id) =>
  update(COLL.CATEGORIES, id, { is_active: false });

// ---- COUNTERPARTIES ----
export const createCounterparty = (data, user) =>
  create(COLL.COUNTERPARTIES, { ...data, created_by: user });

// ---- CUSTOM FIELDS ----
export const createCustomField = (data, user) =>
  create(COLL.CUSTOM_FIELDS, { ...data, created_by: user });

// ---- TEMPLATES ----
export const createTemplate = (data, user) =>
  create(COLL.TEMPLATES, { ...data, created_by: user });

// ---- TRANSACTIONS ----
export const generateTransactionNo = async () => {
  const snap = await getDocs(collection(db, COLL.TRANSACTIONS));
  const count = snap.size + 1;
  return `TXN-${new Date().getFullYear()}-${String(count).padStart(5, '0')}`;
};

export const createTransaction = async (data, user) => {
  const tx_no = await generateTransactionNo();
  const id = await create(COLL.TRANSACTIONS, {
    ...data,
    transaction_no: tx_no,
    status: 'مرحّل',
    created_by: user,
    is_imported: false,
  });

  // Write audit log
  await writeAuditLog({
    action: 'create',
    collection: COLL.TRANSACTIONS,
    document_id: id,
    data_snapshot: { tx_no, ...data },
    user,
  });

  return id;
};

export const updateTransaction = async (id, data, user) => {
  const before = await getDoc(doc(db, COLL.TRANSACTIONS, id));
  await update(COLL.TRANSACTIONS, id, data);
  await writeAuditLog({
    action: 'update',
    collection: COLL.TRANSACTIONS,
    document_id: id,
    data_before: before.data(),
    data_after: data,
    user,
  });
};

export const deleteTransaction = async (id, user) => {
  const before = await getDoc(doc(db, COLL.TRANSACTIONS, id));
  await remove(COLL.TRANSACTIONS, id);
  await writeAuditLog({
    action: 'delete',
    collection: COLL.TRANSACTIONS,
    document_id: id,
    data_before: before.data(),
    user,
  });
};

// ---- PERIODS ----
export const getOrCreatePeriod = async (year, month) => {
  const periodId = `${year}-${String(month).padStart(2, '0')}`;
  const ref = doc(db, COLL.PERIODS, periodId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      year,
      month,
      period_id: periodId,
      is_closed: false,
      opening_balance: 0,
      closing_balance: 0,
      created_at: Date.now(),
    });
  }
  return periodId;
};

// ---- AUDIT LOG ----
export const writeAuditLog = (data) =>
  addDoc(collection(db, COLL.AUDIT_LOG), {
    ...data,
    timestamp: Date.now(),
  });

// ---- SEED DATA ----
export const seedIfEmpty = async (collectionName, items, mapFn) => {
  const snap = await getDocs(collection(db, collectionName));
  if (snap.empty) {
    const batch = writeBatch(db);
    items.forEach(item => {
      const ref = doc(collection(db, collectionName));
      batch.set(ref, { ...mapFn(item), created_at: Date.now(), updated_at: Date.now() });
    });
    await batch.commit();
    return true;
  }
  return false;
};
