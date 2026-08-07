/**
 * CalendarModule.ts
 *
 * TypeScript wrapper for the YoustoCalendar native module (iOS only).
 * Presents EKEventEditViewController — the native iOS "New Event" dialog —
 * with pre-filled event data. No calendar permissions needed from JS;
 * iOS handles permission implicitly when the user taps "Add".
 *
 * Requires: ios/YoustoApp/YoustoCalendar.swift + YoustoCalendar.m
 * Must rebuild the native app after those files are added to Xcode.
 */
import { NativeModules, Platform } from 'react-native';

const { YoustoCalendar } = NativeModules;

export interface CalendarEventInput {
  title: string;
  startDate: string | null; // ISO 8601, e.g. "2023-03-17T19:00:00"
  notes?: string | null;
}

export type CalendarAction = 'saved' | 'canceled' | 'deleted' | 'unknown';

export interface CalendarResult {
  action: CalendarAction;
}

/**
 * Presents the native iOS EKEventEditViewController with pre-filled event data.
 * Resolves with { action: 'saved' | 'canceled' | ... } when the user finishes.
 */
export const presentEventCreationDialog = async (
  eventData: CalendarEventInput,
): Promise<CalendarResult> => {
  if (Platform.OS !== 'ios') {
    throw new Error('YoustoCalendar is iOS-only.');
  }
  if (!YoustoCalendar) {
    // Module not available — native rebuild required
    throw new Error(
      'YoustoCalendar native module not found. Add YoustoCalendar.swift + ' +
      'YoustoCalendar.m to the Xcode project and rebuild.',
    );
  }
  return YoustoCalendar.presentEventCreationDialog(eventData);
};
