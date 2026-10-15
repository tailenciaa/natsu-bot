const fs = require('fs');
const t = fs.readFileSync('.env', 'utf8').match(/TOKEN=(.*)/)[1].trim();
const H = { headers: { Authorization: `Bot ${t}` } };
const ids = {
  '1538944989432774746': 'yetkili kurallari (6)',
  '1538945093921153206': 'yetkili bilgilendirme (6)',
  '1558968836420665615': 'kazu coin (6)',
  '1538540261737758850': 'etkinlik kurallari (6)',
  '1538538532958638160': 'etkinlik bilgilendirme (7)',
  '1538541309634285678': 'oyun kurallari (5)',
  '1538541416387448944': '5v5 bilgilendirme (5)',
  '1538544294388961300': 'sorun cozme bilgi (6)',
  '1538943458864005150': 'partner sartlari (6)',
  '1538943528225476810': 'partner metni (4)',
};
(async () => {
  const me = await fetch('https://discord.com/api/v10/users/@me', H).then((r) => r.json());
  console.log('bot:', me.username, me.id, new Date().toISOString());
  for (const [id, label] of Object.entries(ids)) {
    const msgs = await fetch(`https://discord.com/api/v10/channels/${id}/messages?limit=100`, H).then((r) => r.json());
    if (!Array.isArray(msgs)) {
      console.log(label.padEnd(30), 'HATA', JSON.stringify(msgs).slice(0, 140));
      continue;
    }
    const bot = msgs.filter((m) => m.author?.id === me.id);
    console.log(`${label.padEnd(30)} bot: ${String(bot.length).padStart(3)}  en yeni: ${bot[0]?.timestamp ?? '-'}  kanaldaki toplam: ${msgs.length}`);
  }
})();
