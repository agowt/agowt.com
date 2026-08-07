import React, { useEffect, useState } from 'react';
import { StatusBar, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { initDB } from './src/db/database';
import { initLLM } from './src/ai/llmEngine';
import { isModelDownloaded } from './src/ai/modelManager';
import { initializeShareMenuBridge } from './src/native/ShareIngestBridge';
import { PrivacyHeader } from './src/components/PrivacyHeader';
import { FeedScreen } from './src/screens/FeedScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { ModelDownloadScreen } from './src/screens/ModelDownloadScreen';

type AppState = 'booting' | 'needs-download' | 'initialising-llm' | 'ready' | 'error';
type TabId = 'inbox' | 'history';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'inbox',   label: 'Inbox',   icon: '✉' },
  { id: 'history', label: 'History', icon: '📋' },
];

// ── Custom bottom tab bar ──────────────────────────────────────────────────────
const BottomTabBar: React.FC<{
  activeTab: TabId;
  onPress: (id: TabId) => void;
}> = ({ activeTab, onPress }) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom || 12 }]}>
      {TABS.map(tab => {
        const isActive = tab.id === activeTab;
        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tabItem}
            onPress={() => onPress(tab.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>
              {tab.icon}
            </Text>
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {tab.label}
            </Text>
            {isActive && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ── Main app ──────────────────────────────────────────────────────────────────
const App = () => {
  const [appState, setAppState] = useState<AppState>('booting');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('inbox');

  const initApp = async () => {
    try {
      initDB();
      const modelReady = await isModelDownloaded();
      if (!modelReady) {
        setAppState('needs-download');
        return;
      }
      setAppState('initialising-llm');
      await initLLM();
      console.log('Llama model initialized successfully.');
      initializeShareMenuBridge();
      setAppState('ready');
    } catch (err: any) {
      console.error('Critical initialization error:', err);
      setError(err?.message ?? 'Failed to mount Vault. Please restart the app.');
      setAppState('error');
    }
  };

  useEffect(() => {
    initApp();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Render states ─────────────────────────────────────────────────────────

  if (appState === 'booting') {
    return <View style={styles.background} />;
  }

  if (appState === 'needs-download') {
    return (
      <ModelDownloadScreen
        onComplete={() => {
          setAppState('booting');
          initApp();
        }}
      />
    );
  }

  if (appState === 'initialising-llm') {
    return (
      <View style={styles.center}>
        <Text style={styles.statusText}>🔒  Loading AI…</Text>
      </View>
    );
  }

  if (appState === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.background} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
        <PrivacyHeader />

        {/* Screen content — both mounted simultaneously — display:none keeps state alive */}
        <View style={[styles.screen, activeTab !== 'inbox' && styles.hidden]}>
          <FeedScreen />
        </View>
        <View style={[styles.screen, activeTab !== 'history' && styles.hidden]}>
          <HistoryScreen isActive={activeTab === 'history'} />
        </View>

        <BottomTabBar activeTab={activeTab} onPress={setActiveTab} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  screen: {
    flex: 1,
  },
  hidden: {
    display: 'none',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0D0D0D',
  },
  statusText: {
    color: '#AEAEB2',
    fontSize: 16,
    fontWeight: '500',
  },
  errorText: {
    color: '#FF453A',
    fontWeight: '600',
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  // ── Bottom tab bar ──────────────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
    paddingTop: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  tabIcon: {
    fontSize: 22,
    opacity: 0.4,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ADB5BD',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tabLabelActive: {
    color: '#1A1A1A',
  },
  tabIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1A1A1A',
    marginTop: 2,
  },
});

export default App;
