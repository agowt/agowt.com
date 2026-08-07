import React, { useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useVaultStore } from '../store/useVaultStore';
import { ExecutiveCard } from '../components/ExecutiveCard';
import { testShareAction } from '../native/ShareIngestBridge';

export const FeedScreen = () => {
  const { events, isLoading, fetchEvents } = useVaultStore();

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  if (isLoading && events.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color="#1A1A1A" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={events}
        keyExtractor={(item) => item.uuid}
        renderItem={({ item }) => <ExecutiveCard event={item} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Inbox Zero</Text>
            <Text style={styles.emptySubtitle}>
              Share a document or text with Yousto to securely parse it entirely offline.
            </Text>
          </View>
        }
      />
      {__DEV__ && testShareAction && (
        <TouchableOpacity
          style={styles.devButton}
          onPress={testShareAction}
          activeOpacity={0.7}
        >
          <Text style={styles.devButtonText}>⚡ DEV — Test Ingestion</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  listContent: {
    paddingVertical: 16,
  },
  centered: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#495057',
    textAlign: 'center',
    lineHeight: 22,
  },
  devButton: {
    margin: 16,
    padding: 14,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    alignItems: 'center',
  },
  devButtonText: {
    color: '#30D158',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.2,
  },
});
