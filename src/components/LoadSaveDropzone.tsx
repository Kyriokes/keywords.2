import { motion } from 'framer-motion';
import { PackageOpen } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface LoadSaveDropzoneProps {
  onFileSelected?: (file: File) => void;
}

export function LoadSaveDropzone({ onFileSelected }: LoadSaveDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleLoadSave = () => {
    fileInputRef.current?.click();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.json')) {
        toast.success(`Archivo "${file.name}" recibido. La funcionalidad de carga se implementará pronto.`);
        onFileSelected?.(file);
      } else {
        toast.error("Formato de archivo no soportado. Usa .xlsx, .xls o .json");
      }
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      toast.success(`Archivo "${file.name}" seleccionado. La funcionalidad de carga se implementará pronto.`);
      onFileSelected?.(file);
    }
  };

  return (
    <>
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleLoadSave}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed transition-all duration-300 text-center h-full cursor-pointer",
          isDragging 
            ? "border-primary bg-primary/10 scale-105" 
            : "border-muted-foreground/30 bg-card hover:border-primary/50 hover:shadow-xl"
        )}
      >
        <div className={cn(
          "p-4 rounded-full shadow-sm mb-4 transition-colors",
          isDragging ? "bg-primary/20" : "bg-background"
        )}>
          <PackageOpen className={cn(
            "w-10 h-10",
            isDragging ? "text-primary" : "text-blue-500"
          )} />
        </div>
        
        <h3 className="text-xl font-semibold mb-2">Cargar Save File</h3>
        <p className="text-sm text-muted-foreground">
          {isDragging ? "¡Suelta el archivo aquí!" : "Deposita tu archivo aquí o clickea para abrir el buscador"}
        </p>
      </motion.div>
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept=".xlsx,.xls,.json"
        onChange={handleFileChange}
      />
    </>
  );
}
