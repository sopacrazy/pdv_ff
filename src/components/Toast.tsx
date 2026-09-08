import { useToastStore } from '../store/toastStore';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';

export const Toast = () => {
  const { mensagem, tipo } = useToastStore();

  return (
    <AnimatePresence>
      {mensagem && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className={clsx(
            'fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl font-bold text-lg min-w-[300px]',
            tipo === 'erro' && 'bg-red-600 text-white',
            tipo === 'sucesso' && 'bg-green-600 text-white',
            tipo === 'info' && 'bg-blue-600 text-white'
          )}
        >
          {tipo === 'erro' && <AlertCircle size={24} />}
          {tipo === 'sucesso' && <CheckCircle size={24} />}
          {tipo === 'info' && <Info size={24} />}
          {mensagem}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
