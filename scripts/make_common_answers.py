from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

try:
    from wordfreq import zipf_frequency
except ImportError as exc:
    raise SystemExit(
        "wordfreq kurulu değil. Önce şunu çalıştır:\n"
        "python -m pip install wordfreq"
    ) from exc


ROOT = Path(__file__).resolve().parents[1]
SOURCE_FILE = ROOT / "public" / "tdk-words.json"
OUTPUT_FILE = ROOT / "public" / "tdk-common-answers.json"
REPORT_FILE = ROOT / "scripts" / "common-answer-report.txt"

TURKISH_LETTERS = set("abcçdefgğhıijklmnoöprsştuüvyz")

# Bunlar gündelik oyunda kesin kalsın dediğimiz güvenlik kelimeleri.
FORCE_KEEP = set("""
abla abone acaba acele acemi acılı adres adeta ahenk ahlak ahşap aidat ajans aktif aktör akşam
alarm alev almak altın amaç ambar amca araba arama arıza armut aslan ateşli ayakkabı ayırma ayran
baba bacak balık banka barış basın basit başak beden belge bilet birlik bitki bozuk böyle bulmak
burun büyük bıçak biber biçim cadde cevap ceket cuma çanta çayır çocuk çorap çünkü dalga damar
danış deney dünya duvar düşün düğün erken ekmek elbise emekçi etmek evlat farklı fırın gazete
gerek gölge gönül güzel haber hafta hasta hava hesap hizmet hemen hızlı ıslak içmek insan işlek
kadın kalem kapak kardeş kaşık kitap kolay koltuk komik köpek köprü kuruş küçük limon masa mektup
motor mutfak neden nerede oğlan olmak orman ortak oyun ödeme pazar perde rahat renk sabah salı
sebep sokak sorun şeker şimdi tabak tamam tarla temiz tohum trafik uçak uygun üzüm varış yemek
yeni yolda yürek zaman zeytin
""".split())

# Bunlar TDK'de olsa bile oyun cevabı olarak çok zor/az bilinir gördüğümüz örnekler.
FORCE_REMOVE = set("""
abat abis abli abra abus acve acyo abaşo abosa abraş abuli acibe acuze afazi afoni agraf ahcar
ahfat ahlaf ahraz akait akaju akala akont akpas akvam amudi anlak anüri apotr adacyo adenit
agnosi agnozi agrafi aganta akamet akaret akasma aksona aksuna aktüer alivre amnezi anilin anofel
arkeen arktik artrit artroz asepsi asetik atavik ateizm
""".split())


def normalize_word(raw: str, length: int) -> str | None:
    word = (
        raw.strip()
        .lower()
        .replace("â", "a")
        .replace("î", "i")
        .replace("û", "u")
    )

    if len(word) != length:
        return None

    if any(ch not in TURKISH_LETTERS for ch in word):
        return None

    return word


def load_words(path: Path) -> dict[int, list[str]]:
    if not path.exists():
        raise SystemExit(f"Bulunamadı: {path}")

    payload = json.loads(path.read_text(encoding="utf-8"))
    source = payload.get("words", payload)

    result: dict[int, list[str]] = {}

    for length in (4, 5, 6):
        raw_words = source.get(str(length), [])
        words = sorted({
            word
            for item in raw_words
            if (word := normalize_word(str(item), length))
        })

        if not words:
            raise SystemExit(f"{length} harfli kelime listesi boş.")

        result[length] = words

    return result


@lru_cache(maxsize=None)
def word_score(word: str) -> float:
    # Türkçe kullanım sıklığı. Yüksek skor = daha gündelik/kullanılır.
    score = zipf_frequency(word, "tr", wordlist="best")

    # Bazı yaygın mastar fiiller frekans listelerinde beklenenden düşük çıkabilir.
    if word.endswith(("mak", "mek")):
        score += 0.15

    if word in FORCE_KEEP:
        score += 100.0

    if word in FORCE_REMOVE:
        score -= 100.0

    return score


def build_common_list(words: list[str], ratio: float) -> tuple[list[str], list[str]]:
    keep_count = math.ceil(len(words) * ratio)

    ranked = sorted(
        words,
        key=lambda item: (word_score(item), item),
        reverse=True,
    )

    kept = sorted(ranked[:keep_count])
    removed = sorted(ranked[keep_count:], key=lambda item: (word_score(item), item))

    return kept, removed


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--ratio",
        type=float,
        default=0.85,
        help="Yeni cevap listesinin eski listeye oranı. 0.70 altına düşmemeli. Örn: 0.85",
    )
    args = parser.parse_args()

    if args.ratio < 0.70 or args.ratio > 1.0:
        raise SystemExit("--ratio 0.70 ile 1.00 arasında olmalı. Örn: --ratio 0.85")

    words_by_length = load_words(SOURCE_FILE)

    output_words: dict[str, list[str]] = {}
    report_lines = [
        f"Hedef oran: {args.ratio:.0%}",
        "",
    ]

    original_total = 0
    new_total = 0

    for length in (4, 5, 6):
        words = words_by_length[length]
        kept, removed = build_common_list(words, args.ratio)

        original_total += len(words)
        new_total += len(kept)
        output_words[str(length)] = kept

        report_lines.append(
            f"{length} harf: {len(words)} -> {len(kept)} kelime "
            f"({len(kept) / len(words):.1%})"
        )

        report_lines.append(
            "Çıkarılan düşük frekanslı örnekler: "
            + ", ".join(removed[:80])
        )

        report_lines.append("")

    report_lines.append(
        f"Toplam: {original_total} -> {new_total} kelime "
        f"({new_total / original_total:.1%})"
    )

    OUTPUT_FILE.write_text(
        json.dumps(
            {
                "source": "Common Turkish answer pool generated from local TDK word list using wordfreq",
                "sourceFile": "public/tdk-words.json",
                "targetRatio": args.ratio,
                "generatedAt": datetime.now(timezone.utc).isoformat(),
                "words": output_words,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    REPORT_FILE.write_text("\n".join(report_lines), encoding="utf-8")

    print(f"Yazıldı: {OUTPUT_FILE}")
    print(f"Rapor:   {REPORT_FILE}")
    print()
    print("\n".join(report_lines))


if __name__ == "__main__":
    main()
