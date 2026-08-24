use std::io::{self, BufReader, BufWriter};

fn main() {
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut reader = BufReader::new(stdin.lock());
    let mut writer = BufWriter::new(stdout.lock());
    if let Err(error) = phasepal_browser_host::run(&mut reader, &mut writer) {
        eprintln!("[phasepal-browser-host] {error}");
        std::process::exit(1);
    }
}
