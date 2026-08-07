import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { StructuredEvent, useVaultStore } from '../store/useVaultStore';

interface Props {
  event: StructuredEvent;
}

const toDisplayDate = (iso: string | null): string => {
  if (!iso) return 'No date';
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  });
};

// ── Calendar deep-link ─────────────────────────────────────────────────────────
// Opens the iOS Calendar app scrolled to the event's date/time.
// calshow://{unix_seconds} is Apple's official URL scheme for Calendar.
// On Simulator there is no Calendar app, so we fall back to a notice.
const openInCalendar = async (iso: string | null) => {
  if (!iso) {
    return;
  }
  const unixSeconds = Math.floor(new Date(iso).getTime() / 1000);
  const url = `calshow://${unixSeconds}`;
  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
  } else {
    // Simulator — Calendar app not available
    console.warn('[Calendar] calshow:// not available on this device/simulator.');
  }
};

export const ArchivedCard: React.FC<Props> = ({ event }) => {
  const { restoreEvent } = useVaultStore();

  const isCalendarAdded = event.status === 'calendar_added';
  const statusLabel = isCalendarAdded ? '✓ Added to Calendar' : 'Dismissed';
  const statusColor = isCalendarAdded ? '#1E7B34' : '#868E96';
  const statusBg   = isCalendarAdded ? '#D3F9D8' : '#F1F3F5';

  let participantsArr: string[] = [];
  try { if (event.participants) participantsArr = JSON.parse(event.participants); } catch {}

  return (
    <View style={styles.card}>
      {/* Status badge */}
      <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
        <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
      </View>

      {/* Date */}
      <Text style={styles.dateText}>{toDisplayDate(event.date)}</Text>

      {/* Title */}
      <Text style={styles.title} numberOfLines={2}>{event.title}</Text>

      {/* Description */}
      {!!event.description && (
        <Text style={styles.description} numberOfLines={2}>{event.description}</Text>
      )}

      {/* Location */}
      {!!event.location && (
        <Text style={styles.meta}>📍 {event.location}</Text>
      )}

      {/* Participants */}
      {participantsArr.length > 0 && (
        <Text style={styles.meta}>
          👥 {participantsArr.slice(0, 3).join(', ')}
          {participantsArr.length > 3 ? ` +${participantsArr.length - 3}` : ''}
        </Text>
      )}

      {/* Actions */}
      <View style={styles.actionsRow}>
        {/* Open in Calendar — only for calendar_added events */}
        {isCalendarAdded && (
          <TouchableOpacity
            style={styles.calendarButton}
            onPress={() => openInCalendar(event.date)}
            activeOpacity={0.75}
          >
            <Text style={styles.calendarButtonText}>📅 Open in Calendar</Text>
          </TouchableOpacity>
        )}

        {/* Restore */}
        <TouchableOpacity
          style={styles.restoreButton}
          onPress={() => restoreEvent(event.id)}
          activeOpacity={0.75}
        >
          <Text style={styles.restoreText}>↩ Restore</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    opacity: 0.88,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    marginBottom: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  dateText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#868E96',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#495057',
    marginBottom: 6,
    lineHeight: 20,
  },
  description: {
    fontSize: 13,
    color: '#868E96',
    lineHeight: 18,
    marginBottom: 6,
  },
  meta: {
    fontSize: 12,
    color: '#ADB5BD',
    marginBottom: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  calendarButton: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  calendarButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E7B34',
  },
  restoreButton: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F1F3F5',
  },
  restoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#495057',
  },
});
