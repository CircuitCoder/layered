use serde::Deserialize;
use serde::Serialize;

#[derive(Serialize, Deserialize, PartialEq, Clone, Debug)]
#[derive(ts_rs::TS)]
#[ts(export, export_to = "../../web/src/typings/OutlineCmd.ts")]
#[serde(rename_all = "lowercase")]
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
    pub fn draw_within_bbox(&self, bbox: &BBox) -> OutlineCmd {
        match self {
            OutlineCmd::Move(x, y) => OutlineCmd::Move(x - bbox.left, bbox.bottom - y),
            OutlineCmd::Line(x, y) => OutlineCmd::Line(x - bbox.left, bbox.bottom - y),
            OutlineCmd::Quad {
                to: (tx, ty),
                ctrl: (cx, cy),
            } => OutlineCmd::Quad {
                to: (tx - bbox.left, bbox.bottom - ty),
                ctrl: (cx - bbox.left, bbox.bottom - cy),
            },
            OutlineCmd::Cubic {
                to: (tx, ty),
                ctrl_first: (c1x, c1y),
                ctrl_second: (c2x, c2y),
            } => OutlineCmd::Cubic {
                to: (tx - bbox.left, bbox.bottom - ty),
                ctrl_first: (c1x - bbox.left, bbox.bottom - c1y),
                ctrl_second: (c2x - bbox.left, bbox.bottom - c2y),
            },
            OutlineCmd::Close => OutlineCmd::Close,
        }
    }
}

pub type Outline = Vec<OutlineCmd>;

#[derive(Serialize, Deserialize, Clone, Copy, Debug)]
#[derive(ts_rs::TS)]
#[ts(export, export_to = "../../web/src/typings/BBox.ts")]
pub struct BBox {
    pub top: f64,
    pub bottom: f64,
    pub left: f64,
    pub right: f64,
}

impl BBox {
    pub fn width(&self) -> f64 {
        self.right - self.left
    }

    pub fn height(&self) -> f64 {
        self.bottom - self.top
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[derive(ts_rs::TS)]
#[ts(export, export_to = "../../web/src/typings/CharResp.ts")]
pub struct CharResp {
    #[ts(type = "string")]
    pub char: char,
    pub components: Vec<Vec<OutlineCmd>>,
    pub bbox: BBox,
    pub bearing: i16,
    pub hadv: u16,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[derive(ts_rs::TS)]
#[ts(export, export_to = "../../web/src/typings/TitleResp.ts")]
pub struct TitleResp {
    pub chars: Vec<CharResp>,
    pub asc: i16,
    pub des: i16,
    pub em: u16,
}