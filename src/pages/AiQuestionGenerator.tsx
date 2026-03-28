import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bot, Settings, Zap, History } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Navbar from '@/components/Navbar';
import { getLlmConfigs, getGenerationHistory } from '@/services/ai-questions';
import { GenerationResult } from '@/types/api-types';
import LlmConfigPanel from '@/components/ai-questions/LlmConfigPanel';
import GenerationForm from '@/components/ai-questions/GenerationForm';
import GeneratedQuestionsReview from '@/components/ai-questions/GeneratedQuestionsReview';

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'default',
  FAILED: 'destructive',
  PROCESSING: 'secondary',
  PENDING: 'secondary',
};

export default function AiQuestionGenerator() {
  const [generationResult, setGenerationResult] = useState<{
    result: GenerationResult;
    certificationId: string;
    domainId?: string;
  } | null>(null);

  const { data: configs = [] } = useQuery({ queryKey: ['llm-configs'], queryFn: getLlmConfigs });
  const { data: historyData } = useQuery({
    queryKey: ['generation-history'],
    queryFn: () => getGenerationHistory(1, 20),
  });

  const hasKeys = configs.length > 0;

  const handleResult = (result: GenerationResult, certificationId: string, domainId?: string) => {
    setGenerationResult({ result, certificationId, domainId });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Bot className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">AI Question Generator</h1>
          </div>
          <p className="text-muted-foreground">
            Upload study materials, generate exam questions with your AI key, and auto-publish high-quality ones to the question bank.
          </p>
        </div>

        <Tabs defaultValue={generationResult ? 'review' : hasKeys ? 'generate' : 'settings'}>
          <TabsList className="mb-6">
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-1.5" />
              AI Settings
              {!hasKeys && <Badge variant="destructive" className="ml-1.5 text-xs h-4 px-1">!</Badge>}
            </TabsTrigger>
            <TabsTrigger value="generate">
              <Zap className="h-4 w-4 mr-1.5" />
              Generate
            </TabsTrigger>
            {generationResult && (
              <TabsTrigger value="review">
                Review ({generationResult.result.questions.length})
              </TabsTrigger>
            )}
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-1.5" />
              History
            </TabsTrigger>
          </TabsList>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">AI Provider Configuration</CardTitle>
                <CardDescription>
                  Brain Gym uses a Bring Your Own Key (BYOK) model. Your API keys are encrypted with AES-256-GCM before storage.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LlmConfigPanel />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Generate Tab */}
          <TabsContent value="generate">
            {!hasKeys ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center">
                  <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium">No AI provider configured</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add an API key in the <strong>AI Settings</strong> tab to start generating questions.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Generate Questions</CardTitle>
                  <CardDescription>
                    Select your certification, optionally pick a source material, and generate exam-style questions. Questions are scored by a critic LLM and auto-routed based on quality.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <GenerationForm onResult={handleResult} />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Review Tab */}
          {generationResult && (
            <TabsContent value="review">
              <GeneratedQuestionsReview
                result={generationResult.result}
                certificationId={generationResult.certificationId}
                domainId={generationResult.domainId}
                onReset={() => setGenerationResult(null)}
              />
            </TabsContent>
          )}

          {/* History Tab */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Generation History</CardTitle>
              </CardHeader>
              <CardContent>
                {!historyData?.data.length ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No generation jobs yet.</p>
                ) : (
                  <div className="space-y-2">
                    {historyData.data.map(job => (
                      <div key={job.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium">{job.certification.name} {job.domain ? `— ${job.domain.name}` : ''}</p>
                          <p className="text-xs text-muted-foreground">
                            {job.provider} · {job.difficulty} · {job.questionCount} questions ·{' '}
                            {(job.promptTokens || 0) + (job.completionTokens || 0)} tokens ·{' '}
                            {new Date(job.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={STATUS_COLORS[job.status] as any} className="text-xs">
                            {job.status}
                          </Badge>
                          {job._count.questions > 0 && (
                            <span className="text-xs text-muted-foreground">{job._count.questions} saved</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
