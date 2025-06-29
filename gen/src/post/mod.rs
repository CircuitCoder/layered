use std::{collections::HashMap, os::unix::prelude::OsStrExt, path::Path, sync::LazyLock};

use chrono::TimeZone;
use git2::{Oid, Sort};
use rayon::iter::{IntoParallelIterator, ParallelIterator};
use regex::Regex;
use serde::Serialize;

use crate::{font::TitleResp, post::md::ParsedMarkdown};

mod md;

#[derive(Debug, Serialize, ts_rs::TS)]
#[ts(export)]
#[serde(rename_all = "lowercase")]
pub struct Post {
    pub metadata: Metadata,
    pub html: String,
    pub plain: String,
}

type DT = chrono::DateTime<chrono::FixedOffset>;

#[derive(Debug, Serialize, ts_rs::TS)]
#[serde(rename_all = "lowercase")]
pub struct Metadata {
    pub id: String,
    pub title: String,
    pub tags: Vec<String>,
    #[ts(type = "string")]
    pub publish_time: DT,
    #[ts(as = "Option<String>")]
    pub update_time: Option<DT>,
    pub title_outline: TitleResp,
    pub hidden: bool,
    pub wip: bool,
    pub legacy: bool,
}

// Fetch history based on git repo
fn revwalk_time<A, P>(dir: P, mut action: A) -> anyhow::Result<()>
where
    P: AsRef<Path>,
    A: FnMut(&str, DT, Oid),
{
    let repo = git2::Repository::discover(&dir)?;
    log::debug!("Found repository at {}", repo.path().display());
    let mut revwalk = repo.revwalk()?;
    revwalk.set_sorting(Sort::TIME | Sort::TOPOLOGICAL | Sort::REVERSE)?;
    revwalk.reset()?;
    revwalk.push_head()?;

    let mut repodir = std::fs::canonicalize(repo.path())?;
    repodir.pop();

    let dir_abs = std::fs::canonicalize(dir.as_ref())?;
    let dir_rel = dir_abs.as_path().strip_prefix(&repodir)?;

    for oid in revwalk {
        let oid = oid?;
        log::debug!("Revwalk: {}", oid);
        let commit = repo.find_commit(oid)?;
        let time_raw = commit.author().when();
        let timezone = chrono::FixedOffset::east_opt(time_raw.offset_minutes() * 60).unwrap();
        let time = timezone
            .timestamp_opt(time_raw.seconds(), 0)
            .single()
            .ok_or_else(|| anyhow::anyhow!("Cannot parse time"))?;

        let base_tree = commit.tree()?;
        let dir_ent = match base_tree.get_path(dir_rel) {
            Err(_) => {
                // Not found, content is not in repo yet
                continue;
            }
            Ok(r) => r,
        };

        let dir_obj = dir_ent.to_object(&repo)?;
        let dir_tree = dir_obj
            .as_tree()
            .ok_or_else(|| anyhow::anyhow!("Unable to read as tree"))?;
        for content in dir_tree.iter() {
            let name = std::str::from_utf8(content.name_bytes())?;
            log::debug!("Walk at {}", name);
            action(name, time, content.id());
        }
    }

    Ok(())
}

static FILENAME_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\d{4}-\d{2}-\d{2}-(.*)\.md").unwrap());

pub fn file_name_to_id(filename: &str) -> anyhow::Result<&str> {
    let filename_match = FILENAME_RE
        .captures(&filename)
        .ok_or_else(|| anyhow::anyhow!("Unable to parse filename: {}", filename))?;
    Ok(filename_match.get(1).unwrap().as_str())
}

fn serialize_single(
    filename: &str,
    pre: ParsedMarkdown,
    creation: Option<(DT, Oid)>,
    update: Option<(DT, Oid)>,
    title_font: &ttf_parser::Face,
) -> anyhow::Result<Post> {
    log::info!("Processing {}", filename);
    let publish_time = pre
        .metadata
        .force_publish_time
        .or(creation.map(|e| e.0))
        .unwrap_or_else(|| {
            log::warn!("Unpublished post: {}", filename);
            chrono::Local::now().fixed_offset()
        });
    // TODO: check filename for publish time, check if they match
    let reduced_update_time = update.and_then(|(t, id)| {
        if id == creation.unwrap().1 {
            None
        } else {
            Some(t)
        }
    });
    let update_time = pre.metadata.force_update_time.or(reduced_update_time);

    let title_outline: TitleResp = crate::font::parse_title(&pre.metadata.title, title_font)?;

    Ok(Post {
        html: pre.html,
        plain: pre.plain,
        metadata: Metadata {
            id: file_name_to_id(filename)?.to_owned(),
            title: pre.metadata.title,
            tags: pre.metadata.tags,
            hidden: pre.metadata.hidden,
            wip: pre.metadata.wip,
            legacy: pre.metadata.legacy,
            publish_time,
            update_time,
            title_outline,
        },
    })
}

type IncompleteStore = HashMap<String, (ParsedMarkdown, Option<(DT, Oid)>, Option<(DT, Oid)>)>;
pub fn revwalk_update_store(
    dir: impl AsRef<Path>,
    store: &mut IncompleteStore,
) -> anyhow::Result<()> {
    revwalk_time(&dir, |filename, time, oid| {
        let cached = store.get_mut(filename);
        if let Some((_, ref mut creation, ref mut update)) = cached {
            if update.is_none() || update.unwrap().1 == oid {
                *update = Some((time, oid));
            }
            // TODO: asserts that if creation already exists, it cannot come before `time`
            *creation = Some((time, oid));
        }
    })
}

pub fn readdir<P: AsRef<Path>>(
    dir: P,
    title_font: &ttf_parser::Face,
) -> anyhow::Result<HashMap<String, Post>> {
    let entries = std::fs::read_dir(&dir)?;
    let mut pre: HashMap<String, (ParsedMarkdown, Option<(DT, Oid)>, Option<(DT, Oid)>)> =
        HashMap::new();

    for entry in entries {
        let entry = entry?;
        let file = std::fs::read_to_string(entry.path())?;
        log::info!("Parsing {}", entry.file_name().to_string_lossy());
        let parsed = md::parse(&file)?;
        pre.insert(
            String::from_utf8(entry.file_name().as_bytes().to_vec())?.to_string(),
            (parsed, None, None),
        );
    }

    revwalk_update_store(&dir, &mut pre)?;

    pre.into_par_iter()
        .map(
            |(filename, (pre, creation, update))| -> anyhow::Result<(String, Post)> {
                let serialized = serialize_single(&filename, pre, creation, update, title_font)?;
                Ok((filename, serialized))
            },
        )
        .collect()
}

pub fn refresh_paths<P: AsRef<Path>, I: Iterator<Item = P>>(
    dir: impl AsRef<Path>,
    paths: I,
    title_font: &ttf_parser::Face,
) -> anyhow::Result<HashMap<String, Option<Post>>> {
    let mut pre: HashMap<String, (ParsedMarkdown, Option<(DT, Oid)>, Option<(DT, Oid)>)> =
        HashMap::new();
    let mut skipped = Vec::new();

    for path in paths {
        let parsed = match std::fs::read_to_string(&path)
            .map_err(Into::into)
            .and_then(|content| md::parse(&content))
        {
            Ok(parsed) => parsed,
            Err(e) => {
                log::info!("Unable to read file: {}", e);
                let filename = path
                    .as_ref()
                    .file_name()
                    .unwrap()
                    .to_str()
                    .unwrap()
                    .to_owned();
                skipped.push(filename);
                continue;
            }
        };

        pre.insert(
            path.as_ref()
                .file_name()
                .unwrap()
                .to_str()
                .unwrap()
                .to_owned(),
            (parsed, None, None),
        );
    }

    revwalk_update_store(&dir, &mut pre)?;

    let mut collected = pre.into_par_iter().map(
        |(filename, (pre, creation, update))| {
            let serialized = serialize_single(&filename, pre, creation, update, title_font)?;
            Ok((filename, Some(serialized)))
        }
    ).collect::<anyhow::Result<HashMap<_, _>>>()?;

    for s in skipped {
        collected.insert(s, None);
    }
    Ok(collected)
}
