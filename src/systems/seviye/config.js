// Seviye sistemi ayarları: mesaj ve ses için ayrı XP birikir, ana seviyelerde (5'in katları, 100'e kadar) rol
// verilir. Roller ID'leriyle aşağıda tanımlı; ana seviyeye ulaşan üyeye ilgili rol verilir.
const MILESTONES = Array.from({ length: 20 }, (_, i) => (i + 1) * 5); // 5, 10, 15, ..., 100

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
  roles: {
    mesaj: {
      5: '1556402675904544798',
      10: '1556402675673862286',
      15: '1556402675975983206',
      20: '1556402676072194160',
      25: '1556402676282036244',
      30: '1556402676265390160',
      35: '1556402676604862475',
      40: '1556402676793876680',
      45: '1556402676936347742',
      50: '1556402676835557416',
      55: '1556402677079089332',
      60: '1556402677087473837',
      65: '1556402677100052561',
      70: '1556402677133611050',
      75: '1556402677469155439',
      80: '1556402677779398840',
      85: '1556402677632598056',
      90: '1556402678328725696',
      95: '1556402678450364416',
      100: '1556402678769262732',
    },
    ses: {
      5: '1556402677863424104',
      10: '1556402678597156945',
      15: '1556402678081265754',
      20: '1556402678299631767',
      25: '1556402677917683753',
      30: '1556403484922871939',
      35: '1556403484990111761',
      40: '1556403485358956544',
      45: '1556403485501685942',
      50: '1556403485593960578',
      55: '1556403485598023722',
      60: '1556403485539438754',
      65: '1556403485661204551',
      70: '1556403485912731718',
      75: '1556403486260854895',
      80: '1556403485769994370',
      85: '1556403486348939314',
      90: '1556403486499938325',
      95: '1556403486621437982',
      100: '1556403486713974805',
    },
  },
};
