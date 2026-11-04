import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Text, View, Linking, TouchableOpacity } from 'react-native';
import { getTrackingHealth, subscribeTrackingHealth } from '../services/driverLocationTask';
export default function DriverTrackingHealth() {
  const health = useSyncExternalStore(subscribeTrackingHealth, getTrackingHealth);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (health.mode === 'stopped') return null;
  const age = health.lastUploadAt ? Math.floor((now - health.lastUploadAt) / 1000) : null;
  const fixAge = health.lastReliableFixAt ? Math.max(0, Math.floor((now - health.lastReliableFixAt) / 1000)) : null;
  const stale = age == null || age > 30 || fixAge == null || fixAge > 30 || !health.precisePermission || ['limited', 'reacquiring', 'jump_rejected'].includes(health.gpsQuality);
  return <View accessibilityLiveRegion="polite" style={{
    padding: 12,
    backgroundColor: stale ? '#FEF3C7' : '#DCFCE7'
  }}>
    <Text style={{
      color: '#172033'
    }}>{health.message}{age != null ? ` · Last upload ${age}s ago` : ''}{health.queued ? ` · ${health.queued} queued` : ''}</Text>
    <Text style={{ color: '#334155', paddingTop: 5, fontSize: 12 }}>{!health.precisePermission ? 'Approximate location enabled — turn on Precise location in Settings.' : health.gpsQuality === 'reacquiring' ? 'Confirming the GPS position after a signal gap…' : health.gpsQuality === 'jump_rejected' ? 'GPS jump ignored — waiting for a consistent position.' : health.accuracyMeters == null ? 'Waiting for a GPS accuracy reading…' : `Device accuracy radius: ${Math.ceil(health.accuracyMeters)} m${health.accuracyMeters > 50 ? ' · Weak GPS — position withheld from live tracking' : ''}`}{fixAge != null ? ` · Last reliable update ${fixAge}s ago` : ''}</Text>
    {(!health.precisePermission || ['permission_denied', 'foreground_only'].includes(health.mode)) && <TouchableOpacity onPress={() => void Linking.openSettings()}><Text style={{
        color: '#1D4ED8',
        paddingTop: 8
      }}>Open location settings</Text></TouchableOpacity>}
  </View>;
}
