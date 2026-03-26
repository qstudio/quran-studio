// Arabic text normalization utilities for fuzzy comparison.

/// Strip tashkeel (diacritical marks) from Arabic text for fuzzy matching.
/// Removes: fathah, dammah, kasrah, sukun, shadda, tanwin, maddah, hamza variants, etc.
pub fn strip_tashkeel(text: &str) -> String {
    text.chars()
        .filter(|c| !is_tashkeel(*c))
        .collect()
}

/// Check if a character is an Arabic diacritical mark (tashkeel).
fn is_tashkeel(c: char) -> bool {
    matches!(c,
        '\u{064B}' // Fathatan (tanwin fathah)
        | '\u{064C}' // Dammatan (tanwin dammah)
        | '\u{064D}' // Kasratan (tanwin kasrah)
        | '\u{064E}' // Fathah
        | '\u{064F}' // Dammah
        | '\u{0650}' // Kasrah
        | '\u{0651}' // Shadda
        | '\u{0652}' // Sukun
        | '\u{0653}' // Maddah above
        | '\u{0654}' // Hamza above
        | '\u{0655}' // Hamza below
        | '\u{0656}' // Subscript alef
        | '\u{0657}' // Inverted damma
        | '\u{0658}' // Mark noon ghunna
        | '\u{0659}' // Zwarakay
        | '\u{065A}' // Vowel sign small v above
        | '\u{065B}' // Vowel sign inverted small v above
        | '\u{065C}' // Vowel sign dot below
        | '\u{065D}' // Reversed damma
        | '\u{065E}' // Fathah with two dots
        | '\u{0670}' // Superscript alef (dagger alef)
        | '\u{06D6}' // Small high ligature sad with lam with alef maksura
        | '\u{06D7}' // Small high ligature qaf with lam with alef maksura
        | '\u{06D8}' // Small high meem initial form
        | '\u{06D9}' // Small high lam alef
        | '\u{06DA}' // Small high jeem
        | '\u{06DB}' // Small high three dots
        | '\u{06DC}' // Small high seen
        | '\u{06DD}' // End of ayah
        | '\u{06DE}' // Start of rub el hizb
        | '\u{06DF}' // Small high rounded zero
        | '\u{06E0}' // Small high upright rectangular zero
        | '\u{06E1}' // Small high dotless head of khah
        | '\u{06E2}' // Small high meem isolated form
        | '\u{06E3}' // Small low seen
        | '\u{06E4}' // Small high madda
        | '\u{06E5}' // Small waw
        | '\u{06E6}' // Small yaa
        | '\u{06E7}' // Small high yaa
        | '\u{06E8}' // Small high noon
        | '\u{06EA}' // Empty centre low stop
        | '\u{06EB}' // Empty centre high stop
        | '\u{06EC}' // Rounded high stop with filled centre
        | '\u{06ED}' // Small low meem
    )
}

/// Normalize Arabic text for comparison: strip tashkeel and normalize whitespace.
pub fn normalize_arabic(text: &str) -> String {
    let stripped = strip_tashkeel(text);
    // Collapse multiple spaces and trim
    stripped.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Simple similarity score between two strings (0.0 to 1.0).
/// Uses longest common subsequence ratio.
pub fn similarity(a: &str, b: &str) -> f64 {
    if a.is_empty() && b.is_empty() {
        return 1.0;
    }
    if a.is_empty() || b.is_empty() {
        return 0.0;
    }

    let a_chars: Vec<char> = a.chars().collect();
    let b_chars: Vec<char> = b.chars().collect();
    let lcs_len = lcs_length(&a_chars, &b_chars);
    let max_len = a_chars.len().max(b_chars.len());
    lcs_len as f64 / max_len as f64
}

/// Longest common subsequence length.
fn lcs_length(a: &[char], b: &[char]) -> usize {
    let m = a.len();
    let n = b.len();
    let mut dp = vec![vec![0usize; n + 1]; m + 1];

    for i in 1..=m {
        for j in 1..=n {
            if a[i - 1] == b[j - 1] {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = dp[i - 1][j].max(dp[i][j - 1]);
            }
        }
    }

    dp[m][n]
}
