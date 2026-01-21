'use client';

import { useCvStore } from '@/store/cvStore';
import { FileText, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function CvList() {
  const { cvs, removeCv, activeCvId, selectCv } = useCvStore();

  if (cvs.length === 0) return null;

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('¿Estás seguro? Esto es irreversible')) {
        removeCv(id);
    }
  }

  return (
    <div className="space-y-4 pt-4 border-t">
        <h3 className="text-lg font-semibold">CVs Cargados</h3>
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {cvs.map((cv) => (
                <div 
                    key={cv.id} 
                    className={cn(
                        "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                        activeCvId === cv.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/50"
                    )}
                    onClick={() => selectCv(cv.id)}
                >
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className={cn("p-2 rounded-full shrink-0", activeCvId === cv.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                            <FileText size={18} />
                        </div>
                        <div className="min-w-0">
                            <p className="font-medium truncate text-sm" title={cv.name}>{cv.name}</p>
                            <p className="text-xs text-muted-foreground">{new Date(cv.uploadDate).toLocaleDateString()}</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                        {activeCvId === cv.id && (
                             <span className="text-[10px] font-medium text-primary px-2 py-0.5 bg-primary/10 rounded-full">Activo</span>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                            onClick={(e) => handleDelete(cv.id, e)}
                        >
                            <Trash2 size={16} />
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    </div>
  )
}
