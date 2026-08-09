import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface HashtagOpportunity {
  title: string;
  description: string;
  link_url: string;
  source_platform: string;
  tags: string[];
}

// Перевірка, чи можливість для художників
function isForArtists(title: string, description: string): boolean {
  const text = (title + ' ' + description).toLowerCase();

  const artistKeywords = [
    'художник', 'художниц', 'artist', 'visual artist', 'contemporary art',
    'живопис', 'painting', 'картин', 'скульптур', 'sculpture', 'мистецтв', 'арт',
    'виставка', 'exhibition', 'галере', 'gallery', 'музей', 'museum',
    'бієнале', 'biennale', 'open call', 'opencall',
    'арт-резиденція', 'art residence', 'residency',
    'visual arts', 'fine art', 'інтер\'єр', 'interior', 'horeca',
    'готель', 'ресторан', 'кафе', 'hotel', 'restaurant', 'cafe'
  ];

  return artistKeywords.some(keyword => text.includes(keyword));
}

// Визначення типу можливості
function detectOpportunityType(title: string, description: string): string {
  const text = (title + ' ' + description).toLowerCase();

  // 1. HoReCa / продаж в інтер'єр
  if (
    text.includes('horeca') ||
    text.includes('готель') ||
    text.includes('ресторан') ||
    text.includes('кафе') ||
    text.includes('hotel') ||
    text.includes('restaurant') ||
    text.includes('cafe') ||
    text.includes('інтер\'єр') ||
    text.includes('interior') ||
    text.includes('для інтер\'єру') ||
    text.includes('дизайн інтер\'єру') ||
    text.includes('оформлення') ||
    text.includes('закупівл') ||
    text.includes('придбання картин') ||
    text.includes('купити картину')
  ) {
    return 'horeca';
  }

  // 2. Грант
  if (
    text.includes('grant') ||
    text.includes('грант') ||
    text.includes('фінансування') ||
    text.includes('funding') ||
    text.includes('стипендія')
  ) {
    return 'grant';
  }

  // 3. Резиденція
  if (
    text.includes('residence') ||
    text.includes('резиденція') ||
    text.includes('арт-резиденція') ||
    text.includes('art residence') ||
    text.includes('residency')
  ) {
    return 'art_residence';
  }

  // 4. За замовчуванням
  return 'open_call';
}

async function fetchOpportunitiesByHashtags(): Promise<HashtagOpportunity[]> {
  const targetHashtags = [
    // Мистецькі
    '#opencall', '#мистецькийконкурс', 'open call', 'конкурс
