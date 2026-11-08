import { useEffect, useState } from 'react';
import { CircleDot, CloudOff, Dices, Inbox as InboxIcon, LayoutGrid, List, Orbit as OrbitIcon, Plus, Search, Settings2, Sparkles } from 'lucide-react';
import { CaptureBar } from './components/CaptureBar';
import { Constellation } from './components/Constellation';
import { Inbox } from './components/Inbox';
import { NewProjectDialog } from './components/NewProjectDialog';
import { ProjectList } from './components/ProjectList';
import { ProjectPanel } from './components/ProjectPanel';
import { RandomProjectDialog } from './components/RandomProjectDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { useOrbitStore } from './store';

export default function App() {
  const initialize = useOrbitStore((state) => state.initialize);
  const loading = useOrbitStore((state) => state.loading);
  const view = useOrbitStore((state) => state.view);
  const setView = useOrbitStore((state) => state.setView);
  const search = useOrbitStore((state) => state.search);
  const setSearch = useOrbitStore((state) => state.setSearch);
  const selectedProjectId = useOrbitStore((state) => state.selectedProjectId);
  const entries = useOrbitStore((state) => state.entries);
  const toast = useOrbitStore((state) => state.toast);
  const settings = useOrbitStore((state) => state.settings);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showRandom, setShowRandom] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const inboxCount = entries.filter((entry) => !entry.projectId && entry.state !== 'dropped').length;

  useEffect(() => { void initialize(); }, [initialize]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  if (loading) return <div className="app-loading"><div className="loading-orbit"><OrbitIcon size={36} /><i /></div><span>Opening your orbit…</span></div>;

  return (
    <div className={`app ${settings.reducedMotion ? 'reduce-motion' : ''}`}>
      <header className="app-header">
        <button className="brand" onClick={() => setView('constellation')} aria-label="Orbit home"><span className="brand-mark"><CircleDot size={20} /></span><b>ORBIT</b></button>
        <nav className="primary-nav" aria-label="Main navigation">
          <button className={view === 'constellation' ? 'is-active' : ''} onClick={() => setView('constellation')}><LayoutGrid size={16} /> Constellation</button>
          <button className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')}><List size={16} /> List</button>
          <button className={view === 'inbox' ? 'is-active' : ''} onClick={() => setView('inbox')}><InboxIcon size={16} /> Inbox {inboxCount > 0 && <span>{inboxCount}</span>}</button>
        </nav>
        <div className="header-actions">
          {!online && <span className="offline-badge"><CloudOff size={13} /> Offline</span>}
          <button className="pick-button" onClick={() => setShowRandom(true)}><Dices size={16} /> Pick for me</button>
          <button className="icon-button" onClick={() => setShowSettings(true)} aria-label="Settings"><Settings2 size={18} /></button>
        </div>
      </header>

      <div className="workspace-toolbar">
        <div className="workspace-title"><span><Sparkles size={14} /></span><div><small>YOUR WORKSPACE</small><b>{view === 'constellation' ? 'The big picture' : view === 'list' ? 'Every project' : 'Loose thoughts'}</b></div></div>
        <label className="search-field"><Search size={16} /><span className="sr-only">Search Orbit</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your orbit" /></label>
        <button className="new-project-button" onClick={() => setShowNewProject(true)}><Plus size={17} /> New project</button>
      </div>

      <main className="workspace">
        {view === 'constellation' && <Constellation onNewProject={() => setShowNewProject(true)} />}
        {view === 'list' && <ProjectList />}
        {view === 'inbox' && <Inbox />}
      </main>

      <CaptureBar />
      {selectedProjectId && <ProjectPanel />}
      <NewProjectDialog open={showNewProject} onClose={() => setShowNewProject(false)} />
      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
      <RandomProjectDialog open={showRandom} onClose={() => setShowRandom(false)} />
      {toast && <div className="toast" role="status">{toast}</div>}

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <button className={view === 'constellation' ? 'is-active' : ''} onClick={() => setView('constellation')}><LayoutGrid size={20} /><span>Map</span></button>
        <button className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')}><List size={20} /><span>List</span></button>
        <button className="mobile-add" onClick={() => setShowNewProject(true)}><Plus size={23} /></button>
        <button className={view === 'inbox' ? 'is-active' : ''} onClick={() => setView('inbox')}><InboxIcon size={20} /><span>Inbox</span>{inboxCount > 0 && <i>{inboxCount}</i>}</button>
        <button onClick={() => setShowSettings(true)}><Settings2 size={20} /><span>More</span></button>
      </nav>
    </div>
  );
}

