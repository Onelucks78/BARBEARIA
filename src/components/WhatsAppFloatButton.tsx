import { FaWhatsapp } from 'react-icons/fa';

const WHATSAPP_LINK = 'https://wa.me/556499878226?text=' + encodeURIComponent('Olá! Vim pelo site da Detalhe Barbearia e gostaria de mais informações.');

export function WhatsAppFloatButton() {
  return (
    <a
      href={WHATSAPP_LINK}
      target="_blank"
      rel="noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-[#25D366] hover:bg-[#20BD5C] text-white flex items-center justify-center shadow-lg shadow-black/25 hover:scale-105 active:scale-95 transition-all duration-200"
    >
      <FaWhatsapp size={28} />
    </a>
  );
}
