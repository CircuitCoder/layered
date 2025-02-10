use std::path::Path;

use syntect::{dumps::dump_to_uncompressed_file, parsing::SyntaxSet};

fn main() {
    let out_dir = std::env::var_os("OUT_DIR").unwrap();
    let dest_path = Path::new(&out_dir).join("ss.packdump");
    let syntaxes_dir = Path::new(&std::env::var("CARGO_MANIFEST_DIR").unwrap()).join("syntaxes");
    let mut ss = SyntaxSet::load_defaults_newlines().into_builder();
    ss.add_from_folder(syntaxes_dir, true).unwrap();
    let ss = ss.build();
    dump_to_uncompressed_file(&ss, &dest_path).unwrap();

    println!("cargo::rerun-if-changed=build.rs");
    println!("cargo::rerun-if-changed=syntaxes");
    println!(
        "cargo::rustc-env=SYNTAX_PACK={}",
        dest_path.canonicalize().unwrap().display()
    );
}
