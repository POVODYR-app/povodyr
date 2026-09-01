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
  matchScore?: number;
  matchReasons?: string[];
  recommendedAction?: string;
}

const PIPELINE_STATUSES = ['FOUND', 'INTERESTED', 'PREPARING', 'SUBMITTED', 'WAITING', 'SELECTED', 'REJECTED'];

function isPipelineApplicationStatus(status: unknown): boolean {
  const key = String(status || '').trim().toUpperCase();
  return PIPELINE_STATUSES.indexOf(key) !== -1;
}

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  title?: string;
  onTrackedApplication?: () => void;
}

export default function NotificationsModal({
  isOpen,
  onClose,
  notifications,
  title = 'Центр можливостей',
  onTrackedApplication,
}: NotificationsModalProps) {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profileSnapshot, setProfileSnapshot] = useState<any>(null);

  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generatedText, setGeneratedText] = useState<{ [key: string]: string }>({});
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [trackedIds, setTrackedIds] = useState<Set<string>>(new Set());
  const [addingTrackerId, setAddingTrackerId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';

      const fetchData = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);
        setUserEmail(user.email || null);

        const { data, error } = await supabase
          .from('saved_opportunities')
          .select('opportunity_id, status')
          .eq('user_id', user.id);

        if (!error && data) {
          setSavedIds(new Set(data.map((item: any) => item.opportunity_id).filter(Boolean)));
          setTrackedIds(new Set(
            data
              .filter((item: any) => item.opportunity_id && isPipelineApplicationStatus(item.status))
              .map((item: any) => item.opportunity_id)
          ));
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, bio, artist_level, profile_techniques, techniques, search_countries, city, country')
          .eq('id', user.id)
          .maybeSingle();

        const { data: works } = await supabase
          .from('artist_artworks')
          .select('title, styles, techniques_list, techniques, materials, themes, work_types, format_size, size_category')
          .eq('user_id', user.id)
          .limit(8);

        setProfileSnapshot({
          full_name: profile?.full_name || '',
          bio: profile?.bio || '',
          artist_level: profile?.artist_level || '',
          profile_techniques: profile?.profile_techniques || profile?.techniques || [],
          techniques: profile?.techniques || profile?.profile_techniques || [],
          search_countries: profile?.search_countries || [],
          city: profile?.city || '',
          country: profile?.country || '',
          artworks: works || [],
        });
      };

      fetchData();
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

  const handleAddToApplications = async (opportunityId: string) => {
    if (!userId || !opportunityId) return;
    setAddingTrackerId(opportunityId);
    try {
      const { data: existing, error: existingError } = await supabase
        .from('saved_opportunities')
        .select('id, status')
        .eq('user_id', userId)
        .eq('opportunity_id', opportunityId)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (existing?.id) {
        const { error: updateError } = await supabase
          .from('saved_opportunities')
          .update({ status: 'SUBMITTED' })
          .eq('id', existing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('saved_opportunities')
          .insert({
            user_id: userId,
            opportunity_id: opportunityId,
            status: 'SUBMITTED',
          });
        if (insertError) throw insertError;
      }

      const nextSaved = new Set(savedIds);
      nextSaved.add(opportunityId);
      setSavedIds(nextSaved);

      const nextTracked = new Set(trackedIds);
      nextTracked.add(opportunityId);
      setTrackedIds(nextTracked);

      if (onTrackedApplication) onTrackedApplication();
    } catch (err) {
      console.error(err);
      alert('Не вдалося додати заявку в трекер');
    } finally {
      setAddingTrackerId(null);
    }
  };

  const handleGenerateApplication = async (item: NotificationItem) => {
    setGeneratingId(item.id);
    try {
      const response = await fetch('/api/generate-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: item.id,
          opportunityTitle: item.title,
          opportunityDescription: item.message || item.description || item.raw_description || '',
          matchReasons: item.matchReasons || [],
          userId: userId,
          profileSnapshot: profileSnapshot,
          isCommercial: false,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setGeneratedText((prev) => ({
          ...prev,
          [item.id]: data.text || 'Згенеровано успішно.',
        }));
      } else {
        alert(data.error || 'Помилка генерації заявки');
      }
    } catch (err) {
      console.error(err);
      alert('Помилка підключення до сервера');
    } finally {
      setGeneratingId(null);
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Пакет документів скопійовано до буфера обміну!');
  };

  const handleDownloadTxt = (title: string, text: string) => {
    const element = document.createElement('a');
    const file = new Blob([text], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `Заявка_${title.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleSendToEmail = async (opportunityTitle: string, text: string) => {
    if (!userEmail) {
      alert('Не вдалося визначити пошту користувача.');
      return;
    }

    setSendingEmailId(opportunityTitle);
    try {
      const response = await fetch('/api/send-document-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          subject: `Пакет документів: ${opportunityTitle}`,
          content: text,
        }),
      });

      if (response.ok) {
        alert(`Пакет документів успішно надіслано на пошту: ${userEmail}`);
      } else {
        alert('Не вдалося надіслати лист через сервер.');
      }
    } catch (err) {
      console.error(err);
      alert('Помилка при відправці на пошту');
    } finally {
      setSendingEmailId(null);
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
          maxWidth: '560px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid #334155',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
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

        <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
          {notifications && notifications.length > 0 ? (
            notifications.map((item) => {
              const targetUrl = item.source_url || item.link || item.link_url || item.url;
              const contentText = item.message || item.description || item.raw_description || '';
              const isSaved = savedIds.has(item.id);
              const isGenerating = generatingId === item.id;
              const currentResult = generatedText[item.id];

              return (
                <div
                  key={item.id}
                  style={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    padding: '14px',
                    marginBottom: '16px',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#fff', flex: 1 }}>
                      {item.title}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
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
                        }}
                      >
                        {isSaved ? '🔖' : '🤍'}
                      </button>
                    </div>
                  </div>

                  {contentText && (
                    <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#94a3b8', lineHeight: '1.4' }}>
                      {contentText.length > 180 ? contentText.substring(0, 180) + '...' : contentText}
                    </p>
                  )}

                  <div style={{ margin: '12px 0 8px 0' }}>
                    <button
                      onClick={() => handleGenerateApplication(item)}
                      disabled={isGenerating}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        backgroundColor: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: isGenerating ? 'not-allowed' : 'pointer',
                        opacity: isGenerating ? 0.7 : 1,
                      }}
                    >
                      {isGenerating ? '⏳ Генерую пакет документів...' : '✨ Згенерувати пакет документів'}
                    </button>
                  </div>

                  {currentResult && (
                    <div
                      style={{
                        marginTop: '10px',
                        backgroundColor: '#1e293b',
                        border: '1px solid #3b82f6',
                        borderRadius: '8px',
                        padding: '12px',
                      }}
                    >
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#93c5fd', marginBottom: '8px' }}>
                        Готовий пакет документів (можна редагувати):
                      </div>

                      <textarea
                        value={currentResult}
                        onChange={(e) => {
                          const value = e.target.value;
                          setGeneratedText((prev) => ({
                            ...prev,
                            [item.id]: value,
                          }));
                        }}
                        style={{
                          width: '100%',
                          minHeight: '180px',
                          fontSize: '12px',
                          color: '#e2e8f0',
                          lineHeight: '1.4',
                          backgroundColor: '#0f172a',
                          padding: '10px',
                          borderRadius: '6px',
                          border: '1px solid #334155',
                          marginBottom: '10px',
                          resize: 'vertical',
                          boxSizing: 'border-box',
                          outline: 'none',
                          fontFamily: 'inherit',
                        }}
                      />

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => handleCopyText(currentResult)}
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            backgroundColor: '#334155',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '500',
                            cursor: 'pointer',
                          }}
                        >
                          📋 Копіювати текст
                        </button>
                        <button
                          onClick={() => handleDownloadTxt(item.title, currentResult)}
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            backgroundColor: '#334155',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '500',
                            cursor: 'pointer',
                          }}
                        >
                          💾 Завантажити (.txt)
                        </button>
                        <button
                          onClick={() => handleSendToEmail(item.title, currentResult)}
                          disabled={sendingEmailId === item.title}
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            backgroundColor: '#047857',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '500',
                            cursor: 'pointer',
                          }}
                        >
                          ✉️ На пошту
                        </button>
                        <button
                          onClick={() => handleAddToApplications(item.id)}
                          disabled={addingTrackerId === item.id || trackedIds.has(item.id)}
                          style={{
                            flex: '1 1 100%',
                            padding: '8px 10px',
                            backgroundColor: trackedIds.has(item.id) ? '#334155' : '#0f766e',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: trackedIds.has(item.id) ? 'default' : 'pointer',
                            opacity: addingTrackerId === item.id ? 0.7 : 1,
                          }}
                        >
                          {trackedIds.has(item.id)
                            ? 'Уже в моїх заявках'
                            : addingTrackerId === item.id
                              ? 'Додаю…'
                              : 'Додати до моїх заявок'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#64748b', marginTop: '10px' }}>
                    <span>{formatDate(item.created_at)}</span>
                    {targetUrl ? (
                      <a href={targetUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: '500' }}>
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
