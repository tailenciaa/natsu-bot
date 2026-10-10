// Destek sistemi (src/systems/destek/ui.js): gerçek ui fonksiyonları çağrılır
module.exports = ({ mock, ui, src }) => {
  const d = src('systems/destek/ui');
  const rating = src('systems/degerlendirme/ui');

  const guild = mock.guild({ name: 'Kazuki Sunucusu' });
  const owner = mock.user({ username: 'mehmet', displayName: 'Mehmet' });
  const staff = mock.user({ username: 'ayse', displayName: 'Ayşe' });
  const base = { guildId: guild.id, ownerId: owner.id };
  const waiting = () => mock.ticket({ ...base });
  const claimed = () => mock.ticket({ ...base, claimedBy: staff.id });
  const closed = () =>
    mock.ticket({ ...base, claimedBy: staff.id, closedBy: staff.id, closeReason: { label: 'Sorun çözüldü', note: 'Rol verildi, sorun giderildi.' } });
  const thread = mock.thread({ guild });
  const logFile = mock.file('destek-0008.txt', 'Destek talebi #0008\n[12:01] Mehmet: Merhaba\n[12:03] Ayşe: Merhaba, nasıl yardımcı olabilirim?\n');
  const noMentions = { allowedMentions: { parse: [] } };
  const staffRole = waiting().staffRoleId;

  // Durum paneli kartı: index.js'teki gibi çizilir ve mesajın ekine konur
  const nameOf = (id) => (id === staff.id ? 'ayse' : 'mehmet');
  const durum = (id, title, tickets, page = 0) => ({
    id,
    title,
    where: 'Durum kanalı, talep durumu değiştikçe aynı mesaj güncellenir',
    visibility: 'panel',
    kind: 'message',
    build: () => {
      const card = src('systems/destek/card').buildStatusCard(tickets, page, `${id}-${page}.png`, nameOf);
      return { components: [d.statusPanel(tickets, page, card.name)], files: [card], ...noMentions };
    },
  });
  const manyTickets = (n) => Array.from({ length: n }, (_, i) => mock.ticket({ number: i + 1, claimedBy: i % 2 ? staff.id : null }));
  // Numaralar eşsiz olmalı: aynı numara hem kartta hem menüde tekrar gibi görünüyor
  const durumTickets = () => [waiting({ number: 8 }), claimed({ number: 9 })];

  return [
    {
      id: 'panel',
      title: 'Destek paneli',
      where: 'Destek kanalına bot açılırken gönderilen kalıcı panel',
      visibility: 'panel',
      kind: 'message',
      build: () => ({ components: [d.panel()] }),
    },
    durum('durum-kart', 'Durum paneli: açık talepler (kart)', durumTickets()),
    durum('durum-bos', 'Durum paneli: açık talep yok (kart)', []),
    durum('durum-sayfa', 'Durum paneli: 9 talep, 2. sayfa', manyTickets(9), 1),
    {
      id: 'durum-metin',
      title: 'Durum paneli: kart çizilemedi (metinli yedek)',
      where: 'Durum kanalı, çizim hatasında',
      visibility: 'panel',
      kind: 'message',
      build: () => ({ components: [d.statusPanel(durumTickets())], ...noMentions }),
    },
    {
      id: 'talep-modal',
      title: 'Talep oluşturma formu',
      where: 'Panelde Talep Oluştur butonuna basınca açılır',
      visibility: 'ephemeral',
      kind: 'modal',
      build: () => d.ticketModal(),
    },
    {
      id: 'talep-bekleyen',
      title: 'Talep mesajı: bekleyen',
      where: 'Talep alt başlığı, üyenin gördüğü mesaj',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [d.ticketPanel(waiting())], ...noMentions }),
    },
    {
      id: 'talep-hatirlatildi',
      title: 'Talep mesajı: bekleyen, hatırlatma gönderilmiş',
      where: 'Talep alt başlığı, Hatırlat butonuna basıldıktan sonra',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [d.ticketPanel(mock.ticket({ ...base, notified: true }))], ...noMentions }),
    },
    {
      id: 'talep-ustlenilmis',
      title: 'Talep mesajı: üstlenilmiş',
      where: 'Talep alt başlığı, yetkili üstlenince güncellenir',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [d.ticketPanel(claimed())], ...noMentions }),
    },
    {
      id: 'talep-kapali',
      title: 'Talep mesajı: kapalı',
      where: 'Talep alt başlığı, talep kapanınca güncellenir (butonlar kalkar)',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [d.ticketPanel(closed())], ...noMentions }),
    },
    {
      id: 'yetkili-geldi',
      title: 'Yetkili geldi bildirimi',
      where: 'Talep alt başlığı, yetkili üstlenince üyeyi etiketler',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [d.claimedNotice(claimed())], allowedMentions: { users: [owner.id] } }),
    },
    {
      id: 'talep-kapandi',
      title: 'Talep kapatıldı bildirimi',
      where: 'Talep alt başlığı, kapatılınca gönderilir',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [d.ticketClosed(closed())], ...noMentions }),
    },
    {
      id: 'yetkili-bekleyen',
      title: 'Yetkili kanalı: yeni talep (bekleyen)',
      where: 'Yetkili talep kanalı, yetkili rolünü etiketler',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [d.claimRequest(waiting())], allowedMentions: { roles: [staffRole] } }),
    },
    {
      id: 'yetkili-ustlenilmis',
      title: 'Yetkili kanalı: talep üstlenilmiş',
      where: 'Yetkili talep kanalı, talebi üstlenince güncellenir',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [d.claimRequest(claimed())], ...noMentions }),
    },
    {
      id: 'yetkili-kapali',
      title: 'Yetkili kanalı: talep kapalı',
      where: 'Yetkili talep kanalı, talep kapanınca güncellenir',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [d.claimRequest(closed())], ...noMentions }),
    },
    {
      id: 'yetkili-hatirlatma',
      title: 'Yetkili kanalı: hatırlatma',
      where: 'Yetkili talep kanalı, üstlenme mesajına yanıt olarak gider',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [d.claimReminder(mock.ticket({ ...base, notified: true }))], allowedMentions: { roles: [staffRole] } }),
    },
    {
      id: 'talep-acildi',
      title: 'Talep açıldı onayı',
      where: 'Form gönderilince talebi açan üyeye, sadece ona görünür',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({ components: [d.ticketCreated(thread)], flags: ui.EPHEMERAL_CV2, allowedMentions: { parse: [] } }),
    },
    {
      id: 'kapat-modal',
      title: 'Talebi kapatma formu',
      where: 'Talepte Talebi Kapat butonuna basınca açılır',
      visibility: 'ephemeral',
      kind: 'modal',
      build: () => d.closeModal(),
    },
    {
      id: 'log-acilis',
      title: 'Log: talep açıldı',
      where: 'Destek log kanalı (ayarlıysa)',
      visibility: 'log',
      kind: 'message',
      build: () => ({ components: [d.openLog(waiting(), thread, owner)], allowedMentions: { parse: [] } }),
    },
    {
      id: 'log-kapanis',
      title: 'Log: talep kapatıldı + konuşma kaydı',
      where: 'Destek log kanalı (ayarlıysa), konuşma dosyası ekte',
      visibility: 'log',
      kind: 'message',
      build: () => ({ components: [d.closeLog(closed(), staff, logFile.name)], files: [logFile], allowedMentions: { parse: [] } }),
    },
    {
      id: 'dm-kapandi',
      title: 'DM: talebin kapatıldı (puanlama bölümüyle)',
      where: 'Talep sahibine DM, altında yetkiliyi puanlama butonları',
      visibility: 'dm',
      kind: 'message',
      build: () => ({ components: [d.closeDm(8, guild.name, { id: 'r1', score: 0, staffName: staff.displayName, category: 'destek' })] }),
    },
    {
      id: 'dm-kapandi-puanli',
      title: 'DM: talebin kapatıldı (puan verilmiş)',
      where: 'Talep sahibine DM, puan verildikten sonra yeşile döner',
      visibility: 'dm',
      kind: 'message',
      build: () => ({ components: [d.closeDm(8, guild.name, { id: 'r1', score: 5, staffName: staff.displayName, category: 'destek' })] }),
    },
    {
      id: 'dm-kapandi-puansiz',
      title: 'DM: talebin kapatıldı (değerlendirme yok)',
      where: 'Talep sahibine DM, değerlendirme oluşturulmadıysa',
      visibility: 'dm',
      kind: 'message',
      build: () => ({ components: [d.closeDm(8, guild.name, null)] }),
    },
    {
      id: 'puan-modal',
      title: 'Değerlendirme yorum formu',
      where: 'DM puan butonuna basınca açılır (degerlendirme sistemi)',
      visibility: 'ephemeral',
      kind: 'modal',
      build: () => rating.ratingModal({ id: 'r1', staffName: staff.displayName, category: 'destek' }, 4),
    },
  ];
};
