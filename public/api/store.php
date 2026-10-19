<?php
// Shared store for the pages (see assets/store.js). One JSON file per page and
// collection: data/<ns>/<collection>.json = {id: doc}. Access is protected by
// the .htaccess password; this file only checks names and writes atomically.
// server.mjs answers the same requests when running locally.

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$DATA = getenv('HUB_DATA') ?: dirname(__DIR__, 2) . '/data';
$NAME = '/^[A-Za-z0-9_-]{1,64}$/';

function fail($code, $msg) { http_response_code($code); echo json_encode(['error' => $msg]); exit; }

$method = $_SERVER['REQUEST_METHOD'];
$in = $method === 'POST' ? json_decode(file_get_contents('php://input'), true) : $_GET;
if (!is_array($in)) fail(400, 'bad_json');
$ns = $in['ns'] ?? ''; $col = $in['c'] ?? '';
if (!preg_match($NAME, $ns) || !preg_match($NAME, $col)) fail(400, 'bad_name');

$dir = "$DATA/$ns";
$file = "$dir/$col.json";
if (!is_dir($dir) && !mkdir($dir, 0775, true)) fail(500, 'no_data_dir');

$fh = fopen($file, 'c+');
if (!$fh) fail(500, 'no_file');
flock($fh, $method === 'POST' ? LOCK_EX : LOCK_SH);
$raw = stream_get_contents($fh);
$docs = $raw ? json_decode($raw, true) : [];
if (!is_array($docs)) $docs = [];

if ($method === 'POST') {
  $id = $in['id'] ?? '';
  if (!preg_match('/^[A-Za-z0-9_.~:@+-]{1,200}$/', $id)) fail(400, 'bad_id');
  $op = $in['op'] ?? '';
  $data = $in['data'] ?? null;
  if ($op === 'set') { if (!is_array($data)) fail(400, 'bad_data'); $docs[$id] = $data; }
  elseif ($op === 'update') { if (!is_array($data)) fail(400, 'bad_data'); $docs[$id] = array_merge($docs[$id] ?? [], $data); }
  elseif ($op === 'delete') { unset($docs[$id]); }
  else fail(400, 'bad_op');
  $out = json_encode((object) $docs, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
  ftruncate($fh, 0); rewind($fh); fwrite($fh, $out); fflush($fh);
  echo $out;
} else {
  echo json_encode((object) $docs, JSON_UNESCAPED_UNICODE);
}
flock($fh, LOCK_UN);
fclose($fh);
