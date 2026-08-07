import React, { useEffect, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  ActivityIndicator,
} from 'react-native';
import { useVaultStore } from '../store/useVaultStore';
import { ArchivedCard } from '../components/ArchivedCard';

interface Props {
  isActive: boolean; // True when the History tab is selected
}

export const HistoryScreen: React.FC<Props> = ({ isActive }) => {
  const { archivedEvents, fetchArchivedEvents } = useVaultStore();
  const [isLoading, setIsLoading] = useState(false);

  // Re-fetch every time the user switches to this tab
  // This ensures events added to Calendar in the Inbox tab appear immediately
  useEffect(() => {
    if (!isActive) return;
    setIsLoading(true);
    fetchArchivedEvents().finally(() => setIsLoading(false));
  }, [isActive, fetchArchivedEvents]);

  const calendarCount = archivedEvents.filter(e => e.status === 'calendar_added').length;
  const dismissedCount = archivedEvents.filter(e => e.status === 'dismissed').length;

  return (
    <View style={styles.container}>
      <FlatList
        data={archivedEvents}
        keyExtractor={(item) => `${item.uuid}-${item.status}`}
        renderItem={({ item }) => <ArchivedCard event={item} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.screenHeader}>
            <Text style={styles.screenTitle}>History</Text>
            {archivedEvents.length > 0 ? (
              <View style={styles.statsRow}>
                {calendarCount > 0 && (
                  <View style={styles.statBadge}>
                    <Text style={styles.statBadgeText}>✓ {calendarCount} in Calendar</Text>
                  </View>
                )}
                {dismissedCount > 0 && (
                  <View style={[styles.statBadge, styles.statBadgeDismissed]}>
                    <Text style={[styles.statBadgeText, styles.statBadgeTextDismissed]}>
                      {dismissedCount} dismissed
                    </Text>
                  </View>
                )}
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyTitle}>No history yet</Text>
              <Text style={styles.emptySubtitle}>
                Events you add to Calendar or dismiss{'\n'}from your Inbox will appear here.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#ADB5BD" />
            </View>
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  listContent: {
    paddingBottom: 24,
    flexGrow: 1,
  },

  // ── Header ──
  screenHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  statBadge: {
    backgroundColor: '#D3F9D8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statBadgeDismissed: {
    backgroundColor: '#F1F3F5',
  },
  statBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E7B34',
  },
  statBadgeTextDismissed: {
    color: '#868E96',
  },

  // ── Empty state ──
  emptyContainer: {
    flex: 1,
    padding: 40,
    alignItems: 'center',
    marginTop: 60,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#868E96',
    textAlign: 'center',
    lineHeight: 22,
  },

  // ── Loading ──
  loadingRow: {
    padding: 24,
    alignItems: 'center',
  },
});
