-- Quran Studio initial schema

CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY,
    surah INTEGER NOT NULL,
    ayah INTEGER NOT NULL,
    word_position INTEGER NOT NULL,
    text_uthmani TEXT NOT NULL,
    text_simple TEXT NOT NULL,
    page INTEGER NOT NULL,
    line INTEGER NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS translations (
    id INTEGER PRIMARY KEY,
    surah INTEGER NOT NULL,
    ayah INTEGER NOT NULL,
    language TEXT NOT NULL,
    translator TEXT NOT NULL,
    text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reciters (
    id TEXT PRIMARY KEY,
    name_en TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    style TEXT,
    available_surahs TEXT NOT NULL -- JSON array
);

CREATE TABLE IF NOT EXISTS alignments (
    id INTEGER PRIMARY KEY,
    reciter_id TEXT NOT NULL,
    surah INTEGER NOT NULL,
    ayah INTEGER NOT NULL,
    word_position INTEGER NOT NULL,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    FOREIGN KEY (reciter_id) REFERENCES reciters(id)
);

CREATE INDEX IF NOT EXISTS idx_alignments_lookup ON alignments(reciter_id, surah, ayah);
CREATE INDEX IF NOT EXISTS idx_words_lookup ON words(surah, ayah, word_position);
CREATE INDEX IF NOT EXISTS idx_words_page ON words(page);
