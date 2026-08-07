import { create } from 'zustand';
import { executeQuery } from '../db/database';

export interface StructuredEvent {
  id: number;
  uuid: string;
  title: string;
  description: string | null;
  date: string | null;
  participants: string;
  status: string;
  created_at: string;
  // User-editable fields (added in schema v4)
  location: string | null;
  repeat_frequency: string | null; // 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  invitees: string | null;         // JSON array of email strings
  // iOS Calendar event identifier (added in schema v5)
  ek_event_id: string | null;
}

export interface EventPatch {
  title?: string;
  description?: string | null;
  date?: string | null;
  location?: string | null;
  repeat_frequency?: string | null;
  invitees?: string | null;
}

interface VaultState {
  events: StructuredEvent[];         // Active (pending) events
  archivedEvents: StructuredEvent[]; // calendar_added + dismissed
  isLoading: boolean;
  fetchEvents: () => Promise<void>;
  fetchArchivedEvents: () => Promise<void>;
  dismissEvent: (id: number) => Promise<void>;
  updateEventStatus: (id: number, status: string) => Promise<void>;
  updateEvent: (id: number, patch: EventPatch) => Promise<void>;
  markCalendarAdded: (id: number, ekEventId?: string) => Promise<void>;
  restoreEvent: (id: number) => Promise<void>;
}

export const useVaultStore = create<VaultState>((set, get) => ({
  events: [],
  archivedEvents: [],
  isLoading: true,

  // ── Active feed ──────────────────────────────────────────────────────────────
  fetchEvents: async () => {
    set({ isLoading: true });
    try {
      const result = await executeQuery(
        `SELECT * FROM structured_events WHERE status = 'active' ORDER BY created_at DESC`
      );
      const rows = result.rows || [];
      set({ events: rows as StructuredEvent[], isLoading: false });
    } catch (error) {
      console.error('Failed to fetch events from OP-SQLite', error);
      set({ isLoading: false });
    }
  },

  // ── Archived / history ───────────────────────────────────────────────────────
  fetchArchivedEvents: async () => {
    try {
      const result = await executeQuery(
        `SELECT * FROM structured_events
         WHERE status IN ('calendar_added', 'dismissed')
         ORDER BY created_at DESC`
      );
      const rows = result.rows || [];
      set({ archivedEvents: rows as StructuredEvent[] });
    } catch (error) {
      console.error('Failed to fetch archived events', error);
    }
  },

  // ── Mutations ────────────────────────────────────────────────────────────────
  dismissEvent: async (id: number) => {
    try {
      await executeQuery(`UPDATE structured_events SET status = 'dismissed' WHERE id = ?`, [id]);
      get().fetchEvents();
    } catch (error) {
      console.error('Failed to dismiss event', error);
    }
  },

  updateEventStatus: async (id: number, status: string) => {
    try {
      await executeQuery(`UPDATE structured_events SET status = ? WHERE id = ?`, [status, id]);
      get().fetchEvents();
    } catch (error) {
      console.error(`Failed to update event status to ${status}`, error);
    }
  },

  updateEvent: async (id: number, patch: EventPatch) => {
    try {
      const fields = Object.keys(patch) as (keyof EventPatch)[];
      const setClauses = fields.map(f => `${f} = ?`).join(', ');
      const values = fields.map(f => patch[f]);
      await executeQuery(
        `UPDATE structured_events SET ${setClauses} WHERE id = ?`,
        [...values, id]
      );
      get().fetchEvents();
    } catch (error) {
      console.error('Failed to update event', error);
    }
  },

  // Marks event as calendar_added and optionally persists the EK event identifier
  markCalendarAdded: async (id: number, ekEventId?: string) => {
    try {
      if (ekEventId) {
        await executeQuery(
          `UPDATE structured_events SET status = 'calendar_added', ek_event_id = ? WHERE id = ?`,
          [ekEventId, id]
        );
      } else {
        await executeQuery(
          `UPDATE structured_events SET status = 'calendar_added' WHERE id = ?`,
          [id]
        );
      }
      get().fetchEvents();
    } catch (error) {
      console.error('Failed to mark event as calendar_added', error);
    }
  },

  // Restore a dismissed/archived event back to the active feed
  restoreEvent: async (id: number) => {
    try {
      await executeQuery(`UPDATE structured_events SET status = 'active' WHERE id = ?`, [id]);
      await get().fetchEvents();
      await get().fetchArchivedEvents();
    } catch (error) {
      console.error('Failed to restore event', error);
    }
  },
}));
