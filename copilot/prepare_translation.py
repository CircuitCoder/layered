from __future__ import annotations

from pathlib import Path
import re


ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = ROOT / "content"
TRANSLATED_DIR = ROOT / "translated"

FRONTMATTER_RE = re.compile(r"\A---\n(?P<frontmatter>.*?)\n---(?:\n|$)", re.S)
HIDDEN_RE = re.compile(r"^hidden:\s*true\s*$", re.M)
LEADING_WS_RE = re.compile(r"^[ \t]*")


def is_nontranslatable_blob(line: str) -> bool:
    bare = line.rstrip("\n")
    return (
        ("<svg" in bare and len(bare) >= 500)
        or ("data:text/html" in bare and len(bare) >= 200)
    )


def swap_language_suffix(name: str) -> tuple[str, str]:
    if name.endswith(".zh-CN.md"):
        return name[: -len(".zh-CN.md")] + ".en-US.md", "zh-CN"
    if name.endswith(".en-US.md"):
        return name[: -len(".en-US.md")] + ".zh-CN.md", "en-US"
    raise ValueError(f"non-hidden post without language suffix: {name}")


def rewrite_body(body: str) -> tuple[str, int]:
    placeholders = 0
    rewritten_lines: list[str] = []
    for line in body.splitlines(keepends=True):
        if not is_nontranslatable_blob(line):
            rewritten_lines.append(line)
            continue

        indent = LEADING_WS_RE.match(line.rstrip("\n")).group(0)
        newline = "\n" if line.endswith("\n") else ""
        rewritten_lines.append(f"{indent}TRANSLATE_MANUAL_FIXME{newline}")
        placeholders += 1

    return "".join(rewritten_lines), placeholders


def main() -> None:
    TRANSLATED_DIR.mkdir(exist_ok=True)

    total = 0
    skipped_hidden = 0
    copied = 0
    zh_to_en = 0
    en_to_zh = 0
    placeholder_total = 0
    placeholder_files: list[tuple[str, int]] = []

    for source_path in sorted(CONTENT_DIR.glob("*.md")):
        total += 1
        text = source_path.read_text(encoding="utf-8")
        match = FRONTMATTER_RE.match(text)
        if match is None:
            raise ValueError(f"missing or unsupported front matter: {source_path}")

        frontmatter = match.group("frontmatter")
        if HIDDEN_RE.search(frontmatter):
            skipped_hidden += 1
            continue

        target_name, source_lang = swap_language_suffix(source_path.name)
        if source_lang == "zh-CN":
            zh_to_en += 1
        else:
            en_to_zh += 1

        body = text[match.end() :]
        rewritten_body, placeholder_count = rewrite_body(body)
        new_frontmatter = (
            f"---\n{frontmatter}\ntranslated: llm\nsource: {source_lang}\n---\n"
        )
        (TRANSLATED_DIR / target_name).write_text(
            new_frontmatter + rewritten_body,
            encoding="utf-8",
        )

        copied += 1
        placeholder_total += placeholder_count
        if placeholder_count:
            placeholder_files.append((target_name, placeholder_count))

    print(f"total={total}")
    print(f"skipped_hidden={skipped_hidden}")
    print(f"copied={copied}")
    print(f"zh_to_en={zh_to_en}")
    print(f"en_to_zh={en_to_zh}")
    print(f"placeholder_total={placeholder_total}")
    print(f"files_with_placeholders={len(placeholder_files)}")
    for name, count in placeholder_files:
        print(f"placeholder_file={name}:{count}")


if __name__ == "__main__":
    main()