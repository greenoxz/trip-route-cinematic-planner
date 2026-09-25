import React from 'react';
import { MapView } from './components/MapView';
import { Sidebar } from './components/Sidebar';
import { Timeline } from './components/Timeline';

function App() {
  return (
    <div className="relative w-full h-screen bg-gray-900 text-white flex flex-col">
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 relative">
          <MapView />
        </main>
      </div>
      <Timeline />
    </div>
  );
}

export default App;
