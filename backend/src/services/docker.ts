import Docker from 'dockerode';
import path from 'path';
import fs from 'fs';

const docker = new Docker();

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
 * Erstellt einen neuen Minecraft-Server-Container mit erweiterten Parametern
 */
export async function createMinecraftContainer(
  serverId: number,
  name: string,
  type: 'VANILLA' | 'PAPER' | 'FABRIC',
  version: string,
  maxRam: number,
  port: number,
  maxPlayers: number = 20,
  voicePort: number | null = null,
  difficulty: 'peaceful' | 'easy' | 'normal' | 'hard' = 'normal',
  hardcore: boolean = false,
  jvmArgs: string | null = null
): Promise<string> {
  const hostServersPath = process.env.HOST_SERVERS_PATH || '/opt/obsidian-panel/servers';
  const serverDataPath = path.join(hostServersPath, `srv-${serverId}`);

  if (!fs.existsSync(serverDataPath)) {
    fs.mkdirSync(serverDataPath, { recursive: true });
  }

  try {
    await pullMinecraftImage();
  } catch (err) {
    console.warn("Fehler beim ZIEHEN des Images:", err);
  }

  const containerName = `obsidian-srv-${serverId}`;
  
  // Docker Umgebungsvariablen für das itzg/minecraft-server-Image vorbereiten
  const env = [
    'EULA=TRUE',
    `TYPE=${type}`,
    `VERSION=${version}`,
    `MEMORY=${maxRam}M`,
    'PUID=1000',
    'PGID=1000',
    'OVERRIDE_SERVER_PROPERTIES=true',
    `SERVER_PORT=25565`,
    `DIFFICULTY=${difficulty.toUpperCase()}`,
    `HARDCORE=${hardcore ? 'TRUE' : 'FALSE'}`,
    `MAX_PLAYERS=${maxPlayers}`,
  ];

  if (jvmArgs && jvmArgs.trim() !== '') {
    env.push(`JVM_OPTS=${jvmArgs}`);
  }

  // Port-Bindings vorbereiten
  const portBindings: any = {
    '25565/tcp': [{ HostPort: port.toString() }],
    '25565/udp': [{ HostPort: port.toString() }]
  };

  const exposedPorts: any = {
    '25565/tcp': {},
    '25565/udp': {}
  };

  // UDP-Voice-Port (z.B. für Simple Voice Chat Mod) mappen falls definiert
  if (voicePort) {
    exposedPorts[`${voicePort}/udp`] = {};
    portBindings[`${voicePort}/udp`] = [{ HostPort: voicePort.toString() }];
    env.push(`ENABLE_VOICE_CHAT=true`);
    env.push(`VOICE_CHAT_PORT=${voicePort}`);
  }

  const container = await docker.createContainer({
    Image: 'itzg/minecraft-server:latest',
    name: containerName,
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
    OpenStdin: true,
    StdinOnce: false,
    Env: env,
    ExposedPorts: exposedPorts,
    HostConfig: {
      PortBindings: portBindings,
      Binds: [
        `${serverDataPath}:/data`
      ],
      RestartPolicy: {
        Name: 'always'
      }
    }
  });

  return container.id;
}

export async function startServer(containerId: string): Promise<void> {
  const container = docker.getContainer(containerId);
  await container.start();
}

export async function stopServer(containerId: string): Promise<void> {
  const container = docker.getContainer(containerId);
  try {
    await sendServerCommand(containerId, 'stop');
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
  await container.stop({ t: 10 });
}

export async function killServer(containerId: string): Promise<void> {
  const container = docker.getContainer(containerId);
  await container.kill();
}

export async function deleteServerContainer(containerId: string): Promise<void> {
  const container = docker.getContainer(containerId);
  try {
    await container.stop({ t: 2 });
  } catch (e) {}
  await container.remove({ force: true });
}

export async function getContainerState(containerId: string): Promise<'ONLINE' | 'OFFLINE' | 'STARTING' | 'STOPPING'> {
  try {
    const container = docker.getContainer(containerId);
    const data = await container.inspect();
    const status = data.State.Status;

    if (status === 'running') {
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

export async function sendServerCommand(containerId: string, command: string): Promise<void> {
  const container = docker.getContainer(containerId);
  const stream = await container.attach({
    stream: true,
    stdin: true,
    stdout: false,
    stderr: false
  });
  stream.write(command + '\n');
  stream.end();
}

export function streamContainerLogs(containerId: string, onLog: (data: string) => void): any {
  const container = docker.getContainer(containerId);
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

      stream.on('data', (chunk: Buffer) => {
        let offset = 0;
        while (offset < chunk.length) {
          if (chunk.length - offset < 8) break;
          const size = chunk.readUInt32BE(offset + 4);
          const message = chunk.toString('utf8', offset + 8, offset + 8 + size);
          onLog(message);
          offset += 8 + size;
        }
      });
    }
  );
}

export async function getContainerStats(containerId: string): Promise<{ cpuPercent: number; ramUsedMB: number }> {
  try {
    const container = docker.getContainer(containerId);
    const stats: any = await container.stats({ stream: false });

    const ramUsedBytes = stats.memory_stats.usage || 0;
    const ramUsedMB = Math.round(ramUsedBytes / 1024 / 1024);

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
