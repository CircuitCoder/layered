use crate::post::Post;
use atom_syndication::{Entry, EntryBuilder, Feed, Generator, LinkBuilder, Person, Text};
use serde::Deserialize;
use url::Url;

#[derive(Deserialize)]
pub struct FeedConfig {
    title: String,
    description: String,
    base: String,
    author: String,
}

fn entry(cfg: &FeedConfig, post: &Post, summary_len: usize) -> anyhow::Result<Entry> {
    let uri = format!("{}/post/{}", cfg.base, post.metadata.id);
    let uri = Url::parse(&uri)?;

    let mut summary_len = summary_len;
    if summary_len > post.plain.len() {
        summary_len = post.plain.len();
    } else {
        while !post.plain.is_char_boundary(summary_len) {
            summary_len += 1;
        }
    }

    let summary = if summary_len == post.plain.len() {
        post.plain.to_owned()
    } else {
        post.plain[..summary_len].to_owned() + "..."
    };

    let entry = EntryBuilder::default()
        .id(uri.clone())
        .title(post.metadata.title.clone())
        .updated(
            post.metadata
                .update_time
                .unwrap_or(post.metadata.publish_time),
        )
        .link(
            LinkBuilder::default()
                .href(uri)
                .rel("alternate".to_owned())
                .build(),
        )
        .summary(Text::plain(summary)) // TODO: use summary instead if we got an auto-summarizer
        .build();

    // TODO: english version

    Ok(entry)
}

pub fn feed<'a, I: Iterator<Item = &'a Post> + Clone>(cfg: &FeedConfig, posts: I, summary_len: usize) -> anyhow::Result<Feed> {
    let latest_modification = posts.clone()
        .map(|p| p.metadata.update_time.unwrap_or(p.metadata.publish_time))
        .max()
        .unwrap();

    let entries: Vec<_> = posts.filter_map(|p| {
        (!p.metadata.hidden).then(|| entry(cfg, p, summary_len))
    }).try_collect()?;

    let generator = Generator {
        value: "Layered".to_owned(),
        uri: Some("https://github.com/CircuitCoder/layered".to_owned()),
        ..Default::default()
    };

    let base_uri = Url::parse(&cfg.base)?;
    let feed_uri = format!("{}/feed.xml", base_uri);
    let feed_uri = Url::parse(&feed_uri)?;

    let feed = atom_syndication::FeedBuilder::default()
        .id(format!("{}/feed.xml", cfg.base))
        .title(cfg.title.clone())
        .updated(latest_modification)
        .author(Person {
            name: cfg.author.clone(),
            ..Person::default()
        })
        .link(
            LinkBuilder::default()
                .href(feed_uri)
                .rel("alternate".to_owned())
                .build(),
        )
        .link(
            LinkBuilder::default()
                .href(base_uri)
                .rel("self".to_owned())
                .build(),
        )
        .generator(generator)
        // TODO: icon and logo
        .subtitle(Text::plain(cfg.description.clone()))
        .entries(entries)
        .build();

    Ok(feed)
}
