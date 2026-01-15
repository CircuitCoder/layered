use std::{collections::HashMap, os::unix::prelude::OsStrExt, path::Path, sync::LazyLock};

use chrono::TimeZone;
use git2::{DiffFindOptions, DiffOptions, Oid, Sort};
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
    pub img: Option<String>,
}

static FILENAME_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\d{4}-\d{2}-\d{2}-(.*)\.md").unwrap());

pub fn file_name_to_id(filename: &str) -> anyhow::Result<&str> {
    let filename_match = FILENAME_RE
        .captures(&filename)
        .ok_or_else(|| anyhow::anyhow!("Unable to parse filename: {}", filename))?;
    Ok(filename_match.get(1).unwrap().as_str())
}

fn find_image(html: &str) -> Option<String> {
    use scraper::*;
    let parsed = Html::parse_fragment(html);
    let selector = Selector::parse("img.preview").unwrap();
    let found = parsed.select(&selector).next()?;
    found.value().attr("src").map(str::to_string)
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
    let img = find_image(&pre.html);

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
            img,
        },
    })
}

struct LatestFile {
    content: ParsedMarkdown,
    created: Option<DT>,
    updated: Option<DT>,
}

impl LatestFile {
    fn new(content: ParsedMarkdown) -> Self {
        Self {
            content,
            created: None,
            updated: None,
        }
    }

    fn serialize(self, filename: &str, title_font: &ttf_parser::Face) -> anyhow::Result<Post> {
        serialize_single(
            filename,
            self.content,
            self.created.map(|t| (t, Oid::zero())),
            self.updated.map(|t| (t, Oid::zero())),
            title_font,
        )
    }
}

#[derive(Clone)]
struct RenameMapping {
    // Current file name at revwalk commit -> latest file name
    forward: HashMap<String, String>,
}

impl RenameMapping {
    fn push_rename(&mut self, older: &str, newer: &str) {
        // Handle rename older -> newer, current RenameDetector may have newer -> latest
        if !self.forward.contains_key(newer) {
            return;
        }

        let latest = self.forward.remove(newer).unwrap();
        self.forward.insert(older.to_string(), latest);
    }

    fn push_add(&mut self, added: &str) {
        // Because we're doing revwalk in reverse, a new file means a deleted mapping
        self.forward.remove(added);
    }

    fn query(&self, name: &str) -> Option<&str> {
        self.forward.get(name).map(|s| s.as_str())
    }
}

#[derive(Hash, Eq, PartialEq, Debug)]
enum Revlike {
    WorkingDir,
    Commit(Oid),
}

impl Revlike {
    fn parents(&self, repo: &git2::Repository) -> Vec<Revlike> {
        match self {
            Revlike::WorkingDir => vec![Revlike::Commit(repo.head().unwrap().target().unwrap())],
            Revlike::Commit(oid) => {
                let commit = repo.find_commit(*oid).unwrap();
                commit.parents().map(|p| Revlike::Commit(p.id())).collect()
            }
        }
    }

    fn diff<'s, 'r>(&'s self, repo: &'r git2::Repository) -> anyhow::Result<git2::Diff<'r>> {
        match self {
            Revlike::WorkingDir => {
                let head_commit = repo.find_commit(repo.head().unwrap().target().unwrap())?;
                let head_tree = head_commit.tree()?;
                let diff = repo.diff_tree_to_workdir(
                    Some(&head_tree),
                    Some(DiffOptions::new().include_untracked(true)),
                )?;
                Ok(diff)
            }
            Revlike::Commit(oid) => {
                let commit = repo.find_commit(*oid)?;
                let tree = commit.tree()?;
                let first_parent_tree: Option<git2::Tree<'_>> = if commit.parent_count() > 0 {
                    Some(commit.parent(0)?.tree()?)
                } else {
                    None
                };
                let diff = repo.diff_tree_to_tree(first_parent_tree.as_ref(), Some(&tree), None)?;
                Ok(diff)
            }
        }
    }

    fn time(&self, repo: &git2::Repository) -> Option<git2::Time> {
        let commit = match self {
            Revlike::WorkingDir => return None,
            Revlike::Commit(oid) => repo.find_commit(*oid).unwrap(),
        };

        let msg = commit.message();
        if msg.is_none() {
            log::warn!("Unparsable commit message at {}", commit.id());
        } else if msg.unwrap().contains("[skip time]") {
            log::debug!("Skipping due to [skip time]");
            return None;
        }

        let time = commit.author().when();
        Some(time)
    }
}

struct ReaddirContext {
    store: HashMap<String, LatestFile>,
    // Commit -> Rename state. Marks the state *AFTER* the commit.
    rename: HashMap<Revlike, RenameMapping>,
}

impl ReaddirContext {
    fn new(store: HashMap<String, LatestFile>) -> Self {
        let mut rename_head = RenameMapping {
            forward: HashMap::new(),
        };
        for key in store.keys() {
            rename_head.forward.insert(key.clone(), key.clone());
        }
        let mut rename = HashMap::new();
        rename.insert(Revlike::WorkingDir, rename_head);
        Self { store, rename }
    }
}

fn revwalk_update_store(
    dir: impl AsRef<Path>,
    parsed: HashMap<String, ParsedMarkdown>,
) -> anyhow::Result<HashMap<String, LatestFile>> {
    let dir = &dir;

    let repo = git2::Repository::discover(&dir)?;
    log::debug!("Found repository at {}", repo.path().display());
    let mut revwalk = repo.revwalk()?;
    revwalk.set_sorting(Sort::TIME | Sort::TOPOLOGICAL | Sort::REVERSE)?;
    revwalk.reset()?;
    revwalk.push_head()?;

    let parsed = parsed
        .into_iter()
        .map(|(k, v)| (k, LatestFile::new(v)))
        .collect();
    let mut ctx = ReaddirContext::new(parsed);

    let mut repodir = std::fs::canonicalize(repo.path())?;
    repodir.pop();

    let dir_abs = std::fs::canonicalize(dir.as_ref())?;
    let dir_rel = dir_abs.as_path().strip_prefix(&repodir)?;

    let revs: impl Iterator<Item = anyhow::Result<Revlike>> =
        std::iter::once(anyhow::Result::Ok(Revlike::WorkingDir))
            .chain(revwalk.map(|r| Ok(Revlike::Commit(r?))));

    for rev in revs {
        let rev = rev?;
        log::debug!("Revwalk: {:?}", rev);

        let rename_state = ctx.rename.get(&rev).unwrap();

        let mut diff = rev.diff(&repo)?;
        diff.find_similar(Some(
            DiffFindOptions::new()
                .renames(true)
                .ignore_whitespace(true)
                .for_untracked(true)
                .remove_unmodified(true)
                .renames_from_rewrites(true)
                .exact_match_only(true), // https://github.com/libgit2/libgit2/issues/7196
        ))?;

        /* Time Tracking */
        let time_raw = rev.time(&repo);
        let time = if let Some(time_raw) = time_raw {
            let timezone = chrono::FixedOffset::east_opt(time_raw.offset_minutes() * 60).unwrap();
            Some(
                timezone
                    .timestamp_opt(time_raw.seconds(), 0)
                    .single()
                    .ok_or_else(|| anyhow::anyhow!("Cannot parse time"))?,
            )
        } else {
            None
        };

        let mut derived_rename_state = rename_state.clone();

        // Handles new and updated files
        for delta in diff.deltas() {
            let status = delta.status();
            log::info!(
                "Delta: {:?} {:?} -> {:?}",
                status,
                delta.old_file().path(),
                delta.new_file().path()
            );

            // Check if the file landed in the expected folder
            let new_path = delta.new_file().path().unwrap();
            if !new_path.starts_with(dir_rel) {
                continue;
            }
            let file_path = new_path.strip_prefix(dir_rel).unwrap();
            // Check that file_path is a direct child
            if file_path.components().count() != 1 {
                log::warn!("Ignoring non-direct child file: {}", file_path.display());
                continue;
            }

            let filename = file_path.file_name().unwrap().to_str().unwrap();
            let Some(latest_name) = rename_state.query(filename) else {
                // Not of interest
                continue;
            };

            assert_ne!(status, git2::Delta::Deleted); // Deleted files should not be of interest
            if let Some(time) = time
                && status != git2::Delta::Unmodified
            {
                let file = ctx.store.get_mut(latest_name).unwrap(); // Must exist
                // Find latest update. The comparison is for the case of diverging history
                if file.updated.is_none() || file.updated.as_ref().unwrap() < &time {
                    file.updated = Some(time);
                }

                if file.created.is_none() || file.created.as_ref().unwrap() > &time {
                    file.created = Some(time);
                }
            }

            let mut is_newfile = status == git2::Delta::Added;

            if status == git2::Delta::Renamed {
                // Check that the rename did not escape the content folder
                let old_path = delta.old_file().path().unwrap();
                if !old_path.starts_with(dir_rel) {
                    is_newfile = true;
                } else if old_path.strip_prefix(dir_rel).unwrap().components().count() != 1 {
                    is_newfile = true;
                } else {
                    let old_filename = old_path.file_name().unwrap().to_str().unwrap();
                    log::info!("Detect rename: {} -> {}", old_filename, filename);
                    derived_rename_state.push_rename(old_filename, filename);
                }
            }

            if is_newfile {
                derived_rename_state.push_add(filename);
            }
        }

        for parent in rev.parents(&repo) {
            if ctx.rename.contains_key(&parent) {
                continue;
            }
            ctx.rename.insert(parent, derived_rename_state.clone());
        }
    }

    Ok(ctx.store)
}

pub fn readdir<P: AsRef<Path>>(
    dir: P,
    title_font: &ttf_parser::Face,
) -> anyhow::Result<HashMap<String, Post>> {
    let entries = std::fs::read_dir(&dir)?;
    let mut parsed: HashMap<String, ParsedMarkdown> = HashMap::new();

    for entry in entries {
        let entry = entry?;
        let file = std::fs::read_to_string(entry.path())?;
        log::info!("Parsing {}", entry.file_name().to_string_lossy());
        parsed.insert(
            String::from_utf8(entry.file_name().as_bytes().to_vec())?.to_string(),
            md::parse(&file)?,
        );
    }

    let timed = revwalk_update_store(&dir, parsed)?;

    timed
        .into_par_iter()
        .map(
            |(filename, latest_file)| -> anyhow::Result<(String, Post)> {
                let serialized = latest_file.serialize(&filename, title_font)?;
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
    let mut parsed: HashMap<String, ParsedMarkdown> = HashMap::new();
    let mut skipped = Vec::new();

    for path in paths {
        let file = match std::fs::read_to_string(&path)
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

        parsed.insert(
            path.as_ref()
                .file_name()
                .unwrap()
                .to_str()
                .unwrap()
                .to_owned(),
            file,
        );
    }

    let timed = revwalk_update_store(&dir, parsed)?;

    let mut collected: HashMap<_, _> = timed
        .into_par_iter()
        .map(|(filename, latest_file)| {
            let serialized = latest_file.serialize(&filename, title_font)?;
            Ok((filename, Some(serialized)))
        })
        .collect::<anyhow::Result<_>>()?;

    for s in skipped {
        collected.insert(s, None);
    }
    Ok(collected)
}
