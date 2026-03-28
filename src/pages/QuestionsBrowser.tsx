import { useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getCertifications } from '@/services/certifications';
import { getQuestions } from '@/services/questions';
import { Brain, Search, FileText, Loader2, BookOpen, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Navbar from '@/components/Navbar';
import Breadcrumb from '@/components/Breadcrumb';
import { QuestionListSkeleton } from '@/components/PageSkeleton';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useDebounce } from '@/hooks/useDebounce';

const QuestionsBrowser = () => {
    const navigate = useNavigate();
    const [certId, setCertId] = useState<string>('');
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<string>('APPROVED');
    const debouncedSearch = useDebounce(search, 400);

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
        queryKey: ['questions', certId, status],
        queryFn: ({ pageParam = 1 }) => getQuestions(certId, pageParam, 12, undefined, status),
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
            <Navbar title="Question Bank" />

            <section className="pt-32 pb-20">
                <div className="container max-w-5xl mx-auto">
                    <Breadcrumb items={[{ label: 'Questions' }]} className="mb-6" />
                    <div className="mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold font-mono text-gradient-cyan">Question Bank</h1>
                            <p className="text-muted-foreground mt-2">Browse and practice individual questions.</p>
                        </div>

                        <div className="flex w-full md:w-auto gap-4">
                            <div className="relative flex-1 md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search questions..."
                                    className="pl-9 bg-muted/50 border-border"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                            <Select value={certId || undefined} onValueChange={(val) => setCertId(val === 'all' ? '' : val)}>
                                <SelectTrigger className="w-[180px] border-border bg-muted/50">
                                    <SelectValue placeholder="All Certs" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Certs</SelectItem>
                                    {certifications?.map(cert => (
                                        <SelectItem key={cert.id} value={cert.id}>{cert.code}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger className="w-[140px] border-border bg-muted/50">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="APPROVED">Approved</SelectItem>
                                    <SelectItem value="PENDING">Pending</SelectItem>
                                    <SelectItem value="REJECTED">Rejected</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {isLoading ? (
                            <QuestionListSkeleton count={4} />
                        ) : questions.length === 0 ? (
                            <div className="text-center py-12 border border-border rounded-xl bg-muted/30">
                                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                                <h3 className="text-lg font-semibold">No questions found</h3>
                                <p className="text-muted-foreground mt-1">Try selecting a different certification or search term.</p>
                            </div>
                        ) : (
                            <>
                                {questions.map((q) => (
                                    <div
                                        key={q.id}
                                        className="p-6 rounded-xl border border-border bg-card/50 hover:border-primary/50 transition-colors cursor-pointer"
                                        onClick={() => navigate(`/questions/${q.id}`)}
                                    >
                                        <div className="flex gap-2 mb-3">
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
                                            {q.isTrapQuestion && (
                                                <span className="px-2.5 py-0.5 rounded-full bg-destructive/20 text-destructive text-xs font-mono flex items-center gap-1">
                                                    <AlertTriangle className="h-3 w-3" /> Trap
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
                                        <p className="text-xs text-muted-foreground font-mono opacity-50">End of question bank</p>
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

export default QuestionsBrowser;

