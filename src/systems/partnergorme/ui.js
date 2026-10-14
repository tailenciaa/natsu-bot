// Partner görme sisteminin tek mesajı: butonuna basınca partner kanallarını görme rolü verilir,
// rolü olan aynı butona basınca rolü alınır (panel ortak bir mesaj olduğu için etiket duruma göre değişmez)
const { ButtonStyle } = require('discord.js');
const { panel: standardPanel } = require('../../core/ui');
const { botName } = require('../../core/config');
const config = require('./config');

const IDS = {
  ver: 'partnergorme:ver',
};

const panel = () =>
  standardPanel({
    title: `${botName} Partner Görme`,
    sub: 'Partner sunucuların duyuru ve paylaşım kanallarını görmek için **Rol Al / Bırak** butonuna basman yeterli; rolün anında verilir ve kanallar sana açılır. Artık görmek istemiyorsan aynı butona tekrar bas, rolün alınır.',
    button: { id: IDS.ver, label: 'Rol Al / Bırak', style: ButtonStyle.Success },
    image: config.banner,
  });

module.exports = { IDS, panel };
