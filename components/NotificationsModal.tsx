'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export interface NotificationItem {
  id: string;
  title: string;
  message?: string;
  description?: string;
  raw_description?: string;
  created_at: string;
  link_url?: string | null;
  source_url?: string | null;
  link?: string | null;
  url?: string | null;
  is_read?: boolean;
}

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  title?: string;
}

export default function NotificationsModal({
  isOpen,
  onClose,
  notifications,
  title = 'Знайдені можливості',
}: NotificationsModalProps) {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      
      const fetchBookmarks = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);

        const { data, error } = await supabase
          .from('saved_opportunities')
          .select('opportunity_id')
          .eq('user_id', user.id);

        if (!error && data) {
          setSavedIds(new Set(data.map((item: any) => item.opportunity_id)));
        }
      };

      fetchBookmarks();
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleBookmark = async (opportunityId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userId) return;

    const newSavedIds = new Set(savedIds);
    if (newSavedIds.has(opportunityId)) {
      newSavedIds.delete(opportunityId);
      setSavedIds(newSavedIds);

      await supabase
        .from('saved_opportunities')
        .delete()
        .match({ user_id: userId, opportunity_id: opportunityId });
    } else {
      newSavedIds.add(opportunityId);
      setSavedIds(newSavedIds);

      await supabase
        .from('saved_opportunities')
        .insert({ user_id: userId, opportunity_id: opportunityId });
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#1a1d2d',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid #334155',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid #334155',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>
            {title} ({notifications?.length || 0})
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            ×
          </button>
        </div>

        {/* Список */}
        <div
          style={{
            padding: '16px',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {notifications && notifications.length > 0 ? (
            notifications.map((item) => {
              const targetUrl = item.source_url || item.link || item.link_url || item.url;
              const contentText = item.message || item.description || item.raw_description || '';
              const isSaved = savedIds.has(item.id);

              return (
                <div
                  key={item.id}
                  style={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    padding: '14px',
                    marginBottom: '12px',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: '600', color: '#fff', flex: 1 }}>
                      {item.title}
                    </h3>
                    <button
                      onClick={(e) => toggleBookmark(item.id, e)}
                      title={isSaved ? "Видалити із закладок" : "Зберегти в закладки"}
                      style={{
                        background: isSaved ? '#2563eb' : '#334155',
                        border: 'none',
                        borderRadius: '8px',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '14px',
                        flexShrink: 0,
                      }}
                    >
                      {isSaved ? '🔖' : '🤍'}
                    </button>
                  </div>

                  {contentText && (
                    <p
                      style={{
                        margin: '0 0 10px 0',
                        fontSize: '13px',
                        color: '#94a3b8',
                        lineHeight: '1.4',
                      }}
                    >
                      {contentText.length > 150 ? contentText.substring(0, 150) + '...' : contentText}
                    </p>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '12px',
                      color: '#64748b',
                    }}
                  >
                    <span>{formatDate(item.created_at)}</span>
                    {targetUrl ? (
                      <a
                        href={targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: '500' }}
                      >
                        Перейти →
                      </a>
                    ) : (
                      <span style={{ color: '#64748b' }}>Немає посилання</span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
              Немає можливостей
            </div>
          )}
        </div>

        {/* Кнопка закрити */}
        <div style={{ padding: '16px', borderTop: '1px solid #334155' }}>
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#334155',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '15px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
}
