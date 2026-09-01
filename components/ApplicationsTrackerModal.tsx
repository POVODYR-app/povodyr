'use client'

import React, { useEffect } from 'react'
import PipelineStatusSelector from './PipelineStatusSelector'

export type TrackedApplicationItem = {
  id: string
  opportunity_id?: string
  created_at?: string
  status?: string
  opportunity?: {
    id?: string
    title?: string
    deadline?: string | null
    source_url?: string | null
    link?: string | null
    link_url?: string | null
    url?: string | null
  } | null
}

const STATUS_LABELS: { [key: string]: string } = {
  FOUND: 'Знайдено',
  INTERESTED: 'Цікавить',
  PREPARING: 'Готується',
  SUBMITTED: 'Подано',
  WAITING: 'Очікування',
  SELECTED: 'Обрано',
  REJECTED: 'Відхилено',
}

interface ApplicationsTrackerModalProps {
  isOpen: boolean
  onClose: () => void
  items: TrackedApplicationItem[]
  onStatusChange?: (savedId: string, newStatus: string) => void
}

function statusLabel(status?: string): string {
  const key = String(status || '').trim().toUpperCase()
  return STATUS_LABELS[key] || 'не вказано'
}

function resultFromStatus(status?: string): string {
  const key = String(status || '').trim().toUpperCase()
  if (key === 'SELECTED') return 'Обрано'
  if (key === 'REJECTED') return 'Відхилено'
  if (key === 'WAITING') return 'Очікування'
  return 'ще немає'
}

function formatDeadline(deadline?: string | null): string {
  if (!deadline) return 'не вказано'
  const parsed = new Date(deadline)
  if (Number.isNaN(parsed.getTime())) return 'не вказано'
  return parsed.toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function sourceLink(item: TrackedApplicationItem): string | null {
  const opp = item.opportunity
  const raw = opp?.source_url || opp?.link || opp?.link_url || opp?.url || ''
  const url = String(raw).trim()
  if (url.indexOf('http://') === 0 || url.indexOf('https://') === 0) return url
  return null
}

export default function ApplicationsTrackerModal({
  isOpen,
  onClose,
  items,
  onStatusChange,
}: ApplicationsTrackerModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  const list = Array.isArray(items) ? items : []

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
            ВАШІ ЗАЯВКИ ТА РЕЗУЛЬТАТИ ({list.length})
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
          {list.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8', fontSize: '14px', lineHeight: 1.5 }}>
              Ще немає збережених заявок. Згенеруйте пакет або презентацію і додайте її сюди.
            </div>
          ) : (
            list.map((item) => {
              const title = item.opportunity?.title || 'Можливість без назви'
              const link = sourceLink(item)
              return (
                <div
                  key={item.id}
                  style={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    padding: '14px',
                    marginBottom: '12px',
                  }}
                >
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: 4 }}>Заявка</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: 10, lineHeight: 1.3 }}>
                    {title}
                  </div>

                  <div style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: 6 }}>
                    Статус: {statusLabel(item.status)}
                  </div>
                  <div style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: 6 }}>
                    Дедлайн: {formatDeadline(item.opportunity?.deadline)}
                  </div>
                  <div style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: 10 }}>
                    Результат: {resultFromStatus(item.status)}
                  </div>

                  {link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-block',
                        backgroundColor: '#2563eb',
                        color: '#fff',
                        textDecoration: 'none',
                        borderRadius: 8,
                        padding: '8px 10px',
                        fontSize: '12px',
                        fontWeight: 600,
                        textAlign: 'center',
                        width: '100%',
                        boxSizing: 'border-box',
                        marginBottom: 8,
                      }}
                    >
                      Відкрити джерело
                    </a>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: 8 }}>
                      Джерело не вказано
                    </div>
                  )}

                  <PipelineStatusSelector
                    savedId={item.id}
                    currentStatus={item.status || 'SUBMITTED'}
                    onStatusChange={(newStatus) => {
                      if (onStatusChange) onStatusChange(item.id, newStatus)
                    }}
                  />
                </div>
              )
            })
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
  )
}
