import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";

interface CoachSessionProps {
  userId: string;
}

interface CoachMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export function CoachSession({ userId }: CoachSessionProps) {
  const { data: session, isLoading } = useQuery({
    queryKey: ["coach-session", userId],
    queryFn: async () => {
      const response = await api.get(`/training/coach/session/${userId}`);
      return response.data as {
        id: string;
        messages: CoachMessage[];
        createdAt: string;
        sessionCount: number;
      };
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
          <p className="text-gray-600">Loading coach session...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-600">Failed to load coach session</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-4 border-b">
        <h2 className="text-lg font-semibold">AI Coach</h2>
        <span className="text-sm text-gray-500">
          {session.sessionCount}/10 sessions today
        </span>
      </div>

      <div className="space-y-4 h-96 overflow-y-auto">
        {session.messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-xs px-4 py-2 rounded-lg ${
                message.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-900"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-4 border-t">
        <input
          type="text"
          placeholder="Ask the coach a question..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={session.sessionCount >= 10}
        />
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          disabled={session.sessionCount >= 10}
        >
          Send
        </button>
      </div>

      {session.sessionCount >= 10 && (
        <div className="text-center text-sm text-gray-600 py-2">
          Daily session limit reached. Try again tomorrow.
        </div>
      )}
    </div>
  );
}
