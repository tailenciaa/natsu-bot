// Log kategori grupları: her grubun kendi log kanalı olur ve kategorilerin alt başlıkları o kanalın altında
// açılır; log paneli de bu gruplara göre sekmelenir. Böylece 15 kategori tek menüde ve tek kanalda birbirine
// karışmaz. Yeni grup eklemek için buraya bir satır, kategorilerde de `group` alanı yeterli.
const categories = require('./categories');

const GROUPS = [
  {
    key: 'iletisim',
    label: 'İletişim',
    emoji: '💬',
    channelName: '💬・log-iletişim',
    description: 'Mesaj ve ses olayları',
  },
  {
    key: 'uye',
    label: 'Üye & Rol',
    emoji: '👥',
    channelName: '👥・log-üye-rol',
    description: 'Giriş/çıkış, isim ve rol olayları',
  },
  {
    key: 'moderasyon',
    label: 'Moderasyon',
    emoji: '🔨',
    channelName: '🔨・log-moderasyon',
    description: 'Ban, atma, susturma, jail, uyarı ve AutoMod',
  },
  {
    key: 'sunucu',
    label: 'Sunucu & Bot',
    emoji: '⚙️',
    channelName: '⚙️・log-sunucu-bot',
    description: 'Kanal, sunucu, takviye ve bot kayıtları',
  },
];

const groupOf = (key) => GROUPS.find((g) => g.key === key) ?? GROUPS[0];

// Kategorinin (anahtarı ya da nesnesinin) grubu
const groupOfCategory = (category) => groupOf((typeof category === 'string' ? categories.find((c) => c.key === category) : category)?.group);

const categoriesOf = (groupKey) => categories.filter((c) => c.group === groupKey);

module.exports = { GROUPS, groupOf, groupOfCategory, categoriesOf };
