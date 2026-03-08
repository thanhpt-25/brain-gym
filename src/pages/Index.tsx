import { motion } from 'framer-motion';
import { certifications } from '@/data/mockData';
import { useNavigate } from 'react-router-dom';
import { Brain, Zap, BarChart3, Users, Target, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CertificationCard from '@/components/CertificationCard';

const features = [
  { icon: Target, title: 'Exam Simulation', desc: 'Timer, navigation, mark for review — giống exam thật.' },
  { icon: BarChart3, title: 'Smart Analytics', desc: 'Domain breakdown, weak topic detection, pass probability.' },
  { icon: Users, title: 'Community Driven', desc: 'Tạo và chia sẻ đề thi. Voting, review, verification.' },
  { icon: Zap, title: 'AI Assist', desc: 'Generate questions, improve explanations, detect duplicates.' },
  { icon: BookOpen, title: 'Study Mode', desc: 'Flashcards, instant feedback, adaptive learning.' },
  { icon: Brain, title: 'Adaptive Exam', desc: 'Câu đúng → khó hơn. Câu sai → dễ hơn.' },
];

const stats = [
  { value: '10K+', label: 'Questions' },
  { value: '5', label: 'Certifications' },
  { value: '50K+', label: 'Exams Taken' },
  { value: '89%', label: 'Pass Rate' },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            <span className="font-mono text-lg font-bold text-gradient-cyan">CertGym</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              Explore
            </Button>
            <Button size="sm" className="glow-cyan">
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
        
        <div className="container relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-3xl mx-auto text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm font-mono">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
              Phòng Gym cho Trí Não
            </div>
            <h1 className="text-4xl md:text-6xl font-bold font-mono leading-tight mb-6">
              Luyện thi chứng chỉ
              <br />
              <span className="text-gradient-cyan">cùng cộng đồng</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
              Tạo, chia sẻ và luyện mock exam cho các chứng chỉ quốc tế. 
              Phân tích điểm yếu. Cải thiện mỗi ngày.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button size="lg" className="glow-cyan font-mono" onClick={() => navigate('/exams')}>
                Start Training
              </Button>
              <Button size="lg" variant="outline" className="font-mono">
                Browse Exams
              </Button>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 max-w-2xl mx-auto"
          >
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl md:text-3xl font-bold font-mono text-gradient-cyan">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Certifications */}
      <section className="py-20 border-t border-border">
        <div className="container">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold font-mono mb-3">Certification Library</h2>
            <p className="text-muted-foreground">Chọn chứng chỉ và bắt đầu luyện tập</p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {certifications.map((cert, i) => (
              <motion.div
                key={cert.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <CertificationCard cert={cert} onClick={() => navigate(`/exam/${cert.id}`)} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 border-t border-border">
        <div className="container">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold font-mono mb-3">
              Không chỉ là <span className="text-gradient-cyan">làm đề</span>
            </h2>
            <p className="text-muted-foreground">Một hệ sinh thái luyện thi hoàn chỉnh</p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="glass-card p-6 hover:border-primary/30 transition-colors group"
              >
                <f.icon className="h-8 w-8 text-primary mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="font-mono font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container text-center text-sm text-muted-foreground">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Brain className="h-4 w-4 text-primary" />
            <span className="font-mono font-semibold text-gradient-cyan">CertGym</span>
          </div>
          <p>Community-powered certification training platform</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
