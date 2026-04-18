-- Turkish public legal Markdown (optional locale-specific bodies for mf-expo).
-- When non-empty, the app uses these for Turkish UI; otherwise it falls back to EN keys from migration 013.

INSERT INTO app_settings (key, value, description, is_public) VALUES
(
    'public_help_faq_markdown_tr',
    $faq$# Yardım ve SSS

**MF Project Tracker** (MasterFabric) uygulamasına hoş geldiniz. Bu ekranda kısa yanıtlar bulabilirsiniz; başka konularda **Ayarlar** üzerinden **geri bildirim** gönderin — ekip konuşmanızda yanıtlayabilir.

---

## Başlarken

- **Ana ekran** — Projeler, yapılacaklar ve (takımınız varsa) kuruluş güncellemeleri için giriş noktanız.
- **Ayarlar** — Dil, görünüm, bildirimler, profil ve destek bağlantıları.

Birçok özelliği hesap oluşturmadan kullanabilirsiniz; hesap açmak sunucuda eşitleme, kuruluşlar ve kayıtlı tercihler için gereklidir.

---

## Hesap ve giriş

- **Kayıt / Giriş** — E-postanızı kullanın. Yöneticinizin yapılandırdığı doğrulama adımlarını izleyin.
- **Çıkış** — Giriş yaptığınızda Ayarlar’da kullanılabilir. Uygulamayı temizlemeden cihazdaki yerel veriler kalabilir.
- **Şifremi unuttum** — Dağıtımınız destekliyorsa giriş ekranındaki kurtarma akışını kullanın.

---

## Yapılacaklar ve projeler

- Uygulamanın sunduğu akışlardan **yapılacaklar** oluşturun, düzenleyin ve tamamlayın.
- **Kuruluş yapılacakları** üyelik gerektirebilir; göremiyor veya düzenleyemiyorsanız kuruluş yöneticinize danışın.

---

## Kuruluşlar ve iş birliği

- **Kuruluş** profilleri, haberler ve (açıksa) sohbet kuruluşunuz tarafından yönetilir; yalnızca yöneticiler/sahipler bazı ayarları veya üyeliği değiştirebilir.
- **Davet** aldıysanız davet akışından kabul edin; bekleyen davetler yöneticiler tarafından yeniden gönderilebilir veya iptal edilebilir.

---

## Bildirimler

- **Anlık** ve uygulama içi bildirimler cihaz izinlerine ve sunucu ayarlarına bağlıdır. Derlemeniz sunduğunda tercihleri Ayarlar’dan düzenleyebilirsiniz.

---

## Geri bildirim ve destek

- **Geri bildirim gönder** (Ayarlar) kısa bir form açar; mesajınız ekip gelen kutusuna gider.
- **Misafirler** yanıtlayabilmemiz için e-posta girer.
- **Geri bildirimlerim** konularınızı listeler; bir konuya dokunarak ekibin yanıtları dahil zaman çizelgesini görürsünüz.

---

## Gizlilik ve yasal

- **Gizlilik Politikası** Ayarlar’dan bağlanır; bu dağıtımın verileri nasıl işlediğini özetler (ayrıntılar için o belgeye bakın).

---

## Sorun giderme

| Sorun | Deneyebilecekleriniz |
|-------|----------------------|
| Giriş yapılamıyor | Ağı, bu derleme için doğru API adresini ve kimlik bilgilerini kontrol edin. |
| Boş Yardım / Gizlilik | Yönetici uygulama ayarlarında Markdown yayınlamalıdır (`public_help_faq_markdown` / `public_privacy_policy_markdown` ve isteğe bağlı `*_tr` anahtarları). |
| Geri bildirim gitmiyor | İnternet erişimini doğrulayın; misafirler geçerli e-posta girmelidir. |

_Son güncelleme: mf-go migration 018 (Türkçe gövde)._
$faq$,
    'Public Help & FAQ — Turkish Markdown (mf-expo locale tr)',
    true
),
(
    'public_privacy_policy_markdown_tr',
    $priv$# Gizlilik Politikası

**MF Project Tracker** (“Uygulama”), MasterFabric yığınının parçası olarak sunulur. Bu metin, Uygulamayı kullandığınızda **bu derlemeye bağlı arka uç** tarafından hangi bilgilerin işlenebileceğini üst düzeyde açıklar. **Gerçek** uygulamalar mf-go dağıtımınız, günlük kaydı, analiz ve üçüncü taraflara bağlıdır — yasal düzeyde metin için **yönetici uygulama ayarlarından** bu metni özelleştirin.

---

## Kimleri kapsar

- Bu arka uca bağlı mobil veya web istemcisinin **kullanıcıları**.
- Hesap oluşturmadan geri bildirimde e-posta veren **misafirler**.

---

## Toplanabilecek bilgiler

Kullandığınız özelliklere ve sunucu yapılandırmasına bağlı olarak şunlar dahil olabilir:

- **Hesap verileri** — E-posta, görünen ad, sağladığınız profil alanları ve kimlik doğrulama meta verileri.
- **Kullanım ve cihaz verileri** — Cihaz tanımlayıcıları, uygulama sürümü, işletim sistemi ve mf-go tarafından uygulanan oturum/cihaz kayıtları.
- **Operasyonel içerik** — Yapılacaklar, kuruluş üyeliği, mesajlar, haberler, bildirimler, **geri bildirim konuları** ve hizmet için saklanan benzer veriler.
- **Teknik günlükler** — Dağıtımınızın altyapı günlükleri (saklama süresi operatör seçimidir).

Bu liste tümü kapsayıcı değildir; operatörünüz gerçek veri akışlarıyla hizalamalıdır.

---

## Bilgilerin kullanımı

- **Hizmeti çalıştırmak** — Kimlik doğrulama, veri eşitleme, bildirim ve beklediğiniz içerik.
- **Destek** — Gönderdiğiniz **geri bildirimlere** yanıt vermek gibi.
- **Güvenlik** — Kötüye kullanım önleme, denetim ve geçerli yasaya uyum (operatör yapılandırmasına bağlı).

---

## Paylaşım

Veriler şunlar tarafından görülebilir:

- Kuruluş kapsamındaki özellikler için **kuruluş yöneticileriniz/sahipleriniz**.
- Barındırma, OTP için e-posta/SMS, anlık bildirim sağlayıcıları gibi **hizmet operatörleri** (dağıtım anlaşmalarınıza tabi).

Varsayılan ürün tutuşunda **kişisel veri satışı** yoktur; kuruluşunuzun politikaları gerektiğinde önceliklidir.

---

## Saklama ve silme

Saklama süresi **sunucu politikalarına** ve migrasyonlara bağlıdır (ör. hesap silme, kuruluş kaldırma). Verilerin ne kadar tutulduğunu ve silme taleplerini yöneticinize sorun.

---

## Seçenekleriniz

- Mümkün olduğunda Ayarlar’dan **bildirimleri**, **dili** ve **görünümü** ayarlayın.
- Derlemeniz sunuyorsa **çıkış** veya **hesabı sil**; bazı etkiler sunucuda anında, bazıları yönetici işlemi gerektirebilir.

---

## Çocukların gizliliği

Hizmet, yargı bölgenizin gerektirdiği yaşın altındaki çocuklara yönelik değildir. Uygulamayı çocuklara yönelik hizmetler için kullanmayın, aksi halde dağıtımınız yasalara uymalıdır.

---

## Değişiklikler

Bu politika metni güncellenebilir; uygulama içi belge **genel uygulama ayarlarından** yüklendiği için operatörler yeni istemci sürümü olmadan (önbellek yenilenince) revizyon yayınlayabilir.

---

## İletişim

**Bu dağıtıma** özgü gizlilik talepleri için **kuruluş yöneticinize** veya bu mf-go örneğini işleten ekibe başvurun.

_Şablon — üretim için hukuk danışmanlığıyla gözden geçirin._
$priv$,
    'Public Privacy Policy — Turkish Markdown (mf-expo locale tr)',
    true
)
ON CONFLICT (key) DO UPDATE SET
    value = CASE
        WHEN trim(app_settings.value) = '' THEN EXCLUDED.value
        ELSE app_settings.value
    END,
    description = EXCLUDED.description,
    is_public = true,
    updated_at = NOW();
