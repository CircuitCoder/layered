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

    /// Output suffix (to deal with webpack json loading)
    #[arg(short, long, default_value=".json")]
    suffix: String,
}

fn main() -> anyhow::Result<()> {
    let args = Args::parse();
    env_logger::init();

    log::info!("Loading font from {}", args.title_font.display());
    let mut font_file = File::open(args.title_font)?;
    let mut font_buf = Vec::new();
    font_file.read_to_end(&mut font_buf)?;
    let font: ttf_parser::Face = ttf_parser::Face::from_slice(font_buf.as_slice(), 0)?;
    // TODO: font wght

    log::info!("Loading posts from {}", args.posts.display());
    let posts = pointwise_gen::post::readdir(&args.posts, &font)?;

    let taxonomy = pointwise_gen::taxonomy::build_taxonomy(posts.as_slice());

    log::debug!("Writing to: {:#?}", args.output);
    std::fs::create_dir_all(&args.output)?;

    // Write taxonomy
    let taxonomy_file = std::fs::File::create(args.output.join(format!("taxonomy{}", args.suffix)))?;
    serde_json::to_writer(taxonomy_file, &taxonomy)?;

    // Write posts
    let posts_base = args.output.join("posts");
    std::fs::create_dir_all(&posts_base)?;
    for post in posts {
        let tag_file = std::fs::File::create(posts_base.join(format!("{}{}", post.metadata.id, args.suffix)))?;
        serde_json::to_writer(tag_file, &post)?;
    }

    Ok(())
}
