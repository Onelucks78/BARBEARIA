import React from 'react';

interface LogoProps {
  className?: string;
  alt?: string;
}

export const Logo: React.FC<LogoProps> = ({
  className = "h-12 sm:h-14 w-auto object-contain shrink-0",
  alt = "Detalhe Barbearia"
}) => {
  return (
    <>
      {/* Logo para Tema Claro */}
      <img
        src="/logo-light.png"
        alt={alt}
        className={`${className} dark:hidden block`}
      />
      {/* Logo para Tema Escuro */}
      <img
        src="/logo-dark.png"
        alt={alt}
        className={`${className} hidden dark:block`}
      />
    </>
  );
};

export default Logo;
