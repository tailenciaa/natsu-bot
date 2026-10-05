// Takviye (boost) ve emoji sistemleri (src/systems/boost/ui.js, src/systems/emoji/ui.js)
module.exports = ({ mock, ui, src }) => {
  const b = src('systems/boost/ui');
  const e = src('systems/emoji/ui');
  const boostConfig = src('systems/boost/config');
  const guild = mock.guild({ name: 'Kazuki Sunucusu' });
  const booster = mock.user({ username: 'mehmet', displayName: 'Mehmet' });
  const noMentions = { allowedMentions: { parse: [] } };
  const eph = { flags: ui.EPHEMERAL_CV2, ...noMentions };

  const emoji = (name, animated = false) => ({ id: mock.snowflake(), name, animated, toString: () => `<${animated ? 'a' : ''}:${name}:1234567890123456789>` });
  const found = [emoji('kedi'), emoji('dans', true), emoji('kalp'), emoji('sasirdi')];

  return [
    { id: 'panel', title: 'Booster İşlemleri paneli', where: 'Booster paneli kanalı', visibility: 'panel', kind: 'message', build: () => ({ components: [b.panel(guild)], ...noMentions }) },
    { id: 'dm-tesekkur', title: 'DM: takviyen için teşekkürler', where: 'Takviye edene', visibility: 'dm', kind: 'message', build: () => ({ components: [b.thanksDm(guild.name, boostConfig.panelChannel, boostConfig.perks)] }) },
    { id: 'kanal-tesekkur', title: 'Teşekkür kanalı bildirimi', where: 'Teşekkür kanalı', visibility: 'public', kind: 'message', build: () => ({ components: [b.channelThanks(booster)], ...noMentions }) },
    { id: 'takviyeci-degil', title: 'Takviyeci olmayan üyeye hata', where: 'Panel butonları', visibility: 'ephemeral', kind: 'message', build: () => ({ components: [b.notBoosterView()], ...eph }) },
    { id: 'cikartma-bilgi', title: 'Eski panel: çıkartma komuta yönlendirme', where: 'Eski panelin Çıkartma Ekle butonu', visibility: 'ephemeral', kind: 'message', build: () => ({ components: [b.stickerInfoView()], ...eph }) },
    { id: 'form-takma-ad', title: 'Form: takma ad değiştir', where: 'Takma Ad > Değiştir', visibility: 'ephemeral', kind: 'modal', build: () => b.nickModal('Mehmet') },
    { id: 'form-rol-yeni', title: 'Form: özel rol oluştur', where: 'Özel Rol > Ayarla', visibility: 'ephemeral', kind: 'modal', build: () => b.roleModal(null, { icons: true }) },
    { id: 'form-rol-simgesiz', title: 'Form: özel rol (sunucuda rol simgesi yok)', where: 'Özel Rol > Ayarla', visibility: 'ephemeral', kind: 'modal', build: () => b.roleModal(null, { icons: false }) },
    { id: 'emoji-sec', title: 'Emoji: sağ tık seçim paneli', where: 'Mesaja sağ tık > Emojileri Sunucuya Ekle', visibility: 'ephemeral', kind: 'message', build: () => ({ components: [e.pickPanel(found)], ...eph }) },
    { id: 'emoji-sonuc-tamam', title: 'Emoji: hepsi eklendi', where: '/emoji-ekle ya da seçim menüsü', visibility: 'ephemeral', kind: 'message', build: () => ({ components: [e.result(found.slice(0, 2), [])], ...eph }) },
    {
      id: 'emoji-sonuc-kismi',
      title: 'Emoji: bir kısmı eklendi',
      where: '/emoji-ekle ya da seçim menüsü',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({ components: [e.result(found.slice(0, 2), [{ name: ':sasirdi:', reason: 'Sunucunun emoji sınırı dolu.' }, { name: 'https://ornek.com/cok-uzun-bir-baglanti-adresi/resim.png', reason: 'Emoji bulunamadı ya da resmine ulaşılamadı.' }])], ...eph }),
    },
    { id: 'emoji-sonuc-hata', title: 'Emoji: hiçbiri eklenemedi', where: '/emoji-ekle ya da seçim menüsü', visibility: 'ephemeral', kind: 'message', build: () => ({ components: [e.result([], [{ name: ':kedi:', reason: 'Bu emoji zaten sunucuda.' }])], ...eph }) },
  ];
};
