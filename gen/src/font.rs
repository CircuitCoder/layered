use std::collections::HashSet;

use lyon_path::PathEvent;
use pointwise_common::font::*;
use ttf_parser::Rect;

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
            log::debug!("Testing {} contained in {}", i, j);

            let i_first_point = match loops[i].get(0).unwrap() {
                OutlineCmd::Move(x, y) => (*x as f32, *y as f32),
                _ => unreachable!(),
            };
            let j_path = component_to_lyon_path_ev(loops[j].iter().cloned());
            // TODO: change tolerance?
            let i_inside_j = lyon_algorithms::hit_test::hit_test_path(
                &i_first_point.into(),
                j_path,
                lyon_path::FillRule::EvenOdd,
                1e-1,
            );
            if i_inside_j {
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

    let bbox = match face
        .outline_glyph(glyph, &mut builder) {
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

    let hadv = face.glyph_hor_advance(glyph).ok_or_else(|| anyhow::anyhow!("Glyph '{}' has no outline and hor adv", c))?;

    let components = split_components(builder.outline);
    let bearing = face.glyph_hor_side_bearing(glyph).unwrap_or(0);

    let r = Ok(CharResp {
        components,
        char: c,
        bbox: BBox {
            top: bbox.y_min as f64,
            bottom: bbox.y_max as f64,
            left: bbox.x_min as f64,
            right: bbox.x_max as f64,
        },
        bearing,
        hadv,
    });

    r
}

pub fn parse_title(title: &str, face: &ttf_parser::Face) -> anyhow::Result<TitleResp> {
    let chars: anyhow::Result<Vec<_>> = title.chars().map(|c| parse_char(c, face)).collect();
    let chars = chars?;

    Ok(TitleResp {
        chars,
        em: face.units_per_em(),
        asc: face.ascender(),
        des: face.descender(),
    })
}