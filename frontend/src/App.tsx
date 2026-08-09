import React, { useState, useEffect, useRef } from 'react';
import { 
  Server, 
  Terminal, 
  Settings as SettingsIcon, 
  Users as UsersIcon, 
  Activity, 
  LogOut, 
  Play, 
  Square, 
  RotateCw, 
  ArrowLeft, 
  File, 
  Folder, 
  Plus, 
  Send, 
  Trash2, 
  Edit3,
  Lock,
  User as UserIcon,
  CheckCircle,
  AlertTriangle,
  Cpu,
  Database,
  Sliders,
  Sparkles,
  Layers,
  ChevronRight,
  Info,
  Maximize2
} from 'lucide-react';

const API_BASE = window.location.origin;

export default function App() {
  // Auth-States
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<any>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // App-Navigation-States
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'metrics'>('dashboard');
  const [selectedServer, setSelectedServer] = useState<any>(null);
  const [serverDetailTab, setServerDetailTab] = useState<'console' | 'files' | 'settings'>('console');

  // Server-Management-States
  const [servers, setServers] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [globalLoading, setGlobalLoading] = useState(true);

  // Advanced Server-Erstellung-States (Basiert exakt auf dem bereitgestellten Screenshot!)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createType, setCreateType] = useState<'PAPER' | 'VANILLA' | 'FABRIC'>('PAPER');
  const [createVersion, setCreateVersion] = useState('26.2');
  const [createPort, setCreatePort] = useState(25566);
  const [createMaxPlayers, setCreateMaxPlayers] = useState(20);
  const [createVoicePort, setCreateVoicePort] = useState<number | ''>(''); // SimpleVoiceChat UDP
  const [createDifficulty, setCreateDifficulty] = useState<'peaceful' | 'easy' | 'normal' | 'hard'>('normal');
  const [createHardcore, setCreateHardcore] = useState<boolean>(false);
  const [createRam, setCreateRam] = useState(4096); // Standard: 4G
  const [createJvmArgs, setCreateJvmArgs] = useState('-XX:+UseZGC -XX:+ZGenerational');
  const [createError, setCreateError] = useState('');

  // User-Erstellung-States
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'ADMIN' | 'OPERATOR' | 'VIEWER'>('VIEWER');
  const [newUserError, setNewUserError] = useState('');

  // Profil-Passwort-Änderung-States
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');

  // Live-Console- & Stats-States
  const [consoleLogs, setConsoleLogs] = useState<Array<{type: 'info' | 'system' | 'error', text: string}>>([]);
  const [commandInput, setCommandInput] = useState('');
  const [liveStats, setLiveStats] = useState({ cpuPercent: 0, ramUsedMB: 0 });
  
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // RAM Presets fürs UI (Exakt wie im Screenshot!)
  const ramPresets = [
    { label: '512M', value: 512 },
    { label: '1G', value: 1024 },
    { label: '2G', value: 2048 },
    { label: '4G', value: 4096 },
    { label: '6G', value: 6144 },
    { label: '8G', value: 8192 },
    { label: '12G', value: 12288 },
    { label: '16G', value: 16384 },
    { label: '24G', value: 24576 },
    { label: '32G', value: 32768 },
    { label: '48G', value: 49152 },
    { label: '64G', value: 65536 },
  ];

  // API-Abfrage Helper
  const apiFetch = async (path: string, options: RequestInit = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    
    if (res.status === 401 || res.status === 403) {
      handleLogout();
      throw new Error('Sitzung abgelaufen. Bitte erneut anmelden.');
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Es ist ein unbekannter Fehler aufgetreten.');
    }
    return data;
  };

  // Authentifizierung bei App-Start
  useEffect(() => {
    const initAuth = async () => {
      if (!token) {
        setGlobalLoading(false);
        return;
      }
      try {
        const data = await apiFetch('/api/auth/me');
        setUser(data.user);
        fetchServers();
      } catch (err) {
        console.error('Fehler bei der Initialisierung:', err);
        handleLogout();
      } finally {
        setGlobalLoading(false);
      }
    };
    initAuth();
  }, [token]);

  // Serverliste abrufen
  const fetchServers = async () => {
    try {
      const data = await apiFetch('/api/servers');
      setServers(data.servers);
    } catch (err) {
      console.error('Fehler beim Abrufen der Server:', err);
    }
  };

  // Benutzerliste abrufen (Nur Admins)
  const fetchUsers = async () => {
    if (user?.role !== 'ADMIN') return;
    try {
      const data = await apiFetch('/api/users');
      setUsersList(data.users);
    } catch (err) {
      console.error('Fehler beim Abrufen der Benutzer:', err);
    }
  };

  // Tab-Wechsel Trigger
  useEffect(() => {
    if (token) {
      if (activeTab === 'dashboard') fetchServers();
      if (activeTab === 'users') fetchUsers();
    }
  }, [activeTab, token]);

  // Server-Polling
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      if (activeTab === 'dashboard' && !selectedServer) {
        fetchServers();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [activeTab, selectedServer, token]);

  // Live-Auslastung pollen
  useEffect(() => {
    if (!token || !selectedServer || selectedServer.status !== 'ONLINE') {
      setLiveStats({ cpuPercent: 0, ramUsedMB: 0 });
      return;
    }

    const fetchStats = async () => {
      try {
        const stats = await apiFetch(`/api/servers/${selectedServer.id}/stats`);
        setLiveStats(stats);
      } catch (e) {}
    };

    fetchStats();
    const interval = setInterval(fetchStats, 3000);
    return () => clearInterval(interval);
  }, [selectedServer, token]);

  // WebSocket Live Logs
  useEffect(() => {
    if (!token || !selectedServer) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log(`Verbinde mit Live-Console WebSocket unter: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'subscribe',
        serverId: selectedServer.id,
        token: token
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'log') {
          setConsoleLogs(prev => [...prev, { type: 'info', text: data.message }]);
        } else if (data.type === 'system') {
          setConsoleLogs(prev => [...prev, { type: 'system', text: data.message }]);
        } else if (data.type === 'error') {
          setConsoleLogs(prev => [...prev, { type: 'error', text: data.message }]);
        }
      } catch (err) {
        setConsoleLogs(prev => [...prev, { type: 'info', text: event.data }]);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket Verbindung geschlossen.');
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [selectedServer, token]);

  // Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);

    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });

      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
    } catch (err: any) {
      setLoginError(err.message || 'Login fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setSelectedServer(null);
    if (wsRef.current) wsRef.current.close();
  };

  // Server-Aktionen
  const handleServerAction = async (serverId: number, action: 'start' | 'stop', e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    setServers(prev => prev.map(s => s.id === serverId ? { ...s, status: action === 'start' ? 'STARTING' : 'STOPPING' } : s));
    if (selectedServer?.id === serverId) {
      setSelectedServer((prev: any) => ({ ...prev, status: action === 'start' ? 'STARTING' : 'STOPPING' }));
      setConsoleLogs(prev => [...prev, { type: 'system', text: `[Obsidian] Sende Signal '${action.toUpperCase()}' an Container...` }]);
    }

    try {
      await apiFetch(`/api/servers/${serverId}/${action}`, { method: 'POST' });
      setTimeout(fetchServers, 1500);
    } catch (err: any) {
      alert(`Aktion fehlgeschlagen: ${err.message}`);
      fetchServers();
    }
  };

  // Server Löschen
  const handleDeleteServer = async (serverId: number) => {
    if (!confirm('Möchtest du diesen Server löschen? Spieldaten bleiben erhalten.')) return;
    try {
      await apiFetch(`/api/servers/${serverId}`, { method: 'DELETE' });
      setSelectedServer(null);
      fetchServers();
    } catch (err: any) {
      alert(`Löschen fehlgeschlagen: ${err.message}`);
    }
  };

  // Echte Server-Erstellung mit allen neuen Werten aus deinem Screenshot!
  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setLoading(true);

    try {
      await apiFetch('/api/servers', {
        method: 'POST',
        body: JSON.stringify({
          name: createName,
          type: createType,
          version: createVersion,
          maxRam: createRam,
          port: createPort,
          maxPlayers: createMaxPlayers,
          voicePort: createVoicePort || null,
          difficulty: createDifficulty,
          hardcore: createHardcore,
          jvmArgs: createJvmArgs
        })
      });

      setShowCreateModal(false);
      setCreateName('');
      setCreatePort(createPort + 1);
      fetchServers();
    } catch (err: any) {
      setCreateError(err.message || 'Fehler beim Erstellen des Servers.');
    } finally {
      setLoading(false);
    }
  };

  // Benutzer erstellen (Admin)
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewUserError('');
    setLoading(true);

    try {
      await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          username: newUsername,
          password: newUserPassword,
          role: newUserRole
        })
      });

      setShowUserModal(false);
      setNewUsername('');
      setNewUserPassword('');
      fetchUsers();
    } catch (err: any) {
      setNewUserError(err.message || 'Fehler beim Erstellen des Benutzers.');
    } finally {
      setLoading(false);
    }
  };

  // Benutzer löschen
  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Möchtest du diesen Benutzer löschen?')) return;
    try {
      await apiFetch(`/api/users/${userId}`, { method: 'DELETE' });
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Passwort ändern
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileMessage('');
    setLoading(true);

    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword, newPassword })
      });
      setProfileMessage('Passwort erfolgreich geändert.');
      setOldPassword('');
      setNewPassword('');
      setTimeout(() => setShowProfileModal(false), 2000);
    } catch (err: any) {
      setProfileError(err.message || 'Fehler beim Passwort ändern.');
    } finally {
      setLoading(false);
    }
  };

  // Konsolenbefehl senden
  const handleSendCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim() || !selectedServer) return;

    const cmd = commandInput;
    setCommandInput('');
    setConsoleLogs(prev => [...prev, { type: 'info', text: `> ${cmd}` }]);

    try {
      await apiFetch(`/api/servers/${selectedServer.id}/command`, {
        method: 'POST',
        body: JSON.stringify({ command: cmd })
      });
    } catch (err: any) {
      setConsoleLogs(prev => [...prev, { type: 'error', text: `[Fehler] Befehl konnte nicht gesendet werden: ${err.message}` }]);
    }
  };

  // Autoscroll
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [consoleLogs]);

  if (globalLoading) {
    return (
      <div className="login-screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: 'var(--bg-darker)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <Database size={48} className="logo-icon" style={{ animation: 'spin 2s linear infinite' }} />
          <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Lade Obsidian Panel...</span>
        </div>
      </div>
    );
  }

  // LOGIN SCREEN
  if (!user) {
    return (
      <div className="login-wrapper" style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-darker)', alignItems: 'center', justifyContent: 'center' }}>
        <div className="login-box" style={{ width: '100%', maxWidth: '400px', backgroundColor: 'var(--bg-dark)', padding: '2.5rem', borderRadius: '0.75rem', border: '1px solid var(--border-color)', boxShadow: '0 4px 30px rgba(0, 0, 0, 0.4)' }}>
          <div className="logo-container" style={{ justifyContent: 'center', marginBottom: '1.5rem' }}>
            <Terminal className="logo-icon" />
            <span style={{ fontSize: '1.5rem' }}>Obsidian Panel</span>
          </div>
          <h2 style={{ textAlign: 'center', fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '2rem', fontWeight: 500 }}>Minecraft Server Management</h2>

          {loginError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              <AlertTriangle size={16} />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Benutzername</label>
              <div style={{ position: 'relative' }}>
                <UserIcon size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type="text" className="console-input" style={{ paddingLeft: '2.75rem', width: '100%' }} placeholder="admin" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} required />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Passwort</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type="password" className="console-input" style={{ paddingLeft: '2.75rem', width: '100%' }} placeholder="••••••••" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.8rem', justifyContent: 'center', fontSize: '1rem', marginTop: '1rem' }} disabled={loading}>
              {loading ? 'Melde an...' : 'Anmelden'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo-container">
          <Terminal className="logo-icon" />
          <span>Obsidian Panel</span>
        </div>

        <nav>
          <ul className="nav-list">
            <li>
              <div className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => { setActiveTab('dashboard'); setSelectedServer(null); }}>
                <Server size={18} />
                <span>Meine Server</span>
              </div>
            </li>
            {user?.role === 'ADMIN' && (
              <li>
                <div className={`nav-item ${activeTab === 'users' ? 'active' : ''}`} onClick={() => { setActiveTab('users'); setSelectedServer(null); }}>
                  <UsersIcon size={18} />
                  <span>Benutzer</span>
                </div>
              </li>
            )}
            <li>
              <div className={`nav-item ${activeTab === 'metrics' ? 'active' : ''}`} onClick={() => { setActiveTab('metrics'); setSelectedServer(null); }}>
                <Activity size={18} />
                <span>Systemauslastung</span>
              </div>
            </li>
          </ul>
        </nav>

        <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className="nav-item" onClick={() => setShowProfileModal(true)}>
            <SettingsIcon size={18} />
            <span>Profil-Einstellungen</span>
          </div>
          <div className="nav-item" onClick={handleLogout} style={{ color: 'var(--color-danger)' }}>
            <LogOut size={18} />
            <span>Abmelden</span>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <main className="main-content">
        <header className="header">
          <div className="header-status">
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={16} style={{ color: 'var(--color-success)' }} />
              <span>VPS verbunden: <strong style={{ color: 'var(--text-primary)' }}>Debian 13 (Trixie)</strong></span>
            </span>
          </div>

          <div className="profile-section" onClick={() => setShowProfileModal(true)}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{user.username} [{user.role}]</span>
            <div className="avatar">{user.username[0].toUpperCase()}</div>
          </div>
        </header>

        <div className="content-body">
          {/* USER TAB */}
          {activeTab === 'users' && user?.role === 'ADMIN' && (
            <div>
              <div className="section-title-container">
                <h1 className="section-title">Benutzer- & Rollenverwaltung</h1>
                <button className="btn btn-primary" onClick={() => setShowUserModal(true)}>
                  <Plus size={16} /> Benutzer anlegen
                </button>
              </div>
              <div className="file-manager" style={{ marginTop: '1.5rem' }}>
                <table className="file-table">
                  <thead>
                    <tr>
                      <th className="file-th">Benutzername</th>
                      <th className="file-th">Rolle</th>
                      <th className="file-th">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map((u) => (
                      <tr key={u.id} className="file-row" style={{ cursor: 'default' }}>
                        <td className="file-td" style={{ fontWeight: 600 }}>{u.username}</td>
                        <td className="file-td">
                          <span className="badge badge-starting">{u.role}</span>
                        </td>
                        <td className="file-td">
                          {u.id !== user.id && (
                            <button className="file-actions-btn" style={{ color: 'var(--color-danger)' }} onClick={() => handleDeleteUser(u.id)}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* METRICS TAB */}
          {activeTab === 'metrics' && (
            <div>
              <h1 className="section-title">VPS Systemauslastung</h1>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: '2.5rem' }}>
                Echtzeit-Statistiken des Host-Systems.
              </p>
              <div className="grid-servers">
                <div className="server-card">
                  <div className="server-info-title">Betriebssystem</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-primary-hover)' }}>Debian 13 (Trixie)</div>
                </div>
                <div className="server-card">
                  <div className="server-info-title">Docker Engine</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-primary-hover)' }}>v29.7.2</div>
                </div>
              </div>
            </div>
          )}

          {/* DASHBOARD */}
          {activeTab === 'dashboard' && !selectedServer && (
            <div>
              <div className="section-title-container">
                <h1 className="section-title">Meine Minecraft Server</h1>
                {(user?.role === 'ADMIN' || user?.role === 'OPERATOR') && (
                  <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                    <Plus size={16} /> Server Erstellen
                  </button>
                )}
              </div>

              {servers.length === 0 ? (
                <div className="server-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  <Server size={32} style={{ color: 'var(--text-muted)' }} />
                  <span>Keine Server vorhanden. Klicke auf "+ Server Erstellen".</span>
                </div>
              ) : (
                <div className="grid-servers">
                  {servers.map((srv) => (
                    <div key={srv.id} className="server-card" style={{ cursor: 'pointer' }} onClick={() => { setSelectedServer(srv); setServerDetailTab('console'); setConsoleLogs([]); }}>
                      <div className="server-card-header">
                        <div>
                          <div className="server-info-title">{srv.name}</div>
                          <div className="server-info-subtitle">{srv.type} {srv.version} • Port {srv.port}</div>
                        </div>
                        <span className={`badge ${srv.status === 'ONLINE' ? 'badge-online' : srv.status === 'OFFLINE' ? 'badge-offline' : 'badge-starting'}`}>
                          {srv.status}
                        </span>
                      </div>
                      <div className="server-stats-grid">
                        <div className="server-stat-item">
                          <span className="stat-label">Max Players</span>
                          <span className="stat-value">{srv.max_players || 20} Players</span>
                        </div>
                        <div className="server-stat-item">
                          <span className="stat-label">RAM Limit</span>
                          <span className="stat-value">{(srv.max_ram / 1024).toFixed(0)} GB</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* DETAILS */}
          {activeTab === 'dashboard' && selectedServer && (
            <div>
              <div className="back-link" onClick={() => { setSelectedServer(null); fetchServers(); }}>
                <ArrowLeft size={16} /> Zurück zur Übersicht
              </div>

              <div className="server-detail-header">
                <div>
                  <h1 className="section-title">{selectedServer.name}</h1>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Port: {selectedServer.port}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-secondary" onClick={() => handleServerAction(selectedServer.id, selectedServer.status === 'OFFLINE' ? 'start' : 'stop')}>
                    {selectedServer.status === 'OFFLINE' ? 'Starten' : 'Stoppen'}
                  </button>
                  {user?.role === 'ADMIN' && (
                    <button className="btn btn-secondary" style={{ color: 'var(--color-danger)' }} onClick={() => handleDeleteServer(selectedServer.id)}>
                      Löschen
                    </button>
                  )}
                </div>
              </div>

              <div className="detail-nav">
                <div className={`detail-nav-item ${serverDetailTab === 'console' ? 'active' : ''}`} onClick={() => setServerDetailTab('console')}>Live-Konsole</div>
                <div className={`detail-nav-item ${serverDetailTab === 'files' ? 'active' : ''}`} onClick={() => setServerDetailTab('files')}>Datei-Manager</div>
              </div>

              {serverDetailTab === 'console' && (
                <div className="console-layout">
                  <div className="console-output">
                    {consoleLogs.map((log, i) => (
                      <div key={i} className={`console-line ${log.type === 'system' ? 'console-line-system' : 'console-line-info'}`}>{log.text}</div>
                    ))}
                    <div ref={consoleEndRef} />
                  </div>
                  <form onSubmit={handleSendCommand} className="console-input-container">
                    <input type="text" className="console-input" placeholder="Befehl eingeben..." value={commandInput} onChange={(e) => setCommandInput(e.target.value)} />
                    <button type="submit" className="btn btn-primary">Senden</button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ADVANCED CREATE SERVER MODAL (EXAKT WIE IM SCREENSHOT!) */}
      {showCreateModal && (
        <div className="modal-overlay" style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5, 4, 10, 0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem', backdropFilter: 'blur(10px)' }}>
          <div className="modal-content" style={{ backgroundColor: '#0c0a12', border: '1px solid #1f1b2e', borderRadius: '0.85rem', padding: '2.5rem', width: '100%', maxWidth: '820px', display: 'flex', flexDirection: 'column', gap: '2rem', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.75)', overflowY: 'auto', maxHeight: '90vh' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1c182c', paddingBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #584d7a' }}>
                  <Server size={24} style={{ color: '#8b5cf6' }} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f3f4f6', letterSpacing: '-0.02em' }}>Create Server</h2>
                  <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginTop: '0.15rem' }}>Set up a new Minecraft server instance</p>
                </div>
              </div>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '0.5rem' }}>
                <Maximize2 size={20} />
              </button>
            </div>

            {createError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', fontSize: '0.875rem' }}>
                <AlertTriangle size={16} />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateServer} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {/* Grid 2 Spalten */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem' }}>
                
                {/* LINKE SPALTE: Basic Information */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid #1c182c', paddingBottom: '0.75rem' }}>
                    <Info size={18} style={{ color: '#8b5cf6' }} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600, fontSize: '1rem', color: '#f3f4f6' }}>Basic Information</span>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Server identity</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#f3f4f6' }}>Server Name <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="text" className="console-input" style={{ backgroundColor: '#07050d', borderColor: '#211c33', padding: '0.85rem 1.25rem' }} placeholder="e.g. Survival World" value={createName} onChange={(e) => setCreateName(e.target.value)} required />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#f3f4f6' }}>Server Type</label>
                    <select className="console-input" style={{ backgroundColor: '#07050d', borderColor: '#211c33', padding: '0.85rem 1.25rem', width: '100%' }} value={createType} onChange={(e: any) => setCreateType(e.target.value)}>
                      <option value="PAPER">PaperMC (Vanilla)</option>
                      <option value="VANILLA">Vanilla Official</option>
                      <option value="FABRIC">FabricMC (Mods)</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#f3f4f6' }}>Minecraft Version</label>
                    <select className="console-input" style={{ backgroundColor: '#07050d', borderColor: '#211c33', padding: '0.85rem 1.25rem', width: '100%' }} value={createVersion} onChange={(e) => setCreateVersion(e.target.value)}>
                      <option value="26.2">26.2</option>
                      <option value="1.21">1.21</option>
                      <option value="1.20.4">1.20.4</option>
                    </select>
                  </div>
                </div>

                {/* RECHTE SPALTE: Configuration */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid #1c182c', paddingBottom: '0.75rem' }}>
                    <Sliders size={18} style={{ color: '#8b5cf6' }} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600, fontSize: '1rem', color: '#f3f4f6' }}>Configuration</span>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Performance & network</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#f3f4f6' }}>Port</label>
                      <input type="number" className="console-input" style={{ backgroundColor: '#07050d', borderColor: '#211c33', padding: '0.85rem 1.25rem' }} value={createPort} onChange={(e) => setCreatePort(Number(e.target.value))} required />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#f3f4f6' }}>Max Players</label>
                      <input type="number" className="console-input" style={{ backgroundColor: '#07050d', borderColor: '#211c33', padding: '0.85rem 1.25rem' }} value={createMaxPlayers} onChange={(e) => setCreateMaxPlayers(Number(e.target.value))} required />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#f3f4f6' }}>Voice Port (UDP)</label>
                    <input type="number" className="console-input" style={{ backgroundColor: '#07050d', borderColor: '#211c33', padding: '0.85rem 1.25rem' }} placeholder="e.g. 24454 (SimpleVoiceChat)" value={createVoicePort} onChange={(e) => setCreateVoicePort(e.target.value === '' ? '' : Number(e.target.value))} />
                    <span style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.15rem' }}>Leave empty if you don't need voice chat. Requires container recreation to change later.</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#f3f4f6' }}>Difficulty</label>
                      <select className="console-input" style={{ backgroundColor: '#07050d', borderColor: '#211c33', padding: '0.85rem 1.25rem', width: '100%' }} value={createDifficulty} onChange={(e: any) => setCreateDifficulty(e.target.value)}>
                        <option value="peaceful">Peaceful</option>
                        <option value="easy">Easy</option>
                        <option value="normal">Normal</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#f3f4f6' }}>Hardcore</label>
                      <div onClick={() => setCreateHardcore(!createHardcore)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '44px', border: '1px solid #211c33', borderRadius: '0.5rem', backgroundColor: createHardcore ? 'rgba(239, 68, 68, 0.1)' : '#07050d', color: createHardcore ? '#ef4444' : '#9ca3af', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s ease' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: createHardcore ? '#ef4444' : '#6b7280', marginRight: '0.5rem' }}></span>
                        {createHardcore ? 'On' : 'Off'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* UNTERER BLOCK: RAM Presets */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid #1c182c', paddingTop: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f3f4f6' }}>RAM <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 400 }}>(max 39 GB available)</span></label>
                  <span style={{ color: '#8b5cf6', fontWeight: 700 }}>{(createRam / 1024).toFixed(1).replace('.0', '')} GB</span>
                </div>
                <input type="number" className="console-input" style={{ backgroundColor: '#07050d', borderColor: '#211c33', padding: '0.85rem 1.25rem', width: '100%', fontWeight: 700, fontSize: '1.125rem' }} value={createRam} onChange={(e) => setCreateRam(Number(e.target.value))} required />
                
                {/* RAM Preset Buttons */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {ramPresets.map((preset) => (
                    <button key={preset.value} type="button" onClick={() => setCreateRam(preset.value)} style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: '1px solid', borderColor: createRam === preset.value ? '#8b5cf6' : '#1c182c', backgroundColor: createRam === preset.value ? 'rgba(139, 92, 246, 0.15)' : '#07050d', color: createRam === preset.value ? '#a78bfa' : '#9ca3af', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease' }}>
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* UNTERER BLOCK: JVM Arguments */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f3f4f6' }}>JVM Arguments</label>
                <textarea className="console-input" style={{ backgroundColor: '#07050d', borderColor: '#211c33', padding: '1rem', width: '100%', fontFamily: 'monospace', fontSize: '0.875rem', height: '80px', resize: 'none' }} placeholder="Custom JVM flags e.g. -XX:+UseZGC" value={createJvmArgs} onChange={(e) => setCreateJvmArgs(e.target.value)} />
                <span style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.15rem' }}>-Xms and -Xmx are auto-set from RAM. Leave empty for optimized defaults.</span>
              </div>

              {/* BUTTONS */}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', borderTop: '1px solid #1c182c', paddingTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flexGrow: 1, padding: '1rem', justifyContent: 'center' }} onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flexGrow: 2, padding: '1rem', justifyContent: 'center', backgroundColor: '#8b5cf6', fontWeight: 700 }} disabled={loading}>
                  {loading ? 'Creating Server...' : 'Create Server'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* USER MODAL */}
      {showUserModal && (
        <div className="modal-overlay" style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="modal-content" style={{ backgroundColor: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '2rem', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Neuen Benutzer einladen</h2>
            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <input type="text" className="console-input" placeholder="Benutzername" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} required />
              <input type="password" className="console-input" placeholder="Passwort" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} required />
              <select className="console-input" style={{ width: '100%' }} value={newUserRole} onChange={(e: any) => setNewUserRole(e.target.value)}>
                <option value="ADMIN">Administrator</option>
                <option value="OPERATOR">Operator</option>
                <option value="VIEWER">Viewer</option>
              </select>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowUserModal(false)}>Abbrechen</button>
                <button type="submit" className="btn btn-primary">Erstellen</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROFILE SETTINGS MODAL */}
      {showProfileModal && (
        <div className="modal-overlay" style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="modal-content" style={{ backgroundColor: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '2rem', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Passwort ändern</h2>
            {profileMessage && <div style={{ color: 'var(--color-success)' }}>{profileMessage}</div>}
            {profileError && <div style={{ color: 'var(--color-danger)' }}>{profileError}</div>}
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <input type="password" className="console-input" placeholder="Aktuelles Passwort" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required />
              <input type="password" className="console-input" placeholder="Neues Passwort" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowProfileModal(false)}>Schließen</button>
                <button type="submit" className="btn btn-primary">Ändern</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
