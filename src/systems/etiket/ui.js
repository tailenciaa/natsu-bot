// Sunucu etiketi sisteminin mesajları
const { page, fields, field, stamp } = require('../../core/ui');
const config = require('./config');

// Etiketi takan üyeye kanalda teşekkür: sağ üstte üyenin fotoğrafı, kenar rengi config.color
function thanks(user) {
  return page({
    title: 'Etiketimizi Taktı',
    sub: 'Sunucumuzu profilinde temsil ettiğin için çok teşekkür ederiz. Sana özel etiket rolü de verildi; etiketi profilinde taşıdığın sürece bu rol sende kalır.',
    thumbnail: user.displayAvatarURL({ size: 256 }),
    accent: config.color,
    blocks: [fields(['**Etiket Bilgisi**', `<@${user.id}> artık profilinde \`${user.primaryGuild.tag}\` etiketini taşıyor.`]), stamp()],
  });
}

module.exports = { thanks };
