use std::collections::HashMap;

use pointwise_common::font::TitleResp;
use serde::Serialize;

use crate::post::Post;

#[derive(Serialize, Clone)]
pub struct Entry<'a> {
    title_outline: &'a TitleResp,
    title: &'a str,
    id: &'a str,
    publish_time: &'a chrono::DateTime<chrono::FixedOffset>,
}

#[derive(Serialize, Clone)]
pub struct Tag<'a> {
    title: &'a str,
    ids: Vec<&'a str>,
}

#[derive(Serialize)]
pub struct Taxonomy<'a> {
    tags: Vec<Tag<'a>>,
    entries: Vec<Entry<'a>>,
}

pub fn build_taxonomy<'a>(posts: &'a [Post]) -> Taxonomy {
    // Implicit tag index
    let mut buckets = HashMap::new();
    let mut entries = Vec::new();

    for post in posts {
        let entry = Entry {
            title_outline: &post.metadata.title_outline,
            title: &post.metadata.title,
            id: &post.metadata.id,
            publish_time: &post.metadata.publish_time,
        };

        entries.push(entry);

        for tag in &post.metadata.tags {
            buckets.entry(tag).or_insert(Vec::new()).push(post.metadata.id.as_str())
        }
    }

    let tags: Vec<_> = buckets.into_iter().map(|(k, v)| Tag {
        title: k,
        ids: v,
    }).collect();

    let taxonomy = Taxonomy {
        tags,
        entries,
    };

    taxonomy
}