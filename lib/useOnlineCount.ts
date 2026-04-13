'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from './supabaseBrowser';

const PRESENCE_CHANNEL = 'arcade-online';

function createPresenceKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `presence-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useOnlineCount() {
  const [onlineCount, setOnlineCount] = useState<number | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const presenceKey = createPresenceKey();
    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: {
        presence: {
          key: presenceKey,
        },
      },
    });

    const syncCount = () => {
      const state = channel.presenceState();
      const total = Object.values(state).reduce((count, entries) => count + entries.length, 0);
      setOnlineCount(total);
    };

    channel.on('presence', { event: 'sync' }, syncCount);

    channel.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return;

      await channel.track({
        online_at: new Date().toISOString(),
        path: window.location.pathname,
      });

      syncCount();
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return onlineCount;
}
