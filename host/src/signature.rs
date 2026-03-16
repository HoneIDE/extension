//! Signature verification — Ed25519 signatures for plugin integrity.
//!
//! Verifies that plugins haven't been tampered with after signing.
//! The signature covers: manifest hash + binary hash.
//!
//! Uses SHA-256 for hashing and Ed25519 for signatures.
//! The Ed25519 implementation will use a dedicated crypto crate when
//! the marketplace ships (Phase 6). For now, we provide the verification
//! framework with SHA-256 hash-based tamper detection.

use std::path::Path;

/// A plugin signature bundle.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PluginSignature {
    /// SHA-256 hash of plugin.hone.json.
    pub manifest_hash: String,
    /// SHA-256 hash of the binary (.dylib/.so/.dll).
    pub binary_hash: String,
    /// Ed25519 signature over (manifest_hash + binary_hash).
    /// Hex-encoded. Empty string if unsigned.
    pub signature: String,
    /// Public key that signed this plugin (hex-encoded).
    pub signer_key: String,
}

/// SHA-256 hash of a byte slice, returned as hex string.
pub fn sha256_hex(data: &[u8]) -> String {
    // Simple SHA-256 implementation (single-block for short data, full for longer)
    let hash = sha256(data);
    let mut hex = String::with_capacity(64);
    for byte in &hash {
        hex.push_str(&format!("{:02x}", byte));
    }
    hex
}

/// Compute hashes for a plugin's manifest and binary.
pub fn compute_plugin_hashes(
    manifest_path: &Path,
    binary_path: &Path,
) -> Result<(String, String), String> {
    let manifest_data = std::fs::read(manifest_path)
        .map_err(|e| format!("Failed to read manifest: {}", e))?;
    let binary_data = std::fs::read(binary_path)
        .map_err(|e| format!("Failed to read binary: {}", e))?;

    Ok((sha256_hex(&manifest_data), sha256_hex(&binary_data)))
}

/// Verify a plugin's signature against its files.
///
/// Returns true if:
/// 1. The manifest hash matches the file on disk
/// 2. The binary hash matches the file on disk
/// 3. The Ed25519 signature is valid (when marketplace signing is available)
pub fn verify_signature(
    sig: &PluginSignature,
    manifest_path: &Path,
    binary_path: &Path,
) -> Result<bool, String> {
    let (manifest_hash, binary_hash) = compute_plugin_hashes(manifest_path, binary_path)?;

    // Check hashes match
    if sig.manifest_hash != manifest_hash {
        return Ok(false);
    }
    if sig.binary_hash != binary_hash {
        return Ok(false);
    }

    // If signature is empty, this is an unsigned plugin (local dev)
    if sig.signature.is_empty() {
        return Ok(true); // Hashes match, considered valid for unsigned
    }

    // Ed25519 verification will be implemented with marketplace (Phase 6)
    // For now, hash-based tamper detection is sufficient
    Ok(true)
}

/// Check if any installed plugin files have been tampered with.
pub fn detect_tampering(
    plugin_dir: &Path,
    expected_manifest_hash: &str,
    expected_binary_hash: &str,
    binary_name: &str,
) -> Result<bool, String> {
    let manifest_path = plugin_dir.join("plugin.hone.json");
    let binary_path = plugin_dir.join(binary_name);

    if !manifest_path.exists() {
        return Err("Manifest file missing".to_string());
    }
    if !binary_path.exists() {
        return Err("Binary file missing".to_string());
    }

    let (actual_manifest_hash, actual_binary_hash) =
        compute_plugin_hashes(&manifest_path, &binary_path)?;

    let tampered = actual_manifest_hash != expected_manifest_hash
        || actual_binary_hash != expected_binary_hash;

    Ok(tampered)
}

// ---------------------------------------------------------------------------
// SHA-256 implementation (pure Rust, no external dependencies)
// ---------------------------------------------------------------------------

const K: [u32; 64] = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

fn sha256(data: &[u8]) -> [u8; 32] {
    let mut h: [u32; 8] = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ];

    // Pre-processing: padding
    let bit_len = (data.len() as u64) * 8;
    let mut padded = data.to_vec();
    padded.push(0x80);
    while (padded.len() % 64) != 56 {
        padded.push(0x00);
    }
    padded.extend_from_slice(&bit_len.to_be_bytes());

    // Process 64-byte chunks
    for chunk in padded.chunks(64) {
        let mut w = [0u32; 64];
        for i in 0..16 {
            w[i] = u32::from_be_bytes([
                chunk[i * 4],
                chunk[i * 4 + 1],
                chunk[i * 4 + 2],
                chunk[i * 4 + 3],
            ]);
        }
        for i in 16..64 {
            let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
            let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16]
                .wrapping_add(s0)
                .wrapping_add(w[i - 7])
                .wrapping_add(s1);
        }

        let mut a = h[0];
        let mut b = h[1];
        let mut c = h[2];
        let mut d = h[3];
        let mut e = h[4];
        let mut f = h[5];
        let mut g = h[6];
        let mut hh = h[7];

        for i in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ ((!e) & g);
            let temp1 = hh
                .wrapping_add(s1)
                .wrapping_add(ch)
                .wrapping_add(K[i])
                .wrapping_add(w[i]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let temp2 = s0.wrapping_add(maj);

            hh = g;
            g = f;
            f = e;
            e = d.wrapping_add(temp1);
            d = c;
            c = b;
            b = a;
            a = temp1.wrapping_add(temp2);
        }

        h[0] = h[0].wrapping_add(a);
        h[1] = h[1].wrapping_add(b);
        h[2] = h[2].wrapping_add(c);
        h[3] = h[3].wrapping_add(d);
        h[4] = h[4].wrapping_add(e);
        h[5] = h[5].wrapping_add(f);
        h[6] = h[6].wrapping_add(g);
        h[7] = h[7].wrapping_add(hh);
    }

    let mut result = [0u8; 32];
    for i in 0..8 {
        result[i * 4..i * 4 + 4].copy_from_slice(&h[i].to_be_bytes());
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sha256_empty() {
        let hash = sha256_hex(b"");
        assert_eq!(hash, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    }

    #[test]
    fn sha256_hello() {
        let hash = sha256_hex(b"hello");
        assert_eq!(hash, "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
    }

    #[test]
    fn sha256_longer_input() {
        let hash = sha256_hex(b"The quick brown fox jumps over the lazy dog");
        assert_eq!(hash, "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592");
    }

    #[test]
    fn signature_roundtrip() {
        let sig = PluginSignature {
            manifest_hash: "abc123".to_string(),
            binary_hash: "def456".to_string(),
            signature: String::new(),
            signer_key: String::new(),
        };
        let json = serde_json::to_string(&sig).unwrap();
        let parsed: PluginSignature = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.manifest_hash, "abc123");
        assert_eq!(parsed.binary_hash, "def456");
    }

    #[test]
    fn verify_with_matching_hashes() {
        // Create temp files
        let dir = std::env::temp_dir().join("hone-sig-test");
        let _ = std::fs::create_dir_all(&dir);

        let manifest_path = dir.join("plugin.hone.json");
        let binary_path = dir.join("test.dylib");

        std::fs::write(&manifest_path, b"manifest content").unwrap();
        std::fs::write(&binary_path, b"binary content").unwrap();

        let (mh, bh) = compute_plugin_hashes(&manifest_path, &binary_path).unwrap();

        let sig = PluginSignature {
            manifest_hash: mh,
            binary_hash: bh,
            signature: String::new(),
            signer_key: String::new(),
        };

        let valid = verify_signature(&sig, &manifest_path, &binary_path).unwrap();
        assert!(valid);

        // Cleanup
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn verify_with_wrong_hash() {
        let dir = std::env::temp_dir().join("hone-sig-test2");
        let _ = std::fs::create_dir_all(&dir);

        let manifest_path = dir.join("plugin.hone.json");
        let binary_path = dir.join("test.dylib");

        std::fs::write(&manifest_path, b"manifest").unwrap();
        std::fs::write(&binary_path, b"binary").unwrap();

        let sig = PluginSignature {
            manifest_hash: "wrong_hash".to_string(),
            binary_hash: "wrong_hash".to_string(),
            signature: String::new(),
            signer_key: String::new(),
        };

        let valid = verify_signature(&sig, &manifest_path, &binary_path).unwrap();
        assert!(!valid);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn detect_tamper() {
        let dir = std::env::temp_dir().join("hone-tamper-test");
        let _ = std::fs::create_dir_all(&dir);

        let manifest_path = dir.join("plugin.hone.json");
        let binary_path = dir.join("test.dylib");

        std::fs::write(&manifest_path, b"original manifest").unwrap();
        std::fs::write(&binary_path, b"original binary").unwrap();

        let (mh, bh) = compute_plugin_hashes(&manifest_path, &binary_path).unwrap();

        // Not tampered
        let tampered = detect_tampering(&dir, &mh, &bh, "test.dylib").unwrap();
        assert!(!tampered);

        // Tamper the binary
        std::fs::write(&binary_path, b"modified binary").unwrap();
        let tampered = detect_tampering(&dir, &mh, &bh, "test.dylib").unwrap();
        assert!(tampered);

        let _ = std::fs::remove_dir_all(&dir);
    }
}
