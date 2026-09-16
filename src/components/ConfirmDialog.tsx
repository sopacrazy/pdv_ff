import { useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  titulo: string;
  mensagem: string;
  labelDestaque?: string;
  valorDestaque?: string;
  confirmarLabel?: string;
  cancelarLabel?: string;
  variante?: 'perigo' | 'padrao';
  onConfirmar: () => void;
  onCancelar: () => void;
}

export const ConfirmDialog = ({
  titulo,
  mensagem,
  labelDestaque,
  valorDestaque,
  confirmarLabel = 'SIM (ENTER)',
  cancelarLabel = 'NÃO (ESC)',
  variante = 'perigo',
  onConfirmar,
  onCancelar,
}: ConfirmDialogProps) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  const perigo = variante === 'perigo';

  useEffect(() => {
    btnRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancelar();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onConfirmar();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onKeyDown={handleKeyDown}
    >
      <div className={clsx('bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col border', perigo ? 'border-red-200' : 'border-slate-200')}>
        <div
          className={clsx(
            'p-5 border-b flex justify-between items-center rounded-t-2xl',
            perigo ? 'border-red-100 bg-red-50' : 'border-slate-200 bg-slate-50'
          )}
        >
          <div className={clsx('flex items-center gap-3', perigo ? 'text-red-600' : 'text-slate-700')}>
            <AlertTriangle size={26} />
            <h2 className="text-xl font-bold text-slate-800">{titulo}</h2>
          </div>
          <button onClick={onCancelar} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-8 flex flex-col items-center text-center">
          <p className="text-slate-800 text-lg mb-6 font-medium">{mensagem}</p>
          {valorDestaque && (
            <>
              {labelDestaque && (
                <div className="text-slate-500 mb-1 uppercase text-sm font-bold tracking-widest">{labelDestaque}</div>
              )}
              <div className={clsx('text-3xl font-black tabular-nums', perigo ? 'text-red-600' : 'text-slate-800')}>
                {valorDestaque}
              </div>
            </>
          )}
        </div>

        <div className="p-6 bg-slate-50 rounded-b-2xl border-t border-slate-200 flex gap-4">
          <button
            onClick={onCancelar}
            className="flex-1 px-4 py-4 rounded-xl font-bold text-lg text-slate-600 bg-slate-200 hover:bg-slate-300 transition-colors"
          >
            {cancelarLabel}
          </button>
          <button
            ref={btnRef}
            onClick={onConfirmar}
            className={clsx(
              'flex-1 px-4 py-4 rounded-xl font-bold text-lg text-white transition-colors outline-none focus:ring-4',
              perigo ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500/30' : 'bg-slate-800 hover:bg-slate-900 focus:ring-slate-500/30'
            )}
          >
            {confirmarLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
