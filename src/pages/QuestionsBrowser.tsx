import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getCertifications } from '@/services/certifications';
import { getQuestions } from '@/services/questions';
import { Brain, Plus, Search, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthStore } from '@/stores/auth.store';
import Navbar from '@/components/Navbar';

const QuestionsBrowser = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [certId, setCertId] = useState<string>('');
    const [page, setPage] = useState(1);

    const { data: certifications } = useQuery({
        queryKey: ['certifications'],
        queryFn: getCertifications
    });

    const { data: questionsData, isLoading } = useQuery({
        queryKey: ['questions', certId, page],
        queryFn: () => getQuestions(certId, page, 10),
    });

    return (
        <div className="min-h-screen bg-background">
            <Navbar title="Question Bank" />

            <section className="pt-32 pb-20">
                <div className="container max-w-5xl mx-auto">
                    <div className="mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold font-mono bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Question Bank</h1>
                            <p className="text-muted-foreground mt-2">Browse and practice individual questions.</p>
                        </div>

                        <div className="flex w-full md:w-auto gap-4">
                            <Select value={certId} onValueChange={(val) => { setCertId(val === 'all' ? '' : val); setPage(1); }}>
                                <SelectTrigger className="w-[200px] border-white/10 bg-white/5">
                                    <SelectValue placeholder="All Certifications" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Certifications</SelectItem>
                                    {certifications?.map(cert => (
                                        <SelectItem key={cert.id} value={cert.id}>{cert.code}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {isLoading ? (
                            <div className="text-center py-12 text-muted-foreground">Loading questions...</div>
                        ) : questionsData?.data.length === 0 ? (
                            <div className="text-center py-12 border border-white/10 rounded-xl bg-white/5">
                                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                                <h3 className="text-lg font-semibold">No questions found</h3>
                                <p className="text-muted-foreground mt-1">Try selecting a different certification or add some questions.</p>
                            </div>
                        ) : (
                            questionsData?.data.map((q) => (
                                <div
                                    key={q.id}
                                    className="p-6 rounded-xl border border-white/10 bg-white/5 hover:border-primary/50 transition-colors cursor-pointer"
                                    onClick={() => navigate(`/questions/${q.id}`)}
                                >
                                    <div className="flex gap-2 mb-3">
                                        <span className="px-2.5 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-mono">
                                            {q.difficulty}
                                        </span>
                                        <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-gray-300 text-xs font-mono">
                                            {q.certificationId}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-medium mb-4">{q.title}</h3>
                                    <div className="space-y-2">
                                        {q.choices?.map((choice) => (
                                            <div key={choice.id} className={`p-3 rounded-lg border flex gap-3 ${choice.isCorrect ? 'border-green-500/50 bg-green-500/10' : 'border-white/10 bg-white/5'}`}>
                                                <span className="font-mono text-muted-foreground uppercase">{choice.label}.</span>
                                                <span>{choice.content}</span>
                                            </div>
                                        ))}
                                    </div>
                                    {q.explanation && (
                                        <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                                            <strong className="text-primary block mb-1">Explanation:</strong>
                                            {q.explanation}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Pagination */}
                    {questionsData && questionsData.meta.lastPage > 1 && (
                        <div className="flex justify-center mt-8 gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page === 1}
                                onClick={() => setPage(p => p - 1)}
                            >
                                Previous
                            </Button>
                            <span className="py-2 px-4 text-sm font-mono opacity-50">
                                Page {page} of {questionsData.meta.lastPage}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= questionsData.meta.lastPage}
                                onClick={() => setPage(p => p + 1)}
                            >
                                Next
                            </Button>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default QuestionsBrowser;
