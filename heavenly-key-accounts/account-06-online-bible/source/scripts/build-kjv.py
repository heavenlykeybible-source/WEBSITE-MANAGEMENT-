"""Build the 66-book KJV asset bundle from a pinned eBible.org VPL archive."""
from pathlib import Path
import hashlib, json, re, sys, urllib.request, zipfile

ROOT = Path(__file__).resolve().parents[2]
URL = "https://ebible.org/Scriptures/eng-kjv2006_vpl.zip"
SHA256 = "ae1f46afef704d5a97c9fdc5bdcdc2b296643eb819ad7f5dc88e45b6233205b7"
archive = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "kjv-source.zip"
if not archive.exists():
    urllib.request.urlretrieve(URL, archive)
if hashlib.sha256(archive.read_bytes()).hexdigest() != SHA256:
    raise SystemExit("Source archive changed. Review and pin the new release before importing.")
source = (ROOT / "heavenly-key-website/bible/app.js").read_text()
books = json.loads(re.search(r"const books = (\[[\s\S]*?\n  \]);", source)[1])
codes = "GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SOL ISA JER LAM EZE DAN HOS JOE AMO OBA JON MIC NAH HAB ZEP HAG ZEC MAL MAT MAR LUK JOH ACT ROM 1CO 2CO GAL EPH PHI COL 1TH 2TH 1TI 2TI TIT PHM HEB JAM 1PE 2PE 1JO 2JO 3JO JUD REV".split()
assert len(codes) == len(books) == 66
data = {code: {"book": name, "translation": "KJV", "chapters": {}} for code, (name, _) in zip(codes, books)}
with zipfile.ZipFile(archive) as z:
    lines = z.read("eng-kjv2006_vpl.txt").decode("utf-8-sig").splitlines()
for line in lines:
    if not line.strip():
        continue
    match = re.fullmatch(r"(\S+) (\d+):(\d+) (.+)", line)
    assert match, "Malformed source verse"
    code, ch, verse, text = match.groups()
    assert code in data and int(ch) > 0 and int(verse) > 0
    verses = data[code]["chapters"].setdefault(ch, [])
    assert int(verse) == len(verses) + 1, "Duplicate or missing verse"
    verses.append({"number": int(verse), "text": text, "isPlaceholder": False})
out = ROOT / "heavenly-key-website/bible/data/kjv"
out.mkdir(parents=True, exist_ok=True)
manifest = {"translation": "KJV", "source": URL, "sourceSha256": SHA256, "sourceDetails": "https://ebible.org/bible/details.php?id=eng-kjv2006", "books": []}
for code, (name, expected) in zip(codes, books):
    item = data[code]
    assert list(map(int, item["chapters"])) == list(range(1, expected + 1)), "Missing chapter"
    count = sum(len(v) for v in item["chapters"].values())
    content = json.dumps(item, ensure_ascii=False, separators=(",", ":")) + "\n"
    (out / (code + ".json")).write_text(content)
    manifest["books"].append({"code": code, "name": name, "chapters": expected, "verses": count, "sha256": hashlib.sha256(content.encode()).hexdigest()})
manifest["totalChapters"] = sum(b["chapters"] for b in manifest["books"])
manifest["totalVerses"] = sum(b["verses"] for b in manifest["books"])
assert manifest["totalChapters"] == 1189
assert manifest["totalVerses"] == 31102
assert data["GEN"]["chapters"]["1"][0]["text"] == "In the beginning God created the heaven and the earth."
assert "For God so loved the world" in data["JOH"]["chapters"]["3"][15]["text"]
(out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print("Validated 66 books, 1,189 chapters and 31,102 verses; exact source archive SHA-256 verified.")
