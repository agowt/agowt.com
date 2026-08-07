import ShareMenu, { ShareCallback } from 'react-native-share-menu';
import { executeQuery } from '../db/database';
import { parseDocumentToEvent } from '../ai/llmEngine';
import { useVaultStore } from '../store/useVaultStore';
import { generateUUID } from './utils';

// Module-level lock — prevents concurrent ingestion calls from colliding on
// the OP-SQLite connection ("Context is busy" error).
let isIngesting = false;

// Helper to handle ingestion logic
const handleShare: ShareCallback = async (item) => {
  if (isIngesting) {
    console.log('[Ingestion] Skipped: another ingestion is already in progress.');
    return;
  }
  isIngesting = true;

  console.log('[Ingestion] handleShare called with item:', item);

  // react-native-share-menu v6 returns an object where `data` is an array of shared items
  const shareItem = Array.isArray(item?.data) ? item.data[0] : item;

  if (!shareItem || !shareItem.data) {
    console.log('[Ingestion] Aborted: no valid share item');
    isIngesting = false;
    return;
  }

  const rawText = shareItem.data;
  const source = shareItem.mimeType === 'text/plain' ? 'text' : 'file';
  const uuid = generateUUID();

  try {
    console.log('[Ingestion] 1. Writing to OP-SQLite (status: pending)');
    await executeQuery(
      `INSERT INTO ingested_documents (uuid, raw_text, source, status) VALUES (?, ?, ?, 'pending')`,
      [uuid, rawText, source]
    );

    // Fetch the inserted ID
    const docResult = await executeQuery(`SELECT id FROM ingested_documents WHERE uuid = ? LIMIT 1`, [uuid]);
    const documentId = docResult.rows?.[0]?.id;

    console.log('[Ingestion] Document inserted with ID:', documentId);
    if (!documentId) throw new Error('Document insertion failed');

    // Update Zustand Store UI reactively so the user sees it's analyzing
    useVaultStore.getState().fetchEvents();

    console.log('[Ingestion] 2. Running AI parsing');
    // parseDocumentToEvent now returns ParsedEvent[] — one document may yield multiple events
    const parsedEvents = await parseDocumentToEvent(documentId, rawText);
    console.log(`[Ingestion] AI parsing successful: ${parsedEvents.length} event(s) found`, parsedEvents);

    if (parsedEvents.length === 0) {
      console.log('[Ingestion] No events found in document — marking as parsed with no cards');
    }

    // Insert one structured_events row per extracted event
    for (const parsedData of parsedEvents) {
      const eventUuid = generateUUID();
      await executeQuery(
        `INSERT INTO structured_events (uuid, document_id, title, description, date, participants, status)
         VALUES (?, ?, ?, ?, ?, ?, 'active')`,
        [
          eventUuid,
          documentId,
          parsedData.title || 'Untitled Event',
          parsedData.description || '',
          parsedData.date || null,
          JSON.stringify(parsedData.participants || []),
        ]
      );
      console.log('[Ingestion] Inserted event:', parsedData.title);
    }

    console.log(`[Ingestion] ${parsedEvents.length} structured event(s) inserted.`);

    // Mark document as parsed
    await executeQuery(`UPDATE ingested_documents SET status = 'parsed' WHERE id = ?`, [documentId]);

    // Refresh UI
    console.log('[Ingestion] 5. Refreshing Zustand store');
    useVaultStore.getState().fetchEvents();
  } catch (error) {
    console.error('[Ingestion] Pipeline failed for document', uuid, ':', error);
    // Mark document as failed so it never stays stuck in 'pending'
    await executeQuery(
      `UPDATE ingested_documents SET status = 'failed' WHERE uuid = ?`,
      [uuid]
    ).catch(() => {}); // Swallow DB errors inside the error handler
  } finally {
    // Always release the lock, whether success or failure
    isIngesting = false;
  }
};

// ─── Dev test utility ───────────────────────────────────────────────────────
// Realistic multi-event school newsletter — exercises the multi-event extraction path.
const DEV_TEST_TEXT = `
St. Mary's Primary School — Weekly Newsletter
Friday 14th March 2025

Dear Parents and Guardians,

Please note the following important dates and reminders for next week:

1. ODD SOCKS DAY — Tuesday 18th March
Children are invited to wear odd socks to school to raise awareness for Anti-Bullying Week. 
Please bring a £2 donation which will go to the Diana Award charity.

2. CHARITY BAKE SALE — Wednesday 19th March, 3:00 PM
We are holding our termly bake sale in the school hall after dismissal. All contributions welcome.
Bring a £3 donation to take part.

3. HALF-TERM EARLY FINISH — Friday 21st March
School will finish at 12:15 PM instead of the usual 3:00 PM for the half-term break.
Please arrange collection accordingly.

4. ZOO TRIP PERMISSION SLIP — Due by midnight Friday 21st March
Permission slips for the Year 3 trip to London Zoo on April 4th must be returned by this Friday.
Cost: £15 per child.

5. SPORTS DAY — Rescheduled to Thursday 27th March, 10:00 AM
Sports Day has been moved from its original date due to the hall refurbishment. 
Parents are welcome to attend. Kit required: white t-shirt and trainers.

Kind regards,
Mrs. Thompson
Head Teacher
`.trim();

export const testShareAction: (() => void) | undefined = __DEV__
  ? () => {
      if (isIngesting) {
        console.warn('[DEV] Ingestion already in progress — please wait.');
        return;
      }
      console.log('[DEV] Triggering test share action with multi-event school newsletter…');
      handleShare({ data: DEV_TEST_TEXT, mimeType: 'text/plain' });
    }
  : undefined;

// ─── Bridge initialisation ──────────────────────────────────────────────────

import DefaultPreference from 'react-native-default-preference';

export const initializeShareMenuBridge = () => {
  // Keep listener for shares when app is in the foreground
  const listener = ShareMenu.addNewShareListener(handleShare);

  // Read the App Group UserDefaults for shares that arrived while the app was closed
  const checkPendingShare = async () => {
    try {
      await DefaultPreference.setName('group.com.agowt.yousto');
      const pendingDataStr = await DefaultPreference.get('ShareMenuUserDefaults');

      if (pendingDataStr) {
        console.log('[Ingestion] Found pending share in UserDefaults');
        // Clear immediately to prevent duplicate processing
        await DefaultPreference.clear('ShareMenuUserDefaults');

        let textToIngest = '';
        try {
          const jsonArray = JSON.parse(pendingDataStr);
          textToIngest = jsonArray[0]?.data || '';
        } catch {
          // Objective-C description string: ( { data = "Text"; mimeType = "text/plain"; } )
          const match = pendingDataStr.match(/data\s*=\s*"([^"]+)"/);
          if (match && match[1]) {
            textToIngest = match[1];
          } else {
            // Fallback for unquoted strings
            const fallbackMatch = pendingDataStr.match(/data\s*=\s*([^;]+);/);
            if (fallbackMatch && fallbackMatch[1]) textToIngest = fallbackMatch[1].trim();
          }
        }

        if (textToIngest) {
          handleShare({ data: textToIngest, mimeType: 'text/plain' });
        }
      }
    } catch (error) {
      console.error('[Ingestion] Failed to read from App Group UserDefaults:', error);
    }
  };

  checkPendingShare();

  return () => {
    listener.remove();
  };
};
