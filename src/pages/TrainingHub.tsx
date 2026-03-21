import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import Navbar from '@/components/Navbar';
import Breadcrumb from '@/components/Breadcrumb';
import { HubView } from '@/components/training/HubView';
import { WeaknessMode } from '@/components/training/WeaknessMode';
import { DailyReviewMode } from '@/components/training/DailyReviewMode';
import { FlashcardReviewMode } from '@/components/training/FlashcardReviewMode';

export default function TrainingHub() {
  const { isAuthenticated } = useAuthStore();
  const [certFilter, setCertFilter] = useState<string>('');
  const [activeMode, setActiveMode] = useState<'hub' | 'weakness' | 'daily' | 'flashcard'>('hub');

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: '/training' }} replace />;
  }

  const goBackItems = () => setActiveMode('hub');

  return (
    <div className="min-h-screen bg-background">
      <Navbar title="Training Hub" />
      
      <div className="container pt-24 pb-16 space-y-8">
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
