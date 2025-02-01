use std::{fs::File, io::Read, path::PathBuf};

use clap::Parser;

#[derive(Parser)]
struct Args {
    /// Path to post directory
    #[arg(short, long)]
    posts: PathBuf,

    /// Path to font file used for title outlining
    #[arg(short, long)]
    title_font: PathBuf,

    /// Output path
    #[arg(short, long, default_value="out")]
    output: PathBuf,
}

fn main() -> anyhow::Result<()> {
    let args = Args::parse();
    env_logger::init();

    log::info!("Loading font from {}", args.title_font.display());
    let mut font_file = File::open(args.title_font)?;
    let mut font_buf = Vec::new();
    font_file.read_to_end(&mut font_buf)?;
    let font: ttf_parser::Face = ttf_parser::Face::parse(font_buf.as_slice(), 0)?;
    // TODO: font wght

    log::info!("Loading posts from {}", args.posts.display());
    let posts = gen::post::readdir(&args.posts, &font)?;

    log::debug!("Writing to: {:#?}", args.output);
    serde_json::to_writer(std::fs::File::create(args.output)?, &posts)?;

    Ok(())
}
