# TDK Lingo — Local React Game

Yerel bilgisayarda çalışan Lingo benzeri Türkçe kelime oyunu.

## Kurulum

Bu pakette `public/tdk-words.json` hazır geliyor. İlk çalıştırma için TDK kelime listesini ayrıca üretmene gerek yok:

```bash
npm install
npm run dev
```

Tarayıcıda Vite'ın verdiği yerel adresi aç. Genelde:

```text
http://127.0.0.1:5173
```

`index.html` dosyasını çift tıklayarak açma; Vite sunucusu üzerinden çalıştır.

## Windows'ta kolay başlatma

`lingo-tdk-local` klasörünün içindeki `CALISTIR-WINDOWS.bat` dosyasına çift tıkla. İlk çalıştırmada `npm install` otomatik yapılır.

## Yeni oyuncu deneyimi özellikleri

- Oyun artık doğrudan başlamaz; önce “Oyuna Başla” ekranı gelir.
- Doğru veya yanlış tur sonunda doğru kelime ekranda daha uzun süre görünür.
- Yeni kelimeye geçiş daha yavaştır; oyuncu sonucu okuyabilir.
- Ses efektleri vardır: başlangıç, tahmin, doğru cevap, TDK dışı kelime, süre dolması, tur geçişi ve final.
- Ses üst sağdaki butondan açılıp kapatılabilir.
- Tur çubuğunda doğru bilinen turlar yeşil, kaçan turlar kırmızı görünür.
- Kalan hak, ilk harf ve kısa klavye ipuçları ekranda görünür.
- TDK listesinde olmayan tahmin satırı kırmızı olur ve yanında açıklama çıkar.

## TDK listesini yenilemek istersen

TDK autocomplete kaynağından yeni liste üretmek için:

```bash
npm run words
```

Ardından geliştirme sunucusunu yeniden başlat:

```bash
npm run dev
```

TDK endpoint'i erişilemezse script mevcut `public/tdk-words.json` dosyasını korur.

## Kurallar

- 10 tur: 3 adet 4 harfli, 4 adet 5 harfli, 3 adet 6 harfli kelime.
- Her kelimede ilk harf açık gelir.
- Her tahmin için 20 saniye vardır.
- En fazla 5 tahmin hakkı vardır.
- Doğru yerdeki harf yeşil, yanlış yerdeki doğru harf sarı görünür.
- TDK listesinde olmayan kelime tamamen kırmızı görünür ve tahmin hakkı yanar.
- Skor, doğru bilinen kelime sayısıdır.

## Kelime havuzu

`public/tdk-words.json`, TDK'dan derlenmiş tek kelimelik 4, 5 ve 6 harfli madde başlarını içerir.

Paket içindeki hazır havuz:

- 4 harfli: 1989 kelime
- 5 harfli: 5313 kelime
- 6 harfli: 5795 kelime

Şapkalı harfler oyun için sadeleştirilir: `â -> a`, `î -> i`, `û -> u`. Özel adlar, deyimler, boşluklu maddeler ve noktalama içeren maddeler filtrelenir.
