// Kalıcı oda sisteminin mesajları: kurallar ve gereksinimler paneli, başvurunun üye seçimi adımı ve formu,
// yöneticinin karar verdiği başvuru kartı, sahibine giden teslim kartı, /kalici-oda komutuyla açılan oda kontrol
// paneli (yöneticide oda yönetimi düğmesi de bu panelde durur), şart uyarı kartları, yönetici oda sayfası ve duyuru
// kanalına düşen açılış/kapanış kayıtları.
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  LabelBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
} = require('discord.js');
const { colors, pad, unix, panel, page, rows, chip, pills, quote, receipt, stamp, divider, text, shorten } = require('../../core/ui');
const config = require('./config');

const IDS = {
  apply: 'kalici-oda-basvuru', // paneldeki başvuru butonu
  pickMembers: 'kalici-oda-basvuru-uyeler', // kalici-oda-basvuru-uyeler:0 (başvurunun üye seçme menüsü)
  openForm: 'kalici-oda-basvuru-devam', // üye seçiminin sonra açılan başvuru formu
  form: 'kalici-oda-form', // başvuru formu
  question: 'kalici-oda-soru', // kalici-oda-soru:<soru>
  decide: 'kalici-oda-karar', // kalici-oda-karar:<başvuru>:<onayla|ret>
  rejectForm: 'kalici-oda-ret', // kalici-oda-ret:<başvuru>
  rejectInput: 'kalici-oda-ret-sebep',
  rename: 'kalici-oda-isim',
  renameForm: 'kalici-oda-isim-form',
  renameInput: 'kalici-oda-isim-yeni',
  limit: 'kalici-oda-limit',
  limitForm: 'kalici-oda-limit-form',
  limitInput: 'kalici-oda-limit-sayi',
  add: 'kalici-oda-uye-ekle', // kalici-oda-uye-ekle:0 (menünün önekli yönlenmesi için sabit ek)
  remove: 'kalici-oda-uye-cikar', // kalici-oda-uye-cikar:0
  transfer: 'kalici-oda-devret', // kalici-oda-devret:0
  manage: 'kalici-oda-yonet', // oda panelindeki yönetici düğmesi: oda yönetim sayfasını açar
  pickRoom: 'kalici-oda-yonet-oda', // kalici-oda-yonet-oda:0 (yönetilecek odayı seçme menüsü)
  adminTransfer: 'kalici-oda-yonet-devret', // kalici-oda-yonet-devret:<oda no> (yöneticinin sahiplik devri menüsü)
  close: 'kalici-oda-yonet-kapat', // kalici-oda-yonet-kapat:<oda no>
  closeForm: 'kalici-oda-yonet-kapat-form', // kalici-oda-yonet-kapat-form:<oda no>
  closeInput: 'kalici-oda-yonet-sebep',
  back: 'kalici-oda-yonet-liste', // oda kartından oda seçme sayfasına dönüş
};

// Üye seçim menüsü: Discord kendi üye arama listesini gösterir, odadakileri tek tek saymaya gerek kalmaz
const select = (customId, placeholder) => new UserSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder);

// Başvurudaki üye menüsü: tek seferde odadakilerin tamamı seçilir, bu yüzden çoklu seçim ve sınırlar config'ten
const memberSelect = () =>
  select(`${IDS.pickMembers}:0`, 'Odayı kullanacak üyeleri seç')
    .setMinValues(1)
    .setMaxValues(config.maxExtraMembers);

// Odadakiler menüye isimleriyle yazılır: çıkarılacak ya da devredilecek üyeyi aramak yerine menüde görmek yeterli
const memberMenu = (customId, placeholder, roster) =>
  new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .addOptions(roster.map(({ id, name }) => ({ label: shorten(name || 'Üye', 100), value: id })));

const mentions = (ids) => ids.map((id) => `<@${id}>`).join(' ');
const hoursLabel = (seconds) => `${Math.round((seconds ?? 0) / 3600)} saat`;
// Üye sayısı ve limit tek satırda: "4 / 20" yan yana durunca limitin dolu mu boş mu olduğu hemen anlaşılır
const usageLabel = (count, limit) => chip(limit ? `${count} / ${limit}` : `${count} / sınırsız`);
const roomTag = (room) => chip(`#${pad(room.no)} · ${room.name}`);

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
// Hafta ('2026-10-05') ve ay ('2026-09') anahtarlarını okunur tarihe çevirir
function monthLabel(key) {
  const [year, month] = String(key).split('-');
  return `${MONTHS[Number(month) - 1] ?? month} ${year}`;
}

// Başvuru paneli: kurallar ve gereksinimler alt alta düzenli satırlar, başvuru butonu başlığın yanında durur
function applyPanel() {
  const container = panel({
    title: 'Kalıcı Oda Sistemi',
    sub: 'Sunucuda sana ait kalıcı bir ses odası olsun istiyorsan **Başvuru Yap** ile odanı kullanacakları seç, sonra formu doldur. Onay yetkisi sadece yöneticilerde.',
    button: { id: IDS.apply, label: 'Başvuru Yap' },
    image: config.banner,
  });

  return container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`### Kurallar\n${config.rules.map((rule, i) => `${i + 1}. ${rule}`).join('\n')}`))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        [
          '### Gereksinimler',
          rows([
            ['Üye Sayısı', chip(`${config.minMembers} kişi ve üzeri`)],
            ['Başvuruda Ses Şartı', chip(`${config.minWeeklyVoiceHours} saat / hafta`)],
            ['Odayı Koruma Şartı', chip(`${config.activity.weeklyHours} saat / hafta · ${config.activity.monthlyHours} saat / ay`)],
            ['Onayı Veren', 'Yalnızca yöneticiler'],
          ]),
          'Ses şartı, odayı kullanacakların birlikte geçirdiği toplam süredir; başvuruda hesaplanır, oda açık kaldıkça her hafta yeniden ölçülür.',
        ].join('\n'),
      ),
    );
}

// Başvurunun ilk adımı: üyeler ID yazılarak değil menüyle seçilir. Modallerde menü olmadığı için seçim formdan önce
// yapılır; menüde bırakılan liste ne ise başvuruya o yazılır.
function memberPicker() {
  const container = page({
    title: 'Başvuru · Üye Seçimi',
    sub: `Odayı birlikte kullanacak üyeleri menüden seç. Seninle birlikte en az ${config.minMembers} kişi, en fazla ${
      config.maxExtraMembers + 1
    } kişi gerekir; kendini seçmene gerek yok, başvuran otomatik odada.`,
    blocks: [
      `### Nasıl İlerlenir\n${[
        '1. Menüyü aç ve odada olacak herkesi **tek seferde** seç (yeni seçim öncekinin yerini alır).',
        '2. **Formu Aç** düğmesine bas; oda adı ve amacı sorulur.',
        '3. Başvurun inceleme kanalına düşer, kararı yöneticiler verir ve sonucu sana DM ile gelir.',
      ].join('\n')}`,
      rows([
        ['Asgari Üye', chip(`${config.minMembers} kişi`)],
        ['Azami Üye', chip(`${config.maxExtraMembers + 1} kişi`)],
      ]),
    ],
  });

  return container
    .addActionRowComponents(new ActionRowBuilder().addComponents(memberSelect()))
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(IDS.openForm).setLabel('Formu Aç').setStyle(ButtonStyle.Primary)),
    );
}

// Başvuru formu: oda adı ve odanın amacı (üyeler bir önceki adımda menüden seçildi)
function applicationModal() {
  const modal = new ModalBuilder().setCustomId(IDS.form).setTitle('Kalıcı Oda Başvurusu');
  for (const question of config.questions) {
    const input = new TextInputBuilder()
      .setCustomId(`${IDS.question}:${question.id}`)
      .setStyle(question.paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setPlaceholder(question.placeholder)
      .setMaxLength(question.max)
      .setRequired(true);
    if (question.min) input.setMinLength(question.min);
    modal.addLabelComponents(
      new LabelBuilder().setLabel(question.label).setDescription(question.description).setTextInputComponent(input),
    );
  }
  return modal;
}

const ACCENT = { pending: colors.warning, approved: colors.success, rejected: colors.danger };

// Karar satırı: bekleyen başvuruda Onayla / Reddet, sonuçlanmış başvuruda geçmiş zamanlı pasif etiket
function decisionRow(app) {
  if (app.status === 'pending') {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`${IDS.decide}:${app.id}:onayla`).setLabel('Onayla').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`${IDS.decide}:${app.id}:ret`).setLabel('Reddet').setStyle(ButtonStyle.Danger),
    );
  }
  const approved = app.status === 'approved';
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${IDS.decide}:${app.id}:sonuc`)
      .setLabel(approved ? 'Onaylandı' : 'Reddedildi')
      .setStyle(approved ? ButtonStyle.Success : ButtonStyle.Danger)
      .setDisabled(true),
  );
}

// Yöneticinin gördüğü başvuru kartı. room verilirse (başvuru onaylanmış) açılan kanal da yazılır.
function applicationCard(app, room) {
  const container = page({
    title: 'Kalıcı Oda Başvurusu',
    sub: 'Onay odayı açıp sahibine teslim eder; ret gerekçesi başvurana doğrudan mesaj olarak gider. Butonlar **yalnızca yöneticilerde** çalışır.',
    accent: ACCENT[app.status],
    blocks: [
      `### Başvuru\n${rows([
        ['Oda Adı', chip(app.roomName)],
        ['Başvuran', `<@${app.userId}>`],
        ['Kişi Sayısı', chip(`${app.members.length + 1} kişi`)],
        ['Son 7 Günün Sesi', chip(hoursLabel(app.voiceSeconds))],
        ['Haftalık Hedef', `${chip(`${config.minWeeklyVoiceHours} saat`)} · ${app.voiceOk ? 'karşılandı' : 'karşılanmadı'}`],
      ])}`,
      app.members.length ? `### Odayı Kullanacaklar\n${mentions(app.members)}` : null,
      `### Amaç\n${quote(app.purpose)}`,
      app.status === 'rejected' && app.note ? `### Ret Sebebi\n${quote(app.note)}` : null,
      room ? `### Açılan Kanal\n<#${room.voiceChannelId}>` : null,
      stamp(app.createdAt),
    ],
  });
  return container.addActionRowComponents(decisionRow(app));
}

// Reddet formu: sebep başvurana aynen yazılır
function rejectModal(app) {
  return new ModalBuilder()
    .setCustomId(`${IDS.rejectForm}:${app.id}`)
    .setTitle('Başvuruyu Reddet')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Ret sebebi')
        .setDescription('Başvurana aynen iletilir, gerekçeli ve tek cümle yaz.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(IDS.rejectInput)
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Örn: Odayı birlikte kullanacak kadar aktif üye görünmedi.')
            .setMaxLength(300)
            .setRequired(true),
        ),
    );
}

// Sahibine giden teslim kartı
function readyCard(room) {
  return page({
    title: 'Yeni Kalıcı Oda Açıldı!',
    sub: 'Odan oluşturuldu ve sana teslim edildi. İsim, kişi limiti, üye ve devir işlemleri artık **/kalici-oda** komutunda; sohbet ise odanın ses kanalının içinde.',
    accent: colors.success,
    blocks: [
      `### Oda\n${rows([
        ['Oda', roomTag(room)],
        ['Sahibi', `<@${room.ownerId}>`],
        ['Kanal', `<#${room.voiceChannelId}>`],
        ['Üye / Limit', usageLabel(room.members.length + 1, room.limit)],
      ])}`,
      room.members.length ? `### Üyeler\n${mentions(room.members)}` : null,
      activityBlock(null),
      stamp(room.createdAt),
    ],
  });
}

// Reddedilen başvurunun sahibine giden kartı
function rejectedCard(app) {
  return page({
    title: 'Başvurun Reddedildi',
    sub: 'Kalıcı oda başvurun incelendi ve reddedildi; kararın gerekçesi kartta yazıyor. Gereksinimleri sağladığında panelden tekrar başvurabilirsin.',
    accent: colors.danger,
    blocks: [
      `### Başvuru\n${rows([
        ['Oda Adı', chip(app.roomName)],
        ['Karar Veren', app.reviewedBy ? `<@${app.reviewedBy}>` : 'Yöneticiler'],
      ])}`,
      app.note ? `### Sebep\n${quote(app.note)}` : null,
      stamp(app.reviewedAt ?? Date.now()),
    ],
  });
}

// Odanın şart bloğu: hedefler her zaman yazılır, ölçülen sayılar status verildiğinde eklenir.
// status: { weekSeconds, lastWeekSeconds, missedWeeks, monthSeconds, reviewAt }
function activityBlock(status) {
  const a = config.activity;
  if (!a.enabled) return null;

  const targets = pills([
    ['Haftalık Hedef', `${a.weeklyHours} saat`],
    ['Aylık Hedef', `${a.monthlyHours} saat`],
    status ? ['Bu Ay Kaçan Hafta', `${status.missedWeeks}`] : null,
  ]);
  const measured = status
    ? pills([
        ['Son 7 Gün', hoursLabel(status.weekSeconds)],
        ['Geçen Hafta', status.lastWeekSeconds === null ? 'kayıt yok' : hoursLabel(status.lastWeekSeconds)],
        ['Ay Toplamı', `${hoursLabel(status.monthSeconds)} / ${a.monthlyHours} saat`],
      ])
    : null;

  return [
    '### Odayı Açık Tutan Şart',
    targets,
    measured,
    status
      ? `-# Ay sonu kontrolü <t:${unix(status.reviewAt)}:D>; hedefler tutmazsa oda şart yetersizliğinden silinir.`
      : 'Bu hedefler ay sonunda kontrol edilir; karşılamayan oda **silinir**.',
  ]
    .filter(Boolean)
    .join('\n');
}

// /kalici-oda ile açılan, sadece sahibinin kullanabildiği kontrol paneli.
// roster: odadaki üyelerin [{ id, name }] listesi; çıkar ve devret menüleri bu listeyle dolar.
// canManage: paneli açan üye oda yönetimine de yetkiliyse oda listesinin kapısı bu panele eklenir.
function roomPanel(room, status, roster = [], canManage = false) {
  const container = page({
    title: `Kalıcı Oda · ${room.name}`,
    sub: 'Odanın ismini ve kişi limitini buradan değiştirir, üye ekleyip çıkarır, sahipliği devredersin. Sohbet, ses kanalının kendi yazısıdır; bu paneli **yalnızca oda sahibi** kullanabilir.',
    blocks: [
      `### Oda\n${rows([
        ['Oda', roomTag(room)],
        ['Sahip', `<@${room.ownerId}>`],
        ['Kanal', `<#${room.voiceChannelId}>`],
        ['Üye / Limit', usageLabel(room.members.length + 1, room.limit)],
      ])}`,
      activityBlock(status),
      'Oda boş kalsa bile kapanmaz; odayı **yalnızca ay sonu şartı** ya da bir yönetici kapatabilir.',
    ],
  });

  // Üye menüleri önde, oda ayar düğmeleri sonda; zaman damgası kartın en altında durur
  memberMenus(container, roster);
  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text('### Oda Ayarı\nİsmini ve kişi limitini buradan değiştirirsin.'))
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(IDS.rename).setLabel('İsmi Değiştir').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(IDS.limit).setLabel('Limiti Ayarla').setStyle(ButtonStyle.Secondary),
      ),
    );

  // Oda yönetimi başvuru panelinde değil: düğme sadece yetkili üyenin kendi oda panelinde belirir,
  // böylece kalıcı bilgi panelinde herkese görünür bir yönetici kontrolü kalmaz.
  if (canManage) {
    container
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(text('### Yönetici Tarafı\nTüm odaları burada listeler, kapatır ya da sahibini değiştirirsin.'))
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(IDS.manage).setLabel('Odaları Yönet').setStyle(ButtonStyle.Secondary)),
      );
  }

  return container.addSeparatorComponents(divider()).addTextDisplayComponents(text(stamp(room.createdAt)));
}

// Üye işlemleri: her menünün üstünde ne yaptığı yazar, çıkar ve devret menüleri odadaki üyelerle dolar.
// Odada başkası yokken bu iki menü boş liste göstermesin diye tek satır not bırakılır.
function memberMenus(container, roster) {
  const label = (value) => container.addTextDisplayComponents(text(value));
  const menu = (builder) => container.addActionRowComponents(new ActionRowBuilder().addComponents(builder));
  // Menünün hemen altına gelen başlık çizgisiz kalmasın: menü satırlarının altına çizgi elle eklenir
  const ara = () => container.addSeparatorComponents(divider());

  container.addSeparatorComponents(divider());
  label('### Üye Ekle\nSunucudan seçtiğin üye odana katılır.');
  menu(select(`${IDS.add}:0`, 'Odaya eklenecek üyeyi seç'));

  if (!roster.length) {
    ara();
    return label('**Üye Çıkar** ve **Sahipliği Devret** odada senin dışında üye olunca açılır; önce üye ekle.');
  }

  ara();
  label('### Üye Çıkar\nOdandaki üyeler listelenir.');
  menu(memberMenu(`${IDS.remove}:0`, 'Odadan çıkarılacak üyeyi seç', roster));
  ara();
  label('### Sahipliği Devret\nOda seçtiğin üyeye geçer, sen odada kalırsın.');
  menu(memberMenu(`${IDS.transfer}:0`, 'Sahipliği devredeceğin üyeyi seç', roster));
  return container;
}

// Haftalık şart kaçınca sahibine giden uyarı: bir başarısızlık bildirimi olduğu için kanala değil kişiye düşer
function weekMissedCard(room, week, seconds) {
  return page({
    title: 'Kalıcı Oda Şartı Kaçtı',
    sub: `**${room.name}** geçen haftanın ses şartını karşılamadı. Ay sonunda şartı karşılamayan oda silinir, o yüzden haftayı boş geçirme.`,
    accent: colors.warning,
    blocks: [
      rows([
        ['Oda', roomTag(room)],
        ['Hafta', chip(monthLabel(week))],
        ['Odadakilerin Sesi', chip(hoursLabel(seconds))],
        ['Haftalık Hedef', chip(`${config.activity.weeklyHours} saat`)],
      ]),
      'Odanı korumak için tek gereken: odada konuşmak. Bir hafta daha kaçarsa oda risk altına girer.',
      stamp(),
    ],
  });
}

// Ay sonu şart denetiminde odası silinen sahibine giden kart
function inactivityCard(room, stat) {
  return page({
    title: 'Kalıcı Oda Kapatıldı',
    sub: `${room.name} odası ay sonu şartını karşılamadığı için kapatıldı ve kanalları silindi.`,
    accent: colors.danger,
    blocks: [
      rows([
        ['Oda', roomTag(room)],
        ['İncelenen Ay', chip(monthLabel(stat.month))],
        ['Kaçan Hafta', stat.missed ? chip(`${stat.missed} / ${stat.weeks} hafta`) : chip('yok')],
        ['Ay Toplamı', chip(`${hoursLabel(stat.total)} / ${hoursLabel(stat.required)}`)],
      ]),
      'Gereksinimleri sağladığında başvuru panelinden tekrar oda isteyebilirsin.',
      stamp(),
    ],
  });
}

// Kişi limiti formu (0 = sınırsız)
function limitModal(current) {
  return new ModalBuilder()
    .setCustomId(IDS.limitForm)
    .setTitle('Oda Kişi Limiti')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Kişi limiti')
        .setDescription('0 = sınırsız, en fazla 99 kişi.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(IDS.limitInput)
            .setStyle(TextInputStyle.Short)
            .setValue(String(current ?? 0))
            .setPlaceholder('Örn: 10')
            .setMaxLength(2)
            .setRequired(true),
        ),
    );
}

// Oda ismi formu: odanın ses kanalının adı değişir (sohbet de aynı kanalın içinde olduğu için isimle birlikte gelir)
function renameModal(current) {
  const input = new TextInputBuilder().setCustomId(IDS.renameInput).setStyle(TextInputStyle.Short).setMaxLength(30).setRequired(true);
  if (current) input.setValue(current);
  return new ModalBuilder()
    .setCustomId(IDS.renameForm)
    .setTitle('Oda İsmini Değiştir')
    .addLabelComponents(new LabelBuilder().setLabel('Yeni isim').setDescription('Odanın ses kanalının adı değişir.').setTextInputComponent(input));
}

// Yönetici oda sayfası: oda panelindeki **Odaları Yönet** düğmesinden ya da odası olmayan yöneticinin
// /kalici-oda komutundan açılır. Odalar tek tek numara yazılarak değil menüden seçilir.
// owners: userId -> görünen ad (menü seçeneklerinde etiket çizilmez, o yüzden sahip adı metin olarak verilir)
const ROOM_MENU_LIMIT = 25; // Discord bir seçim menüsünde en fazla 25 seçenek taşır
function roomAdmin(rooms, owners = new Map(), pendingCount = 0) {
  const line = (room) =>
    [
      `**#${pad(room.no)} · ${room.name}**`,
      `${pills([['Üye / Limit', `${room.members.length + 1} / ${room.limit || 'sınırsız'}`]])} · Sahip <@${room.ownerId}>`,
      `<#${room.voiceChannelId}>`,
    ].join('\n');

  const container = page({
    title: 'Kalıcı Odalar',
    sub: 'Bir oda seç; sahiplik devri ve kapatma o odanın kartından yapılır, oda numarası yazman gerekmez. Bekleyen başvurular inceleme kanalındaki kartlarda kararını bekler.',
    accent: colors.warning,
    blocks: [
      rooms.length ? rooms.map(line).join('\n\n') : '**Henüz kalıcı oda yok.**\nOnaylanan her başvuru burada listelenir.',
      pendingCount ? `### Bekleyen Başvuru\n${chip(`${pendingCount} adet`)}` : null,
    ],
  });
  if (!rooms.length) return container.addSeparatorComponents(divider()).addTextDisplayComponents(text(stamp()));

  return container
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${IDS.pickRoom}:0`)
          .setPlaceholder('Yönetilecek odayı seç')
          .addOptions(
            rooms.slice(0, ROOM_MENU_LIMIT).map((room) => ({
              label: shorten(`#${pad(room.no)} · ${room.name}`, 100),
              description: shorten(`${owners.get(room.ownerId) ?? 'Üye'} · ${room.members.length + 1} üye`, 100),
              value: String(room.no),
            })),
          ),
      ),
    )
    .addTextDisplayComponents(text(rooms.length > ROOM_MENU_LIMIT ? `-# İlk ${ROOM_MENU_LIMIT} oda listelenir.` : stamp()));
}

// Tek odanın yönetici kartı: sahiplik devri üye menüsüyle, kapatma formuyla birlikte tek yerde durur.
// note: işlemden sonra kartın en üstüne yazılan tek cümlelik sonuç ("Oda devredildi" gibi)
function roomAdminCard(room, status, note) {
  const container = page({
    title: `Kalıcı Oda · ${room.name}`,
    sub: 'Odayı buradan kapatır ya da sahipliğini bir üyeye devredersin. İsim, kişi limiti ve üye işlemleri sahibinin kendi panelinde; bu kartı **yalnızca yöneticiler** açabilir.',
    accent: colors.warning,
    blocks: [
      note ? `### Son İşlem\n${note}` : null,
      `### Oda\n${rows([
        ['Oda', roomTag(room)],
        ['Sahip', `<@${room.ownerId}>`],
        ['Kanal', `<#${room.voiceChannelId}>`],
        ['Üye / Limit', usageLabel(room.members.length + 1, room.limit)],
      ])}`,
      activityBlock(status),
      'Kapatma kanalları siler, sahip rolünü alır ve sahibine haberi gönderir; ay sonu şartı karşılanmazsa oda zaten kendi kendine kapanır.',
    ],
  });

  return container
    .addTextDisplayComponents(text('### Sahipliği Devret\nOda seçtiğin üyeye geçer; eski sahip sunucuda ise odada sıradan üye olarak kalır.'))
    .addActionRowComponents(new ActionRowBuilder().addComponents(select(`${IDS.adminTransfer}:${room.no}`, 'Sahipliği devredeceğin üyeyi seç')))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text('### Odayı Kapat'))
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(IDS.back).setLabel('Oda Listesi').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`${IDS.close}:${room.no}`).setLabel('Odayı Kapat').setStyle(ButtonStyle.Danger),
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(stamp(room.createdAt)));
}

// Kapatma formu: sebep sahibine aynen yazılır, boş bırakılırsa genel haber gider
function closeModal(room) {
  return new ModalBuilder()
    .setCustomId(`${IDS.closeForm}:${room.no}`)
    .setTitle(`Kalıcı Odayı Kapat · #${pad(room.no)}`)
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Kapatma sebebi')
        .setDescription('Oda sahibine aynen iletilir; boş bırakırsan "bir yönetici tarafından kapatıldı" yazılır.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(IDS.closeInput)
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Örn: Odayı kullanan üye kalmadı.')
            .setMaxLength(300)
            .setRequired(false),
        ),
    );
}

// Başvuru sahibinin kendi aldığını gördüğü özet: sonucu sadece başvuran görür, yöneticiler zaten kanaldaki kartı izliyor
function submitted({ user, app, memberCount }) {
  return receipt({
    title: 'Başvuru Alındı',
    sub: `<@${user.id}> kalıcı oda başvurusu gönderdi; başvuru inceleme sırasına girdi. Karar başvuran üyeye **DM** üzerinden bildirilecek.`,
    user,
    pairs: [
      ['Başvuru', chip(`#${app.number}`)],
      ['Oda Adı', `**${app.roomName}**`],
      ['Üye', chip(`${memberCount} kişi`)],
    ],
    note: 'Aynı anda tek bir başvuru bekleyebilir.',
  });
}

// ── Duyuru kanalı kartları ────────────────────────────────────────────────────
// config.channels.notifications'a düşen herkese açık kayıtlar: odanın açıldığını ve kapandığını sunucu görür.

function openedNotice(room) {
  return receipt({
    title: 'Kalıcı Oda Açıldı',
    sub: `<@${room.ownerId}> için **${room.name}** odası açıldı; sohbeti ses kanalının içinde.`,
    accent: 'success',
    pairs: [
      ['Oda', chip(`#${pad(room.no)} · ${room.name}`)],
      ['Kanal', `<#${room.voiceChannelId}>`],
      ['Üye / Limit', usageLabel(room.members.length + 1, room.limit)],
    ],
    at: room.createdAt,
  });
}

function closedNotice(room, reason) {
  return receipt({
    title: 'Kalıcı Oda Kapatıldı',
    sub: `**${room.name}** odası kapatıldı, kanalları silindi.`,
    accent: 'danger',
    pairs: [
      ['Oda', chip(`#${pad(room.no)} · ${room.name}`)],
      ['Sahip', `<@${room.ownerId}>`],
      reason ? ['Sebep', reason] : null,
    ].filter(Boolean),
  });
}

module.exports = {
  IDS,
  monthLabel,
  hoursLabel,
  applyPanel,
  memberPicker,
  applicationModal,
  applicationCard,
  submitted,
  rejectModal,
  readyCard,
  rejectedCard,
  roomPanel,
  weekMissedCard,
  inactivityCard,
  limitModal,
  renameModal,
  roomAdmin,
  roomAdminCard,
  closeModal,
  openedNotice,
  closedNotice,
};
