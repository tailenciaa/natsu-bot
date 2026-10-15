const ids = [
  '1538944989432774746', '1538945093921153206', '1558968836420665615', '1538540261737758850',
  '1538538532958638160', '1538541309634285678', '1538541416387448944', '1538544294388961300',
  '1538943458864005150', '1538943528225476810',
];
const BASE = 'https://discord.com/api/v10';
const auth = { headers: { Authorization: `Bot ${process.env.TOKEN}` } };

(async () => {
  for (const id of ids) {
    const ch = await fetch(`${BASE}/channels/${id}`, auth).then((r) => r.json());
    const cat = ch.parent_id ? await fetch(`${BASE}/channels/${ch.parent_id}`, auth).then((r) => r.json()).catch(() => null) : null;
    console.log(`\n### ${id}  "${ch.name}"  [${ch.type}]  kategori: ${cat?.name ?? '-'}`);
    console.log(`    topic: ${ch.topic ?? '(yok)'}`);
    const msgs = await fetch(`${BASE}/channels/${id}/messages?limit=12`, auth).then((r) => r.json());
    if (!Array.isArray(msgs)) return console.log('    mesaj alınamadı', msgs);
    for (const m of msgs.slice(0, 8)) {
      const text = (m.content || '').replace(/\s+/g, ' ').slice(0, 110);
      const comp = m.components?.length ? ` +bileşen:${m.components.map((c) => c.type).join(',')}` : '';
      console.log(`    - (${m.author?.username}) ${m.timestamp.slice(5, 16)} ${text}${comp}`);
    }
  }
})();
