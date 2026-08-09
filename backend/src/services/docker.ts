import Docker from 'dockerode';
import path from 'path';
import fs from 'fs';

// Dockerode initialisieren (nutzt automatisch DOCKER_HOST oder /var/run/docker.sock)
const docker = new Docker();

/**
 * Zieht das aktuelle Minecraft-Image herunter (itzg/minecraft-server)
 */
export async function pullMinecraftImage(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("Ziehe Minecraft-Docker-Image (itzg/minecraft-server:latest)...");
    docker.pull('itzg/minecraft-server:latest', {}, (err, stream) => {
      if (err) return reject(err);
      
      docker.modem.followProgress(stream, (finishedErr) => {
        if (finishedErr) return reject(finishedErr);
        console.log("Minecraft-Docker-Image erfolgreich heruntergeladen.");
        resolve();
      });
    });
  });
}

/**
 * Erstellt einen neuen Minecraft-Server-Container
 * @param serverId Die ID des Servers in der SQLite Datenbank
 * @param name Der Name des Servers
 * @param type VANILLA, PAPER oder FABRIC
 * @param version Minecraft Version (z.B. LATEST, 1.20.4)
 * @param maxRam Maximaler Arbeitsspeicher in MB (z.B. 2048)
 * @param port Der externe Port auf dem Host (z.B. 25565)
 */
export async function createMinecraftContainer(
  serverId: number,
  name: string,
  type: 'VANILLA' | 'PAPER' | 'FABRIC',
  version: string,
  maxRam: number,
  port: number
): Promise<string> {
  // Pfad für Serverdateien erstellen
  const hostServersPath = process.env.HOST_SERVERS_PATH || '/opt/obsidian-panel/servers';
  const serverDataPath = path.join(hostServersPath, `srv-${serverId}`);

  // Stelle sicher, dass das Verzeichnis existiert
  if (!fs.existsSync(serverDataPath)) {
    fs.mkdirSync(serverDataPath, { recursive: true });
  }

  // Docker Image ziehen falls nicht vorhanden
  try {
    await pullMinecraftImage();
  } catch (err) {
    console.warn("Fehler beim ZIEHEN des Images (vielleicht offline?), fahre trotzdem fort:", err);
  }

  // Container-Konfiguration erstellen
  const containerName = `obsidian-srv-${serverId}`;
  const container = await docker.createContainer({
    Image: 'itzg/minecraft-server:latest',
    name: containerName,
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
    OpenStdin: true,
    StdinOnce: false,
    Env: [
      'EULA=TRUE',
      `TYPE=${type}`,
      `VERSION=${version}`,
      `MEMORY=${maxRam}M`,
      'PUID=1000', // Non-Root User ID
      'PGID=1000', // Non-Root Group ID
      'OVERRIDE_SERVER_PROPERTIES=true',
      `SERVER_PORT=25565`, // Interner Minecraft Port
    ],
    ExposedPorts: {
      '25565/tcp': {},
      '25565/udp': {}
    },
    HostConfig: {
      PortBindings: {
        '25565/tcp': [{ HostPort: port.toString() }],
        '25565/udp': [{ HostPort: port.toString() }]
      },
      Binds: [
        `${serverDataPath}:/data` // Minecraft Spieldaten auf dem Host persistieren
      ],
      RestartPolicy: {
        Name: 'always'
      }
    }
  });

  return container.id;
}

/**
 * Startet einen Minecraft-Server
 */
export async function startServer(containerId: string): Promise<void> {
  const container = docker.getContainer(containerId);
  await container.start();
}

/**
 * Stoppt einen Minecraft-Server sicher
 */
export async function stopServer(containerId: string): Promise<void> {
  const container = docker.getContainer(containerId);
  
  // Wir versuchen, zuerst "stop" an die Minecraft-Konsole zu senden
  try {
    await sendServerCommand(containerId, 'stop');
    // Warte maximal 15 Sekunden auf den regulären Stopp
    let retries = 15;
    while (retries > 0) {
      const state = await getContainerState(containerId);
      if (state === 'OFFLINE') return;
      await new Promise(resolve => setTimeout(resolve, 1000));
      retries--;
    }
  } catch (err) {
    console.warn("Konnte '/stop' nicht senden, erzwinge Docker Stop:", err);
  }

  // Erzwinge Container Stop, falls /stop fehlgeschlagen ist
  await container.stop({ t: 10 });
}

/**
 * Erzwingt den sofortigen Stopp des Containers (Kill)
 */
export async function killServer(containerId: string): Promise<void> {
  const container = docker.getContainer(containerId);
  await container.kill();
}

/**
 * Löscht einen Minecraft-Server-Container vollständig
 */
export async function deleteServerContainer(containerId: string): Promise<void> {
  const container = docker.getContainer(containerId);
  try {
    await container.stop({ t: 2 });
  } catch (e) {}
  await container.remove({ force: true });
}

/**
 * Ermittelt den aktuellen Status eines Containers ('ONLINE', 'OFFLINE', 'STARTING', etc.)
 */
export async function getContainerState(containerId: string): Promise<'ONLINE' | 'OFFLINE' | 'STARTING' | 'STOPPING'> {
  try {
    const container = docker.getContainer(containerId);
    const data = await container.inspect();
    const status = data.State.Status;

    if (status === 'running') {
      // In einem echten Setup könnte man hier noch prüfen, ob der RCON/Minecraft Port lauscht
      // Für diesen Prototyp mappen wir "running" auf ONLINE
      return 'ONLINE';
    } else if (status === 'restarting') {
      return 'STARTING';
    } else if (status === 'exited' || status === 'created') {
      return 'OFFLINE';
    } else {
      return 'OFFLINE';
    }
  } catch (error) {
    return 'OFFLINE';
  }
}

/**
 * Sendet einen Konsolenbefehl an den Minecraft Server (per stdin-Attach)
 */
export async function sendServerCommand(containerId: string, command: string): Promise<void> {
  const container = docker.getContainer(containerId);
  
  // Erstelle einen attach-Stream für stdin
  const stream = await container.attach({
    stream: true,
    stdin: true,
    stdout: false,
    stderr: false
  });

  // Minecraft-Befehl schreiben (mit Newline beenden)
  stream.write(command + '\n');
  stream.end();
}

/**
 * Streamt die Echtzeit-Konsolenausgabe eines Containers
 * @param containerId Container-ID
 * @param onLog Callback-Funktion für Logzeilen
 */
export function streamContainerLogs(containerId: string, onLog: (data: string) => void): any {
  const container = docker.getContainer(containerId);
  
  // Docker logs streamen (letzte 100 Zeilen holen und neue streamen)
  container.logs(
    {
      follow: true,
      stdout: true,
      stderr: true,
      tail: 100,
      timestamps: false
    },
    (err, stream) => {
      if (err || !stream) {
        console.error("Fehler beim Logs-Streamen:", err);
        return;
      }

      // Stream zerlegen und Logs zeilenweise ausgeben
      stream.on('data', (chunk: Buffer) => {
        // Docker multiplexed den Log-Header (8 Bytes). Wir schneiden diesen ab.
        let offset = 0;
        while (offset < chunk.length) {
          if (chunk.length - offset < 8) break;
          const size = chunk.readUInt32BE(offset + 4);
          const message = chunk.toString('utf8', offset + 8, offset + 8 + size);
          onLog(message);
          offset += 8 + size;
        }
      });

      stream.on('end', () => {
        console.log(`Log stream für ${containerId} beendet.`);
      });
    }
  );
}

/**
 * Holt die CPU- & RAM-Auslastung eines Containers
 */
export async function getContainerStats(containerId: string): Promise<{ cpuPercent: number; ramUsedMB: number }> {
  try {
    const container = docker.getContainer(containerId);
    // Hole einmaligen Stats-Snapshot
    const stats: any = await container.stats({ stream: false });

    // 1. RAM Berechnung
    const ramUsedBytes = stats.memory_stats.usage || 0;
    const ramUsedMB = Math.round(ramUsedBytes / 1024 / 1024);

    // 2. CPU Prozent Berechnung (Docker-Spezifisch)
    let cpuPercent = 0;
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const numCores = stats.cpu_stats.online_cpus || 1;

    if (systemDelta > 0 && cpuDelta > 0) {
      cpuPercent = Number(((cpuDelta / systemDelta) * numCores * 100).toFixed(1));
    }

    return { cpuPercent, ramUsedMB };
  } catch (error) {
    return { cpuPercent: 0, ramUsedMB: 0 };
  }
}
