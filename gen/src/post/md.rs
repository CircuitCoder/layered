use std::iter::Iterator;

pub struct ParsedMarkdown {
    pub metadata: PartialMetadata,
    pub html: String,
}

pub struct PartialMetadata {
    pub title: String,
    pub tags: Vec<String>,
    pub force_publish_time: Option<chrono::DateTime<chrono::FixedOffset>>,
    pub force_update_time: Option<chrono::DateTime<chrono::FixedOffset>>,
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
    let mut html = String::new();
    pulldown_cmark::html::push_html(&mut html, parser);

    Ok(ParsedMarkdown { metadata, html })
}

fn parse_frontmatter(fm: &str) -> anyhow::Result<PartialMetadata> {
    let mut result = PartialMetadata {
        title: String::new(),
        tags: Vec::new(),
        force_publish_time: None,
        force_update_time: None,
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
