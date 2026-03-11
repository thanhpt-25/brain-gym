import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCertifications } from '@/services/certifications';
import { createQuestion } from '@/services/questions';
import { Brain, ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { QuestionType, Difficulty } from '@/types/exam';

export default function QuestionForm() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [title, setTitle] = useState('');
    const [explanation, setExplanation] = useState('');
    const [certificationId, setCertificationId] = useState('');
    const [difficulty, setDifficulty] = useState<Difficulty | ''>('');

    const [choices, setChoices] = useState([
        { label: 'a', content: '', isCorrect: false },
        { label: 'b', content: '', isCorrect: false },
        { label: 'c', content: '', isCorrect: false },
        { label: 'd', content: '', isCorrect: false },
    ]);

    const { data: certifications } = useQuery({
        queryKey: ['certifications'],
        queryFn: getCertifications
    });

    const mutation = useMutation({
        mutationFn: createQuestion,
        onSuccess: () => {
            toast({ title: 'Success', description: 'Question created successfully (saved as Draft).' });
            queryClient.invalidateQueries({ queryKey: ['questions'] });
            navigate('/questions');
        },
        onError: (error: any) => {
            toast({
                title: 'Error',
                description: error.response?.data?.message || 'Failed to create question',
                variant: 'destructive'
            });
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !explanation || !certificationId || !difficulty) {
            toast({ title: 'Validation Error', description: 'Please fill out all required fields.', variant: 'destructive' });
            return;
        }

        const hasCorrectAnswer = choices.some(c => c.isCorrect);
        if (!hasCorrectAnswer) {
            toast({ title: 'Validation Error', description: 'Please select at least one correct answer.', variant: 'destructive' });
            return;
        }

        mutation.mutate({
            title,
            explanation,
            certificationId,
            difficulty,
            questionType: QuestionType.SINGLE,
            choices: choices.map(c => ({
                label: c.label,
                content: c.content,
                isCorrect: c.isCorrect
            })) as any
        });
    };

    return (
        <div className="min-h-screen bg-background">
            <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
                <div className="container flex h-16 items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                        <Brain className="h-6 w-6 text-primary" />
                        <span className="font-mono text-lg font-bold text-gradient-cyan">CertGym</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/questions')}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                </div>
            </nav>

            <section className="pt-32 pb-20">
                <div className="container max-w-3xl mx-auto">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold font-mono">Create Question</h1>
                        <p className="text-muted-foreground mt-2">Submit a new question for review.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8 glass-card p-8 bg-white/5 border-white/10 rounded-xl">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1.5 opacity-80">Certification *</label>
                                <Select value={certificationId} onValueChange={setCertificationId}>
                                    <SelectTrigger className="bg-background">
                                        <SelectValue placeholder="Select Certification" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {certifications?.map(cert => (
                                            <SelectItem key={cert.id} value={cert.id}>{cert.code} - {cert.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1.5 opacity-80">Difficulty *</label>
                                <Select value={difficulty} onValueChange={(val) => setDifficulty(val as Difficulty)}>
                                    <SelectTrigger className="bg-background">
                                        <SelectValue placeholder="Select Difficulty" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="EASY">Easy</SelectItem>
                                        <SelectItem value="MEDIUM">Medium</SelectItem>
                                        <SelectItem value="HARD">Hard</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1.5 opacity-80">Question Title *</label>
                                <Textarea
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="E.g., Which AWS service provides a managed relational database?"
                                    className="bg-background min-h-[100px]"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="block text-sm font-medium opacity-80">Choices * (Select the correct one)</label>
                            {choices.map((choice, i) => (
                                <div key={choice.label} className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const newChoices = choices.map((c, idx) => ({ ...c, isCorrect: i === idx }));
                                            setChoices(newChoices);
                                        }}
                                        className={`w-8 h-8 rounded-full border flex items-center justify-center font-mono text-sm transition-colors ${choice.isCorrect ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-background border-white/20 hover:border-primary/50'
                                            }`}
                                    >
                                        {choice.label.toUpperCase()}
                                    </button>
                                    <Input
                                        value={choice.content}
                                        onChange={(e) => {
                                            const newChoices = [...choices];
                                            newChoices[i].content = e.target.value;
                                            setChoices(newChoices);
                                        }}
                                        placeholder={`Choice ${choice.label.toUpperCase()}`}
                                        className={`bg-background ${choice.isCorrect ? 'border-green-500/30' : ''}`}
                                    />
                                </div>
                            ))}
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1.5 opacity-80">Explanation *</label>
                            <Textarea
                                value={explanation}
                                onChange={(e) => setExplanation(e.target.value)}
                                placeholder="Explain why the correct answer is right and why the others are wrong..."
                                className="bg-background min-h-[120px]"
                            />
                        </div>

                        <div className="flex justify-end pt-4 border-t border-white/10">
                            <Button type="submit" disabled={mutation.isPending} className="glow-cyan font-mono w-full sm:w-auto">
                                {mutation.isPending ? 'Saving...' : (
                                    <>
                                        <Save className="w-4 h-4 mr-2" />
                                        Submit for Review
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </div>
            </section>
        </div>
    );
}
