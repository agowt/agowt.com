import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Switch,
  Share,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
  ScrollView,
} from 'react-native';
import RNFS from 'react-native-fs';
import { StructuredEvent, EventPatch, useVaultStore } from '../store/useVaultStore';
import { presentEventCreationDialog } from '../native/CalendarModule';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  event: StructuredEvent;
}

// ── Date / Time helpers ────────────────────────────────────────────────────────

const isAllDayDate = (iso: string | null): boolean => {
  if (!iso) return true;
  return iso.includes('T00:00:00') || iso.endsWith('Z') && new Date(iso).getHours() === 0;
};

const toDisplayDate = (iso: string | null): string => {
  if (!iso) return 'Needs Scheduling';
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  });
};

const toDisplayTime = (iso: string | null): string => {
  if (!iso || isAllDayDate(iso)) return 'All day';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

const toInputDate = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return [
    d.getDate().toString().padStart(2, '0'),
    (d.getMonth() + 1).toString().padStart(2, '0'),
    d.getFullYear(),
  ].join('/');
};

const toInputTime = (iso: string | null): string => {
  if (!iso || isAllDayDate(iso)) return '';
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const parseToISO = (dateStr: string, timeStr: string, allDay: boolean): string | null => {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts.map(Number);
  const hours = !allDay && timeStr ? parseInt(timeStr.split(':')[0]) : 0;
  const mins  = !allDay && timeStr ? parseInt(timeStr.split(':')[1]) : 0;
  const d = new Date(yyyy, mm - 1, dd, hours, mins, 0);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

// ── ICS calendar fallback ──────────────────────────────────────────────────────

const toICSDate = (d: Date): string =>
  d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

const buildICS = (title: string, start: Date, description?: string | null): string =>
  [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Yousto//EN',
    'BEGIN:VEVENT',
    `DTSTART:${toICSDate(start)}`,
    `DTEND:${toICSDate(new Date(start.getTime() + 3_600_000))}`,
    `SUMMARY:${title}`,
    description ? `DESCRIPTION:${description.replace(/\n/g, '\\n')}` : '',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');

// ── Repeat frequency options ───────────────────────────────────────────────────

const REPEAT_OPTIONS = [
  { key: 'none',    label: 'None'    },
  { key: 'daily',   label: 'Daily'   },
  { key: 'weekly',  label: 'Weekly'  },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly',  label: 'Yearly'  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export const ExecutiveCard: React.FC<Props> = ({ event }) => {
  const { dismissEvent, updateEventStatus, updateEvent, markCalendarAdded } = useVaultStore();

  // ── Edit mode state ──────────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingToCalendar, setIsAddingToCalendar] = useState(false);

  // Draft fields — initialised from event, reset on Cancel
  const [draftTitle,       setDraftTitle]       = useState(event.title);
  const [draftDescription, setDraftDescription] = useState(event.description ?? '');
  const [draftDate,        setDraftDate]         = useState(toInputDate(event.date));
  const [draftTime,        setDraftTime]         = useState(toInputTime(event.date));
  const [draftAllDay,      setDraftAllDay]       = useState(isAllDayDate(event.date));
  const [draftLocation,    setDraftLocation]     = useState(event.location ?? '');
  const [draftRepeat,      setDraftRepeat]       = useState(event.repeat_frequency ?? 'none');
  const [draftInvitees,    setDraftInvitees]     = useState(event.invitees ?? '');

  // Keep draft in sync when event updates after a save
  useEffect(() => {
    if (!isEditing) {
      setDraftTitle(event.title);
      setDraftDescription(event.description ?? '');
      setDraftDate(toInputDate(event.date));
      setDraftTime(toInputTime(event.date));
      setDraftAllDay(isAllDayDate(event.date));
      setDraftLocation(event.location ?? '');
      setDraftRepeat(event.repeat_frequency ?? 'none');
      setDraftInvitees(event.invitees ?? '');
    }
  }, [event, isEditing]);

  let participantsArr: string[] = [];
  try { if (event.participants) participantsArr = JSON.parse(event.participants); } catch {}

  // ── Edit toggle ──────────────────────────────────────────────────────────────
  const handleEditToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (isEditing) {
      // Cancel — reset draft to current saved values
      setDraftTitle(event.title);
      setDraftDescription(event.description ?? '');
      setDraftDate(toInputDate(event.date));
      setDraftTime(toInputTime(event.date));
      setDraftAllDay(isAllDayDate(event.date));
      setDraftLocation(event.location ?? '');
      setDraftRepeat(event.repeat_frequency ?? 'none');
      setDraftInvitees(event.invitees ?? '');
    }
    setIsEditing(prev => !prev);
  };

  // ── Save edits ───────────────────────────────────────────────────────────────
  const buildPatch = (): EventPatch => ({
    title:            draftTitle.trim() || event.title,
    description:      draftDescription.trim() || null,
    date:             parseToISO(draftDate, draftTime, draftAllDay),
    location:         draftLocation.trim()  || null,
    repeat_frequency: draftRepeat,
    invitees:         draftInvitees.trim()  || null,
  });

  const handleSaveOnly = async () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    await updateEvent(event.id, buildPatch());
    setIsEditing(false);
  };

  const handleSaveAndCalendar = async () => {
    const patch = buildPatch();
    await updateEvent(event.id, patch);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsEditing(false);
    // Small delay so the store refresh settles before opening the calendar dialog
    setTimeout(() => handleCalendarWithData(patch), 150);
  };

  // ── Share from Edit mode ─────────────────────────────────────────────────────
  const handleShare = async () => {
    const dateStr = draftDate
      ? `${draftDate}${!draftAllDay && draftTime ? ` at ${draftTime}` : ' (all day)'}`
      : 'Date TBC';
    const lines = [
      `📅 ${draftTitle.trim() || event.title}`,
      dateStr,
      draftLocation.trim() ? `📍 ${draftLocation.trim()}` : null,
      draftRepeat !== 'none' ? `🔁 Repeats ${draftRepeat}` : null,
      draftInvitees.trim() ? `👥 ${draftInvitees.trim()}` : null,
      '',
      draftDescription.trim() || event.description || '',
      '',
      '— Shared from Yousto',
    ].filter(l => l !== null);

    try {
      await Share.share({ message: lines.join('\n') });
    } catch (err) {
      console.error('[Share] Failed:', err);
    }
  };

  // ── Add to Calendar (View mode or after Save) ─────────────────────────────────
  const handleCalendar = () => handleCalendarWithData({
    title: event.title,
    date:  event.date,
    description: event.description,
  });

  const handleCalendarWithData = async (data: {
    title: string;
    date?: string | null;
    description?: string | null;
    location?: string | null;
  }) => {
    if (isAddingToCalendar) return;
    setIsAddingToCalendar(true);
    try {
      const startDate = data.date ? new Date(data.date) : null;
      try {
        const result = await presentEventCreationDialog({
          title:     data.title,
          startDate: startDate ? startDate.toISOString() : null,
          notes:     data.description ?? undefined,
          location:  data.location ?? undefined,
        });
        if (result.action === 'saved') {
          // Persist status + EK event identifier so History can deep-link back
          await markCalendarAdded(event.id, result.eventIdentifier);
        }
      } catch (nativeErr: any) {
        // EK save failed — fall back to ICS share sheet
        console.warn('[Calendar] Native save failed, using ICS fallback:', nativeErr?.message);
        const start = startDate ?? new Date();
        const ics   = buildICS(data.title, start, data.description);
        const filePath = `${RNFS.TemporaryDirectoryPath}yousto-event.ics`;
        await RNFS.writeFile(filePath, ics, 'utf8');
        const res = await Share.share({ url: `file://${filePath}` });
        if (res.action === Share.sharedAction) {
          await markCalendarAdded(event.id);
        }
      }
    } catch (error) {
      console.error('[Calendar] Failed:', error);
    } finally {
      setIsAddingToCalendar(false);
    }
  };

  // ── Dismiss ──────────────────────────────────────────────────────────────────
  const handleDismiss = () => dismissEvent(event.id);

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER — VIEW MODE
  // ────────────────────────────────────────────────────────────────────────────
  if (!isEditing) {
    return (
      <View style={styles.card}>
        {/* Header row: date + time */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.dateText}>{toDisplayDate(event.date)}</Text>
            <Text style={styles.timeText}>{toDisplayTime(event.date)}</Text>
          </View>
          {participantsArr.length > 0 && (
            <View style={styles.tag}>
              <Text style={styles.tagText} numberOfLines={1}>
                {participantsArr.slice(0, 3).join(', ')}
                {participantsArr.length > 3 ? ` +${participantsArr.length - 3}` : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Title */}
        <Text style={styles.title}>{event.title}</Text>

        {/* Description */}
        {!!event.description && (
          <Text style={styles.description}>{event.description}</Text>
        )}

        {/* Location (if saved) */}
        {!!event.location && (
          <Text style={styles.metaRow}>📍 {event.location}</Text>
        )}

        {/* Repeat (if set) */}
        {!!event.repeat_frequency && event.repeat_frequency !== 'none' && (
          <Text style={styles.metaRow}>🔁 Repeats {event.repeat_frequency}</Text>
        )}

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionPrimary, isAddingToCalendar && styles.actionDisabled]}
            onPress={handleCalendar}
            disabled={isAddingToCalendar}
            activeOpacity={0.75}
          >
            <Text style={styles.actionPrimaryText}>
              {isAddingToCalendar ? '…' : 'Add to Calendar'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionSecondary}
            onPress={handleEditToggle}
            activeOpacity={0.75}
          >
            <Text style={styles.actionSecondaryText}>✏️ Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionGhost}
            onPress={handleDismiss}
            activeOpacity={0.75}
          >
            <Text style={styles.actionGhostText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER — EDIT MODE (same card, expanded)
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.card, styles.cardEditing]}>

      {/* ── Title ── */}
      <Text style={styles.editLabel}>Title</Text>
      <TextInput
        style={styles.editInput}
        value={draftTitle}
        onChangeText={setDraftTitle}
        placeholder="Event title"
        placeholderTextColor="#ADB5BD"
        returnKeyType="next"
      />

      {/* ── Date row ── */}
      <View style={styles.editRow}>
        <View style={styles.editHalf}>
          <Text style={styles.editLabel}>Date (DD/MM/YYYY)</Text>
          <TextInput
            style={styles.editInput}
            value={draftDate}
            onChangeText={setDraftDate}
            placeholder="18/03/2025"
            placeholderTextColor="#ADB5BD"
            keyboardType="numbers-and-punctuation"
          />
        </View>
        <View style={styles.editHalf}>
          <Text style={styles.editLabel}>Time (HH:MM)</Text>
          <TextInput
            style={[styles.editInput, draftAllDay && styles.editInputDisabled]}
            value={draftAllDay ? '' : draftTime}
            onChangeText={setDraftTime}
            placeholder="09:00"
            placeholderTextColor="#ADB5BD"
            editable={!draftAllDay}
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </View>

      {/* ── All-day toggle ── */}
      <View style={styles.toggleRow}>
        <Text style={styles.editLabel}>All day</Text>
        <Switch
          value={draftAllDay}
          onValueChange={setDraftAllDay}
          trackColor={{ true: '#1A1A1A', false: '#DEE2E6' }}
          thumbColor="#FFFFFF"
        />
      </View>

      {/* ── Description ── */}
      <Text style={styles.editLabel}>Description</Text>
      <TextInput
        style={[styles.editInput, styles.editInputMulti]}
        value={draftDescription}
        onChangeText={setDraftDescription}
        placeholder="Add notes…"
        placeholderTextColor="#ADB5BD"
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />

      {/* ── Location ── */}
      <Text style={styles.editLabel}>📍 Location</Text>
      <TextInput
        style={styles.editInput}
        value={draftLocation}
        onChangeText={setDraftLocation}
        placeholder="Add location…"
        placeholderTextColor="#ADB5BD"
      />

      {/* ── Repeat ── */}
      <Text style={styles.editLabel}>🔁 Repeat</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.repeatScroll}
        contentContainerStyle={styles.repeatRow}
      >
        {REPEAT_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.repeatPill, draftRepeat === opt.key && styles.repeatPillActive]}
            onPress={() => setDraftRepeat(opt.key)}
            activeOpacity={0.75}
          >
            <Text style={[styles.repeatPillText, draftRepeat === opt.key && styles.repeatPillTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Invitees ── */}
      <Text style={styles.editLabel}>👥 Invitees (comma-separated emails)</Text>
      <TextInput
        style={styles.editInput}
        value={draftInvitees}
        onChangeText={setDraftInvitees}
        placeholder="alice@email.com, bob@email.com"
        placeholderTextColor="#ADB5BD"
        keyboardType="email-address"
        autoCapitalize="none"
      />

      {/* ── Primary action: Save & Add to Calendar ── */}
      <TouchableOpacity
        style={styles.editActionPrimary}
        onPress={handleSaveAndCalendar}
        activeOpacity={0.8}
      >
        <Text style={styles.editActionPrimaryText}>✓ Save & Add to Calendar</Text>
      </TouchableOpacity>

      {/* ── Secondary actions row ── */}
      <View style={styles.editActionsRow}>
        <TouchableOpacity
          style={styles.editActionSecondary}
          onPress={handleSaveOnly}
          activeOpacity={0.75}
        >
          <Text style={styles.editActionSecondaryText}>Save</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.editActionSecondary}
          onPress={handleShare}
          activeOpacity={0.75}
        >
          <Text style={styles.editActionSecondaryText}>↗ Share</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.editActionGhost}
          onPress={handleEditToggle}
          activeOpacity={0.75}
        >
          <Text style={styles.editActionGhostText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Card container ──
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  cardEditing: {
    borderColor: '#1A1A1A',
    borderWidth: 1.5,
    backgroundColor: '#FAFAFA',
  },

  // ── View mode ──
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#495057',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeText: {
    fontSize: 11,
    color: '#868E96',
    marginTop: 2,
  },
  tag: {
    backgroundColor: '#EAE5DF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    maxWidth: 140,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5C5449',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
    lineHeight: 24,
  },
  description: {
    fontSize: 14,
    color: '#495057',
    lineHeight: 20,
    marginBottom: 12,
  },
  metaRow: {
    fontSize: 12,
    color: '#868E96',
    marginBottom: 6,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  actionPrimary: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  actionDisabled: { opacity: 0.45 },
  actionPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  actionSecondary: {
    backgroundColor: '#F1F3F5',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionSecondaryText: {
    color: '#1A1A1A',
    fontSize: 13,
    fontWeight: '600',
  },
  actionGhost: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  actionGhostText: {
    color: '#868E96',
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Edit mode ──
  editLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#868E96',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 14,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#DEE2E6',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#1A1A1A',
    backgroundColor: '#FFFFFF',
  },
  editInputMulti: {
    minHeight: 72,
    paddingTop: 10,
  },
  editInputDisabled: {
    backgroundColor: '#F8F9FA',
    color: '#ADB5BD',
  },
  editRow: {
    flexDirection: 'row',
    gap: 12,
  },
  editHalf: {
    flex: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  repeatScroll: {
    marginTop: 0,
    marginBottom: 2,
  },
  repeatRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  repeatPill: {
    borderWidth: 1,
    borderColor: '#DEE2E6',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  repeatPillActive: {
    backgroundColor: '#1A1A1A',
    borderColor: '#1A1A1A',
  },
  repeatPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#495057',
  },
  repeatPillTextActive: {
    color: '#FFFFFF',
  },
  editActionPrimary: {
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  editActionPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  editActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  editActionSecondary: {
    flex: 1,
    backgroundColor: '#F1F3F5',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  editActionSecondaryText: {
    color: '#1A1A1A',
    fontSize: 13,
    fontWeight: '600',
  },
  editActionGhost: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  editActionGhostText: {
    color: '#868E96',
    fontSize: 13,
    fontWeight: '600',
  },
});
