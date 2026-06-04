import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import Navbar from '@/components/Navbar';
import Breadcrumb from '@/components/Breadcrumb';
import { HubView } from '@/components/training/HubView';
import { WeaknessMode } from '@/components/training/WeaknessMode';
import { DailyReviewMode } from '@/components/training/DailyReviewMode';
import { FlashcardReviewMode } from '@/components/training/FlashcardReviewMode';

// Module-level constant so the `state` object identity stays stable across
// renders. A new inline object would make `<Navigate>` re-fire its effect (and
// history.replaceState) on every render — under AnimatePresence's exit
// animation that bursts past WebKit's replaceState rate limit and crashes.
const AUTH_REDIRECT_STATE = { from: '/training' };

export default function TrainingHub() {
  const { isAuthenticated } = useAuthStore();
  const [certFilter, setCertFilter] = useState<string>('');
  const [activeMode, setActiveMode] = useState<'hub' | 'weakness' | 'daily' | 'flashcard'>('hub');

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={AUTH_REDIRECT_STATE} replace />;
  }

  const goBackItems = () => setActiveMode('hub');

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Navbar title="Training Hub" />
      
      <div className="container pt-24 space-y-8">
        {activeMode === 'hub' && (
          <>
            <Breadcrumb items={[{ label: 'Training Hub' }]} className="mb-2" />
            <HubView 
              certFilter={certFilter} 
              setCertFilter={setCertFilter} 
              onModeSelect={setActiveMode} 
            />
          </>
        )}

        {activeMode === 'weakness' && (
          <WeaknessMode certFilter={certFilter} onBack={goBackItems} />
        )}

        {activeMode === 'daily' && (
          <DailyReviewMode certFilter={certFilter} onBack={goBackItems} />
        )}

        {activeMode === 'flashcard' && (
          <FlashcardReviewMode certFilter={certFilter} onBack={goBackItems} />
        )}
      </div>
    </div>
  );
}
