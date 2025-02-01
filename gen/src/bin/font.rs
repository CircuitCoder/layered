use std::{fs::File, io::Read, path::PathBuf};

use clap::Parser;
use ttf_parser::Tag;

#[derive(Parser)]
struct Args {
    /// Path to font file
    #[arg(short, long)]
    font: PathBuf,

    /// Variable wght
    #[arg(short, long)]
    wght: Option<f32>,
}

fn main() -> anyhow::Result<()> {
    let args = Args::parse();
    env_logger::init();

    log::info!("Loading font from {}", args.font.display());
    let mut font_file = File::open(args.font)?;
    let mut font_buf = Vec::new();
    font_file.read_to_end(&mut font_buf)?;
    let mut font: ttf_parser::Face = ttf_parser::Face::parse(font_buf.as_slice(), 0)?;

    for axis in font.variation_axes() {
        log::debug!("{:#?}", axis);
    }

    if let Some(wght) = args.wght {
        log::debug!("Setting {:#?} to {}", Tag::from_bytes(b"wght"), wght);
        font.set_variation(Tag::from_bytes(b"wght"), wght).unwrap();
    }

    let stdin = std::io::stdin();
    let mut input = String::new();
    while stdin.read_line(&mut input)? != 0 {
        let converted: anyhow::Result<Vec<_>> = input
            .trim()
            .chars()
            .map(|c| pointwise_gen::font::parse_char(c, &font))
            .collect();
        let converted = converted?;
        println!("{}", serde_json::to_string_pretty(&converted)?);
    }

    Ok(())
}
