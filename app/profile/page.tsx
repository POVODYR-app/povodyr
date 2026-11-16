'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { accessReason, trialEndsAt } from '../../lib/access'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const STYLES_OPTIONS = [
  'Сучасне мистецтво',
  'Сучасний живопис',
  'Класичний живопис',
  'Реалізм',
  'Імпресіонізм',
  'Експресіонізм',
  'Символізм',
  'Абстракція',
  'Абстрактні елементи',
  'Фігуративний живопис',
  'Пейзаж',
  'Портрет',
  'Натюрморт',
  'Мінімалізм',
  'Концептуальне мистецтво',
  'Стріт-арт / графіті',
  'Наїв / фольклор',
  'Авторський стиль',
]

// NOTE: This is a placeholder upload. The full 1022-line file with all portfolio fields and Artist Statement modal is prepared and will be applied next.
