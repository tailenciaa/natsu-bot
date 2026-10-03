// Kapanan talebin konuşma kaydını (.txt) hazırlar, log kanalına gönderilir
const { pad } = require('../../core/ui');

const MAX_MESSAGES = 5000;

const formatDate = (ms) => new Date(ms).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });

async function fetchAllMessages(channel) {
  const messages = [];
  let before;

  while (messages.length < MAX_MESSAGES) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (batch.size === 0) break;
    messages.push(...batch.values());
    before = batch.last().id;
    if (batch.size < 100) break;
  }

  return messages.reverse();
}

// Components V2 mesajlarındaki metinleri (text display) düz yazıya çevirir
function componentText(components) {
  const parts = [];
  const walk = (list) => {
    for (const component of list ?? []) {
      const data = typeof component.toJSON === 'function' ? component.toJSON() : component;
      if (typeof data.content === 'string') parts.push(data.content);
      if (Array.isArray(data.components)) walk(data.components);
    }
  };
  walk(components);
  return parts.join('\n');
}

async function buildTranscript(channel, ticket, owner) {
  const messages = await fetchAllMessages(channel);

  const lines = [
    `Destek Talebi #${pad(ticket.number)}`,
    `Sunucu       : ${channel.guild.name}`,
    `Kanal        : #${channel.name}`,
    `Talep Sahibi : ${owner ? owner.username : 'Bilinmiyor'} (${ticket.ownerId})`,
    `Açılış       : ${formatDate(ticket.createdAt)}`,
    `Kapanış      : ${formatDate(Date.now())}`,
    `Konu         : ${ticket.reason.replace(/\n/g, ' ')}`,
    `Kapatma      : ${ticket.closeReason?.label ?? '-'}${ticket.closeReason?.note ? ` (${ticket.closeReason.note.replace(/\n/g, ' ')})` : ''}`,
    '='.repeat(70),
    '',
  ];

  for (const message of messages) {
    const body = [message.content, componentText(message.components)]
      .filter(Boolean)
      .join('\n')
      .split('\n')
      .join('\n    ');
    const attachments = message.attachments.map((a) => `\n    [Ek] ${a.name}: ${a.url}`).join('');
    const author = `${message.author.username}${message.author.bot ? ' [BOT]' : ''}`;
    lines.push(`[${formatDate(message.createdTimestamp)}] ${author}: ${body}${attachments}`);
  }

  // BOM: Windows'ta Türkçe karakterlerin doğru görünmesi için
  return Buffer.from(`﻿${lines.join('\n')}\n`, 'utf8');
}

module.exports = { buildTranscript };
