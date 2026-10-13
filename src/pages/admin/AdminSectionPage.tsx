import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowRight, Plus, Search, ShieldCheck } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { adminSectionData, type AdminField, type AdminRow, type AdminSectionId } from '../../data/adminMock';
import { AdminFeedback, AdminPageHeader, AdminPanel, AdminStatus } from './shared';
import { AdminSpecialSection } from './AdminSpecialSections';

const specialSections = new Set<AdminSectionId>(['analytics-reports', 'notifications', 'policies-rules', 'waitlists', 'system-settings']);

export function AdminSectionPage() {
  const { section = '' } = useParams();
  const definition = adminSectionData[section as AdminSectionId];
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState<AdminRow[]>(definition?.rows ?? []);
  const [filter, setFilter] = useState('');
  const [notice, setNotice] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  useEffect(() => {
    setRows(definition?.rows ?? []);
    setFilter('');
    setNotice('');
    setEditingId('');
    setFormValues({});
    setFormOpen(searchParams.get('create') === '1');
  }, [section, searchParams]);

  const visibleRows = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => Object.values(row).join(' ').toLowerCase().includes(term));
  }, [rows, filter]);

  if (section === 'search') return <AdminSearchResults />;
  if (!definition) {
    return <section className="admin-page"><AdminPageHeader title="Section not found" description="Choose a valid Admin destination from the sidebar." /><Link className="button button--primary" to="/admin">Return to Dashboard <ArrowRight size={15} /></Link></section>;
  }
  if (specialSections.has(definition.id)) return <AdminSpecialSection sectionId={definition.id} />;

  const beginCreate = () => {
    setEditingId('');
    setFormValues(Object.fromEntries(definition.fields.map((field) => [field.key, ''])));
    setFormOpen(true);
    setNotice('');
  };
  const beginEdit = (row: AdminRow) => {
    setEditingId(row.id);
    setFormValues(Object.fromEntries(definition.fields.map((field) => [field.key, row[field.key] ?? ''])));
    setFormOpen(true);
    setNotice('');
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const saved = { id: editingId || `demo-${Date.now()}`, ...formValues } as AdminRow;
    setRows((current) => editingId ? current.map((row) => row.id === editingId ? saved : row) : [saved, ...current]);
    setNotice(`${definition.title} record ${editingId ? 'updated' : 'added'} in this preview only. No backend data was changed.`);
    setFormOpen(false);
    setEditingId('');
  };

  return (
    <section className="admin-page">
      <AdminPageHeader title={definition.title} description={definition.description} action={definition.canCreate !== false && <button className="button button--primary" type="button" onClick={beginCreate}><Plus size={16} />Add {definition.title.replace(' Management', '').replace(' Management', '')}</button>} />
      {definition.id === 'bookings' && <div className="admin-policy-callout"><ShieldCheck size={18} aria-hidden="true" /><span><strong>Bookings are confirmed by policy—not manual approval.</strong> If availability and configured rules pass, the system confirms automatically. A requester cancellation releases the slot for the queue. Admins monitor outcomes here but cannot approve/reject individual bookings.</span></div>}
      {definition.id === 'audit-logs' && <div className="admin-readonly-note">These rows are illustrative. A tamper-resistant audit trail needs server-side event logging.</div>}

      <AdminPanel title={`${definition.title} records`} action={<label className="admin-table-search"><Search size={15} aria-hidden="true" /><span className="sr-only">Filter {definition.title}</span><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter records…" /></label>}>
        {formOpen && <RecordForm fields={definition.fields} values={formValues} onChange={setFormValues} onSubmit={submit} onCancel={() => { setFormOpen(false); setEditingId(''); }} editing={Boolean(editingId)} />}
        {notice && <AdminFeedback tone="success">{notice}</AdminFeedback>}
        <div className="admin-table-wrap">
          <table className="admin-table"><thead><tr>{definition.columns.map((column) => <th key={column.key} scope="col">{column.label}</th>)}{definition.canEdit !== false && <th scope="col"><span className="sr-only">Actions</span></th>}</tr></thead>
            <tbody>{visibleRows.map((row) => <tr key={row.id}>{definition.columns.map((column) => <td key={column.key}>{column.key === 'status' ? <AdminStatus>{row[column.key]}</AdminStatus> : <span className={column.key === 'id' ? 'admin-mono' : ''}>{row[column.key] || '—'}</span>}</td>)}{definition.canEdit !== false && <td className="admin-table-actions"><button type="button" className="admin-row-action" onClick={() => beginEdit(row)}>Edit</button></td>}</tr>)}
              {visibleRows.length === 0 && <tr><td className="admin-empty-cell" colSpan={definition.columns.length + (definition.canEdit !== false ? 1 : 0)}>No matching records.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="admin-table-footer"><span>Showing {visibleRows.length} of {rows.length} sample records</span><span className="admin-preview-tag">Preview data</span></div>
      </AdminPanel>
    </section>
  );
}

function RecordForm({ fields, values, onChange, onSubmit, onCancel, editing }: { fields: AdminField[]; values: Record<string, string>; onChange: (value: Record<string, string>) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void; editing: boolean }) {
  return <form className="admin-record-form" onSubmit={onSubmit}><div className="admin-record-form-heading"><div><strong>{editing ? 'Edit record' : 'Add a record'}</strong><span>Changes are temporary in this interface preview.</span></div></div><div className="admin-record-fields">{fields.map((field) => <label className="admin-field" key={field.key}><span>{field.label}</span>{field.type === 'select' ? <select required={field.required} value={values[field.key] ?? ''} onChange={(event) => onChange({ ...values, [field.key]: event.target.value })}><option value="">Select {field.label.toLowerCase()}</option>{(field.options ?? []).map((option) => <option key={option}>{option}</option>)}</select> : <input required={field.required} type={field.type} min={field.type === 'number' ? 0 : undefined} value={values[field.key] ?? ''} onChange={(event) => onChange({ ...values, [field.key]: event.target.value })} />}</label>)}</div><div className="admin-form-actions"><button className="button button--outline button--small" type="button" onClick={onCancel}>Cancel</button><button className="button button--primary button--small" type="submit">{editing ? 'Save demo changes' : 'Add demo record'}</button></div></form>;
}

function AdminSearchResults() {
  const [searchParams] = useSearchParams();
  const query = (searchParams.get('q') ?? '').trim();
  const results = query ? Object.values(adminSectionData).flatMap((definition) => definition.rows.filter((row) => Object.values(row).join(' ').toLowerCase().includes(query.toLowerCase())).map((row) => ({ section: definition.id, title: definition.title, row }))) : [];
  return <section className="admin-page"><AdminPageHeader title="Search results" description={query ? `Records matching “${query}” across the Admin preview.` : 'Enter a name, event, venue, or status in the search bar.'} eyebrow="ADMIN SEARCH" />
    <AdminPanel title={`${results.length} matching sample ${results.length === 1 ? 'record' : 'records'}`}>
      {results.length ? <ul className="admin-search-results">{results.map(({ section, title, row }) => <li key={`${section}-${row.id}`}><span className="admin-search-result-icon"><Search size={15} /></span><span><strong>{row.name || row.item || row.venue || row.participant || row.asset || row.id}</strong><small>{title} · {Object.entries(row).filter(([key]) => key !== 'id').map(([key, value]) => `${key}: ${value}`).slice(0, 2).join(' · ')}</small></span><Link to={`/admin/${section}`} aria-label={`Open ${title}`}><ArrowRight size={16} /></Link></li>)}</ul> : <p className="admin-empty-state">No sample records match this search.</p>}
    </AdminPanel>
  </section>;
}
