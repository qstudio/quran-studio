use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use crate::CoreError;

const MIGRATION_SQL: &str = include_str!("../migrations/001_initial.sql");

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Word {
    pub id: i64,
    pub surah: u16,
    pub ayah: u16,
    pub word_position: u16,
    pub text_uthmani: String,
    pub text_simple: String,
    pub page: u16,
    pub line: u16,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Translation {
    pub id: i64,
    pub surah: u16,
    pub ayah: u16,
    pub language: String,
    pub translator: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reciter {
    pub id: String,
    pub name_en: String,
    pub name_ar: String,
    pub style: Option<String>,
    pub available_surahs: Vec<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Surah {
    pub number: u16,
    pub name_arabic: String,
    pub name_english: String,
    pub total_ayahs: u16,
}

/// Initialize the database with the schema migration.
pub fn init_db(conn: &Connection) -> Result<(), CoreError> {
    conn.execute_batch(MIGRATION_SQL)?;
    Ok(())
}

/// Open (or create) a database at the given path and run migrations.
pub fn open_db(path: &str) -> Result<Connection, CoreError> {
    let conn = Connection::open(path)?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
    init_db(&conn)?;
    Ok(conn)
}

/// Get all words for a surah within a given ayah range (inclusive).
pub fn get_words(
    conn: &Connection,
    surah: u16,
    ayah_start: u16,
    ayah_end: u16,
) -> Result<Vec<Word>, CoreError> {
    let mut stmt = conn.prepare(
        "SELECT id, surah, ayah, word_position, text_uthmani, text_simple,
                page, line, x, y, width, height
         FROM words
         WHERE surah = ?1 AND ayah >= ?2 AND ayah <= ?3
         ORDER BY ayah, word_position",
    )?;

    let words = stmt
        .query_map(params![surah, ayah_start, ayah_end], |row| {
            Ok(Word {
                id: row.get(0)?,
                surah: row.get(1)?,
                ayah: row.get(2)?,
                word_position: row.get(3)?,
                text_uthmani: row.get(4)?,
                text_simple: row.get(5)?,
                page: row.get(6)?,
                line: row.get(7)?,
                x: row.get(8)?,
                y: row.get(9)?,
                width: row.get(10)?,
                height: row.get(11)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(words)
}

/// Get translations for a surah/ayah range in a specific language.
pub fn get_translations(
    conn: &Connection,
    surah: u16,
    ayah_start: u16,
    ayah_end: u16,
    language: &str,
) -> Result<Vec<Translation>, CoreError> {
    let mut stmt = conn.prepare(
        "SELECT id, surah, ayah, language, translator, text
         FROM translations
         WHERE surah = ?1 AND ayah >= ?2 AND ayah <= ?3 AND language = ?4
         ORDER BY ayah",
    )?;

    let translations = stmt
        .query_map(params![surah, ayah_start, ayah_end, language], |row| {
            Ok(Translation {
                id: row.get(0)?,
                surah: row.get(1)?,
                ayah: row.get(2)?,
                language: row.get(3)?,
                translator: row.get(4)?,
                text: row.get(5)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(translations)
}

/// List all available reciters.
pub fn list_reciters(conn: &Connection) -> Result<Vec<Reciter>, CoreError> {
    let mut stmt = conn.prepare(
        "SELECT id, name_en, name_ar, style, available_surahs FROM reciters ORDER BY name_en",
    )?;

    let reciters = stmt
        .query_map([], |row| {
            let surahs_json: String = row.get(4)?;
            let available_surahs: Vec<u16> =
                serde_json::from_str(&surahs_json).unwrap_or_default();
            Ok(Reciter {
                id: row.get(0)?,
                name_en: row.get(1)?,
                name_ar: row.get(2)?,
                style: row.get(3)?,
                available_surahs,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(reciters)
}

/// List all 114 surahs. This returns a static list since the Quran's structure is fixed.
pub fn list_surahs() -> Vec<Surah> {
    static SURAHS: &[(&str, &str, u16)] = &[
        ("الفاتحة", "Al-Fatihah", 7),
        ("البقرة", "Al-Baqarah", 286),
        ("آل عمران", "Aal-E-Imran", 200),
        ("النساء", "An-Nisa", 176),
        ("المائدة", "Al-Ma'idah", 120),
        ("الأنعام", "Al-An'am", 165),
        ("الأعراف", "Al-A'raf", 206),
        ("الأنفال", "Al-Anfal", 75),
        ("التوبة", "At-Tawbah", 129),
        ("يونس", "Yunus", 109),
        ("هود", "Hud", 123),
        ("يوسف", "Yusuf", 111),
        ("الرعد", "Ar-Ra'd", 43),
        ("إبراهيم", "Ibrahim", 52),
        ("الحجر", "Al-Hijr", 99),
        ("النحل", "An-Nahl", 128),
        ("الإسراء", "Al-Isra", 111),
        ("الكهف", "Al-Kahf", 110),
        ("مريم", "Maryam", 98),
        ("طه", "Ta-Ha", 135),
        ("الأنبياء", "Al-Anbiya", 112),
        ("الحج", "Al-Hajj", 78),
        ("المؤمنون", "Al-Mu'minun", 118),
        ("النور", "An-Nur", 64),
        ("الفرقان", "Al-Furqan", 77),
        ("الشعراء", "Ash-Shu'ara", 227),
        ("النمل", "An-Naml", 93),
        ("القصص", "Al-Qasas", 88),
        ("العنكبوت", "Al-Ankabut", 69),
        ("الروم", "Ar-Rum", 60),
        ("لقمان", "Luqman", 34),
        ("السجدة", "As-Sajdah", 30),
        ("الأحزاب", "Al-Ahzab", 73),
        ("سبأ", "Saba", 54),
        ("فاطر", "Fatir", 45),
        ("يس", "Ya-Sin", 83),
        ("الصافات", "As-Saffat", 182),
        ("ص", "Sad", 88),
        ("الزمر", "Az-Zumar", 75),
        ("غافر", "Ghafir", 85),
        ("فصلت", "Fussilat", 54),
        ("الشورى", "Ash-Shura", 53),
        ("الزخرف", "Az-Zukhruf", 89),
        ("الدخان", "Ad-Dukhan", 59),
        ("الجاثية", "Al-Jathiyah", 37),
        ("الأحقاف", "Al-Ahqaf", 35),
        ("محمد", "Muhammad", 38),
        ("الفتح", "Al-Fath", 29),
        ("الحجرات", "Al-Hujurat", 18),
        ("ق", "Qaf", 45),
        ("الذاريات", "Adh-Dhariyat", 60),
        ("الطور", "At-Tur", 49),
        ("النجم", "An-Najm", 62),
        ("القمر", "Al-Qamar", 55),
        ("الرحمن", "Ar-Rahman", 78),
        ("الواقعة", "Al-Waqi'ah", 96),
        ("الحديد", "Al-Hadid", 29),
        ("المجادلة", "Al-Mujadilah", 22),
        ("الحشر", "Al-Hashr", 24),
        ("الممتحنة", "Al-Mumtahanah", 13),
        ("الصف", "As-Saff", 14),
        ("الجمعة", "Al-Jumu'ah", 11),
        ("المنافقون", "Al-Munafiqun", 11),
        ("التغابن", "At-Taghabun", 18),
        ("الطلاق", "At-Talaq", 12),
        ("التحريم", "At-Tahrim", 12),
        ("الملك", "Al-Mulk", 30),
        ("القلم", "Al-Qalam", 52),
        ("الحاقة", "Al-Haqqah", 52),
        ("المعارج", "Al-Ma'arij", 44),
        ("نوح", "Nuh", 28),
        ("الجن", "Al-Jinn", 28),
        ("المزمل", "Al-Muzzammil", 20),
        ("المدثر", "Al-Muddaththir", 56),
        ("القيامة", "Al-Qiyamah", 40),
        ("الإنسان", "Al-Insan", 31),
        ("المرسلات", "Al-Mursalat", 50),
        ("النبأ", "An-Naba", 40),
        ("النازعات", "An-Nazi'at", 46),
        ("عبس", "Abasa", 42),
        ("التكوير", "At-Takwir", 29),
        ("الانفطار", "Al-Infitar", 19),
        ("المطففين", "Al-Mutaffifin", 36),
        ("الانشقاق", "Al-Inshiqaq", 25),
        ("البروج", "Al-Buruj", 22),
        ("الطارق", "At-Tariq", 17),
        ("الأعلى", "Al-A'la", 19),
        ("الغاشية", "Al-Ghashiyah", 26),
        ("الفجر", "Al-Fajr", 30),
        ("البلد", "Al-Balad", 20),
        ("الشمس", "Ash-Shams", 15),
        ("الليل", "Al-Layl", 21),
        ("الضحى", "Ad-Duhaa", 11),
        ("الشرح", "Ash-Sharh", 8),
        ("التين", "At-Tin", 8),
        ("العلق", "Al-Alaq", 19),
        ("القدر", "Al-Qadr", 5),
        ("البينة", "Al-Bayyinah", 8),
        ("الزلزلة", "Az-Zalzalah", 8),
        ("العاديات", "Al-Adiyat", 11),
        ("القارعة", "Al-Qari'ah", 11),
        ("التكاثر", "At-Takathur", 8),
        ("العصر", "Al-Asr", 3),
        ("الهمزة", "Al-Humazah", 9),
        ("الفيل", "Al-Fil", 5),
        ("قريش", "Quraysh", 4),
        ("الماعون", "Al-Ma'un", 7),
        ("الكوثر", "Al-Kawthar", 3),
        ("الكافرون", "Al-Kafirun", 6),
        ("النصر", "An-Nasr", 3),
        ("المسد", "Al-Masad", 5),
        ("الإخلاص", "Al-Ikhlas", 4),
        ("الفلق", "Al-Falaq", 5),
        ("الناس", "An-Nas", 6),
    ];

    SURAHS
        .iter()
        .enumerate()
        .map(|(i, (ar, en, ayahs))| Surah {
            number: (i + 1) as u16,
            name_arabic: ar.to_string(),
            name_english: en.to_string(),
            total_ayahs: *ayahs,
        })
        .collect()
}

/// Get all distinct page numbers for words in a given surah.
pub fn get_pages_for_surah(conn: &Connection, surah: u16) -> Result<Vec<u16>, CoreError> {
    let mut stmt = conn.prepare(
        "SELECT DISTINCT page FROM words WHERE surah = ?1 ORDER BY page",
    )?;

    let pages = stmt
        .query_map(params![surah], |row| row.get(0))?
        .collect::<Result<Vec<u16>, _>>()?;

    Ok(pages)
}
