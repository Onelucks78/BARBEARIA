import React from 'react';
import { Profissional } from '../../types.ts';

interface FiltroBarbeiroProps {
  profissionais: Profissional[];
  valor: string;              // '' = todos
  onChange: (id: string) => void;
  incluirCasa?: boolean;      // adiciona a opção "Barbearia" (lançamentos sem barbeiro)
}

/**
 * Linha de chips para filtrar por barbeiro. Usada na Agenda, no Financeiro
 * e no Balanço. Some sozinha quando só existe um barbeiro — não faz sentido
 * mostrar filtro de uma opção só.
 */
export default function FiltroBarbeiro({
  profissionais,
  valor,
  onChange,
  incluirCasa = false
}: FiltroBarbeiroProps) {
  const ativos = profissionais.filter(p => p.ativo || p.id === valor);
  if (ativos.length < 2) return null;

  const chip = (id: string, rotulo: string) => (
    <button
      key={id || 'todos'}
      type="button"
      onClick={() => onChange(id)}
      className={`px-3 py-1.5 rounded-sm text-xs font-semibold transition cursor-pointer border ${
        valor === id
          ? 'bg-primary text-primary-foreground border-primary shadow-md font-bold'
          : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-accent'
      }`}
    >
      {rotulo}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground uppercase tracking-wider mr-1">Barbeiro:</span>
      {chip('', 'Todos')}
      {ativos.map(p => chip(p.id, p.nome))}
      {incluirCasa && chip('casa', 'Barbearia')}
    </div>
  );
}
