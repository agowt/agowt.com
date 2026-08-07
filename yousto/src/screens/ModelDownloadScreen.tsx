import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  TouchableOpacity,
} from 'react-native';
import { downloadModel, DownloadProgressCallback } from '../ai/modelManager';

interface ModelDownloadScreenProps {
  onComplete: () => void;
}

type Phase = 'downloading' | 'error';

export const ModelDownloadScreen: React.FC<ModelDownloadScreenProps> = ({
  onComplete,
}) => {
  const [phase, setPhase] = useState<Phase>('downloading');
  const [errorMessage, setErrorMessage] = useState('');
  const [downloadKey, setDownloadKey] = useState(0); // Increment to trigger retry
  const [progress, setProgress] = useState(0);
  const [downloadedMB, setDownloadedMB] = useState(0);
  const [totalMB, setTotalMB] = useState(0);
  const [statusText, setStatusText] = useState('Connecting…');

  const animatedWidth = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for the shield icon while downloading
  useEffect(() => {
    if (phase !== 'downloading') return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim, phase]);

  // Animate progress bar smoothly
  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
      easing: Easing.out(Easing.quad),
    }).start();
  }, [progress, animatedWidth]);

  // Start (or restart on retry) the download — re-runs whenever downloadKey changes
  useEffect(() => {
    // Reset state for fresh attempt
    setPhase('downloading');
    setProgress(0);
    setDownloadedMB(0);
    setTotalMB(0);
    setStatusText('Connecting…');

    const handleProgress: DownloadProgressCallback = (pct, dlMB, totMB) => {
      setProgress(pct);
      setDownloadedMB(dlMB);
      setTotalMB(totMB);
      if (pct < 5) setStatusText('Starting download…');
      else if (pct < 95) setStatusText('Downloading private AI model…');
      else setStatusText('Finalising…');
    };

    const cancel = downloadModel(
      handleProgress,
      () => {
        setStatusText('Complete!');
        setProgress(100);
        setTimeout(onComplete, 400);
      },
      (err) => {
        setPhase('error');
        setErrorMessage(err);
      }
    );

    return cancel;
  // downloadKey is the only intentional dependency — each increment triggers a fresh download
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downloadKey]);

  const barWidth = animatedWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  // ── Error state ───────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <View style={styles.container}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.title}>Download Failed</Text>
        <Text style={styles.errorDetail}>{errorMessage}</Text>
        <Text style={styles.errorHint}>
          Check your internet connection and try again.{'\n'}
          The download will resume from the start.
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => setDownloadKey(k => k + 1)}
          activeOpacity={0.75}
        >
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Download in progress ──────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Shield / Lock Icon */}
      <Animated.Text style={[styles.icon, { transform: [{ scale: pulseAnim }] }]}>
        🔒
      </Animated.Text>

      <Text style={styles.title}>Setting up Yousto AI</Text>
      <Text style={styles.subtitle}>
        Your private AI model is downloading. This is a one-time setup.{'\n'}
        Yousto will be fully offline after this.
      </Text>

      {/* Progress Bar */}
      <View style={styles.trackContainer}>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: barWidth }]} />
        </View>
        <Text style={styles.pct}>{Math.round(progress)}%</Text>
      </View>

      <Text style={styles.size}>
        {totalMB > 0
          ? `${downloadedMB.toFixed(0)} MB of ${totalMB.toFixed(0)} MB`
          : 'Calculating…'}
      </Text>
      <Text style={styles.status}>{statusText}</Text>

      <Text style={styles.note}>
        Keep the app open. You can lock your screen — the download will continue.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  icon: {
    fontSize: 64,
    marginBottom: 28,
  },
  errorIcon: {
    fontSize: 56,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  trackContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  track: {
    width: '100%',
    height: 6,
    backgroundColor: '#2C2C2E',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  fill: {
    height: '100%',
    backgroundColor: '#30D158', // Apple green — signals privacy/trust
    borderRadius: 3,
  },
  pct: {
    fontSize: 13,
    fontWeight: '600',
    color: '#30D158',
    alignSelf: 'flex-end',
  },
  size: {
    fontSize: 13,
    color: '#636366',
    marginBottom: 4,
  },
  status: {
    fontSize: 14,
    color: '#AEAEB2',
    marginBottom: 40,
  },
  note: {
    fontSize: 12,
    color: '#48484A',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  // ── Error state styles ───────────────────────────────────────────────────
  errorDetail: {
    fontSize: 13,
    color: '#FF453A',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 18,
  },
  errorHint: {
    fontSize: 13,
    color: '#636366',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 40,
  },
  retryButton: {
    backgroundColor: '#30D158',
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 14,
  },
  retryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.2,
  },
});
