/**
 *--------------------------------------------------------------------------------
 * __          ___           _                      _  _   
 * \ \        / (_)         | |                    | || |  
 *  \ \  /\  / / _ _ __  ___| |_ ___  _ __   __   _| || |_ 
 *   \ \/  \/ / | | '_ \/ __| __/ _ \| '_ \  \ \ / /__   _|
 *    \  /\  /  | | | | \__ \ || (_) | | | |  \ V /   | |  
 *     \/  \/   |_|_| |_|___/\__\___/|_| |_|   \_/    |_|  
 *--------------------------------------------------------------------------------
 *
 * @website   -  https://cavira.app/products/Winston
 * @github    -  https://github.com/CaviraOSS/Winston
 * @discord   -  https://discord.gg/76QMKwj2J4
 * 
 * @author    -  Cavira OSS <recabasic@cavira.app>
 * @copyright -  2026 Cavira OSS
 * @version   -  4.0.0 - ESM
 *
 *--------------------------------------------------------------------------------
 * server.js - Application webserver.
 *--------------------------------------------------------------------------------
**/

import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
//import { WebSocketServer } from 'ws';
import sessions from './sessions.js';
import colors from '../../utils/colors.js';

const resHeaders = {
    'X-Powered-By': 'Winston/4.0.0'
};

function server(options = {}) {
    const ROUTES = [];
    const WARES = [];
    //const WS_ROUTES = [];
    //const wss = new WebSocketServer({ noServer: true });

    if (options.cors && options.cors.enabled === true) {
        resHeaders['Access-Control-Allow-Origin'] = options.cors.origin || '*';
        resHeaders['Access-Control-Allow-Methods'] = options.cors.methods || 'GET, POST, PUT, DELETE';
        resHeaders['Access-Control-Allow-Headers'] = options.cors.headers || 'Content-Type, Authorization';
    } else {
        resHeaders['Access-Control-Allow-Origin'] = '*';
        resHeaders['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE';
        resHeaders['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    }

    const parseQuery = (qs) => {
        const q = {};
        if (!qs) return q;
        const pairs = qs.split('&');
        for (let i = 0; i < pairs.length; i++) {
            const [k, v] = pairs[i].split('=');
            if (k) q[decodeURIComponent(k)] = v ? decodeURIComponent(v) : '';
        }
        return q;
    };

    const handleRequest = (req, res) => {
        req.startTime = process.hrtime.bigint();

        const qIndex = req.url.indexOf('?');
        req.path = qIndex !== -1 ? req.url.substring(0, qIndex) : req.url;
        req.query = qIndex !== -1 ? parseQuery(req.url.substring(qIndex + 1)) : {};

        req.hostname = (req.headers.host || '').split(':')[0].replace(/[^\w.-]/g, '');
        req.ip = (req.socket.remoteAddress || '').replace(/[^\w.:]/g, '');
        req.params = {};
        req.bodySize = 0;

        req.on('data', (chunk) => {
            if (chunk) req.bodySize += chunk.length;
        });
        res.status = (code) => {
            res.statusCode = code ?? 200;
            return res;
        };

        req.cookies = {
            "get": function (req, a) {
                let b = req.headers.cookie;
                if (!b) return null;
                let d = a + "=";
                let ca = b.split(';');
                for (let i = 0; i < ca.length; i++) {
                    let c = ca[i];
                    while (c.charAt(0) == ' ') {
                        c = c.substring(1);
                    }
                    if (c.indexOf(d) == 0) {
                        return decodeURIComponent(c.substring(d.length, c.length));
                    }
                }
                return "";
            },
            "set": function (res, a, b) {
                let c = `${encodeURIComponent(a)}=${encodeURIComponent(b)}`;
                c += `; Max-Age=${30 * 24 * 60 * 60}`;
                c += `; Path=/`;
                c += `; Secure`;
                c += `; SameSite=Strict`;
                res.setHeader('Set-Cookie', c);
            },
            "delete": function (res, a) {
                let c = `${encodeURIComponent(a)}=;`;
                c += `; Max-Age=0`;
                c += `; Path=/`;
                c += `; Secure`;
                c += `; SameSite=Strict`;
                res.setHeader('Set-Cookie', c);
            },
            "all": function (req) {
                let b = req.headers.cookie;
                if (!b) return null;
                let ca = b.split(';');
                let cookies = {};
                for (let i = 0; i < ca.length; i++) {
                    let c = ca[i];
                    while (c.charAt(0) == ' ') {
                        c = c.substring(1);
                    }
                    let eq = c.indexOf("=");
                    if (eq > -1) {
                        let name = decodeURIComponent(c.substring(0, eq));
                        let value = decodeURIComponent(c.substring(eq + 1, c.length));
                        cookies[name] = value;
                    }
                }
                return cookies;
            }
        }

        const originalEnd = res.end;
        res.end = function (...args) {
            let responseLength = 0;
            if (args.length > 0 && args[0] !== undefined && args[0] !== null) {
                const chunk = args[0];
                if (Buffer.isBuffer(chunk)) {
                    responseLength = chunk.length;
                } else if (typeof chunk === 'string') {
                    responseLength = Buffer.byteLength(chunk, 'utf8');
                } else if (typeof chunk !== 'function') {
                    responseLength = Buffer.byteLength(String(chunk), 'utf8');
                }
            }

            if (!res.headersSent && res.getHeader('Content-Length') === undefined) {
                resHeaders['Content-Length'] = responseLength;
            }

            if (!res.headersSent) {
                res.writeHead(res.statusCode || 200, resHeaders);
            }

            const duration = (Number(process.hrtime.bigint() - req.startTime) / 1e6).toFixed(2);
            originalEnd.apply(res, args);

            let color = res.statusCode >= 500 ? "red" : res.statusCode >= 400 ? "yellow" : "green";
            console.log(`${colors[color](res.statusCode)} ${req.method} ${req.path} in ${colors.magenta(duration)}ms`);

            const LOG_DIR = process.env.LOGS_ACCESS_DIR || './app/logs/access';
            let date = new Date();
            const name = `${LOG_DIR}/${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}.log`;
            fs.appendFileSync(name, `[${date.toTimeString().split(' ')[0]}] ${req.path} | ${req.method} | ${req.ip} | ${res.statusCode} | ${duration}ms | ${res.getHeader('Content-Length') || responseLength}\n`);
            return;
        };

        res.json = (data) => {
            const payload = JSON.stringify(data);
            const payloadLength = Buffer.byteLength(payload, 'utf8');
            resHeaders['Content-Type'] = 'application/json';
            resHeaders['Content-Length'] = payloadLength;
            res.writeHead(res.statusCode || 200, resHeaders);
            res.end(payload);
        };

        let matchedRoute = null;
        for (let i = 0; i < ROUTES.length; i++) {
            const r = ROUTES[i];
            if (r.method !== req.method && r.method !== 'ALL') continue;

            if (r.isStatic) {
                if (r.path === req.path || r.path === '*') {
                    matchedRoute = r;
                    break;
                }
            } else {
                const u = req.path.split('/').filter(Boolean);
                if (r.segments.length !== u.length) continue;

                let matched = true;
                const params = {};
                for (let j = 0; j < r.segments.length; j++) {
                    const seg = r.segments[j];
                    if (seg.charCodeAt(0) === 58) {
                        params[seg.slice(1)] = decodeURIComponent(u[j] || '');
                    } else if (seg !== u[j]) {
                        matched = false;
                        break;
                    }
                }
                if (matched) {
                    req.params = params;
                    matchedRoute = r;
                    break;
                }
            }
        }

        const fns = [...WARES];
        if (matchedRoute) {
            fns.push(matchedRoute.handler);
        } else {
            fns.push((_req, res) => res.status(404).end('404: Not Found'));
        }

        let idx = 0;
        const next = () => {
            if (idx < fns.length) {
                try {
                    fns[idx++](req, res, next);
                } catch (err) {
                    console.error(err);
                    if (!res.headersSent) res.status(500).end('Internal Server Error');
                }
            }
        };
        next();
    };

    const HTTP_SERVER = http.createServer(handleRequest);
    const HTTPS_SERVER = options.ssl && options.ssl.key && options.ssl.cert
        ? https.createServer({ key: options.ssl.key, cert: options.ssl.cert }, handleRequest)
        : null;

    /* const handleUpgrade = (req, socket, head) => {
        const qIndex = req.url.indexOf('?');
        const pathName = qIndex !== -1 ? req.url.substring(0, qIndex) : req.url;

        if (!pathName || pathName.includes('..') || /[\0-\x1F\x7F]/.test(pathName)) {
            socket.destroy();
            return;
        }

        let matched = false;
        for (let i = 0; i < WS_ROUTES.length; i++) {
            const r = WS_ROUTES[i];
            if (r.path === pathName) {
                matched = true;
                wss.handleUpgrade(req, socket, head, (ws) => {
                    req.hostname = (req.headers.host || '').split(':')[0].replace(/[^\w.-]/g, '');
                    req.ip = (req.socket.remoteAddress || '').replace(/[^\w.:]/g, '');
                    ws.req = req;
                    r.handler(ws, req);
                });
                break;
            }
        }
        if (!matched) socket.destroy();
    }; */

    /* HTTP_SERVER.on('upgrade', handleUpgrade);
    if (HTTPS_SERVER) HTTPS_SERVER.on('upgrade', handleUpgrade); */

    const add = (method, routePath, handler) => {
        const segments = routePath.split('/').filter(Boolean);
        const isStatic = !routePath.includes(':');
        ROUTES.push({
            method: method.toUpperCase(),
            path: routePath,
            segments,
            isStatic,
            handler
        });
    };

    const use = (ware) => WARES.push(ware);
    const listen = (portOrPorts, cb) => {
        let httpPort;
        let httpsPort = null;

        if (typeof portOrPorts === 'object') {
            httpPort = portOrPorts.http;
            httpsPort = portOrPorts.https;
        } else {
            httpPort = portOrPorts;
        }

        const errorHandler = (portType, portNum) => (err) => {
            if (err.code === 'EACCES') {
                console.error(`[SERVER] Error: Permission denied. Cannot bind to ${portType} port ${portNum}. Try running with sudo or configuring a reverse proxy.`);
                process.exit(1);
            } else if (err.code === 'EADDRINUSE') {
                console.error(`[SERVER] Error: ${portType} Port ${portNum} is already in use.`);
                process.exit(1);
            } else {
                console.error(`[SERVER] Error on ${portType}:`, err);
                process.exit(1);
            }
        };

        HTTP_SERVER.setTimeout(10000);
        HTTP_SERVER.on('error', errorHandler('HTTP', httpPort));

        if (HTTPS_SERVER && httpsPort) {
            let running = 0;
            HTTP_SERVER.listen(httpPort, '0.0.0.0', () => { if (++running === 2 && cb) cb(); });
            HTTPS_SERVER.setTimeout(10000);
            HTTPS_SERVER.on('error', errorHandler('HTTPS', httpsPort));
            HTTPS_SERVER.listen(httpsPort, '0.0.0.0', () => { if (++running === 2 && cb) cb(); });
        } else {
            HTTP_SERVER.listen(httpPort, '0.0.0.0', cb);
        }

        return HTTPS_SERVER || HTTP_SERVER;
    };

    const staticServe = (endpoint, dir) => {
        const absDir = path.resolve(dir);
        if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) {
            console.error(`[STATIC] Directory not found: ${absDir}`);
            return (req, res, next) => next();
        }

        const prefix = endpoint.endsWith('/') ? endpoint : endpoint + '/';
        const mimeTypes = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.txt': 'text/plain',
            '.ico': 'image/x-icon',
            '.png': 'image/png',
            '.webp': 'image/webp',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml'
        };

        return (req, res, next) => {
            if (req.method !== 'GET' && req.method !== 'HEAD') return next();
            if (!req.path.startsWith(prefix)) return next();

            let subpath;
            try {
                subpath = decodeURIComponent(req.path.substring(prefix.length));
            } catch {
                return res.status(400).end('Bad Request');
            }

            if (subpath.includes('\0') || subpath.includes('..')) return res.status(403).end('Forbidden');

            const filePath = path.join(absDir, subpath);
            if (!filePath.startsWith(absDir)) return res.status(403).end('Forbidden');

            fs.stat(filePath, (err, stats) => {
                if (err || !stats.isFile()) return next();

                const ext = path.extname(filePath).toLowerCase();

                resHeaders['Content-Type'] = mimeTypes[ext] || 'application/octet-stream';
                resHeaders['Content-Length'] = stats.size;

                res.writeHead(200, resHeaders);

                if (req.method === 'HEAD') return res.end();
                fs.createReadStream(filePath).pipe(res);
            });
        };
    };

    use((req, res, next) => {
        if (req.headers['content-type']?.includes('application/json')) {
            const chunks = [];
            let length = 0;
            const max = 1048576;
            let errorTriggered = false;

            const onData = (chunk) => {
                length += chunk.length;
                if (length > max) {
                    errorTriggered = true;
                    req.removeListener('data', onData);
                    req.removeListener('end', onEnd);
                    res.status(413).end('Payload Too Large');
                    req.destroy();
                } else {
                    chunks.push(chunk);
                }
            };

            const onEnd = () => {
                if (errorTriggered) return;
                try {
                    const bodyString = Buffer.concat(chunks).toString();
                    req.body = bodyString ? JSON.parse(bodyString) : null;
                } catch {
                    req.body = null;
                }
                next();
            };

            req.on('data', onData);
            req.on('end', onEnd);
            req.on('error', () => {
                if (!errorTriggered) {
                    errorTriggered = true;
                    res.status(400).end('Bad Request');
                }
            });
        } else {
            next();
        }
    });

    return {
        use,
        listen,
        static: staticServe,
        routes: ROUTES,
        getRoutes: () => ROUTES.reduce((acc, { method, path }) => {
            (acc[method] = acc[method] || []).push(path);
            return acc;
        }, {}),
        sessions,
        get: (a, b) => add('GET', a, b),
        post: (a, b) => add('POST', a, b),
        put: (a, b) => add('PUT', a, b),
        delete: (a, b) => add('DELETE', a, b),
        patch: (a, b) => add('PATCH', a, b),
        options: (a, b) => add('OPTIONS', a, b),
        head: (a, b) => add('HEAD', a, b),
        all: (a, b) => add('ALL', a, b),
        //ws: (a, b) => WS_ROUTES.push({ path: a, handler: b })
    };
}

export default server;

/**
 *--------------------------------------------------------------------------------
 * @EOF - End Of File
 *--------------------------------------------------------------------------------
**/