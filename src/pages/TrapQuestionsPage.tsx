import { useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getCertifications } from '@/services/certifications';
import { getQuestions } from '@/services/questions';
import { AlertTriangle, BookOpen, FileText, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Navbar from '@/components/Navbar';
import Breadcrumb from '@/components/Breadcrumb';
import { QuestionListSkeleton } from '@/components/PageSkeleton';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

const TrapQuestionsPage = () => {
    const navigate = useNavigate();
    const [certId, setCertId] = useState<string>('');

    const { data: certifications } = useQuery({
        queryKey: ['certifications'],
        queryFn: getCertifications
    });

    const {
        data,
        isLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage
    } = useInfiniteQuery({
        queryKey: ['trap-questions', certId],
        queryFn: ({ pageParam = 1 }) => getQuestions(certId || undefined, pageParam, 12, true),
        initialPageParam: 1,
        getNextPageParam: (lastPage) => {
            if (lastPage.meta.page < lastPage.meta.lastPage) {
                return lastPage.meta.page + 1;
            }
            return undefined;
        },
    });

    const sentinelRef = useInfiniteScroll({
        hasNextPage,
        isFetchingNextPage,
        fetchNextPage
    });

    const questions = data?.pages.flatMap(page => page.data) ?? [];

    return (
        <div className="min-h-screen bg-background">
            <Navbar title="Trap Questions" />

            <section className="pt-32 pb-20">
                <div className="container max-w-5xl mx-auto">
                    <Breadcrumb items={[{ label: 'Trap Questions' }]} className="mb-6" />

                    <div className="mb-8 flex flex-col md:flex-row gap-4 items-start justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h1 className="text-3xl font-bold font-mono text-gradient-cyan">Trap Questions</h1>
                                <AlertTriangle className="h-6 w-6 text-destructive" />
                            </div>
                            <p className="text-muted-foreground mt-1">
                                High-difficulty, tricky questions designed to expose common misconceptions. Practice these to avoid exam surprises.
                            </p>
                        </div>

                        <Select value={certId} onValueChange={(val) => setCertId(val === 'all' ? '' : val)}>
                            <SelectTrigger className="w-[180px] border-border bg-muted/50 shrink-0">
                                <SelectValue placeholder="All Certs" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Certs</SelectItem>
                                {certifications?.map(cert => (
                                    <SelectItem key={cert.id} value={cert.id}>{cert.code}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-4">
                        {isLoading ? (
                            <QuestionListSkeleton count={4} />
                        ) : questions.length === 0 ? (
                            <div className="text-center py-12 border border-border rounded-xl bg-muted/30">
                                <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                                <h3 className="text-lg font-semibold">No trap questions found</h3>
                                <p className="text-muted-foreground mt-1">
                                    No questions have been marked as tricky yet for this certification.
                                </p>
                            </div>
                        ) : (
                            <>
                                {questions.map((q) => (
                                    <div
                                        key={q.id}
                                        className="p-6 rounded-xl border border-border bg-card/50 hover:border-destructive/50 transition-colors cursor-pointer"
                                        onClick={() => navigate(`/questions/${q.id}`)}
                                    >
                                        <div className="flex gap-2 mb-3 flex-wrap">
                                            <span className="px-2.5 py-0.5 rounded-full bg-destructive/20 text-destructive text-xs font-mono flex items-center gap-1">
                                                <AlertTriangle className="h-3 w-3" /> Trap
                                            </span>
                                            <span className="px-2.5 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-mono">
                                                {q.difficulty}
                                            </span>
                                            <span className="px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-mono">
                                                {q.certificationId}
                                            </span>
                                            {q.isScenario && (
                                                <span className="px-2.5 py-0.5 rounded-full bg-accent/20 text-accent text-xs font-mono flex items-center gap-1">
                                                    <BookOpen className="h-3 w-3" /> Scenario
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-lg font-medium mb-2">{q.title}</h3>

                                        {q.tags && q.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mb-4">
                                                {q.tags.map((t: any) => (
                                                    <span key={t.tagId || t.tag?.id} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                                                        #{t.tag?.name || t.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            {q.choices?.map((choice) => (
                                                <div key={choice.id} className={`p-3 rounded-lg border flex gap-3 ${choice.isCorrect ? 'border-accent/50 bg-accent/10' : 'border-border bg-muted/30'}`}>
                                                    <span className="font-mono text-muted-foreground uppercase">{choice.label}.</span>
                                                    <span>{choice.content}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}

                                {/* Loading sentinel */}
                                <div ref={sentinelRef} className="py-8 flex justify-center">
                                    {isFetchingNextPage && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
                                    {!hasNextPage && questions.length > 0 && (
                                        <p className="text-xs text-muted-foreground font-mono opacity-50">End of trap question library</p>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default TrapQuestionsPage;
