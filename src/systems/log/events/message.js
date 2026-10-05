// Mesaj logları: silinen, toplu silinen ve düzenlenen mesajlar.
const { AuditLogEvent } = require('discord.js');
const core = require('../../../core/ui');
const audit = require('../audit');
const config = require('../config');
const engine = require('../engine');
const ui = require('../ui');

const MAX_LEN = 500;
const stamp = (ms) => `<t:${Math.floor(ms / 1000)}:D> <t:${Math.floor(ms / 1000)}:T>`; // tarih + saniyeli saat
const trim = (value) => (value && value.length > MAX_LEN ? `${value.slice(0, MAX_LEN)}…` : value);

// Botun kendi log/panel mesajlarını loglamaya çalışıp döngüye girmesin
const ignorable = (channel) => channel?.id === config.channels.main || channel?.id === config.channels.panel;

// Mesajı yazan dışında biri sildiyse (yetkili) denetim kaydından bulunur; kendi mesajını silenin kaydı tutulmaz
async function deletedBy(message) {
  if (!message.author) return null;
  const line = await audit.by(
    message.guild,
    AuditLogEvent.MessageDelete,
    message.author.id,
    (e) => e.extra?.channel?.id === message.channelId,
  );
  return line ? line.replace('**Yetkili:**', '**Silen yetkili:**') : null;
}

async function handleMessageDelete(message) {
  if (!message.guild || ignorable(message.channel)) return;
  if (message.author?.id === message.client.user.id) return; // botun kendi mesajları (panel yenileme vb.) loglanmaz

  const content = message.partial ? null : message.content;
  const by = await deletedBy(message);
  await engine.send(
    message.client,
    'mesaj',
    ui.entry('danger', 'Mesaj Silindi', [
      `**Kullanıcı:** ${message.author ? `<@${message.author.id}>` : 'bilinmiyor'}`,
      `**Kanal:** <#${message.channelId}>`,
      content ? `**İçerik:**\n${core.quote(trim(content))}` : '-# İçerik önbellekte yoktu, gösterilemiyor.',
      message.attachments?.size ? `**Ekler:** ${message.attachments.map((a) => a.name).join(', ')}` : null,
      by,
    ], [
      `**Mesaj sahibi:** ${message.author ? `<@${message.author.id}>` : 'bilinmiyor'}`,
      `**Gönderildiği zaman:** ${stamp(message.createdTimestamp)}`,
      `**Silindiği zaman:** ${stamp(Date.now())}`,
      `**Kanal:** <#${message.channelId}>`,
      `**Mesaj ID:** \`${message.id}\``,
      content ? `**İçerik:**\n${core.quote(content.slice(0, 1200))}` : '-# İçerik önbellekte yoktu, gösterilemiyor.',
      message.attachments?.size ? `**Ekler:** ${message.attachments.map((a) => a.url).join('\n')}` : null,
      by,
    ]),
  );
}

async function handleMessageUpdate(oldMessage, newMessage) {
  if (!newMessage.guild || ignorable(newMessage.channel)) return;
  if (newMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return; // embed önizlemesi gibi içerik dışı güncellemeler atlanır

  await engine.send(
    newMessage.client,
    'mesaj',
    ui.entry('warning', 'Mesaj Düzenlendi', [
      `**Kullanıcı:** <@${newMessage.author.id}>`,
      `**Kanal:** <#${newMessage.channelId}>`,
      `**Mesaj:** [Mesaja git](${newMessage.url})`,
      `**Önceki:**\n${core.quote(trim(oldMessage.content || '(boş)'))}`,
      `**Yeni:**\n${core.quote(trim(newMessage.content || '(boş)'))}`,
    ], [
      `**Mesaj sahibi:** <@${newMessage.author.id}>`,
      `**Gönderildiği zaman:** ${stamp(newMessage.createdTimestamp)}`,
      `**Düzenlendiği zaman:** ${stamp(Date.now())}`,
      `**Kanal:** <#${newMessage.channelId}>`,
      `**Mesaj:** [Mesaja git](${newMessage.url})`,
      `**Mesaj ID:** \`${newMessage.id}\``,
      `**Önceki:**\n${core.quote((oldMessage.content || '(boş)').slice(0, 700))}`,
      `**Yeni:**\n${core.quote((newMessage.content || '(boş)').slice(0, 700))}`,
    ]),
  );
}

async function handleBulkDelete(messages) {
  const first = messages.first();
  if (!first?.guild || ignorable(first.channel)) return;

  await engine.send(
    first.client,
    'mesaj',
    ui.entry('danger', 'Toplu Mesaj Silme', [`**Kanal:** <#${first.channelId}>`, `**Silinen mesaj sayısı:** ${messages.size}`], bulkDetails(messages, first)),
  );
}

// Toplu silmenin detayı: silinme zamanı ve önbellekte bulunan mesajların sahibi, gönderilme saati ve içeriği
function bulkDetails(messages, first) {
  const list = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const rows = list.slice(0, 15).map((m) => {
    const time = `<t:${Math.floor(m.createdTimestamp / 1000)}:T>`;
    const body = m.partial || !m.content ? '(içerik yok)' : m.content.replace(/\s+/g, ' ').slice(0, 60);
    return `${time} ${m.author ? `<@${m.author.id}>` : 'bilinmiyor'}: ${body}`;
  });
  const authors = [...new Set(list.map((m) => m.author?.id).filter(Boolean))];
  return [
    `**Silindiği zaman:** ${stamp(Date.now())}`,
    `**Kanal:** <#${first.channelId}>`,
    `**Silinen mesaj sayısı:** ${messages.size}`,
    list.length ? `**En eski mesaj:** ${stamp(list[0].createdTimestamp)}\n**En yeni mesaj:** ${stamp(list.at(-1).createdTimestamp)}` : null,
    authors.length ? `**Mesaj sahipleri:** ${authors.slice(0, 10).map((id) => `<@${id}>`).join(', ')}${authors.length > 10 ? ` +${authors.length - 10}` : ''}` : null,
    rows.length ? `**Mesajlar:**\n${rows.join('\n')}${list.length > rows.length ? `\n-# +${list.length - rows.length} mesaj daha` : ''}` : null,
  ];
}

module.exports = { handleMessageDelete, handleMessageUpdate, handleBulkDelete };
