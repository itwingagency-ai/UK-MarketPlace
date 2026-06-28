import { useState, useEffect } from 'react';
import { adminService } from '../../api/adminService';
import { PageHeader, DataTable, StatusBadge, Modal } from '../../components/common';
import { formatDate } from '../../utils/formatters';
import { Bell, Edit2, Mail, MessageSquare, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState('templates'); // 'templates' | 'log'
  
  // Templates state
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Log state
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logPage, setLogPage] = useState(1);
  const [logTotal, setLogTotal] = useState(0);

  const fetchTemplates = async () => {
    try {
      setTemplatesLoading(true);
      const res = await adminService.getNotificationTemplates();
      setTemplates(res.data || []);
    } catch (err) {
      toast.error('Failed to fetch templates');
    } finally {
      setTemplatesLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      setLogsLoading(true);
      const res = await adminService.getNotificationLog({ page: logPage, limit: 20 });
      setLogs(res.data || []);
      setLogTotal(res.total || 0);
    } catch (err) {
      toast.error('Failed to fetch notification logs');
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'templates') {
      fetchTemplates();
    } else {
      fetchLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, logPage]);

  const handleEditTemplate = (template) => {
    setEditingTemplate({
      eventType: template.eventType,
      channel: template.channel,
      subject: template.subject || '',
      body: template.body || '',
      isActive: template.isActive !== false,
    });
  };

  const handleSaveTemplate = async () => {
    try {
      setSavingTemplate(true);
      await adminService.upsertNotificationTemplate(
        editingTemplate.eventType, 
        editingTemplate.channel, 
        {
          subject: editingTemplate.subject,
          body: editingTemplate.body,
          isActive: editingTemplate.isActive
        }
      );
      toast.success('Template updated successfully');
      setEditingTemplate(null);
      fetchTemplates();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update template');
    } finally {
      setSavingTemplate(false);
    }
  };

  const templateColumns = [
    {
      key: 'eventType',
      label: 'Event Type',
      render: (v) => <strong style={{ color: 'var(--gray-900)' }}>{v}</strong>,
    },
    {
      key: 'channel',
      label: 'Channel',
      render: (v) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          {v === 'email' ? <Mail size={14} /> : <MessageSquare size={14} />}
          <span style={{ textTransform: 'capitalize' }}>{v}</span>
        </span>
      ),
    },
    {
      key: 'subject',
      label: 'Subject',
      render: (v) => v || '—',
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (v) => (
        <StatusBadge status={v ? 'active' : 'inactive'} />
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: 100,
      render: (_, row) => (
        <button className="btn btn-ghost btn-sm" onClick={() => handleEditTemplate(row)}>
          <Edit2 size={14} /> Edit
        </button>
      ),
    },
  ];

  const logColumns = [
    {
      key: 'createdAt',
      label: 'Date',
      render: (v) => <span style={{ fontSize: 'var(--text-sm)' }}>{formatDate(v)}</span>,
    },
    {
      key: 'recipient',
      label: 'Recipient',
      render: (v, row) => (
        <div>
          <div>{row.user?.name || 'Unknown User'}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            {row.to || row.user?.email}
          </div>
        </div>
      ),
    },
    {
      key: 'eventType',
      label: 'Event Type',
      render: (v) => <span className="badge badge-neutral">{v}</span>,
    },
    {
      key: 'channel',
      label: 'Channel',
      render: (v) => <span style={{ textTransform: 'capitalize' }}>{v}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => <StatusBadge status={v} size="sm" />,
    },
  ];

  return (
    <div className="page-content animate-fade-in">
      <PageHeader
        title="Notifications"
        subtitle="Manage event templates and view delivery logs"
      />

      <div className="card">
        <div style={{ borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 'var(--space-4)', padding: 'var(--space-2) var(--space-4)' }}>
          <button
            className={`btn btn-ghost ${activeTab === 'templates' ? 'active' : ''}`}
            onClick={() => setActiveTab('templates')}
            style={activeTab === 'templates' ? { color: 'var(--primary-color)', borderBottom: '2px solid var(--primary-color)', borderRadius: 0 } : { borderRadius: 0 }}
          >
            Templates
          </button>
          <button
            className={`btn btn-ghost ${activeTab === 'log' ? 'active' : ''}`}
            onClick={() => setActiveTab('log')}
            style={activeTab === 'log' ? { color: 'var(--primary-color)', borderBottom: '2px solid var(--primary-color)', borderRadius: 0 } : { borderRadius: 0 }}
          >
            Delivery Log
          </button>
        </div>

        {activeTab === 'templates' ? (
          <DataTable
            columns={templateColumns}
            data={templates}
            loading={templatesLoading}
            rowKey={(r) => `${r.eventType}-${r.channel}`}
            emptyIcon={<Bell />}
            emptyTitle="No Templates Found"
            emptyText="No notification templates are configured."
          />
        ) : (
          <DataTable
            columns={logColumns}
            data={logs}
            loading={logsLoading}
            totalItems={logTotal}
            page={logPage}
            pageSize={20}
            onPageChange={setLogPage}
            rowKey="_id"
            emptyIcon={<Bell />}
            emptyTitle="No Logs Found"
            emptyText="No notifications have been sent yet."
          />
        )}
      </div>

      <Modal
        isOpen={!!editingTemplate}
        onClose={() => setEditingTemplate(null)}
        title="Edit Notification Template"
        width="600px"
      >
        {editingTemplate && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
              <div>
                <strong>Event:</strong> <span className="badge badge-neutral">{editingTemplate.eventType}</span>
              </div>
              <div>
                <strong>Channel:</strong> <span style={{ textTransform: 'capitalize' }}>{editingTemplate.channel}</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Subject</label>
              <input
                type="text"
                className="form-input"
                value={editingTemplate.subject}
                onChange={(e) => setEditingTemplate(p => ({ ...p, subject: e.target.value }))}
                placeholder="Template subject..."
                disabled={editingTemplate.channel === 'sms' || editingTemplate.channel === 'push'}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Body Template</label>
              <textarea
                className="form-input"
                value={editingTemplate.body}
                onChange={(e) => setEditingTemplate(p => ({ ...p, body: e.target.value }))}
                placeholder="Hello {{name}}, your order {{orderNumber}}..."
                rows={6}
              />
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
                Use handlebars syntax like <code>{`{{variable}}`}</code> for dynamic content.
              </p>
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <input
                type="checkbox"
                id="isActive"
                checked={editingTemplate.isActive}
                onChange={(e) => setEditingTemplate(p => ({ ...p, isActive: e.target.checked }))}
                style={{ width: 16, height: 16 }}
              />
              <label htmlFor="isActive" style={{ fontWeight: 500, cursor: 'pointer' }}>Active</label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
              <button className="btn btn-ghost" onClick={() => setEditingTemplate(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveTemplate} disabled={savingTemplate}>
                {savingTemplate ? 'Saving...' : <><Save size={16} /> Save Template</>}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
