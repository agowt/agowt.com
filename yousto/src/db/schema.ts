export const migrations = [
  {
    version: 1,
    queries: [
      `CREATE TABLE IF NOT EXISTS families (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS ingested_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT UNIQUE NOT NULL,
        raw_text TEXT NOT NULL,
        source TEXT NOT NULL, -- e.g., 'share_sheet', 'pdf'
        status TEXT DEFAULT 'pending', -- 'pending', 'parsed', 'failed'
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS structured_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT UNIQUE NOT NULL,
        document_id INTEGER,
        title TEXT NOT NULL,
        description TEXT,
        date TEXT, -- ISO format date
        participants TEXT, -- JSON array string
        status TEXT DEFAULT 'active', -- 'active', 'dismissed', 'calendar_added'
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(document_id) REFERENCES ingested_documents(id)
      );`,
      // Create FTS5 virtual table for full text search on events
      `CREATE VIRTUAL TABLE IF NOT EXISTS events_fts USING fts5(
        title,
        description,
        participants,
        content='structured_events',
        content_rowid='id'
      );`,
      // Triggers to keep FTS table in sync with structured_events
      `CREATE TRIGGER IF NOT EXISTS events_ai AFTER INSERT ON structured_events BEGIN
        INSERT INTO events_fts(rowid, title, description, participants)
        VALUES (new.id, new.title, new.description, new.participants);
      END;`,
      `CREATE TRIGGER IF NOT EXISTS events_ad AFTER DELETE ON structured_events BEGIN
        INSERT INTO events_fts(events_fts, rowid, title, description, participants)
        VALUES('delete', old.id, old.title, old.description, old.participants);
      END;`,
      `CREATE TRIGGER IF NOT EXISTS events_au AFTER UPDATE ON structured_events BEGIN
        INSERT INTO events_fts(events_fts, rowid, title, description, participants)
        VALUES('delete', old.id, old.title, old.description, old.participants);
        INSERT INTO events_fts(rowid, title, description, participants)
        VALUES (new.id, new.title, new.description, new.participants);
      END;`
    ],
  },
  {
    version: 3,
    queries: [
      // Create FTS5 virtual table for full text search on events
      `CREATE VIRTUAL TABLE IF NOT EXISTS events_fts USING fts5(
        title,
        description,
        participants,
        content='structured_events',
        content_rowid='id'
      );`,
      // Triggers to keep FTS table in sync with structured_events
      `CREATE TRIGGER IF NOT EXISTS events_ai AFTER INSERT ON structured_events BEGIN
        INSERT INTO events_fts(rowid, title, description, participants)
        VALUES (new.id, new.title, new.description, new.participants);
      END;`,
      `CREATE TRIGGER IF NOT EXISTS events_ad AFTER DELETE ON structured_events BEGIN
        INSERT INTO events_fts(events_fts, rowid, title, description, participants)
        VALUES('delete', old.id, old.title, old.description, old.participants);
      END;`,
      `CREATE TRIGGER IF NOT EXISTS events_au AFTER UPDATE ON structured_events BEGIN
        INSERT INTO events_fts(events_fts, rowid, title, description, participants)
        VALUES('delete', old.id, old.title, old.description, old.participants);
        INSERT INTO events_fts(rowid, title, description, participants)
        VALUES (new.id, new.title, new.description, new.participants);
      END;`
    ],
  },
  {

    version: 4,
    queries: [
      // New user-editable fields on every event card
      `ALTER TABLE structured_events ADD COLUMN location TEXT;`,
      `ALTER TABLE structured_events ADD COLUMN repeat_frequency TEXT DEFAULT 'none';`,
      // invitees = people the user explicitly wants to invite/share with
      // (distinct from 'participants' which are people mentioned in the source document)
      `ALTER TABLE structured_events ADD COLUMN invitees TEXT;`,
    ],
  },
  {
    version: 5,
    queries: [
      // iOS Calendar event identifier — stored after programmatic EKEventStore.save()
      // Used for 'Open in Calendar' and future event management
      `ALTER TABLE structured_events ADD COLUMN ek_event_id TEXT;`,
    ],
  },
];
