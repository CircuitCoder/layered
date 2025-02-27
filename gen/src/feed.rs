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

fn entry(cfg: &FeedConfig, post: &Post) -> anyhow::Result<Entry> {
    let uri = format!("{}/post/{}", cfg.base, post.metadata.id);
    let uri = Url::parse(&uri)?;

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
        .summary(Text::plain(post.plain.clone())) // TODO: use summary instead if we got an auto-summarizer
        .build();

    // TODO: english version

    Ok(entry)
}

pub fn feed(cfg: &FeedConfig, posts: &[Post]) -> anyhow::Result<Feed> {
    let latest_modification = posts
        .iter()
        .map(|p| p.metadata.update_time.unwrap_or(p.metadata.publish_time))
        .max()
        .unwrap();

    let entries: Vec<_> = posts.iter().map(|p| entry(cfg, p)).try_collect()?;

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
