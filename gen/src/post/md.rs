use std::iter::Iterator;

use syntect::dumps::from_uncompressed_data;
use syntect::easy::HighlightLines;
use syntect::highlighting::{Color, Theme, ThemeSet};
use syntect::html::{append_highlighted_html_for_styled_line, IncludeBackground};
use syntect::parsing::{SyntaxReference, SyntaxSet};
use syntect::util::LinesWithEndings;

pub struct ParsedMarkdown {
    pub metadata: PartialMetadata,
    pub html: String,
    pub plain: String,
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

fn highlight_code_html(
    code: &str,
    lang: &str,
    ss: &SyntaxSet,
    syntax: &SyntaxReference,
    theme: &Theme,
) -> Result<String, syntect::Error> {
    let bg = theme.settings.background.unwrap_or(Color::WHITE);
    let mut highlighter = HighlightLines::new(syntax, theme);
    let mut output = format!(
        "<pre style=\"background-color:#{:02x}{:02x}{:02x};\">\n<code class=\"language-{}\">",
        bg.r, bg.g, bg.b, lang
    );

    for line in LinesWithEndings::from(code) {
        let regions = highlighter.highlight_line(line, ss)?;
        append_highlighted_html_for_styled_line(
            &regions[..],
            IncludeBackground::IfDifferent(bg),
            &mut output,
        )?;
    }
    output.push_str("</code></pre>\n");

    Ok(output)
}

pub fn parse(input: &str) -> anyhow::Result<ParsedMarkdown> {
    let input = input.trim();

    // Split frontmatter
    let (metadata, content) = if input.starts_with("---\n") {
        // Contains frontmatter
        if let Some((fm, content)) = input[4..].split_once("\n---") {
            // TODO: actually it's \n---(\n|$)
            (parse_frontmatter(fm)?, content)
        } else {
            return Err(anyhow::anyhow!(
                "Unrecognizable frontmatter format: {}",
                input
            ));
        }
    } else {
        return Err(anyhow::anyhow!("No frontmatter found"));
    };

    let parser = pulldown_cmark::Parser::new_ext(content.trim(), pulldown_cmark::Options::all());
    let mapped = std::pin::pin!(
        #[coroutine]
        static move || {
            use pulldown_cmark::{CodeBlockKind, Event, Tag, TagEnd};

            let ss: SyntaxSet =
                from_uncompressed_data(include_bytes!(env!("SYNTAX_PACK"))).unwrap();
            let ts = ThemeSet::load_defaults();
            let theme = &ts.themes["Solarized (dark)"];
            let mut codeblock = String::new();
            let mut in_codeblock = None;

            for syn in ss.syntaxes() {
                log::debug!("Supported syntax: {}", syn.name);
            }

            for event in parser.into_iter() {
                match event {
                    Event::Start(Tag::CodeBlock(CodeBlockKind::Fenced(lang)))
                        if lang.as_ref() != ""
                            && let Some(syntax) = ss.find_syntax_by_token(lang.as_ref()) =>
                    {
                        in_codeblock = Some((lang, syntax));
                    }
                    Event::End(TagEnd::CodeBlock) if let Some((lang, syntax)) = in_codeblock => {
                        let html =
                            highlight_code_html(&codeblock, lang.as_ref(), &ss, syntax, theme)
                                .unwrap();
                        in_codeblock = None;
                        codeblock.clear();

                        yield Event::Html(
                            format!(
                                "<div class=\"highlighted highlighted-{}\">{}</div>",
                                lang.as_ref(),
                                html
                            )
                            .into(),
                        );
                    }
                    Event::Text(text) if in_codeblock.is_some() => {
                        codeblock.push_str(text.as_ref());
                    }
                    Event::DisplayMath(s) => {
                        let opts = katex::Opts::builder()
                            .display_mode(true)
                            .output_type(katex::OutputType::HtmlAndMathml)
                            .max_size(50f64)
                            .build().unwrap();
                        yield match katex::render_with_opts(s.as_ref(), opts) {
                            Ok(r) => Event::Html(r.into()),
                            Err(e) => {
                                log::warn!("Failed to render math: {}", e);
                                log::warn!("Math source: {}", s);
                                Event::DisplayMath(s)
                            }
                        }
                    },
                    Event::InlineMath(s) => {
                        let opts = katex::Opts::builder()
                            .display_mode(false)
                            .output_type(katex::OutputType::HtmlAndMathml)
                            .build().unwrap();
                        yield match katex::render_with_opts(s.as_ref(), opts) {
                            Ok(r) => Event::Html(r.into()),
                            Err(e) => {
                                log::warn!("Failed to render math: {}", e);
                                log::warn!("Math source: {}", s);
                                Event::InlineMath(s)
                            }
                        }
                    },
                    e => {
                        assert!(in_codeblock.is_none());
                        yield e;
                    }
                }
            }
        }
    );
    let mut html = String::new();
    pulldown_cmark::html::push_html(&mut html, std::iter::from_coroutine(mapped));

    // Generate plaintext
    let mut plain = String::new();
    for ev in pulldown_cmark::Parser::new_ext(content.trim(), pulldown_cmark::Options::all()) {
        use pulldown_cmark::{Event, Tag, TagEnd};
        match ev {
            Event::Start(t) => {
                plain += match t {
                    Tag::Heading { .. } => "\n",
                    Tag::Item => "- ",
                    _ => "",
                }
            }
            Event::End(t) => {
                plain += match t {
                    TagEnd::Paragraph
                    | TagEnd::BlockQuote(_)
                    | TagEnd::CodeBlock
                    | TagEnd::Heading(_)
                    | TagEnd::Item => "\n",
                    _ => "",
                }
            }
            Event::Text(s)
            | Event::Code(s)
            | Event::DisplayMath(s)
            | Event::InlineMath(s)
            | Event::FootnoteReference(s) => plain += s.as_ref(),
            Event::SoftBreak => plain += " ",
            Event::HardBreak => plain += "\n",
            Event::Rule => plain += "---\n",
            Event::TaskListMarker(c) => plain += if c { "[x] " } else { "[ ] " },
            Event::Html(_) | Event::InlineHtml(_) => {}
        }
    }

    Ok(ParsedMarkdown {
        metadata,
        html,
        plain,
    })
}

fn parse_frontmatter(fm: &str) -> anyhow::Result<PartialMetadata> {
    let mut result = PartialMetadata {
        title: String::new(),
        tags: Vec::new(),
        force_publish_time: None,
        force_update_time: None,
        hidden: false,
        wip: false,
        legacy: false,
    };

    for line in fm.trim().lines() {
        if let Some((key, value)) = line.split_once(":") {
            let key = key.trim();
            let value = value.trim();
            match key {
                "title" => {
                    result.title = value.to_owned();
                }
                "tags" => {
                    result.tags = value.split(",").map(str::trim).map(str::to_owned).collect();
                }
                "force_publish_time" => {
                    result.force_publish_time = Some(chrono::DateTime::parse_from_rfc3339(value)?);
                }
                "force_update_time" => {
                    result.force_update_time = Some(chrono::DateTime::parse_from_rfc3339(value)?);
                }
                "hidden" => {
                    result.hidden = value.parse()?;
                }
                "wip" => {
                    result.wip = value.parse()?;
                }
                "legacy" => {
                    result.legacy = value.parse()?;
                }
                _ => {
                    return Err(anyhow::anyhow!("Unsupported frontmatter key: {}", key));
                }
            }
        } else {
            return Err(anyhow::anyhow!("Unsupported frontmatter format: {}", line));
        }
    }

    Ok(result)
}
