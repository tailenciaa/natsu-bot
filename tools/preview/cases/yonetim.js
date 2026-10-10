// Cezalarım, yetki, temizle, yayın ve partner görme sistemlerinin mesajları: gerçek ui fonksiyonları çağrılır
module.exports = ({ mock, ui, src }) => {
  const cz = src('systems/cezalarim/ui');
  const yetki = src('systems/yetki/ui');
  const yetkiConfig = src('systems/yetki/config');
  const etiket = src('systems/etiket/ui');
  const yayin = src('systems/yayin/ui');
  const pg = src('systems/partnergorme/ui');
  const destek = src('systems/destek/ui');

  const guild = mock.guild({ name: 'Kazuki Sunucusu' });
  const member = mock.user({ username: 'mehmet', displayName: 'Mehmet' });
  const staff = mock.user({ username: 'ayse', displayName: 'Ayşe' });
  const admin = mock.user({ username: 'ali', displayName: 'Ali' });
  const ep = { flags: ui.EPHEMERAL_CV2, allowedMentions: { parse: [] } };
  const noMentions = { allowedMentions: { parse: [] } };

  // Sicil kaydı (sicil/moderation.js punish ile aynı şema)
  let number = 11;
  const punishment = (o = {}) => {
    number += 1;
    return {
      id: `${guild.id}-${number}`,
      number,
      guildId: guild.id,
      userId: member.id,
      username: member.username,
      type: 'mute',
      reason: 'Sohbet kanalında art arda küfürlü mesaj gönderdi.',
      by: staff.id,
      createdAt: mock.ago(2 * mock.DAY),
      duration: 3 * mock.DAY,
      expiresAt: Date.now() + mock.DAY,
      status: 'active',
      extensions: [],
      savedRoles: null,
      ...o,
    };
  };
  const mute = punishment({ number: 12 });
  const jail = punishment({ number: 13, type: 'jail', reason: 'Yetkiliye hakaret etti.', duration: null, expiresAt: null });
  const warn = punishment({ number: 14, type: 'uyari', reason: 'Reklam yapmak yasaktır, kurallara dikkat et.', duration: null, expiresAt: null });
  const ban = punishment({ number: 15, type: 'ban', reason: 'Sunucudaki üyelere dolandırıcılık amaçlı mesaj attı.', duration: null, expiresAt: null });
  const longReason = Array.from({ length: 10 }, (_, i) => `Sohbet kanallarında art arda kural ihlali yaptı (${i + 1}).`).join('\n');
  const long = punishment({ number: 16, reason: longReason });
  const many = (n) =>
    Array.from({ length: n }, (_, i) =>
      punishment({ number: 100 + i, type: i % 2 ? 'mute' : 'ban', expiresAt: Date.now() + (i + 1) * mock.HOUR, reason: `Örnek sebep ${i + 1}: ${'ayrıntı '.repeat(8)}`.trim() }),
    );
  const objection = 'Bu mesajı ben yazmadım, hesabım çalınmıştı. Şifremi hemen değiştirdim ve yetkililere haber verdim.';

  return [
    // ── Cezalarım ────────────────────────────────────────────────────────────
    {
      id: 'cz-panel',
      title: 'Cezalarım paneli',
      where: '#cezalarım kanalı, bot açılırken gönderilen kalıcı panel',
      visibility: 'panel',
      kind: 'message',
      build: () => ({ components: [cz.panel()] }),
    },
    {
      id: 'cz-jail-panel',
      title: 'Jail bilgilendirme paneli',
      where: 'Jail kanalı, bot açılırken gönderilen kalıcı panel',
      visibility: 'panel',
      kind: 'message',
      build: () => ({ components: [cz.jailPanel()] }),
    },
    {
      id: 'cz-sure',
      title: 'Ceza süreleri: süreli, süresiz ve uyarı',
      where: 'Panelde Süreyi Öğren butonuna basınca, sadece basana',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({ components: [cz.sureView([mute, jail, warn])], ...ep }),
    },
    {
      id: 'cz-sure-bos',
      title: 'Ceza süreleri: aktif ceza yok',
      where: 'Süreyi Öğren butonuna basınca, sadece basana',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({ components: [cz.sureView([])], ...ep }),
    },
    {
      id: 'cz-sure-cok',
      title: 'Ceza süreleri: çok sayıda kayıt',
      where: 'Süreyi Öğren butonuna basınca, 30 aktif kayıt',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({ components: [cz.sureView(many(30))], ...ep }),
    },
    {
      id: 'cz-sebep',
      title: 'Ceza sebepleri',
      where: 'Panelde Sebebi Öğren butonuna basınca, sadece basana',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({ components: [cz.sebepView([mute, ban, long])], ...ep }),
    },
    {
      id: 'cz-sebep-bos',
      title: 'Ceza sebepleri: aktif ceza yok',
      where: 'Sebebi Öğren butonuna basınca, sadece basana',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({ components: [cz.sebepView([])], ...ep }),
    },
    {
      id: 'cz-sebep-cok',
      title: 'Ceza sebepleri: çok sayıda kayıt',
      where: 'Sebebi Öğren butonuna basınca, 30 aktif kayıt',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({ components: [cz.sebepView(many(30))], ...ep }),
    },
    {
      id: 'cz-itiraz-yok',
      title: 'İtiraz: itiraz edilecek ceza yok',
      where: 'Panelde İtiraz Et butonuna basınca, sadece basana',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({ components: [cz.itirazNoneView()], ...ep }),
    },
    {
      id: 'cz-itiraz-sec',
      title: 'İtiraz: ceza seçme menüsü',
      where: 'Panelde İtiraz Et butonuna basınca, sadece basana',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({ components: [cz.itirazPicker([mute, jail, ban, long])], ...ep }),
    },
    {
      id: 'cz-itiraz-sec-cok',
      title: 'İtiraz: ceza seçme menüsü, çok sayıda kayıt',
      where: 'İtiraz Et butonuna basınca, 30 aktif kayıt',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({ components: [cz.itirazPicker(many(30))], ...ep }),
    },
    {
      id: 'cz-itiraz-modal',
      title: 'İtiraz formu',
      where: 'Menüden ceza seçilince açılır',
      visibility: 'ephemeral',
      kind: 'modal',
      build: () => cz.itirazModal(mute),
    },
    {
      id: 'cz-talep-konu',
      title: 'İtiraz talebi: destek talebinde görünen konu',
      where: 'Destek talebi alt başlığı, itiraz formu gönderilince açılan talep',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [destek.ticketPanel(mock.ticket({ guildId: guild.id, ownerId: member.id, reason: cz.itirazTicketReason(mute, objection) }))],
        ...noMentions,
      }),
    },
    {
      id: 'cz-karti-bekleyen',
      title: 'İtiraz kartı: karar bekliyor (süreli ceza)',
      where: 'İtiraz talebinin alt başlığı, talep açılınca gönderilir',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [cz.itirazCard(mute, objection, null)], ...noMentions }),
    },
    {
      id: 'cz-karti-bekleyen-sureli-yasak',
      title: 'İtiraz kartı: karar bekliyor (süresiz yasaklama)',
      where: 'İtiraz talebinin alt başlığı',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [cz.itirazCard(ban, objection, null)], ...noMentions }),
    },
    {
      id: 'cz-karti-uyari',
      title: 'İtiraz kartı: karar bekliyor (uyarı)',
      where: 'İtiraz talebinin alt başlığı',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [cz.itirazCard(warn, objection, null)], ...noMentions }),
    },
    {
      id: 'cz-karti-uzun',
      title: 'İtiraz kartı: uzun sebepler',
      where: 'İtiraz talebinin alt başlığı',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [cz.itirazCard(long, 'Uzun itiraz sebebi. '.repeat(25).trim(), null)], ...noMentions }),
    },
    {
      id: 'cz-karti-onayli',
      title: 'İtiraz kartı: onaylandı',
      where: 'İtiraz talebinin alt başlığı, yetkili onaylayınca güncellenir',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [cz.itirazCard(punishment({ number: 20, status: 'lifted' }), objection, { sonuc: 'onayla', by: staff.id })],
        ...noMentions,
      }),
    },
    {
      id: 'cz-karti-reddedilmis',
      title: 'İtiraz kartı: reddedildi',
      where: 'İtiraz talebinin alt başlığı, yetkili reddedince güncellenir',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [cz.itirazCard(mute, objection, { sonuc: 'reddet', by: staff.id })], ...noMentions }),
    },

    // ── Yetki ────────────────────────────────────────────────────────────────
    {
      id: 'yetki-bos',
      title: 'Yetki ver paneli: rütbe seçilmemiş',
      where: '/yetki-ver komutu, yetkili komut kanalı',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [yetki.staffPanel({ user: member, levelId: null, permIds: [], dutyIds: [] })], ...noMentions }),
    },
    {
      id: 'yetki-secili',
      title: 'Yetki ver paneli: rütbe seçilmiş',
      where: 'Rütbe menüsünden seçim yapılınca panel güncellenir',
      visibility: 'public',
      kind: 'message',
      build: () => {
        const level = yetkiConfig.levels[5];
        return {
          components: [yetki.staffPanel({ user: member, levelId: level.id, permIds: [...level.perms], dutyIds: [...level.duties] })],
          ...noMentions,
        };
      },
    },
    {
      id: 'yetki-verildi',
      title: 'Yetki verildi kaydı',
      where: 'Yetkiyi Ver butonuna basınca panelin yerine geçer',
      visibility: 'public',
      kind: 'message',
      build: () => {
        const level = yetkiConfig.levels[7];
        const roleIds = [level.roleId, ...level.extraRoleIds, ...yetkiConfig.perms.map((p) => p.roleId)];
        return {
          components: [
            yetki.staffPanel({ user: member, levelId: level.id, permIds: [...level.perms], dutyIds: [...level.duties], done: true, by: admin.id, roleIds }),
          ],
          ...noMentions,
        };
      },
    },
    {
      id: 'yetki-verildi-eksik-rol',
      title: 'Yetki verildi kaydı: bazı roller ayarlı değil',
      where: 'Yetkiyi Ver butonuna basınca, rolü boş bırakılmış yetki varsa',
      visibility: 'public',
      kind: 'message',
      build: () => {
        const level = yetkiConfig.levels[0];
        return {
          components: [
            yetki.staffPanel({ user: member, levelId: level.id, permIds: [...level.perms], dutyIds: [], done: true, missingRoles: true, by: admin.id, roleIds: [level.roleId] }),
          ],
          ...noMentions,
        };
      },
    },
    {
      id: 'yetki-dm',
      title: 'DM: yetki verildi',
      where: 'Yetkiyi Ver butonuna basınca yeni yetkiliye özel mesaj',
      visibility: 'dm',
      kind: 'message',
      build: () => {
        const level = yetkiConfig.levels[5];
        return { components: [yetki.grantDm(guild.name, { level, permIds: [...level.perms], dutyIds: [...level.duties], by: admin.id })] };
      },
    },
    {
      id: 'yetki-al',
      title: 'Yetki al paneli',
      where: '/yetki-al komutu, yetkili komut kanalı; menülerden seçim yapıldıkça güncellenir',
      visibility: 'public',
      kind: 'message',
      build: () => {
        const level = yetkiConfig.levels[5];
        const held = { levelIds: [level.id], permIds: [...level.perms], dutyIds: [...level.duties] };
        return {
          components: [yetki.takePanel({ user: member, held, picked: { levelIds: [], permIds: ['kick'], dutyIds: ['alim'] } })],
          ...noMentions,
        };
      },
    },
    {
      id: 'yetki-alindi',
      title: 'Yetki alındı kaydı',
      where: 'Seçilenleri Al ya da Hepsini Al butonuna basınca panelin yerine geçer',
      visibility: 'public',
      kind: 'message',
      build: () => {
        const level = yetkiConfig.levels[7];
        const held = { levelIds: [level.id], permIds: [...level.perms], dutyIds: [...level.duties] };
        const roleIds = [level.roleId, ...level.extraRoleIds, ...yetkiConfig.perms.map((p) => p.roleId)];
        return { components: [yetki.takePanel({ user: member, held, picked: held, done: true, all: true, by: admin.id, roleIds })], ...noMentions };
      },
    },
    {
      id: 'yetki-alma-dm',
      title: 'DM: yetki alındı',
      where: 'Yetki alınınca yetkisi alınan kişiye özel mesaj',
      visibility: 'dm',
      kind: 'message',
      build: () => {
        const level = yetkiConfig.levels[5];
        const taken = { levelIds: [level.id], permIds: [...level.perms], dutyIds: [...level.duties] };
        return { components: [yetki.revokeDm(guild.name, { taken, by: admin.id, all: true })] };
      },
    },

    // ── Sunucu etiketi ───────────────────────────────────────────────────────
    {
      id: 'etiket-tesekkur',
      title: 'Etiket teşekkür mesajı',
      where: 'Duyuru kanalı, üye sunucu etiketini profiline takınca; sadece o üye etiketlenir',
      visibility: 'public',
      kind: 'message',
      build: () => {
        const tagged = Object.assign(Object.create(member), { primaryGuild: { tag: 'なつ' } });
        return { components: [etiket.thanks(tagged)], ...noMentions };
      },
    },

    // ── Yayın yetkisi ve partner görme ───────────────────────────────────────
    {
      id: 'yayin-panel',
      title: 'Yayın yetkisi paneli',
      where: 'Yayın kanalı, bot açılırken gönderilen kalıcı panel',
      visibility: 'panel',
      kind: 'message',
      build: () => ({ components: [yayin.panel()] }),
    },
    {
      id: 'pg-panel',
      title: 'Partner görme paneli',
      where: 'Partner görme kanalı, bot açılırken gönderilen kalıcı panel',
      visibility: 'panel',
      kind: 'message',
      build: () => ({ components: [pg.panel()] }),
    },
  ];
};
