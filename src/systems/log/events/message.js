// Mesaj logları: silinen, toplu silinen ve düzenlenen mesajlar.
const core = require('../../../core/ui');
const config = require('../config');
const engine = require('../engine');
const ui = require('../ui');

const MAX_LEN = 500;
const trim = (value) => (value && value.length > MAX_LEN ? `${value.slice(0, MAX_LEN)}…` : value);

// Botun kendi log/panel mesajlarını loglamaya çalışıp döngüye girmesin
const ignorable = (channel) => channel?.id === config.channels.main || channel?.id === config.channels.panel;

async function handleMessageDelete(message) {
  if (!message.guild || ignorable(message.channel)) return;

  const content = message.partial ? null : message.content;
  await engine.send(
    message.client,
    'mesaj',
    ui.entry('danger', 'Mesaj Silindi', [
      `**Kullanıcı:** ${message.author ? `<@${message.author.id}>` : 'bilinmiyor'}`,
      `**Kanal:** <#${message.channelId}>`,
      content ? `**İçerik:**\n${core.quote(trim(content))}` : '-# İçerik önbellekte yoktu, gösterilemiyor.',
      message.attachments?.size ? `**Ekler:** ${message.attachments.map((a) => a.name).join(', ')}` : null,
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
      `**Kanal:** <#${newMessage.channelId}> • [Mesaja git](${newMessage.url})`,
      `**Önceki:**\n${core.quote(trim(oldMessage.content || '(boş)'))}`,
      `**Yeni:**\n${core.quote(trim(newMessage.content || '(boş)'))}`,
    ]),
  );
}

async function handleBulkDelete(messages) {
  const first = messages.first();
  if (!first?.guild || ignorable(first.channel)) return;

  await engine.send(
    first.client,
    'mesaj',
    ui.entry('danger', 'Toplu Mesaj Silme', [`**Kanal:** <#${first.channelId}>`, `**Silinen mesaj sayısı:** ${messages.size}`]),
  );
}

module.exports = { handleMessageDelete, handleMessageUpdate, handleBulkDelete };
