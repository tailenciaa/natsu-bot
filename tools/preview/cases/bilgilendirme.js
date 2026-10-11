// Bilgilendirme paneli (src/systems/bilgilendirme/ui.js): #bilgilendirme kanalına giden bölümlerin her biri ayrı mesaj.
// Metin config.js'te durduğu için bu dosya panelin bütün yazısını lint'ten geçirir.
module.exports = ({ src }) => {
  const d = src('systems/bilgilendirme/ui');
  const config = src('systems/bilgilendirme/config');

  const containers = d.messages();
  const noMentions = { allowedMentions: { parse: [] } };

  return config.sections.map((section, index) => ({
    id: `bolum-${index + 1}`,
    title: section.title,
    where: '#bilgilendirme kanalı, bot açılınca sırayla gönderilir',
    visibility: 'panel',
    kind: 'message',
    build: () => ({ components: [containers[index]], ...noMentions }),
  }));
};
