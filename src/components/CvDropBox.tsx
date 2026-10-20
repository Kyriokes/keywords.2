'use client';

import { motion } from 'framer-motion';
import { Upload, Loader2 } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCvStore } from '@/store/cvStore';
import { parseCv } from '@/lib/cvParser';

export function CvDropBox() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { addCv, fetchCVs, isLoading: isStoreLoading } = useCvStore();

  useEffect(() => {
    fetchCVs();
  }, [fetchCVs]);

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
      toast.error("Formato no soportado. Subí un archivo PDF o DOCX.");
      return
    }
    
    setIsProcessing(true)
    
    try {
      // 1. Parsear el archivo localmente (o en API route de parsing)
      const result = await parseCv(file)
      
      // 2. Subir a la base de datos
      await addCv({
        name: file.name,
        keywords: result.keywords,
        text: result.text
      });
      
      toast.success(`${isPdf ? 'PDF' : 'DOCX'} "${file.name}" agregado correctamente`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error al procesar el archivo."
      toast.error(msg)
      console.error(error)
    } finally {
      setIsProcessing(false)
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
    if (!isProcessing && !isStoreLoading) {
        fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const isBusy = isProcessing || isStoreLoading;

  return (
    <div className="w-full max-w-md mx-auto">
      <motion.div
        whileHover={!isBusy ? { scale: 1.02 } : undefined}
        whileTap={!isBusy ? { scale: 0.98 } : undefined}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed transition-all duration-300 text-center h-64 cursor-pointer",
          isDragging 
            ? "border-primary bg-primary/10 scale-105" 
            : "border-muted-foreground/30 bg-card hover:border-primary/50 hover:shadow-xl",
          isBusy && "opacity-70 cursor-wait"
        )}
      >
        <div className={cn(
          "p-4 rounded-full shadow-sm mb-4 transition-colors",
          isDragging ? "bg-primary/20" : "bg-background"
        )}>
          {isBusy ? (
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          ) : (
            <Upload className={cn(
              "w-10 h-10",
              isDragging ? "text-primary" : "text-muted-foreground"
            )} />
          )}
        </div>
        
        <h3 className="text-xl font-semibold mb-2">
          {isBusy ? "Procesando..." : "Subí tu CV"}
        </h3>
        
        <p className="text-sm text-muted-foreground max-w-[200px]">
          {isDragging 
              ? "Soltá el archivo acá" 
              : "Arrastrá tu PDF o DOCX acá, o hacé clic para buscarlo"}
        </p>

        {!isBusy && !isDragging && (
           <p className="text-xs text-muted-foreground mt-4">
             El primero que subas queda activo. Para cambiarlo, tocá otro en la lista
           </p>
        )}
      </motion.div>
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept=".pdf,.docx"
        onChange={handleFileChange}
        disabled={isBusy}
      />
    </div>
  );
}
