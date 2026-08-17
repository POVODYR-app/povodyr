'use client';

import React, { useEffect, useState } from 'react';
import NotificationsModal, { NotificationItem } from '../components/NotificationsModal';
import { supabase } from '../lib/supabase';

export default function HomePage() {
  const [opportunities, setOpportunities] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [isBellModalOpen, setIsBellModalOpen] = useState(false);
  const [isCenterModalOpen, setIsCenterModalOpen] = useState(false);

  useEffect(() => {
    async function fetchOpportunities() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('opportunities')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Помилка завантаження даних:', error);
        } else if (data) {
          setOpportunities(data as NotificationItem[]);
        }
      } catch (err) {
        console.error('Помилка запиту:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchOpportunities();
  }, []);

  const recentNotifications = opportunities.slice(0, 10);
  const totalCount = opportunities.length;

  return (
    <main style={{ padding: '30px 20px', fontFamily: 'sans-serif', maxWidth: '480px', margin: '0 auto', backgroundColor: '#0f172a', color: '#fff', minHeight: '100vh' }}>
      
      {/* Верхня панель */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', margin: 0, fontWeight: 'bold' }}>Вітаємо, Vanda!</h1>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setIsBellModalOpen(true)}
            style={{
              position: 'relative',
              padding: '10px 14px',
              backgroundColor: '#1e293b',
              color: '#fff',
              border: '1px solid #334155',
