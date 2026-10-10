// Partner sistemi: oto partner teklifi, şartlar, inceleme kartı, paylaşım kartı, güvenilir liste ve yenileme akışı
module.exports = ({ mock, src }) => {
  const ui = src('systems/partner/ui');
  const guild = mock.guild({ name: 'Kazuki Sunucusu' });
  const member = mock.user({ username: 'mehmet', displayName: 'Mehmet' });
  const staff = mock.user({ username: 'ayse', displayName: 'Ayşe' });
  const noMentions = { allowedMentions: { parse: [] } };
  const ep = { flags: src('core/ui').EPHEMERAL_CV2, ...noMentions };

  const text = 'Anime ve sohbet sunucumuza bekleriz! Her gün etkinlik, çekiliş ve sesli sohbet. https://discord.gg/ornek';
  const request = (o = {}) => ({
    id: `${guild.id}-7`,
    number: 7,
    guildId: guild.id,
    requesterId: member.id,
    serverId: '123456789012345678',
    text,
    status: 'pending',
    source: 'oto',
    createdAt: mock.ago(mock.HOUR),
    decidedBy: null,
    decidedAt: null,
    ...o,
  });
  const entry = (o = {}) => ({
    id: `${guild.id}-3`,
    guildId: guild.id,
    sourceRequestId: `${guild.id}-7`,
    serverId: '123456789012345678',
    content: text,
    contactIds: [member.id],
    addedBy: staff.id,
    addedAt: mock.ago(3 * mock.DAY),
    ...o,
  });
  // Test listesindeki her satır farklı yetkili/tarih taşır: gerçek veride de satırlar özdeş olmaz
  const people = [member.id, staff.id, mock.user({ username: 'fatma', displayName: 'Fatma' }).id];
  const many = (n) =>
    Array.from({ length: n }, (_, i) =>
      entry({
        id: `${guild.id}-${i + 10}`,
        serverId: String(100000000000000000n + BigInt(i)),
        contactIds: i % 3 ? [people[i % people.length]] : [],
        addedBy: people[i % people.length],
        addedAt: mock.ago((3 + i) * mock.DAY),
      }),
    );
  const long = 'Çok uzun bir partner metni. '.repeat(120);

  // Güvenilir partnerler paneli kartı: index.js'teki (trustedPanelView) gibi çizilir ve mesajın ekine konur
  const panelKart = (id, title, entries, page = 0) => ({
    id,
    title,
    where: 'Güvenilir partnerler kanalı, liste değiştikçe aynı mesaj güncellenir',
    visibility: 'panel',
    kind: 'message',
    build: () => {
      const card = src('systems/partner/card').buildTrustedCard(entries, page, `${id}-${page}.png`);
      return { components: [ui.trustedListPanel(entries, page, card.name)], files: [card], ...noMentions };
    },
  });

  return [
    { id: 'baslat', title: 'Oto partner teklifi', where: 'Talep kanalında "partner" yazan üyeye yanıt', visibility: 'public', kind: 'message', build: () => ({ components: [ui.startPrompt(member.id)], ...noMentions }) },
    { id: 'baslat-gonderildi', title: 'Talep mesajı: şartlar bekleniyor', where: 'Form gönderilince talep mesajı', visibility: 'public', kind: 'message', build: () => ({ components: [ui.startPromptSuccess(false)], ...noMentions }) },
    { id: 'baslat-gonderildi-kabul', title: 'Talep mesajı: şartlar daha önce kabul edilmiş', where: 'Form gönderilince talep mesajı', visibility: 'public', kind: 'message', build: () => ({ components: [ui.startPromptSuccess(true)], ...noMentions }) },
    { id: 'form-talep', title: 'Form: oto partner', where: 'Oto Partner Yap butonu', visibility: 'ephemeral', kind: 'modal', build: () => ui.requestModalWithMessageId('123456789') },
    { id: 'sartlar', title: 'DM: partner şartları', where: 'Talep sahibine, ilk talepte', visibility: 'dm', kind: 'message', build: () => ({ components: [ui.termsDm('partner-sartlar-kabul:1')] }) },

    { id: 'inceleme', title: 'İnceleme kartı (bekleyen)', where: 'İnceleme kanalı', visibility: 'log', kind: 'message', build: () => ({ components: [ui.reviewCard(request())], allowedMentions: { roles: [] } }) },
    { id: 'inceleme-onay', title: 'İnceleme kartı (onaylandı)', where: 'İnceleme kanalı, karar sonrası', visibility: 'log', kind: 'message', build: () => ({ components: [ui.reviewCard(request({ status: 'approved' }), { sonuc: 'onayla', by: staff.id })], ...noMentions }) },
    { id: 'inceleme-red', title: 'İnceleme kartı (reddedildi)', where: 'İnceleme kanalı, karar sonrası', visibility: 'log', kind: 'message', build: () => ({ components: [ui.reviewCard(request({ status: 'rejected' }), { sonuc: 'reddet', by: staff.id })], ...noMentions }) },
    { id: 'inceleme-yasak', title: 'İnceleme kartı (sunucu yasaklandı)', where: 'İnceleme kanalı, yasaklama sonrası', visibility: 'log', kind: 'message', build: () => ({ components: [ui.reviewCard(request({ status: 'rejected' }), { sonuc: 'reddet', by: staff.id, banned: true })], ...noMentions }) },
    { id: 'inceleme-uzun', title: 'İnceleme kartı (çok uzun metin)', where: 'İnceleme kanalı', visibility: 'log', kind: 'message', build: () => ({ components: [ui.reviewCard(request({ text: long.slice(0, 1500) }))], allowedMentions: { roles: [] } }) },
    { id: 'sonuc-onay', title: 'DM: talebin onaylandı', where: 'Talep sahibine', visibility: 'dm', kind: 'message', build: () => ({ components: [ui.requesterResult('onayla', request(), staff.id)] }) },
    { id: 'sonuc-red', title: 'DM: talebin reddedildi', where: 'Talep sahibine', visibility: 'dm', kind: 'message', build: () => ({ components: [ui.requesterResult('reddet', request(), staff.id)] }) },
    { id: 'form-yasak', title: 'Form: sunucuyu yasakla', where: 'İnceleme kartında Yasaklıya Al', visibility: 'ephemeral', kind: 'modal', build: () => ui.banServerModal('123456789012345678') },
    { id: 'yasak-kayit', title: 'Yasaklı kanalı: sunucu yasaklandı', where: 'Yasaklı partnerler kanalı', visibility: 'log', kind: 'message', build: () => ({ components: [ui.serverBannedLog('123456789012345678', 'Troll talep, kurallarımıza aykırı içerik.', staff.id)], ...noMentions }) },
    { id: 'yasak-dm', title: 'DM: sunucun yasaklı', where: 'Yasaklı sunucudan talep gelince', visibility: 'dm', kind: 'message', build: () => ({ components: [ui.serverBannedDm('Troll talep, kurallarımıza aykırı içerik.')] }) },

    { id: 'paylasim', title: 'Paylaşım kartı', where: 'Paylaşım kanalı', visibility: 'public', kind: 'message', build: () => ({ components: [ui.postCard(request({ status: 'approved', decidedAt: Date.now() }), null, false)], ...noMentions }) },
    { id: 'paylasim-guvenilir', title: 'Paylaşım kartı (güvenilir listede)', where: 'Paylaşım kanalı', visibility: 'public', kind: 'message', build: () => ({ components: [ui.postCard(request({ status: 'approved' }), entry(), false)], ...noMentions }) },
    { id: 'paylasim-yasakli', title: 'Paylaşım kartı (gönderen yasaklı)', where: 'Paylaşım kanalı', visibility: 'public', kind: 'message', build: () => ({ components: [ui.postCard(request({ status: 'approved' }), null, true)], ...noMentions }) },
    { id: 'paylasim-elle-ek', title: 'Paylaşım kartı (elle atılan, ekli)', where: 'Paylaşım kanalı', visibility: 'public', kind: 'message', build: () => ({ components: [ui.postCard(request({ serverId: null, source: 'manuel', files: [{ name: '1-afis.png', image: true }, { name: '2-liste.txt', image: false }] }), null, false)], files: [mock.pngFile('1-afis.png'), mock.file('2-liste.txt', 'ornek')], ...noMentions }) },
    { id: 'paylasim-uzun', title: 'Paylaşım kartı (çok uzun metin)', where: 'Paylaşım kanalı', visibility: 'public', kind: 'message', build: () => ({ components: [ui.postCard(request({ text: long.repeat(2), serverId: null }), null, false)], ...noMentions }) },
    { id: 'form-guvenilir-ekle', title: 'Form: güvenilir listeye al (elle paylaşım)', where: 'Paylaşım kartında Güvenilir Listeye Al', visibility: 'ephemeral', kind: 'modal', build: () => ui.trustedAddModal('1-7', '123456789') },

    { id: 'liste-bos', title: '/guvenilir-partnerler (boş)', where: 'Komut', visibility: 'public', kind: 'message', build: () => ({ components: [ui.trustedList([])], ...noMentions }) },
    { id: 'liste', title: '/guvenilir-partnerler', where: 'Komut', visibility: 'public', kind: 'message', build: () => ({ components: [ui.trustedList(many(8))], ...noMentions }) },
    { id: 'liste-30', title: '/guvenilir-partnerler (30 kayıt)', where: 'Komut', visibility: 'public', kind: 'message', build: () => ({ components: [ui.trustedList(many(30))], ...noMentions }) },
    panelKart('panel-bos', 'Güvenilir partnerler paneli (boş)', []),
    panelKart('panel-3', 'Güvenilir partnerler paneli (3 kayıt)', many(3)),
    panelKart('panel-6', 'Güvenilir partnerler paneli (6 kayıt)', many(6)),
    panelKart('panel-40', 'Güvenilir partnerler paneli (40 kayıt, 2. sayfa)', many(40), 1),
    {
      id: 'panel-metin',
      title: 'Güvenilir partnerler paneli (kart çizilemedi, metinli yedek)',
      where: 'Güvenilir partnerler kanalı, çizim hatasında',
      visibility: 'panel',
      kind: 'message',
      build: () => ({ components: [ui.trustedListPanel(many(3))], ...noMentions }),
    },
    { id: 'detay', title: 'Güvenilir partner detayı', where: 'Güvenilir liste menüsünden seçilince', visibility: 'public', kind: 'message', build: () => ({ components: [ui.trustedDetail(entry())], ...noMentions }) },
    { id: 'form-yetkili', title: 'Form: partner yetkilisi', where: 'Yetkili Ekle butonu', visibility: 'ephemeral', kind: 'modal', build: () => ui.contactModal('1-3', [member.id, staff.id]) },
    { id: 'yetkili-sec', title: 'Teklifte bulunma: yetkili seçimi', where: 'Teklifte Bulun butonu', visibility: 'public', kind: 'message', build: () => ({ components: [ui.staffSelect('1-3', [staff, member], (id) => (id === member.id ? 'mesgul' : 'aktif'))], ...noMentions }) },
    { id: 'atama-dm', title: 'DM: yenileme teklifi (atanan yetkili)', where: 'Atanan yetkiliye', visibility: 'dm', kind: 'message', build: () => ({ components: [ui.assignedOfferDm(entry(), member.id)] }) },
    { id: 'yenileme-dm', title: 'DM: yenileme metni incelemesi', where: 'Atanan yetkiliye, kabul sonrası', visibility: 'dm', kind: 'message', build: () => ({ components: [ui.renewalReviewDm(entry())] }) },
    { id: 'yenileme-form', title: 'Form: partner metnini düzenle', where: 'Atanan yetkiliye', visibility: 'dm', kind: 'modal', build: () => ui.renewalEditModal(entry()) },
    { id: 'yenileme-form-kisa', title: 'Form: partner metnini düzenle (kısa kayıtlı metin)', where: 'Atanan yetkiliye', visibility: 'dm', kind: 'modal', build: () => ui.renewalEditModal(entry({ content: 'kısa metin' })) },
    { id: 'yenileme-iptal-form', title: 'Form: teklifi iptal et', where: 'Atanan yetkiliye', visibility: 'dm', kind: 'modal', build: () => ui.renewalCancelModal('1-3') },
    { id: 'yenileme-iptal-kayit', title: 'İnceleme kanalı: yenileme teklifi iptal edildi', where: 'İnceleme kanalı', visibility: 'log', kind: 'message', build: () => ({ components: [ui.renewalCancelledLog(entry(), staff.id, 'Sunucunun metni güncel değil.')], ...noMentions }) },
    { id: 'bizim-metin', title: 'DM: partner metinleri (paylaşılan mesaj)', where: 'Karşı sunucu yetkilisine', visibility: 'dm', kind: 'message', build: () => ({ components: [ui.ourTextDm(entry(), 'https://discord.com/channels/1/2/3', 'https://discord.com/channels/1/2/3')] }) },
    { id: 'bizim-metin-kanal', title: 'DM: partner metinleri (kanal bağlantısı)', where: 'Güvenilir listeye alınan yetkiliye', visibility: 'dm', kind: 'message', build: () => ({ components: [ui.ourTextDm(entry(), null, 'https://discord.com/channels/1/2')] }) },
    { id: 'partner-paneli', title: 'DM: partner paneli', where: 'Karşı sunucu yetkilisine', visibility: 'dm', kind: 'message', build: () => ({ components: [ui.partnerPanel(entry(), 'Örnek Sunucu')] }) },
    { id: 'partner-paneli-mesgul', title: 'DM: partner paneli (meşgul)', where: 'Karşı sunucu yetkilisine', visibility: 'dm', kind: 'message', build: () => ({ components: [ui.partnerPanel(entry({ contactStatus: 'mesgul', contactStatusAt: Date.now() }), 'Örnek Sunucu')] }) },
    { id: 'panel-teklif-form', title: 'Form: partnerlik teklifi', where: 'Partner panelinde teklif butonu', visibility: 'dm', kind: 'modal', build: () => ui.panelOfferModal('1-3') },
  ];
};
