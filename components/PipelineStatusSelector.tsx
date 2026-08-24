'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

const STAGES = [
  { key: 'FOUND', label: 'Знайдено', color: '#64748b' },
  { key: 'INTERESTED', label: 'Цікавить', color: '#3b82f6' },
  { key: 'PREPARING', label: 'Готується', color: '#eab308' },
  { key: 'SUBMITTED', label: 'Подано', color: '#06b6d4' },
  { key: 'WAITING', label: 'Очікування', color: '#8b5cf6' },
  { key: 'SELECTED', label: 'Обрано 🎉', color: '#22c55e' },
  { key: 'REJECTED', label: 'Відхилено', color: '#ef4444' },
]

interface Props {
  savedId: string
  currentStatus: string
  onStatusChange?: (newStatus: string) => void
}

export default function PipelineStatusSelector({ savedId, currentStatus, onStatusChange }: Props) {
  const [status, setStatus] = useState(currentStatus || 'INTERESTED')
  const [loading, setLoading] = useState(false)

  const handleStatusUpdate = async (newStatus: string) => {
    setLoading(true)
    setStatus(newStatus)

    const { error } = await supabase
      .from('saved_opportunities')
      .update({ status: newStatus })
      .eq('id', savedId)

    if (error) {
      console.error('Помилка оновлення статусу:', error)
    } else if (onStatusChange) {
      onStatusChange(newStatus)
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '8px 0' }}>
      <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Статус заявки в воронці:
      </span>
      <select
        value={status}
        disabled={loading}
        onChange={(e) => handleStatusUpdate(e.target.value)}
        style={{
          backgroundColor: '#0f172a',
          color: '#fff',
          border: '1px solid #334155',
          borderRadius: 8,
          padding: '6px 10px',
          fontSize: '13px',
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        {STAGES.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  )
}
