use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use crate::CoreError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WordTimestamp {
    pub surah: u16,
    pub ayah: u16,
    pub word_position: u16,
    pub start_ms: u64,
    pub end_ms: u64,
    pub page: u16,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub text_uthmani: String,
}

/// Load alignment data for a reciter's recitation of a surah (ayah range).
/// Joins the alignments table with the words table to get both timing and
/// coordinate/text data in a single query.
pub fn load_alignment(
    conn: &Connection,
    reciter_id: &str,
    surah: u16,
    ayah_start: u16,
    ayah_end: u16,
) -> Result<Vec<WordTimestamp>, CoreError> {
    let mut stmt = conn.prepare(
        "SELECT a.surah, a.ayah, a.word_position, a.start_ms, a.end_ms,
                w.page, w.x, w.y, w.width, w.height, w.text_uthmani
         FROM alignments a
         JOIN words w ON w.surah = a.surah AND w.ayah = a.ayah AND w.word_position = a.word_position
         WHERE a.reciter_id = ?1 AND a.surah = ?2 AND a.ayah >= ?3 AND a.ayah <= ?4
         ORDER BY a.ayah, a.word_position",
    )?;

    let timestamps = stmt
        .query_map(params![reciter_id, surah, ayah_start, ayah_end], |row| {
            Ok(WordTimestamp {
                surah: row.get(0)?,
                ayah: row.get(1)?,
                word_position: row.get(2)?,
                start_ms: row.get(3)?,
                end_ms: row.get(4)?,
                page: row.get(5)?,
                x: row.get(6)?,
                y: row.get(7)?,
                width: row.get(8)?,
                height: row.get(9)?,
                text_uthmani: row.get(10)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(timestamps)
}
