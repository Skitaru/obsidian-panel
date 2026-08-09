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
  Database
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

  // Server-Erstellung-States (Modal)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createType, setCreateType] = useState<'VANILLA' | 'PAPER' | 'FABRIC'>('PAPER');
  const [createVersion, setCreateVersion] = useState('1.20.4');
  const [createRam, setCreateRam] = useState(2048);
  const [createPort, setCreatePort] = useState(25565);
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

  // Hilfsfunktion für API-Aufrufe mit automatischem JWT-Header
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

  // 1. Authentifizierung bei App-Start prüfen
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

  // Wechsel zwischen Tabs triggert Datenabrufe
  useEffect(() => {
    if (token) {
      if (activeTab === 'dashboard') fetchServers();
      if (activeTab === 'users') fetchUsers();
    }
  }, [activeTab, token]);

  // 2. Regelmäßiges Polling für Server-Status und Auslastung
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(() => {
      if (activeTab === 'dashboard' && !selectedServer) {
        fetchServers();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [activeTab, selectedServer, token]);

  // Live-Auslastung des ausgewählten Servers pollen
  useEffect(() => {
    if (!token || !selectedServer || selectedServer.status !== 'ONLINE') {
      setLiveStats({ cpuPercent: 0, ramUsedMB: 0 });
      return;
    }

    const fetchStats = async () => {
      try {
        const stats = await apiFetch(`/api/servers/${selectedServer.id}/stats`);
        setLiveStats(stats);
      } catch (e) {
        // Ignorieren falls offline
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 3000);
    return () => clearInterval(interval);
  }, [selectedServer, token]);

  // 3. WebSocket-Anbindung für echte Live-Logs
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

  // Login ausführen
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

  // Logout ausführen
  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setSelectedServer(null);
    if (wsRef.current) wsRef.current.close();
  };

  // Server-Aktionen (Start, Stop, Restart)
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

  // Server Löschen (Nur Admin)
  const handleDeleteServer = async (serverId: number) => {
    if (!confirm('Bist du sicher, dass du diesen Server und seinen Container vollständig löschen willst? Die Spieldateien auf der Festplatte bleiben erhalten.')) return;

    try {
      await apiFetch(`/api/servers/${serverId}`, { method: 'DELETE' });
      setSelectedServer(null);
      fetchServers();
    } catch (err: any) {
      alert(`Löschen fehlgeschlagen: ${err.message}`);
    }
  };

  // Neuer Server erstellen (API Request)
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
          port: createPort
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

  // Neuer Benutzer erstellen (Admin)
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

  // Benutzer Löschen
  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Möchtest du diesen Benutzer wirklich löschen?')) return;
    try {
      await apiFetch(`/api/users/${userId}`, { method: 'DELETE' });
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Passwort ändern (Profil)
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

  // Konsolen-Befehl über REST senden (Live-Konsole Fallback)
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

  // Autoscroll für Konsole
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [consoleLogs]);

  // Wenn global geladen wird, Ladebildschirm anzeigen
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

  // LOGIN-SCREEN ANZEIGEN falls nicht authentifiziert
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
                <input 
                  type="text" 
                  className="console-input" 
                  style={{ paddingLeft: '2.75rem', width: '100%' }}
                  placeholder="admin" 
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Passwort</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="password" 
                  className="console-input" 
                  style={{ paddingLeft: '2.75rem', width: '100%' }}
                  placeholder="••••••••" 
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
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
            {user?.role === 'ADMIN' && (
              <li>
                <div 
                  className={`nav-item ${activeTab === 'users' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('users'); setSelectedServer(null); }}
                >
                  <UsersIcon size={18} />
                  <span>Benutzer</span>
                </div>
              </li>
            )}
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

      {/* Main Content */}
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
                          <span className={`badge ${u.role === 'ADMIN' ? 'badge-online' : 'badge-starting'}`} style={{ color: u.role === 'ADMIN' ? '#8b5cf6' : 'inherit', backgroundColor: u.role === 'ADMIN' ? 'rgba(139, 92, 246, 0.1)' : 'inherit' }}>
                            {u.role}
                          </span>
                        </td>
                        <td className="file-td">
                          {u.id !== user.id && (
                            <button className="file-actions-btn" style={{ color: 'var(--color-danger)' }} onClick={() => handleDeleteUser(u.id)} title="Löschen">
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

          {/* SYSTEM METRICS TAB */}
          {activeTab === 'metrics' && (
            <div>
              <h1 className="section-title">VPS Systemauslastung</h1>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: '2.5rem' }}>
                Echtzeit-Statistiken über die physische Maschine, die das Obsidian Panel hostet.
              </p>

              <div className="grid-servers">
                <div className="server-card">
                  <div className="server-info-title">Betriebssystem</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-primary-hover)' }}>Debian 13 (Trixie)</div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Kernel 6.12.38+deb13-amd64</p>
                </div>
                <div className="server-card">
                  <div className="server-info-title">Docker Engine</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-primary-hover)' }}>v29.7.2</div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Docker Compose API aktiv</p>
                </div>
                <div className="server-card">
                  <div className="server-info-title">Sicherheit & Sandbox</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-success)' }}>Aktiviert</div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Docker Socket Proxy vorgeschaltet</p>
                </div>
              </div>
            </div>
          )}

          {/* DASHBOARD TAB (SERVER LIST / DETAIL) */}
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
                  <span>Noch keine Minecraft-Server erstellt. Klicke auf "+ Server Erstellen" um loszulegen!</span>
                </div>
              ) : (
                <div className="grid-servers">
                  {servers.map((srv) => (
                    <div 
                      key={srv.id} 
                      className="server-card"
                      style={{ cursor: 'pointer' }}
                      onClick={() => { setSelectedServer(srv); setServerDetailTab('console'); setConsoleLogs([]); }}
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
                           srv.status === 'OFFLINE' ? 'Offline' : srv.status === 'STARTING' ? 'Startet...' : 'Stoppt...'}
                        </span>
                      </div>

                      <div className="server-stats-grid">
                        <div className="server-stat-item">
                          <span className="stat-label">RAM Limit</span>
                          <span className="stat-value">{(srv.max_ram / 1024).toFixed(0)} GB</span>
                        </div>
                        <div className="server-stat-item">
                          <span className="stat-label">CPU Limit</span>
                          <span className="stat-value">{srv.max_cpu} %</span>
                        </div>
                      </div>

                      {(user?.role === 'ADMIN' || user?.role === 'OPERATOR') && (
                        <div className="server-card-actions">
                          <button 
                            className={`btn ${srv.status === 'OFFLINE' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ flexGrow: 1 }}
                            disabled={srv.status === 'STARTING' || srv.status === 'STOPPING'}
                            onClick={(e) => handleServerAction(srv.id, srv.status === 'OFFLINE' ? 'start' : 'stop', e)}
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
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SERVER DETAIL VIEW */}
          {activeTab === 'dashboard' && selectedServer && (
            <div>
              <div 
                className="back-link"
                onClick={() => { setSelectedServer(null); fetchServers(); }}
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
                  {(user?.role === 'ADMIN' || user?.role === 'OPERATOR') && (
                    <button 
                      className={`btn ${selectedServer.status === 'OFFLINE' ? 'btn-primary' : 'btn-secondary'}`}
                      disabled={selectedServer.status === 'STARTING' || selectedServer.status === 'STOPPING'}
                      onClick={() => handleServerAction(selectedServer.id, selectedServer.status === 'OFFLINE' ? 'start' : 'stop')}
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
                  )}
                  {user?.role === 'ADMIN' && (
                    <button className="btn btn-secondary" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger-bg)' }} onClick={() => handleDeleteServer(selectedServer.id)}>
                      <Trash2 size={16} /> Server Löschen
                    </button>
                  )}
                  <span className={`badge ${
                    selectedServer.status === 'ONLINE' ? 'badge-online' : 
                    selectedServer.status === 'OFFLINE' ? 'badge-offline' : 'badge-starting'
                  }`} style={{ height: 'fit-content', padding: '0.5rem 1rem', fontSize: '0.875rem', alignSelf: 'center' }}>
                    {selectedServer.status === 'ONLINE' ? 'Online' : 
                     selectedServer.status === 'OFFLINE' ? 'Offline' : selectedServer.status === 'STARTING' ? 'Startet...' : 'Stoppt...'}
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
                    {consoleLogs.length === 0 ? (
                      <div className="console-line console-line-system">
                        [System] Keine Log-Einträge vorhanden. Bitte starte den Server, um Ausgaben zu sehen.
                      </div>
                    ) : (
                      consoleLogs.map((log, index) => (
                        <div 
                          key={index} 
                          className={`console-line ${
                            log.type === 'system' ? 'console-line-system' : 
                            log.type === 'error' ? 'console-line-error' : 'console-line-info'
                          }`}
                        >
                          {log.text}
                        </div>
                      ))
                    )}
                    <div ref={consoleEndRef} />
                  </div>

                  <form className="console-input-container" onSubmit={handleSendCommand}>
                    <input 
                      type="text" 
                      className="console-input" 
                      placeholder={selectedServer.status !== 'ONLINE' ? "Konsole inaktiv da Server offline..." : "Gib einen Minecraft-Befehl ein (z.B. help, list, op <name>)..."} 
                      value={commandInput}
                      onChange={(e) => setCommandInput(e.target.value)}
                      disabled={selectedServer.status !== 'ONLINE' || user?.role === 'VIEWER'}
                    />
                    <button 
                      type="submit" 
                      className="btn btn-primary"
                      disabled={selectedServer.status !== 'ONLINE' || user?.role === 'VIEWER'}
                    >
                      <Send size={14} /> Senden
                    </button>
                  </form>

                  {/* Echtzeit-Container Metriken */}
                  <div className="grid-servers" style={{ marginTop: '1rem' }}>
                    <div className="server-card" style={{ padding: '1.25rem', flexDirection: 'row', alignItems: 'center', gap: '1rem', cursor: 'default' }}>
                      <Cpu size={24} style={{ color: 'var(--accent-primary-hover)' }} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="stat-label">CPU-Auslastung</span>
                        <span style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {selectedServer.status === 'ONLINE' ? `${liveStats.cpuPercent} %` : '0 %'}
                        </span>
                      </div>
                    </div>
                    <div className="server-card" style={{ padding: '1.25rem', flexDirection: 'row', alignItems: 'center', gap: '1rem', cursor: 'default' }}>
                      <Activity size={24} style={{ color: 'var(--accent-primary-hover)' }} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="stat-label">Arbeitsspeicher (RAM)</span>
                        <span style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {selectedServer.status === 'ONLINE' ? `${liveStats.ramUsedMB} MB / ${selectedServer.max_ram} MB` : '0 MB'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: FILE MANAGER (MOCK) */}
              {serverDetailTab === 'files' && (
                <div className="file-manager">
                  <div className="file-manager-header">
                    <span className="file-manager-path">Dateipfad: <strong style={{ color: 'var(--text-primary)' }}>/opt/obsidian-panel/servers/srv-{selectedServer.id}/</strong></span>
                  </div>

                  <table className="file-table">
                    <thead>
                      <tr>
                        <th className="file-th" style={{ width: '80%' }}>Name</th>
                        <th className="file-th" style={{ width: '20%' }}>Größe</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="file-row">
                        <td className="file-td file-name-cell">
                          <Folder className="file-icon file-icon-folder" size={16} />
                          <span>plugins/</span>
                        </td>
                        <td className="file-td">-</td>
                      </tr>
                      <tr className="file-row">
                        <td className="file-td file-name-cell">
                          <Folder className="file-icon file-icon-folder" size={16} />
                          <span>world/</span>
                        </td>
                        <td className="file-td">-</td>
                      </tr>
                      <tr className="file-row">
                        <td className="file-td file-name-cell">
                          <File className="file-icon" size={16} />
                          <span>server.properties</span>
                        </td>
                        <td className="file-td">4.2 KB</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 3: SETTINGS (MOCK) */}
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
                          max="8192" 
                          step="1024"
                          value={selectedServer.max_ram}
                          disabled
                          style={{ flexGrow: 1, accentColor: 'var(--accent-primary)', opacity: 0.7 }}
                        />
                        <span style={{ fontWeight: 600, width: '80px', textAlign: 'right' }}>
                          {(selectedServer.max_ram / 1024).toFixed(0)} GB
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                      <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Minecraft Port</label>
                      <input 
                        type="number" 
                        className="console-input" 
                        value={selectedServer.port}
                        disabled
                        style={{ opacity: 0.7, maxWidth: '200px' }}
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Port-Änderungen sind derzeit nur offline über die Konfiguration möglich.</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {/* CREATE SERVER MODAL */}
      {showCreateModal && (
        <div className="modal-overlay" style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="modal-content" style={{ backgroundColor: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '2rem', width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '1.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>Neuen Minecraft-Server erstellen</h2>
            
            {createError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', fontSize: '0.875rem' }}>
                <AlertTriangle size={16} />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateServer} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Servername</label>
                <input type="text" className="console-input" placeholder="Mein Survival Server" value={createName} onChange={(e) => setCreateName(e.target.value)} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Server-Software</label>
                  <select className="console-input" style={{ width: '100%' }} value={createType} onChange={(e: any) => setCreateType(e.target.value)}>
                    <option value="PAPER">Paper (Empfohlen)</option>
                    <option value="VANILLA">Vanilla</option>
                    <option value="FABRIC">Fabric (Mods)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Minecraft-Version</label>
                  <input type="text" className="console-input" placeholder="1.20.4" value={createVersion} onChange={(e) => setCreateVersion(e.target.value)} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>RAM Limit (MB)</label>
                  <input type="number" className="console-input" value={createRam} onChange={(e) => setCreateRam(Number(e.target.value))} required />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Host Port</label>
                  <input type="number" className="console-input" value={createPort} onChange={(e) => setCreatePort(Number(e.target.value))} required />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)} disabled={loading}>Abbrechen</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Erstelle...' : 'Server erstellen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE USER MODAL */}
      {showUserModal && (
        <div className="modal-overlay" style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="modal-content" style={{ backgroundColor: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '2rem', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '1.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>Neuen Benutzer einladen</h2>
            
            {newUserError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', fontSize: '0.875rem' }}>
                <AlertTriangle size={16} />
                <span>{newUserError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Benutzername</label>
                <input type="text" className="console-input" placeholder="basti_player" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} required />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Passwort</label>
                <input type="password" className="console-input" placeholder="••••••••" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} required />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Rolle</label>
                <select className="console-input" style={{ width: '100%' }} value={newUserRole} onChange={(e: any) => setNewUserRole(e.target.value)}>
                  <option value="ADMIN">Administrator</option>
                  <option value="OPERATOR">Operator</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowUserModal(false)} disabled={loading}>Abbrechen</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Erstelle...' : 'Benutzer erstellen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROFILE SETTINGS MODAL */}
      {showProfileModal && (
        <div className="modal-overlay" style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="modal-content" style={{ backgroundColor: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '2rem', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '1.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>Passwort ändern</h2>
            
            {profileMessage && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', fontSize: '0.875rem' }}>
                <CheckCircle size={16} />
                <span>{profileMessage}</span>
              </div>
            )}

            {profileError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', fontSize: '0.875rem' }}>
                <AlertTriangle size={16} />
                <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Aktuelles Passwort</label>
                <input type="password" className="console-input" placeholder="••••••••" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Neues Passwort</label>
                <input type="password" className="console-input" placeholder="Mind. 6 Zeichen" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowProfileModal(false); setProfileError(''); setProfileMessage(''); }} disabled={loading}>Schließen</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Ändere...' : 'Passwort ändern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
