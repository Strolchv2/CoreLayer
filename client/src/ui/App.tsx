import { useEffect, useState } from 'react';
import { ChatScreen } from './ChatScreen';
import { useMessenger, storage } from './session';
import { Onboarding } from './Onboarding';

export function App() {
  const messenger = useMessenger();
  const [hasVault, setHasVault] = useState<boolean | null>(null);

  useEffect(() => {
    if (messenger) return;
    storage
      .load()
      .then((f) => setHasVault(!!f))
      .catch(() => setHasVault(false));
  }, [messenger]);

  if (messenger) return <ChatScreen messenger={messenger} />;
  if (hasVault === null) return <div className="center muted">Loading…</div>;
  return <Onboarding hasVault={hasVault} />;
}
