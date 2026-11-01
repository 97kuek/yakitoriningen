# /// script
# requires-python = ">=3.10"
# dependencies = ["fonttools>=4.50", "brotli>=1.1"]
# ///
"""Build Japanese-only subsets of the app font, one file per weight.

Usage:
  uv run scripts/subset-japanese-font.py <font.ttf> <output.woff2> [<font.ttf> <output.woff2> ...]

Example:
  uv run scripts/subset-japanese-font.py \
    BIZUDPMincho-Regular.ttf public/fonts/biz-udp-mincho-400.woff2 \
    BIZUDPMincho-Bold.ttf public/fonts/biz-udp-mincho-700.woff2

The subset keeps kana, Japanese punctuation, JIS level 1 kanji and every
non-ASCII character used in the source code. ASCII, digits and yen signs are
left out on purpose: the browser then draws numbers, amounts and Latin text
with the next font in the stack, which stays easy to read at the counter.
Run it again when the UI gains kanji outside JIS level 1.
"""

import pathlib
import sys

from fontTools import subset

ROOT = pathlib.Path(__file__).resolve().parent.parent

# Drawn with the body font for legibility of money and ticket numbers.
EXCLUDED = (
    {chr(c) for c in range(0x20, 0x7F)}  # ASCII: Latin, digits, punctuation
    | {chr(c) for c in range(0xFF10, 0xFF1A)}  # fullwidth digits
    | {'¥', '￥', '−', '，', '．'}
)


def jis_level1_kanji() -> set[str]:
    """JIS X 0208 rows 16–47, decoded through EUC-JP."""
    chars = set()
    for row in range(0xB0, 0xD0):
        for cell in range(0xA1, 0xFF):
            try:
                chars.add(bytes([row, cell]).decode('euc_jp'))
            except UnicodeDecodeError:
                pass
    return chars


def source_characters() -> set[str]:
    files = [*ROOT.glob('src/**/*.ts'), *ROOT.glob('src/**/*.tsx'), ROOT / 'index.html']
    return {ch for path in files for ch in path.read_text(encoding='utf-8') if ord(ch) > 0x7F}


def subset_font(source: pathlib.Path, output: pathlib.Path, chars: set[str]) -> None:
    options = subset.Options()
    options.flavor = 'woff2'
    options.hinting = False
    options.desubroutinize = True
    options.name_IDs = ['*']
    options.name_languages = ['*']
    font = subset.load_font(str(source), options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(text=''.join(sorted(chars)))
    subsetter.subset(font)
    output.parent.mkdir(parents=True, exist_ok=True)
    subset.save_font(font, str(output), options)
    print(f'{output}: {len(chars)} characters, {output.stat().st_size:,} bytes')


def main() -> None:
    args = sys.argv[1:]
    if not args or len(args) % 2:
        sys.exit(__doc__)
    chars = (
        {chr(c) for c in range(0x3000, 0x3040)}  # Japanese punctuation
        | {chr(c) for c in range(0x3041, 0x30FF)}  # hiragana and katakana
        | {chr(c) for c in range(0xFF01, 0xFF5F)}  # fullwidth forms
        | jis_level1_kanji()
        | source_characters()
    ) - EXCLUDED
    for source, output in zip(args[::2], args[1::2]):
        subset_font(pathlib.Path(source), pathlib.Path(output), chars)


main()
