use std::collections::BTreeMap;
use std::collections::HashSet;
use std::io::Write;

use itertools::Itertools;
use lyon_path::PathEvent;
use tempfile::NamedTempFile;
use ttf_parser::Rect;

use serde::Deserialize;
use serde::Serialize;

#[derive(Serialize, Deserialize, PartialEq, Clone, Debug, ts_rs::TS)]
#[ts(export)]
#[serde(rename_all = "lowercase")]
#[serde(tag = "ty", content = "spec")]
pub enum OutlineCmd {
    Move(f64, f64),
    Line(f64, f64),
    Quad {
        to: (f64, f64),
        ctrl: (f64, f64),
    },
    Cubic {
        to: (f64, f64),
        ctrl_first: (f64, f64),
        ctrl_second: (f64, f64),
    },
    Close,
}

impl OutlineCmd {
    pub fn dst_pt(&self) -> Option<(f64, f64)> {
        match self {
            OutlineCmd::Move(x, y) => Some((*x, *y)),
            OutlineCmd::Line(x, y) => Some((*x, *y)),
            OutlineCmd::Quad { to, .. } => Some(*to),
            OutlineCmd::Cubic { to, .. } => Some(*to),
            OutlineCmd::Close => None,
        }
    }

    pub fn may_be_inside(&self, path: impl Iterator<Item = PathEvent>) -> bool {
        match self.dst_pt() {
            None => true,
            Some((x, y)) => lyon_algorithms::hit_test::hit_test_path(
                &(x as f32, y as f32).into(),
                path,
                lyon_path::FillRule::EvenOdd,
                1e-5,
            ),
        }
    }
}

pub type Outline = Vec<OutlineCmd>;

#[derive(Serialize, Deserialize, Clone, Copy, Debug, ts_rs::TS)]
#[ts(export)]
pub struct BBox {
    pub top: i16,
    pub bottom: i16,
    pub left: i16,
    pub right: i16,
}

fn serialize_outline(outline: &Outline) -> String {
    let mut ret = String::new();
    for cmd in outline {
        match cmd {
            OutlineCmd::Move(x, y) => {
                ret.push_str(&format!("M {} {}", x, -y));
            }
            OutlineCmd::Line(x, y) => {
                ret.push_str(&format!("L {} {}", x, -y));
            }
            OutlineCmd::Quad { to, ctrl } => {
                ret.push_str(&format!(
                    "Q {} {} {} {}",
                    ctrl.0,
                    -ctrl.1,
                    to.0,
                    -to.1
                ));
            }
            OutlineCmd::Cubic {
                to,
                ctrl_first,
                ctrl_second,
            } => {
                ret.push_str(&format!(
                    "C {} {} {} {} {} {}",
                    ctrl_first.0,
                    -ctrl_first.1,
                    ctrl_second.0,
                    -ctrl_second.1,
                    to.0,
                    -to.1
                ));
            }
            OutlineCmd::Close => {
                ret.push_str("Z");
            }
        }
    }
    ret
}

#[derive(Serialize, Deserialize, Clone, Debug, ts_rs::TS)]
#[ts(export)]
pub struct CharResp {
    #[ts(type = "string")]
    pub char: char,
    pub components: Vec<String>,
    pub bbox: BBox,
    // pub bearing: i16,
    pub hadv: u16,
}

#[derive(Serialize, Deserialize, Clone, Debug, ts_rs::TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct GroupResp {
    pub chars: Vec<CharResp>,
    pub text: String,
    #[ts(type = "number")]
    pub hadv: u64,
    pub break_after: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, ts_rs::TS)]
#[ts(export)]
pub struct TitleResp {
    pub groups: Vec<GroupResp>,
    pub asc: i16,
    pub des: i16,
    pub em: u16,
}

// TODO: optimize: use slices
fn split_closed_loop<I: Iterator<Item = OutlineCmd>>(outline: I) -> Vec<Outline> {
    let mut output = Vec::new();
    let mut cur = Vec::new();

    for cmd in outline {
        let is_close = cmd == OutlineCmd::Close;
        cur.push(cmd);
        if is_close {
            output.push(cur);
            cur = Vec::new();
        }
    }

    if !cur.is_empty() {
        output.push(cur);
    }

    output
}

fn component_to_lyon_path_ev<I: Iterator<Item = OutlineCmd>>(
    outline: I,
) -> impl Iterator<Item = PathEvent> {
    let mut start = (0f32, 0f32).into();
    let mut last = (0f32, 0f32).into();
    outline.map(move |cmd| match cmd {
        OutlineCmd::Move(x, y) => {
            start = (x as f32, y as f32).into();
            last = (x as f32, y as f32).into();
            PathEvent::Begin {
                at: (x as f32, y as f32).into(),
            }
        }
        OutlineCmd::Line(x, y) => {
            let current = (x as f32, y as f32).into();
            let output = PathEvent::Line {
                from: last,
                to: current,
            };
            last = current;
            output
        }
        OutlineCmd::Quad { to, ctrl } => {
            let current = (to.0 as f32, to.1 as f32).into();
            let output = PathEvent::Quadratic {
                from: last,
                to: current,
                ctrl: (ctrl.0 as f32, ctrl.1 as f32).into(),
            };
            last = current;
            output
        }
        OutlineCmd::Cubic {
            to,
            ctrl_first,
            ctrl_second,
        } => {
            let current = (to.0 as f32, to.1 as f32).into();
            let output = PathEvent::Cubic {
                from: last,
                to: current,
                ctrl1: (ctrl_first.0 as f32, ctrl_first.1 as f32).into(),
                ctrl2: (ctrl_second.0 as f32, ctrl_second.1 as f32).into(),
            };
            last = current;
            output
        }
        OutlineCmd::Close => {
            let output = PathEvent::End {
                last,
                first: start,
                close: true,
            };
            start = (0f32, 0f32).into();
            last = (0f32, 0f32).into();
            output
        }
    })
}

fn collect_outline(
    id: usize,
    outlines: &Vec<Outline>,
    children: &Vec<Vec<usize>>,
    collect: &mut Vec<Outline>,
) {
    let mut current: Outline = outlines[id].clone();
    for child in children[id].iter() {
        current.extend(outlines[*child].iter().cloned());
        for double_child in children[*child].iter() {
            collect_outline(*double_child, outlines, children, collect);
        }
    }
    collect.push(current);
}

pub fn split_components(input: Outline) -> Vec<Outline> {
    let loops = split_closed_loop(input.into_iter());
    let mut inside: Vec<HashSet<usize>> = loops.iter().map(|_| HashSet::new()).collect();

    // Build inside set
    for i in 0..loops.len() {
        for j in 0..loops.len() {
            if i == j {
                continue;
            }

            // TODO: change tolerance?
            let i_inside_j = loops[i]
                .iter()
                .all(|cmd| cmd.may_be_inside(component_to_lyon_path_ev(loops[j].iter().cloned())));
            if i_inside_j {
                log::debug!("Split: {} contained in {}", i, j);
                inside[i].insert(j);
            }
        }
    }

    log::debug!("Inside set: {:#?}", inside);

    // Build tree
    let mut processed: Vec<bool> = loops.iter().map(|_| false).collect();
    let mut is_root: Vec<bool> = loops.iter().map(|_| true).collect();
    let mut children: Vec<Vec<usize>> = loops.iter().map(|_| Vec::new()).collect();

    loop {
        let mut selected = None;
        for i in 0..inside.len() {
            if inside[i].is_empty() && !processed[i] {
                selected = Some(i);
                break;
            }
        }

        let selected = if let Some(inner) = selected {
            inner
        } else {
            break;
        };

        for i in 0..inside.len() {
            if inside[i].remove(&selected) && inside[i].is_empty() {
                children[selected].push(i);
                is_root[i] = false;
            }
        }

        processed[selected] = true;
    }

    log::debug!("Direct children: {:#?}", children);

    let mut collected = Vec::new();

    for i in 0..loops.len() {
        if is_root[i] {
            collect_outline(i, &loops, &children, &mut collected);
        }
    }

    collected
}

#[derive(Default)]
struct OutlineBuilder {
    outline: Outline,
}
impl ttf_parser::OutlineBuilder for OutlineBuilder {
    fn move_to(&mut self, x: f32, y: f32) {
        self.outline.push(OutlineCmd::Move(x as f64, y as f64));
    }

    fn line_to(&mut self, x: f32, y: f32) {
        self.outline.push(OutlineCmd::Line(x as f64, y as f64));
    }

    fn quad_to(&mut self, x1: f32, y1: f32, x: f32, y: f32) {
        self.outline.push(OutlineCmd::Quad {
            to: (x as f64, y as f64),
            ctrl: (x1 as f64, y1 as f64),
        });
    }

    fn curve_to(&mut self, x1: f32, y1: f32, x2: f32, y2: f32, x: f32, y: f32) {
        self.outline.push(OutlineCmd::Cubic {
            to: (x as f64, y as f64),
            ctrl_first: (x1 as f64, y1 as f64),
            ctrl_second: (x2 as f64, y2 as f64),
        });
    }

    fn close(&mut self) {
        self.outline.push(OutlineCmd::Close);
    }
}

pub fn parse_char(c: char, face: &ttf_parser::Face) -> anyhow::Result<CharResp> {
    let glyph = match face.glyph_index(c) {
        Some(gid) => gid,
        None => {
            return Err(anyhow::anyhow!("Glyph \"{}\" not found in font", c));
        }
    };
    // let mut char_resp = CharResp::new(c);
    let mut builder = OutlineBuilder::default();

    let bbox = match face.outline_glyph(glyph, &mut builder) {
        Some(bbox) => bbox,
        None => {
            log::warn!("Glyph \"{}\" has corrupted outline.", c);
            // Manually craft an bbox
            Rect {
                x_min: 0,
                x_max: 0,
                y_min: 0,
                y_max: 0,
            }
        }
    };

    let hadv = face
        .glyph_hor_advance(glyph)
        .ok_or_else(|| anyhow::anyhow!("Glyph '{}' has no outline and hor adv", c))?;

    let mut components = split_components(builder.outline);
    components.sort_by(|a, b| {
        let a_bbox =
            lyon_algorithms::aabb::bounding_box(component_to_lyon_path_ev(a.iter().cloned()));
        let b_bbox =
            lyon_algorithms::aabb::bounding_box(component_to_lyon_path_ev(b.iter().cloned()));
        return a_bbox.min.x.partial_cmp(&b_bbox.min.x).unwrap();
    });
    let components_serialized = components
        .iter()
        .map(|c| serialize_outline(c))
        .collect();
    // let bearing = face.glyph_hor_side_bearing(glyph).unwrap_or(0);

    let r = Ok(CharResp {
        components: components_serialized,
        char: c,
        bbox: BBox {
            top: -bbox.y_max,
            bottom: -bbox.y_min,
            left: bbox.x_min,
            right: bbox.x_max,
        },
        // bearing,
        hadv,
    });

    r
}

pub fn parse_title(title: &str, face: &ttf_parser::Face) -> anyhow::Result<TitleResp> {
    // Segmentation & line-break
    use unicode_segmentation::UnicodeSegmentation;
    let segmented: BTreeMap<usize, bool> = title
        .split_word_bound_indices()
        .map(|(i, _)| (i, false))
        .chain(unicode_linebreak::linebreaks(title).map(|(i, opp)| {
            assert!(
                opp == unicode_linebreak::BreakOpportunity::Allowed || i == title.len(),
                "Unexpected line break in title"
            );
            (i, true)
        }))
        .collect();
    let segs = segmented
        .iter()
        .tuple_windows()
        .map(|((aptr, _), (bptr, bbp))| (&title[*aptr..*bptr], *bbp));
    let groups = segs
        .map(|(s, break_after)| -> anyhow::Result<GroupResp> {
            let chars = s
                .chars()
                .map(|c: char| parse_char(c, face))
                .collect::<anyhow::Result<Vec<_>>>()?;
            let hadv = chars.iter().map(|c| c.hadv as u64).sum();
            Ok(GroupResp {
                chars,
                text: s.to_string(),
                break_after,
                hadv,
            })
        })
        .collect::<anyhow::Result<Vec<_>>>()?;

    Ok(TitleResp {
        groups,
        em: face.units_per_em(),
        asc: face.ascender(),
        des: face.descender(),
    })
}

pub fn generate_subset_to<'a>(
    src: impl AsRef<std::path::Path>,
    ss: impl Iterator<Item = &'a str>,
    output: impl AsRef<std::path::Path>,
) -> anyhow::Result<()> {
    let mut tmp_txt = NamedTempFile::new()?;
    let mut buf_tmp_txt = std::io::BufWriter::new(tmp_txt.as_file_mut());
    for s in ss {
        buf_tmp_txt.write(s.as_bytes())?;
    }
    buf_tmp_txt.flush()?;
    drop(buf_tmp_txt);

    log::debug!(
        "Subsetting font to {}, temp file: {}",
        output.as_ref().display(),
        tmp_txt.path().display()
    );
    let mut child = std::process::Command::new("pyftsubset")
        .args(&[
            src.as_ref().to_string_lossy().as_ref(),
            "--unicodes=00-7F",
            &format!("--text-file={}", tmp_txt.path().display()),
            "--flavor=woff2",
            "--layout-features='*'",
            &format!("--output-file={}", output.as_ref().display()),
        ])
        .spawn()?;
    let ret = child.wait()?;
    if !ret.success() {
        return Err(anyhow::anyhow!("pyftsubset failed"));
    }

    Ok(())
}
