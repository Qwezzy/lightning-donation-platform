import net from 'net';

const startPort = 8081;
const endPort = 8085;

console.log(`Scanning ports ${startPort}-${endPort} for LND REST...`);

const checkPort = (port) => {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(200);

        socket.on('connect', () => {
            console.log(`✅ Found open port: ${port}`);
            socket.destroy();
            resolve(port);
        });

        socket.on('timeout', () => {
            socket.destroy();
            resolve(null);
        });

        socket.on('error', (err) => {
            socket.destroy();
            resolve(null);
        });

        socket.connect(port, '127.0.0.1');
    });
};

(async () => {
    for (let port = startPort; port <= endPort; port++) {
        await checkPort(port);
    }
    console.log('Scan complete.');
})();
