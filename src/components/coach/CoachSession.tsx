import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import api from "@/services/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface SessionData {
  id: string;
  messages: Message[];
  sessionCount: number;
  createdAt: string;
}

export const CoachSession = () => {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string | null>(null);
  const sessionCountRef = useRef<number>(0);

  const { data: sessionData, isLoading } = useQuery({
    queryKey: ["coach-session", user?.id],
    queryFn: async () => {
      const response = await api.get(`/training/coach/session/${user?.id}`);
      return response.data as SessionData;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (sessionData) {
      sessionIdRef.current = sessionData.id;
      sessionCountRef.current = sessionData.sessionCount;
      setMessages(sessionData.messages || []);
    }
  }, [sessionData]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!inputValue.trim() || !sessionIdRef.current || isStreaming) return;

    if (sessionCountRef.current >= 10) {
      setError("Daily session limit reached. Please try again tomorrow.");
      return;
    }

    const userMsg: Message = {
      role: "user",
      content: inputValue,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsStreaming(true);
    setError(null);

    let assistantContent = "";

    try {
      const response = await api.post(
        `/training/coach/session/${sessionIdRef.current}/message`,
        { message: userMsg.content },
        {
          responseType: "stream",
          headers: { Accept: "text/event-stream" },
        },
      );

      const reader = response.data;
      const decoder = new TextDecoder();

      // Handle streaming response
      for await (const chunk of reader) {
        const text = decoder.decode(chunk);
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;

            try {
              const parsed = JSON.parse(data);
              if (parsed.delta) {
                assistantContent += parsed.delta;
              } else if (parsed.error) {
                setError(parsed.error);
              }
            } catch {
              // Ignore JSON parse errors
            }
          }
        }
      }

      if (assistantContent.trim()) {
        const assistantMsg: Message = {
          role: "assistant",
          content: assistantContent,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      setError(`Failed to get response: ${errorMsg}`);
    } finally {
      setIsStreaming(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Loading session...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card flex flex-col h-96">
      <CardHeader className="border-b">
        <CardTitle className="text-base font-mono">
          AI Coach
          <span className="text-muted-foreground ml-2 text-sm">
            ({sessionCountRef.current}/10 sessions today)
          </span>
        </CardTitle>
      </CardHeader>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">
              Start a conversation with your AI Coach
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isStreaming && (
            <div className="flex justify-start">
              <div className="bg-secondary text-secondary-foreground px-3 py-2 rounded-lg text-sm">
                <span className="inline-block w-2 h-2 rounded-full bg-current animate-pulse"></span>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20 flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {sessionCountRef.current >= 10 && (
        <div className="px-4 py-2 bg-yellow-500/10 border-t border-yellow-500/20 text-sm text-yellow-600">
          Daily session limit reached. Come back tomorrow.
        </div>
      )}

      <div className="border-t p-4 flex gap-2">
        <Input
          placeholder="Ask your coach..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter" && !isStreaming) {
              sendMessage();
            }
          }}
          disabled={isStreaming || sessionCountRef.current >= 10}
          className="font-mono text-sm"
        />
        <Button
          size="sm"
          className="glow-cyan font-mono"
          onClick={sendMessage}
          disabled={isStreaming || sessionCountRef.current >= 10}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
};
