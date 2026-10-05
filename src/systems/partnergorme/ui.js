// Partner görme sisteminin tek mesajı: butonuna basınca partner kanallarını görme rolünü veren panel.
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
    sub: 'Partner sunucuların duyuru ve paylaşım kanallarını görmek için **Partner Rolü Al** butonuna basman yeterli. Rolün anında verilir ve kanallar sana açılır.',
    button: { id: IDS.ver, label: 'Partner Rolü Al', style: ButtonStyle.Success },
    image: config.banner,
  });

module.exports = { IDS, panel };
