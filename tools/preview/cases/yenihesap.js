// Yeni hesap sistemi (src/systems/yenihesap/ui.js): kısıtlı kanaldaki panel ve "ne zaman kalkacak" cevabı
module.exports = ({ mock, ui, src }) => {
  const d = src('systems/yenihesap/ui');
  const DAY = mock.DAY;

  const yeniHesap = mock.user({ username: 'irem', displayName: 'İrem', createdTimestamp: mock.ago(2 * DAY) });
  const hesap4Gun = mock.user({ username: 'baris', displayName: 'Baris', createdTimestamp: mock.ago(4 * DAY) });

  const cevap = (id, title, where, user, kisitli) => ({
    id,
    title,
    where,
    visibility: 'ephemeral',
    kind: 'message',
    build: () => ({ components: [d.sureView(user, kisitli)], flags: ui.EPHEMERAL_CV2, allowedMentions: { parse: [] } }),
  });

  return [
    {
      id: 'panel',
      title: 'Hesap doğrulama paneli',
      where: 'Kısıtlı üyelerin görebildiği tek kanal',
      visibility: 'panel',
      kind: 'message',
      build: () => ({ components: [d.panel()], allowedMentions: { parse: [] } }),
    },
    cevap('sure-yeni', 'Süreyi öğren: süre bekleniyor', 'Paneldeki Süreyi Öğren butonuna basınca', yeniHesap, true),
    cevap('sure-birazdan', 'Süreyi öğren: süre doldu, rol henüz kalkmamış', 'Süresi dolmuş ama tarama bekleyen üye', hesap4Gun, true),
    cevap('sure-kisitsiz', 'Süreyi öğren: hesap kısıtlı değil', 'Kısıtlı olmayan üye de butona basabilir', mock.user({ username: 'can', displayName: 'Can', createdTimestamp: mock.ago(400 * DAY) }), false),
  ];
};
