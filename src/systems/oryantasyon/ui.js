// Oryantasyon sisteminin mesajları: görüşme kanalının sohbetine atılan adım adım oryantasyon paneli, aktarma ve iptal
// pencereleri, başvurana ve yetkiliye giden DM'ler
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  LabelBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
} = require('discord.js');
const { colors, text, divider, pad, unix, quote, messageUrl, page, rows, chip } = require('../../core/ui');
const basvuruConfig = require('../basvuru/config');
const yetkiConfig = require('../yetki/config');
const yetkiUi = require('../yetki/ui');
const config = require('./config');

// Hepsi oryantasyon:<başvuru>:<işlem> şeklinde
// işlem: ileri | geri | atla | alan | seviye | ver | aktar | aktar-sec | iptal | iptal-form | devral
const IDS = { action: 'oryantasyon', cancelReason: 'oryantasyon-iptal-sebep' };
const TRANSFER_ID = 'basvuru-devir'; // basvuru sisteminin devir isteği butonu (basvuru/ui.js IDS.transfer)

const actionId = (app, action) => `${IDS.action}:${app.id}:${action}`;
const fill = (content, app) =>
  content.replaceAll('{aday}', `<@${app.userId}>`).replaceAll('{yetkili}', `<@${app.orientation.staffId}>`);
const channelUrl = (guildId, channelId) => `https://discord.com/channels/${guildId}/${channelId}`;
const progress = (index, total) => '▰'.repeat(index + 1) + '▱'.repeat(total - index - 1);
// Başvuru numarası her kartta aynı biçimde: kod rozeti kutucuğu içinde
const appNo = (app) => chip(`#${pad(app.number)}`);
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
  const levelDuties = yetkiConfig.duties.filter((d) => level.duties.includes(d.id));
  const areas = areasOf(app);
  const roleIds = [app.acceptRoleId, level.roleId, ...(level.extraRoleIds ?? []), ...levelPerms.map((p) => p.roleId), ...levelDuties.map((d) => d.roleId), ...areas.map((a) => a.roleId)];
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

// Standart sayfa düzeni: renk adı (primary, success...) ile page() kurar; thumbnail sağ üstteki küçük görsel
const card = (title, sub, blocks, color, thumbnail) => page({ title, sub, blocks, accent: color ? colors[color] : undefined, thumbnail });
// Altta çizgiden sonra butonlar / menüler, ardından isteğe bağlı küçük alt yazı
const withRow = (container, row) => container.addSeparatorComponents(divider()).addActionRowComponents(row);
const withFooter = (container, footer) => container.addSeparatorComponents(divider()).addTextDisplayComponents(text(footer));

// Hem panelde hem başvurular kanalındaki mesajda duran yönetim butonları: beklemeye al (başka yetkili üstlensin),
// başka yetkiliye bağla, başvuruyu tamamen reddet
function manageButtons(app) {
  return [
    new ButtonBuilder().setCustomId(actionId(app, 'bekle')).setStyle(ButtonStyle.Secondary).setLabel('Beklemeye Al'),
    new ButtonBuilder().setCustomId(actionId(app, 'aktar')).setStyle(ButtonStyle.Secondary).setLabel('Yetkiliye Aktar'),
    new ButtonBuilder().setCustomId(actionId(app, 'iptal')).setStyle(ButtonStyle.Danger).setLabel('Başvuruyu Reddet'),
  ];
}

const cancelButton = (app) => manageButtons(app)[2];
const claimButton = (app) =>
  new ButtonBuilder().setCustomId(actionId(app, 'ustlen')).setStyle(ButtonStyle.Success).setLabel('Oryantasyonu Üstlen');

// Oryantasyonu üstlenebilen roller: başvuruları inceleyen rol, yetkili alım / oryantasyon liderleri ve oryantasyon yetkilileri
const orienterRoleIds = (app) => [...new Set([app.reviewerRoleId, ...basvuruConfig.roles.orientation].filter(Boolean))];

// Başvurular kanalındaki mesajda oryantasyon sürerken çıkan satır: panele git, aktar, iptal.
// Yetkili henüz karar veriyorsa sadece iptal, yetkililere bırakıldıysa üstlen ve iptal çıkar.
function noticeRow(app) {
  const row = new ActionRowBuilder();
  const o = app.orientation;
  if (o.status === 'unassigned') return row.addComponents(claimButton(app), cancelButton(app));
  if (o.status === 'choosing') return row.addComponents(cancelButton(app));
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

// Adım türüne göre kısa "ne yapılacak" cümlesi — yetkili ve başvuran için ayrı satırlar
function stepHint(step, app) {
  const o = app.orientation;
  const staff = `<@${o.staffId}>`;
  if (step.type === 'areas') return `**Başvuran için:** Menüden en az bir görev alanı seç; birden fazla seçebilirsin.\n**Yetkili için:** Başvuran seçimini yaptıktan sonra **Anlatıldı, Devam** ile ilerliyorsun.`;
  if (step.type === 'final') return `**Yetkili için:** Seviyeyi kontrol et ve **Yetki Ver** ile roller verip oryantasyonu tamamla.`;
  if (o.awaitingConfirm) return `${staff} konuyu anlattı. **Başvuran:** konuyu anladıysan **Anladım, Devam** butonuna bas.`;
  return `**Yetkili için:** Konuyu anlat${step.skippable ? '; başvuran biliyorsa **Biliyor, Atla** ile geç' : ''}, bitince **Anlatıldı, Devam** ile ilerliyorsun.\n**Başvuran için:** Dinle ve anlamadığın yeri sor; bildiğin bir konu varsa yetkiliye söyle.`;
}

function stepBody(step, app) {
  const body = fill(step.body, app);

  if (step.type === 'areas') return `${body}\n**Seçilen Alanlar:** ${areaLabels(app) || 'Henüz seçilmedi'}`;
  if (step.type === 'areaInfo') {
    const areas = areasOf(app);
    return `${body}\n${areas.length ? areas.map((a) => `**${a.label}**\n${a.info}`).join('\n') : 'Henüz alan seçilmedi.'}`;
  }
  if (step.type === 'final') {
    const { roleIds } = plannedRoles(app);
    const roles = roleIds.length ? roleIds.map((id) => `<@&${id}>`).join(' ') : 'Rol tanımlı değil';
    return `${body}\n${summaryLines(app, Date.now()).join('\n')}\n**Verilecek Roller:** ${roles}`;
  }
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
    `**Anlatılan Konular:** ${told}/${topics.length}${o.skipped.length ? ` - Bildiği için geçilen: ${skippedTitles(app)}` : ''}`,
    `**Oryantasyon Süresi:** ${minutes(o.startedAt, endedAt)} dakika`,
  ];
}

function areaMenu(app) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(actionId(app, 'alan'))
      .setPlaceholder('Görev alanı seç')
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
      .setPlaceholder('Başlangıç yetkisi seç')
      .addOptions(
        yetkiConfig.levels.filter((l) => l.starter).map((l) =>
          new StringSelectMenuOptionBuilder().setValue(l.id).setLabel(l.label).setDescription(l.description).setDefault(l.id === levelOf(app).id),
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
  return `**Not:** ${missing.join(', ')} için henüz **rol tanımlanmadı**, yetki verilirken ${missing.length > 1 ? 'bu roller' : 'bu rol'} atlanacak.`;
}

// Görüşme kanalının sohbetindeki oryantasyon paneli. Adımları oryantasyonu veren yetkili ilerletir,
// alan seçimini başvuran da yapabilir. Tamamlanınca ya da iptal edilince özet haline gelir.
function panel(app, applicantUser) {
  const o = app.orientation;
  if (o.status === 'completed') return completedPanel(app, applicantUser);
  if (o.status === 'cancelled') return cancelledPanel(app);

  const { steps } = config;
  const step = steps[o.step];
  const presence = presenceText(app);
  const blocks = [
    `**Yetkili:** <@${o.staffId}>\n**Başvuran:** <@${app.userId}>\n**Adım:** ${o.step + 1}/${steps.length}\n${progress(o.step, steps.length)}${steps[o.step + 1] ? `\n**Sıradaki:** ${steps[o.step + 1].title}` : ''}`,
  ];
  if (presence) blocks.push(`**Kanal Durumu**\n${presence}`);
  blocks.push(`### ${step.title}\n${stepBody(step, app).replace(/\n{2,}/g, '\n')}`);
  blocks.push(stepHint(step, app));

  const container = card(
    `Oryantasyon - Başvuru #${pad(app.number)}`,
    'Adımları oryantasyonu veren yetkili ilerletir; görev alanını başvuran da seçebilir. Oryantasyon süreci, aktarma ve iptal işlemleri bu panelden yönetilir.',
    blocks,
    presence ? 'warning' : 'primary',
    applicantUser?.displayAvatarURL({ size: 256 }),
  );

  if (step.type === 'areas') withRow(container, areaMenu(app));
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
  );
  if (o.awaitingConfirm) {
    nav.addComponents(
      new ButtonBuilder().setCustomId(actionId(app, 'ileri')).setStyle(ButtonStyle.Secondary).setLabel('Onay Bekleniyor').setDisabled(true),
      new ButtonBuilder().setCustomId(actionId(app, 'anladim')).setStyle(ButtonStyle.Success).setLabel('Anladım, Devam'),
    );
  } else if (step.type === 'final') {
    nav.addComponents(
      new ButtonBuilder().setCustomId(actionId(app, 'ver')).setStyle(ButtonStyle.Success).setLabel('Yetki Ver').setDisabled(!o.areas.length),
    );
  } else {
    nav.addComponents(
      new ButtonBuilder()
        .setCustomId(actionId(app, 'ileri'))
        .setStyle(ButtonStyle.Success)
        .setLabel(step.nextLabel ?? 'Anlatıldı, Devam')
        .setDisabled(step.type === 'areas' && !o.areas.length),
    );
    if (step.skippable) {
      nav.addComponents(new ButtonBuilder().setCustomId(actionId(app, 'atla')).setStyle(ButtonStyle.Secondary).setLabel('Biliyor, Atla'));
    }
  }

  return container
    .addSeparatorComponents(divider())
    .addActionRowComponents(nav)
    .addSeparatorComponents(divider())
    .addActionRowComponents(new ActionRowBuilder().addComponents(manageButtons(app)))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        `-# Oryantasyon <t:${unix(o.startedAt)}:R> başladı`,
      ),
    );
}

function completedPanel(app, applicantUser) {
  const o = app.orientation;
  return card(
    'Oryantasyon Tamamlandı',
    'Tüm adımlar tamamlandı ve oryantasyon sona erdi. Öğrenilen konular, seçilen görev alanları ve oryantasyona ait özet bu mesajda kalıcı olarak durur.',
    [
      `<@${app.userId}>, başarıyla oryantasyonu tamamladın!\nOryantasyonu <@${o.staffId}> verdi.`,
      `**Oryantasyon Özeti**\n${summaryLines(app, o.finishedAt).join('\n')}`,
      `-# <t:${unix(o.finishedAt)}:F>`,
    ],
    'success',
    applicantUser?.displayAvatarURL({ size: 256 }),
  );
}

// Yetki verildi bildirimi: oryantasyon tamamlanmasından ayrı, rol ve ekip bilgileriyle gider
function rolesGrantedNotice(app) {
  const o = app.orientation;
  const { roleIds } = plannedRoles(app);
  const roles = roleIds.length ? roleIds.map((id) => `<@&${id}>`).join(' ') : 'Rol tanımlanmamış';
  return card(
    'Yetki Verildi — Ekibe Katıldı',
    `Oryantasyon tamamlandı ve roller verildi. ${areaLabels(app) ? `Görev alanı: ${areaLabels(app)}. ` : ''}Bu mesaj kanalın son kaydıdır.`,
    [
      `**<@${app.userId}> yetkili ekibine katıldı.**\nBaşlangıç yetkisi: **${o.levelLabel ?? '—'}** · Oryantasyonu veren: <@${o.staffId}>`,
      `**Verilen Roller**\n${roles}`,
      `-# <t:${unix(o.finishedAt)}:F>`,
    ],
    'success',
  );
}

// İptal edenin yazısı: yetkili iptal ettiyse o, başvuran ayrıldığı için bot iptal ettiyse otomatik
const cancelHeadline = (app) =>
  app.orientation.cancelledBy
    ? `<@${app.orientation.cancelledBy}>, <@${app.userId}> için verilen oryantasyonu sonlandırdı ve **başvuruyu reddetti.**`
    : `<@${app.userId}> için verilen oryantasyon otomatik olarak iptal edildi.`;
const penaltyText = (app) =>
  app.penaltyUntil ? `\n**Başvuru cezası:** <t:${unix(app.penaltyUntil)}:D> tarihine kadar yeniden başvuru yapamaz.` : '';

function cancelledPanel(app) {
  const o = app.orientation;
  return card(
    'Oryantasyon İptal Edildi',
    'Bu oryantasyon sonlandırıldı ve görüşme kanalları başvurana tekrar kilitlendi. İptal eden kişi, sebep ve varsa başvuru cezası bu mesajda yer alıyor.',
    [`**İptal**\n${cancelHeadline(app)}`, `**Sebep**\n${quote(o.cancelReason)}${penaltyText(app)}`, `-# <t:${unix(o.finishedAt)}:F>`],
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
        `**Ayrılma:** ${o.applicantLeaves}/${p.maxApplicantLeaves} - ${p.maxApplicantLeaves}. ayrılışta başvuru iptal edilir ve ${p.penaltyDays} gün başvuru cezası verilir.`,
    );
  }
  if (o.staffNeeded) {
    lines.push(
      `**Yetkili bekleniyor.** <@${o.staffId}> kanaldan ayrıldı ve geri dönmedi.\n` +
        'Başvurular kanalındaki mesajdan başka bir yetkili oryantasyonu devralabilir.',
    );
  } else if (o.staffAwaySince && o.staffJoining) {
    lines.push(`**<@${o.staffId}> oryantasyonu devraldı, kanala gelmesi bekleniyor.**`);
  } else if (o.staffAwaySince) {
    lines.push(
      `**<@${o.staffId}> kanaldan ayrıldı.** <t:${unix(o.staffAwaySince + p.staffGraceMinutes * MINUTE)}:R> dönmezse başka bir yetkili çağrılacak.`,
    );
  }
  return lines.length ? lines.join('\n') : null;
}

// Kayıt kanalındaki canlı oryantasyon mesajı: oryantasyon başlayınca gönderilir, adımlar ilerledikçe güncellenir,
// bitince orientationResult haline gelir
function orientationLog(app) {
  const o = app.orientation;
  const { steps } = config;

  const lines = [`**Adım:** ${chip(`${o.step + 1}/${steps.length}`)} ${steps[o.step].title}\n${progress(o.step, steps.length)}`];
  if (o.areas.length) lines.push(`**${o.areas.length > 1 ? 'Görev Alanları' : 'Görev Alanı'}:** ${areaLabels(app)}`);
  if (o.skipped.length) lines.push(`**Bildiği için geçilen:** ${skippedTitles(app)}`);
  if (o.transfers.length) lines.push(`**Aktarımlar:** ${o.transfers.map((t) => `<@${t.from}> → <@${t.to}>`).join(', ')}`);
  if (o.applicantLeaves) lines.push(`**Ayrılma:** ${chip(`${o.applicantLeaves}/${config.presence.maxApplicantLeaves}`)}`);

  const presence = presenceText(app);
  const blocks = [
    rows([
      ['Başvuru', chip(`#${pad(app.number)}`)],
      ['Yetkili', `<@${o.staffId}>`],
      ['Başvuran', `<@${app.userId}>`],
      ['Kanal', `<#${o.channelId}>`],
      ['Başlangıç', `<t:${unix(o.startedAt)}:t>`],
    ]),
  ];
  if (presence) blocks.push(`**Kanal Durumu**\n${presence}`);
  blocks.push(lines.join('\n'));

  const container = card(
    'Oryantasyon Sürüyor',
    'Oryantasyonun kayıt kanalındaki canlı özeti. Adımlar ilerledikçe bu mesaj kendiliğinden güncellenir ve oryantasyon bitince sonuç mesajına dönüşür.',
    blocks,
    presence ? 'warning' : 'primary',
  );
  if (o.messageId) {
    withRow(
      container,
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
    return card(
      'Oryantasyon İptal Edildi',
      'Bu başvurunun oryantasyonu sonlandırıldı ve görüşme kanalları başvurana kilitlendi. İptal eden kişi, sebep ve varsa başvuru cezası bu mesajda yer alıyor.',
      [`**İptal - Başvuru ${appNo(app)}**\n${cancelHeadline(app)}`, `**Sebep**\n${quote(o.cancelReason)}${penaltyText(app)}`, `-# <t:${unix(o.finishedAt)}:F>`],
      'danger',
    );
  }
  return card(
    'Oryantasyon Tamamlandı',
    'Bu başvurunun oryantasyonu tamamlandı ve görüşme kanalları başvurana kilitlendi. Oryantasyon özeti bu mesajda kalıcı olarak durur; rol ve ekip bilgileri ayrı mesajda.',
    [
      `**Başvuru ${appNo(app)}**\n<@${app.userId}> oryantasyonu tamamladı.\nOryantasyonu <@${o.staffId}> verdi.`,
      `**Oryantasyon Özeti**\n${summaryLines(app, o.finishedAt).join('\n')}`,
      `-# <t:${unix(o.finishedAt)}:F>`,
    ],
    'success',
  );
}

// Kayıt kanalına giden ayrı "yetki verildi" mesajı — orientationResult'tan bağımsız
function rolesGrantedResult(app) {
  const o = app.orientation;
  const { roleIds } = plannedRoles(app);
  const roles = roleIds.length ? roleIds.map((id) => `<@&${id}>`).join(' ') : 'Rol tanımlanmamış';
  return card(
    'Yetki Verildi',
    `Oryantasyonu tamamlayan başvurana başlangıç yetki rolü ve seçilen görev alanlarının rolleri verildi. Bu mesaj kayıt kanalındaki ekip katılım bildirimidir.`,
    [
      `**<@${app.userId}> yetkili ekibine katıldı.**\nBaşlangıç yetkisi: **${o.levelLabel ?? '—'}** · Oryantasyonu veren: <@${o.staffId}>`,
      `**Verilen Roller**\n${roles}`,
      `-# <t:${unix(o.finishedAt)}:F>`,
    ],
    'success',
  );
}

// Onaylanan başvurana giden DM: oryantasyon için hangi kanala geçeceği
function approvedDm(app, guildName, channelId) {
  const o = app.orientation;
  const blocks = [
    `**Başvuru Durumu**\nTebrikler, son aşamaya geçtin: oryantasyon!\n#${pad(app.number)} numaralı başvurunu <@${app.reviewedBy}> onayladı. Oryantasyonunu <@${o.staffId}> verecek.`,
  ];
  if (app.note) blocks.push(`**Not**\n${quote(app.note)}`);
  blocks.push(
    o.status === 'active'
      ? `**Oryantasyon**\nOryantasyonun <#${o.channelId}> kanalında **başladı**.\nAdımlar kanalın sohbetindeki **panelden** ilerliyor.`
      : '**Oryantasyon**\n' +
          (channelId
            ? `Oryantasyon için <#${channelId}> kanalına geç.\n`
            : 'Oryantasyon için görüşme kanallarından boş olanına geç.\n') +
          `<@${o.staffId}> ile aynı kanala girdiğinde oryantasyon **kendiliğinden başlar**, bot kanalın sohbetine adım adım ilerleyen bir **panel** atar. Kanallar senin için açıldı.`,
  );

  return withFooter(
    withRow(
      card(
        'Başvurun Onaylandı',
        'Yetkili başvurun onaylandı ve oryantasyon aşamasına geçildi. Hangi görüşme kanalına geçeceğin, sana kimin eşlik edeceği ve sonraki adımlar bu mesajda anlatılıyor.',
        blocks,
        'success',
      ),
      voiceButtons(app.guildId, channelId),
    ),
    `-# ${guildName} - <t:${unix(app.reviewedAt)}:F>`,
  );
}

// Oryantasyonu verecek yetkiliye giden DM (onaylayınca, oryantasyon kendisine aktarılınca ya da devralınca).
// tookOver: yetkili ayrıldığı için başvurular kanalından devralındıysa (transferredBy ayrılan yetkili),
// claimed: bekleyen oryantasyon başvurular kanalından üstlenildiyse
function staffDm(app, guildName, channelId, transferredBy, tookOver, claimed) {
  const o = app.orientation;
  const active = o.status === 'active';
  const target = active ? o.channelId : channelId;

  const voice = active
    ? `Oryantasyon <#${o.channelId}> kanalında sürüyor, kanala geç.\n` +
      `Paneldeki butonları artık sen kullanabilirsin, **kalınan adımdan** (${o.step + 1}/${config.steps.length}) devam edersin.`
    : (channelId ? `<#${channelId}> kanalına geç.\n` : 'Görüşme kanallarından boş olanına geç.\n') +
      'Başvuranla aynı kanala girdiğinde oryantasyon **kendiliğinden başlar**, panel kanalın sohbetine gelir. ' +
      'Adımları sen ilerletirsin; başvuranın bildiği konuları **Biliyor, Atla** ile geçebilirsin.';

  const reason = claimed
    ? `Bekleyen #${pad(app.number)} numaralı başvurunun oryantasyonunu üstlendin, artık başvuranla sen ilgileneceksin.`
    : tookOver
    ? `<@${transferredBy}> kanaldan ayrıldığı için #${pad(app.number)} numaralı başvurunun oryantasyonunu devraldın.`
    : transferredBy
      ? `<@${transferredBy}>, #${pad(app.number)} numaralı başvurunun oryantasyonunu sana aktardı.`
      : `#${pad(app.number)} numaralı başvuruyu onayladın, başvurana da DM ile haber verildi.`;

  return withFooter(
    withRow(
      card(
        'Oryantasyon Görevi',
        'Bir başvurunun oryantasyonunu vermek üzere görevlendirildin. Başvuranın kim olduğu, hangi kanaldan başlayacağın ve süreç boyunca neler yapacağın burada özetleniyor.',
        [`**Görev**\n<@${app.userId}> için oryantasyonu sen vereceksin.\n${reason}`, `**Kanal**\n${voice}`],
        'primary',
      ),
      voiceButtons(app.guildId, target),
    ),
    `-# ${guildName} - <t:${unix(Date.now())}:F>`,
  );
}

// Oryantasyonu tamamlayan yeni yetkiliye giden tebrik DM'i
function completedDm(app, guildName) {
  const o = app.orientation;
  return card(
    'Ekibe Hoş Geldin',
    'Oryantasyonu tamamladın ve yetkili ekibine katıldın. Başlangıç yetkin, görev alanların ve ilk günler için birkaç not seni bekliyor; yeni görevinde başarılar.',
    [
      [
        '**Yetki Bilgilerin**',
        `**Başlangıç Yetkin:** ${o.levelLabel}`,
        `**${o.areaLabels.length > 1 ? 'Görev Alanların' : 'Görev Alanın'}:** ${o.areaLabels.join(', ')}`,
        `**Oryantasyonu Veren:** <@${o.staffId}>`,
      ].join('\n'),
      yetkiUi.guideText(),
      '**Seni aramızda görmekten çok mutluyuz!**\n' +
        'Başvurudan oryantasyona kadar gösterdiğin ilgi için teşekkürler. İlk günlerde takıldığın her şeyi ' +
        `<@${o.staffId}> ya da diğer yetkililere sorabilirsin, kimse her şeyi ilk günden bilmez.\n` +
        '**Unutma:** yetkili olmak bir ayrıcalık değil, bir sorumluluk.',
      `-# ${guildName} - <t:${unix(o.finishedAt)}:F>`,
    ],
    'success',
  );
}

// Oryantasyonu iptal edilen başvurana giden DM
function cancelledDm(app, guildName) {
  const o = app.orientation;
  return card(
    'Oryantasyon İptal Edildi',
    'Başvurunun oryantasyonu sonlandırıldı. İptali yapan yetkili, sebebi ve yeniden başvuru yapabileceğin tarih bu mesajda; sorularında yetkililere ulaşabilirsin.',
    [
      `**Başvuru Durumu**\n#${pad(app.number)} numaralı başvurunun oryantasyonu iptal edildi.\n` +
        (o.cancelledBy ? `<@${o.cancelledBy}> oryantasyonu sonlandırdı.` : 'Oryantasyon otomatik olarak sonlandırıldı.'),
      `**Sebep**\n${quote(o.cancelReason)}` +
        (app.penaltyUntil ? `\nBu yüzden **<t:${unix(app.penaltyUntil)}:D>** tarihine kadar yeniden başvuru yapamazsın.` : ''),
      `-# ${guildName} - <t:${unix(o.finishedAt)}:F>`,
    ],
    'danger',
  );
}

// Başvurular kanalına giden "yetkili bekleniyor" mesajı; durum değiştikçe güncellenir.
// state: open (devral butonu açık) | returned (yetkili döndü) | taken (biri devraldı) | closed (oryantasyon bitti)
function takeoverNotice(app, state) {
  const o = app.orientation;
  const heading = `**Başvuru ${appNo(app)}**`;
  const record = 'Bu mesaj başvurular kanalında kayıt olarak kalır.';
  if (state === 'open') {
    const step = config.steps[o.step];
    return withRow(
      card(
        'Yetkili Bekleniyor',
        'Oryantasyon sırasında yetkili kanaldan ayrılıp dönmezse bu mesaj başvurular kanalına düşer; oryantasyonu başka bir yetkili buradan devralabilir.',
        [
          `${heading}\n${app.reviewerRoleId ? `<@&${app.reviewerRoleId}>, ` : ''}<@${app.userId}> oryantasyonun ortasında <#${o.channelId}> kanalında bekliyor.\n` +
            `<@${o.staffId}> kanaldan ayrıldı ve ${config.presence.staffGraceMinutes} dakika içinde dönmedi. ` +
            `Oryantasyon ${o.step + 1}/${config.steps.length} - ${step.title} adımında kaldı; devralan yetkili buradan devam eder.`,
        ],
        'warning',
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(actionId(app, 'devral')).setStyle(ButtonStyle.Success).setLabel('Oryantasyonu Devral'),
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Kanala Katıl').setURL(channelUrl(app.guildId, o.channelId)),
      ),
    );
  }
  if (state === 'returned') {
    return card(
      'Yetkili Geri Döndü',
      `Yetkili kanala döndü, oryantasyon kaldığı yerden devam ediyor. ${record}`,
      [`${heading}\n**<@${o.staffId}> kanala geri döndü, oryantasyon devam ediyor.**`],
      'success',
    );
  }
  if (state === 'taken') {
    const from = o.transfers.at(-1)?.from;
    return card(
      'Oryantasyon Devralındı',
      `Oryantasyonu başka bir yetkili devraldı ve kaldığı adımdan devam edecek. ${record}`,
      [`${heading}\n**<@${o.staffId}> oryantasyonu devraldı.**\n${from ? `<@${from}> ayrıldıktan sonra ` : ''}kalınan adımdan devam edilecek.`],
      'success',
    );
  }
  return card('Oryantasyon Sona Erdi', `Oryantasyon sona erdiği için artık yetkili beklenmiyor. ${record}`, [`${heading}\n**Oryantasyon sona erdi, yetkili beklenmiyor.**`]);
}

// Panel başka kanala taşınınca eski kanaldaki panelin yerine kalan not
function panelMoved(app) {
  const o = app.orientation;
  return withRow(
    card(
      'Oryantasyon Paneli Taşındı',
      'Yetkili ve başvuran görüşme kanalını değiştirdiği için oryantasyon paneli de yeni kanala taşındı. Oryantasyon kaldığı yerden devam ediyor; **Panele Git** butonuyla panele ulaşabilirsin.',
      [`**Panel <#${o.channelId}> kanalına taşındı.**`],
      'primary',
    ),
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
  const leaves = `**Ayrılma hakkı:** ${o.applicantLeaves}/${p.maxApplicantLeaves}. ${p.maxApplicantLeaves}. ayrılışta oryantasyon iptal edilir ve ${p.penaltyDays} gün başvuru yapamazsın.`;

  const texts = {
    applicantLeft: toApplicant
      ? ['Oryantasyondan Ayrıldın', `**Oryantasyonun sürerken <#${o.channelId}> kanalından ayrıldın.**\n${at(o.applicantAwaySince, p.applicantGraceMinutes)} dönmezsen oryantasyonun **iptal edilecek**. ${leaves}`, 'warning', o.channelId]
      : ['Başvuran Ayrıldı', `**<@${app.userId}> oryantasyon sırasında kanaldan ayrıldı.**\n${at(o.applicantAwaySince, p.applicantGraceMinutes)} dönmezse oryantasyon **otomatik iptal edilecek**. **Ayrılma:** ${o.applicantLeaves}/${p.maxApplicantLeaves}`, 'warning'],
    applicantBack: toApplicant
      ? ['Oryantasyon Devam Ediyor', '**Kanala geri döndün, oryantasyonun kaldığı yerden devam ediyor.**', 'success']
      : ['Başvuran Geri Döndü', `**<@${app.userId}> kanala geri döndü, oryantasyona devam edebilirsin.**`, 'success'],
    staffLeft: toApplicant
      ? ['Yetkilin Ayrıldı', `**<@${o.staffId}> kanaldan ayrıldı, lütfen kanalda bekle.**\n${at(o.staffAwaySince, p.staffGraceMinutes)} dönmezse başka bir yetkili oryantasyonunu devralacak.`, 'warning']
      : ['Oryantasyondan Ayrıldın', `**<@${app.userId}> ile oryantasyon sürerken <#${o.channelId}> kanalından ayrıldın.**\n${at(o.staffAwaySince, p.staffGraceMinutes)} dönmezsen oryantasyon başka yetkililere açılacak.`, 'warning', o.channelId],
    staffBack: toApplicant
      ? ['Yetkilin Geri Döndü', `**<@${o.staffId}> kanala geri döndü, oryantasyonun devam ediyor.**`, 'success']
      : ['Oryantasyon Devam Ediyor', '**Kanala geri döndün, oryantasyona kaldığın yerden devam edebilirsin.**', 'success'],
    staffJoined: toApplicant ? ['Yetkilin Geldi', `**<@${o.staffId}> kanala geldi, oryantasyonun devam ediyor.**`, 'success'] : null,
    staffNeeded: toApplicant
      ? ['Başka Yetkili Çağrıldı', `**<@${o.staffId}> geri dönmedi, oryantasyonun için başka bir yetkili çağrıldı.**\nKanalda beklemeye devam et, bir yetkili devraldığında haber vereceğiz.`, 'warning']
      : null,
    takenOver: toApplicant
      ? ['Oryantasyonun Devralındı', `**<@${o.staffId}> oryantasyonunu devraldı.**\nBirazdan kanala gelecek, kaldığın adımdan devam edeceksiniz.`, 'primary']
      : null,
    claimed: toApplicant
      ? ['Yetkilin Belli Oldu', `**<@${o.staffId}> oryantasyonunu üstlendi.**
${channelId ? `Seni <#${channelId}> kanalında bekleyecek, kanala girdiğinde oryantasyon kendiliğinden başlayacak.` : 'Görüşme kanallarından birine geçip beklemen yeterli; ikiniz aynı kanala girince oryantasyon kendiliğinden başlayacak.'}`, 'primary', channelId]
      : null,
    staffWaiting: toApplicant
      ? ['Yetkilin Seni Bekliyor', `**<@${o.staffId}> oryantasyon için <#${channelId}> kanalına girdi, seni bekliyor.**\nKanala girdiğinde oryantasyon kendiliğinden başlayacak.`, 'primary', channelId]
      : null,
    autoCancelled: toApplicant
      ? null
      : ['Oryantasyon İptal Edildi', `**<@${app.userId}> için verdiğin oryantasyon otomatik olarak iptal edildi.**\n${o.cancelReason}`, 'danger'],
  };

  const entry = texts[kind];
  if (!entry) return null;
  const [title, body, color, buttonChannelId] = entry;
  const container = card(
    title,
    'Oryantasyon sırasında görüşme kanalındaki giriş çıkışlar takip edilir. Bu mesaj kanaldaki son durumu ve varsa yapman gereken adımı bildirir.',
    [`**Durum**\n${body}`],
    color,
  );
  if (buttonChannelId) {
    withRow(
      container,
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel(['staffWaiting', 'claimed'].includes(kind) ? 'Kanala Katıl' : 'Kanala Dön')
          .setURL(channelUrl(app.guildId, buttonChannelId)),
      ),
    );
  }
  return withFooter(container, `-# ${guildName} - Başvuru #${pad(app.number)}`);
}

// "Yetkiliye Aktar" ile açılan, sadece butona basanın gördüğü seçim menüsü
function transferPicker(app) {
  return withRow(
    card(
      'Oryantasyonu Aktar',
      'Oryantasyonu başka bir yetkiliye devretmek için menüden birini seç. Yeni yetkiliye DM ile haber verilir ve oryantasyon kalınan adımdan kesintisiz devam eder.',
      [
        `**Yeni Yetkili**\nOryantasyonu kime aktarmak istiyorsun?\nSadece ${[app.reviewerRoleId, ...basvuruConfig.roles.orientation].filter(Boolean).map((id) => `<@&${id}>`).join(', ')} rolündekiler seçilebilir.`,
      ],
      'primary',
    ),
    new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder().setCustomId(actionId(app, 'aktar-sec')).setPlaceholder('Yetkili seç').setMinValues(1).setMaxValues(1),
    ),
  );
}

// Oryantasyon sürerken aktarılınca görüşme kanalının sohbetine giden bildirim, yeni yetkili etiketlenir
function transferNotice(app, fromId) {
  const o = app.orientation;
  return card(
    'Oryantasyon Aktarıldı',
    'Oryantasyonu veren yetkili değişti. Yeni yetkili panelden oryantasyonu kalınan adımdan sürdürür; başvuran kanalda beklemeye devam edebilir.',
    [
      `**<@${o.staffId}>, oryantasyon sana aktarıldı.**\n` +
        `<@${fromId}> aktardı; kalınan adımdan (${o.step + 1}/${config.steps.length}) devam edebilirsin.`,
    ],
    'primary',
  );
}

// "Başvuruyu Reddet" ile açılan form: başvuru tamamen reddedilir, sebep başvurana iletilir
function cancelModal(app) {
  return new ModalBuilder()
    .setCustomId(actionId(app, 'iptal-form'))
    .setTitle('Başvuruyu Reddet')
    .addTextDisplayComponents(
      text(
        `**#${pad(app.number)} numaralı başvuruyu reddediyorsun.**\n` +
          'Oryantasyon sona erer, başvuru tamamen reddedilir, sebep başvurana DM ile iletilir ve görüşme kanalları ona tekrar kilitlenir.',
      ),
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Neden reddediyorsun?')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(IDS.cancelReason)
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Örn: Oryantasyonda kurallara uymadı.')
            .setMinLength(5)
            .setMaxLength(500)
            .setRequired(true),
        ),
    );
}

// Başvuruyu onaylayan yetkiliye görüşme kanalının sohbetinde sorulan soru: oryantasyonu kendisi mi verecek, yetkililere mi bırakacak
function choicePanel(app) {
  return withRow(
    card(
      'Oryantasyonu Kim Verecek?',
      'Başvuruyu uygun buldun. Oryantasyonu **kendin** verebilir ya da **oryantasyon yetkililerine** bırakabilirsin; bırakırsan başvurular kanalına bildirim düşer ve ilk üstlenen yetkili oryantasyonu verir.',
      [`**Başvuru ${appNo(app)}**\n<@${app.userId}> için oryantasyon aşamasına geçiliyor.\nSeçimi sadece <@${app.orientation.staffId}> (ya da yöneticiler) yapabilir.`],
      'success',
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(actionId(app, 'ben')).setStyle(ButtonStyle.Success).setLabel('Ben Vereceğim'),
      new ButtonBuilder().setCustomId(actionId(app, 'birak')).setStyle(ButtonStyle.Secondary).setLabel('Yetkililere Bırak'),
    ),
  );
}

// Seçim yapılınca soru mesajının yerine geçen sonuç. lines: "ben" seçildiyse oryantasyonun ne durumda olduğu
function choiceResult(app, which, lines = []) {
  if (which === 'ben') {
    return card(
      'Oryantasyonu Sen Veriyorsun',
      'Oryantasyon sana verildi. İkiniz de aynı görüşme kanalına girince oryantasyon kendiliğinden başlar ve panel kanalın sohbetine gelir; adımları sen ilerletirsin.',
      [`**Başvuru ${appNo(app)}**\n${lines.join('\n') || `<@${app.userId}> ile oryantasyona geçiliyor.`}`],
      'success',
    );
  }
  return card(
    'Yetkililere Bırakıldı',
    'Oryantasyon artık sende değil. Başvurular kanalına bildirim gönderildi; **Oryantasyonu Üstlen** butonuna ilk basan yetkili oryantasyonu verir, o zamana kadar başvuran kanalda bekleyebilir.',
    [`**Başvuru ${appNo(app)}**\n<@${app.userId}> için oryantasyon yetkilisi bekleniyor.`],
    'primary',
  );
}

// Başvurular kanalına giden "bekleyen oryantasyon" mesajı: oryantasyon yetkililere bırakılınca ve başvuran bir görüşme
// kanalına geçince gelir, ilk üstlenen yetkili oryantasyonu verir. Üstlenen olunca (ya da oryantasyon bitince) kayıt olarak kalır.
// state: open (başvuran henüz kanalda değil) | waiting (başvuran kanalda bekliyor) | taken | closed
function pendingNotice(app, state, channelId, reminder) {
  const o = app.orientation;
  const heading = `**Başvuru ${appNo(app)}**`;
  const record = 'Bu mesaj başvurular kanalında kayıt olarak kalır.';
  if (state === 'taken') {
    return card(
      'Oryantasyon Üstlenildi',
      `Bekleyen oryantasyonu bir yetkili üstlendi, artık başka bir işlem gerekmiyor. ${record}`,
      [`${heading}\n**<@${o.staffId}> oryantasyonu üstlendi.**`],
      'success',
    );
  }
  if (state === 'hold') {
    return card(
      'Oryantasyon Beklemede',
      `Oryantasyonu veren yetkili işlemi beklemeye aldı; yeni bir yetkili üstlenince kalınan adımdan devam edilir. ${record}`,
      [`${heading}\n**<@${o.holdBy}> oryantasyonu beklemeye aldı.**\n<@${app.userId}> yeni yetkili üstleninceye kadar bekliyor.`],
      'warning',
    );
  }
  if (state === 'superseded') {
    return card(
      'Oryantasyon Beklemede',
      `Geri alma süresi doldu; yetkililere haber vermek için yeni bir bildirim gönderildi. ${record}`,
      [`${heading}\n<@${o.holdBy}> oryantasyonu beklemeye almıştı.`],
      'warning',
    );
  }
  if (state === 'closed') {
    return card('Oryantasyon Sona Erdi', `Oryantasyon üstlenilmeden sona erdiği için artık yetkili beklenmiyor. ${record}`, [`${heading}\n**Oryantasyon sona erdi, yetkili beklenmiyor.**`]);
  }

  const waiting = state === 'waiting';
  const guarded = state === 'protected';
  const roles = basvuruConfig.roles.orientationPing.map((id) => `<@&${id}>`).join(', ');
  const info = rows([
    ['Başvuru', appNo(app)],
    ['Başvuran', `<@${app.userId}>`],
    ['Aşama', chip('Oryantasyon')],
    o.holdBy ? ['Beklemeye Alan', `<@${o.holdBy}>`] : ['Yetkili', chip('Henüz üstlenen yok')],
    channelId && ['Kanal', `<#${channelId}>`],
  ]);

  let sub;
  let status;
  if (guarded) {
    sub = `**<@${o.holdBy}>** oryantasyonu beklemeye aldı ve **<t:${unix(o.holdUntil)}:R>** kadar yalnızca o geri alabilir. Başka bir yetkili **Devralma İste** ile ondan devir isteyebilir; süre dolunca herkes üstlenebilir ve yetkililere haber verilir.`;
    status = `**<@${o.holdBy}> oryantasyonu beklemeye aldı.**\n<@${app.userId}> yetkili bekliyor, bu süre içinde yetkililer etiketlenmez.`;
  } else if (reminder) {
    sub = 'Başvuran hâlâ bekliyor ve **Hatırlat** butonuyla haber verdi. **Oryantasyonu Üstlen** butonuna ilk basan yetkili oryantasyonu verir.';
    status = `${roles}\n**<@${app.userId}> hâlâ üstlenecek yetkili bekliyor.**`;
  } else {
    sub = 'Oryantasyonu **Oryantasyonu Üstlen** butonuna ilk basan yetkili verir ve başvuranla ilgilenmek zorundadır.';
    const where = channelId ? `<#${channelId}> kanalında oryantasyon için yetkili bekliyor` : 'henüz bir görüşme kanalında değil';
    const why = o.holdBy
      ? `<@${o.holdBy}> oryantasyonu beklemeye almıştı, geri alma süresi doldu; kalınan adımdan devam edilecek.`
      : app.reviewedBy
        ? `<@${app.reviewedBy}> başvuruyu onayladı ve oryantasyonu yetkililere bıraktı.`
        : 'Oryantasyon yetkililere bırakıldı.';
    status = `${roles}\n**<@${app.userId}> ${waiting ? `${where}.` : `${where}.`}**\n${why}`;
  }

  const buttons = [claimButton(app)];
  if (guarded) buttons.push(new ButtonBuilder().setCustomId(`${TRANSFER_ID}:${app.id}:iste`).setStyle(ButtonStyle.Secondary).setLabel('Devralma İste'));
  if (channelId) buttons.push(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Kanala Katıl').setURL(channelUrl(app.guildId, channelId)));
  return withRow(
    card(
      reminder ? 'Başvuran Hatırlatıyor' : waiting ? 'Başvuran Bekliyor' : o.holdBy ? 'Beklemedeki Oryantasyon' : 'Bekleyen Oryantasyon',
      sub,
      [info, status],
      'warning',
    ),
    new ActionRowBuilder().addComponents(buttons),
  );
}

// Bekleyen oryantasyon üstlenilince başvuran bir görüşme kanalındaysa o kanalın sohbetine giden bilgi
function claimedChat(app) {
  const here = app.orientation.status === 'active';
  return card(
    'Oryantasyon Üstlenildi',
    here
      ? 'Bekleyen oryantasyonu bir yetkili üstlendi ve oryantasyon başladı. Adımlar kanalın sohbetindeki panelden ilerliyor; bu mesaj kayıt olarak kalır.'
      : 'Bekleyen oryantasyonu bir yetkili üstlendi. Yetkili kanala geldiğinde oryantasyon kendiliğinden başlar ve panel bu kanalın sohbetine gelir; o zamana kadar kanaldan ayrılmadan beklemen yeterli.',
    [
      rows([
        ['Başvuru', appNo(app)],
        ['Başvuran', `<@${app.userId}>`],
        ['Aşama', chip('Oryantasyon')],
        ['Yetkili', `<@${app.orientation.staffId}>`],
      ]),
      here ? '**Oryantasyon başladı.**' : '**Yetkilinin kanala gelmesi bekleniyor.**',
    ],
    'primary',
  );
}

// Oryantasyon yetkililere bırakıldığında başvuran bir görüşme kanalında değilse ona giden DM
function pendingDm(app, guildName) {
  return withFooter(
    withRow(
      card(
        'Oryantasyon Bekleniyor',
        'Başvurun onaylandı ve oryantasyona çağırıldın. Oryantasyonu bir yetkili üstlenince sana haber vereceğiz; şimdilik görüşme kanallarından birine geçip orada beklemen yeterli.',
        [
          `**Başvuru Durumu**\nTebrikler, son aşamaya geçtin: oryantasyon!\n#${pad(app.number)} numaralı başvurunu <@${app.reviewedBy}> onayladı.`,
          '**Oryantasyon**\nOryantasyonu **ilk üstlenen yetkili** verecek. Üstlendiğinde ve ikiniz aynı kanala girdiğinizde oryantasyon **kendiliğinden başlar**. Kanallar senin için açıldı.',
        ],
        'success',
      ),
      voiceButtons(app.guildId, null),
    ),
    `-# ${guildName} - <t:${unix(app.reviewedAt)}:F>`,
  );
}

module.exports = {
  IDS,
  orienterRoleIds,
  claimedChat,
  choicePanel,
  choiceResult,
  pendingNotice,
  pendingDm,
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
