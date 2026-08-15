use std::{collections::HashMap, path::{Path, PathBuf}, sync::LazyLock};

use chrono::TimeZone;
use git2::{DiffFindOptions, DiffOptions, Oid, Sort};
use rayon::iter::{IntoParallelIterator, ParallelIterator};
use regex::Regex;
use serde::Serialize;

use crate::font::TitleResp;

mod md;
mod typst;

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
    pub lang: String,
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

pub struct PartialMetadata {
    pub title: String,
    pub tags: Vec<String>,
    pub force_publish_time: Option<chrono::DateTime<chrono::FixedOffset>>,
    pub force_update_time: Option<chrono::DateTime<chrono::FixedOffset>>,
    pub hidden: bool,
    pub wip: bool,
    pub legacy: bool,
}

pub struct Rendered {
    pub metadata: PartialMetadata,
    pub html: String,
    pub plain: String,
}

static FILENAME_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\d{4}-\d{2}-\d{2}-(.*)\.(en-US|zh-CN)\.(md|typ)").unwrap());

enum FileType {
    Markdown,
    Typst,
}

impl TryFrom<&str> for FileType {
    type Error = anyhow::Error;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "md" => Ok(FileType::Markdown),
            "typ" => Ok(FileType::Typst),
            _ => Err(anyhow::anyhow!("Unknown file type: {}", value)),
        }
    }
}

fn parse_filename(filename: &str) -> anyhow::Result<(&str, &str, FileType)> {
    let filename_match = FILENAME_RE
        .captures(&filename)
        .ok_or_else(|| anyhow::anyhow!("Unable to parse filename: {}", filename))?;
    Ok((
        filename_match.get(1).unwrap().as_str(),
        filename_match.get(2).unwrap().as_str(),
        filename_match.get(3).unwrap().as_str().try_into()?
    ))
}

fn find_image(html: &str) -> Option<String> {
    use scraper::*;
    let parsed = Html::parse_fragment(html);
    let selector = Selector::parse("img.preview").unwrap();
    let found = parsed.select(&selector).next()?;
    found.value().attr("src").map(str::to_string)
}

fn serialize_single(
    renderer: &Renderer,
    path: &Path,
    creation: Option<DT>,
    update: Option<DT>,
    title_font: &ttf_parser::Face,
) -> anyhow::Result<Post> {
    let filename = path.file_name().and_then(|e| e.to_str()).ok_or_else(|| anyhow::anyhow!("Malformed file name: {}", path.display()))?;
    let (id, lang, ty) = parse_filename(filename)?;
    log::info!("Processing {}", filename);
    let pre = renderer.render(path, ty)?;

    let publish_time = pre
        .metadata
        .force_publish_time
        .or(creation)
        .unwrap_or_else(|| {
            log::warn!("Unpublished post: {}", filename);
            chrono::Local::now().fixed_offset()
        });
    // TODO: check filename for publish time, check if they match
    let reduced_update_time = update.and_then(|t| {
        if t == creation.unwrap() {
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
            id: id.to_owned(),
            lang: lang.to_owned(),
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
    path: PathBuf,
    created: Option<DT>,
    updated: Option<DT>,
}

impl LatestFile {
    fn new(path: PathBuf) -> Self {
        Self {
            path,
            created: None,
            updated: None,
        }
    }

    fn serialize(self, renderer: &Renderer, title_font: &ttf_parser::Face) -> anyhow::Result<Post> {
        serialize_single(
            renderer,
            self.path.as_ref(),
            self.created,
            self.updated,
            title_font,
        )
    }
}

pub struct Renderer {
    typst: typst::HtmlBackend,
}

impl Renderer {
    pub fn new(root: PathBuf) -> anyhow::Result<Self> {
        Ok(Self {
            typst: typst::HtmlBackend::new(root)?,
        })
    }

    fn reset(&mut self) {
        self.typst.reset();
    }

    fn render(&self, path: &Path, ty: FileType) -> anyhow::Result<Rendered> {
        match ty {
            FileType::Markdown => {
                let file = std::fs::read_to_string(path)?;
                md::render(&file)
            }
            FileType::Typst => self.typst.invoke(path)?.render()
        }
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
        match msg {
            Err(e) => {
                log::warn!("Unparsable commit message at {}: {}", commit.id(), e);
            },
            Ok(m) if m.contains("[skip time]") => {
                log::debug!("Skipping due to [skip time]");
                return None;
            }
            _ => {},
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
    paths: impl Iterator<Item = PathBuf>,
) -> anyhow::Result<HashMap<String, LatestFile>> {
    let dir = &dir;

    let repo = git2::Repository::discover(&dir)?;
    log::debug!("Found repository at {}", repo.path().display());
    let mut revwalk = repo.revwalk()?;
    revwalk.set_sorting(Sort::TIME | Sort::TOPOLOGICAL | Sort::REVERSE)?;
    revwalk.reset()?;
    revwalk.push_head()?;

    let mut files = HashMap::with_capacity(paths.size_hint().0);
    for path in paths {
        files.insert(
            path.file_name().and_then(|e| e.to_str()).ok_or_else(|| anyhow::anyhow!("Invalid file name"))?.to_owned(),
            LatestFile::new(path)
        );
    }
    let mut ctx = ReaddirContext::new(files);

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
    renderer: &Renderer,
    dir: P,
    title_font: &ttf_parser::Face,
) -> anyhow::Result<HashMap<String, Post>> {
    let entries = std::fs::read_dir(&dir)?;
    let mut files = Vec::new();

    for entry in entries {
        // TODO: filter by file name
        files.push(entry?.path());
    }

    let timed = revwalk_update_store(&dir, files.into_iter())?;

    let collected = timed
        .into_par_iter()
        .filter_map(
            |(filename, latest_file)| -> Option<(String, Post)> {
                let Ok(serialized) = latest_file.serialize(renderer, title_font) else {
                    log::warn!("Failed to serialize {}, skipping", filename);
                    return None;
                };
                Some((filename, serialized))
            },
        )
        .collect();
    Ok(collected)
}

pub fn refresh_paths(
    renderer: &mut Renderer,
    dir: impl AsRef<Path>,
    paths: impl Iterator<Item = PathBuf>,
    title_font: &ttf_parser::Face,
) -> anyhow::Result<HashMap<String, Option<Post>>> {
    let timed = revwalk_update_store(&dir, paths)?;

    // Reset renderer
    renderer.reset();

    let collected: HashMap<_, _> = timed
        .into_par_iter()
        .map(|(filename, latest_file)| {
            let Ok(serialized) = latest_file.serialize(&renderer, title_font) else {
                log::warn!("Failed to serialize {}, skipping", filename);
                return (filename, None)
            };
            (filename, Some(serialized))
        })
        .collect();
    Ok(collected)
}
