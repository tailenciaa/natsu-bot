// Yeni/şüpheli hesap sisteminin mesajları: kısıtlı kanaldaki bilgilendirme paneli ve "ne zaman kalkacak" sonucu.
const { ButtonStyle } = require('discord.js');
const { alert, panel: standardPanel, unix } = require('../../core/ui');
const { botName } = require('../../core/config');
const config = require('./config');

const IDS = {
  sure: 'yenihesap:sure',
};

// Panel herkese açık kanalda durur; metin kişiden bağımsız yazılır (kısıtlı olmayanlar da okuyabilir)
const panel = () =>
  standardPanel({
    title: `${botName} Hesap Doğrulama`,
    sub: `Hesabı ${config.thresholdDays} günden yeni olanlar güvenlik için sunucuda yalnızca bu kanalı görebilir. **Süreyi Öğren** butonuyla kısıtlamanın ne zaman kalkacağını kendi hesabın için öğrenebilirsin.`,
    button: { id: IDS.sure, label: 'Süreyi Öğren', style: ButtonStyle.Success },
  });

// "Süreyi Öğren": hesap eşiğe ulaşana kadar kalan süre
function sureView(user, hasRestriction) {
  if (!hasRestriction) return alert('Hesabın kısıtlı değil.', '**Tüm kanalları** görebilirsin.', 'success');
  const freeAt = user.createdTimestamp + config.thresholdDays * 24 * 60 * 60 * 1000;
  // Süre dolmuş ama düzenli tarama rolü henüz almamış olabilir
  if (freeAt <= Date.now()) return alert('Kısıtlaman birazdan kalkacak.', 'Rol bir sonraki **düzenli taramada** otomatik alınır.', 'warning');
  return alert(`Kısıtlaman <t:${unix(freeAt)}:R> kendiliğinden kalkacak.`, `Kalkacağı tarih: <t:${unix(freeAt)}:F>`, 'warning');
}

module.exports = { IDS, panel, sureView };
