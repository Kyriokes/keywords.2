'use client';

import { motion } from 'framer-motion';
import { Upload, CheckCircle, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCvStore } from '@/store/cvStore';
import { parseCv } from '@/lib/cvParser';

export function CvDropBox() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const setKeyWords = useCvStore((state) => state.setKeyWords);
  const setRawText = useCvStore((state) => state.setRawText);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const processFile = async (file: File) => {
    if (file.name.endsWith('.pdf') || file.name.endsWith('.docx')) {
      setIsProcessing(true);
      try {
        const result = await parseCv(file);
        setRawText(result.text);
        setKeyWords(result.keywords);
        setFileName(file.name);
        console.log("=== Datos guardados en CV Store ===");
        console.log("Raw Text (preview):", result.text.substring(0, 100) + "...");
        console.log("Keywords:", result.keywords);
        console.log("===================================");
        toast.success(`CV "${file.name}" procesado correctamente`);
      } catch (error) {
        toast.error("Error al procesar el archivo. Asegúrate de que sea un PDF o DOCX válido.");
        console.error(error);
      } finally {
        setIsProcessing(false);
      }
    } else {
      toast.error("Formato no soportado. Por favor sube un archivo PDF o DOCX.");
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
            : "border-muted-foreground/30 bg-card hover:border-primary/50 hover:shadow-xl",
          fileName && "border-green-500/50 bg-green-500/5"
        )}
      >
        <div className={cn(
          "p-4 rounded-full shadow-sm mb-4 transition-colors",
          isDragging ? "bg-primary/20" : fileName ? "bg-green-100" : "bg-background"
        )}>
          {isProcessing ? (
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          ) : fileName ? (
            <CheckCircle className="w-10 h-10 text-green-500" />
          ) : (
            <Upload className={cn(
              "w-10 h-10",
              isDragging ? "text-primary" : "text-muted-foreground"
            )} />
          )}
        </div>
        
        <h3 className="text-xl font-semibold mb-2">
          {isProcessing ? "Procesando..." : fileName ? "CV Cargado" : "Sube tu CV"}
        </h3>
        
        <p className="text-sm text-muted-foreground max-w-[200px]">
          {fileName 
            ? fileName 
            : isDragging 
              ? "¡Suelta el archivo aquí!" 
              : "Arrastra tu PDF o DOCX aquí, o haz click para buscar"}
        </p>

        {fileName && (
          <div className="mt-4 text-xs text-green-600 font-medium bg-green-100 px-3 py-1 rounded-full">
            Listo para analizar
          </div>
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
