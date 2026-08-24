'use client';

import React, { useState } from 'react';
import PipelineStatusSelector from './PipelineStatusSelector';

interface SavedItem {
  id: string;
  opportunity_id?: string;
  created_at: string;
  status?: string;
  opportunity?: {
    id: string;
    title: string;
    deadline?: string;
    source_url?: string;
    link?: string;
    link_url?: string;
    url?: string;
  };
}

interface FollowUpAlertsProps {
  savedItems: SavedItem[];
}

export default function FollowUpAlerts({ savedItems }: FollowUpAlertsProps) {
  const [items, setItems] = useState<SavedItem[]>(savedItems);

  if (!items || items.length === 0) return null;

  const now = new Date();
  const alerts: { id: string; text: string; type: 'warning' | 'info' | 'success' }[] = [];

  items.forEach((item) => {
    const title = item.opportunity?.title || 'Збережена можливість';
    const deadlineStr = item.opportunity?.deadline;
    const createdAt = new Date(item.created_at);
    const diffDaysFromSave = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 3600 * 24));

    if (deadlineStr) {
      const deadline = new Date(deadlineStr);
      const diffDaysToDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 3600 * 24));

      if (diffDaysToDeadline <= 1 && diffDaysToDeadline >= 0) {
        alerts.push({
          id: item.id,
          text: `Дедлайн завтра для «${title}». Заявка ще не позначена як подана.`,
          type: 'warning',
        });
      } else if (diffDaysToDeadline <= 3 && diffDaysToDeadline > 1) {
        alerts.push({
          id: item.id,
          text: `Ви зберегли «${title}» ${diffDaysFromSave} днів тому. Дедлайн через ${diffDaysToDeadline} дні — час переходити до подачі.`,
          type: 'info',
        });
      }
    }
  });

  return (
    <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Секція мікросповіщень */}
      {alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {alerts.map((alert) => (
            <div
              key={alert.id}
              style={{
                backgroundColor: alert.type === 'warning' ? '#451a03' : '#1e293b',
                border: `1px solid ${alert.type === 'warning' ? '#b45309' : '#334155'}`,
                borderRadius: '12px',
                padding: '12px 16px',
                color: '#f8fafc',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <span style={{ fontSize: '18px' }}>{alert.type === 'warning' ? '⚠️' : '💡'}</span>
              <div style={{ flex: 1, lineHeight: '1.4' }}>{alert.text}</div>
            </div>
          ))}
        </div>
      )}

      {/* Секція трекінгу воронки (Pipeline) */}
      <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 16 }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600, color: '#f8fafc' }}>
          📌 Трекінг заявок (Pipeline)
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '350px', overflowY: 'auto' }}>
          {items.map((item) => {
            const opp = item.opportunity;
            if (!opp) return null;

            const linkTarget = opp.source_url || opp.link || opp.link_url || opp.url || '#';

            return (
              <div 
                key={item.id} 
                style={{ 
                  backgroundColor: '#0f172a', 
                  border: '1px solid #334155', 
                  borderRadius: 12, 
                  padding: 12 
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <a 
                    href={linkTarget} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ fontSize: '14px', fontWeight: 600, color: '#60a5fa', textDecoration: 'none', lineHeight: '1.3' }}
                  >
                    {opp.title}
                  </a>
                  {opp.deadline && (
                    <span style={{ fontSize: '11px', color: '#cbd5e1', backgroundColor: '#334155', padding: '2px 6px', borderRadius: 6, whiteSpace: 'nowrap' }}>
                      до {new Date(opp.deadline).toLocaleDateString()}
                    </span>
                  )}
                </div>

                <PipelineStatusSelector 
                  savedId={item.id} 
                  currentStatus={item.status || 'INTERESTED'} 
                  onStatusChange={(newStatus) => {
                    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: newStatus } : i));
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
