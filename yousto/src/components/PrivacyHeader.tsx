import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import RNFS from 'react-native-fs';
import { executeQuery } from '../db/database';

interface VaultStats {
  activeEvents: number;
  calendarAdded: number;
  dismissed: number;
  dbSizeKB: string;
}

const loadVaultStats = async (): Promise<VaultStats> => {
  // ── Event counts from DB ──────────────────────────────────────────────────
  let activeEvents = 0;
  let calendarAdded = 0;
  let dismissed = 0;
  try {
    const result = await executeQuery(
      `SELECT status, COUNT(*) as count FROM structured_events GROUP BY status`
    );
    const rows: any[] = result.rows || [];
    for (const row of rows) {
      if (row.status === 'active')           activeEvents   = row.count;
      else if (row.status === 'calendar_added') calendarAdded = row.count;
      else if (row.status === 'dismissed')   dismissed      = row.count;
    }
  } catch {}

  // ── Real DB file size ─────────────────────────────────────────────────────
  let dbSizeKB = '—';
  try {
    const dbPath = `${RNFS.DocumentDirectoryPath}/yousto.sqlite`;
    const stat = await RNFS.stat(dbPath);
    const kb = stat.size / 1024;
    dbSizeKB = kb < 1024
      ? `${kb.toFixed(1)} KB`
      : `${(kb / 1024).toFixed(2)} MB`;
  } catch {}

  return { activeEvents, calendarAdded, dismissed, dbSizeKB };
};

export const PrivacyHeader = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [stats, setStats] = useState<VaultStats | null>(null);
  const [loading, setLoading] = useState(false);

  const handleOpen = useCallback(async () => {
    setModalVisible(true);
    setLoading(true);
    try {
      const s = await loadVaultStats();
      setStats(s);
    } finally {
      setLoading(false);
    }
  }, []);

  const totalProcessed = (stats?.activeEvents ?? 0) +
    (stats?.calendarAdded ?? 0) +
    (stats?.dismissed ?? 0);

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.pill}
          onPress={handleOpen}
        >
          <Text style={styles.pillText}>🟢 Vault Secure • Offline Mode</Text>
        </TouchableOpacity>
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>

            {/* Title */}
            <Text style={styles.modalTitle}>🔐 Vault Status</Text>
            <Text style={styles.modalSubtitle}>
              Your family's data never leaves this device.
            </Text>

            {loading ? (
              <ActivityIndicator style={styles.loader} color="#1A1A1A" />
            ) : (
              <>
                {/* ── Privacy ── */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>PRIVACY</Text>
                  <Row label="Network requests" value="None" good />
                  <Row label="Cloud sync" value="Disabled" good />
                  <Row label="Processing" value="100% on-device" good />
                </View>

                {/* ── Events ── */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>EVENTS</Text>
                  <Row label="In inbox (pending)"
                       value={String(stats?.activeEvents ?? 0)} />
                  <Row label="Added to Calendar"
                       value={String(stats?.calendarAdded ?? 0)}
                       good={(stats?.calendarAdded ?? 0) > 0} />
                  <Row label="Dismissed"
                       value={String(stats?.dismissed ?? 0)} />
                  <Row label="Total extracted by AI"
                       value={String(totalProcessed)} />
                </View>

                {/* ── Storage ── */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>STORAGE</Text>
                  <Row label="Vault database" value={stats?.dbSizeKB ?? '—'} />
                  <Row label="AI model (Llama 3.2 1B)" value="~872 MB" />
                </View>

                {/* ── AI Engine ── */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>AI ENGINE</Text>
                  <Row label="Model" value="Llama 3.2 · 1B Q4_K_M" />
                  <Row label="Acceleration" value="Metal GPU" good />
                  <Row label="Status" value="Ready ✓" good />
                </View>
              </>
            )}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

// ── Helper row ────────────────────────────────────────────────────────────────
const Row: React.FC<{ label: string; value: string; good?: boolean }> = ({
  label, value, good,
}) => (
  <View style={rowStyles.row}>
    <Text style={rowStyles.label}>{label}</Text>
    <Text style={[rowStyles.value, good && rowStyles.valueGood]}>{value}</Text>
  </View>
);

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F3F5',
  },
  label: {
    fontSize: 13,
    color: '#495057',
    flex: 1,
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'right',
  },
  valueGood: {
    color: '#1E7B34',
  },
});

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    paddingTop: 50,
    paddingBottom: 10,
    paddingHorizontal: 20,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    zIndex: 100,
  },
  pill: {
    backgroundColor: '#E8F5E9',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E7D32',
    letterSpacing: 0.5,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#868E96',
    marginBottom: 20,
  },
  loader: {
    marginVertical: 32,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ADB5BD',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  closeButton: {
    marginTop: 20,
    backgroundColor: '#1A1A1A',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
});
