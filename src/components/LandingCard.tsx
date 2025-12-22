import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LandingCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  highlight?: boolean;
  badge?: string;
}

export function LandingCard({ icon, title, description, onClick, disabled, highlight, badge }: LandingCardProps) {
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center p-8 rounded-2xl border transition-all duration-300 text-center h-full",
        "bg-card hover:shadow-xl",
        disabled ? "opacity-60 cursor-not-allowed bg-muted/50" : "cursor-pointer hover:border-primary/50",
        highlight ? "border-primary/50 shadow-sm ring-1 ring-primary/20" : "border-border"
      )}
    >
      {badge && (
        <span className="absolute top-4 right-4 text-xs font-medium px-2 py-1 rounded-full bg-muted text-muted-foreground">
          {badge}
        </span>
      )}
      
      <div className="bg-background p-4 rounded-full shadow-sm mb-4">
        {icon}
      </div>
      
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
      
      {!disabled && highlight && (
        <div className="mt-6 flex items-center text-primary text-sm font-medium">
          Comenzar <ArrowRight className="w-4 h-4 ml-1" />
        </div>
      )}
    </motion.button>
  );
}
