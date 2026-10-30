use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::{HashMap, HashSet, VecDeque};
use std::fs;
use std::io::{self, BufRead, BufReader, Read, Write};
use std::net::{IpAddr, Ipv4Addr, SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

pub const PROTOCOL_VERSION: u64 = 1;
pub const MAX_MESSAGE_BYTES: usize = 8 * 1024;
pub const MAX_MESSAGES_PER_SECOND: usize = 30;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeDescriptor {
    pub protocol_version: u64,
    pub process_id: u32,
    pub port: u16,
    pub session_token: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BridgeHandshake<'a> {
    #[serde(rename = "type")]
    message_type: &'static str,
    protocol_version: u64,
    session_token: &'a str,
    client_name: &'static str,
}

#[derive(Default)]
pub struct RateLimiter {
    arrivals: VecDeque<Instant>,
}

impl RateLimiter {
    pub fn accept_at(&mut self, now: Instant) -> bool {
        while self
            .arrivals
            .front()
            .is_some_and(|first| now.duration_since(*first) >= Duration::from_secs(1))
        {
            self.arrivals.pop_front();
        }
        if self.arrivals.len() >= MAX_MESSAGES_PER_SECOND {
            return false;
        }
        self.arrivals.push_back(now);
        true
    }
}

#[derive(Default)]
pub struct MessageValidator {
    last_sequences: HashMap<String, u64>,
}

impl MessageValidator {
    pub fn validate(&mut self, value: &Value) -> Result<(), &'static str> {
        let object = value.as_object().ok_or("invalid_message")?;
        let version = object.get("protocolVersion").and_then(Value::as_u64);
        if !matches!(version, Some(1 | 2)) {
            return Err("protocol_mismatch");
        }
        let message_type = object
            .get("type")
            .and_then(Value::as_str)
            .ok_or("invalid_message")?;
        validate_keys(object.keys().map(String::as_str), message_type)?;
        let session = bounded_string(object.get("browserSessionId"), 128)?;
        let sequence = object
            .get("sequence")
            .and_then(Value::as_u64)
            .ok_or("invalid_message")?;
        if sequence <= self.last_sequences.get(session).copied().unwrap_or(0) {
            return Err("invalid_message");
        }
        validate_timestamp(object.get("emittedAtUnixMs"))?;
        match message_type {
            "hello" => {
                bounded_string(object.get("extensionVersion"), 32)?;
            }
            "playback_state" => validate_playback(value)?,
            "lyrics_playback" if version == Some(2) => validate_lyrics(value)?,
            "music_features" => validate_features(value)?,
            "capture_stopped" => validate_capture_stop(value)?,
            _ => return Err("invalid_message"),
        }
        self.last_sequences.insert(session.to_owned(), sequence);
        Ok(())
    }
}

struct BridgeConnection {
    writer: TcpStream,
    reader: BufReader<TcpStream>,
}

enum BridgeConnectOutcome {
    Connected(BridgeConnection, Value),
    Rejected(Value),
    Unavailable,
}

pub fn run<R: Read, W: Write>(reader: &mut R, writer: &mut W) -> io::Result<()> {
    run_with_connector(reader, writer, connect_to_phase_pal)
}

fn run_with_connector<R, W, F>(reader: &mut R, writer: &mut W, mut connect: F) -> io::Result<()>
where
    R: Read,
    W: Write,
    F: FnMut() -> io::Result<BridgeConnectOutcome>,
{
    let mut validator = MessageValidator::default();
    let mut limiter = RateLimiter::default();
    let mut bridge: Option<BridgeConnection> = None;
    let mut last_hello: Option<Value> = None;
    let mut next_connect_at = Instant::now();
    let mut reconnect_delay = Duration::from_millis(100);
    loop {
        let Some(bytes) = read_native_message(reader)? else {
            return Ok(());
        };
        if !limiter.accept_at(Instant::now()) {
            write_host_status(writer, false, false, "invalid_message")?;
            continue;
        }
        let value: Value = match serde_json::from_slice(&bytes) {
            Ok(value) => value,
            Err(_) => {
                write_host_status(writer, false, false, "invalid_message")?;
                continue;
            }
        };
        if let Err(code) = validator.validate(&value) {
            write_host_status(writer, false, false, code)?;
            continue;
        }
        if value.get("type").and_then(Value::as_str) == Some("hello") {
            last_hello = Some(value.clone());
        }
        let mut newly_connected = false;
        if bridge.is_none() && Instant::now() >= next_connect_at {
            match connect() {
                Ok(BridgeConnectOutcome::Connected(connection, status)) => {
                    write_native_value(writer, &status)?;
                    bridge = Some(connection);
                    newly_connected = true;
                    reconnect_delay = Duration::from_millis(100);
                }
                Ok(BridgeConnectOutcome::Rejected(status)) => {
                    write_native_value(writer, &status)?;
                    schedule_reconnect(&mut next_connect_at, &mut reconnect_delay);
                    continue;
                }
                Ok(BridgeConnectOutcome::Unavailable) | Err(_) => {
                    write_host_status(writer, false, false, "phasepal_unavailable")?;
                    schedule_reconnect(&mut next_connect_at, &mut reconnect_delay);
                    continue;
                }
            }
        }
        if let Some(connection) = bridge.as_mut() {
            if newly_connected
                && value.get("type").and_then(Value::as_str) != Some("hello")
                && let Some(hello) = last_hello.as_ref()
            {
                match forward_and_read_status(connection, hello) {
                    Ok(Some(status)) => write_native_value(writer, &status)?,
                    Ok(None) => {}
                    Err(_) => {
                        bridge = None;
                        schedule_reconnect(&mut next_connect_at, &mut reconnect_delay);
                        write_host_status(writer, false, false, "phasepal_unavailable")?;
                        continue;
                    }
                }
            }
            match forward_and_read_status(connection, &value) {
                Ok(Some(status)) => write_native_value(writer, &status)?,
                Ok(None) => {}
                Err(_) => {
                    bridge = None;
                    schedule_reconnect(&mut next_connect_at, &mut reconnect_delay);
                    write_host_status(writer, false, false, "phasepal_unavailable")?;
                }
            }
        } else {
            write_host_status(writer, false, false, "phasepal_unavailable")?;
        }
    }
}

fn schedule_reconnect(next_connect_at: &mut Instant, reconnect_delay: &mut Duration) {
    *next_connect_at = Instant::now() + *reconnect_delay;
    *reconnect_delay = (*reconnect_delay * 2).min(Duration::from_millis(1_500));
}

pub fn read_native_message<R: Read>(reader: &mut R) -> io::Result<Option<Vec<u8>>> {
    let mut length_bytes = [0u8; 4];
    match reader.read_exact(&mut length_bytes) {
        Ok(()) => {}
        Err(error) if error.kind() == io::ErrorKind::UnexpectedEof => return Ok(None),
        Err(error) => return Err(error),
    }
    let length = u32::from_le_bytes(length_bytes) as usize;
    if length == 0 || length > MAX_MESSAGE_BYTES {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "native message size is invalid",
        ));
    }
    let mut bytes = vec![0u8; length];
    reader.read_exact(&mut bytes)?;
    Ok(Some(bytes))
}

pub fn write_native_value<W: Write>(writer: &mut W, value: &Value) -> io::Result<()> {
    let bytes = serde_json::to_vec(value).map_err(io::Error::other)?;
    if bytes.len() > MAX_MESSAGE_BYTES {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "native response is too large",
        ));
    }
    writer.write_all(&(bytes.len() as u32).to_le_bytes())?;
    writer.write_all(&bytes)?;
    writer.flush()
}

pub fn descriptor_path() -> io::Result<PathBuf> {
    if let Some(override_path) = std::env::var_os("PHASEPAL_BROWSER_BRIDGE_DESCRIPTOR") {
        return Ok(PathBuf::from(override_path));
    }
    #[cfg(target_os = "windows")]
    {
        let base = std::env::var_os("LOCALAPPDATA")
            .map(PathBuf::from)
            .ok_or_else(|| {
                io::Error::new(io::ErrorKind::NotFound, "LOCALAPPDATA is unavailable")
            })?;
        Ok(base
            .join("ConsistencyAI")
            .join("Phase Pal")
            .join("phasepal-browser-bridge.json"))
    }
    #[cfg(target_os = "macos")]
    {
        let base = std::env::var_os("HOME")
            .map(PathBuf::from)
            .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "user home is unavailable"))?;
        Ok(base
            .join("Library")
            .join("Application Support")
            .join("ConsistencyAI")
            .join("Phase Pal")
            .join("phasepal-browser-bridge.json"))
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    Err(io::Error::new(
        io::ErrorKind::Unsupported,
        "Phase Pal browser bridge supports Windows and macOS",
    ))
}

fn connect_to_phase_pal() -> io::Result<BridgeConnectOutcome> {
    let path = descriptor_path()?;
    let descriptor = match read_descriptor(&path) {
        Ok(descriptor) => descriptor,
        Err(_) => return Ok(BridgeConnectOutcome::Unavailable),
    };
    if descriptor.protocol_version != PROTOCOL_VERSION || descriptor.session_token.len() < 32 {
        return Ok(BridgeConnectOutcome::Rejected(host_status_value(
            false,
            false,
            "protocol_mismatch",
        )));
    }
    let address = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), descriptor.port);
    let mut stream = match TcpStream::connect_timeout(&address, Duration::from_millis(500)) {
        Ok(stream) => stream,
        Err(_) => return Ok(BridgeConnectOutcome::Unavailable),
    };
    stream.set_write_timeout(Some(Duration::from_millis(500)))?;
    stream.set_read_timeout(Some(Duration::from_millis(80)))?;
    let handshake = BridgeHandshake {
        message_type: "bridge_hello",
        protocol_version: PROTOCOL_VERSION,
        session_token: &descriptor.session_token,
        client_name: "phasepal-browser-host",
    };
    let mut bytes = serde_json::to_vec(&handshake).map_err(io::Error::other)?;
    bytes.push(b'\n');
    stream.write_all(&bytes)?;
    let reader_stream = stream.try_clone()?;
    let mut reader = BufReader::new(reader_stream);
    let status = read_bridge_status(&mut reader)?.ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::TimedOut,
            "Phase Pal did not answer the bridge handshake",
        )
    })?;
    if is_accepted_handshake_status(&status) {
        Ok(BridgeConnectOutcome::Connected(
            BridgeConnection {
                writer: stream,
                reader,
            },
            status,
        ))
    } else {
        Ok(BridgeConnectOutcome::Rejected(status))
    }
}

fn is_accepted_handshake_status(status: &Value) -> bool {
    status.get("phasePalConnected").and_then(Value::as_bool) == Some(true)
        && status.get("errorCode").and_then(Value::as_str) == Some("none")
}

fn read_descriptor(path: &Path) -> io::Result<RuntimeDescriptor> {
    let bytes = fs::read(path)?;
    let descriptor: RuntimeDescriptor = serde_json::from_slice(&bytes).map_err(io::Error::other)?;
    if descriptor.process_id == 0 || descriptor.port == 0 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "descriptor identity is invalid",
        ));
    }
    Ok(descriptor)
}

fn forward_message(stream: &mut TcpStream, value: &Value) -> io::Result<()> {
    let mut bytes = serde_json::to_vec(value).map_err(io::Error::other)?;
    bytes.push(b'\n');
    stream.write_all(&bytes)
}

fn forward_and_read_status(
    connection: &mut BridgeConnection,
    value: &Value,
) -> io::Result<Option<Value>> {
    forward_message(&mut connection.writer, value)?;
    read_bridge_status(&mut connection.reader)
}

fn read_bridge_status(reader: &mut BufReader<TcpStream>) -> io::Result<Option<Value>> {
    let mut bytes = Vec::with_capacity(512);
    let read_result = {
        let mut limited = reader.take((MAX_MESSAGE_BYTES + 1) as u64);
        limited.read_until(b'\n', &mut bytes)
    };
    match read_result {
        Ok(0) => Err(io::Error::new(
            io::ErrorKind::UnexpectedEof,
            "Phase Pal closed the bridge",
        )),
        Ok(_) if bytes.len() > MAX_MESSAGE_BYTES || bytes.last() != Some(&b'\n') => Err(
            io::Error::new(io::ErrorKind::InvalidData, "Phase Pal status is too large"),
        ),
        Ok(_) => {
            let value: Value = serde_json::from_slice(&bytes).map_err(io::Error::other)?;
            validate_host_status(&value)?;
            Ok(Some(value))
        }
        Err(error)
            if error.kind() == io::ErrorKind::WouldBlock
                || error.kind() == io::ErrorKind::TimedOut =>
        {
            Ok(None)
        }
        Err(error) => Err(error),
    }
}

fn validate_host_status(value: &Value) -> io::Result<()> {
    let object = value
        .as_object()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "invalid host status"))?;
    let mut expected: HashSet<&str> = [
        "type",
        "protocolVersion",
        "phasePalConnected",
        "danceToMusicEnabled",
        "errorCode",
    ]
    .into_iter()
    .collect();
    let version = object.get("protocolVersion").and_then(Value::as_u64);
    if version == Some(2) {
        expected.insert("lyricsRequested");
        if object.get("lyricsRequested").and_then(Value::as_bool).is_none() {
            return Err(io::Error::new(io::ErrorKind::InvalidData, "invalid lyric status"));
        }
    }
    let keys: HashSet<&str> = object.keys().map(String::as_str).collect();
    let error_code_is_valid = matches!(
        object.get("errorCode").and_then(Value::as_str),
        Some("none" | "phasepal_unavailable" | "protocol_mismatch" | "busy" | "invalid_message")
    );
    if keys != expected
        || object.get("type").and_then(Value::as_str) != Some("host_status")
        || !matches!(version, Some(1 | 2))
        || object
            .get("phasePalConnected")
            .and_then(Value::as_bool)
            .is_none()
        || object
            .get("danceToMusicEnabled")
            .and_then(Value::as_bool)
            .is_none()
        || !error_code_is_valid
    {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "invalid host status",
        ));
    }
    Ok(())
}

fn validate_keys<'a>(
    mut keys: impl Iterator<Item = &'a str>,
    message_type: &str,
) -> Result<(), &'static str> {
    let common = [
        "type",
        "protocolVersion",
        "sequence",
        "emittedAtUnixMs",
        "browserSessionId",
    ];
    let specific: &[&str] = match message_type {
        "hello" => &["extensionVersion"],
        "playback_state" => &[
            "provider",
            "playing",
            "hasTitle",
            "hasArtist",
            "hasTimeline",
            "captureActive",
        ],
        "music_features" => &[
            "provider",
            "energy01",
            "bpm",
            "beatConfidence01",
            "beatPhase01",
            "beatPulse",
            "onsetDensity01",
            "sectionIntensity",
        ],
        "lyrics_playback" => &["provider", "sourceId", "trackId", "title", "artist", "durationMs", "positionMs", "playbackRate", "playing", "buffering", "available"],
        "capture_stopped" => &["reason"],
        _ => return Err("invalid_message"),
    };
    let allowed: HashSet<&str> = common.into_iter().chain(specific.iter().copied()).collect();
    if keys.all(|key| allowed.contains(key)) {
        Ok(())
    } else {
        Err("invalid_message")
    }
}

fn write_host_status<W: Write>(
    writer: &mut W,
    connected: bool,
    enabled: bool,
    code: &str,
) -> io::Result<()> {
    write_native_value(writer, &host_status_value(connected, enabled, code))
}

fn host_status_value(connected: bool, enabled: bool, code: &str) -> Value {
    json!({
        "type": "host_status",
        "protocolVersion": PROTOCOL_VERSION,
        "phasePalConnected": connected,
        "danceToMusicEnabled": enabled,
        "errorCode": code
    })
}

fn bounded_string(value: Option<&Value>, max: usize) -> Result<&str, &'static str> {
    let value = value.and_then(Value::as_str).ok_or("invalid_message")?;
    if value.is_empty() || value.len() > max {
        Err("invalid_message")
    } else {
        Ok(value)
    }
}

fn validate_timestamp(value: Option<&Value>) -> Result<(), &'static str> {
    let value = value.and_then(Value::as_f64).ok_or("invalid_message")?;
    if value.is_finite() && value >= 0.0 {
        Ok(())
    } else {
        Err("invalid_message")
    }
}

fn validate_provider(value: Option<&Value>) -> Result<(), &'static str> {
    match value.and_then(Value::as_str) {
        Some(
            "spotify_web" | "youtube_music" | "soundcloud" | "apple_music" | "amazon_music"
            | "deezer" | "tidal" | "qobuz" | "pandora" | "yandex_music" | "qq_music" | "kugou"
            | "jiosaavn" | "line_music" | "bugs" | "joox" | "anghami" | "audiomack" | "custom_site",
        ) => Ok(()),
        _ => Err("invalid_message"),
    }
}

fn validate_playback(value: &Value) -> Result<(), &'static str> {
    let object = value.as_object().ok_or("invalid_message")?;
    validate_provider(object.get("provider"))?;
    for key in [
        "playing",
        "hasTitle",
        "hasArtist",
        "hasTimeline",
        "captureActive",
    ] {
        object
            .get(key)
            .and_then(Value::as_bool)
            .ok_or("invalid_message")?;
    }
    Ok(())
}

fn validate_lyrics(value: &Value) -> Result<(), &'static str> {
    let object = value.as_object().ok_or("invalid_message")?;
    validate_provider(object.get("provider"))?;
    bounded_string(object.get("sourceId"), 128)?;
    bounded_string(object.get("trackId"), 128)?;
    for key in ["title", "artist"] {
        let text = object.get(key).and_then(Value::as_str).ok_or("invalid_message")?;
        if text.chars().count() > 256 { return Err("invalid_message"); }
    }
    for key in ["playing", "buffering", "available"] {
        object.get(key).and_then(Value::as_bool).ok_or("invalid_message")?;
    }
    for key in ["durationMs", "positionMs"] {
        let number = object.get(key).and_then(Value::as_f64).ok_or("invalid_message")?;
        if !number.is_finite() || !(0.0..=86_400_000.0).contains(&number) { return Err("invalid_message"); }
    }
    let rate = object.get("playbackRate").and_then(Value::as_f64).ok_or("invalid_message")?;
    if !rate.is_finite() || !(0.1..=16.0).contains(&rate) { return Err("invalid_message"); }
    if value["positionMs"].as_f64() > value["durationMs"].as_f64() { return Err("invalid_message"); }
    if value["available"] == true && (value["durationMs"].as_f64().unwrap_or(0.0) <= 0.0
        || value["title"].as_str().unwrap_or("").trim().is_empty()
        || value["artist"].as_str().unwrap_or("").trim().is_empty()) { return Err("invalid_message"); }
    Ok(())
}

fn validate_features(value: &Value) -> Result<(), &'static str> {
    let object = value.as_object().ok_or("invalid_message")?;
    validate_provider(object.get("provider"))?;
    for key in [
        "energy01",
        "beatConfidence01",
        "beatPhase01",
        "onsetDensity01",
    ] {
        let number = object
            .get(key)
            .and_then(Value::as_f64)
            .ok_or("invalid_message")?;
        if !number.is_finite() || !(0.0..=1.0).contains(&number) {
            return Err("invalid_message");
        }
    }
    let bpm = object
        .get("bpm")
        .and_then(Value::as_f64)
        .ok_or("invalid_message")?;
    if !bpm.is_finite() || !(0.0..=400.0).contains(&bpm) {
        return Err("invalid_message");
    }
    object
        .get("beatPulse")
        .and_then(Value::as_bool)
        .ok_or("invalid_message")?;
    match object.get("sectionIntensity").and_then(Value::as_str) {
        Some("unknown" | "low" | "medium" | "high") => Ok(()),
        _ => Err("invalid_message"),
    }
}

fn validate_capture_stop(value: &Value) -> Result<(), &'static str> {
    match value.get("reason").and_then(Value::as_str) {
        Some(
            "user"
            | "tab_closed"
            | "unsupported_navigation"
            | "stream_ended"
            | "capture_error"
            | "replaced",
        ) => Ok(()),
        _ => Err("invalid_message"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    struct PartialReader {
        bytes: Cursor<Vec<u8>>,
        maximum_chunk: usize,
    }

    impl Read for PartialReader {
        fn read(&mut self, output: &mut [u8]) -> io::Result<usize> {
            let limit = output.len().min(self.maximum_chunk);
            self.bytes.read(&mut output[..limit])
        }
    }

    fn hello(sequence: u64) -> Value {
        json!({
            "type": "hello",
            "protocolVersion": 1,
            "sequence": sequence,
            "emittedAtUnixMs": 1234,
            "browserSessionId": "session-a",
            "extensionVersion": "0.1.0"
        })
    }

    #[test]
    fn native_framing_round_trips() {
        let value = json!({"type": "host_status", "protocolVersion": 1});
        let mut bytes = Vec::new();
        write_native_value(&mut bytes, &value).unwrap();
        let decoded = read_native_message(&mut Cursor::new(bytes))
            .unwrap()
            .unwrap();
        assert_eq!(serde_json::from_slice::<Value>(&decoded).unwrap(), value);
    }

    #[test]
    fn native_framing_supports_partial_reads() {
        let value = hello(1);
        let mut bytes = Vec::new();
        write_native_value(&mut bytes, &value).unwrap();
        let mut reader = PartialReader {
            bytes: Cursor::new(bytes),
            maximum_chunk: 2,
        };
        let decoded = read_native_message(&mut reader).unwrap().unwrap();
        assert_eq!(serde_json::from_slice::<Value>(&decoded).unwrap(), value);
    }

    #[test]
    fn native_framing_treats_clean_eof_as_shutdown() {
        assert!(
            read_native_message(&mut Cursor::new(Vec::<u8>::new()))
                .unwrap()
                .is_none()
        );
    }

    #[test]
    fn invalid_json_returns_fixed_error_status() {
        let mut input = Vec::new();
        input.extend_from_slice(&5u32.to_le_bytes());
        input.extend_from_slice(b"nope!");
        let mut output = Vec::new();
        run(&mut Cursor::new(input), &mut output).unwrap();
        let response = read_native_message(&mut Cursor::new(output))
            .unwrap()
            .unwrap();
        let status: Value = serde_json::from_slice(&response).unwrap();
        assert_eq!(status["errorCode"], "invalid_message");
    }

    #[test]
    fn native_framing_rejects_oversize() {
        let mut bytes = Vec::from(((MAX_MESSAGE_BYTES + 1) as u32).to_le_bytes());
        bytes.resize(MAX_MESSAGE_BYTES + 5, 0);
        assert_eq!(
            read_native_message(&mut Cursor::new(bytes))
                .unwrap_err()
                .kind(),
            io::ErrorKind::InvalidData
        );
    }

    #[test]
    fn validator_rejects_replayed_sequence() {
        let mut validator = MessageValidator::default();
        validator.validate(&hello(1)).unwrap();
        assert_eq!(validator.validate(&hello(1)), Err("invalid_message"));
    }

    #[test]
    fn provider_allowlist_accepts_playback_and_features_and_rejects_unknown_sites() {
        let providers = [
            "spotify_web",
            "youtube_music",
            "soundcloud",
            "apple_music",
            "amazon_music",
            "deezer",
            "tidal",
            "qobuz",
            "pandora",
            "yandex_music",
            "qq_music",
            "kugou",
            "jiosaavn",
            "line_music",
            "bugs",
            "joox",
            "anghami",
            "audiomack",
            "custom_site",
            "unknown_site",
        ];
        for provider in providers {
            let playback = json!({
                "type": "playback_state", "protocolVersion": 1, "sequence": 1,
                "emittedAtUnixMs": 1234, "browserSessionId": "session-a", "provider": provider,
                "playing": true, "hasTitle": true, "hasArtist": true,
                "hasTimeline": true, "captureActive": true
            });
            let features = json!({
                "type": "music_features", "protocolVersion": 1, "sequence": 1,
                "emittedAtUnixMs": 1234, "browserSessionId": "session-a", "provider": provider,
                "energy01": 0.5, "bpm": 120, "beatConfidence01": 0.8,
                "beatPhase01": 0.2, "beatPulse": false, "onsetDensity01": 0.3,
                "sectionIntensity": "medium"
            });
            for message in [playback, features] {
                assert_eq!(
                    MessageValidator::default().validate(&message).is_ok(),
                    provider != "unknown_site",
                    "provider {provider}, type {}",
                    message["type"]
                );
            }
        }
    }

    #[test]
    fn validator_rejects_out_of_range_numbers() {
        let value = json!({
            "type": "music_features",
            "protocolVersion": 1,
            "sequence": 1,
            "emittedAtUnixMs": 1234,
            "browserSessionId": "session-a",
            "provider": "spotify_web",
            "energy01": 0.5,
            "bpm": 401,
            "beatConfidence01": 0.8,
            "beatPhase01": 0.2,
            "beatPulse": false,
            "onsetDensity01": 0.3,
            "sectionIntensity": "medium"
        });
        assert_eq!(
            MessageValidator::default().validate(&value),
            Err("invalid_message")
        );
    }

    #[test]
    fn validator_rejects_private_free_form_fields_by_message_shape() {
        let mut value = hello(1);
        value["type"] = json!("playback_state");
        value["provider"] = json!("spotify_web");
        value["playing"] = json!(true);
        value["hasTitle"] = json!(true);
        value["hasArtist"] = json!(true);
        value["hasTimeline"] = json!(true);
        value["captureActive"] = json!(false);
        value["title"] = json!("must not pass");
        assert_eq!(
            MessageValidator::default().validate(&value),
            Err("invalid_message")
        );
    }

    #[test]
    fn rate_limiter_allows_thirty_messages() {
        let mut limiter = RateLimiter::default();
        let now = Instant::now();
        for _ in 0..MAX_MESSAGES_PER_SECOND {
            assert!(limiter.accept_at(now));
        }
        assert!(!limiter.accept_at(now));
        assert!(limiter.accept_at(now + Duration::from_secs(1)));
    }

    #[test]
    fn host_status_validation_rejects_unknown_fields_and_errors() {
        let valid = host_status_value(true, true, "none");
        validate_host_status(&valid).unwrap();
        assert!(is_accepted_handshake_status(&valid));

        let busy = host_status_value(false, true, "busy");
        validate_host_status(&busy).unwrap();
        assert!(!is_accepted_handshake_status(&busy));

        let mut unknown_field = valid.clone();
        unknown_field["diagnostic"] = json!("must not pass");
        assert_eq!(
            validate_host_status(&unknown_field).unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );

        let mut unknown_error = valid;
        unknown_error["errorCode"] = json!("free_form_error");
        assert_eq!(
            validate_host_status(&unknown_error).unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
    }

    #[test]
    fn transient_handshake_error_stays_inside_the_native_loop() {
        let mut input = Vec::new();
        write_native_value(&mut input, &hello(1)).unwrap();
        let mut output = Vec::new();
        let result = run_with_connector(&mut Cursor::new(input), &mut output, || {
            Err(io::Error::new(io::ErrorKind::TimedOut, "fake timeout"))
        });

        assert!(result.is_ok());
        let response = read_native_message(&mut Cursor::new(output))
            .unwrap()
            .unwrap();
        let status: Value = serde_json::from_slice(&response).unwrap();
        assert_eq!(status["errorCode"], "phasepal_unavailable");
    }

    #[test]
    fn rejected_handshake_preserves_busy_status() {
        let mut input = Vec::new();
        write_native_value(&mut input, &hello(1)).unwrap();
        let mut output = Vec::new();
        run_with_connector(&mut Cursor::new(input), &mut output, || {
            Ok(BridgeConnectOutcome::Rejected(host_status_value(
                false, true, "busy",
            )))
        })
        .unwrap();

        let mut framed = Cursor::new(output);
        let response = read_native_message(&mut framed).unwrap().unwrap();
        let status: Value = serde_json::from_slice(&response).unwrap();
        assert_eq!(status["errorCode"], "busy");
        assert!(read_native_message(&mut framed).unwrap().is_none());
    }
    #[test]
    fn lyric_packets_require_v2_and_bounded_fields() {
        let packet = json!({"type":"lyrics_playback", "protocolVersion":2, "sequence":1,
            "emittedAtUnixMs":1000, "browserSessionId":"session", "provider":"spotify_web",
            "sourceId":"document", "trackId":"track", "title":"Example", "artist":"Artist",
            "durationMs":60000, "positionMs":12000, "playbackRate":1.0,
            "playing":true, "buffering":false, "available":true});
        assert!(MessageValidator::default().validate(&packet).is_ok());
        for field in ["title", "positionMs", "sourceId", "buffering"] {
            let mut invalid = packet.clone();
            invalid.as_object_mut().unwrap().remove(field);
            assert!(MessageValidator::default().validate(&invalid).is_err());
        }
        for (field, bad) in [("protocolVersion", json!(1)), ("title", json!("x".repeat(257))),
            ("positionMs", json!(60001)), ("playbackRate", json!(0)), ("url", json!("https://example.com"))] {
            let mut invalid = packet.clone(); invalid[field] = bad;
            assert!(MessageValidator::default().validate(&invalid).is_err());
        }
    }

    #[test]
    fn lyric_status_is_optional_only_for_legacy_protocol() {
        let legacy = json!({"type":"host_status", "protocolVersion":1, "phasePalConnected":true,
            "danceToMusicEnabled":true, "errorCode":"none"});
        assert!(validate_host_status(&legacy).is_ok());
        let mut modern = legacy.clone(); modern["protocolVersion"] = json!(2);
        assert!(validate_host_status(&modern).is_err());
        modern["lyricsRequested"] = json!(false);
        assert!(validate_host_status(&modern).is_ok());
        modern["protocolVersion"] = json!(1);
        assert!(validate_host_status(&modern).is_err());
    }

}
