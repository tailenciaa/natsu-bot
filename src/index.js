// Botun girişi: Discord'a bağlanır, sistemlerin komutlarını yükler ve gelen etkileşimleri ilgili sisteme yönlendirir.
// Sistemlerin kendisi src/systems altında, her biri ayrı klasörde.
require('./core/logger');
const { Client, Events, GatewayIntentBits, Partials } = require('discord.js');
const { guildId } = require('./core/config');
const ui = require('./core/ui');
const { respond, replyError } = require('./core/helpers');
const systems = require('./systems');
// Sıralama ve haftalık aktiflik verileri birikmiş yazmalarla kaydedilir (debounce); bot kapanırken bunlar
// kaybolmasın diye kapanışta hemen diske yazılır
const siralamaStore = require('./systems/siralama/store');
const aktifStore = require('./systems/aktif/store');
const saygiStore = require('./systems/saygi/store');

const UNKNOWN_INTERACTION = 10062;
const ALREADY_ACKNOWLEDGED = 40060;

const token = process.env.TOKEN?.trim();
if (!token || token === 'BOT_TOKENINI_BURAYA_YAZ') {
  console.error('[hata] .env dosyasına bot tokenini yazmalısın: TOKEN=...');
  process.exit(1);
}
if (!guildId) {
  console.error('[hata] .env dosyasına sunucu ID\'sini yazmalısın: GUILD_ID=...');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    // Oto rol için üye katılma olayları (Developer Portal'da "Server Members Intent" açık olmalı)
    GatewayIntentBits.GuildMembers,
    // Başvuru görüşmelerinde yetkilinin hangi ses kanalında olduğunu görmek için
    GatewayIntentBits.GuildVoiceStates,
    // Konuşma kayıtlarında mesaj içeriklerini okuyabilmek için gerekli
    GatewayIntentBits.MessageContent,
    // Log sistemi için: yasaklama olayları, emoji değişiklikleri ve davet olayları (üçü de ayrıcalıklı intent değil)
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildExpressions,
    GatewayIntentBits.GuildInvites,
    // AutoMod engellemeleri ve kural değişiklikleri için
    GatewayIntentBits.AutoModerationExecution,
    GatewayIntentBits.AutoModerationConfiguration,
  ],
  // Bot açılmadan önce atılmış (önbellekte olmayan) mesajların silinme/düzenlenme olayları da log sistemine ulaşsın
  partials: [Partials.Message],
});
// Her sistem kendi olay dinleyicisini eklediği için varsayılan 10 sınırı sistem sayısı arttıkça aşılıyor
client.setMaxListeners(50);

// Tüm sistemlerin komut ve işleyicileri tek tabloda toplanır
const commands = systems.flatMap((s) => s.commands ?? []).map((c) => c.toJSON());
const slashHandlers = Object.assign({}, ...systems.map((s) => s.slash));
const buttonHandlers = Object.assign({}, ...systems.map((s) => s.buttons));
const modalHandlers = Object.assign({}, ...systems.map((s) => s.modals));
const prefixedHandlers = systems.flatMap((s) => s.prefixed ?? []);

// Komutlar sadece botun sunucusuna kaydedilir, böylece anında görünür.
// Değişmediyse tekrar gönderilmez; izleme modunda her yeniden başlatmada Discord'un hız sınırına takılmamak için.
async function registerCommands(guild) {
  try {
    const existing = await guild.commands.fetch();
    const upToDate =
      existing.size === commands.length &&
      commands.every((command) => existing.find((c) => c.name === command.name)?.equals(command));
    if (!upToDate) await guild.commands.set(commands);
    console.log('[bot] Slash komutları yüklendi.');
  } catch (err) {
    console.error('[komut] Komutlar yüklenemedi:', err.message);
  }
}

async function route(interaction) {
  // Önekli ID'ler (önek:veri) önce kontrol edilir; değerlendirme butonları DM'de de çalışır
  if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
    const match = prefixedHandlers.find(([prefix]) => interaction.customId.startsWith(`${prefix}:`));
    if (match) return match[1](interaction);
  }

  if (interaction.guildId !== guildId) return;

  // Sağ tık (uygulama) komutları da ada göre aynı tablodan işlenir
  if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
    return slashHandlers[interaction.commandName]?.(interaction);
  }
  if (interaction.isButton() && buttonHandlers[interaction.customId]) return buttonHandlers[interaction.customId](interaction);
  if (interaction.isModalSubmit() && modalHandlers[interaction.customId]) return modalHandlers[interaction.customId](interaction);

  // Hiçbir işleyici bulunamadı (kaldırılmış bir özelliğin eski mesajındaki buton gibi): kullanıcı boş yere beklemesin
  if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
    return respond(interaction, ui.alert('Bu işlem artık kullanılamıyor.', 'Mesaj eski olabilir; ilgili paneli ya da komutu yeniden kullanabilirsin.', 'warning'));
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`[bot] ${c.user.tag} olarak giriş yapıldı.`);
  const guild = c.guilds.cache.get(guildId);
  if (!guild) return console.error(`[hata] Bot .env dosyasındaki GUILD_ID (${guildId}) sunucusunda değil.`);
  registerCommands(guild).catch((err) => console.error('[komut]', err));
});

// Sistemlerin dinlediği Discord olayları
for (const system of systems) {
  for (const [event, handler] of Object.entries(system.events ?? {})) {
    // async sarmalayıcı: işleyici senkron fırlatsa da hata yakalanır
    client.on(event, async (...args) => {
      try {
        await handler(...args);
      } catch (err) {
        console.error(`[${system.name}] ${event} hatası:`, err);
      }
    });
  }
}

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    await route(interaction);
  } catch (err) {
    const name = interaction.customId ?? interaction.commandName;
    // Discord'a 3 saniye içinde yanıt verilemediyse etkileşim geçersiz olur, cevap vermeye çalışmanın anlamı yok
    if (err.code === UNKNOWN_INTERACTION) {
      return console.error(`[etkilesim] "${name}" etkileşimine zamanında yanıt verilemedi (bağlantı yavaş olabilir).`);
    }
    // Etkileşim zaten yanıtlanmışsa (ör. cevap verildikten sonra açılmaya çalışılan form) bir hata mesajı daha göndermeyi denemek
    // aynı hatayı tekrarlar; sadece kayda geçer
    if (err.code === ALREADY_ACKNOWLEDGED || err.code === 'InteractionAlreadyReplied') {
      return console.error(`[etkilesim] "${name}" etkileşimi zaten yanıtlanmıştı:`, err.message);
    }
    console.error(`[etkilesim] "${name}" hatası:`, err);
    if (interaction.isRepliable()) {
      await replyError(interaction, 'İşlem tamamlanamadı.', 'Birkaç saniye sonra tekrar dene; sorun sürerse bir yetkiliye haber ver.').catch(() => {});
    }
  }
});

// Dinleyicisi olmayan "error" olayı süreci çökertir; bağlantı sorunları sadece kayda geçsin
client.on(Events.Error, (err) => console.error('[bot] İstemci hatası:', err));
client.on(Events.ShardDisconnect, (event) => console.error(`[bot] Discord bağlantısı koptu (kod ${event.code}).`));
client.on(Events.ShardReconnecting, () => console.log('[bot] Discord bağlantısı yeniden kuruluyor...'));
client.on(Events.ShardResume, () => console.log('[bot] Discord bağlantısı yeniden kuruldu.'));

process.on('unhandledRejection', (err) => console.error('[hata]', err));
// Beklenmeyen bir hata botu kapatmasın, kayda geçip çalışmaya devam etsin
process.on('uncaughtException', (err) => console.error('[hata] Yakalanmamış hata:', err));

// Bot kapanırken (Ctrl+C, servis yeniden başlatma vb.) bekleyen birikmiş kayıtları diske yazar
let closing = false;
async function shutdown(signal) {
  if (closing) return; // art arda gelen sinyaller kapanışı iki kez çalıştırmasın
  closing = true;
  console.log(`[bot] ${signal} alındı, kapanmadan önce bekleyen veriler kaydediliyor...`);
  siralamaStore.flush();
  aktifStore.flush();
  saygiStore.flush();
  await require('./core/db').close();
  await client.destroy();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

client.login(token).catch((err) => {
  if (/disallowed intents/i.test(err.message)) {
    console.error(
      '[hata] Discord Developer Portal > Bot sekmesinden "SERVER MEMBERS INTENT" ve "MESSAGE CONTENT INTENT" seçeneklerini açman gerekiyor.',
    );
  } else if (/invalid token|TokenInvalid/i.test(`${err.code} ${err.message}`)) {
    console.error('[hata] Token geçersiz. .env dosyasındaki TOKEN değerini kontrol et.');
  } else {
    console.error('[hata] Giriş yapılamadı:', err);
  }
  process.exit(1);
});
