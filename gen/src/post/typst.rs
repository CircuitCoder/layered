use std::path::{Path, PathBuf};

use serde::Deserialize;
use typst::{Features, Library, LibraryExt, World, comemo::Track, diag::{FileResult, SourceResult, Warned}, foundations::{Bytes, Content, Datetime, Duration, Label, Output}, introspection::{Introspector, MetadataElem}, model::{Document, LateLinkResolver}, syntax::{FileId, RootedPath, Source, VirtualPath, VirtualRoot::{self, Project}}, text::{Font, FontBook}, utils::{LazyHash, PicoStr}};
use typst_html::HtmlDocument;
use typst_kit::{diagnostics::{DiagnosticWorld, termcolor}, downloader::SystemDownloader, files::{FileStore, FsRoot, SystemFiles}, fonts::FontStore, packages::SystemPackages};

use crate::post::{PartialMetadata, Rendered};

pub struct HtmlBackend {
    library: LazyHash<Library>,
    fonts: FontStore,
    files: FileStore<SystemFiles>,
    root: PathBuf,
}

pub struct HtmlInvocation<'b> {
    backend: &'b HtmlBackend,
    main: FileId,
    // TODO: track transitive dependencies
}

impl HtmlBackend {
    pub fn new(root: PathBuf) -> anyhow::Result<Self> {
        let root = root.canonicalize()?;
        let ua = concat!("layered-gen/", env!("CARGO_PKG_VERSION"));
        let dwn = SystemDownloader::new(ua);
        let pkgs = SystemPackages::new(dwn);
        let project = FsRoot::new(root.clone());
        let files = FileStore::new(SystemFiles::new(
            project,
            pkgs,
        ));
        let mut fonts = FontStore::new();
        fonts.extend(typst_kit::fonts::embedded());
        let library = Library::builder()
            .with_features(Features::from_iter([typst::Feature::Html]))
            .build();
        let library = LazyHash::new(library);
        Ok(Self {
            library,
            fonts,
            files,
            root,
        })
    }

    pub fn reset(&mut self) {
        self.files.reset();
    }

    pub fn invoke<'b>(&'b self, entry: &Path) -> anyhow::Result<HtmlInvocation<'b>> {
        let path = RootedPath::new(
            Project,
            VirtualPath::virtualize(&self.root, &entry.canonicalize()?)?,
        );
        let main = FileId::new(path.into());
        Ok(HtmlInvocation { backend: self, main })
    }
}

impl<'a> World for HtmlInvocation<'a> {
    fn library(&self) ->  &LazyHash<Library>  {
        &self.backend.library
    }

    fn book(&self) ->  &LazyHash<FontBook>  {
        &self.backend.fonts.book()
    }

    fn main(&self) -> FileId {
        self.main
    }

    fn source(&self, id: FileId) -> FileResult<Source>  {
        self.backend.files.source(id)
    }

    fn file(&self, id: FileId) -> FileResult<Bytes>  {
        self.backend.files.file(id)
    }

    fn font(&self, index: usize) -> Option<Font>  {
        self.backend.fonts.font(index)
    }

    fn today(&self, _offset: Option<Duration>) -> Option<Datetime>  {
        // Block inconsistent output
        None
    }
}

impl DiagnosticWorld for HtmlInvocation<'_> {
    fn name(&self, id: FileId) -> String {
        let vpath = id.vpath();
        match id.root() {
            VirtualRoot::Project => {
                vpath.get_without_slash().to_owned()
            }
            VirtualRoot::Package(package) => {
                format!("{package}{}", vpath.get_with_slash())
            }
        }
    }
}

#[derive(Deserialize)]
pub struct InternalMetadata {
    #[serde(default)]
    pub hidden: bool,
    #[serde(default)]
    pub wip: bool,
}

struct HtmlPlainDocument {
    html: HtmlDocument,
    plain: String,
}

fn extract_plain_text(content: &Content, out: &mut String) {
    use typst::model::*;
    use typst::text::*;
    use typst::foundations::*;

    // 1. Direct text node
    if let Some(text_elem) = content.to_packed::<TextElem>() {
        out.push_str(text_elem.text.as_str());
        return;
    }

    // 2. Whitespace & line break nodes
    let func = content.func();
    if func == SpaceElem::ELEM {
        out.push(' ');
        return;
    } else if func == ParbreakElem::ELEM {
        out.push('\n');
        return;
    } else if func == LinebreakElem::ELEM {
        out.push('\n');
        return;
    }

    // 3. Dynamically check for standard structural fields (Typstonomicon logic)
    if let Ok(children) = content.field_by_name("children") {
        if let Ok(array) = children.cast::<Array>() {
            for val in array {
                if let Ok(child) = val.cast::<Content>() {
                    extract_plain_text(&child, out);
                }
            }
        }
    } else if let Ok(body) = content.field_by_name("body") {
        if let Ok(body_content) = body.cast::<Content>() {
            extract_plain_text(&body_content, out);
        }
    } else if let Ok(text_val) = content.field_by_name("text") {
        // Some elements (like raw code blocks) store text in a 'text' field
        if let Ok(s) = text_val.clone().cast::<Str>() {
            out.push_str(s.as_str());
        } else if let Ok(c) = text_val.cast::<Content>() {
            extract_plain_text(&c, out);
        }
    }

    // 4. (Optional) Inject structural newlines for block elements that
    // don't natively emit ParbreakElem (like Headings)
    if func == HeadingElem::ELEM {
        out.push_str("\n\n");
    }
}

impl Output for HtmlPlainDocument {
    fn target() -> typst::foundations::Target
    where Self: Sized {
        typst::foundations::Target::Html
    }

    fn create(
        engine: &mut typst::engine::Engine,
        content: &typst::foundations::Content,
        styles: typst::foundations::StyleChain,
    ) -> SourceResult<Self>
    where Self: Sized {
        let mut plain = String::new();
        extract_plain_text(content, &mut plain);
        HtmlDocument::create(engine, content, styles).map(|html| Self { html, plain })
    }

    fn introspector(&self) -> &dyn Introspector {
        self.html.introspector().as_ref()
    }
}

impl HtmlInvocation<'_> {
    pub fn render(&self) -> anyhow::Result<Rendered> {
        let mut term = termcolor::BufferedStandardStream::stderr(termcolor::ColorChoice::Auto);
        let result: Warned<SourceResult<HtmlPlainDocument>> = typst::compile(self);

        // Print diagnostics, first warnings, then errors (it's better to see this way)
        typst_kit::diagnostics::emit(&mut term, self, result.warnings.iter(), typst_kit::diagnostics::DiagnosticFormat::Human)?;
        let (html, plain) = match result.output {
            Ok(result) => (result.html, result.plain),
            Err(err) => {
                typst_kit::diagnostics::emit(&mut term, self, err.iter(), typst_kit::diagnostics::DiagnosticFormat::Human)?;
                anyhow::bail!("failed to compile document");
            }
        };
        let introspector = html.introspector().as_ref();
        let meta = introspector
            .query_label(Label::new(PicoStr::constant("meta")).unwrap())
            .map_err(|e| anyhow::anyhow!("failed to find <meta>: {e}"))?;
        let meta = meta.to_packed::<MetadataElem>().ok_or_else(|| anyhow::anyhow!("Invalid type for <meta>"))?;
        let meta_parsed: InternalMetadata = serde_json::from_value(serde_json::to_value(&meta.value)?)?;
        let title = html.info().title.as_ref().ok_or_else(|| anyhow::anyhow!("Missing title"))?.as_str().to_owned();
        let tags: Vec<String> = html.info().keywords.iter().map(|e| e.as_str().to_owned()).collect();

        let root = html.root();
        let link_resolver = LateLinkResolver::new(None, introspector);
        let html = match typst_html::html_in_bundle(root, &typst_html::HtmlOptions::default(), link_resolver.track()) {
            Ok(html) => html.trim_start_matches("<!DOCTYPE html>").to_owned(),
            Err(err) => {
                typst_kit::diagnostics::emit(&mut term, self, err.iter(), typst_kit::diagnostics::DiagnosticFormat::Human)?;
                anyhow::bail!("failed to render document to HTML");
            }
        };

        let meta_full = PartialMetadata {
            title,
            tags,
            hidden: meta_parsed.hidden,
            wip: meta_parsed.wip,
            force_publish_time: None,
            force_update_time: None,
            legacy: false,
        };

        let rendered = Rendered {
            metadata: meta_full,
            html,
            plain,
        };

        Ok(rendered)
    }
}
