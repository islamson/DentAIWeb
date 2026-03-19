import { useState } from 'react';
import { AppSidebar } from '../components/app-sidebar';
import { AppHeader } from '../components/app-header';
import { AIChatDrawer } from '../components/ai/AIChatDrawer';

export default function AppLayout({ children }) {
  const [aiChatOpen, setAiChatOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader onOpenAIChat={() => setAiChatOpen(true)} />
        <main className="flex-1 overflow-y-auto bg-background p-6">
          {children}
        </main>
      </div>
      <AIChatDrawer open={aiChatOpen} onOpenChange={setAiChatOpen} />
    </div>
  );
}

