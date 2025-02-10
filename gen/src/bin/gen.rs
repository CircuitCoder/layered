use std::{fs::File, io::Read, path::PathBuf};

use clap::Parser;
use gen::feed::FeedConfig;
use ttf_parser::Tag;

#[derive(Parser)]
struct Args {
    /// Path to post directory
    #[arg(short, long)]
    posts: PathBuf,

    /// Path to font file used for title outlining
    #[arg(short, long)]
    title_font: PathBuf,

    /// Output path
    #[arg(short, long, default_value = "out")]
    output: PathBuf,

    /// Variable wght
    #[arg(short, long)]
    wght: Option<f32>,

    /// Feed generation
    #[arg(short, long, requires = "feed_cfg")]
    feed: Option<PathBuf>,

    /// Feed configuration
    #[arg(long, requires = "feed")]
    feed_cfg: Option<PathBuf>,
}

fn main() -> anyhow::Result<()> {
    let args = Args::parse();
    env_logger::init();

    let feed_cfg: Option<FeedConfig> = if let Some(ref p) = args.feed_cfg {
        let file = File::open(p)?;
        serde_json::from_reader(file)?
    } else {
        None
    };

    log::info!("Loading font from {}", args.title_font.display());
    let mut font_file = File::open(args.title_font)?;
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

    log::info!("Loading posts from {}", args.posts.display());
    let posts = gen::post::readdir(&args.posts, &font)?;

    log::debug!("Writing to: {}", args.output.display());
    serde_json::to_writer(std::fs::File::create(args.output)?, &posts)?;

    if let Some(f) = feed_cfg {
        let dst = args.feed.unwrap();
        log::info!("Generating feed to: {}", dst.display());

        let feed = gen::feed::feed(&f, &posts)?;
        feed.write_to(File::create(dst)?)?;
    }

    Ok(())
}
