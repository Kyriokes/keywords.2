import { motion } from 'framer-motion';
import { PackageOpen, Download } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { importFromExcel, exportToExcel } from '@/lib/excel';
import { useApplicationStore } from '@/store/applicationStore';
import { useCvStore } from '@/store/cvStore';
import { Button } from '@/components/ui/button';

interface LoadSaveDropzoneProps {
  onFileSelected?: (file: File) => void;
}

export function LoadSaveDropzone({ onFileSelected }: LoadSaveDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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

  const processFile = async (file: File) => {
    // 5MB limit check (5 * 1024 * 1024 bytes)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; 
    
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`El archivo es demasiado grande. El límite es de 5MB.`);
      return;
    }

    try {
      setIsLoading(true);
      const data = await importFromExcel(file);
      
      // Update stores
      for (const app of data.applications) {
          try {
              await useApplicationStore.getState().addApplication({
                  jobTitle: app.jobTitle || "Imported Job",
                  jobDescription: app.jobDescription || "",
                  link: app.link,
                  detectedWords: app.detectedWords || [],
                  positionId: app.positionId
              });
          } catch(e) {
              console.error("Failed to import app", e);
          }
      }
      
      // Import CV if exists
      if (data.cvKeywords.length > 0 || data.cvRawText) {
          useCvStore.getState().addCv({
              name: `Importado (${new Date().toLocaleDateString()})`,
              keywords: data.cvKeywords,
              text: data.cvRawText
          });
      }

      toast.success(`Datos cargados exitosamente: ${data.applications.length} postulaciones.`);
      onFileSelected?.(file);
    } catch (error) {
      console.error(error);
      toast.error("Error al procesar el archivo Excel.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        processFile(file);
      } else {
        toast.error("Formato de archivo no soportado. Usa .xlsx o .xls");
      }
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the dropzone click
    try {
      const { applications } = useApplicationStore.getState();
      const { cvs } = useCvStore.getState();
      
      const activeCv = cvs.find(c => c.isPrimary) || cvs[0];
      const keywords = activeCv?.keywords || [];
      const rawText = activeCv?.text || '';
      
      if (applications.length === 0 && keywords.length === 0 && !rawText) {
        toast.warning("No hay datos para exportar.");
        return;
      }

      exportToExcel(applications, keywords, rawText);
      toast.success("Archivo Excel generado correctamente.");
    } catch (error) {
      console.error(error);
      toast.error("Error al generar el archivo Excel.");
    }
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleLoadSave}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed transition-all duration-300 text-center flex-1 cursor-pointer",
          isDragging 
            ? "border-primary bg-primary/10 scale-105" 
            : "border-muted-foreground/30 bg-card hover:border-primary/50 hover:shadow-xl",
          isLoading && "opacity-50 pointer-events-none"
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
          {isDragging ? "¡Suelta el archivo aquí!" : "Deposita tu archivo .xlsx aquí"}
        </p>
      </motion.div>
      
      <Button 
        variant="outline" 
        className="w-full gap-2 border-dashed"
        onClick={handleDownload}
      >
        <Download className="w-4 h-4" />
        Descargar Save File Actual
      </Button>

      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept=".xlsx,.xls"
        onChange={handleFileChange}
      />
    </div>
  );
}
