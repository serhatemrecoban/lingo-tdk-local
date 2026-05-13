# TDK Lingo — Windows hızlı kurulum

Bu paket `public/tdk-words.json` dosyasını hazır içerir. Kelime listesini ayrıca indirmen gerekmez.

## En kolay yöntem

1. Zip dosyasını `C:\Users\coban\Desktop\Lingo` içine çıkar.
2. Çıkan `lingo-tdk-local` klasörünü aç.
3. `CALISTIR-WINDOWS.bat` dosyasına çift tıkla.
4. Terminalde verilen adresi tarayıcıda aç. Genelde:

```text
http://127.0.0.1:5173
```

Oyunu açınca önce başlangıç ekranı gelir. “Oyuna Başla” butonuna bastığında süre çalışmaya başlar.

## Git Bash ile çalıştırma

`package.json` dosyasının olduğu klasörde çalıştır:

```bash
cd ~/Desktop/Lingo/lingo-tdk-local
ls package.json
npm install
npm run dev
```

## Klasörü bulamazsan

```bash
cd ~/Desktop/Lingo
find . -maxdepth 4 -name package.json -print
```

Çıktı örneği:

```text
./lingo-tdk-local/package.json
```

Bu durumda:

```bash
cd ./lingo-tdk-local
npm install
npm run dev
```

## Sesler

Ses efektleri tarayıcı üzerinden üretilir; ayrıca ses dosyası gerekmez. Üst sağdaki “Ses/Sessiz” butonuyla kapatıp açabilirsin.
