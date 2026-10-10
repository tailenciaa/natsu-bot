// Sunucu etiketi: üye profilinde sunucunun etiketini göstermeye başlayınca rol verilir ve kanalda etiketlenip
// teşekkür edilir; etiketi çıkarınca rol geri alınır. Bot kapalıyken takılan / çıkarılan etiketler açılışta
// sessizce (mesaj atmadan) rollere yansıtılır.
// Discord etiket değişikliğini üye güncellemesiyle bildirir; bunu yakalamak için üyeler açılışta önbelleğe alınır.
// Botun rolü verilecek rolün üstünde olmalı.
const { Events, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const core = require('../../core/ui');
const { guildId } = require('../../core/config');
const { fetchTextChannel, respond } = require('../../core/helpers');
const config = require('./config');
const store = require('./store');
const ui = require('./ui');

const commands = [
  new SlashCommandBuilder()
    .setName('etiket-onizleme')
    .setDescription('Sunucu etiketi teşekkür mesajının önizlemesini sadece sana gösterir.')
    .addUserOption((o) => o.setName('kullanici').setDescription('Mesajda gösterilecek üyeyi seçer, boş bırakırsan kendin görünürsün.'))
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
];

const HOUR = 60 * 60 * 1000;

const hasTag = (user) => Boolean(user?.primaryGuild?.identityEnabled && user.primaryGuild.identityGuildId === guildId);

// Üyenin rolünü etiket durumuna göre verir ya da alır; rol verildiyse true döner
async function syncRole(member) {
  if (member.user.bot) return false;
  const wearing = hasTag(member.user);
  const hasRole = member.roles.cache.has(config.roles.tag);
  if (wearing === hasRole) return false;

  const action = wearing
    ? member.roles.add(config.roles.tag, 'Sunucu etiketini taktı')
    : member.roles.remove(config.roles.tag, 'Sunucu etiketini çıkardı');
  return action.then(
    () => wearing,
    (err) => {
      console.error(`[etiket] ${member.user.username} kullanıcısının rolü güncellenemedi:`, err.message);
      return false;
    },
  );
}

// Etiketi yeni takan üyeye kanalda teşekkür eder; etiketi çıkarıp takarak kanalı doldurmasın diye bekleme süresi var
async function announce(member) {
  if (Date.now() - store.lastThanked(member.id) < config.announceCooldownHours * HOUR) return;
  // Kayıt await'ten önce yapılır: aynı anda gelen iki olay iki teşekkür mesajı göndermesin
  store.setThanked(member.id);
  const channel = await fetchTextChannel(member.guild, config.channels.announce);
  if (!channel) return console.error('[etiket] Duyuru kanalı bulunamadı.');

  await channel.send({ components: [ui.thanks(member.user)], flags: core.CV2, allowedMentions: { users: [member.id] } });
}

async function handleChange(member) {
  if (await syncRole(member)) await announce(member);
}

// /etiket-onizleme: seçilen (ya da kullanan) üye gerçekten etiket takmasa da örnek teşekkür mesajını gösterir
async function handlePreview(interaction) {
  const user = interaction.options.getUser('kullanici') ?? interaction.user;
  const previewUser = {
    id: user.id,
    displayAvatarURL: (opts) => user.displayAvatarURL(opts),
    primaryGuild: { tag: hasTag(user) ? user.primaryGuild.tag : 'ÖRNEK' },
  };
  // GİZLİ İSTİSNA: önizleme; asıl teşekkür kanala düşer, örnek sadece komutu kullanana görünür
  return respond(interaction, ui.thanks(previewUser), { ephemeral: true });
}

// Açılışta tüm üyeleri önbelleğe alır (sonraki etiket değişikliklerinin olay olarak gelmesi için) ve rolleri eşitler
async function handleReady(client) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;
  const members = await guild.members.fetch();
  for (const member of members.values()) await syncRole(member);
  console.log(`[etiket] Sunucu etiketini kullanan ${members.filter((m) => hasTag(m.user)).size} üye var.`);
}

// Etiket değişikliği kullanıcı güncellemesi olarak gelir; kullanıcının bu sunucudaki üyeliği üzerinden işlenir
async function handleUserUpdate(oldUser, newUser) {
  if (hasTag(oldUser) === hasTag(newUser)) return;
  const member = newUser.client.guilds.cache.get(guildId)?.members.cache.get(newUser.id);
  if (member) await handleChange(member);
}

module.exports = {
  name: 'etiket',
  commands,
  help: { category: ['yetki', 'Yetkili İşlemleri'], access: { 'etiket-onizleme': 'Yöneticiler' }, need: { 'etiket-onizleme': 'Yöneticiler' } },
  slash: { 'etiket-onizleme': handlePreview },
  events: {
    [Events.ClientReady]: handleReady,
    [Events.UserUpdate]: handleUserUpdate,
    // Etiketi takılı halde sunucuya (tekrar) katılan üye
    [Events.GuildMemberAdd]: (member) => (member.guild.id === guildId ? handleChange(member) : null),
  },
};
