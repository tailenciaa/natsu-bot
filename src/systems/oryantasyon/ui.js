// Oryantasyon sisteminin mesajları: görüşme kanalının sohbetine atılan adım adım oryantasyon paneli, aktarma ve iptal
// pencereleri, başvurana ve yetkiliye giden DM'ler
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  LabelBuilder,
  ModalBuilder,
  SectionBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  ThumbnailBuilder,
  UserSelectMenuBuilder,
} = require('discord.js');
const { colors, text, divider, pad, unix, quote, notice, messageUrl } = require('../../core/ui');
const basvuruConfig = require('../basvuru/config');
const yetkiConfig = require('../yetki/config');
const config = require('./config');

// Hepsi oryantasyon:<başvuru>:<işlem> şeklinde
// işlem: ileri | geri | atla | alan | seviye | ver | aktar | aktar-sec | iptal | iptal-form | devral
const IDS = { action: 'oryantasyon', cancelReason: 'oryantasyon-iptal-sebep' };

const actionId = (app, action) => `${IDS.action}:${app.id}:${action}`;
const fill = (content, app) =>
  content.replaceAll('{aday}', `<@${app.userId}>`).replaceAll('{yetkili}', `<@${app.orientation.staffId}>`);
const channelUrl = (guildId, channelId) => `https://discord.com/channels/${guildId}/${channelId}`;
const progress = (index, total) => '▰'.repeat(index + 1) + '▱'.repeat(total - index - 1);
const MINUTE = 60 * 1000;
const minutes = (from, to) => Math.max(1, Math.round((to - from) / MINUTE));

const levelOf = (app) => yetkiConfig.levels.find((l) => l.id === app.orientation.levelId) ?? yetkiConfig.levels[0];
const areasOf = (app) => config.areas.filter((a) => app.orientation.areas.includes(a.id));
const areaLabels = (app) => areasOf(app).map((a) => a.label).join(', ');
const skippedTitles = (app) =>
  config.steps
    .filter((s) => app.orientation.skipped.includes(s.id))
    .map((s) => s.title)
    .join(', ');

// Yetki verilirken verilecek roller: başvuru onay rolü, seviyenin ve seviyeye bağlı yetkilerin rolleri, seçilen alanların rolleri.
// missing: rolü ayarlanmamış seviye ve alanların adları
function plannedRoles(app) {
  const level = levelOf(app);
  const levelPerms = yetkiConfig.perms.filter((p) => level.perms.includes(p.id));
  const areas = areasOf(app);
  const roleIds = [app.acceptRoleId, level.roleId, ...levelPerms.map((p) => p.roleId), ...areas.map((a) => a.roleId)];
  return {
    roleIds: [...new Set(roleIds.filter(Boolean))],
    missing: [level, ...areas].filter((item) => !item.roleId).map((item) => item.label),
  };
}

// Kanal belliyse o kanala, değilse üç görüşme kanalına katılma butonları
function voiceButtons(guildId, channelId) {
  const buttons = channelId
    ? [new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Kanala Katıl').setURL(channelUrl(guildId, channelId))]
    : basvuruConfig.voiceChannels.map((c) =>
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(c.label).setURL(channelUrl(guildId, c.id)),
      );
  return new ActionRowBuilder().addComponents(buttons);
}

function withThumbnail(container, header, user) {
  if (!user) return container.addTextDisplayComponents(header);
  return container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(header)
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ size: 256 }))),
  );
}

// Hem panelde hem başvurular kanalındaki mesajda duran yönetim butonları
function manageButtons(app) {
  return [
    new ButtonBuilder().setCustomId(actionId(app, 'aktar')).setStyle(ButtonStyle.Secondary).setLabel('Başka Yetkiliye Aktar'),
    new ButtonBuilder().setCustomId(actionId(app, 'iptal')).setStyle(ButtonStyle.Danger).setLabel('Oryantasyonu İptal Et'),
  ];
}

// Başvurular kanalındaki mesajda oryantasyon sürerken çıkan satır: panele git, aktar, iptal
function noticeRow(app) {
  const row = new ActionRowBuilder();
  const o = app.orientation;
  if (o.status === 'active' && o.messageId) {
    row.addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Oryantasyona Git')
        .setURL(messageUrl(app.guildId, o.channelId, o.messageId)),
    );
  }
  return row.addComponents(manageButtons(app));
}

function stepBody(step, app) {
  const body = fill(step.body, app);
  const o = app.orientation;

  if (step.type === 'areas') return `${body}\n\n**Seçilen Alanlar:** ${areaLabels(app) || 'Henüz seçilmedi'}`;
  if (step.type === 'areaInfo') {
    const areas = areasOf(app);
    return `${body}\n\n${areas.length ? areas.map((a) => `**${a.label}**\n${a.info}`).join('\n\n') : 'Henüz alan seçilmedi.'}`;
  }
  if (step.type === 'final') return `${body}\n\n${summaryLines(app, Date.now()).join('\n')}`;
  return body;
}

// Son adımda ve tamamlanınca görünen oryantasyon özeti
function summaryLines(app, endedAt) {
  const o = app.orientation;
  const areas = areasOf(app);
  const topics = config.steps.filter((s) => !['areas', 'final'].includes(s.type));
  const told = topics.filter((s) => !o.skipped.includes(s.id)).length;
  return [
    `**${areas.length > 1 ? 'Görev Alanları' : 'Görev Alanı'}:** ${areaLabels(app) || 'Seçilmedi'}`,
    `**Anlatılan Konular:** ${told}/${topics.length}${o.skipped.length ? ` ・ Bildiği için geçilen: ${skippedTitles(app)}` : ''}`,
    `**Oryantasyon Süresi:** ${minutes(o.startedAt, endedAt)} dakika`,
  ];
}

function areaMenu(app) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(actionId(app, 'alan'))
      .setPlaceholder('Görev alanlarını seç')
      .setMinValues(1)
      .setMaxValues(config.areas.length)
      .addOptions(
        config.areas.map((a) =>
          new StringSelectMenuOptionBuilder()
            .setValue(a.id)
            .setLabel(a.label)
            .setDescription(a.description)
            .setDefault(app.orientation.areas.includes(a.id)),
        ),
      ),
  );
}

function levelMenu(app) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(actionId(app, 'seviye'))
      .setPlaceholder('Başlayacağı yetkiyi seç')
      .addOptions(
        yetkiConfig.levels.map((l) =>
          new StringSelectMenuOptionBuilder().setValue(l.id).setLabel(l.label).setDefault(l.id === levelOf(app).id),
        ),
      ),
  );
}

// Seviye menüsünün üstündeki başlık (ne yapılacağı adımın metninde yazıyor)
function levelText(app) {
  return `**Başlayacağı Yetki:** ${levelOf(app).label}`;
}

// Rolü henüz tanımlanmamış yetki ya da alan varsa oryantasyonu verene küçük bir not
function missingRolesText(app) {
  const { missing } = plannedRoles(app);
  if (!missing.length) return null;
  return `-# Not: ${missing.join(', ')} için henüz rol tanımlanmadı, yetki verilirken ${missing.length > 1 ? 'bu roller' : 'bu rol'} atlanacak.`;
}

// Görüşme kanalının sohbetindeki oryantasyon paneli. Adımları oryantasyonu veren yetkili ilerletir,
// alan seçimini başvuran da yapabilir. Tamamlanınca ya da iptal edilince özet haline gelir.
function panel(app, applicantUser) {
  const o = app.orientation;
  if (o.status === 'completed') return completedPanel(app, applicantUser);
  if (o.status === 'cancelled') return cancelledPanel(app);

  const { steps } = config;
  const step = steps[o.step];
  const header = text(
    `## Oryantasyon ・ Başvuru #${pad(app.number)}\n` +
      `**<@${o.staffId}>, <@${app.userId}> için oryantasyon veriyor.**\n` +
      // Adımın adı hemen alttaki başlıkta
      `-# Adım ${o.step + 1}/${steps.length}\n` +
      progress(o.step, steps.length),
  );

  const presence = presenceText(app);
  const container = withThumbnail(
    new ContainerBuilder().setAccentColor(presence ? colors.warning : colors.primary),
    header,
    applicantUser,
  );
  if (presence) container.addSeparatorComponents(divider()).addTextDisplayComponents(text(presence));
  container.addSeparatorComponents(divider()).addTextDisplayComponents(text(`### ${step.title}\n${stepBody(step, app)}`));

  if (step.type === 'areas') container.addActionRowComponents(areaMenu(app));
  if (step.type === 'final') {
    container.addSeparatorComponents(divider()).addTextDisplayComponents(text(levelText(app))).addActionRowComponents(levelMenu(app));
    const note = missingRolesText(app);
    if (note) container.addTextDisplayComponents(text(note));
  }

  const nav = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(actionId(app, 'geri'))
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Geri')
      .setDisabled(o.step === 0),
    step.type === 'final'
      ? new ButtonBuilder()
          .setCustomId(actionId(app, 'ver'))
          .setStyle(ButtonStyle.Success)
          .setLabel('Yetki Ver')
          .setDisabled(!o.areas.length)
      : new ButtonBuilder()
          .setCustomId(actionId(app, 'ileri'))
          .setStyle(ButtonStyle.Success)
          .setLabel(step.nextLabel ?? 'Anlatıldı, Devam')
          .setDisabled(step.type === 'areas' && !o.areas.length),
  );
  if (step.skippable) {
    nav.addComponents(new ButtonBuilder().setCustomId(actionId(app, 'atla')).setStyle(ButtonStyle.Secondary).setLabel('Biliyor, Atla'));
  }

  return container
    .addSeparatorComponents(divider())
    .addActionRowComponents(nav)
    .addSeparatorComponents(divider())
    .addActionRowComponents(new ActionRowBuilder().addComponents(manageButtons(app)))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        // Alan seçimini kimin yapacağı o adımın metninde yazıyor
        `-# Adımları <@${o.staffId}> ilerletir ・ Başlangıç <t:${unix(o.startedAt)}:R>`,
      ),
    );
}

function completedPanel(app, applicantUser) {
  const o = app.orientation;
  const header = text(
    '## Oryantasyon Tamamlandı\n' +
      `**<@${app.userId}> artık yetkili ekibinin bir parçası!**\n` +
      `-# Oryantasyonu <@${o.staffId}> verdi, #${pad(app.number)} numaralı başvuru sonuçlandı.`,
  );
  return withThumbnail(new ContainerBuilder().setAccentColor(colors.success), header, applicantUser)
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text([`**Başlangıç Yetkisi:** ${o.levelLabel}`, ...summaryLines(app, o.finishedAt)].join('\n')))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`-# <t:${unix(o.finishedAt)}:F>`));
}

// İptal edenin yazısı: yetkili iptal ettiyse o, başvuran ayrıldığı için bot iptal ettiyse otomatik
const cancelHeadline = (app) =>
  app.orientation.cancelledBy
    ? `<@${app.orientation.cancelledBy}>, <@${app.userId}> için verilen oryantasyonu iptal etti.`
    : `<@${app.userId}> için verilen oryantasyon otomatik olarak iptal edildi.`;
const penaltyText = (app) =>
  app.penaltyUntil ? `\n-# Başvuru cezası: <t:${unix(app.penaltyUntil)}:D> tarihine kadar yeniden başvuru yapamaz.` : '';

function cancelledPanel(app) {
  const o = app.orientation;
  return notice(
    [
      '## Oryantasyon İptal Edildi\n' + `**${cancelHeadline(app)}**\n` + '-# Görüşme kanalları başvurana tekrar kilitlendi.',
      `**Sebep:**\n${quote(o.cancelReason)}${penaltyText(app)}`,
      `-# <t:${unix(o.finishedAt)}:F>`,
    ],
    'danger',
  );
}

// Oryantasyon sürerken biri kanaldan ayrıldıysa panelde ve kayıtta görünen durum; herkes kanaldaysa null
function presenceText(app) {
  const o = app.orientation;
  const p = config.presence;
  const lines = [];
  if (o.applicantAwaySince) {
    lines.push(
      `**<@${app.userId}> kanaldan ayrıldı.** <t:${unix(o.applicantAwaySince + p.applicantGraceMinutes * MINUTE)}:R> dönmezse oryantasyon iptal edilecek.\n` +
        `-# Ayrılma: ${o.applicantLeaves}/${p.maxApplicantLeaves} ・ ${p.maxApplicantLeaves}. ayrılışta başvuru iptal edilir ve ${p.penaltyDays} gün başvuru cezası verilir.`,
    );
  }
  if (o.staffNeeded) {
    lines.push(
      `**Yetkili bekleniyor.** <@${o.staffId}> kanaldan ayrıldı ve geri dönmedi.\n` +
        '-# Başvurular kanalındaki mesajdan başka bir yetkili oryantasyonu devralabilir.',
    );
  } else if (o.staffAwaySince && o.staffJoining) {
    lines.push(`**<@${o.staffId}> oryantasyonu devraldı, kanala gelmesi bekleniyor.**`);
  } else if (o.staffAwaySince) {
    lines.push(
      `**<@${o.staffId}> kanaldan ayrıldı.** <t:${unix(o.staffAwaySince + p.staffGraceMinutes * MINUTE)}:R> dönmezse başka bir yetkili çağrılacak.`,
    );
  }
  return lines.length ? lines.join('\n\n') : null;
}

// Kayıt kanalındaki canlı oryantasyon mesajı: oryantasyon başlayınca gönderilir, adımlar ilerledikçe güncellenir,
// bitince orientationResult haline gelir
function orientationLog(app) {
  const o = app.orientation;
  const { steps } = config;

  const lines = [`**Adım:** ${o.step + 1}/${steps.length} ・ ${steps[o.step].title}\n${progress(o.step, steps.length)}`];
  if (o.areas.length) lines.push(`**${o.areas.length > 1 ? 'Görev Alanları' : 'Görev Alanı'}:** ${areaLabels(app)}`);
  if (o.skipped.length) lines.push(`**Bildiği için geçilen:** ${skippedTitles(app)}`);
  if (o.transfers.length) lines.push(`**Aktarımlar:** ${o.transfers.map((t) => `<@${t.from}> → <@${t.to}>`).join(', ')}`);
  if (o.applicantLeaves) lines.push(`**Başvuranın Ayrılması:** ${o.applicantLeaves}/${config.presence.maxApplicantLeaves}`);

  const presence = presenceText(app);
  const sections = [
    `### Oryantasyon Sürüyor ・ Başvuru #${pad(app.number)}\n` +
      `**<@${o.staffId}>, <@${app.userId}> için <#${o.channelId}> kanalında oryantasyon veriyor.**\n` +
      `-# Başlangıç <t:${unix(o.startedAt)}:t> ・ Adımlar ilerledikçe bu mesaj güncellenir.`,
  ];
  if (presence) sections.push(presence);
  sections.push(lines.join('\n'));

  const container = notice(sections, presence ? 'warning' : 'primary');
  if (o.messageId) {
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Panele Git').setURL(messageUrl(app.guildId, o.channelId, o.messageId)),
      ),
    );
  }
  return container;
}

// Oryantasyonun kayıt kanalındaki sonucu: canlı mesaj bu hale gelir (hiç başlamadıysa ayrı gönderilir)
function orientationResult(app) {
  const o = app.orientation;
  if (o.status === 'cancelled') {
    return notice(
      [
        `### Oryantasyon İptal Edildi ・ Başvuru #${pad(app.number)}\n` +
          `**${cancelHeadline(app)}**\n` +
          '-# Görüşme kanalları başvurana kilitlendi.',
        `**Sebep:**\n${quote(o.cancelReason)}${penaltyText(app)}`,
        `-# <t:${unix(o.finishedAt)}:F>`,
      ],
      'danger',
    );
  }
  return notice(
    [
      `### Oryantasyon Tamamlandı ・ Başvuru #${pad(app.number)}\n` +
        `**<@${app.userId}> oryantasyonu tamamladı ve yetkili ekibine katıldı!**\n` +
        `-# Oryantasyonu <@${o.staffId}> verdi, görüşme kanalları başvurana kilitlendi.`,
      [`**Başlangıç Yetkisi:** ${o.levelLabel}`, ...summaryLines(app, o.finishedAt)].join('\n'),
      `-# <t:${unix(o.finishedAt)}:F>`,
    ],
    'success',
  );
}

// Onaylanan başvurana giden DM: oryantasyon için hangi kanala geçeceği
function approvedDm(app, guildName, channelId) {
  const o = app.orientation;
  const sections = [
    '### Başvurun Onaylandı\n' +
      '**Tebrikler, son aşamaya geçtin: oryantasyon!**\n' +
      `-# #${pad(app.number)} numaralı başvurunu <@${app.reviewedBy}> onayladı. Oryantasyonunu <@${o.staffId}> verecek.`,
  ];
  if (app.note) sections.push(`**Not:**\n${quote(app.note)}`);
  sections.push(
    o.status === 'active'
      ? `**Oryantasyonun <#${o.channelId}> kanalında başladı!**\n-# Adımlar kanalın sohbetindeki panelden ilerliyor.`
      : (channelId
          ? `**Oryantasyon için <#${channelId}> kanalına geç.**\n`
          : '**Oryantasyon için aşağıdaki görüşme kanallarından boş olanına geç.**\n') +
          `-# <@${o.staffId}> ile aynı kanala girdiğinde oryantasyon kendiliğinden başlar, bot kanalın sohbetine adım adım ilerleyen bir panel atar. Kanallar senin için açıldı.`,
  );

  return notice(sections, 'success')
    .addActionRowComponents(voiceButtons(app.guildId, channelId))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`-# ${guildName} ・ <t:${unix(app.reviewedAt)}:F>`));
}

// Oryantasyonu verecek yetkiliye giden DM (onaylayınca, oryantasyon kendisine aktarılınca ya da devralınca).
// tookOver: yetkili ayrıldığı için başvurular kanalından devralındıysa (transferredBy ayrılan yetkili)
function staffDm(app, guildName, channelId, transferredBy, tookOver) {
  const o = app.orientation;
  const active = o.status === 'active';
  const target = active ? o.channelId : channelId;

  const voice = active
    ? `**Oryantasyon <#${o.channelId}> kanalında sürüyor, kanala geç.**\n` +
      `-# Paneldeki butonları artık sen kullanabilirsin, kalınan adımdan (${o.step + 1}/${config.steps.length}) devam edersin.`
    : (channelId ? `**<#${channelId}> kanalına geç.**\n` : '**Görüşme kanallarından boş olanına geç.**\n') +
      '-# Başvuranla aynı kanala girdiğinde oryantasyon kendiliğinden başlar, panel kanalın sohbetine gelir. ' +
      'Adımları sen ilerletirsin; başvuranın bildiği konuları **Biliyor, Atla** ile geçebilirsin.';

  return notice(
    [
      '### Oryantasyon Görevi\n' +
        `**<@${app.userId}> için oryantasyonu sen vereceksin.**\n` +
        (tookOver
          ? `-# <@${transferredBy}> kanaldan ayrıldığı için #${pad(app.number)} numaralı başvurunun oryantasyonunu devraldın.`
          : transferredBy
            ? `-# <@${transferredBy}>, #${pad(app.number)} numaralı başvurunun oryantasyonunu sana aktardı.`
            : `-# #${pad(app.number)} numaralı başvuruyu onayladın, başvurana da DM ile haber verildi.`),
      voice,
    ],
    'primary',
  )
    .addActionRowComponents(voiceButtons(app.guildId, target))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`-# ${guildName} ・ <t:${unix(Date.now())}:F>`));
}

// Oryantasyonu tamamlayan yeni yetkiliye giden tebrik DM'i
function completedDm(app, guildName) {
  const o = app.orientation;
  return notice(
    [
      '### Ekibe Hoş Geldin!\n' +
        `**Tebrikler, oryantasyonu başarıyla tamamladın ve artık ${guildName} yetkili ekibinin bir parçasısın!**\n` +
        `-# Oryantasyonunu <@${o.staffId}> verdi.`,
      [
        `**Başlangıç Yetkin:** ${o.levelLabel}`,
        `**${o.areaLabels.length > 1 ? 'Görev Alanların' : 'Görev Alanın'}:** ${o.areaLabels.join(', ')}`,
      ].join('\n'),
      '**Seni aramızda görmekten çok mutluyuz!**\n' +
        'Başvurudan oryantasyona kadar gösterdiğin ilgi için teşekkürler. İlk günlerde takıldığın her şeyi ' +
        `<@${o.staffId}> ya da diğer yetkililere sorabilirsin, kimse her şeyi ilk günden bilmez.\n` +
        '-# Unutma: yetkili olmak bir ayrıcalık değil, bir sorumluluk. Yeni görevinde başarılar!',
      `-# ${guildName} ・ <t:${unix(o.finishedAt)}:F>`,
    ],
    'success',
  );
}

// Oryantasyonu iptal edilen başvurana giden DM
function cancelledDm(app, guildName) {
  const o = app.orientation;
  return notice(
    [
      '### Oryantasyon İptal Edildi\n' +
        `**#${pad(app.number)} numaralı başvurunun oryantasyonu iptal edildi.**\n` +
        (o.cancelledBy ? `-# <@${o.cancelledBy}> oryantasyonu sonlandırdı.` : '-# Oryantasyon otomatik olarak sonlandırıldı.'),
      `**Sebep:**\n${quote(o.cancelReason)}` +
        (app.penaltyUntil ? `\n-# Bu yüzden <t:${unix(app.penaltyUntil)}:D> tarihine kadar yeniden başvuru yapamazsın.` : ''),
      `-# ${guildName} ・ <t:${unix(o.finishedAt)}:F>`,
    ],
    'danger',
  );
}

// Başvurular kanalına giden "yetkili bekleniyor" mesajı; durum değiştikçe güncellenir.
// state: open (devral butonu açık) | returned (yetkili döndü) | taken (biri devraldı) | closed (oryantasyon bitti)
function takeoverNotice(app, state) {
  const o = app.orientation;
  const title = `Başvuru #${pad(app.number)}`;
  if (state === 'open') {
    const step = config.steps[o.step];
    return notice(
      `### Oryantasyon İçin Yetkili Bekleniyor ・ ${title}\n` +
        `**${app.reviewerRoleId ? `<@&${app.reviewerRoleId}>, ` : ''}<@${app.userId}> oryantasyonun ortasında <#${o.channelId}> kanalında bekliyor.**\n` +
        `-# <@${o.staffId}> kanaldan ayrıldı ve ${config.presence.staffGraceMinutes} dakika içinde dönmedi. ` +
        `Oryantasyon ${o.step + 1}/${config.steps.length} ・ ${step.title} adımında kaldı; devralan yetkili buradan devam eder.`,
      'warning',
    ).addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(actionId(app, 'devral')).setStyle(ButtonStyle.Success).setLabel('Oryantasyonu Devral'),
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Kanala Katıl').setURL(channelUrl(app.guildId, o.channelId)),
      ),
    );
  }
  if (state === 'returned') {
    return notice(
      `### Yetkili Geri Döndü ・ ${title}\n**<@${o.staffId}> kanala geri döndü, oryantasyon devam ediyor.**\n-# Artık yetkili beklenmiyor.`,
      'success',
    );
  }
  if (state === 'taken') {
    const from = o.transfers.at(-1)?.from;
    return notice(
      `### Oryantasyon Devralındı ・ ${title}\n**<@${o.staffId}> oryantasyonu devraldı.**\n` +
        `-# ${from ? `<@${from}> ayrıldıktan sonra ` : ''}kalınan adımdan devam edilecek.`,
      'success',
    );
  }
  return notice(`### Oryantasyon Sona Erdi ・ ${title}\n-# Artık yetkili beklenmiyor.`);
}

// Panel başka kanala taşınınca eski kanaldaki panelin yerine kalan not
function panelMoved(app) {
  const o = app.orientation;
  return notice(
    `**Oryantasyon paneli <#${o.channelId}> kanalına taşındı.**\n-# Yetkili ve başvuran kanal değiştirdiği için panel de onlarla birlikte taşındı.`,
    'primary',
  ).addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Panele Git').setURL(messageUrl(app.guildId, o.channelId, o.messageId)),
    ),
  );
}

// Kanala giriş çıkışlarda başvurana (toApplicant) ya da yetkiliye giden bilgilendirme DM'i. Bu kişiye gitmeyecekse null.
// channelId: sadece staffWaiting için, yetkilinin girdiği kanal
function presenceDm(app, guildName, kind, toApplicant, channelId) {
  const o = app.orientation;
  const p = config.presence;
  const at = (since, grace) => `<t:${unix(since + grace * MINUTE)}:R>`;
  const leaves = `Ayrılma hakkı: ${o.applicantLeaves}/${p.maxApplicantLeaves}. ${p.maxApplicantLeaves}. ayrılışta oryantasyon iptal edilir ve ${p.penaltyDays} gün başvuru yapamazsın.`;

  const texts = {
    applicantLeft: toApplicant
      ? ['Oryantasyondan Ayrıldın', `**Oryantasyonun sürerken <#${o.channelId}> kanalından ayrıldın.**\n-# ${at(o.applicantAwaySince, p.applicantGraceMinutes)} dönmezsen oryantasyonun iptal edilecek. ${leaves}`, 'danger', o.channelId]
      : ['Başvuran Ayrıldı', `**<@${app.userId}> oryantasyon sırasında kanaldan ayrıldı.**\n-# ${at(o.applicantAwaySince, p.applicantGraceMinutes)} dönmezse oryantasyon otomatik iptal edilecek. Ayrılma: ${o.applicantLeaves}/${p.maxApplicantLeaves}`, 'warning'],
    applicantBack: toApplicant
      ? ['Oryantasyon Devam Ediyor', '**Kanala geri döndün, oryantasyonun kaldığı yerden devam ediyor.**', 'success']
      : ['Başvuran Geri Döndü', `**<@${app.userId}> kanala geri döndü, oryantasyona devam edebilirsin.**`, 'success'],
    staffLeft: toApplicant
      ? ['Yetkilin Ayrıldı', `**<@${o.staffId}> kanaldan ayrıldı, lütfen kanalda bekle.**\n-# ${at(o.staffAwaySince, p.staffGraceMinutes)} dönmezse başka bir yetkili oryantasyonunu devralacak.`, 'warning']
      : ['Oryantasyondan Ayrıldın', `**<@${app.userId}> ile oryantasyon sürerken <#${o.channelId}> kanalından ayrıldın.**\n-# ${at(o.staffAwaySince, p.staffGraceMinutes)} dönmezsen oryantasyon başka yetkililere açılacak.`, 'warning', o.channelId],
    staffBack: toApplicant
      ? ['Yetkilin Geri Döndü', `**<@${o.staffId}> kanala geri döndü, oryantasyonun devam ediyor.**`, 'success']
      : ['Oryantasyon Devam Ediyor', '**Kanala geri döndün, oryantasyona kaldığın yerden devam edebilirsin.**', 'success'],
    staffJoined: toApplicant ? ['Yetkilin Geldi', `**<@${o.staffId}> kanala geldi, oryantasyonun devam ediyor.**`, 'success'] : null,
    staffNeeded: toApplicant
      ? ['Başka Yetkili Çağrıldı', `**<@${o.staffId}> geri dönmedi, oryantasyonun için başka bir yetkili çağrıldı.**\n-# Kanalda beklemeye devam et, bir yetkili devraldığında haber vereceğiz.`, 'warning']
      : null,
    takenOver: toApplicant
      ? ['Oryantasyonun Devralındı', `**<@${o.staffId}> oryantasyonunu devraldı.**\n-# Birazdan kanala gelecek, kaldığın adımdan devam edeceksiniz.`, 'primary']
      : null,
    staffWaiting: toApplicant
      ? ['Yetkilin Seni Bekliyor', `**<@${o.staffId}> oryantasyon için <#${channelId}> kanalına girdi, seni bekliyor!**\n-# Kanala girdiğinde oryantasyon kendiliğinden başlayacak.`, 'primary', channelId]
      : null,
    autoCancelled: toApplicant
      ? null
      : ['Oryantasyon İptal Edildi', `**<@${app.userId}> için verdiğin oryantasyon otomatik olarak iptal edildi.**\n-# ${o.cancelReason}`, 'danger'],
  };

  const entry = texts[kind];
  if (!entry) return null;
  const [title, body, color, buttonChannelId] = entry;
  const container = notice(`### ${title}\n${body}`, color);
  if (buttonChannelId) {
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel(kind === 'staffWaiting' ? 'Kanala Katıl' : 'Kanala Dön')
          .setURL(channelUrl(app.guildId, buttonChannelId)),
      ),
    );
  }
  return container.addSeparatorComponents(divider()).addTextDisplayComponents(text(`-# ${guildName} ・ Başvuru #${pad(app.number)}`));
}

// "Başka Yetkiliye Aktar" ile açılan, sadece butona basanın gördüğü seçim menüsü
function transferPicker(app) {
  return new ContainerBuilder()
    .setAccentColor(colors.primary)
    .addTextDisplayComponents(
      text(
        '**Oryantasyonu kime aktarmak istiyorsun?**\n' +
          `-# Sadece ${app.reviewerRoleId ? `<@&${app.reviewerRoleId}> rolündekiler` : 'yöneticiler'} seçilebilir. ` +
          'Yeni yetkiliye DM ile haber verilir, oryantasyon kalınan adımdan devam eder.',
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new UserSelectMenuBuilder().setCustomId(actionId(app, 'aktar-sec')).setPlaceholder('Yetkili seç').setMinValues(1).setMaxValues(1),
      ),
    );
}

// Oryantasyon sürerken aktarılınca görüşme kanalının sohbetine giden bildirim, yeni yetkili etiketlenir
function transferNotice(app, fromId) {
  const o = app.orientation;
  return notice(
    `**<@${o.staffId}>, oryantasyon sana aktarıldı.**\n` +
      `-# <@${fromId}> aktardı. Paneldeki butonları artık sen kullanabilirsin, kalınan adımdan (${o.step + 1}/${config.steps.length}) devam edebilirsin.`,
    'primary',
  );
}

// "Oryantasyonu İptal Et" ile açılan form, sebep başvurana iletilir
function cancelModal(app) {
  return new ModalBuilder()
    .setCustomId(actionId(app, 'iptal-form'))
    .setTitle('Oryantasyonu İptal Et')
    .addTextDisplayComponents(
      text(
        `**#${pad(app.number)} numaralı başvurunun oryantasyonunu iptal ediyorsun.**\n` +
          'Başvurana sebep DM ile iletilecek ve görüşme kanalları ona tekrar kilitlenecek.',
      ),
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('İptal sebebi')
        .setDescription('Başvurana iletilir.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(IDS.cancelReason)
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Örn: Oryantasyona gelmedi, tekrar başvurabilir.')
            .setMinLength(5)
            .setMaxLength(500)
            .setRequired(true),
        ),
    );
}

module.exports = {
  IDS,
  plannedRoles,
  levelOf,
  areasOf,
  noticeRow,
  panel,
  orientationLog,
  orientationResult,
  approvedDm,
  staffDm,
  completedDm,
  cancelledDm,
  takeoverNotice,
  panelMoved,
  presenceDm,
  transferPicker,
  transferNotice,
  cancelModal,
};
