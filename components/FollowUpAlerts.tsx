'use client';

import React from 'react';

interface SavedItem {
  id: string;
  opportunity_id?: string;
  created_at: string;
  status?: string;
  opportunity?: {
    title: string;
    deadline?: string;
  };
}

interface FollowUpAlertsProps {
  savedItems: SavedItem[];
}

export default function FollowUpAlerts({ savedItems }: FollowUpAlertsProps) {
  if (!savedItems || savedItems.length === 0) return null;

  const now = new Date();

  const alerts: { id: string; text: string; type: 'warning' | 'info' | 'success' }[] = [];

  savedItems.forEach((item) => {
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

  if (alerts.length === 0) return null;

  return (
    <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
  );
}
