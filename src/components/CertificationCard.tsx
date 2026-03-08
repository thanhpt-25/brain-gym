import { Certification } from '@/types/exam';

interface CertificationCardProps {
  cert: Certification;
  onClick: () => void;
}

const CertificationCard = ({ cert, onClick }: CertificationCardProps) => {
  return (
    <button
      onClick={onClick}
      className="glass-card p-6 text-left w-full hover:border-primary/30 transition-all group cursor-pointer"
    >
      <div className="flex items-start justify-between mb-4">
        <span className="text-3xl">{cert.icon}</span>
        <span className="text-xs font-mono px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
          {cert.code}
        </span>
      </div>
      <div className="text-xs text-muted-foreground font-mono mb-1">{cert.provider}</div>
      <h3 className="font-mono font-semibold mb-2 group-hover:text-primary transition-colors">
        {cert.name}
      </h3>
      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{cert.description}</p>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>{cert.questionCount} questions</span>
        <span>{cert.timeMinutes} min</span>
        <span>Pass: {cert.passingScore}%</span>
      </div>
    </button>
  );
};

export default CertificationCard;
