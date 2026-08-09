import React, { useState, useEffect, useRef } from 'react';
import { 
  Server, 
  Terminal, 
  FolderOpen, 
  Settings as SettingsIcon, 
  Users as UsersIcon, 
  Activity, 
  ShieldAlert, 
  LogOut, 
  Play, 
  Square, 
  RotateCw, 
  ArrowLeft, 
  ChevronRight, 
  File, 
  Folder, 
  Plus, 
  Send, 
  Trash2, 
  Edit3 
} from 'lucide-react';

// Mock-Daten für Minecraft-Server
const INITIAL_SERVERS = [
  {
    id: 1,
    name: "Survival Welt",
    type: "Paper",
    version: "1.20.4",
    port: 25565,
    status: "ONLINE", // ONLINE, OFFLINE, STARTING
    ramUsed: 1820,
    ramMax: 4096,
    cpuUsed: 12.5,
    players: "3/20",
  },
  {
    id: 2,
    name: "Vanilla Hardcore",
    type: "Vanilla",
    version: "1.21",
    port: 25566,
    status: "OFFLINE",
    ramUsed: 0,
    ramMax: 2048,
    cpuUsed: 0,
    players: "0/10",
  },
  {
    id: 3,
    name: "Modded Fabric",
    type: "Fabric",
    version: "1.20.1",
    port: 25567,
    status: "STARTING",
    ramUsed: 980,
    ramMax: 6144,
    cpuUsed: 45.2,
    players: "0/0",
  }
];

const INITIAL_FILES = [
  { name: "plugins", isDirectory: true, size: "-" },
  { name: "world", isDirectory: true, size: "-" },
  { name: "server.properties", isDirectory: false, size: "4.2 KB" },
  { name: "spigot.yml", isDirectory: false, size: "12 KB" },
  { name: "banned-players.json", isDirectory: false, size: "128 B" },
  { name: "ops.json", isDirectory: false, size: "256 B" },
];

export default function App() {
  const [servers, setServers] = useState(INITIAL_SERVERS);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'metrics'>('dashboard');
  const [selectedServer, setSelectedServer] = useState<any>(null);
  const [serverDetailTab, setServerDetailTab] = useState<'console' | 'files' | 'settings'>('console');
  
  // Console-States
  const [consoleLogs, setConsoleLogs] = useState<Array<{type: 'info' | 'system' | 'error', text: string}>>([
    { type: 'system', text: "[Obsidian] Verbindung zum Server established." },
    { type: 'info', text: "[12:30:15 INFO]: Starting minecraft server version 1.20.4" },
    { type: 'info', text: "[12:30:17 INFO]: Loading properties" },
    { type: 'info', text: "[12:30:18 INFO]: Default game type: SURVIVAL" },
    { type: 'info', text: "[12:30:22 INFO]: Preparing level \"world\"" },
    { type: 'info', text: "[12:30:31 INFO]: Done (13.4s)! For help, type \"help\"" }
  ]);
  const [commandInput, setCommandInput] = useState('');
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // File Manager-States
  const [currentFiles, setCurrentFiles] = useState(INITIAL_FILES);
  const [fileManagerPath, setFileManagerPath] = useState('/');

  // Automatischer Log-Streamer für einen coolen "Live-Effekt" im Dashboard und der Konsole
  useEffect(() => {
    const interval = setInterval(() => {
      // Fluktuationen in Systemauslastungen simulieren
      setServers(prev => prev.map(srv => {
        if (srv.status === 'ONLINE') {
          const deltaCpu = (Math.random() - 0.5) * 4;
          const deltaRam = (Math.random() - 0.5) * 15;
          return {
            ...srv,
            cpuUsed: Math.max(2, Math.min(95, Number((srv.cpuUsed + deltaCpu).toFixed(1)))),
            ramUsed: Math.max(500, Math.min(srv.ramMax, Math.round(srv.ramUsed + deltaRam)))
          };
        }
        if (srv.status === 'STARTING') {
          if (Math.random() > 0.8) {
            return { ...srv, status: 'ONLINE', cpuUsed: 8.5, ramUsed: 1540 };
          }
        }
        return srv;
      }));

      // Falls die Konsole aktiv ist, simulieren wir gelegentlich Server-Meldungen
      if (selectedServer && selectedServer.status === 'ONLINE' && serverDetailTab === 'console') {
        const randomLogs = [
          "[12:34:02 INFO]: Player 'GamerGuy32' joined the game",
          "[12:34:02 INFO]: GamerGuy32[/127.0.0.1:54321] logged in with entity id 120 at (102.5, 64.0, -250.3)",
          "[12:35:15 INFO]: <GamerGuy32> Hallo zusammen! Das Panel läuft echt flüssig.",
          "[12:37:44 INFO]: Saving chunks for level 'world'/minecraft:overworld",
        ];
        if (Math.random() > 0.6) {
          const randomText = randomLogs[Math.floor(Math.random() * randomLogs.length)];
          setConsoleLogs(prev => [...prev, { type: 'info', text: randomText }]);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [selectedServer, serverDetailTab]);

  useEffect(() => {
    // Autoscroll für Konsole
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [consoleLogs]);

  // Server-Aktionen
  const toggleServerStatus = (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation(); // Verhindert das Öffnen der Detail-Ansicht beim Klick auf Buttons
    setServers(prev => prev.map(srv => {
      if (srv.id === id) {
        let nextStatus = "OFFLINE";
        let cpu = 0;
        let ram = 0;
        
        if (srv.status === 'OFFLINE') {
          nextStatus = "STARTING";
          cpu = 65.4;
          ram = 512;
          
          if (selectedServer?.id === id) {
            setConsoleLogs(prevLogs => [
              ...prevLogs, 
              { type: 'system', text: `[Obsidian] Starte Container für '${srv.name}'...` },
              { type: 'info', text: "[System INFO]: Docker run CMD mapped successfully." }
            ]);
          }
        } else if (srv.status === 'ONLINE' || srv.status === 'STARTING') {
          nextStatus = "OFFLINE";
          
          if (selectedServer?.id === id) {
            setConsoleLogs(prevLogs => [
              ...prevLogs, 
              { type: 'system', text: `[Obsidian] Stoppe Container für '${srv.name}'...` },
              { type: 'info', text: "[System INFO]: Container received SIGTERM." }
            ]);
          }
        }

        const updated = { ...srv, status: nextStatus, cpuUsed: cpu, ramUsed: ram };
        if (selectedServer?.id === id) {
          setSelectedServer(updated);
        }
        return updated;
      }
      return srv;
    }));
  };

  // Befehl senden in der Konsole
  const handleSendCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;

    setConsoleLogs(prev => [
      ...prev, 
      { type: 'info', text: `> ${commandInput}` }
    ]);

    // Antwort simulieren
    const cmd = commandInput.toLowerCase();
    setTimeout(() => {
      if (cmd === 'list') {
        setConsoleLogs(prev => [...prev, { type: 'info', text: "[12:38:01 INFO]: There are 3 of a max 20 players online: GamerGuy32, Minecrafter99, CreepFinder" }]);
      } else if (cmd.startsWith('op ')) {
        const user = commandInput.substring(3);
        setConsoleLogs(prev => [...prev, { type: 'info', text: `[12:38:05 INFO]: Made ${user} a server operator` }]);
      } else if (cmd === 'help') {
        setConsoleLogs(prev => [...prev, { 
          type: 'info', 
          text: "[12:38:10 INFO]: Verfügbare Befehle: list, op <Spieler>, say <Nachricht>, stop" 
        }]);
      } else {
        setConsoleLogs(prev => [...prev, { type: 'info', text: `[12:38:12 INFO]: Befehl '${commandInput}' wurde an den Server übermittelt.` }]);
      }
    }, 400);

    setCommandInput('');
  };

  // Neuen Server erstellen (Simuliert)
  const handleCreateServer = () => {
    const newId = servers.length + 1;
    const newServer = {
      id: newId,
      name: `Minecraft Server #${newId}`,
      type: "Paper",
      version: "1.20.4",
      port: 25565 + servers.length,
      status: "OFFLINE",
      ramUsed: 0,
      ramMax: 3072,
      cpuUsed: 0,
      players: "0/20",
    };
    setServers([...servers, newServer]);
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo-container">
          <Terminal className="logo-icon" />
          <span>Obsidian Panel</span>
        </div>

        <nav>
          <ul className="nav-list">
            <li>
              <div 
                className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => { setActiveTab('dashboard'); setSelectedServer(null); }}
              >
                <Server size={18} />
                <span>Meine Server</span>
              </div>
            </li>
            <li>
              <div 
                className={`nav-item ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => { setActiveTab('users'); setSelectedServer(null); }}
              >
                <UsersIcon size={18} />
                <span>Benutzer</span>
              </div>
            </li>
            <li>
              <div 
                className={`nav-item ${activeTab === 'metrics' ? 'active' : ''}`}
                onClick={() => { setActiveTab('metrics'); setSelectedServer(null); }}
              >
                <Activity size={18} />
                <span>Systemauslastung</span>
              </div>
            </li>
          </ul>
        </nav>

        <div className="sidebar-footer">
          <div className="nav-item">
            <LogOut size={18} />
            <span>Abmelden</span>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <main className="main-content">
        {/* Header */}
        <header className="header">
          <div className="header-status">
            <div className="status-metric">
              <span>Host CPU:</span>
              <div className="metric-bar-outer">
                <div className="metric-bar-inner" style={{ width: '45%' }}></div>
              </div>
              <span style={{ fontWeight: 600 }}>45%</span>
            </div>
            <div className="status-metric">
              <span>Host RAM:</span>
              <div className="metric-bar-outer">
                <div className="metric-bar-inner" style={{ width: '62%' }}></div>
              </div>
              <span style={{ fontWeight: 600 }}>9.9 GB / 16.0 GB</span>
            </div>
          </div>

          <div className="profile-section">
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Admin [Owner]</span>
            <div className="avatar">A</div>
          </div>
        </header>

        {/* Dynamic Content */}
        <div className="content-body">
          
          {/* USER MANAGEMENT TAB */}
          {activeTab === 'users' && (
            <div>
              <div className="section-title-container">
                <h1 className="section-title">Benutzer- & Rollenverwaltung</h1>
                <button className="btn btn-primary">
                  <Plus size={16} /> Benutzer einladen
                </button>
              </div>
              
              <div className="file-manager" style={{ marginTop: '1.5rem' }}>
                <table className="file-table">
                  <thead>
                    <tr>
                      <th className="file-th">Benutzername</th>
                      <th className="file-th">Rolle</th>
                      <th className="file-th">Zugriff auf Server</th>
                      <th className="file-th">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="file-row">
                      <td className="file-td" style={{ fontWeight: 600 }}>admin</td>
                      <td className="file-td">
                        <span className="badge badge-online" style={{ color: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.1)' }}>Super-Admin</span>
                      </td>
                      <td className="file-td">Alle Server (Unbeschränkt)</td>
                      <td className="file-td">
                        <button className="file-actions-btn" title="Passwort ändern"><Edit3 size={14} /></button>
                      </td>
                    </tr>
                    <tr className="file-row">
                      <td className="file-td" style={{ fontWeight: 600 }}>basti_player</td>
                      <td className="file-td">
                        <span className="badge badge-starting">Operator</span>
                      </td>
                      <td className="file-td">Survival Welt, Modded Fabric</td>
                      <td className="file-td">
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="file-actions-btn" title="Bearbeiten"><Edit3 size={14} /></button>
                          <button className="file-actions-btn" style={{ color: 'var(--color-danger)' }} title="Löschen"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SYSTEM METRICS TAB */}
          {activeTab === 'metrics' && (
            <div>
              <h1 className="section-title">Host Systemauslastung</h1>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: '2.5rem' }}>
                Echtzeit-Statistiken über die physische Maschine, die das Obsidian Panel hostet.
              </p>

              <div className="grid-servers">
                <div className="server-card">
                  <div className="server-info-title">Prozessor (CPU)</div>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-primary-hover)' }}>45.2 %</div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>4 Kerne (AMD Ryzen 5 3600 vCore)</p>
                </div>
                <div className="server-card">
                  <div className="server-info-title">Arbeitsspeicher (RAM)</div>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-primary-hover)' }}>9.92 GB / 16.00 GB</div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>62.0% Belegt (6.08 GB frei)</p>
                </div>
                <div className="server-card">
                  <div className="server-info-title">Festplattenspeicher (SSD)</div>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-success)' }}>128.4 GB / 512.0 GB</div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>25.1% Belegt (383.6 GB frei)</p>
                </div>
              </div>
            </div>
          )}

          {/* DASHBOARD TAB (SERVER LIST / DETAIL) */}
          {activeTab === 'dashboard' && !selectedServer && (
            <div>
              <div className="section-title-container">
                <h1 className="section-title">Meine Minecraft Server</h1>
                <button className="btn btn-primary" onClick={handleCreateServer}>
                  <Plus size={16} /> Server Erstellen
                </button>
              </div>

              <div className="grid-servers">
                {servers.map((srv) => (
                  <div 
                    key={srv.id} 
                    className="server-card"
                    style={{ cursor: 'pointer' }}
                    onClick={() => { setSelectedServer(srv); setServerDetailTab('console'); }}
                  >
                    <div className="server-card-header">
                      <div>
                        <div className="server-info-title">{srv.name}</div>
                        <div className="server-info-subtitle">
                          {srv.type} {srv.version} • Port {srv.port}
                        </div>
                      </div>
                      <span className={`badge ${
                        srv.status === 'ONLINE' ? 'badge-online' : 
                        srv.status === 'OFFLINE' ? 'badge-offline' : 'badge-starting'
                      }`}>
                        {srv.status === 'ONLINE' ? 'Online' : 
                         srv.status === 'OFFLINE' ? 'Offline' : 'Startet...'}
                      </span>
                    </div>

                    <div className="server-stats-grid">
                      <div className="server-stat-item">
                        <span className="stat-label">CPU Auslastung</span>
                        <span className="stat-value">{srv.status === 'OFFLINE' ? '0 %' : `${srv.cpuUsed} %`}</span>
                      </div>
                      <div className="server-stat-item">
                        <span className="stat-label">Arbeitsspeicher</span>
                        <span className="stat-value">
                          {srv.status === 'OFFLINE' ? '0 MB' : `${srv.ramUsed} MB / ${srv.ramMax} MB`}
                        </span>
                      </div>
                    </div>

                    <div className="server-card-actions">
                      <button 
                        className={`btn ${srv.status === 'OFFLINE' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flexGrow: 1 }}
                        onClick={(e) => toggleServerStatus(srv.id, e)}
                      >
                        {srv.status === 'OFFLINE' ? (
                          <>
                            <Play size={14} /> Starten
                          </>
                        ) : (
                          <>
                            <Square size={14} /> Stoppen
                          </>
                        )}
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        title="Neu starten"
                        disabled={srv.status === 'OFFLINE'}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleServerStatus(srv.id);
                          setTimeout(() => toggleServerStatus(srv.id), 1000);
                        }}
                      >
                        <RotateCw size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SERVER DETAIL VIEW */}
          {activeTab === 'dashboard' && selectedServer && (
            <div>
              <div 
                className="back-link"
                onClick={() => setSelectedServer(null)}
              >
                <ArrowLeft size={16} /> Zurück zur Übersicht
              </div>

              <div className="server-detail-header">
                <div>
                  <h1 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {selectedServer.name} 
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                      ({selectedServer.type} {selectedServer.version})
                    </span>
                  </h1>
                  <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem', fontSize: '0.875rem' }}>
                    Port: {selectedServer.port} • Container-ID: <code style={{ color: 'var(--accent-primary-hover)' }}>obsidian-srv-{selectedServer.id}</code>
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    className={`btn ${selectedServer.status === 'OFFLINE' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => toggleServerStatus(selectedServer.id)}
                  >
                    {selectedServer.status === 'OFFLINE' ? (
                      <>
                        <Play size={16} /> Server Starten
                      </>
                    ) : (
                      <>
                        <Square size={16} /> Server Stoppen
                      </>
                    )}
                  </button>
                  <span className={`badge ${
                    selectedServer.status === 'ONLINE' ? 'badge-online' : 
                    selectedServer.status === 'OFFLINE' ? 'badge-offline' : 'badge-starting'
                  }`} style={{ height: 'fit-content', padding: '0.5rem 1rem', fontSize: '0.875rem', alignSelf: 'center' }}>
                    {selectedServer.status === 'ONLINE' ? 'Online' : 
                     selectedServer.status === 'OFFLINE' ? 'Offline' : 'Startet...'}
                  </span>
                </div>
              </div>

              {/* Navigation inside Server Details */}
              <div className="detail-nav">
                <div 
                  className={`detail-nav-item ${serverDetailTab === 'console' ? 'active' : ''}`}
                  onClick={() => setServerDetailTab('console')}
                >
                  Live-Konsole
                </div>
                <div 
                  className={`detail-nav-item ${serverDetailTab === 'files' ? 'active' : ''}`}
                  onClick={() => setServerDetailTab('files')}
                >
                  Datei-Manager
                </div>
                <div 
                  className={`detail-nav-item ${serverDetailTab === 'settings' ? 'active' : ''}`}
                  onClick={() => setServerDetailTab('settings')}
                >
                  Einstellungen
                </div>
              </div>

              {/* TAB 1: LIVE CONSOLE */}
              {serverDetailTab === 'console' && (
                <div className="console-layout">
                  <div className="console-output">
                    {consoleLogs.map((log, index) => (
                      <div 
                        key={index} 
                        className={`console-line ${
                          log.type === 'system' ? 'console-line-system' : 
                          log.type === 'error' ? 'console-line-error' : 'console-line-info'
                        }`}
                      >
                        {log.text}
                      </div>
                    ))}
                    <div ref={consoleEndRef} />
                  </div>

                  <form className="console-input-container" onSubmit={handleSendCommand}>
                    <input 
                      type="text" 
                      className="console-input" 
                      placeholder={selectedServer.status !== 'ONLINE' ? "Konsole inaktiv da Server offline..." : "Gib einen Minecraft-Befehl ein (z.B. help, list, op <name>)..."} 
                      value={commandInput}
                      onChange={(e) => setCommandInput(e.target.value)}
                      disabled={selectedServer.status !== 'ONLINE'}
                    />
                    <button 
                      type="submit" 
                      className="btn btn-primary"
                      disabled={selectedServer.status !== 'ONLINE'}
                    >
                      <Send size={14} /> Senden
                    </button>
                  </form>

                  {/* Little Container stats */}
                  <div className="grid-servers" style={{ marginTop: '1rem' }}>
                    <div className="server-card" style={{ padding: '1rem' }}>
                      <span className="stat-label">CPU-Kern-Limit</span>
                      <div style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: '0.25rem' }}>
                        {selectedServer.status === 'OFFLINE' ? '0 %' : `${selectedServer.cpuUsed} % / 100 % (1 Core)`}
                      </div>
                    </div>
                    <div className="server-card" style={{ padding: '1rem' }}>
                      <span className="stat-label">RAM-Limitierung</span>
                      <div style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: '0.25rem' }}>
                        {selectedServer.status === 'OFFLINE' ? '0 MB' : `${selectedServer.ramUsed} MB / ${selectedServer.ramMax} MB`}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: FILE MANAGER */}
              {serverDetailTab === 'files' && (
                <div className="file-manager">
                  <div className="file-manager-header">
                    <span className="file-manager-path">Dateipfad: <strong style={{ color: 'var(--text-primary)' }}>/home/obsidian/servers/srv-{selectedServer.id}{fileManagerPath}</strong></span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                        <Plus size={12} /> Neuer Ordner
                      </button>
                      <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                        Datei hochladen
                      </button>
                    </div>
                  </div>

                  <table className="file-table">
                    <thead>
                      <tr>
                        <th className="file-th" style={{ width: '60%' }}>Name</th>
                        <th className="file-th" style={{ width: '20%' }}>Größe</th>
                        <th className="file-th" style={{ width: '20%', textAlign: 'right' }}>Aktionen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fileManagerPath !== '/' && (
                        <tr 
                          className="file-row"
                          onClick={() => setFileManagerPath('/')}
                        >
                          <td className="file-td file-name-cell">
                            <span style={{ color: 'var(--accent-primary-hover)' }}>.. (Zurück)</span>
                          </td>
                          <td className="file-td">-</td>
                          <td className="file-td"></td>
                        </tr>
                      )}
                      {currentFiles.map((file, i) => (
                        <tr 
                          key={i} 
                          className="file-row"
                          onClick={() => {
                            if (file.isDirectory) {
                              setFileManagerPath(`/${file.name}/`);
                            }
                          }}
                        >
                          <td className="file-td file-name-cell">
                            {file.isDirectory ? (
                              <Folder className="file-icon file-icon-folder" size={16} />
                            ) : (
                              <File className="file-icon" size={16} />
                            )}
                            <span>{file.name}</span>
                          </td>
                          <td className="file-td">{file.size}</td>
                          <td className="file-td" style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '0.25rem' }}>
                              {!file.isDirectory && (
                                <button className="file-actions-btn" title="Editieren"><Edit3 size={14} /></button>
                              )}
                              <button className="file-actions-btn" style={{ color: 'var(--color-danger)' }} title="Löschen"><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 3: SETTINGS */}
              {serverDetailTab === 'settings' && (
                <div className="server-card" style={{ gap: '1.5rem', cursor: 'default' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>Ressourcen & Limits</h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Arbeitsspeicher (RAM Limit)</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <input 
                          type="range" 
                          min="1024" 
                          max="16384" 
                          step="1024"
                          value={selectedServer.ramMax}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setServers(prev => prev.map(s => s.id === selectedServer.id ? { ...s, ramMax: val } : s));
                            setSelectedServer(prev => ({ ...prev, ramMax: val }));
                          }}
                          style={{ flexGrow: 1, accentColor: 'var(--accent-primary)' }}
                        />
                        <span style={{ fontWeight: 600, width: '80px', textAlign: 'right' }}>
                          {(selectedServer.ramMax / 1024).toFixed(0)} GB
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                      <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Minecraft Port</label>
                      <input 
                        type="number" 
                        className="console-input" 
                        value={selectedServer.port}
                        disabled
                        style={{ opacity: 0.7, maxWidth: '200px' }}
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Port-Änderungen sind derzeit nur bei Offline-Servern möglich (In diesem Prototyp gesperrt).</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                      <button className="btn btn-primary" onClick={() => alert("Einstellungen gespeichert!")}>
                        Änderungen Speichern
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
