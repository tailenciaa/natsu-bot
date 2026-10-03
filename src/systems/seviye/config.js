// Seviye sistemi ayarları: mesaj ve ses için ayrı XP birikir, ana seviyelerde (5'in katları, 100'e kadar) rol
// verilir. Roller Discord'da oluşturulup ID'leri buraya eklenene kadar rol verilmez, sadece seviye atlama duyurulur.
const MILESTONES = Array.from({ length: 20 }, (_, i) => (i + 1) * 5); // 5, 10, 15, ..., 100
const emptyRoles = () => Object.fromEntries(MILESTONES.map((level) => [level, null]));

module.exports = {
  // Seviye atlama duyurularının gönderileceği kanal
  channel: '1538534603902554182',

  // Mesaj başına kazanılan XP (bu aralıkta rastgele) ve spam'i önlemek için art arda mesajlar arası bekleme (saniye)
  message: { xpMin: 15, xpMax: 25, cooldownSeconds: 60 },

  // Sesli kanalda geçirilen her dakika için kazanılan sabit XP
  voice: { xpPerMinute: 6 },

  // N. seviyeye ulaşmak için gereken toplam XP (klasik büyüyen eğri: her seviye bir öncekinden daha zor)
  xpForLevel: (level) => 10 * level * level + 90 * level + 150,

  // Rol verilecek ana seviyeler
  milestones: MILESTONES,

  // Ana seviyelerde verilecek roller: { mesaj: { 5: roleId, 10: roleId, ... }, ses: { ... } }
  roles: { mesaj: emptyRoles(), ses: emptyRoles() },
};
