// VIP sistemi ayarları: yetkililer /vip-ver ile bir üyeye VIP rolünü kalıcı olarak verir (bot kendisi geri almaz,
// geri alma Discord üzerinden elle yapılır). ID değiştirince botu yeniden başlatmak yeterli.
module.exports = {
  // VIP olarak verilecek rol
  roleId: '1554240782162989117',

  // /vip-ver komutunu kullanabilecek roller; boşken sadece sunucu yöneticileri kullanabilir
  staffRoles: [],
};
