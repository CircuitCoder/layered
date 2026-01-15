use std::{collections::HashSet, fs::File, io::Read, path::PathBuf};

use clap::Parser;
use generator::feed::FeedConfig;
use notify_debouncer_full::notify;
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
    #[arg(long)]
    wght: Option<f32>,

    /// Feed generation
    #[arg(short, long, requires = "feed_cfg")]
    feed: Option<PathBuf>,

    /// Feed configuration
    #[arg(long, requires = "feed")]
    feed_cfg: Option<PathBuf>,

    /// Font subset output
    #[arg(long)]
    subset_font: Option<PathBuf>,

    /// Feed summary target length in bytes
    #[arg(long, default_value = "200")]
    feed_summary_len: usize,

    /// Watch mode
    #[arg(short, long)]
    watch: bool,
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
    let mut font_file = File::open(&args.title_font)?;
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
    let mut posts = generator::post::readdir(&args.posts, &font)?;

    // Enable watch mode
    let watch_rx = if args.watch {
        log::info!("Enable watch mode");
        let (tx, rx) = std::sync::mpsc::channel();
        let mut watcher =
            notify_debouncer_full::new_debouncer(std::time::Duration::from_millis(200), None, tx)?;
        watcher.watch(
            &args.posts,
            notify_debouncer_full::notify::RecursiveMode::Recursive,
        )?;
        Some((rx, watcher)) // Keep watcher alive
    } else {
        None
    };

    loop {
        let mut posts_vec: Vec<_> = posts.values().collect();
        posts_vec.sort_by(|a, b| b.metadata.publish_time.cmp(&a.metadata.publish_time));

        log::debug!("Writing to: {}", args.output.display());
        serde_json::to_writer(std::fs::File::create(&args.output)?, &posts_vec)?;

        if let Some(ref f) = feed_cfg {
            let dst = args.feed.as_ref().unwrap();
            log::info!("Generating feed to: {}", dst.display());

            let feed =
                generator::feed::feed(&f, posts_vec.iter().map(|e| *e), args.feed_summary_len)?;
            feed.write_to(File::create(dst)?)?;
        }

        // TODO: check if subset changed
        if let Some(ref f) = args.subset_font {
            log::info!("Generating subset font to: {}", f.display());
            generator::font::generate_subset_to(
                &args.title_font,
                std::iter::once("分层")
                    .chain(posts.values().map(|p| p.metadata.title.as_str()))
                    .chain(
                        posts_vec
                            .iter()
                            .flat_map(|p| p.metadata.tags.iter().map(String::as_str)),
                    ),
                f,
            )?;
        }

        if !args.watch {
            break Ok(());
        }

        loop {
            let evs = watch_rx.as_ref().unwrap().0.recv()?.unwrap(); // TODO: Don't unwrap here!
            let mut all_paths = HashSet::new();
            let mut has_update = false;
            for ev in evs.into_iter() {
                log::debug!("Event: {:?}", ev);
                if let notify::EventKind::Access(_) = ev.event.kind {
                    continue;
                }
                if let notify::EventKind::Modify(notify::event::ModifyKind::Metadata(_)) =
                    ev.event.kind
                {
                    continue;
                }

                all_paths.extend(
                    ev.event
                        .paths
                        .into_iter()
                        .filter(|p| !p.exists() || p.is_file()),
                );
            }

            let updates = generator::post::refresh_paths(&args.posts, all_paths.iter(), &font)?;
            for (filename, post) in updates {
                if let Some(post) = post {
                    log::info!("Update: {}", filename);
                    posts.insert(filename, post);
                    has_update |= true;
                } else {
                    log::info!("Remove: {}", filename);
                    has_update |= posts.remove(&filename).is_some();
                }
            }

            if has_update {
                break;
            }
        }
    }
}
