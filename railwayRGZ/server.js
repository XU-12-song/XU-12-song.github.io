#!/usr/bin/env node
/**
 * server.js —— 本地小服务（零依赖，只用 Node 内置模块）
 *
 *   1) 静态托管本目录：浏览器打开 http://127.0.0.1:5178 就能直接玩游戏
 *      （走 http:// 比 file:// 更像真实环境，贴图加载也更省心）
 *   2) 打开 http://127.0.0.1:5178/upload.html 上传角色贴图：
 *      先选「熊大 / 奶龙」，再选图片，立刻写入 assets/xiongda.png | assets/nailong.png
 *
 * 用法：  node server.js
 *        PORT=8080 node server.js   换端口
 *        HOST=0.0.0.0 node server.js  让同局域网的手机也能访问
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const ASSETS = path.join(ROOT, 'assets');
const PORT = Number(process.env.PORT) || 5178;
const HOST = process.env.HOST || '127.0.0.1';
const MAX_UPLOAD = 12 * 1024 * 1024;   // 单张图上限 12MB

/* 可写入的角色，落盘文件名必须和 js/config.js 里的 TEXTURES 一致 */
const TARGETS = {
  xiongda: 'xiongda.png',
  nailong: 'nailong.png'
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

/* ---------- 看文件头判断真实格式（不信任扩展名） ---------- */
function sniff(buf) {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 &&
      buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length >= 6 && buf.slice(0, 3).toString('latin1') === 'GIF') return 'gif';
  if (buf.length >= 12 && buf.slice(0, 4).toString('latin1') === 'RIFF' &&
      buf.slice(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

function sendJson(res, code, obj) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

/* ---------- 静态文件 ---------- */
function serveStatic(req, res, urlPath) {
  let rel;
  try {
    rel = decodeURIComponent(urlPath);
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: 'URL 编码有问题' });
  }
  if (rel === '/' || rel === '') rel = '/index.html';

  const abs = path.normalize(path.join(ROOT, rel));
  // 防目录穿越：必须仍在本项目目录内
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) {
    return sendJson(res, 403, { ok: false, error: '越界了' });
  }

  fs.stat(abs, function (err, st) {
    if (err || !st.isFile()) {
      return sendJson(res, 404, { ok: false, error: '找不到 ' + rel });
    }
    const type = MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': st.size,
      // 开发用：一律不缓存，换完贴图普通刷新就能看到
      'Cache-Control': 'no-store'
    });
    if (req.method === 'HEAD') return res.end();
    const stream = fs.createReadStream(abs);
    stream.on('error', function () { res.end(); });
    stream.pipe(res);
  });
}

/* ---------- 上传：POST /api/upload?type=xiongda  原始二进制体 ---------- */
function handleUpload(req, res, query) {
  const type = query.get('type');
  const filename = TARGETS[type];
  if (!filename) {
    return sendJson(res, 400, { ok: false, error: 'type 必须是 xiongda 或 nailong' });
  }

  const chunks = [];
  let size = 0;
  let tooBig = false;

  req.on('data', function (chunk) {
    if (tooBig) return;
    size += chunk.length;
    if (size > MAX_UPLOAD) {
      tooBig = true;
      chunks.length = 0;
      return sendJson(res, 413, {
        ok: false,
        error: '文件太大（上限 ' + Math.round(MAX_UPLOAD / 1024 / 1024) + 'MB）'
      });
    }
    chunks.push(chunk);
  });

  req.on('error', function () {
    if (!tooBig) sendJson(res, 400, { ok: false, error: '连接中断，没收到完整文件' });
  });

  req.on('end', function () {
    if (tooBig) return;

    const buf = Buffer.concat(chunks);
    if (!buf.length) {
      return sendJson(res, 400, { ok: false, error: '没有收到文件内容' });
    }

    const format = sniff(buf);
    if (!format) {
      return sendJson(res, 400, { ok: false, error: '看起来不是图片（支持 png / jpg / webp / gif）' });
    }

    const dest = path.join(ASSETS, filename);
    fs.mkdir(ASSETS, { recursive: true }, function (mkErr) {
      if (mkErr) {
        return sendJson(res, 500, { ok: false, error: '建 assets 目录失败: ' + mkErr.message });
      }
      fs.writeFile(dest, buf, function (wErr) {
        if (wErr) {
          return sendJson(res, 500, { ok: false, error: '写入失败: ' + wErr.message });
        }
        console.log('[上传] ' + (type === 'xiongda' ? '熊大' : '奶龙') +
                    ' ← ' + format + ' ' + buf.length + 'B  →  assets/' + filename);
        sendJson(res, 200, {
          ok: true,
          type: type,
          file: 'assets/' + filename,
          format: format,
          bytes: buf.length
        });
      });
    });
  });
}

/* ---------- 路由 ---------- */
const server = http.createServer(function (req, res) {
  const u = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));

  if (u.pathname === '/api/upload') {
    if (req.method !== 'POST') {
      return sendJson(res, 405, { ok: false, error: '请用 POST 上传' });
    }
    return handleUpload(req, res, u.searchParams);
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendJson(res, 405, { ok: false, error: '不支持的方法' });
  }

  serveStatic(req, res, u.pathname);
});

server.listen(PORT, HOST, function () {
  console.log('');
  console.log('  跑酷小服务已启动');
  console.log('    玩游戏    http://' + HOST + ':' + PORT + '/');
  console.log('    传贴图    http://' + HOST + ':' + PORT + '/upload.html');
  console.log('    Ctrl+C 停止');
  console.log('');
});
