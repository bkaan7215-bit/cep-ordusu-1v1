# Cep Ordusu: 1v1

Mobil tarayıcıda yatay ekranda oynanan, arkadaşla oda kodu üzerinden gerçek zamanlı 1'e 1 strateji oyunu prototipi. Referans videodaki temel oyun döngüsünden (altın üretimi, birlik kurma, üs saldırısı) esinlenen özgün bir uygulamadır; kaynak oyunun adı, görselleri, sesleri veya birebir arayüzü kullanılmaz.

## Özellikler

- Oda kurma ve 5 karakterli kodla arkadaş davet etme
- WebSocket üzerinden gerçek zamanlı eşleşme ve sunucu tarafında basit savaş simülasyonu
- Madenci, kılıçlı, okçu ve muhafız üretimi
- Altın ekonomisi, otomatik birlik hareketi, üs canı ve kazanma/kaybetme durumu
- Telefon/tablet için dokunmatik kontroller; yatay ekran düzeni
- Harita ve karakter çizimleri Canvas ile koddan üretilir

## Bilgisayarda çalıştırma

Node.js 18 veya üstü gerekir.

```bash
npm install
npm start
```

Tarayıcıda `http://localhost:3000` adresini aç.

## Arkadaşla internet üzerinden oynama

İki telefonun da aynı internette olması gerekmez; fakat uygulamanın herkese açık bir Node.js sunucusuna HTTPS üzerinden yüklenmesi gerekir. Bu klasörü Node.js uygulaması çalıştırabilen bir servise dağıt, başlangıç komutunu `npm start` olarak ayarla ve verilen HTTPS bağlantısını iki oyuncuya da gönder. WebSocket bağlantısı aynı sunucu üzerinden `/ws` yolunda çalışır; HTTPS üzerinde otomatik olarak WSS kullanılır.

Yerel bilgisayarda test ediyorsan iki cihaz aynı Wi-Fi ağındayken bilgisayarın yerel IP adresinden de bağlanabilir. Güvenlik duvarında 3000 portuna izin verilmesi gerekir.

## Kontroller

- **Madenci (70):** Her madenci düzenli altın üretimini artırır. En fazla 8 madenci.
- **Kılıçlı (110):** Yakın dövüş birimi.
- **Okçu (145):** Uzaktan saldırır.
- **Muhafız (180):** Yavaş ama dayanıklı yakın dövüş birimi.

## Not

Bu paket oynanabilir bir ilk sürümdür. Gerçek mağaza yayını için ayrıca uygulama ikonları, sesler, daha kapsamlı denge testi, bağlantı kopması/yeniden bağlanma akışı, sunucu koruması ve mobil cihaz testleri gerekir. Kaynak oyunun telifli varlıkları eklenmemiştir.
