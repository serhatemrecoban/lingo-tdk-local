#!/usr/bin/env python3
"""TDK autocomplete verisinden public/tdk-words.json üretir.

Script, TDK'nin autocomplete JSON kaynağından madde başlarını indirir ve Lingo
oyunu için tek kelimelik 4, 5 ve 6 harfli adaylara indirger. İndirme başarısız
olursa pakette hazır gelen public/tdk-words.json dosyasını korur.
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

SOURCE_URL = "https://sozluk.gov.tr/autocomplete.json"
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "tdk-words.json"
TURKISH_WORD = re.compile(r"^[abcçdefgğhıijklmnoöprsştuüvyz]+$")
HAT_MAP = str.maketrans({"â": "a", "î": "i", "û": "u"})
HEADERS = {
    # TDK sunucusu Python'ın varsayılan User-Agent bilgisini zaman zaman reddedebiliyor.
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/128.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json,text/plain,*/*",
}


def normalize(raw: str) -> str | None:
    """Lingo için tek kelimelik, küçük harfli 4/5/6 harf adaylarını normalize eder."""
    original = unicodedata.normalize("NFC", raw.strip())
    if not original:
        return None

    # Özel adları ve kısaltmaları ayıklamak için orijinal madde başında büyük harf varsa alma.
    if any(ch.isalpha() and not ch.islower() for ch in original):
        return None

    word = original.translate(HAT_MAP)
    if any(ch in word for ch in " -.'!,/()[]{}0123456789"):
        return None
    if not TURKISH_WORD.fullmatch(word):
        return None
    return word


def fetch_tdk_entries() -> Iterable[str]:
    request = urllib.request.Request(SOURCE_URL, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=45) as response:
        raw_bytes = response.read()

    data = json.loads(raw_bytes.decode("utf-8"))
    if not isinstance(data, list):
        raise ValueError("TDK autocomplete yanıtı beklenen liste formatında değil.")

    for item in data:
        if isinstance(item, dict) and isinstance(item.get("madde"), str):
            yield item["madde"]
        elif isinstance(item, str):
            yield item


def build_payload(entries: Iterable[str], source: str) -> dict[str, object]:
    buckets: dict[str, set[str]] = {"4": set(), "5": set(), "6": set()}

    for raw in entries:
        word = normalize(raw)
        if word and str(len(word)) in buckets:
            buckets[str(len(word))].add(word)

    words = {length: sorted(bucket) for length, bucket in buckets.items()}
    missing = [length for length, bucket in words.items() if not bucket]
    if missing:
        raise ValueError(f"Kelime havuzu boş görünüyor: {', '.join(missing)} harfli listeler.")

    return {
        "source": source,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "words": words,
    }


def write_payload(payload: dict[str, object]) -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    words = payload["words"]
    if not isinstance(words, dict):
        raise TypeError("Beklenen words sözlüğü üretilemedi.")

    print(f"Yazıldı: {OUT}")
    for length in ("4", "5", "6"):
        print(f"{length} harf: {len(words[length])} kelime")


def main() -> int:
    print(f"TDK verisi indiriliyor: {SOURCE_URL}")
    try:
        payload = build_payload(fetch_tdk_entries(), SOURCE_URL)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError, ValueError) as exc:
        if OUT.exists():
            print("TDK verisi indirilemedi, fakat mevcut public/tdk-words.json korunuyor.")
            print(f"Hata: {exc}")
            return 0
        print(f"TDK verisi indirilemedi ve public/tdk-words.json yok: {exc}", file=sys.stderr)
        return 1

    write_payload(payload)
    return 0


if __name__ == "__main__":
    sys.exit(main())
