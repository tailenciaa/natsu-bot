// Partner sistemi: talep kanalında "partner" / "dm" geçen ya da partner yetkilisi rolünü etiketleyen mesaja bot
// yanıt olarak "oto partner yapmak ister misin?" sorar. Evet denirse sunucu ID'si ve partner metni formla alınır;
// talep sahibine DM'den şartlar sorulur, kabul edince inceleme kanalına gider. Yetkili onaylarsa paylaşım
// kanalına otomatik gönderilir ve talep sahibi otomatik güvenilir partnerler listesine eklenir. Paylaşım kanalına
// düşen her mesaj (oto onaylı ya da elle atılmış, fark etmez) bot tarafından silinip kendi standart kartıyla
// yeniden paylaşılır; bu kanalda @everyone/@here hem kanal izniyle hem bot her zaman mention'ları kapalı
// gönderdiği için asla gerçek bir bildirim göndermez. Güvenilir partnerler kanalındaki "Teklifte Bulun" butonu
// bir partner yetkilisi atar; atanan yetkili kabul edip metni onaylar/düzenler/iptal eder, onaylanınca karşı
// taraf (daha önce hiç kabul etmediyse) şartları kabul edip otomatik paylaşılır, ardından karşı tarafa bizim
// tanıtım metnimiz de gönderilir. Yetkililer /partner-musaitlik ile aktif/meşgul durumlarını ayarlayabilir. Güvenilir listeye alınan partnerin yetkilileri DM'den bir Partner Paneli alır: müsaitlik durumlarını seçer (meşgulken yetkililerimiz teklif göndermez) ve istedikleri zaman kendi tarafından partnerlik teklifi gönderir; teklif oto partner talebiyle aynı yoldan inceleme kanalına düşer.
const { Events, InteractionContextType, SlashCommandBuilder } = require('discord.js');
const core = require('../../core/ui');
const { guildId } = require('../../core/config');
const { respond, replyError, isStaff, fetchTextChannel } = require('../../core/helpers');
const ratings = require('../degerlendirme');
const config = require('./config');
const store = require('./store');
const ui = require('./ui');

// Güvenilir listeden çıkarma ve kullanıcı yasaklama gibi ağır kararlar sadece partner lideri rolüne açık
const isLead = (interaction) => isStaff(interaction, config.roles.lead);

const commands = [
  new SlashCommandBuilder()
    .setName('guvenilir-partnerler')
    .setDescription('Güvenilir partner sunucuların listesini gösterir.')
    .setContexts(InteractionContextType.Guild),
  new SlashCommandBuilder()
    .setName('partner-musaitlik')
    .setDescription('Partner yetkilisi olarak teklif atamaları için müsaitlik durumunu ayarlar.')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) =>
      o
        .setName('durum')
        .setDescription('Durumun')
        .setRequired(true)
        .addChoices({ name: 'Aktif', value: 'aktif' }, { name: 'Meşgul', value: 'mesgul' }),
    ),
];

// ── Talep kanalı: tetikleyici mesaja oto partner teklifi ───────────────────────

function matchesTrigger(message) {
  if (message.mentions.roles.has(config.roles.staff)) return true;
  const words = message.content.toLocaleLowerCase('tr-TR').split(/[^a-zçğıöşü0-9]+/u);
  return config.triggerWords.some((word) => words.includes(word));
}

// Sunucu ID'sinin geçerli olup olmadığını kontrol et (sadece rakamlar, 15-25 karakter)
function isValidServerId(serverId) {
  return /^\d{15,25}$/.test(serverId);
}

// Partner metninde Discord invite linki var mı kontrol et
function hasDiscordInviteLink(text) {
  return /(discord\.gg\/|discord\.com\/invite\/|discordapp\.com\/invite\/)/i.test(text);
}

// Partner metnindeki Discord invite linkinden sunucu ID'sini çıkart
function extractServerIdFromText(text) {
  // Farklı Discord invite formatlarını destekle
  // discord.gg/invite ve discordapp.com/invite formatları
  const match = text.match(/discord\.gg\/([A-Za-z0-9\-]+)/i);
  if (match && match[1]) {
    // Eğer invite kodu rakam değilse (geçerli invite) kontrol et
    return null; // Invite kodu olabilir, tam sunucu ID değil
  }
  return null;
}

async function handleRequestChannel(message) {
  if (store.isBanned(message.author.id)) return;
  if (!matchesTrigger(message)) return;
  await message.channel
    .send({
      components: [ui.startPrompt(message.author.id)],
      flags: core.CV2,
      reply: { messageReference: message.id, failIfNotExists: false },
      allowedMentions: { parse: [] },
    })
    .catch(() => {});
}

// ── Paylaşım kanalı: her mesaj silinip bot tarafından yeniden, standart kartla paylaşılır ─────────────────────

async function handlePostsChannel(message) {
  if (message.author.bot) return;
  const text = message.content?.trim() ?? '';
  const files = [...message.attachments.values()].map((a) => ({ attachment: a.url, name: a.name }));

  const number = store.nextRequestNumber(message.guildId);
  const request = store.createRequest({
    id: `${message.guildId}-${number}`,
    number,
    guildId: message.guildId,
    requesterId: message.author.id,
    serverId: null,
    text: text || '-# (metin yok, sadece dosya paylaşıldı)',
    status: 'approved',
    source: 'manuel',
    createdAt: Date.now(),
    decidedBy: null,
    decidedAt: Date.now(),
  });

  await message.delete().catch(() => {});
  await message.channel
    .send({
      components: [ui.postCard(request, null, store.isBanned(message.author.id))],
      files,
      flags: core.CV2,
      allowedMentions: { parse: [] },
    })
    .catch((err) => console.error('[partner] Elle atılan partner metni paylaşılamadı:', err.message));
}

function handleMessageCreate(message) {
  if (message.guildId !== guildId) return;
  if (message.channelId === config.channels.request) return handleRequestChannel(message);
  if (message.channelId === config.channels.posts) return handlePostsChannel(message);
}

// ── Oto partner akışı: buton → form → inceleme → onay/red ──────────────────────

async function handleStartButton(interaction) {
  const authorId = interaction.customId.slice(ui.IDS.start.length + 1);
  if (interaction.user.id !== authorId) return replyError(interaction, 'Bu butonu sadece mesajı yazan kullanabilir.');
  if (store.isBanned(interaction.user.id)) return replyError(interaction, 'Partner sisteminden yasaklandığın için talep oluşturamazsın.');
  if (store.pendingOf(interaction.guildId, interaction.user.id)) {
    return replyError(interaction, 'Zaten bekleyen bir partner talebin var.', 'Bir yetkili inceleyene kadar beklemen gerekiyor.');
  }

  return interaction.showModal(ui.requestModalWithMessageId(interaction.message.id));
}

async function handleStartBan(interaction) {
  if (!isLead(interaction)) return replyError(interaction, 'Bu işlemi sadece partner lideri yapabilir.');

  const serverId = interaction.customId.slice(ui.IDS.startBan.length + 1);
  if (!serverId) return replyError(interaction, 'Sunucu ID\'si bulunamadı.');

  return interaction.showModal(ui.banServerModal(serverId));
}

async function handleStartBanSubmit(interaction) {
  const serverId = interaction.customId.slice(ui.IDS.startBanModal.length + 1);
  if (!isLead(interaction)) return replyError(interaction, 'Bu işlemi sadece partner lideri yapabilir.');

  const reason = interaction.fields.getTextInputValue(ui.IDS.banReason).trim();
  store.banServer(serverId, reason, interaction.user.id);

  await interaction.deferUpdate();
  await interaction.editReply({
    components: [core.alert('Sunucu yasaklandı.', `Sunucu ID: \`${serverId}\``, 'danger')],
  });

  // Yasaklı partnerler kanalına gönder
  const guild = interaction.guild;
  const bannedChannel = await fetchTextChannel(guild, config.channels.banned);
  await bannedChannel?.send({
    components: [
      core.alert(
        `🚫 **Sunucu Yasaklandı** — \`${serverId}\``,
        `**Sebep:** ${reason}\n**Yasaklayan:** <@${interaction.user.id}>`,
        'danger',
      ),
    ],
    flags: core.CV2,
    allowedMentions: { parse: [] },
  }).catch((err) => console.error('[partner] Yasaklı sunucu kanalına gönderilemedi:', err.message));
}

// Form gönderilince talep hemen incelemeye gitmez: önce talep sahibine DM'den şartlar sorulur, kabul edince
// inceleme kanalına düşer. Ama şartları daha önce kabul ettiyse doğrudan incelemeye gider. "awaiting_terms"
// durumu da pendingOf tarafından bekleyen talep sayılır.
async function handleNewRequestSubmit(interaction, serverId, adText, messageId) {
  if (store.pendingOf(interaction.guildId, interaction.user.id)) {
    return replyError(interaction, 'Zaten bekleyen bir partner talebin var.');
  }

  // Sunucu ID doğrulama
  if (!isValidServerId(serverId)) {
    return replyError(interaction, 'Geçersiz Sunucu ID.', 'Sunucu ID sadece rakamlardan oluşmalı ve 15-25 karakter olmalı.');
  }

  // Partner metni Discord invite linki kontrolü
  if (!hasDiscordInviteLink(adText)) {
    return replyError(interaction, 'Partner metni Discord invite linki içermeli.', 'discord.gg/... formatında bir link ekle.');
  }

  // Yasaklı sunucu kontrolü
  const bannedInfo = store.isServerBanned(serverId);
  if (bannedInfo) {
    // Talep sahibine DM gönder
    await interaction.user
      .send({
        components: [
          core.alert(
            '❌ Sunucunuz Yasaklandı',
            `**Sebep:** ${bannedInfo.reason}\n\nBu yasaklılık kaldırılmadığı sürece partner yapılamayacaksınız.`,
            'danger',
          ),
        ],
        flags: core.CV2,
      })
      .catch(() => {});

    return replyError(interaction, 'Bu sunucu yasaklı.', 'Yasaklılık hakkında daha fazla bilgi için DM\'ini kontrol et.');
  }

  // Orijinal mesajı update et (buton devre dışı, success state)
  if (messageId) {
    try {
      await interaction.channel.messages.edit(messageId, { components: [ui.startPromptSuccess()] }).catch(() => {});
    } catch (err) {
      console.error('[partner] Orijinal mesaj güncellenemedi:', err.message);
    }
  }

  const number = store.nextRequestNumber(interaction.guildId);
  const alreadyAccepted = store.hasAcceptedTerms(interaction.user.id);

  const request = store.createRequest({
    id: `${interaction.guildId}-${number}`,
    number,
    guildId: interaction.guildId,
    requesterId: interaction.user.id,
    serverId,
    text: adText,
    status: alreadyAccepted ? 'pending' : 'awaiting_terms',
    source: 'oto',
    createdAt: Date.now(),
    decidedBy: null,
    decidedAt: null,
  });

  // Şartları daha önce kabul ettiyse doğrudan incelemeye gönder
  if (alreadyAccepted) {
    const guild = interaction.client.guilds.cache.get(request.guildId);
    const reviewChannel = guild && (await fetchTextChannel(guild, config.channels.review));
    await reviewChannel
      ?.send({ components: [ui.reviewCard(request)], flags: core.CV2, allowedMentions: { roles: [config.roles.staff] } })
      .catch((err) => console.error('[partner] İnceleme kanalına gönderilemedi:', err.message));

    return respond(
      interaction,
      core.alert('Partner talebin incelemeye gönderildi!', 'Şartları daha önce kabul ettiğin için hemen yetkili incelemesine düştü.', 'success'),
    );
  }

  // Şartları ilk defa soruyoruz
  const sent = await interaction.user
    .send({ components: [ui.termsDm(`${ui.IDS.termsAccept}:${request.id}`)], flags: core.CV2 })
    .catch(() => null);
  if (!sent) {
    store.deleteRequest(request.id);
    return replyError(interaction, 'DM\'ine gönderemedim.', 'DM\'lerin açık olduğundan emin ol ve tekrar dene.');
  }

  return respond(
    interaction,
    core.alert('Son bir adım kaldı!', 'Partner şartlarını DM\'inden onaylaman gerekiyor, onaylayınca talebin yetkili incelemesine düşecek.', 'success'),
  );
}

// DM'deki "Şartları Kabul Ediyorum" butonu: ilk oto partner talebini incelemeye gönderir
async function handleInitialTermsAccept(interaction) {
  const requestId = interaction.customId.slice(ui.IDS.termsAccept.length + 1);
  const request = store.getRequest(requestId);
  if (!request || request.requesterId !== interaction.user.id) {
    return replyError(interaction, 'Bu talep artık geçerli değil.');
  }
  if (request.status !== 'awaiting_terms') return replyError(interaction, 'Bu talep zaten işlendi.');

  await interaction.deferUpdate();
  store.markTermsAccepted(interaction.user.id);
  store.updateRequest(requestId, { status: 'pending' });
  const updated = store.getRequest(requestId);

  await interaction.editReply({
    components: [core.alert('Şartları kabul ettin!', 'Talebin yetkili incelemesine gönderildi, sonucu buradan öğreneceksin.', 'success')],
  });

  const guild = interaction.client.guilds.cache.get(request.guildId);
  const reviewChannel = guild && (await fetchTextChannel(guild, config.channels.review));
  await reviewChannel
    ?.send({ components: [ui.reviewCard(updated)], flags: core.CV2, allowedMentions: { roles: [config.roles.staff] } })
    .catch((err) => console.error('[partner] İnceleme kanalına gönderilemedi:', err.message));
}

async function handleModalSubmit(interaction) {
  const rest = interaction.customId.slice(ui.IDS.modal.length + 1); // "yeni:<messageId>" / "guven:<talep>:<mesaj>"
  const [mode, a, b] = rest.split(':');

  if (mode === 'guven') return handleTrustedAddSubmit(interaction, a, b);

  const messageId = a;
  const serverId = interaction.fields.getTextInputValue(ui.IDS.serverId).trim();
  const adText = interaction.fields.getTextInputValue(ui.IDS.adText).trim();
  return handleNewRequestSubmit(interaction, serverId, adText, messageId);
}

async function handleReviewDecision(interaction) {
  const rest = interaction.customId.slice(ui.IDS.review.length + 1);
  const sep = rest.lastIndexOf(':');
  const requestId = rest.slice(0, sep);
  const sonuc = rest.slice(sep + 1);

  if (!isStaff(interaction, config.roles.staff)) return replyError(interaction, 'Bu kararı sadece partner yetkilileri verebilir.');
  const request = store.getRequest(requestId);
  if (!request || request.status !== 'pending') return replyError(interaction, 'Bu talep zaten sonuçlandı ya da bulunamadı.');

  await interaction.deferUpdate();
  store.updateRequest(requestId, { status: sonuc === 'onayla' ? 'approved' : 'rejected', decidedBy: interaction.user.id, decidedAt: Date.now() });
  const updated = store.getRequest(requestId);

  await interaction.editReply({ components: [ui.reviewCard(updated, { sonuc, by: interaction.user.id })], allowedMentions: { parse: [] } });

  const requester = await interaction.client.users.fetch(request.requesterId).catch(() => null);
  await requester?.send({ components: [ui.requesterResult(sonuc, updated, interaction.user.id)], flags: core.CV2 }).catch(() => {});
  // Talep sahibi kararı veren partner yetkilisini puanlayabilir
  await ratings.requestForPartner(interaction.client, updated, interaction.user.id).catch((err) => console.error('[partner] Değerlendirme gönderilemedi:', err.message));

  if (sonuc === 'onayla') {
    // Onayda güvenilir listeye otomatik eklemiyoruz; yetkili karttaki "Güvenilir Partnerler Listesine Al"
    // butonuna basarak elle ekler. Kart bu yüzden "güvenilir değil" (buton aktif) durumuyla paylaşılır.
    // Güvenilir partnerin Partner Paneli'nden gelen tekliflerde kayıt yeni metinle güncellenir (yenileme gibi)
    const renewedEntry = request.renewalOf && store.getTrusted(request.renewalOf)
      ? store.updateTrusted(request.renewalOf, { content: request.text, addedAt: Date.now(), sourceRequestId: request.id })
      : null;
    if (renewedEntry) await refreshTrustedPanel(interaction.client, interaction.guildId);
    const postsChannel = await fetchTextChannel(interaction.guild, config.channels.posts);
    await postsChannel
      ?.send({
        components: [ui.postCard(updated, renewedEntry, store.isBanned(request.requesterId))],
        flags: core.CV2,
        allowedMentions: { parse: [] },
      })
      .catch((err) => console.error('[partner] Onaylanan talep paylaşılamadı:', err.message));
  }
}

// ── Güvenilir partnerler listesi ────────────────────────────────────────────────

// Güvenilir partnerler kanalındaki sürekli güncel panel: liste değiştiğinde aynı mesaj düzenlenir, yoksa/silinmişse yeniden gönderilir
async function refreshTrustedPanel(client, guildId_) {
  if (!config.channels.trustedList) return;
  const guild = client.guilds.cache.get(guildId_);
  const channel = await fetchTextChannel(guild, config.channels.trustedList);
  if (!channel) return;

  const container = ui.trustedListPanel(store.trustedOf(guildId_));
  const messageId = store.trustedPanelMessageId(guildId_);
  const edited = messageId
    ? await channel.messages.edit(messageId, { components: [container], allowedMentions: { parse: [] } }).catch(() => null)
    : null;
  if (edited) return;

  const message = await channel
    .send({ components: [container], flags: core.CV2, allowedMentions: { parse: [] } })
    .catch((err) => console.error('[partner] Güvenilir partnerler paneli gönderilemedi:', err.message));
  if (message) store.setTrustedPanelMessageId(guildId_, message.id);
}

// Birden fazla ID'yi virgül/boşluk/yeni satırla ayrılmış halde kabul eder, geçersizleri eler, tekrarları temizler
function parseContactIds(raw) {
  const ids = raw
    .split(/[\s,]+/)
    .map((v) => v.trim())
    .filter((v) => /^\d{15,25}$/.test(v));
  return [...new Set(ids)].slice(0, 10);
}

// Oto partner / teklif akışında formu dolduran zaten karşı sunucunun partner yetkilisidir, ID biliniyor demektir.
// Elle paylaşılan metinlerde bu bilgi yok; o durumda ayrı bir formla sorulur (handleTrustedAddSubmit).
function createTrustedRecord(interaction, request, contactIds) {
  const number = store.nextTrustedNumber(interaction.guildId);
  return store.addTrusted({
    id: `${interaction.guildId}-${number}`,
    guildId: interaction.guildId,
    sourceRequestId: request.id,
    serverId: request.serverId,
    content: request.text,
    contactIds,
    addedBy: interaction.user.id,
    addedAt: Date.now(),
  });
}

async function handleTrustedAdd(interaction) {
  const requestId = interaction.customId.slice(ui.IDS.trustedAdd.length + 1);
  if (!isStaff(interaction, config.roles.staff)) return replyError(interaction, 'Bu işlemi sadece partner yetkilileri yapabilir.');

  const request = store.getRequest(requestId);
  if (!request) return replyError(interaction, 'Bu partner kaydı artık mevcut değil.');
  if (store.trustedBySource(interaction.guildId, requestId)) return replyError(interaction, 'Bu partner zaten güvenilir listede.');

  if (request.source === 'manuel') return interaction.showModal(ui.trustedAddModal(requestId, interaction.message.id));

  const entry = createTrustedRecord(interaction, request, [request.requesterId]);
  await interaction.update({ components: [ui.postCard(request, entry, store.isBanned(request.requesterId))], allowedMentions: { parse: [] } });
  await refreshTrustedPanel(interaction.client, interaction.guildId);

  // Karşı tarafın yetkilisine bizim metni ve Partner Paneli'ni gönder
  await sendOurTextToContact(interaction.client, request.requesterId, entry);
  await sendPartnerPanel(interaction.client, request.requesterId, entry);
}

// Partner yetkilisine DM'den Partner Paneli gider: müsaitlik durumunu seçer, istediğinde kendi tarafından teklif gönderir
async function sendPartnerPanel(client, contactId, entry) {
  const contact = await client.users.fetch(contactId).catch(() => null);
  const guildName = client.guilds.cache.get(entry.guildId)?.name ?? 'Sunucu';
  return contact?.send({ components: [ui.partnerPanel(entry, guildName)], flags: core.CV2 }).catch(() => null);
}

// Panel butonlarını sadece o kaydın partner yetkilileri kullanabilir (yasaklı kullanıcı ve sunucu hariç)
function panelAccess(interaction, trustedId) {
  const entry = store.getTrusted(trustedId);
  if (!entry) return { error: 'Bu partnerlik artık mevcut değil.' };
  if (!entry.contactIds?.includes(interaction.user.id)) return { error: 'Bu panel sadece sunucunun partner yetkilileri içindir.' };
  if (store.isBanned(interaction.user.id) || store.isServerBanned(entry.serverId)) return { error: 'Partner sisteminden yasaklı olduğun için bu paneli kullanamazsın.' };
  return { entry };
}

// Panelden müsaitlik seçilince: durum kaydedilir, aynı DM güncellenir
async function handlePanelStatus(interaction) {
  const { entry, error } = panelAccess(interaction, interaction.customId.slice(ui.IDS.panelStatus.length + 1));
  if (error) return replyError(interaction, error);

  const updated = store.updateTrusted(entry.id, { contactStatus: interaction.values[0] === 'mesgul' ? 'mesgul' : 'aktif', contactStatusAt: Date.now() });
  const guildName = interaction.client.guilds.cache.get(entry.guildId)?.name ?? 'Sunucu';
  return interaction.update({ components: [ui.partnerPanel(updated, guildName)] });
}

const OFFER_COOLDOWN = 24 * 60 * 60 * 1000; // aynı sunucu günde en fazla bir teklif gönderebilir

// "Partnerlik Teklifi Gönder": kontroller geçerse metin formu açılır
async function handlePanelOffer(interaction) {
  const { entry, error } = panelAccess(interaction, interaction.customId.slice(ui.IDS.panelOffer.length + 1));
  if (error) return replyError(interaction, error);
  if (store.pendingOf(entry.guildId, interaction.user.id)) {
    return replyError(interaction, 'Zaten bekleyen bir partner talebin var.', 'Bir yetkili inceleyene kadar beklemen gerekiyor.');
  }
  if (Date.now() - (entry.lastOfferAt ?? 0) < OFFER_COOLDOWN) {
    return replyError(interaction, 'Bugün zaten bir teklif gönderdin.', 'Yeni bir teklif için 24 saat beklemelisin.');
  }
  return interaction.showModal(ui.panelOfferModal(entry.id));
}

// Form gönderilince teklif, oto partner talebiyle aynı yoldan yetkili incelemesine gider (şartlar daha önce kabul edilmediyse önce şartlar sorulur)
async function handlePanelOfferSubmit(interaction) {
  const { entry, error } = panelAccess(interaction, interaction.customId.slice(ui.IDS.panelOfferModal.length + 1));
  if (error) return replyError(interaction, error);
  if (store.pendingOf(entry.guildId, interaction.user.id)) return replyError(interaction, 'Zaten bekleyen bir partner talebin var.');

  const adText = interaction.fields.getTextInputValue(ui.IDS.adText).trim();
  if (!hasDiscordInviteLink(adText)) {
    return replyError(interaction, 'Partner metni Discord invite linki içermeli.', 'discord.gg/... formatında bir link ekle.');
  }

  const number = store.nextRequestNumber(entry.guildId);
  const alreadyAccepted = store.hasAcceptedTerms(interaction.user.id);
  const request = store.createRequest({
    id: `${entry.guildId}-${number}`,
    number,
    guildId: entry.guildId,
    requesterId: interaction.user.id,
    serverId: entry.serverId,
    text: adText,
    status: alreadyAccepted ? 'pending' : 'awaiting_terms',
    source: 'oto',
    renewalOf: entry.id,
    createdAt: Date.now(),
    decidedBy: null,
    decidedAt: null,
  });
  store.updateTrusted(entry.id, { lastOfferAt: Date.now() });

  if (!alreadyAccepted) {
    const sent = await interaction.user.send({ components: [ui.termsDm(`${ui.IDS.termsAccept}:${request.id}`)], flags: core.CV2 }).catch(() => null);
    if (!sent) {
      store.deleteRequest(request.id);
      return replyError(interaction, 'Şartlar DM\'ine gönderilemedi.', 'DM\'lerin açık olduğundan emin ol ve tekrar dene.');
    }
    return respond(interaction, core.alert('Son bir adım kaldı!', 'Partner şartlarını DM\'inden onaylaman gerekiyor, onaylayınca teklifin yetkili incelemesine düşecek.', 'success'));
  }

  const guild = interaction.client.guilds.cache.get(request.guildId);
  const reviewChannel = guild && (await fetchTextChannel(guild, config.channels.review));
  await reviewChannel
    ?.send({ components: [ui.reviewCard(request)], flags: core.CV2, allowedMentions: { roles: [config.roles.staff] } })
    .catch((err) => console.error('[partner] İnceleme kanalına gönderilemedi:', err.message));
  return respond(interaction, core.alert('Teklifin incelemeye gönderildi!', 'Yetkilimiz onaylayınca metnin otomatik paylaşılır, sonucu buradan öğreneceksin.', 'success'));
}

// Güvenilir listeye eklenen partnerin yetkilisine bizim metni gönder (linksiz — karşı tarafın kartı güncelleniyor, yeni mesaj yok)
async function sendOurTextToContact(client, contactId, entry) {
  const contact = await client.users.fetch(contactId).catch(() => null);
  if (!contact) return;

  // Karşı tarafın linkini bulamıyoruz (güncelleme yapılıyor, yeni mesaj yok)
  // Bizim kanal linkini geç
  const guild = client.guilds.cache.get(entry.guildId);
  const postsChannel = guild && (await fetchTextChannel(guild, config.channels.posts));

  if (!postsChannel) return;

  const channelUrl = `https://discord.com/channels/${postsChannel.guildId}/${postsChannel.id}`;
  return contact.send({ components: [ui.ourTextDm(entry, null, channelUrl)], flags: core.CV2 }).catch(() => null);
}

// Elle paylaşılan metin için karşı sunucunun partner yetkilisi ID'si(leri) formla gönderilince
async function handleTrustedAddSubmit(interaction, requestId, messageId) {
  if (!isStaff(interaction, config.roles.staff)) return replyError(interaction, 'Bu işlemi sadece partner yetkilileri yapabilir.');

  const request = store.getRequest(requestId);
  if (!request) return replyError(interaction, 'Bu partner kaydı artık mevcut değil.');
  if (store.trustedBySource(interaction.guildId, requestId)) return replyError(interaction, 'Bu partner zaten güvenilir listede.');

  const contactIds = parseContactIds(interaction.fields.getTextInputValue(ui.IDS.contactId).trim());
  if (!contactIds.length) {
    return replyError(interaction, 'Geçerli en az bir kullanıcı ID\'si girmelisin.', 'ID genelde 17-19 haneli bir sayıdır, @etiket değil.');
  }

  const entry = createTrustedRecord(interaction, request, contactIds);

  const channel = await fetchTextChannel(interaction.guild, config.channels.posts);
  await channel?.messages
    .edit(messageId, { components: [ui.postCard(request, entry, contactIds.some((id) => store.isBanned(id)))], allowedMentions: { parse: [] } })
    .catch(() => {});
  await refreshTrustedPanel(interaction.client, interaction.guildId);

  // Karşı tarafın tüm yetkililerine bizim metni gönder
  for (const contactId of contactIds) {
    await sendOurTextToContact(interaction.client, contactId, entry);
    await sendPartnerPanel(interaction.client, contactId, entry);
  }

  return respond(interaction, core.alert('Partner güvenilir listeye eklendi.', null, 'success'));
}

// Paylaşım kartındaki "Yasaklıya Al": sadece partner lideri kullanabilir, yasaklanan güvenilir listedeyse oradan da çıkar
async function handleBan(interaction) {
  const requestId = interaction.customId.slice(ui.IDS.ban.length + 1);
  if (!isLead(interaction)) return replyError(interaction, 'Bu işlemi sadece partner lideri yapabilir.');

  const request = store.getRequest(requestId);
  if (!request) return replyError(interaction, 'Bu partner kaydı artık mevcut değil.');

  store.banUser(request.requesterId, interaction.user.id);
  const trustedEntry = store.trustedBySource(interaction.guildId, requestId);
  if (trustedEntry) store.removeTrusted(trustedEntry.id);

  await interaction.update({ components: [ui.postCard(request, null, true)], allowedMentions: { parse: [] } });
  if (trustedEntry) await refreshTrustedPanel(interaction.client, interaction.guildId);
}

// Paylaşım kartındaki "Partneri Sil": sadece gönderiyi kaldırır, kullanıcıyı yasaklamaz
async function handleDeletePost(interaction) {
  const requestId = interaction.customId.slice(ui.IDS.deletePost.length + 1);
  if (!isStaff(interaction, config.roles.staff)) return replyError(interaction, 'Bu işlemi sadece partner yetkilileri yapabilir.');

  store.updateRequest(requestId, { status: 'silindi' });
  await interaction.message.delete().catch(() => {});
  return respond(interaction, core.alert('Partner gönderisi silindi.', null, 'danger'));
}

const handleTrustedCommand = (interaction) => respond(interaction, ui.trustedList(store.trustedOf(interaction.guildId)), { ephemeral: false });

async function handleStaffStatusCommand(interaction) {
  if (!isStaff(interaction, config.roles.staff)) return replyError(interaction, 'Bu komutu sadece partner yetkilileri kullanabilir.');
  const durum = interaction.options.getString('durum', true);
  store.setStaffStatus(interaction.user.id, durum);
  return respond(interaction, core.alert(`Durumun **${durum === 'aktif' ? 'Aktif' : 'Meşgul'}** olarak ayarlandı.`, null, 'success'));
}

async function handleTrustedSelect(interaction) {
  const entry = store.getTrusted(interaction.values[0]);
  if (!entry) return replyError(interaction, 'Bu kayıt artık mevcut değil.');
  return respond(interaction, ui.trustedDetail(entry));
}

async function handleTrustedAction(interaction) {
  const rest = interaction.customId.slice(ui.IDS.trustedAction.length + 1);
  const sep = rest.lastIndexOf(':');
  const id = rest.slice(0, sep);
  const action = rest.slice(sep + 1);

  const entry = store.getTrusted(id);
  if (!entry) return replyError(interaction, 'Bu kayıt artık mevcut değil.');

  if (action === 'kaldir') {
    if (!isLead(interaction)) return replyError(interaction, 'Bu işlemi sadece partner lideri yapabilir.');
    store.removeTrusted(id);
    await refreshTrustedPanel(interaction.client, interaction.guildId);
    return respond(interaction, core.alert('Partner güvenilir listeden çıkarıldı.', null, 'danger'));
  }

  if (!isStaff(interaction, config.roles.staff)) return replyError(interaction, 'Bu işlemi sadece partner yetkilileri yapabilir.');

  if (store.getRenewalOffer(id)) {
    return replyError(interaction, 'Bu sunucu için zaten sürmekte olan bir teklif var.', 'Önce o süreç sonuçlanmalı.');
  }
  if (ui.isBusy(entry)) {
    return replyError(interaction, 'Bu partnerin yetkilisi şu an meşgul.', 'Müsait olduğunu bildirince ya da 7 gün sonra otomatik olarak tekrar teklif gönderebilirsin.');
  }

  const members = await fetchStaffMembers(interaction.guild);
  if (!members.length) return replyError(interaction, 'Şu an partner yetkilisi bulunamadı.', 'Lütfen daha sonra tekrar dene.');

  return respond(interaction, ui.staffSelect(id, members, store.staffStatus));
}

// Güvenilir kayda partner yetkilisi(leri) ekler/günceller (tam liste her seferinde yeniden girilir)
async function handleContactAdd(interaction) {
  const id = interaction.customId.slice(ui.IDS.contactAdd.length + 1);
  if (!isStaff(interaction, config.roles.staff)) return replyError(interaction, 'Bu işlemi sadece partner yetkilileri yapabilir.');
  const entry = store.getTrusted(id);
  if (!entry) return replyError(interaction, 'Bu kayıt artık mevcut değil.');
  return interaction.showModal(ui.contactModal(id, entry.contactIds));
}

async function handleContactAddSubmit(interaction) {
  const id = interaction.customId.slice(ui.IDS.contactAddModal.length + 1);
  if (!isStaff(interaction, config.roles.staff)) return replyError(interaction, 'Bu işlemi sadece partner yetkilileri yapabilir.');
  const entry = store.getTrusted(id);
  if (!entry) return replyError(interaction, 'Bu kayıt artık mevcut değil.');

  const contactIds = parseContactIds(interaction.fields.getTextInputValue(ui.IDS.contactId).trim());
  if (!contactIds.length) {
    return replyError(interaction, 'Geçerli en az bir kullanıcı ID\'si girmelisin.', 'ID genelde 17-19 haneli bir sayıdır, @etiket değil.');
  }

  const newContacts = contactIds.filter((contactId) => !entry.contactIds?.includes(contactId));
  const updated = store.updateTrusted(id, { contactIds });
  await refreshTrustedPanel(interaction.client, interaction.guildId);
  for (const contactId of newContacts) await sendPartnerPanel(interaction.client, contactId, updated);
  return respond(interaction, core.alert('Partner yetkilisi kaydedildi.', null, 'success'));
}

// Güvenilir kayıttaki tüm partner yetkililerini çıkarır; Teklifte Bulun artık kullanılamaz (iletişim kalmadığı için)
async function handleContactRemove(interaction) {
  const id = interaction.customId.slice(ui.IDS.contactRemove.length + 1);
  if (!isStaff(interaction, config.roles.staff)) return replyError(interaction, 'Bu işlemi sadece partner yetkilileri yapabilir.');
  const entry = store.getTrusted(id);
  if (!entry) return replyError(interaction, 'Bu kayıt artık mevcut değil.');

  store.updateTrusted(id, { contactIds: [] });
  await refreshTrustedPanel(interaction.client, interaction.guildId);
  return respond(interaction, core.alert('Partner yetkilileri kaldırıldı.', null, 'danger'));
}

// ── Teklifte bulunma (yenileme) akışı ───────────────────────────────────────────

// Partner yetkilisi rolüne sahip üyeler, yetkili seçim menüsünü doldurmak için
async function fetchStaffMembers(guild) {
  await guild.members.fetch().catch((err) => console.error('[partner] Üyeler çekilemedi:', err.message));
  const role = guild.roles.cache.get(config.roles.staff);
  return role ? [...role.members.values()] : [];
}

// Yetkili seçim menüsünden seçim yapılınca: seçilen yetkiliye DM gider, süreç atanmış olarak kaydedilir
async function handleRenewalAssign(interaction) {
  const trustedId = interaction.customId.slice(ui.IDS.renewalAssign.length + 1);
  const entry = store.getTrusted(trustedId);
  if (!entry) return replyError(interaction, 'Bu kayıt artık mevcut değil.');

  const assignedStaffId = interaction.values[0];
  await interaction.deferUpdate();

  const staffUser = await interaction.client.users.fetch(assignedStaffId).catch(() => null);
  const sent = await staffUser
    ?.send({ components: [ui.assignedOfferDm(entry, interaction.guild.name)], flags: core.CV2 })
    .catch(() => null);
  if (!sent) {
    return interaction.editReply({
      components: [core.alert('DM gönderilemedi.', 'Seçilen yetkilinin DM\'leri kapalı olabilir, başka birini dene.', 'danger')],
    });
  }

  store.setRenewalOffer(trustedId, {
    trustedId,
    guildId: interaction.guildId,
    assignedStaffId,
    startedBy: interaction.user.id,
    createdAt: Date.now(),
  });

  return interaction.editReply({
    components: [core.alert(`<@${assignedStaffId}> kişisine bildirim gönderildi.`, 'Kabul ederse metni inceleyip onaylayacak.', 'success')],
  });
}

// Atanan yetkilinin kabul-ettiği şu süreç için kontrol: offer var mı, mesajı alan gerçekten bu kişi mi
function renewalOfferError(interaction, trustedId) {
  const offer = store.getRenewalOffer(trustedId);
  if (!offer) return { error: 'Bu teklif artık geçerli değil.' };
  if (offer.assignedStaffId !== interaction.user.id) return { error: 'Bu teklif sana atanmamış.' };
  const entry = store.getTrusted(trustedId);
  if (!entry) return { error: 'Bu kayıt artık mevcut değil.' };
  return { offer, entry };
}

// Atanan yetkili "Kabul Ediyorum" deyince aynı DM, metni gösterip karar isteyen hale güncellenir
async function handleRenewalAssignedAccept(interaction) {
  const trustedId = interaction.customId.slice(ui.IDS.renewalAssignedAccept.length + 1);
  const { error, entry } = renewalOfferError(interaction, trustedId);
  if (error) return replyError(interaction, error);

  return interaction.update({ components: [ui.renewalReviewDm(entry)] });
}

async function handleRenewalEditButton(interaction) {
  const trustedId = interaction.customId.slice(ui.IDS.renewalEdit.length + 1);
  const { error, entry } = renewalOfferError(interaction, trustedId);
  if (error) return replyError(interaction, error);

  return interaction.showModal(ui.renewalEditModal(entry));
}

async function handleRenewalEditSubmit(interaction) {
  const trustedId = interaction.customId.slice(ui.IDS.renewalEditModal.length + 1);
  const { error } = renewalOfferError(interaction, trustedId);
  if (error) return replyError(interaction, error);

  const content = interaction.fields.getTextInputValue(ui.IDS.renewalEditInput).trim();
  const updated = store.updateTrusted(trustedId, { content });

  return interaction.update({ components: [ui.renewalReviewDm(updated)] });
}

async function handleRenewalCancelButton(interaction) {
  const trustedId = interaction.customId.slice(ui.IDS.renewalCancel.length + 1);
  const { error } = renewalOfferError(interaction, trustedId);
  if (error) return replyError(interaction, error);

  return interaction.showModal(ui.renewalCancelModal(trustedId));
}

async function handleRenewalCancelSubmit(interaction) {
  const trustedId = interaction.customId.slice(ui.IDS.renewalCancelModal.length + 1);
  const { error, offer, entry } = renewalOfferError(interaction, trustedId);
  if (error) return replyError(interaction, error);

  const reason = interaction.fields.getTextInputValue(ui.IDS.renewalCancelInput).trim();
  store.deleteRenewalOffer(trustedId);

  await interaction.update({ components: [core.alert('Teklif iptal edildi.', null, 'danger')] });

  const guild = interaction.client.guilds.cache.get(offer.guildId);
  const reviewChannel = guild && (await fetchTextChannel(guild, config.channels.review));
  await reviewChannel
    ?.send({
      components: [
        core.alert(
          `❌ **Teklifte Bulun iptal edildi** — Sunucu \`${entry.serverId ?? 'bilinmiyor'}\``,
          `Yetkili: <@${offer.assignedStaffId}>\nSebep: ${reason}`,
          'danger',
        ),
      ],
      flags: core.CV2,
      allowedMentions: { parse: [] },
    })
    .catch(() => {});
}

// Atanan yetkili onaylayınca: kayıtlı yetkililerden hiçbiri daha önce şart kabul etmediyse hepsine şartlar gider,
// içlerinden biri zaten kabul etmişse direkt o kişi adına paylaşılır
async function handleRenewalApprove(interaction) {
  const trustedId = interaction.customId.slice(ui.IDS.renewalApprove.length + 1);
  const { error, offer, entry } = renewalOfferError(interaction, trustedId);
  if (error) return replyError(interaction, error);

  await interaction.deferUpdate();

  const acceptedContactId = entry.contactIds.find((id) => store.hasAcceptedTerms(id));
  if (acceptedContactId) {
    const result = await postRenewal(interaction.client, entry, acceptedContactId);
    store.deleteRenewalOffer(trustedId);
    if (!result) {
      return interaction.editReply({ components: [core.alert('Sunucuya ulaşılamadı, paylaşılamadı.', null, 'danger')] });
    }
    await sendOurTextDm(interaction.client, acceptedContactId, result, entry, result.message.id);
    return interaction.editReply({ components: [core.alert('Onaylandı, partner metni paylaşıldı.', null, 'success')] });
  }

  const sends = await Promise.all(
    entry.contactIds.map(async (id) => {
      const user = await interaction.client.users.fetch(id).catch(() => null);
      return user?.send({ components: [ui.termsDm(`${ui.IDS.renewalTermsAccept}:${trustedId}`)], flags: core.CV2 }).catch(() => null);
    }),
  );
  if (!sends.some(Boolean)) {
    return interaction.editReply({ components: [core.alert('Karşı tarafa DM gönderilemedi.', 'DM\'leri kapalı olabilir.', 'danger')] });
  }

  return interaction.editReply({
    components: [core.alert('Onayladın!', 'Karşı taraf daha önce şartları kabul etmemiş, ona gönderildi. Kabul edince otomatik paylaşılacak.', 'success')],
  });
}

// Karşı taraftaki yetkililerden biri (daha önce hiç kabul etmemişse) renewalApprove'un gönderdiği şartları kabul edince
async function handleRenewalTermsAccept(interaction) {
  const trustedId = interaction.customId.slice(ui.IDS.renewalTermsAccept.length + 1);
  const entry = store.getTrusted(trustedId);
  if (!entry) return replyError(interaction, 'Bu teklif artık geçerli değil.');
  if (!store.getRenewalOffer(trustedId)) return replyError(interaction, 'Bu teklif zaten işlendi.');

  await interaction.deferUpdate();
  store.markTermsAccepted(interaction.user.id);

  const result = await postRenewal(interaction.client, entry, interaction.user.id);
  const offer = store.getRenewalOffer(trustedId);
  store.deleteRenewalOffer(trustedId);

  if (!result) {
    return interaction.editReply({ components: [core.alert('Sunucuya ulaşılamadı, paylaşılamadı.', null, 'danger')] });
  }

  await interaction.editReply({ components: [core.alert('Teşekkürler! Partner metnin paylaşıldı.', null, 'success')] });
  await sendOurTextDm(interaction.client, interaction.user.id, result, entry, result.message.id);

  if (offer) {
    const staffUser = await interaction.client.users.fetch(offer.assignedStaffId).catch(() => null);
    await staffUser?.send({ components: [core.alert('Karşı taraf şartları kabul etti, metin paylaşıldı.', null, 'success')], flags: core.CV2 }).catch(() => {});
  }
}

// Teklif onaylanıp paylaşılınca: isteği oluşturur, güvenilir kaydı günceller, paylaşım kanalına gönderir.
// contactId: işlemi hangi partner yetkilisi adına yapıyoruz (listede birden fazla olabilir, paylaşan kişi odur)
async function postRenewal(client, entry, contactId) {
  const guild = client.guilds.cache.get(entry.guildId);
  if (!guild) return null;

  const number = store.nextRequestNumber(entry.guildId);
  const request = store.createRequest({
    id: `${entry.guildId}-${number}`,
    number,
    guildId: entry.guildId,
    requesterId: contactId,
    serverId: entry.serverId,
    text: entry.content,
    status: 'approved',
    source: 'teklif',
    createdAt: Date.now(),
    decidedBy: null,
    decidedAt: Date.now(),
  });

  const updatedEntry = store.updateTrusted(entry.id, { addedAt: Date.now(), sourceRequestId: request.id });

  const postsChannel = await fetchTextChannel(guild, config.channels.posts);
  const message = await postsChannel
    ?.send({
      components: [ui.postCard(request, updatedEntry, store.isBanned(contactId))],
      flags: core.CV2,
      allowedMentions: { parse: [] },
    })
    .catch((err) => {
      console.error('[partner] Teklif sonrası paylaşılamadı:', err.message);
      return null;
    });
  await refreshTrustedPanel(client, entry.guildId);

  return message ? { message, channel: postsChannel } : null;
}

// Paylaşımdan sonra bizim tanıtım metnimiz karşı tarafa gider, her bölümün altında kendi mesajına giden buton
async function sendOurTextDm(client, contactId, { message, channel }, entry, partnerMessageId) {
  const contact = await client.users.fetch(contactId).catch(() => null);
  if (!contact) return;

  const ourJumpUrl = core.messageUrl(channel.guildId, channel.id, message.id);

  // Karşı tarafın metninin paylaşıldığı mesajın linkini bul
  let partnerJumpUrl = null;
  if (partnerMessageId && channel) {
    partnerJumpUrl = core.messageUrl(channel.guildId, channel.id, partnerMessageId);
  }

  await contact.send({ components: [ui.ourTextDm(entry, partnerJumpUrl, ourJumpUrl)], flags: core.CV2 }).catch(() => {});
}

// ── Paylaşım kanalında @everyone/@here'in gerçekten çalışmasını engelleyen izin ─────────────────────────────

async function syncPostsChannelPermissions(guild) {
  if (!config.channels.posts) return;
  const channel = await fetchTextChannel(guild, config.channels.posts);
  if (!channel) return;
  await channel.permissionOverwrites
    .edit(guild.roles.everyone, { MentionEveryone: false }, { reason: 'Partner kanalında @everyone/@here engellendi' })
    .catch((err) => console.error('[partner] Paylaşım kanalı izinleri ayarlanamadı:', err.message));
}

function handleReady(client) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;
  syncPostsChannelPermissions(guild).catch((err) => console.error('[partner] Hazırlık hatası:', err.message));
  refreshTrustedPanel(client, guild.id).catch((err) => console.error('[partner] Güvenilir partnerler paneli güncellenemedi:', err.message));
}

module.exports = {
  name: 'partner',
  commands,
  help: {
    category: ['partner', 'Partner'],
    access: {
      'guvenilir-partnerler': 'Herkes görebilir, işlemler partner yetkilileri için.',
      'partner-musaitlik': 'Partner yetkilileri',
    },
  },
  slash: { 'guvenilir-partnerler': handleTrustedCommand, 'partner-musaitlik': handleStaffStatusCommand },
  prefixed: [
    [ui.IDS.start, handleStartButton],
    [ui.IDS.startBan, handleStartBan],
    [ui.IDS.startBanModal, handleStartBanSubmit],
    [ui.IDS.termsAccept, handleInitialTermsAccept],
    [ui.IDS.modal, handleModalSubmit],
    [ui.IDS.review, handleReviewDecision],
    [ui.IDS.trustedAdd, handleTrustedAdd],
    [ui.IDS.ban, handleBan],
    [ui.IDS.deletePost, handleDeletePost],
    [ui.IDS.trustedSelect, handleTrustedSelect],
    [ui.IDS.trustedAction, handleTrustedAction],
    [ui.IDS.contactAdd, handleContactAdd],
    [ui.IDS.contactAddModal, handleContactAddSubmit],
    [ui.IDS.contactRemove, handleContactRemove],
    [ui.IDS.renewalAssign, handleRenewalAssign],
    [ui.IDS.renewalAssignedAccept, handleRenewalAssignedAccept],
    [ui.IDS.renewalApprove, handleRenewalApprove],
    [ui.IDS.renewalEdit, handleRenewalEditButton],
    [ui.IDS.renewalEditModal, handleRenewalEditSubmit],
    [ui.IDS.renewalCancel, handleRenewalCancelButton],
    [ui.IDS.renewalCancelModal, handleRenewalCancelSubmit],
    [ui.IDS.renewalTermsAccept, handleRenewalTermsAccept],
    [ui.IDS.panelStatus, handlePanelStatus],
    [ui.IDS.panelOffer, handlePanelOffer],
    [ui.IDS.panelOfferModal, handlePanelOfferSubmit],
  ],
  events: {
    [Events.ClientReady]: handleReady,
    [Events.MessageCreate]: handleMessageCreate,
  },
};
