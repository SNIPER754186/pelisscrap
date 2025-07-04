<?php
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');
header('Access-Control-Allow-Origin: *');
flush();

function sendSSE($data) {
    echo "data: " . json_encode($data) . "\n\n";
    @ob_flush();
    @flush();
}

if (!isset($_GET['url'])) {
    sendSSE(['type' => 'error', 'message' => 'No URL provided']);
    exit;
}

$url = escapeshellarg($_GET['url']);
$process = popen("node scraper_stream.js $url", 'r');

if (!$process) {
    sendSSE(['type' => 'error', 'message' => 'No se pudo iniciar el scraper']);
    exit;
}

while (!feof($process)) {
    $line = fgets($process);
    if ($line) {
        $decoded = json_decode($line, true);
        if ($decoded) {
            sendSSE($decoded);
        }
    }
}
pclose($process);

sendSSE(['type' => 'done', 'message' => 'Scraping terminado.']);
?>
