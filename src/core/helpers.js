// Tüm sistemlerin ortak kullandığı etkileşim ve yetki yardımcıları
const { PermissionFlagsBits } = require('discord.js');
const { staffCommandChannel } = require('./config');
const ui = require('./ui');

// Etkileşimin durumuna göre doğru şekilde CV2 cevap verir.
// EV KURALI — botun mesajı KALICIDIR. Açılan her panel, kart, detay, sayfa ve makbuz kanalda herkese açık durur;
//   "üyenin kendi durumu" bunu değiştirmez (rozet/vitrin/mağaza/kapak sayfaları, görev ve cüzdan panelleri, talep ve
//   başvuru kartları, ceza/itiraz kartları hep açıktır). Yenilemede kaybolan geçici mesaj kabul edilmez.
//   GIZLI (`{ ephemeral: true }`) tek istisna: tek satırlık geri bildirim — hata, reddetme, uyarı ve form/onay
//   bildirimi (`replyError`, `core.alert(...)`); bunların kaydı zaten başka bir kartta durur, kanalda iz bırakmaz.
//   İkinci istisna: `sicil` — yetkili komut kanalı dışında kişiye özel kalır, çünkü ceza kaydı herkesin önüne
//   yazılacak bir şey değildir.
// Dikkat: görünürlük defer anında kilitlenir. `deferReply({ flags: core.CV2 })` ile açılmış bir akışın sonundaki
// `{ ephemeral: true }` cevap Discord tarafından gizli yapılamaz; o uyarı kanalda görünür. Buton/menü cevapları
// `followUp` ile gittiği için onların görünürlüğü defer'den bağımsızdır; slash komutlarında bayrağı defer'de ver.
// Dikkat: tam tersi de geçerli — `deferReply({ flags: core.EPHEMERAL_CV2 })` ile açılan akışın her cevabı
// `{ ephemeral: true }` olmak zorunda; bayraklar uyuşmazsa Discord mesajı/son düzenlemeyi reddeder.
// Butonlarda deferUpdate kullanıldığı için orijinal mesajın üzerine yazmamak adına followUp yapılır.
// Dikkat: deferReply edilmiş komut ya da deferUpdate edilmiş modal gönderimi (butona bağlı olmayan, deferred) ise cevap
// editReply ile verilir; yani modalın bağlı olduğu mesajı (varsa) cevabın yeni haliyle DEĞİŞTİRİR. Hata/onay bildirimini
// ayrı ve sadece kullanana görünen mesaj olarak göstermek istiyorsan önce deferUpdate yapma, ya da interaction.followUp kullan.
// followUp: true verilirse (ör. deferUpdate yapılmış modal gönderimi) cevap her zaman ayrı bir mesaj olarak gider, mevcut mesajı değiştirmez
async function respond(interaction, container, { ephemeral = false, allowedMentions = { parse: [] }, followUp = false } = {}) {
  // deferUpdate ile ertelenmiş modal gönderiminde (interaction.ephemeral hâlâ null; deferReply bunu true/false yapar) cevap,
  // modalın bağlı olduğu mesajın üstüne yazılmasın diye ayrı mesaj olarak gider
  const updatedByModal = interaction.isModalSubmit?.() && interaction.deferred && interaction.ephemeral === null;
  if (!followUp && !updatedByModal && interaction.deferred && !interaction.replied && !interaction.isMessageComponent()) {
    return interaction.editReply({ components: [container], flags: ephemeral ? ui.EPHEMERAL_CV2 : ui.CV2, allowedMentions });
  }
  const payload = { components: [container], flags: ephemeral ? ui.EPHEMERAL_CV2 : ui.CV2, allowedMentions };
  if (interaction.deferred || interaction.replied) return interaction.followUp(payload);
  return interaction.reply(payload);
}

// HATA/REDDETME: gizli mesajın kullanılabildiği tek ortak kapı
const replyError = (interaction, message, hint) => respond(interaction, ui.alert(message, hint, 'danger'), { ephemeral: true });

// AKIŞ İÇİ HATA: komut herkese açık ertelendiyse görünürlük artık değişmez (Discord bayrak değiştirmeyi reddeder),
// bu yüzden hata da kanalda görünür. Yalnızca `deferReply()` ile açık açılan akışların içinde kullanılır.
const replyFlowError = (interaction, message, hint) => respond(interaction, ui.alert(message, hint, 'danger'));

// Yöneticiler ya da verilen rollerden (tek rol ya da liste) birine sahip olanlar
function isStaff(interaction, roleIds) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  const roles = interaction.member?.roles;
  const wanted = [].concat(roleIds ?? []).filter(Boolean);
  if (!roles || !wanted.length) return false;
  return wanted.some((id) => (Array.isArray(roles) ? roles.includes(id) : roles.cache.has(id)));
}

async function fetchTextChannel(guild, channelId) {
  if (!guild || !channelId) return null;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  return channel?.isTextBased() ? channel : null;
}

// Görsel kartlarda kullanıcı etiketi (<@id>) işlenmez, kullanıcı adı yazılır. Önce önbelleğe bakılır
// (açılışta üye önbelleği doldurulur), yoksa tek istekle alınır; ulaşılamazsa null
function userName(guild, userId) {
  const cached = guild?.members?.cache?.get(userId);
  if (cached) return Promise.resolve(cached.user.username);
  if (!guild) return Promise.resolve(null);
  return guild.members.fetch(userId).then((member) => member?.user?.username ?? null).catch(() => null);
}

// Herkese açık gönderilen menülerin (yardım, sicil) butonlarını sadece komutu kullanan kişi kullanabilir,
// başkası basınca menü herkesin önünde değişmesin diye
function isMenuOwner(interaction) {
  const ownerId = interaction.message?.interactionMetadata?.user?.id;
  return !ownerId || ownerId === interaction.user.id;
}

// Menü sahibi olmayan biri butona/menüye basınca verilen ortak cevap
const menuOwnerError = (interaction) =>
  replyError(interaction, 'Bu menüyü sadece komutu kullanan kişi gezebilir.', 'Kendi menün için komutu sen de kullanabilirsin.');

// Yetkili komutları sadece yetkili komut kanalında kullanılır
const inStaffChannel = (interaction) => !staffCommandChannel || interaction.channelId === staffCommandChannel;
const staffChannelError = (interaction) =>
  replyError(interaction, `Bu komut sadece <#${staffCommandChannel}> kanalında kullanılabilir.`);

// Üyenin hâlâ sunucuda olup olmadığı: üye önbelleği büyük ölçüde doluysa (açılışta fetch edilir) önbelleğe bakılır,
// değilse (fetch başarısız olduysa) kimse yanlışlıkla elenmesin diye true döner
function stillMember(guild, userId) {
  return guild.members.cache.size < guild.memberCount * 0.9 || guild.members.cache.has(userId);
}

module.exports = { respond, replyError, replyFlowError, isStaff, fetchTextChannel, stillMember, userName, isMenuOwner, menuOwnerError, inStaffChannel, staffChannelError };
