'use client';

import { motion } from 'framer-motion';
import { Upload, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCvStore } from '@/store/cvStore';
import { parseCv } from '@/lib/cvParser';

export function CvDropBox() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  // We don't need persistent fileName state anymore since we add to a list, 
  // but we can use it to show temporary success if we want. 
  // For now, let's just reset it to allow multiple uploads easily.
  const addCv = useCvStore((state) => state.addCv);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const processFile = async (file: File) => {
    const isPdf = file.name.toLowerCase().endsWith('.pdf')
    const isDocx = file.name.toLowerCase().endsWith('.docx')
    if (!isPdf && !isDocx) {
      toast.error("Formato no soportado. Por favor sube un archivo PDF o DOCX.");
      return
    }
    setIsProcessing(true)
    try {
      const result = await parseCv(file)
      
      addCv({
        name: file.name,
        keywords: result.keywords,
        text: result.text
      });
      
      toast.success(`${isPdf ? 'PDF' : 'DOCX'} "${file.name}" agregado correctamente`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error al procesar el archivo. Asegúrate de que sea un PDF o DOCX válido."
      toast.error(msg)
      console.error(error)
    } finally {
      setIsProcessing(false)
      // Reset input so same file can be selected again if needed (though unlikely)
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed transition-all duration-300 text-center h-64 cursor-pointer",
          isDragging 
            ? "border-primary bg-primary/10 scale-105" 
            : "border-muted-foreground/30 bg-card hover:border-primary/50 hover:shadow-xl"
        )}
      >
        <div className={cn(
          "p-4 rounded-full shadow-sm mb-4 transition-colors",
          isDragging ? "bg-primary/20" : "bg-background"
        )}>
          {isProcessing ? (
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          ) : (
            <Upload className={cn(
              "w-10 h-10",
              isDragging ? "text-primary" : "text-muted-foreground"
            )} />
          )}
        </div>
        
        <h3 className="text-xl font-semibold mb-2">
          {isProcessing ? "Procesando..." : "Sube tu CV"}
        </h3>
        
        <p className="text-sm text-muted-foreground max-w-[200px]">
          {isDragging 
              ? "¡Suelta el archivo aquí!" 
              : "Arrastra tu PDF o DOCX aquí, o haz click para buscar"}
        </p>

        {!isProcessing && !isDragging && (
           <p className="text-xs text-muted-foreground mt-4">
             Puedes cargar múltiples versiones
           </p>
        )}
      </motion.div>
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept=".pdf,.docx"
        onChange={handleFileChange}
      />
    </div>
  );
}
